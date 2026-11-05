// Module Administration : comptes nominatifs de l'équipe de la plateforme et journal de leur gestion.
//
// Deux rôles :
//   - agent       : vérifie les inscriptions, approuve, rejette, suspend, réactive ;
//   - superviseur : peut en plus gérer les administrateurs, réémettre le jeton d'un acteur et lire le journal.
// Le premier superviseur est créé par amorçage, une seule fois, quand aucun administrateur n'existe.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ErreurMetier } from '../../transverse/erreurs.js';

export const ROLES_ADMIN = { SUPERVISEUR: 'superviseur', AGENT: 'agent' };

const CHAMPS = ['nom', 'telephone', 'role'];
const TELEPHONE = /^\+\d{8,15}$/;
const hacher = (jeton) => createHash('sha256').update(jeton).digest('hex');
const nouveauJeton = () => randomBytes(32).toString('base64url');

export function creerAdministration({ stockage, horloge = Date.now }) {
  const admins = (stockage.donnees.admins ??= []);
  const journal = (stockage.donnees.journal ??= []);

  const publique = ({ jetonHash, ...reste }) => reste;
  const auteur = (a) => ({ id: a.id, nom: a.nom });
  const noter = (par, action, cible, details = {}) => journal.push({
    id: randomUUID(), le: horloge(), par: auteur(par), action, cibleId: cible.id, cibleNom: cible.nom, ...details,
  });
  const trouver = (id) => {
    const a = admins.find((x) => x.id === id);
    if (!a) throw new ErreurMetier(404, 'Administrateur inconnu');
    return a;
  };

  function exigerSuperviseur(par) {
    if (par?.role !== ROLES_ADMIN.SUPERVISEUR) throw new ErreurMetier(403, 'Réservé aux superviseurs');
  }

  function nouveauCompte(corps, role) {
    if (typeof corps !== 'object' || corps === null) throw new ErreurMetier(400, 'Corps invalide');
    for (const k of Object.keys(corps)) if (!CHAMPS.includes(k)) throw new ErreurMetier(400, `Champ non autorisé : ${k}`);
    if (typeof corps.nom !== 'string' || corps.nom.trim().length < 2 || corps.nom.trim().length > 120) {
      throw new ErreurMetier(400, 'nom : texte de 2 à 120 caractères requis');
    }
    if (typeof corps.telephone !== 'string' || !TELEPHONE.test(corps.telephone)) throw new ErreurMetier(400, 'telephone au format +243...');
    if (!Object.values(ROLES_ADMIN).includes(role)) throw new ErreurMetier(400, `role doit être ${Object.values(ROLES_ADMIN).join(' ou ')}`);
    if (admins.some((a) => a.actif && a.telephone === corps.telephone)) throw new ErreurMetier(409, 'Un administrateur actif utilise déjà ce téléphone');
    const jeton = nouveauJeton();
    const a = {
      id: randomUUID(), nom: corps.nom.trim(), telephone: corps.telephone, role, actif: true,
      jetonHash: hacher(jeton), creeLe: horloge(),
    };
    admins.push(a);
    return { a, jeton };
  }

  return {
    // Crée le premier superviseur. Impossible dès qu'un administrateur existe, même désactivé.
    amorcer(corps) {
      if (admins.length > 0) throw new ErreurMetier(409, 'Un administrateur existe déjà : amorçage impossible');
      if (corps?.role !== undefined) throw new ErreurMetier(400, 'Le premier administrateur est toujours superviseur');
      const { a, jeton } = nouveauCompte(corps, ROLES_ADMIN.SUPERVISEUR);
      noter(a, 'amorcer', a, { role: a.role });
      stockage.sauver();
      return { ...publique(a), token: jeton };
    },

    creer(corps, par) {
      exigerSuperviseur(par);
      const { role, ...reste } = corps ?? {};
      const { a, jeton } = nouveauCompte(reste, role);
      noter(par, 'creer-admin', a, { role: a.role });
      stockage.sauver();
      return { ...publique(a), token: jeton };
    },

    desactiver(id, motif, par) {
      exigerSuperviseur(par);
      if (typeof motif !== 'string' || motif.trim().length < 3) throw new ErreurMetier(400, 'motif requis');
      const a = trouver(id);
      if (a.id === par.id) throw new ErreurMetier(409, 'Impossible de se désactiver soi-même');
      if (!a.actif) throw new ErreurMetier(409, 'Administrateur déjà désactivé');
      // Seul un superviseur actif désactive, et jamais lui-même : il reste donc toujours un superviseur actif.
      a.actif = false;
      a.desactiveLe = horloge();
      noter(par, 'desactiver-admin', a, { motif: motif.trim() });
      stockage.sauver();
      return publique(a);
    },

    // Un administrateur remplace son propre jeton ; un superviseur peut réémettre celui d'un autre (jeton perdu).
    renouvelerJeton(id, par) {
      if (id !== par.id) exigerSuperviseur(par);
      const a = trouver(id);
      if (!a.actif) throw new ErreurMetier(409, 'Administrateur désactivé');
      const jeton = nouveauJeton();
      a.jetonHash = hacher(jeton);
      noter(par, 'jeton-admin', a);
      stockage.sauver();
      return { id: a.id, token: jeton };
    },

    // Administrateur actif correspondant au jeton, sinon null.
    parJeton: (jeton) => (typeof jeton === 'string' ? admins.find((a) => a.actif && a.jetonHash === hacher(jeton)) ?? null : null),
    lister(par) {
      exigerSuperviseur(par);
      return admins.map(publique);
    },
    journal(par) {
      exigerSuperviseur(par);
      return [...journal];
    },
    auteur,
    publique,
    exigerSuperviseur,
  };
}
