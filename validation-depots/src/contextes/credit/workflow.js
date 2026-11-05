// Flux de validation d'une demande de crédit par un prêteur (dépôt, IMF ou banque).
//
// Le prêteur est le créancier : il avance le produit, fixe ses propres conditions, décide
// et suit le remboursement. La plateforme ne détient, ne transfère et ne déclenche aucun
// paiement. Les montants sont des écritures déclaratives, jamais des mouvements de fonds.
//
// Ce fichier ne contient que des règles pures : pas de stockage, pas de réseau.

import { ErreurMetier } from '../../transverse/erreurs.js';
import { estCreancier } from '../identite/index.js';
import { JOUR_MS, scoringRelation, solde } from '../scoring/index.js';

export { ErreurMetier };

export const ETATS = {
  SOUMISE: 'SOUMISE',
  VALIDEE: 'VALIDEE',
  REFUSEE: 'REFUSEE',
  LIVREE: 'LIVREE',
  RECEPTIONNEE: 'RECEPTIONNEE', // marchandise reçue, dette en cours
  CLOTUREE: 'CLOTUREE',         // dette entièrement remboursée
  ANNULEE: 'ANNULEE',
  EXPIREE: 'EXPIREE',
};

// action -> { de: états source, role: 'creancier' | 'pharmacie' | 'any', vers: état cible (null = calculé) }
export const ACTIONS = {
  valider:      { de: [ETATS.SOUMISE],      role: 'creancier', vers: ETATS.VALIDEE },
  refuser:      { de: [ETATS.SOUMISE],      role: 'creancier', vers: ETATS.REFUSEE },
  livrer:       { de: [ETATS.VALIDEE],      role: 'creancier', vers: ETATS.LIVREE },
  receptionner: { de: [ETATS.LIVREE],       role: 'pharmacie', vers: ETATS.RECEPTIONNEE },
  rembourser:   { de: [ETATS.RECEPTIONNEE], role: 'creancier', vers: null },
  annuler:      { de: [ETATS.SOUMISE, ETATS.VALIDEE], role: 'any', vers: ETATS.ANNULEE },
};

const CHAMPS_CREATION = ['creancierId', 'lignes', 'note'];
const CHAMPS_LIGNE = ['produit', 'quantite'];

function exigerChampsConnus(obj, autorises, nom) {
  for (const k of Object.keys(obj)) {
    if (!autorises.includes(k)) throw new ErreurMetier(400, `Champ non autorisé dans ${nom} : ${k}`);
  }
}

// Dollars (au plus 2 décimales) -> cents entiers.
export function enCents(usd, nom) {
  const c = Math.round(usd * 100);
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0 || Math.abs(usd * 100 - c) > 1e-6) {
    throw new ErreurMetier(400, `${nom} doit être un montant en dollars > 0 avec au plus 2 décimales`);
  }
  return c;
}

// `creancier` : le prêteur ciblé (id, role). `conditions` : ses conditions au moment de la demande.
export function creerDemande({ pharmacie, creancier, conditions, corps, now = Date.now(), id }) {
  exigerChampsConnus(corps, CHAMPS_CREATION, 'la demande');
  if (!Array.isArray(corps.lignes) || corps.lignes.length === 0) throw new ErreurMetier(400, 'lignes requises');
  const lignes = corps.lignes.map((l) => {
    exigerChampsConnus(l, CHAMPS_LIGNE, 'une ligne');
    if (!l.produit || typeof l.produit !== 'string') throw new ErreurMetier(400, 'produit requis');
    if (!Number.isInteger(l.quantite) || l.quantite <= 0) throw new ErreurMetier(400, 'quantite entière > 0 requise');
    return { produit: l.produit.trim(), quantite: l.quantite };
  });
  return {
    id,
    pharmacieId: pharmacie.id,
    creancierId: creancier.id,
    creancierType: creancier.role,
    lignes,
    note: typeof corps.note === 'string' ? corps.note.slice(0, 500) : '',
    etat: ETATS.SOUMISE,
    valeurCents: null,        // fixée par le prêteur à la validation
    delaiAccordeJours: null,
    graceJours: null,         // figée à la validation, selon les conditions du prêteur à ce moment
    echeanceLe: null,
    receptionLe: null,
    clotureLe: null,
    remboursements: [],       // constatés par le prêteur : { le, montantCents }
    motifRefus: null,
    creeLe: now,
    expireLe: now + conditions.expirationHeures * 3600 * 1000,
    historique: [{ le: now, par: `pharmacie:${pharmacie.id}`, action: 'soumettre', etat: ETATS.SOUMISE }],
  };
}

export function expirerSiBesoin(demande, now = Date.now()) {
  if (demande.etat === ETATS.SOUMISE && now > demande.expireLe) {
    demande.etat = ETATS.EXPIREE;
    demande.historique.push({ le: now, par: 'systeme', action: 'expirer', etat: ETATS.EXPIREE });
  }
  return demande;
}

// `contexte.conditions` : les conditions du prêteur, appliquées à la validation.
// `contexte.demandesRelation` : les demandes entre CETTE pharmacie et CE prêteur uniquement.
export function appliquerAction({ demande, action, acteur, corps = {}, now = Date.now(), contexte = {} }) {
  expirerSiBesoin(demande, now);
  const def = ACTIONS[action];
  if (!def) throw new ErreurMetier(404, `Action inconnue : ${action}`);

  const estProprietaire =
    (estCreancier(acteur.role) && demande.creancierId === acteur.id) ||
    (acteur.role === 'pharmacie' && demande.pharmacieId === acteur.id);
  if (!estProprietaire) throw new ErreurMetier(403, 'Cette demande ne vous concerne pas');
  const roleOk = def.role === 'any' || (def.role === 'creancier' ? estCreancier(acteur.role) : def.role === acteur.role);
  if (!roleOk) throw new ErreurMetier(403, `Action réservée au rôle ${def.role}`);
  if (!def.de.includes(demande.etat)) {
    throw new ErreurMetier(409, `Impossible de ${action} une demande à l'état ${demande.etat}`);
  }

  let vers = def.vers;

  if (action === 'valider') {
    exigerChampsConnus(corps, ['valeurUSD', 'delaiAccordeJours'], 'la validation');
    const cond = contexte.conditions;
    if (!cond) throw new Error('contexte.conditions requis pour valider');
    const valeurCents = enCents(corps.valeurUSD, 'valeurUSD');
    const delai = corps.delaiAccordeJours ?? cond.delaiDefautJours;
    if (!Number.isInteger(delai) || delai < 1 || delai > cond.delaiMaxJours) {
      throw new ErreurMetier(400, `delaiAccordeJours doit être un entier entre 1 et ${cond.delaiMaxJours}`);
    }
    const score = scoringRelation(contexte.demandesRelation ?? [], cond, now);
    if (score.bloque) throw new ErreurMetier(409, 'La pharmacie a un remboursement en retard chez ce prêteur');
    if (valeurCents > score.disponibleCents) {
      throw new ErreurMetier(409, `Plafond dépassé : disponible ${(score.disponibleCents / 100).toFixed(2)} USD`);
    }
    demande.valeurCents = valeurCents;
    demande.delaiAccordeJours = delai;
    demande.graceJours = cond.graceJours;
  } else if (action === 'refuser') {
    exigerChampsConnus(corps, ['motif'], 'le refus');
    if (!corps.motif || typeof corps.motif !== 'string') throw new ErreurMetier(400, 'motif requis');
    demande.motifRefus = corps.motif.slice(0, 500);
  } else if (action === 'receptionner') {
    exigerChampsConnus(corps, [], "l'action");
    demande.receptionLe = now;
    demande.echeanceLe = now + demande.delaiAccordeJours * JOUR_MS;
  } else if (action === 'rembourser') {
    exigerChampsConnus(corps, ['montantUSD'], 'le remboursement');
    const montantCents = enCents(corps.montantUSD, 'montantUSD');
    if (montantCents > solde(demande)) throw new ErreurMetier(409, 'Le montant dépasse le solde restant');
    demande.remboursements.push({ le: now, montantCents });
    if (solde(demande) === 0) { vers = ETATS.CLOTUREE; demande.clotureLe = now; } else { vers = demande.etat; }
  } else {
    exigerChampsConnus(corps, [], "l'action");
  }

  demande.etat = vers;
  demande.historique.push({ le: now, par: `${acteur.role}:${acteur.id}`, action, etat: vers });
  return demande;
}

// Vue destinée à l'API : ajoute le solde et l'état de retard calculés.
export function vueDemande(d, now = Date.now()) {
  const enRetardMaintenant = d.etat === ETATS.RECEPTIONNEE && d.echeanceLe != null
    && now > d.echeanceLe + (d.graceJours ?? 0) * JOUR_MS;
  return { ...d, soldeCents: solde(d), enRetard: enRetardMaintenant };
}
