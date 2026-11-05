import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerApp } from '../src/app.js';

const AMORCAGE = 'jeton-amorcage-de-test';

// Code reçu par SMS : lu dans le flux interne de l'identité, comme le fait le service Notifications.
const dernierCode = (app, id) => app.identite.evenementsApres(0, 10_000)
  .filter((e) => e.type === 'CodeVerificationEmis' && e.acteurId === id).at(-1)?.donnees.code;

async function demarrer(options = {}) {
  const app = creerApp({ jetonAmorcage: AMORCAGE, ...options });
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
  const inscrire = (body) => appel('POST', '/inscriptions', { body });
  // Premier superviseur, créé par amorçage quand le secret est configuré.
  const superviseur = app.administration && (options.jetonAmorcage === undefined || options.jetonAmorcage)
    ? (await appel('POST', '/admin/amorcage', { amorcage: options.jetonAmorcage ?? AMORCAGE, body: { nom: 'Superviseur Test', telephone: '+243899000001' } })).json
    : null;
  const admin = (methode, chemin, body, jetonAdmin = superviseur.token) => appel(methode, `/admin${chemin}`, { admin: jetonAdmin, body });
  const verifier = (a, code = dernierCode(app, a.id)) => appel('POST', '/moi/telephone/verifier', { jeton: a.token, body: { code } });
  return { app, appel, inscrire, admin, verifier, superviseur, arreter: () => app.serveur.close() };
}

const pharmacie = (extra = {}) => ({ role: 'pharmacie', nom: 'Pharmacie Gombe', telephone: '+243810000001', numeroAgrement: 'PH-2026-001', ...extra });
const depot = (extra = {}) => ({ role: 'depot', nom: 'Dépôt A', telephone: '+243810000002', numeroAgrement: 'DEP-001', ...extra });

test('inscription publique : en attente, le jeton ne sert qu’à consulter son statut', async () => {
  const s = await demarrer();
  try {
    const r = await s.inscrire(pharmacie({ adresse: 'Avenue du Commerce, Gombe' }));
    assert.equal(r.code, 201);
    assert.equal(r.json.statut, 'EN_ATTENTE');
    assert.ok(r.json.token);
    assert.equal(r.json.jetonHash, undefined);
    const moi = await s.appel('GET', '/moi', { jeton: r.json.token });
    assert.equal(moi.json.statut, 'EN_ATTENTE');
    const bloque = await s.appel('GET', '/demandes', { jeton: r.json.token });
    assert.equal(bloque.code, 403);
    assert.match(bloque.json.erreur, /attente/);
  } finally {
    s.arreter();
  }
});

test('inscription : champs contrôlés, rôle admin impossible, doublons refusés', async () => {
  const s = await demarrer({ limiteInscriptions: { max: 100, fenetreMs: 3600_000 } }); // la limite compte aussi les essais invalides
  try {
    assert.equal((await s.inscrire(pharmacie({ telephone: '0810000001' }))).code, 400);
    assert.equal((await s.inscrire(pharmacie({ role: 'admin' }))).code, 400);
    assert.equal((await s.inscrire(pharmacie({ statut: 'ACTIF' }))).code, 400);      // on ne choisit pas son statut
    assert.equal((await s.inscrire(pharmacie({ numeroAgrement: undefined }))).code, 400);
    assert.equal((await s.inscrire(pharmacie({ nom: 'X' }))).code, 400);
    assert.equal((await s.inscrire(pharmacie())).code, 201);
    assert.equal((await s.inscrire(pharmacie({ numeroAgrement: 'AUTRE' }))).code, 409); // même téléphone
    assert.equal((await s.inscrire(pharmacie({ telephone: '+243810000099' }))).code, 409); // même agrément
    assert.equal((await s.inscrire(depot({ numeroAgrement: 'PH-2026-001' }))).code, 201); // agrément identique mais autre rôle
  } finally {
    s.arreter();
  }
});

test('administration : invisible sans le bon jeton', async () => {
  const s = await demarrer();
  try {
    assert.equal((await s.appel('GET', '/admin/acteurs')).code, 404);
    assert.equal((await s.appel('GET', '/admin/acteurs', { admin: 'mauvais' })).code, 404);
    const p = await s.inscrire(pharmacie());
    assert.equal((await s.appel('GET', '/admin/acteurs', { jeton: p.json.token })).code, 404); // un acteur n'est pas admin
    assert.equal((await s.admin('GET', '/acteurs?statut=EN_ATTENTE')).json.length, 1);
  } finally {
    s.arreter();
  }
  const sansAmorcage = await demarrer({ jetonAmorcage: null });
  try {
    assert.equal((await sansAmorcage.appel('GET', '/admin/acteurs', { admin: '' })).code, 404);
    assert.equal((await sansAmorcage.appel('POST', '/admin/amorcage', { amorcage: AMORCAGE, body: { nom: 'X Y', telephone: '+243899000009' } })).code, 404);
  } finally {
    sansAmorcage.arreter();
  }
});

test('approbation : le prêteur apparaît dans l’annuaire et peut recevoir des demandes', async () => {
  const s = await demarrer();
  try {
    const p = (await s.inscrire(pharmacie())).json;
    const d = (await s.inscrire(depot())).json;
    await s.verifier(p);
    await s.admin('POST', `/acteurs/${p.id}/approuver`);
    assert.equal((await s.appel('GET', '/creanciers', { jeton: p.token })).json.length, 0);   // dépôt pas encore approuvé
    const demande = { creancierId: d.id, lignes: [{ produit: 'a', quantite: 1 }] };
    assert.equal((await s.appel('POST', '/demandes', { jeton: p.token, body: demande })).code, 400);

    const nonVerifie = await s.admin('POST', `/acteurs/${d.id}/approuver`);
    assert.equal(nonVerifie.code, 409);                                                      // téléphone non vérifié
    assert.match(nonVerifie.json.erreur, /Téléphone non vérifié/);
    await s.verifier(d);
    assert.equal((await s.admin('POST', `/acteurs/${d.id}/approuver`)).json.statut, 'ACTIF');
    assert.equal((await s.admin('POST', `/acteurs/${d.id}/approuver`)).code, 409);           // déjà actif
    assert.equal((await s.appel('GET', '/creanciers', { jeton: p.token })).json.length, 1);
    assert.equal((await s.appel('POST', '/demandes', { jeton: p.token, body: demande })).code, 201);
  } finally {
    s.arreter();
  }
});

test('rejet et suspension exigent un motif ; un compte suspendu est bloqué puis réactivé', async () => {
  const s = await demarrer();
  try {
    const p = (await s.inscrire(pharmacie())).json;
    const d = (await s.inscrire(depot())).json;
    assert.equal((await s.admin('POST', `/acteurs/${p.id}/rejeter`)).code, 400);
    const rejet = await s.admin('POST', `/acteurs/${p.id}/rejeter`, { motif: 'Agrément introuvable au registre' });
    assert.equal(rejet.json.statut, 'REJETE');
    assert.match((await s.appel('GET', '/demandes', { jeton: p.token })).json.erreur, /rejetée/);
    assert.equal((await s.inscrire(pharmacie())).code, 201);                                   // peut se réinscrire

    await s.verifier(d);
    await s.admin('POST', `/acteurs/${d.id}/approuver`);
    assert.equal((await s.admin('POST', `/acteurs/${d.id}/suspendre`, { motif: 'Agrément expiré' })).json.statut, 'SUSPENDU');
    assert.equal((await s.appel('GET', '/demandes', { jeton: d.token })).code, 403);
    assert.equal((await s.appel('GET', '/moi', { jeton: d.token })).json.statut, 'SUSPENDU');
    assert.equal(s.app.identite.creanciers().length, 0);
    await s.admin('POST', `/acteurs/${d.id}/reactiver`);
    assert.equal((await s.appel('GET', '/demandes', { jeton: d.token })).code, 200);
  } finally {
    s.arreter();
  }
});

test('un prêteur suspendu reste visible dans le suivi de crédit de la pharmacie', async () => {
  const s = await demarrer();
  try {
    const p = s.app.identite.inscrire('pharmacie', 'P');
    const d = s.app.identite.inscrire('depot', 'D');
    await s.appel('POST', '/demandes', { jeton: p.token, body: { creancierId: d.id, lignes: [{ produit: 'a', quantite: 1 }] } });
    await s.admin('POST', `/acteurs/${d.id}/suspendre`, { motif: 'Contrôle en cours' });
    const credit = await s.appel('GET', `/pharmacies/${p.id}/credit`, { jeton: p.token });
    assert.equal(credit.code, 200);
    assert.equal(credit.json[0].nom, 'D');
  } finally {
    s.arreter();
  }
});

test('jeton renouvelé : l’ancien cesse de fonctionner', async () => {
  const s = await demarrer();
  try {
    const p = s.app.identite.inscrire('pharmacie', 'P');
    const r = await s.appel('POST', '/moi/jeton', { jeton: p.token });
    assert.notEqual(r.json.token, p.token);
    assert.equal((await s.appel('GET', '/moi', { jeton: p.token })).code, 401);
    assert.equal((await s.appel('GET', '/moi', { jeton: r.json.token })).code, 200);
    // jeton perdu : l'administration en émet un nouveau
    const parAdmin = await s.admin('POST', `/acteurs/${p.id}/jeton`);
    assert.equal((await s.appel('GET', '/moi', { jeton: r.json.token })).code, 401);
    assert.equal((await s.appel('GET', '/moi', { jeton: parAdmin.json.token })).code, 200);
  } finally {
    s.arreter();
  }
});

test('trop d’inscriptions depuis la même adresse : refusées', async () => {
  const s = await demarrer({ limiteInscriptions: { max: 3, fenetreMs: 3600_000 } });
  try {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await s.inscrire(pharmacie({ telephone: `+24381000010${i}`, numeroAgrement: `PH-${i}` }))).code);
    assert.deepEqual(codes, [201, 201, 201, 429]);
  } finally {
    s.arreter();
  }
});

test('les jetons ne sont jamais stockés en clair, et les anciennes données sont migrées', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'identite-'));
  try {
    // Fichier au format précédent : jeton en clair, sans statut.
    writeFileSync(join(dossier, 'identite.json'), JSON.stringify({
      acteurs: [{ id: 'ancien', role: 'pharmacie', nom: 'Ancienne', telephone: null, token: 'jeton-historique-en-clair' }],
    }));
    const s = await demarrer({ dossier });
    try {
      assert.equal((await s.appel('GET', '/moi', { jeton: 'jeton-historique-en-clair' })).json.statut, 'ACTIF');
      const nouveau = (await s.inscrire(pharmacie())).json;
      const brut = readFileSync(join(dossier, 'identite.json'), 'utf8');
      assert.equal(brut.includes('jeton-historique-en-clair'), false);
      assert.equal(brut.includes(nouveau.token), false);
      assert.ok(brut.includes('jetonHash'));
    } finally {
      s.arreter();
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test('code SMS : un faux code est compté, le bon vérifie le téléphone', async () => {
  const s = await demarrer();
  try {
    const p = (await s.inscrire(pharmacie())).json;
    assert.equal(p.telephoneVerifie, false);
    const code = dernierCode(s.app, p.id);
    assert.match(code, /^\d{6}$/);
    const faux = code === '000000' ? '111111' : '000000';
    const r1 = await s.verifier(p, faux);
    assert.equal(r1.code, 400);
    assert.match(r1.json.erreur, /4 essai/);
    assert.equal((await s.verifier(p, '12')).code, 400);                    // format invalide, non compté
    const ok = await s.verifier(p, code);
    assert.equal(ok.json.telephoneVerifie, true);
    assert.equal((await s.verifier(p, code)).code, 409);                    // déjà vérifié
    assert.equal((await s.appel('POST', '/moi/telephone/renvoyer', { jeton: p.token })).code, 409);
    assert.equal((await s.admin('POST', `/acteurs/${p.id}/approuver`)).json.statut, 'ACTIF');
  } finally {
    s.arreter();
  }
});

test('code SMS : expiration, essais limités, renvois espacés et plafonnés', async () => {
  let t = 1_700_000_000_000;
  const s = await demarrer({ horloge: () => t });
  const renvoyer = (a) => s.appel('POST', '/moi/telephone/renvoyer', { jeton: a.token });
  const minutes = (n) => { t += n * 60_000; };
  try {
    const p = (await s.inscrire(pharmacie())).json;
    const premier = dernierCode(s.app, p.id);
    minutes(11);
    assert.match((await s.verifier(p, premier)).json.erreur, /expiré/);

    const r = await renvoyer(p);
    assert.equal(r.code, 200);
    assert.equal((await renvoyer(p)).code, 429);                            // moins d'une minute depuis le dernier envoi
    const second = dernierCode(s.app, p.id);
    const faux = second === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await s.verifier(p, faux);
    assert.equal((await s.verifier(p, second)).code, 429);                  // bon code, mais trop d'essais

    // 5 envois par heure au plus : inscription + renvoi déjà faits, encore 3 possibles.
    for (let i = 0; i < 3; i++) { minutes(1); assert.equal((await renvoyer(p)).code, 200); }
    minutes(1);
    assert.match((await renvoyer(p)).json.erreur, /dans une heure/);
    const dernier = dernierCode(s.app, p.id);
    assert.equal((await s.verifier(p, dernier)).json.telephoneVerifie, true);
  } finally {
    s.arreter();
  }
});

test('un ancien code ne fonctionne plus après un renvoi', async () => {
  let t = 1_700_000_000_000;
  const s = await demarrer({ horloge: () => t });
  try {
    const p = (await s.inscrire(pharmacie())).json;
    const ancien = dernierCode(s.app, p.id);
    t += 61_000;
    await s.appel('POST', '/moi/telephone/renvoyer', { jeton: p.token });
    const nouveau = dernierCode(s.app, p.id);
    if (ancien !== nouveau) assert.equal((await s.verifier(p, ancien)).code, 400);
    assert.equal((await s.verifier(p, nouveau)).code, 200);
  } finally {
    s.arreter();
  }
});

test('le code n’est jamais stocké en clair sur le compte ni renvoyé par /moi', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'code-'));
  try {
    const s = await demarrer({ dossier });
    try {
      const p = (await s.inscrire(pharmacie())).json;
      const code = dernierCode(s.app, p.id);
      const { acteurs } = JSON.parse(readFileSync(join(dossier, 'identite.json'), 'utf8'));
      assert.equal(JSON.stringify(acteurs).includes(`"${code}"`), false);
      assert.ok(acteurs[0].verification.codeHash);
      const moi = await s.appel('GET', '/moi', { jeton: p.token });
      assert.equal(moi.json.verification, undefined);
    } finally {
      s.arreter();
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
