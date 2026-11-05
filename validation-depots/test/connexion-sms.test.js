import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerApp } from '../src/app.js';
import { CONNEXION } from '../src/contextes/identite/index.js';

const BFF = 'secret-bff-de-test';
const T0 = 1_700_000_000_000;
const MIN = 60_000;
const PAR = { id: 'admin-test', nom: 'Admin Test' };
const TEL = '+243810000001';

async function demarrer(options = {}) {
  let t = T0;
  const app = creerApp({ horloge: () => t, jetonBff: BFF, ...options });
  await new Promise((ok) => app.serveur.listen(0, ok));
  const base = `http://localhost:${app.serveur.address().port}`;
  const appel = async (methode, chemin, { jeton, body, entetes = {} } = {}) => {
    const headers = { 'content-type': 'application/json', ...entetes };
    if (jeton) headers.authorization = `Bearer ${jeton}`;
    const r = await fetch(base + chemin, { method: methode, headers, body: body ? JSON.stringify(body) : undefined });
    return { code: r.status, json: await r.json() };
  };
  const codes = (id) => app.identite.evenementsApres(0, 100_000).filter((e) => e.type === 'CodeConnexionEmis' && e.acteurId === id);
  const dernierCode = (id) => codes(id).at(-1)?.donnees.code;
  const demanderCode = (telephone = TEL, entetes = {}) => appel('POST', '/connexion/code', { body: { telephone }, entetes });
  const verifier = (telephone, code, entetes = {}) => appel('POST', '/connexion/verifier', { body: { telephone, code }, entetes });
  return {
    app, appel, codes, dernierCode, demanderCode, verifier,
    avancer: (ms) => { t += ms; },
    arreter: () => app.serveur.close(),
  };
}

// Se connecte par SMS : demande le code, le lit dans le flux d'événements, le soumet.
async function seConnecter(s, acteur, telephone = TEL) {
  await s.demanderCode(telephone);
  return s.verifier(telephone, s.dernierCode(acteur.id));
}

test('connexion par SMS : code, session, accès, puis expiration côté serveur', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'Pharmacie Gombe', TEL);
  try {
    const r = await s.demanderCode();
    assert.deepEqual(r.json, { envoye: true });
    const code = s.dernierCode(p.id);
    assert.match(code, /^\d{6}$/);

    const session = await s.verifier(TEL, code);
    assert.equal(session.code, 200);
    assert.deepEqual([session.json.role, session.json.statut], ['pharmacie', 'ACTIF']);
    assert.equal(session.json.expireLe, T0 + CONNEXION.SESSION_MS);

    const moi = await s.appel('GET', '/moi', { jeton: session.json.token });
    assert.equal(moi.json.id, p.id);
    assert.equal(moi.json.jetonHash, undefined);
    assert.equal(moi.json.connexion, undefined);
    assert.equal((await s.appel('GET', '/moi', { jeton: p.token })).code, 200);        // le jeton permanent reste valable

    s.avancer(CONNEXION.SESSION_MS + 1);
    assert.equal((await s.appel('GET', '/moi', { jeton: session.json.token })).code, 401); // la session a expiré
    assert.equal((await s.appel('GET', '/moi', { jeton: p.token })).code, 200);
  } finally {
    s.arreter();
  }
});

test('un code ne sert qu’une fois', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    await s.demanderCode();
    const code = s.dernierCode(p.id);
    assert.equal((await s.verifier(TEL, code)).code, 200);
    assert.equal((await s.verifier(TEL, code)).code, 400);
  } finally {
    s.arreter();
  }
});

test('anti-énumération : la demande de code répond pareil pour un numéro connu et inconnu', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    const connu = await s.demanderCode(TEL);
    const inconnu = await s.demanderCode('+243899999999');
    assert.deepEqual([connu.code, connu.json], [inconnu.code, inconnu.json]);
    assert.equal(s.codes(p.id).length, 1);
    assert.equal(s.app.identite.evenementsApres(0).filter((e) => e.type === 'CodeConnexionEmis').length, 1); // rien pour l'inconnu
    // Une demande trop rapprochée ne change pas la réponse non plus (aucun nouveau SMS, mais rien ne le dit).
    const bis = await s.demanderCode(TEL);
    assert.deepEqual([bis.code, bis.json], [200, { envoye: true }]);
    assert.equal(s.codes(p.id).length, 1);
    assert.equal((await s.demanderCode('0810000001')).code, 400);                         // format invalide : même pour tous
  } finally {
    s.arreter();
  }
});

test('toutes les causes d’échec de vérification donnent la même réponse', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    const reponses = [];
    reponses.push(await s.verifier('+243899999999', '123456'));                            // numéro inconnu
    reponses.push(await s.verifier(TEL, '123456'));                                         // aucun code demandé
    await s.demanderCode();
    const bon = s.dernierCode(p.id);
    const faux = bon === '000000' ? '111111' : '000000';
    reponses.push(await s.verifier(TEL, faux));                                             // code faux
    reponses.push(await s.verifier(TEL, '12'));                                             // format invalide
    reponses.push(await s.verifier(TEL, 123456));                                           // mauvais type
    for (const r of reponses) {
      assert.equal(r.code, 400);
      assert.deepEqual(r.json, reponses[0].json);
    }
    assert.match(reponses[0].json.erreur, /incorrect ou expiré/);
  } finally {
    s.arreter();
  }
});

test('5 erreurs verrouillent le code, même si le bon est ensuite saisi ; un nouveau code remplace l’ancien', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    await s.demanderCode();
    const ancien = s.dernierCode(p.id);
    const faux = ancien === '000000' ? '111111' : '000000';
    for (let i = 0; i < CONNEXION.ESSAIS_MAX; i++) assert.equal((await s.verifier(TEL, faux)).code, 400);
    assert.equal((await s.verifier(TEL, ancien)).code, 400);                                // verrouillé

    s.avancer(CONNEXION.DELAI_RENVOI_MS + 1);
    await s.demanderCode();
    const nouveau = s.dernierCode(p.id);
    assert.notEqual(s.codes(p.id).length, 1);
    if (nouveau !== ancien) assert.equal((await s.verifier(TEL, ancien)).code, 400);        // l'ancien code ne marche plus
    assert.equal((await s.verifier(TEL, nouveau)).code, 200);
  } finally {
    s.arreter();
  }
});

test('le code expire après 5 minutes', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    await s.demanderCode();
    const code = s.dernierCode(p.id);
    s.avancer(CONNEXION.VALIDITE_MS + 1);
    assert.equal((await s.verifier(TEL, code)).code, 400);
    await s.demanderCode();
    assert.equal((await s.verifier(TEL, s.dernierCode(p.id))).code, 200);
  } finally {
    s.arreter();
  }
});

test('renvois : 1 minute entre deux codes, 5 par heure au plus, sans jamais l’indiquer', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    await s.demanderCode();
    s.avancer(30_000);
    await s.demanderCode();
    assert.equal(s.codes(p.id).length, 1);                                                  // trop tôt : aucun nouveau code
    for (let i = 0; i < 6; i++) { s.avancer(CONNEXION.DELAI_RENVOI_MS + 1); await s.demanderCode(); }
    assert.equal(s.codes(p.id).length, CONNEXION.ENVOIS_MAX_PAR_HEURE);                     // plafond horaire atteint
    s.avancer(3600_000);
    await s.demanderCode();
    assert.equal(s.codes(p.id).length, CONNEXION.ENVOIS_MAX_PAR_HEURE + 1);
  } finally {
    s.arreter();
  }
});

test('selon le statut du compte : en attente avec téléphone prouvé et suspendu entrent, rejeté et non prouvé non', async () => {
  const s = await demarrer();
  const { identite } = s.app;
  const codeVerification = (id) => identite.evenementsApres(0).filter((e) => e.type === 'CodeVerificationEmis' && e.acteurId === id).at(-1).donnees.code;
  try {
    // En attente, téléphone vérifié : accès à la page de statut seulement.
    const attente = identite.demanderInscription({ role: 'pharmacie', nom: 'Pharmacie Attente', telephone: '+243810000011', numeroAgrement: 'PH-11' });
    identite.verifierTelephone(attente.id, codeVerification(attente.id));
    const entre = await seConnecter(s, attente, '+243810000011');
    assert.equal(entre.code, 200);
    assert.equal(entre.json.statut, 'EN_ATTENTE');
    assert.equal((await s.appel('GET', '/demandes', { jeton: entre.json.token })).code, 403);
    assert.equal((await s.appel('GET', '/moi', { jeton: entre.json.token })).json.statut, 'EN_ATTENTE');

    // Téléphone non prouvé : le numéro n'est pas considéré comme un compte.
    const neuf = identite.demanderInscription({ role: 'pharmacie', nom: 'Pharmacie Neuve', telephone: '+243810000012', numeroAgrement: 'PH-12' });
    await s.demanderCode('+243810000012');
    assert.equal(s.codes(neuf.id).length, 0);

    // Rejeté : pas de connexion.
    const rejete = identite.demanderInscription({ role: 'pharmacie', nom: 'Pharmacie Rejetée', telephone: '+243810000013', numeroAgrement: 'PH-13' });
    identite.verifierTelephone(rejete.id, codeVerification(rejete.id));
    identite.rejeter(rejete.id, 'Agrément introuvable', PAR);
    await s.demanderCode('+243810000013');
    assert.equal(s.codes(rejete.id).length, 0);

    // Suspendu : peut se connecter, mais n'a plus accès aux fonctions.
    const actif = identite.inscrire('depot', 'Dépôt', '+243810000014');
    identite.suspendre(actif.id, 'Contrôle en cours', PAR);
    const suspendu = await seConnecter(s, actif, '+243810000014');
    assert.equal(suspendu.json.statut, 'SUSPENDU');
    assert.equal((await s.appel('GET', '/demandes', { jeton: suspendu.json.token })).code, 403);
  } finally {
    s.arreter();
  }
});

test('déconnexion : la session est fermée côté serveur, le jeton permanent n’est pas touché', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    const { json: { token } } = await seConnecter(s, p);
    assert.equal((await s.appel('POST', '/moi/deconnexion', { jeton: token, body: {} })).json.ferme, true);
    assert.equal((await s.appel('GET', '/moi', { jeton: token })).code, 401);
    // Avec le jeton permanent, il n'y a rien à fermer.
    assert.equal((await s.appel('POST', '/moi/deconnexion', { jeton: p.token, body: {} })).json.ferme, false);
    assert.equal((await s.appel('GET', '/moi', { jeton: p.token })).code, 200);
  } finally {
    s.arreter();
  }
});

test('au plus 5 sessions par compte : la plus ancienne est fermée', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    const jetons = [];
    for (let i = 0; i < CONNEXION.SESSIONS_MAX + 1; i++) {
      jetons.push((await seConnecter(s, p)).json.token);
      s.avancer(CONNEXION.DELAI_RENVOI_MS + 1);
    }
    assert.equal((await s.appel('GET', '/moi', { jeton: jetons[0] })).code, 401);
    for (const j of jetons.slice(1)) assert.equal((await s.appel('GET', '/moi', { jeton: j })).code, 200);
  } finally {
    s.arreter();
  }
});

test('un jeton réémis par l’administration ferme les sessions ouvertes', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    const { json: { token } } = await seConnecter(s, p);
    s.app.identite.renouvelerJeton(p.id, PAR);
    assert.equal((await s.appel('GET', '/moi', { jeton: token })).code, 401);
  } finally {
    s.arreter();
  }
});

test('limites par adresse : chaque client du front a sa propre limite, une adresse écrite à la main est ignorée', async () => {
  const s = await demarrer({ limitesConnexion: { code: { max: 2, fenetreMs: 3600_000 }, verification: { max: 100, fenetreMs: 600_000 } } });
  const bff = (ip) => ({ 'x-jeton-bff': BFF, 'x-forwarded-for': ip });
  try {
    // Via le front : deux adresses de clients différentes ont chacune 2 demandes.
    for (const ip of ['41.0.0.1', '41.0.0.2']) {
      assert.equal((await s.demanderCode(TEL, bff(ip))).code, 200);
      assert.equal((await s.demanderCode(TEL, bff(ip))).code, 200);
      assert.equal((await s.demanderCode(TEL, bff(ip))).code, 429);
    }
    // Sans le secret du front, X-Forwarded-For n'est pas cru : la même adresse de connexion partage une limite.
    const sans = (ip) => ({ 'x-forwarded-for': ip });
    assert.equal((await s.demanderCode(TEL, sans('41.0.0.3'))).code, 200);
    assert.equal((await s.demanderCode(TEL, sans('41.0.0.4'))).code, 200);
    assert.equal((await s.demanderCode(TEL, sans('41.0.0.5'))).code, 429);
    // Un mauvais secret est traité comme l'absence de secret.
    assert.equal((await s.demanderCode(TEL, { 'x-jeton-bff': 'faux', 'x-forwarded-for': '41.0.0.6' })).code, 429);
  } finally {
    s.arreter();
  }
});

test('l’inscription aussi utilise l’adresse du client transmise par le front', async () => {
  const s = await demarrer({ limiteInscriptions: { max: 1, fenetreMs: 3600_000 } });
  const inscrire = (n, ip) => s.appel('POST', '/inscriptions', {
    body: { role: 'pharmacie', nom: `Pharmacie ${n}`, telephone: `+24381000002${n}`, numeroAgrement: `PH-${n}` },
    entetes: { 'x-jeton-bff': BFF, 'x-forwarded-for': ip },
  });
  try {
    assert.equal((await inscrire(1, '41.0.0.1')).code, 201);
    assert.equal((await inscrire(2, '41.0.0.1')).code, 429);
    assert.equal((await inscrire(3, '41.0.0.2')).code, 201);
  } finally {
    s.arreter();
  }
});

test('les codes en clair sont effacés du flux après une heure', async () => {
  const s = await demarrer();
  const p = s.app.identite.inscrire('pharmacie', 'P', TEL);
  try {
    await s.demanderCode();
    const ancien = s.dernierCode(p.id);
    assert.match(ancien, /^\d{6}$/);
    s.avancer(3600_000 + 2 * MIN);
    await s.demanderCode();                                                                  // un nouvel événement déclenche le nettoyage
    const [premier, second] = s.codes(p.id);
    assert.equal(premier.donnees.code, null);
    assert.ok(premier.donnees.expireLe);                                                     // le reste de l'événement est conservé
    assert.match(second.donnees.code, /^\d{6}$/);
  } finally {
    s.arreter();
  }
});

test('les sessions ne sont jamais stockées en clair et survivent à un redémarrage', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'sessions-'));
  try {
    const a = await demarrer({ dossier });
    const p = a.app.identite.inscrire('pharmacie', 'P', TEL);
    const { json: { token } } = await seConnecter(a, p);
    a.arreter();

    const brut = readFileSync(join(dossier, 'identite.json'), 'utf8');
    assert.equal(brut.includes(token), false);
    assert.ok(JSON.parse(brut).sessions[0].hash);
    // Le code n'est jamais sur le compte (seulement son empreinte) ; il ne reste dans le flux d'événements qu'une heure.
    assert.equal(JSON.stringify(JSON.parse(brut).acteurs).includes(a.dernierCode(p.id)), false);

    const b = await demarrer({ dossier });
    try {
      assert.equal((await b.appel('GET', '/moi', { jeton: token })).json.id, p.id);
    } finally {
      b.arreter();
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});
