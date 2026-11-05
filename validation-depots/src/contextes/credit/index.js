// Module Crédit : source de vérité des demandes, des états et des remboursements constatés.
//
// Chaque changement d'état est enregistré avec son événement dans la MÊME écriture (outbox),
// puis `relayer()` publie les événements en attente sur le bus, dans l'ordre. Un consommateur
// en panne n'empêche donc jamais une opération et ne fait perdre aucun événement.
import { randomUUID } from 'node:crypto';
import { ACTIONS, ETATS, ErreurMetier, appliquerAction, creerDemande, expirerSiBesoin, vueDemande } from './workflow.js';
import { estCreancier } from '../identite/index.js';
import { scoringRelation, solde } from '../scoring/index.js';

export { ErreurMetier };

const EVENEMENT_PAR_ACTION = {
  valider: 'DemandeValidee',
  refuser: 'DemandeRefusee',
  livrer: 'MarchandiseLivree',
  receptionner: 'MarchandiseRecue',
  annuler: 'DemandeAnnulee',
};

// ports.identite.creancierParId(id), contact(id) ; ports.conditions.obtenir(id) : fournis par la racine de composition.
export function creerCredit({ stockage, ports, horloge = Date.now }) {
  const etat = stockage.donnees;
  const demandes = (etat.demandes ??= []);
  const outbox = (etat.outbox ??= []);
  outbox.forEach((e, i) => { e.seq ??= i + 1; }); // données antérieures à la numérotation

  // `seq` : numéro d'ordre croissant, sert de curseur aux services qui lisent le flux.
  const emettre = (type, d, donnees = {}) => outbox.push({
    seq: outbox.length + 1, id: randomUUID(), type, le: horloge(),
    demandeId: d.id, creancierId: d.creancierId, pharmacieId: d.pharmacieId, donnees, publie: false,
  });

  // Données utiles aux consommateurs, pour qu'ils n'aient pas à rappeler Crédit.
  const donneesDe = {
    valider: (d) => ({ valeurCents: d.valeurCents, delaiAccordeJours: d.delaiAccordeJours }),
    refuser: (d) => ({ motif: d.motifRefus }),
    receptionner: (d) => ({ echeanceLe: d.echeanceLe, graceJours: d.graceJours, valeurCents: d.valeurCents }),
  };
  const relation = (pharmacieId, creancierId) =>
    demandes.filter((d) => d.pharmacieId === pharmacieId && d.creancierId === creancierId);

  // Applique l'expiration paresseuse et en garde la trace d'événement.
  const rafraichir = (d) => {
    const avant = d.etat;
    expirerSiBesoin(d, horloge());
    if (avant !== d.etat) emettre('DemandeExpiree', d);
    return d;
  };
  const visibles = (acteur) => demandes
    .filter((d) => (estCreancier(acteur.role) ? d.creancierId === acteur.id : d.pharmacieId === acteur.id));

  // Vue pour l'API : la demande, son solde et le nom des deux parties (affichage).
  const vue = (d, now = horloge()) => ({
    ...vueDemande(d, now),
    pharmacieNom: ports.identite.contact(d.pharmacieId)?.nom ?? null,
    creancierNom: ports.identite.contact(d.creancierId)?.nom ?? null,
  });

  return {
    soumettre(pharmacie, corps) {
      if (pharmacie.role !== 'pharmacie') throw new ErreurMetier(403, 'Réservé aux pharmacies');
      const creancier = ports.identite.creancierParId(corps.creancierId);
      if (!creancier) throw new ErreurMetier(400, 'Prêteur inconnu');
      const d = creerDemande({
        pharmacie, creancier, conditions: ports.conditions.obtenir(creancier.id), corps, id: randomUUID(), now: horloge(),
      });
      demandes.push(d);
      emettre('DemandeSoumise', d, { expireLe: d.expireLe });
      stockage.sauver();
      return vue(d);
    },

    lister(acteur, filtreEtat = null) {
      const res = visibles(acteur).map(rafraichir);
      stockage.sauver();
      return res.filter((d) => !filtreEtat || d.etat === filtreEtat).map((d) => vue(d));
    },

    voir(acteur, id) {
      const d = visibles(acteur).find((x) => x.id === id);
      if (!d) throw new ErreurMetier(404, 'Demande introuvable');
      rafraichir(d);
      stockage.sauver();
      return vue(d);
    },

    agir(acteur, id, action, corps = {}) {
      if (!ACTIONS[action]) throw new ErreurMetier(404, 'Route inconnue');
      const d = demandes.find((x) => x.id === id);
      if (!d) throw new ErreurMetier(404, 'Demande introuvable');
      const avant = d.etat;
      const now = horloge();
      try {
        appliquerAction({
          demande: d, action, acteur, corps, now,
          contexte: {
            demandesRelation: relation(d.pharmacieId, d.creancierId),
            conditions: estCreancier(acteur.role) ? ports.conditions.obtenir(acteur.id) : null,
          },
        });
      } catch (e) {
        // L'expiration peut avoir eu lieu avant le refus : on la garde.
        if (avant !== ETATS.EXPIREE && d.etat === ETATS.EXPIREE) { emettre('DemandeExpiree', d); stockage.sauver(); }
        throw e;
      }
      if (action === 'rembourser') {
        const dernier = d.remboursements.at(-1);
        emettre('RemboursementConstate', d, { montantCents: dernier.montantCents, soldeCents: solde(d) });
        if (d.etat === ETATS.CLOTUREE) emettre('DemandeCloturee', d);
      } else {
        emettre(EVENEMENT_PAR_ACTION[action], d, donneesDe[action]?.(d) ?? {});
      }
      stockage.sauver();
      return vue(d, now);
    },

    // Crédit d'une pharmacie, prêteur par prêteur. Un prêteur ne voit que sa propre relation.
    creditPharmacie(acteur, pharmacieId) {
      const now = horloge();
      if (estCreancier(acteur.role)) {
        const siennes = relation(pharmacieId, acteur.id);
        if (siennes.length === 0) throw new ErreurMetier(404, 'Pharmacie introuvable');
        return scoringRelation(siennes, ports.conditions.obtenir(acteur.id), now);
      }
      if (acteur.id !== pharmacieId) throw new ErreurMetier(404, 'Pharmacie introuvable');
      const ids = [...new Set(demandes.filter((d) => d.pharmacieId === pharmacieId).map((d) => d.creancierId))];
      return ids.map((cid) => {
        const c = ports.identite.contact(cid); // le prêteur peut avoir été suspendu depuis
        return { creancierId: cid, type: c.role, nom: c.nom, ...scoringRelation(relation(pharmacieId, cid), ports.conditions.obtenir(cid), now) };
      });
    },

    // Publie les événements en attente, dans l'ordre. S'arrête au premier échec pour garder l'ordre ;
    // le prochain passage reprend au même endroit (livraison au moins une fois).
    async relayer(bus) {
      let publies = 0;
      for (const ev of outbox) {
        if (ev.publie) continue;
        try { await bus.publier(ev); } catch { break; }
        ev.publie = true;
        publies += 1;
      }
      if (publies > 0) stockage.sauver();
      return publies;
    },

    enAttente: () => outbox.filter((e) => !e.publie).length,

    // Flux d'événements pour les services externes : chacun lit avec son propre curseur.
    evenementsApres(seq, limite = 100) {
      return outbox.filter((e) => e.seq > seq).slice(0, limite).map(({ publie, ...e }) => e);
    },

    // Passe en EXPIREE les demandes sans réponse dans le délai du prêteur (appelé par l'Échéancier),
    // pour que l'événement parte même si personne ne consulte la demande.
    expirerEchues() {
      const avant = outbox.length;
      demandes.filter((d) => d.etat === ETATS.SOUMISE).forEach(rafraichir);
      const expirees = outbox.length - avant;
      if (expirees > 0) stockage.sauver();
      return expirees;
    },
  };
}
