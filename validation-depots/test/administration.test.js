import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerApp } from '../src/app.js';

const AMORCAGE = 'jeton-amorcage-de-test';
const dernierCode = (app, id) => app.identite.evenementsApres(0, 10_000)
  .filter((e) => e.type === 'CodeVerificationEmis' && e.acteurId === id).at(-1)?.donnees.code;

async function demarrer(options = {}) {
  const app = creerApp({ jetonAmorcage: AMORCAGE, limiteInscriptions: { max: 100, fenetreMs: 3600_000 }, ...options });
  await new Promise((ok) => app.serveur.listen(0, ok));
  const base = `http://localhost:${app.serveur.address().port}`;
  const appel = async (methode, chemin, { jeton, admin, amorcage, body } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (jeton) headers.authorization = `Bearer ${jeton}`;
    if (admin) headers['x-jeton-admin'] = admin;
    if (amorcage) headers['x-jeton-amorcage'] = amorcage;
    const r = await fetch(base + chemin, { method: methode, headers, body: body ? JSON.stringify(body) : undefined });
    return { code: r.status, json: await r.json() };
  };
  const amorcer = (body = { nom: 'Mireille Superviseure', telephone: '+243899000001' }, amorcage = AMORCAGE) =>
    appel('POST', '/admin/amorcage', { amorcage, body });
  const admin = (jeton, methode, chemin, body) => appel(methode, `/admin${chemin}`, { admin: jeton, body });
  // Acteur inscrit et téléphone vérifié, prêt à être approuvé.
  const acteurVerifie = async (role, nom, telephone, numeroAgrement) => {
    const a = (await appel('POST', '/inscriptions', { body: { role, nom, telephone, numeroAgrement } })).json;
    await appel('POST', '/moi/telephone/verifier', { jeton: a.token, body: { code: dernierCode(app, a.id) } });
    return a;
  };
  return { app, appel, amorcer, admin, acteurVerifie, arreter: () => app.serveur.close() };
}

test('amorçage : une seule fois, avec le bon secret, et toujours un superviseur', async () => {
  const s = await demarrer();
  try {
    assert.equal((await s.amorcer(undefined, 'mauvais')).code, 404);
    assert.equal((await s.amorcer({ nom: 'Mireille', telephone: '+243899000001', role: 'agent' })).code, 400);
    const sup = await s.amorcer();
    assert.equal(sup.code, 201);
    assert.equal(sup.json.role, 'superviseur');
    assert.ok(sup.json.token);
    assert.equal((await s.amorcer({ nom: 'Autre', telephone: '+243899000002' })).code, 409);
    assert.equal((await s.admin(sup.json.token, 'GET', '/moi')).json.nom, 'Mireille Superviseure');
  } finally {
    s.arreter();
  }
  const sansSecret = await demarrer({ jetonAmorcage: null });
  try {
    assert.equal((await sansSecret.amorcer()).code, 404);
  } finally {
    sansSecret.arreter();
  }
});

test('un agent vérifie les comptes, mais ne gère ni l’équipe, ni le journal, ni les jetons des acteurs', async () => {
  const s = await demarrer();
  try {
    const sup = (await s.amorcer()).json.token;
    const creation = await s.admin(sup, 'POST', '/administrateurs', { nom: 'Jean Agent', telephone: '+243899000010', role: 'agent' });
    assert.equal(creation.code, 201);
    const agent = creation.json.token;

    const p = await s.acteurVerifie('pharmacie', 'Pharmacie Kintambo', '+243810000031', 'PH-31');
    assert.equal((await s.admin(agent, 'GET', '/acteurs?statut=EN_ATTENTE')).json.length, 1);
    assert.equal((await s.admin(agent, 'POST', `/acteurs/${p.id}/approuver`)).json.statut, 'ACTIF');
    assert.equal((await s.admin(agent, 'POST', `/acteurs/${p.id}/suspendre`, { motif: 'Contrôle' })).json.statut, 'SUSPENDU');

    assert.equal((await s.admin(agent, 'POST', '/administrateurs', { nom: 'Pirate', telephone: '+243899000011', role: 'superviseur' })).code, 403);
    assert.equal((await s.admin(agent, 'GET', '/administrateurs')).code, 403);
    assert.equal((await s.admin(agent, 'GET', '/journal')).code, 403);
    assert.equal((await s.admin(agent, 'POST', `/acteurs/${p.id}/jeton`)).code, 403);
    assert.equal((await s.admin(sup, 'POST', `/acteurs/${p.id}/jeton`)).code, 200);
    assert.equal((await s.admin(sup, 'POST', '/administrateurs', { nom: 'Sans rôle', telephone: '+243899000012' })).code, 400);
  } finally {
    s.arreter();
  }
});

test('chaque décision garde son auteur ; le journal se filtre par administrateur et par compte', async () => {
  let t = 1_700_000_000_000;
  const s = await demarrer({ horloge: () => (t += 1000) }); // instants distincts : l'ordre du journal est déterministe
  try {
    const sup = (await s.amorcer()).json;
    const agent = (await s.admin(sup.token, 'POST', '/administrateurs', { nom: 'Jean Agent', telephone: '+243899000010', role: 'agent' })).json;
    const p = await s.acteurVerifie('pharmacie', 'Pharmacie Kintambo', '+243810000031', 'PH-31');
    const d = await s.acteurVerifie('depot', 'Dépôt Matonge', '+243810000032', 'DEP-32');

    await s.admin(agent.token, 'POST', `/acteurs/${p.id}/approuver`);
    await s.admin(agent.token, 'POST', `/acteurs/${d.id}/rejeter`, { motif: 'Agrément introuvable' });
    await s.admin(sup.token, 'POST', `/acteurs/${p.id}/suspendre`, { motif: 'Plainte à instruire' });
    await s.admin(sup.token, 'POST', `/acteurs/${p.id}/reactiver`);

    const journal = (await s.admin(sup.token, 'GET', '/journal')).json;
    const actions = journal.map((e) => `${e.par.nom}:${e.action}`);
    for (const attendu of ['Mireille Superviseure:amorcer', 'Mireille Superviseure:creer-admin', 'Jean Agent:approuver',
      'Jean Agent:rejeter', 'Mireille Superviseure:suspendre', 'Mireille Superviseure:reactiver']) {
      assert.ok(actions.includes(attendu), attendu);
    }
    assert.equal(journal.find((e) => e.action === 'rejeter').motif, 'Agrément introuvable');
    assert.equal(journal.find((e) => e.action === 'reactiver').motif, undefined); // le motif de suspension n'est pas recopié

    const parAgent = (await s.admin(sup.token, 'GET', `/journal?adminId=${agent.id}`)).json;
    assert.deepEqual(parAgent.map((e) => e.action).sort(), ['approuver', 'rejeter']);
    const surP = (await s.admin(sup.token, 'GET', `/journal?cibleId=${p.id}`)).json;
    assert.deepEqual(surP.map((e) => e.action), ['reactiver', 'suspendre', 'approuver']); // plus récentes d'abord

    const compte = (await s.admin(sup.token, 'GET', '/acteurs?role=pharmacie')).json[0];
    assert.equal(compte.motif, null);
    assert.equal(compte.historique.find((h) => h.action === 'approuver').par.nom, 'Jean Agent');
  } finally {
    s.arreter();
  }
});

test('désactivation : jeton aussitôt invalide, motif exigé, jamais soi-même', async () => {
  const s = await demarrer();
  try {
    const sup = (await s.amorcer()).json;
    const agent = (await s.admin(sup.token, 'POST', '/administrateurs', { nom: 'Jean Agent', telephone: '+243899000010', role: 'agent' })).json;
    assert.equal((await s.admin(sup.token, 'POST', `/administrateurs/${agent.id}/desactiver`)).code, 400);
    assert.equal((await s.admin(sup.token, 'POST', `/administrateurs/${sup.id}/desactiver`, { motif: 'Départ' })).code, 409);
    assert.equal((await s.admin(sup.token, 'POST', `/administrateurs/${agent.id}/desactiver`, { motif: 'Fin de contrat' })).json.actif, false);
    assert.equal((await s.admin(agent.token, 'GET', '/moi')).code, 404);
    // Son téléphone redevient disponible pour un nouveau compte.
    assert.equal((await s.admin(sup.token, 'POST', '/administrateurs', { nom: 'Jean Agent 2', telephone: '+243899000010', role: 'agent' })).code, 201);
  } finally {
    s.arreter();
  }
});

test('jetons d’administrateur : rotation par soi-même, réémission par un superviseur', async () => {
  const s = await demarrer();
  try {
    const sup = (await s.amorcer()).json;
    const agent = (await s.admin(sup.token, 'POST', '/administrateurs', { nom: 'Jean Agent', telephone: '+243899000010', role: 'agent' })).json;
    const rotation = (await s.admin(agent.token, 'POST', '/moi/jeton')).json.token;
    assert.equal((await s.admin(agent.token, 'GET', '/moi')).code, 404);
    assert.equal((await s.admin(rotation, 'GET', '/moi')).code, 200);
    assert.equal((await s.admin(rotation, 'POST', `/administrateurs/${sup.id}/jeton`)).code, 403); // un agent ne réémet pas
    const reemis = (await s.admin(sup.token, 'POST', `/administrateurs/${agent.id}/jeton`)).json.token;
    assert.equal((await s.admin(rotation, 'GET', '/moi')).code, 404);
    assert.equal((await s.admin(reemis, 'GET', '/moi')).code, 200);
  } finally {
    s.arreter();
  }
});

test('les jetons d’administrateur ne sont jamais stockés en clair', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'admin-'));
  try {
    const s = await demarrer({ dossier });
    try {
      const sup = (await s.amorcer()).json;
      const agent = (await s.admin(sup.token, 'POST', '/administrateurs', { nom: 'Jean Agent', telephone: '+243899000010', role: 'agent' })).json;
      const brut = readFileSync(join(dossier, 'administration.json'), 'utf8');
      assert.equal(brut.includes(sup.token), false);
      assert.equal(brut.includes(agent.token), false);
      assert.equal((await s.admin(sup.token, 'GET', '/administrateurs')).json.some((a) => a.jetonHash), false);
    } finally {
      s.arreter();
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
