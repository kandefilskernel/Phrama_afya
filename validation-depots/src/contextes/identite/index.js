// Module Identité : qui sont les acteurs, leur rôle, leur statut et leurs jetons.
//
// Inscription en trois temps : l'acteur s'inscrit lui-même (EN_ATTENTE), confirme son téléphone
// avec le code reçu par SMS, puis la plateforme vérifie son agrément et l'approuve (ACTIF),
// le rejette, ou le suspend plus tard.
// Seule l'empreinte des jetons est stockée : une fuite de la base ne donne accès à aucun compte.
//
// Connexion par SMS : l'acteur donne son téléphone, reçoit un code, et obtient une session qui expire
// (côté serveur) et peut être révoquée. Le jeton permanent reste valable pour les intégrations.
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ErreurMetier } from '../../transverse/erreurs.js';

export const ROLES_CREANCIER = ['depot', 'imf', 'banque'];
export const estCreancier = (role) => ROLES_CREANCIER.includes(role);
export const STATUTS = { EN_ATTENTE: 'EN_ATTENTE', ACTIF: 'ACTIF', REJETE: 'REJETE', SUSPENDU: 'SUSPENDU' };

const ROLES = ['pharmacie', ...ROLES_CREANCIER];
const CHAMPS_INSCRIPTION = ['role', 'nom', 'telephone', 'numeroAgrement', 'adresse'];
const TELEPHONE = /^\+\d{8,15}$/;

// Code de vérification du téléphone.
export const CODE = { VALIDITE_MS: 10 * 60_000, ESSAIS_MAX: 5, DELAI_RENVOI_MS: 60_000, ENVOIS_MAX_PAR_HEURE: 5 };

// Connexion par SMS : code court (5 min), sessions de 12 h, au plus 5 sessions ouvertes par compte.
export const CONNEXION = {
  VALIDITE_MS: 5 * 60_000, ESSAIS_MAX: 5, DELAI_RENVOI_MS: 60_000, ENVOIS_MAX_PAR_HEURE: 5,
  SESSION_MS: 12 * 3600_000, SESSIONS_MAX: 5,
};
// Les codes en clair ne restent dans le flux d'événements que le temps de leur envoi.
const RETENTION_CODES_MS = 3600_000;
const MESSAGE_CODE_REFUSE = 'Code incorrect ou expiré. Demandez un nouveau code.';

const hacher = (jeton) => createHash('sha256').update(jeton).digest('hex');
const empreinteCode = (acteurId, code) => hacher(`${acteurId}:${code}`);
const memesEmpreintes = (a, b) => timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const nouveauJeton = () => randomBytes(32).toString('base64url');

function texte(v, nom, min, max) {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) {
    throw new ErreurMetier(400, `${nom} : texte de ${min} à ${max} caractères requis`);
  }
  return v.trim();
}

export function creerIdentite({ stockage, horloge = Date.now }) {
  const acteurs = (stockage.donnees.acteurs ??= []);
  const outbox = (stockage.donnees.outbox ??= []);
  const sessions = (stockage.donnees.sessions ??= []);
  stockage.donnees.purgeJusqua ??= 0;

  // Données antérieures : jetons en clair et absence de statut.
  let migre = false;
  for (const a of acteurs) {
    if (a.token) { a.jetonHash = hacher(a.token); delete a.token; migre = true; }
    if (!a.statut) { a.statut = STATUTS.ACTIF; migre = true; }
    // Comptes antérieurs à la vérification : ceux déjà actifs sont considérés comme vérifiés.
    if (a.telephoneVerifie === undefined) { a.telephoneVerifie = a.statut !== STATUTS.EN_ATTENTE; migre = true; }
  }
  if (migre) stockage.sauver();

  // Efface les codes en clair des événements de plus d'une heure : ils sont expirés depuis longtemps.
  function purgerCodes() {
    const limite = horloge() - RETENTION_CODES_MS;
    let i = stockage.donnees.purgeJusqua;
    while (i < outbox.length && outbox[i].le < limite) {
      if (outbox[i].donnees?.code) outbox[i].donnees = { ...outbox[i].donnees, code: null };
      i += 1;
    }
    stockage.donnees.purgeJusqua = i;
  }
  purgerCodes();

  const emettre = (type, a, donnees = {}) => {
    purgerCodes();
    outbox.push({ seq: outbox.length + 1, id: randomUUID(), type, le: horloge(), acteurId: a.id, role: a.role, donnees });
  };
  const publique = ({ jetonHash, verification, connexion, ...reste }) => reste;

  // Un numéro correspond à au plus un compte non rejeté (voir `doublon`). Il doit avoir été prouvé par code SMS.
  const parTelephone = (telephone) => acteurs.find((a) => a.telephone === telephone && a.telephoneVerifie && a.statut !== STATUTS.REJETE) ?? null;

  function retirerSessionsExpirees() {
    const now = horloge();
    for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].expireLe <= now) sessions.splice(i, 1);
  }
  function ouvrirSessionActeur(a) {
    retirerSessionsExpirees();
    const miennes = sessions.filter((s) => s.acteurId === a.id);
    // Au plus SESSIONS_MAX sessions ouvertes : on ferme les plus anciennes.
    while (miennes.length >= CONNEXION.SESSIONS_MAX) sessions.splice(sessions.indexOf(miennes.shift()), 1);
    const jeton = nouveauJeton();
    const now = horloge();
    sessions.push({ hash: hacher(jeton), acteurId: a.id, creeLe: now, expireLe: now + CONNEXION.SESSION_MS });
    return { jeton, expireLe: now + CONNEXION.SESSION_MS };
  }
  const retirerSessionsDe = (acteurId) => {
    for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].acteurId === acteurId) sessions.splice(i, 1);
  };
  const trouver = (id) => {
    const a = acteurs.find((x) => x.id === id);
    if (!a) throw new ErreurMetier(404, 'Acteur inconnu');
    return a;
  };
  const doublon = (telephone, role, numeroAgrement) => acteurs.some((a) => a.statut !== STATUTS.REJETE
    && ((telephone && a.telephone === telephone) || (numeroAgrement && a.role === role && a.numeroAgrement === numeroAgrement)));

  function creer({ role, nom, telephone, numeroAgrement = null, adresse = null, statut, telephoneVerifie }) {
    const jeton = nouveauJeton();
    const now = horloge();
    const a = {
      id: randomUUID(), role, nom, telephone, telephoneVerifie, numeroAgrement, adresse, statut,
      jetonHash: hacher(jeton), inscritLe: now, historique: [{ le: now, statut }],
    };
    acteurs.push(a);
    return { a, jeton };
  }

  // Nouveau code envoyé par SMS (via l'événement lu par Notifications). Seule son empreinte reste sur le compte ;
  // la copie de l'événement ne sert plus à rien une fois le code expiré ou utilisé.
  function emettreCode(a) {
    const now = horloge();
    const envois = (a.verification?.envois ?? []).filter((t) => now - t < 3600_000);
    if (envois.length > 0 && now - envois.at(-1) < CODE.DELAI_RENVOI_MS) {
      throw new ErreurMetier(429, `Attendez ${Math.ceil((CODE.DELAI_RENVOI_MS - (now - envois.at(-1))) / 1000)} s avant de redemander un code`);
    }
    if (envois.length >= CODE.ENVOIS_MAX_PAR_HEURE) throw new ErreurMetier(429, 'Trop de codes demandés, réessayez dans une heure');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expireLe = now + CODE.VALIDITE_MS;
    a.verification = { codeHash: empreinteCode(a.id, code), expireLe, essais: 0, envois: [...envois, now] };
    emettre('CodeVerificationEmis', a, { code, expireLe });
  }

  function exigerVerifiable(a) {
    if (a.telephoneVerifie) throw new ErreurMetier(409, 'Téléphone déjà vérifié');
    if (a.statut !== STATUTS.EN_ATTENTE) throw new ErreurMetier(409, `Impossible depuis le statut ${a.statut}`);
  }

  // `par` : l'administrateur auteur de la décision ({ id, nom }). Il est enregistré dans l'historique du compte,
  // dans la même écriture que la décision : pas de décision sans auteur.
  function changerStatut(id, { de, vers, type, action, motif = null, par }) {
    if (!par?.id) throw new Error('auteur de la décision requis');
    const a = trouver(id);
    if (!de.includes(a.statut)) throw new ErreurMetier(409, `Impossible depuis le statut ${a.statut}`);
    if (vers === STATUTS.ACTIF && a.statut === STATUTS.EN_ATTENTE && !a.telephoneVerifie) {
      throw new ErreurMetier(409, "Téléphone non vérifié : l'acteur doit d'abord saisir le code reçu par SMS");
    }
    a.motif = motif === null ? null : texte(motif, 'motif', 3, 500);
    a.statut = vers;
    a.historique.push({ le: horloge(), action, statut: vers, motif: a.motif, par });
    emettre(type, a, { ...(a.motif ? { motif: a.motif } : {}), parAdminId: par.id });
    stockage.sauver();
    return publique(a);
  }

  return {
    // Création directe, déjà active : réservée au code (amorçage, tests). Renvoie le jeton une seule fois.
    inscrire(role, nom, telephone = null) {
      if (!ROLES.includes(role)) throw new ErreurMetier(400, `Rôle inconnu : ${role}`);
      if (telephone !== null && !TELEPHONE.test(telephone)) throw new ErreurMetier(400, 'telephone au format +243...');
      const { a, jeton } = creer({ role, nom, telephone, statut: STATUTS.ACTIF, telephoneVerifie: telephone !== null });
      stockage.sauver();
      return { ...publique(a), token: jeton };
    },

    // Inscription publique : un code part par SMS, puis l'acteur attend la vérification de son agrément.
    // Le jeton est renvoyé une seule fois ; tant que le compte n'est pas actif, il ne sert qu'à vérifier
    // son téléphone et à consulter son statut.
    demanderInscription(corps) {
      if (typeof corps !== 'object' || corps === null) throw new ErreurMetier(400, 'Corps invalide');
      for (const k of Object.keys(corps)) if (!CHAMPS_INSCRIPTION.includes(k)) throw new ErreurMetier(400, `Champ non autorisé : ${k}`);
      if (!ROLES.includes(corps.role)) throw new ErreurMetier(400, `role doit être l'un de : ${ROLES.join(', ')}`);
      const nom = texte(corps.nom, 'nom', 2, 120);
      if (typeof corps.telephone !== 'string' || !TELEPHONE.test(corps.telephone)) throw new ErreurMetier(400, 'telephone au format +243...');
      const numeroAgrement = texte(corps.numeroAgrement, 'numeroAgrement', 3, 60);
      const adresse = corps.adresse === undefined ? null : texte(corps.adresse, 'adresse', 3, 300);
      if (doublon(corps.telephone, corps.role, numeroAgrement)) throw new ErreurMetier(409, 'Un compte existe déjà avec ce téléphone ou cet agrément');

      const { a, jeton } = creer({
        role: corps.role, nom, telephone: corps.telephone, numeroAgrement, adresse, statut: STATUTS.EN_ATTENTE, telephoneVerifie: false,
      });
      emettre('InscriptionDemandee', a);
      emettreCode(a);
      stockage.sauver();
      return { ...publique(a), token: jeton };
    },

    // Connexion par SMS, étape 1. La réponse est la même que le numéro ait un compte ou non, et même si le code
    // n'est pas renvoyé (délai entre deux envois, plafond horaire) : on ne révèle pas quels numéros sont inscrits.
    demanderCodeConnexion(telephone) {
      if (typeof telephone !== 'string' || !TELEPHONE.test(telephone)) throw new ErreurMetier(400, 'telephone au format +243...');
      const a = parTelephone(telephone);
      if (!a) return { envoye: true };
      const now = horloge();
      const envois = (a.connexion?.envois ?? []).filter((t) => now - t < 3600_000);
      const tropTot = envois.length > 0 && now - envois.at(-1) < CONNEXION.DELAI_RENVOI_MS;
      if (tropTot || envois.length >= CONNEXION.ENVOIS_MAX_PAR_HEURE) return { envoye: true };
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expireLe = now + CONNEXION.VALIDITE_MS;
      a.connexion = { codeHash: empreinteCode(a.id, code), expireLe, essais: 0, envois: [...envois, now] };
      emettre('CodeConnexionEmis', a, { code, expireLe });
      stockage.sauver();
      return { envoye: true };
    },

    // Connexion par SMS, étape 2. Toutes les causes d'échec donnent la même réponse : numéro inconnu, code faux,
    // code expiré, trop d'essais. Après ESSAIS_MAX erreurs, le code est inutilisable même s'il est juste.
    verifierCodeConnexion(telephone, code) {
      const refus = () => new ErreurMetier(400, MESSAGE_CODE_REFUSE);
      if (typeof telephone !== 'string' || !TELEPHONE.test(telephone) || typeof code !== 'string' || !/^\d{6}$/.test(code)) throw refus();
      const a = parTelephone(telephone);
      const c = a?.connexion;
      if (!a || !c || horloge() > c.expireLe || c.essais >= CONNEXION.ESSAIS_MAX) throw refus();
      if (!memesEmpreintes(empreinteCode(a.id, code), c.codeHash)) {
        c.essais += 1;
        stockage.sauver();
        throw refus();
      }
      delete a.connexion;
      a.derniereConnexionLe = horloge();
      const session = ouvrirSessionActeur(a);
      stockage.sauver();
      return { token: session.jeton, expireLe: session.expireLe, role: a.role, statut: a.statut };
    },

    // Ferme la session correspondant à ce jeton. Le jeton permanent n'est pas concerné.
    revoquerSession(jeton) {
      if (typeof jeton !== 'string') return false;
      const hash = hacher(jeton);
      const i = sessions.findIndex((s) => s.hash === hash);
      if (i === -1) return false;
      sessions.splice(i, 1);
      stockage.sauver();
      return true;
    },

    renvoyerCode(id) {
      const a = trouver(id);
      exigerVerifiable(a);
      emettreCode(a);
      stockage.sauver();
      return { envoye: true, expireLe: a.verification.expireLe };
    },

    verifierTelephone(id, code) {
      const a = trouver(id);
      exigerVerifiable(a);
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new ErreurMetier(400, 'code : 6 chiffres');
      const v = a.verification;
      if (!v || horloge() > v.expireLe) throw new ErreurMetier(400, 'Code expiré, demandez-en un nouveau');
      if (v.essais >= CODE.ESSAIS_MAX) throw new ErreurMetier(429, 'Trop d\'essais, demandez un nouveau code');
      if (!memesEmpreintes(empreinteCode(a.id, code), v.codeHash)) {
        v.essais += 1;
        stockage.sauver();
        throw new ErreurMetier(400, `Code incorrect, ${CODE.ESSAIS_MAX - v.essais} essai(s) restant(s)`);
      }
      a.telephoneVerifie = true;
      delete a.verification;
      a.historique.push({ le: horloge(), statut: a.statut, telephoneVerifie: true });
      emettre('TelephoneVerifie', a);
      stockage.sauver();
      return publique(a);
    },

    approuver: (id, par) => changerStatut(id, { de: [STATUTS.EN_ATTENTE], vers: STATUTS.ACTIF, type: 'InscriptionApprouvee', action: 'approuver', par }),
    rejeter: (id, motif, par) => changerStatut(id, { de: [STATUTS.EN_ATTENTE], vers: STATUTS.REJETE, type: 'InscriptionRejetee', action: 'rejeter', motif, par }),
    suspendre: (id, motif, par) => changerStatut(id, { de: [STATUTS.ACTIF], vers: STATUTS.SUSPENDU, type: 'CompteSuspendu', action: 'suspendre', motif, par }),
    reactiver: (id, par) => changerStatut(id, { de: [STATUTS.SUSPENDU], vers: STATUTS.ACTIF, type: 'CompteReactive', action: 'reactiver', par }),

    // Décisions de l'administration sur les comptes, tirées des historiques : qui, quoi, quand, pourquoi.
    journalDecisions: () => acteurs.flatMap((a) => a.historique.filter((h) => h.par).map((h) => ({
      le: h.le, par: h.par, action: h.action, cibleId: a.id, cibleNom: a.nom, ...(h.motif ? { motif: h.motif } : {}),
    }))),

    // Nouveau jeton, l'ancien cesse de fonctionner. Sert à l'acteur (rotation) et à l'administration (jeton perdu).
    // `par` : l'administrateur qui réémet le jeton d'un acteur (jeton perdu) ; absent quand l'acteur le remplace lui-même.
    renouvelerJeton(id, par = null) {
      const a = trouver(id);
      if (a.statut === STATUTS.REJETE) throw new ErreurMetier(409, 'Compte rejeté');
      const jeton = nouveauJeton();
      a.jetonHash = hacher(jeton);
      // Jeton perdu, réémis par l'administration : les sessions ouvertes sont fermées par précaution.
      if (par) { a.historique.push({ le: horloge(), action: 'reemettre-jeton', statut: a.statut, par }); retirerSessionsDe(a.id); }
      stockage.sauver();
      return { id: a.id, token: jeton };
    },

    // Acteur correspondant au jeton, quel que soit son statut : l'appelant décide de ce qui est permis.
    // Le jeton permanent, ou une session encore valide.
    parToken(jeton) {
      if (typeof jeton !== 'string') return null;
      const hash = hacher(jeton);
      const permanent = acteurs.find((a) => a.jetonHash === hash);
      if (permanent) return permanent;
      const s = sessions.find((x) => x.hash === hash && x.expireLe > horloge());
      return s ? acteurs.find((a) => a.id === s.acteurId) ?? null : null;
    },
    // Seuls les prêteurs actifs reçoivent des demandes et figurent dans l'annuaire.
    creancierParId: (id) => acteurs.find((a) => a.id === id && estCreancier(a.role) && a.statut === STATUTS.ACTIF) ?? null,
    creanciers: () => acteurs.filter((a) => estCreancier(a.role) && a.statut === STATUTS.ACTIF),
    lister: ({ statut = null, role = null } = {}) => acteurs
      .filter((a) => (!statut || a.statut === statut) && (!role || a.role === role)).map(publique),
    // Coordonnées pour les autres services (route interne uniquement), quel que soit le statut.
    contact(id) {
      const a = acteurs.find((x) => x.id === id);
      return a ? { id: a.id, role: a.role, nom: a.nom, telephone: a.telephone ?? null } : null;
    },
    vuePublique: publique,
    evenementsApres: (seq, limite = 100) => outbox.filter((e) => e.seq > seq).slice(0, limite),
  };
}
