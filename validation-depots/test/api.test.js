import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerApp } from '../src/app.js';
import { DEFAUTS } from '../src/contextes/conditions/index.js';

async function demarrer(options) {
  const app = creerApp(options);
  await new Promise((ok) => app.serveur.listen(0, ok));
  const base = `http://localhost:${app.serveur.address().port}`;
  const appel = async (acteur, methode, chemin, body, entetes = {}) => {
    const r = await fetch(base + chemin, {
      method: methode,
      headers: { authorization: acteur ? `Bearer ${acteur.token}` : '', 'content-type': 'application/json', ...entetes },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { code: r.status, json: await r.json() };
  };
  return { app, appel, arreter: () => app.serveur.close() };
}

test('API de bout en bout : conditions propres, suivi séparé, isolation', async () => {
  const { app, appel, arreter } = await demarrer();
  const p = app.identite.inscrire('pharmacie', 'Pharmacie Gombe');
  const dep = app.identite.inscrire('depot', 'Dépôt A');
  const im = app.identite.inscrire('imf', 'IMF B');
  const bq = app.identite.inscrire('banque', 'Banque C');
  try {
    assert.equal((await appel(null, 'GET', '/demandes')).code, 401);

    const cond = { ...DEFAUTS, paliersUSD: [30, 60], seriesRequises: 1 };
    assert.equal((await appel(im, 'PUT', '/conditions', cond)).code, 200);
    assert.equal((await appel(im, 'PUT', '/conditions', { ...cond, paliersUSD: [60, 30] })).code, 400);
    assert.equal((await appel(p, 'PUT', '/conditions', cond)).code, 403);
    const annuaire = await appel(p, 'GET', '/creanciers');
    assert.equal(annuaire.json.length, 3);
    assert.deepEqual(annuaire.json.find((c) => c.id === im.id).conditions.paliersUSD, [30, 60]);
    assert.equal(JSON.stringify(annuaire.json).includes(dep.token), false);

    const c1 = await appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'Paracétamol', quantite: 100 }] });
    const c2 = await appel(p, 'POST', '/demandes', { creancierId: im.id, lignes: [{ produit: 'Paracétamol', quantite: 100 }] });
    assert.equal(c1.code, 201);
    assert.equal(c2.code, 201);
    assert.equal((await appel(p, 'POST', '/demandes', { creancierId: p.id, lignes: [{ produit: 'a', quantite: 1 }] })).code, 400);

    const id1 = c1.json.id;
    const id2 = c2.json.id;
    assert.equal((await appel(im, 'GET', `/demandes/${id1}`)).code, 404);
    assert.equal((await appel(im, 'POST', `/demandes/${id1}/valider`, { valeurUSD: 5 })).code, 403);
    assert.equal((await appel(p, 'POST', `/demandes/${id1}/valider`, { valeurUSD: 5 })).code, 403);

    assert.equal((await appel(dep, 'POST', `/demandes/${id1}/valider`, { valeurUSD: 25 })).code, 409);
    assert.equal((await appel(dep, 'POST', `/demandes/${id1}/valider`, { valeurUSD: 18 })).json.etat, 'VALIDEE');
    assert.equal((await appel(im, 'POST', `/demandes/${id2}/valider`, { valeurUSD: 30 })).json.etat, 'VALIDEE');

    for (const [pre, id] of [[dep, id1], [im, id2]]) {
      assert.equal((await appel(pre, 'POST', `/demandes/${id}/livrer`)).json.etat, 'LIVREE');
      assert.equal((await appel(p, 'POST', `/demandes/${id}/receptionner`)).json.etat, 'RECEPTIONNEE');
    }

    const chezDepot = await appel(dep, 'GET', `/pharmacies/${p.id}/credit`);
    assert.equal(chezDepot.json.plafondCents, 2000);
    assert.equal(chezDepot.json.encoursCents, 1800);
    assert.equal((await appel(bq, 'GET', `/pharmacies/${p.id}/credit`)).code, 404);
    const vuePharma = await appel(p, 'GET', `/pharmacies/${p.id}/credit`);
    assert.equal(vuePharma.json.length, 2);
    assert.equal(vuePharma.json.find((x) => x.creancierId === im.id).encoursCents, 3000);

    const r1 = await appel(dep, 'POST', `/demandes/${id1}/rembourser`, { montantUSD: 8 }, { 'idempotency-key': 'k1' });
    assert.equal(r1.json.soldeCents, 1000);
    const r2 = await appel(dep, 'POST', `/demandes/${id1}/rembourser`, { montantUSD: 10 }, { 'idempotency-key': 'k2' });
    assert.equal(r2.json.etat, 'CLOTUREE');
    assert.equal((await appel(p, 'GET', '/moi')).json.token, undefined);
  } finally {
    arreter();
  }
});

test('un remboursement renvoyé avec la même clé n’est enregistré qu’une fois', async () => {
  const { app, appel, arreter } = await demarrer();
  const p = app.identite.inscrire('pharmacie', 'P');
  const dep = app.identite.inscrire('depot', 'D');
  try {
    const { json: d } = await appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'a', quantite: 1 }] });
    await appel(dep, 'POST', `/demandes/${d.id}/valider`, { valeurUSD: 20 });
    await appel(dep, 'POST', `/demandes/${d.id}/livrer`);
    await appel(p, 'POST', `/demandes/${d.id}/receptionner`);

    const chemin = `/demandes/${d.id}/rembourser`;
    assert.equal((await appel(dep, 'POST', chemin, { montantUSD: 5 })).code, 400);                // clé obligatoire
    const a = await appel(dep, 'POST', chemin, { montantUSD: 5 }, { 'idempotency-key': 'abc' });
    const b = await appel(dep, 'POST', chemin, { montantUSD: 5 }, { 'idempotency-key': 'abc' });  // renvoi
    assert.equal(a.code, 200);
    assert.deepEqual(b.json, a.json);
    assert.equal(b.json.remboursements.length, 1);
    assert.equal(b.json.soldeCents, 1500);
    // même clé, autre contenu : refusé
    assert.equal((await appel(dep, 'POST', chemin, { montantUSD: 6 }, { 'idempotency-key': 'abc' })).code, 409);
    assert.equal((await appel(dep, 'GET', `/demandes/${d.id}`)).json.soldeCents, 1500);
  } finally {
    arreter();
  }
});

test('les événements partent par l’outbox, dans l’ordre, sans perte si un consommateur échoue', async () => {
  const { app, appel, arreter } = await demarrer();
  const p = app.identite.inscrire('pharmacie', 'P');
  const dep = app.identite.inscrire('depot', 'D');
  const recus = [];
  let panne = true;
  app.bus.abonner('*', (e) => {
    if (panne && e.type === 'DemandeValidee') throw new Error('consommateur en panne');
    recus.push(e.type);
  });
  try {
    const { json: d } = await appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'a', quantite: 1 }] });
    // L'opération réussit même si le consommateur est en panne.
    assert.equal((await appel(dep, 'POST', `/demandes/${d.id}/valider`, { valeurUSD: 10 })).code, 200);
    assert.equal((await appel(dep, 'POST', `/demandes/${d.id}/livrer`)).code, 200);

    await app.relayer();
    assert.deepEqual(recus, ['DemandeSoumise']);          // bloqué sur DemandeValidee, l'ordre est préservé
    assert.equal(app.credit.enAttente(), 2);

    panne = false;
    await app.relayer();
    assert.deepEqual(recus, ['DemandeSoumise', 'DemandeValidee', 'MarchandiseLivree']);
    assert.equal(app.credit.enAttente(), 0);
    await app.relayer();
    assert.equal(recus.length, 3);                        // rien n'est republié
  } finally {
    arreter();
  }
});

test('les données survivent à un redémarrage, une base par module', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'plateforme-'));
  try {
    const a = await demarrer({ dossier });
    const p = a.app.identite.inscrire('pharmacie', 'P');
    const dep = a.app.identite.inscrire('depot', 'D');
    const { json: d } = await a.appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'a', quantite: 1 }] });
    a.arreter();

    const b = await demarrer({ dossier });
    try {
      assert.equal((await b.appel(p, 'GET', `/demandes/${d.id}`)).json.etat, 'SOUMISE');
      assert.equal(b.app.credit.enAttente(), 1);          // l'événement non publié n'est pas perdu
    } finally {
      b.arreter();
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test('les demandes portent le nom de la pharmacie et du prêteur, pour l’affichage', async () => {
  const { app, appel, arreter } = await demarrer();
  const p = app.identite.inscrire('pharmacie', 'Pharmacie Gombe');
  const dep = app.identite.inscrire('depot', 'Dépôt Central');
  try {
    const c = await appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'a', quantite: 1 }] });
    assert.equal(c.json.pharmacieNom, 'Pharmacie Gombe');
    assert.equal(c.json.creancierNom, 'Dépôt Central');
    const liste = await appel(dep, 'GET', '/demandes');
    assert.deepEqual([liste.json[0].pharmacieNom, liste.json[0].creancierNom], ['Pharmacie Gombe', 'Dépôt Central']);
    const detail = await appel(dep, 'POST', `/demandes/${c.json.id}/valider`, { valeurUSD: 10 });
    assert.equal(detail.json.pharmacieNom, 'Pharmacie Gombe');
  } finally {
    arreter();
  }
});
