import test from 'node:test';
import assert from 'node:assert/strict';
import { ETATS, ErreurMetier, appliquerAction, creerDemande } from '../src/contextes/credit/workflow.js';
import { DEFAUTS, validerConditions } from '../src/contextes/conditions/index.js';
import { JOUR_MS, scoringRelation } from '../src/contextes/scoring/index.js';

const pharma = { id: 'p1', role: 'pharmacie' };
const depot = { id: 'd1', role: 'depot', conditions: validerConditions(structuredClone(DEFAUTS)) };
const autreDepot = { id: 'd2', role: 'depot', conditions: depot.conditions };
const imf = {
  id: 'i1', role: 'imf',
  conditions: validerConditions({ ...structuredClone(DEFAUTS), paliersUSD: [50, 100, 200], seriesRequises: 1, graceJours: 0, delaiMaxJours: 60 }),
};
const corps = { creancierId: 'd1', lignes: [{ produit: 'Amoxicilline 500mg', quantite: 20 }] };
const refus = (fn, code) => assert.throws(fn, (e) => e instanceof ErreurMetier && e.code === code);

const T0 = 1_700_000_000_000;
let seq = 0;
const nouvelle = (now = T0, creancier = depot) => creerDemande({ pharmacie: pharma, creancier, conditions: creancier.conditions, corps, id: `x${seq++}`, now });

// Fait vivre une demande jusqu'à la réception chez un prêteur donné.
function jusquaReception(toutes, { valeur, delai = 30, t, creancier = depot }) {
  const d = nouvelle(t, creancier);
  toutes.push(d);
  const ctx = { demandesRelation: toutes, conditions: creancier.conditions };
  appliquerAction({ demande: d, action: 'valider', acteur: creancier, corps: { valeurUSD: valeur, delaiAccordeJours: delai }, now: t, contexte: ctx });
  appliquerAction({ demande: d, action: 'livrer', acteur: creancier, now: t });
  appliquerAction({ demande: d, action: 'receptionner', acteur: pharma, now: t });
  return d;
}
const rembourser = (d, montantUSD, now, creancier = depot) =>
  appliquerAction({ demande: d, action: 'rembourser', acteur: creancier, corps: { montantUSD }, now });
const valider = (d, valeurUSD, toutes, now = T0, creancier = depot) =>
  appliquerAction({ demande: d, action: 'valider', acteur: creancier, corps: { valeurUSD }, now, contexte: { demandesRelation: toutes, conditions: creancier.conditions } });

test('premier crédit : 20 $ puis remboursement complet', () => {
  const d = jusquaReception([], { valeur: 20, t: T0 });
  assert.equal(d.etat, ETATS.RECEPTIONNEE);
  assert.equal(d.echeanceLe, T0 + 30 * JOUR_MS);
  rembourser(d, 20, T0 + 10 * JOUR_MS);
  assert.equal(d.etat, ETATS.CLOTUREE);
});

test('au-delà du plafond de départ : refusé', () => {
  refus(() => valider(nouvelle(), 20.01, []), 409);
});

test("l'encours compte dans le plafond", () => {
  const toutes = [];
  jusquaReception(toutes, { valeur: 15, t: T0 });
  const d2 = nouvelle(T0);
  toutes.push(d2);
  refus(() => valider(d2, 6, toutes), 409);
  valider(d2, 5, toutes);
});

test('le remboursement partiel suit le solde, un trop-perçu est refusé', () => {
  const d = jusquaReception([], { valeur: 20, t: T0 });
  rembourser(d, 12.5, T0 + JOUR_MS);
  assert.equal(d.etat, ETATS.RECEPTIONNEE);
  refus(() => rembourser(d, 8, T0 + 2 * JOUR_MS), 409);
  rembourser(d, 7.5, T0 + 3 * JOUR_MS);
  assert.equal(d.etat, ETATS.CLOTUREE);
});

test('deux remboursements à temps font monter le plafond', () => {
  const toutes = [];
  let t = T0;
  for (let i = 0; i < 2; i++) {
    const d = jusquaReception(toutes, { valeur: 20, t });
    rembourser(d, 20, t + 20 * JOUR_MS);
    t += 25 * JOUR_MS;
  }
  const score = scoringRelation(toutes, depot.conditions, t);
  assert.equal(score.palier, 1);
  assert.equal(score.plafondCents, 4000);
  assert.equal(jusquaReception(toutes, { valeur: 40, t }).valeurCents, 4000);
});

test('un remboursement en retard fait redescendre le palier', () => {
  const toutes = [];
  let t = T0;
  for (let i = 0; i < 2; i++) {
    const d = jusquaReception(toutes, { valeur: 20, t });
    rembourser(d, 20, t + 20 * JOUR_MS);
    t += 25 * JOUR_MS;
  }
  const tard = jusquaReception(toutes, { valeur: 40, t });
  rembourser(tard, 40, t + 40 * JOUR_MS); // échéance à 30 j + 3 j de grâce
  assert.equal(scoringRelation(toutes, depot.conditions, t + 40 * JOUR_MS).palier, 0);
});

test('un retard bloque toute nouvelle validation jusqu’au remboursement', () => {
  const toutes = [];
  const d = jusquaReception(toutes, { valeur: 10, t: T0 });
  const apres = T0 + 34 * JOUR_MS;
  assert.equal(scoringRelation(toutes, depot.conditions, apres).bloque, true);
  const d2 = nouvelle(apres);
  toutes.push(d2);
  refus(() => valider(d2, 5, toutes, apres), 409);
  rembourser(d, 10, apres);
  valider(d2, 5, toutes, apres);
});

test('chaque prêteur applique ses propres conditions', () => {
  // IMF : plafond de départ 50 $, un seul remboursement suffit pour monter, pas de grâce, délai max 60 j.
  const toutes = [];
  const d = nouvelle(T0, imf);
  toutes.push(d);
  refus(() => valider(d, 50.01, toutes, T0, imf), 409);
  refus(() => appliquerAction({ demande: d, action: 'valider', acteur: imf, corps: { valeurUSD: 10, delaiAccordeJours: 61 }, now: T0, contexte: { demandesRelation: toutes, conditions: imf.conditions } }), 400);
  valider(d, 50, toutes, T0, imf);
  assert.equal(d.graceJours, 0);
  appliquerAction({ demande: d, action: 'livrer', acteur: imf, now: T0 });
  appliquerAction({ demande: d, action: 'receptionner', acteur: pharma, now: T0 });
  rembourser(d, 50, T0 + 5 * JOUR_MS, imf);
  assert.equal(scoringRelation(toutes, imf.conditions, T0 + 6 * JOUR_MS).plafondCents, 10000);
  // Même historique, conditions du dépôt : une seule série ne suffit pas.
  assert.equal(scoringRelation(toutes, depot.conditions, T0 + 6 * JOUR_MS).plafondCents, 2000);
});

test('le suivi est séparé par prêteur', () => {
  const chezDepot = [];
  const chezImf = [];
  jusquaReception(chezDepot, { valeur: 20, t: T0 });          // dépôt : plafond atteint
  assert.equal(scoringRelation(chezDepot, depot.conditions, T0).disponibleCents, 0);
  assert.equal(scoringRelation(chezImf, imf.conditions, T0).disponibleCents, 5000); // IMF : intact
});

test('modifier ses conditions ne change pas un crédit déjà accordé', () => {
  const cond = validerConditions({ ...structuredClone(DEFAUTS), graceJours: 5 });
  const preteur = { id: 'd9', role: 'depot', conditions: cond };
  const d = nouvelle(T0, preteur);
  valider(d, 10, [], T0, preteur);
  preteur.conditions = validerConditions({ ...structuredClone(DEFAUTS), graceJours: 0 });
  assert.equal(d.graceJours, 5);
});

test('conditions invalides refusées', () => {
  const base = () => structuredClone(DEFAUTS);
  refus(() => validerConditions({ ...base(), paliersUSD: [50, 50] }), 400);
  refus(() => validerConditions({ ...base(), paliersUSD: [] }), 400);
  refus(() => validerConditions({ ...base(), delaiMaxJours: 10, delaiDefautJours: 30 }), 400);
  refus(() => validerConditions({ ...base(), retardGraveJours: 1, graceJours: 3 }), 400);
  refus(() => validerConditions({ ...base(), iban: 'x' }), 400);
  const incomplet = base(); delete incomplet.graceJours;
  refus(() => validerConditions(incomplet), 400);
});

test('seul le prêteur concerné peut valider', () => {
  refus(() => valider(nouvelle(), 5, [], T0, autreDepot), 403);
  refus(() => valider(nouvelle(), 5, [], T0, pharma), 403);
});

test('le refus exige un motif', () => {
  const now = Date.now();
  refus(() => appliquerAction({ demande: nouvelle(now), action: 'refuser', acteur: depot, corps: {} }), 400);
  const d = nouvelle(now);
  appliquerAction({ demande: d, action: 'refuser', acteur: depot, corps: { motif: 'Stock épuisé' } });
  assert.equal(d.etat, ETATS.REFUSEE);
});

test('transitions invalides refusées', () => {
  const now = Date.now();
  const d = nouvelle(now);
  refus(() => appliquerAction({ demande: d, action: 'livrer', acteur: depot }), 409);
  refus(() => appliquerAction({ demande: d, action: 'rembourser', acteur: depot, corps: { montantUSD: 1 } }), 409);
  appliquerAction({ demande: d, action: 'refuser', acteur: depot, corps: { motif: 'x' } });
  refus(() => valider(d, 5, [], now), 409);
});

test("une demande expire selon le délai propre au prêteur", () => {
  const court = { id: 'd5', role: 'depot', conditions: validerConditions({ ...structuredClone(DEFAUTS), expirationHeures: 1 }) };
  const d = nouvelle(T0, court);
  refus(() => valider(d, 5, [], T0 + 3600 * 1000 + 1, court), 409);
  assert.equal(d.etat, ETATS.EXPIREE);
  const normal = nouvelle(T0, depot);
  valider(normal, 5, [], T0 + 3600 * 1000 + 1); // 72 h chez ce prêteur : encore valable
});

test('la pharmacie ne peut fixer aucun montant ; aucun champ de paiement accepté', () => {
  for (const champ of ['valeurUSD', 'montant', 'prix', 'iban', 'paiement', 'compte', 'mobileMoney']) {
    refus(() => creerDemande({ pharmacie: pharma, creancier: depot, conditions: depot.conditions, corps: { ...corps, [champ]: 1 }, id: 'x' }), 400);
    refus(() => creerDemande({ pharmacie: pharma, creancier: depot, conditions: depot.conditions, corps: { ...corps, lignes: [{ produit: 'a', quantite: 1, [champ]: 1 }] }, id: 'x' }), 400);
  }
  for (const champ of ['iban', 'paiement', 'compte', 'mobileMoney']) {
    refus(() => appliquerAction({ demande: nouvelle(), action: 'valider', acteur: depot, corps: { valeurUSD: 5, [champ]: 1 }, now: T0 }), 400);
  }
});

test('montants invalides refusés', () => {
  for (const v of [0, -5, 1.234, NaN, '10']) refus(() => valider(nouvelle(), v, []), 400);
  refus(() => creerDemande({ pharmacie: pharma, creancier: depot, conditions: depot.conditions, corps: { ...corps, lignes: [{ produit: 'a', quantite: 0 }] }, id: 'x' }), 400);
});
