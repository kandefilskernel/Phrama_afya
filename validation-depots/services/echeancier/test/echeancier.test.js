import test from 'node:test';
import assert from 'node:assert/strict';
import { ouvrirStockage } from '../../../libs/stockage.js';
import { JOUR_MS, creerEcheancier, etapeDe } from '../src/application/echeancier.js';

const T0 = 1_700_000_000_000;
const recue = { seq: 1, id: 'e1', type: 'MarchandiseRecue', demandeId: 'x', pharmacieId: 'p1', creancierId: 'd1', donnees: { echeanceLe: T0 + 30 * JOUR_MS, graceJours: 3, valeurCents: 2000 } };

function monter() {
  let t = T0;
  const demandes = [];
  let panne = false;
  const ech = creerEcheancier({
    stockage: ouvrirStockage(),
    horloge: () => t,
    notifier: async (m) => { if (panne) throw new Error('notifications injoignable'); demandes.push(m); },
  });
  return { ech, demandes, aller: (jours) => { t = T0 + jours * JOUR_MS; }, panne: (v) => { panne = v; } };
}

test('étapes : rien, rappel, échéance, retard', () => {
  const e = { echeanceLe: T0 + 30 * JOUR_MS, graceJours: 3 };
  assert.equal(etapeDe(e, T0 + 26 * JOUR_MS), null);
  assert.equal(etapeDe(e, T0 + 27 * JOUR_MS), 'rappel');
  assert.equal(etapeDe(e, T0 + 30 * JOUR_MS), 'echeance');
  assert.equal(etapeDe(e, T0 + 33 * JOUR_MS), 'echeance');
  assert.equal(etapeDe(e, T0 + 33 * JOUR_MS + 1), 'retard');
});

test('un crédit en cours reçoit chaque rappel une seule fois, le retard prévient aussi le prêteur', async () => {
  const { ech, demandes, aller } = monter();
  ech.appliquer(recue);
  ech.appliquer(recue);                                           // relu : sans effet
  aller(10); await ech.verifier(); assert.equal(demandes.length, 0);
  aller(27); await ech.verifier(); await ech.verifier();
  assert.deepEqual(demandes.map((m) => m.modele), ['rappelEcheance']);
  ech.appliquer({ ...recue, seq: 2, type: 'RemboursementConstate', donnees: { montantCents: 500, soldeCents: 1500 } });
  aller(30); await ech.verifier();
  assert.equal(demandes.at(-1).donnees.soldeCents, 1500);        // le rappel tient compte du remboursement
  aller(34); await ech.verifier();
  assert.deepEqual(demandes.slice(2).map((m) => [m.modele, m.destinataireId]), [['retardPharmacie', 'p1'], ['retardPreteur', 'd1']]);
});

test('un crédit soldé ne reçoit plus de rappel', async () => {
  const { ech, demandes, aller } = monter();
  ech.appliquer(recue);
  ech.appliquer({ ...recue, seq: 2, type: 'DemandeCloturee', donnees: {} });
  aller(40); await ech.verifier();
  assert.equal(demandes.length, 0);
});

test('service arrêté pendant le rappel : au retour, seul le retard part', async () => {
  const { ech, demandes, aller } = monter();
  ech.appliquer(recue);
  aller(40); await ech.verifier();
  assert.deepEqual(demandes.map((m) => m.modele), ['retardPharmacie', 'retardPreteur']);
});

test('Notifications en panne : l’étape est retentée au passage suivant', async () => {
  const { ech, demandes, aller, panne } = monter();
  ech.appliquer(recue);
  aller(27);
  panne(true);
  await assert.rejects(ech.verifier());
  panne(false);
  await ech.verifier();
  assert.equal(demandes.length, 1);
});
