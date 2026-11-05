// File d'envoi des SMS : création idempotente, envoi avec reprises espacées.
import { MODELES } from '../domaine/modeles.js';
import { encodage, segments, versGsm7 } from '../domaine/gsm7.js';

export const MAX_TENTATIVES = 8;
const ATTENTE_BASE_MS = 30_000;
const ATTENTE_MAX_MS = 3600_000;
export const attenteApres = (tentatives) => Math.min(ATTENTE_BASE_MS * 2 ** (tentatives - 1), ATTENTE_MAX_MS);

const CHAMPS = ['cle', 'destinataireId', 'modele', 'donnees', 'pharmacieId', 'creancierId', 'perimeLe'];

export class ErreurRequete extends Error {}

const JOUR_MS = 24 * 3600 * 1000;
// Les numéros n'ont rien à faire dans les erreurs enregistrées ou journalisées.
export const masquerNumeros = (texte) => String(texte).replace(/\+?\d[\d ]{6,}\d/g, (n) => `${'•'.repeat(Math.max(0, n.length - 3))}${n.slice(-3)}`);

// contacts(id) -> Promise<{ nom, telephone } | null> ; fournisseur.envoyer({ telephone, texte }) -> Promise<{ id }>
// gsm7 : simplifie les caractères qui feraient passer le SMS en Unicode (plus cher).
// plafondJour : nombre maximal de SMS envoyés par jour (UTC). Au-delà, les messages attendent le lendemain.
export function creerNotifications({ stockage, contacts, fournisseur, horloge = Date.now, prefixe = '', gsm7 = true, plafondJour = null }) {
  const messages = (stockage.donnees.messages ??= {});
  let alertePlafondLe = null;

  const envoyesAujourdhui = (now) => {
    const debut = now - (now % JOUR_MS);
    return Object.values(messages).filter((m) => m.statut === 'ENVOYE' && m.envoyeLe >= debut).length;
  };

  function valider(m) {
    for (const k of Object.keys(m)) if (!CHAMPS.includes(k)) throw new ErreurRequete(`Champ non autorisé : ${k}`);
    for (const k of ['cle', 'destinataireId']) {
      if (typeof m[k] !== 'string' || !m[k] || m[k].length > 200) throw new ErreurRequete(`${k} requis`);
    }
    // Facultatifs : présents pour un message lié à un crédit.
    for (const k of ['pharmacieId', 'creancierId']) {
      if (m[k] !== undefined && (typeof m[k] !== 'string' || !m[k] || m[k].length > 200)) throw new ErreurRequete(`${k} invalide`);
    }
    if (m.perimeLe !== undefined && !Number.isInteger(m.perimeLe)) throw new ErreurRequete('perimeLe invalide');
    if (!MODELES[m.modele]) throw new ErreurRequete(`Modèle inconnu : ${m.modele}`);
    if (typeof m.donnees !== 'object' || m.donnees === null || Array.isArray(m.donnees)) throw new ErreurRequete('donnees invalides');
  }

  return {
    // Renvoie { cree: false } si la clé existe déjà : rien n'est envoyé deux fois.
    demander(m) {
      valider(m);
      if (messages[m.cle]) return { cree: false, statut: messages[m.cle].statut };
      const now = horloge();
      messages[m.cle] = { ...m, statut: 'EN_ATTENTE', tentatives: 0, prochaineTentativeLe: now, creeLe: now };
      stockage.sauver();
      return { cree: true, statut: 'EN_ATTENTE' };
    },

    async envoyerEnAttente() {
      const now = horloge();
      const dus = Object.values(messages)
        .filter((m) => m.statut === 'EN_ATTENTE' && m.prochaineTentativeLe <= now)
        .sort((a, b) => a.creeLe - b.creeLe);
      let envoyes = 0;
      let restants = plafondJour === null ? Infinity : plafondJour - envoyesAujourdhui(now);
      for (const m of dus) {
        if (restants <= 0) {
          // Plafond atteint : les messages restent en attente, rien n'est perdu. Une alerte par jour.
          if (alertePlafondLe === null || alertePlafondLe < now - (now % JOUR_MS)) {
            console.warn(JSON.stringify({ alerte: 'plafond SMS journalier atteint', plafond: plafondJour, enAttente: dus.length - envoyes }));
            alertePlafondLe = now;
          }
          break;
        }
        if (m.perimeLe !== undefined && now > m.perimeLe) {
          m.statut = 'PERIME';
          stockage.sauver();
          continue;
        }
        let dest; let pharmacie; let preteur;
        const contactSi = (id) => (id ? contacts(id) : undefined);
        try {
          [dest, pharmacie, preteur] = await Promise.all([contacts(m.destinataireId), contactSi(m.pharmacieId), contactSi(m.creancierId)]);
        } catch (e) {
          // Plateforme injoignable : panne d'infrastructure, on réessaie sans consommer de tentative.
          m.prochaineTentativeLe = now + ATTENTE_BASE_MS;
          m.derniereErreur = masquerNumeros(e.message);
          stockage.sauver();
          continue;
        }
        // Un contact demandé mais introuvable (null) rend le message impossible à rédiger.
        if (!dest?.telephone || pharmacie === null || preteur === null) {
          m.statut = 'SANS_CONTACT';
          stockage.sauver();
          continue;
        }
        const brut = `${prefixe}${MODELES[m.modele](m.donnees, { destinataire: dest, pharmacie, preteur })}`;
        const texte = gsm7 ? versGsm7(brut) : brut;
        try {
          const r = await fournisseur.envoyer({ telephone: dest.telephone, texte });
          Object.assign(m, {
            statut: 'ENVOYE', envoyeLe: horloge(), texte, derniereErreur: null,
            fournisseurId: r?.id ?? null, encodage: encodage(texte), segments: segments(texte),
          });
          envoyes += 1;
          restants -= 1;
        } catch (e) {
          m.tentatives += 1;
          m.derniereErreur = masquerNumeros(e.message);
          // Erreur propre au destinataire (numéro invalide, liste noire) : réessayer ne servirait à rien.
          if (e.definitif || m.tentatives >= MAX_TENTATIVES) m.statut = 'ECHEC_DEFINITIF';
          else m.prochaineTentativeLe = now + attenteApres(m.tentatives);
        }
        stockage.sauver();
      }
      return envoyes;
    },

    lister: (filtre = {}) => Object.values(messages)
      .filter((m) => (!filtre.destinataireId || m.destinataireId === filtre.destinataireId) && (!filtre.statut || m.statut === filtre.statut)),
  };
}
