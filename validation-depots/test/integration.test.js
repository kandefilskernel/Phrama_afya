// Les trois services tournent ensemble et ne communiquent qu'en HTTP, comme en production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { creerApp } from '../src/app.js';
import { creerService as creerNotifications } from '../services/notifications/src/composition.js';
import { creerService as creerEcheancier } from '../services/echeancier/src/composition.js';

const JOUR = 24 * 3600 * 1000;
const T0 = 1_700_000_000_000;
const JETON = 'jeton-de-test-interne';
const JETON_AMORCAGE = 'jeton-de-test-amorcage';

const ecouter = (serveur) => new Promise((ok) => serveur.listen(0, () => ok(`http://localhost:${serveur.address().port}`)));

async function monter() {
  let t = T0;
  const horloge = () => t;
  const sms = [];
  const plateforme = creerApp({ horloge, jetonInterne: JETON, jetonAmorcage: JETON_AMORCAGE });
  const urlPlateforme = await ecouter(plateforme.serveur);
  const notif = creerNotifications({
    plateforme: { base: urlPlateforme, jeton: JETON }, jetonInterne: JETON, horloge,
    fournisseur: { envoyer: async (m) => { sms.push(m); } },
  });
  const urlNotif = await ecouter(notif.serveur);
  const ech = creerEcheancier({
    plateforme: { base: urlPlateforme, jeton: JETON }, notifications: { base: urlNotif, jeton: JETON }, jetonInterne: JETON, horloge,
  });
  await ecouter(ech.serveur);

  const appel = async (acteur, methode, chemin, body, entetes = {}) => {
    const r = await fetch(urlPlateforme + chemin, {
      method: methode,
      headers: { authorization: `Bearer ${acteur.token}`, 'content-type': 'application/json', ...entetes },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { code: r.status, json: await r.json() };
  };
  // Un passage de chaque boucle, dans l'ordre où elles tourneraient.
  const cycle = async () => {
    await ech.expirer();
    await notif.tirer(); await ech.tirer();
    await ech.verifier();
    await notif.envoyer();
  };
  return {
    plateforme, notif, ech, sms, appel, cycle, urlPlateforme, urlNotif,
    aller: (jours) => { t = T0 + jours * JOUR; },
    arreter: () => [plateforme.serveur, notif.serveur, ech.serveur].forEach((s) => s.close()),
  };
}

test('parcours complet : SMS au prêteur, à la pharmacie, rappels, retard, remboursement', async () => {
  const s = await monter();
  const p = s.plateforme.identite.inscrire('pharmacie', 'Pharmacie Gombe', '+243810000001');
  const dep = s.plateforme.identite.inscrire('depot', 'Dépôt A', '+243810000002');
  const pour = (acteur) => s.sms.filter((m) => m.telephone === acteur.telephone).map((m) => m.texte);
  try {
    const { json: d } = await s.appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'Paracétamol', quantite: 100 }] });
    await s.cycle();
    assert.match(pour(dep)[0], /Nouvelle demande de crédit de Pharmacie Gombe/);

    await s.appel(dep, 'POST', `/demandes/${d.id}/valider`, { valeurUSD: 20 });
    await s.appel(dep, 'POST', `/demandes/${d.id}/livrer`);
    await s.appel(p, 'POST', `/demandes/${d.id}/receptionner`);
    await s.cycle();
    assert.match(pour(p)[0], /Dépot A a validé votre demande : 20\.00 USD/);

    s.aller(27); await s.cycle(); await s.cycle();
    assert.equal(pour(p).filter((x) => x.startsWith('Rappel')).length, 1);

    s.aller(34); await s.cycle();
    assert.match(pour(p).at(-1), /^Retard : 20\.00 USD dus à Dépot A/);
    assert.match(pour(dep).at(-1), /Pharmacie Gombe est en retard/);

    await s.appel(dep, 'POST', `/demandes/${d.id}/rembourser`, { montantUSD: 20 }, { 'idempotency-key': 'r1' });
    await s.cycle();
    assert.ok(pour(p).some((x) => /remboursement de 20\.00 USD/.test(x)));
    assert.match(pour(p).at(-1), /entièrement remboursé/);
    assert.equal(s.ech.echeancier.lister()[0].statut, 'SOLDEE');
  } finally {
    s.arreter();
  }
});

test('une demande sans réponse expire et la pharmacie est prévenue', async () => {
  const s = await monter();
  const p = s.plateforme.identite.inscrire('pharmacie', 'P', '+243810000001');
  const dep = s.plateforme.identite.inscrire('depot', 'D', '+243810000002');
  try {
    await s.appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'a', quantite: 1 }] });
    s.aller(4); await s.cycle();
    assert.ok(s.sms.some((m) => m.telephone === p.telephone && /expiré sans réponse/.test(m.texte)));
  } finally {
    s.arreter();
  }
});

test('Notifications arrêté : la plateforme continue, rien n’est perdu ni doublé au retour', async () => {
  const s = await monter();
  const p = s.plateforme.identite.inscrire('pharmacie', 'P', '+243810000001');
  const dep = s.plateforme.identite.inscrire('depot', 'D', '+243810000002');
  try {
    s.notif.serveur.close();                                            // panne du service
    const r = await s.appel(p, 'POST', '/demandes', { creancierId: dep.id, lignes: [{ produit: 'a', quantite: 1 }] });
    assert.equal(r.code, 201);                                          // le parcours principal fonctionne
    await s.appel(dep, 'POST', `/demandes/${r.json.id}/valider`, { valeurUSD: 10 });
    await s.appel(dep, 'POST', `/demandes/${r.json.id}/livrer`);
    await s.appel(p, 'POST', `/demandes/${r.json.id}/receptionner`);
    await s.ech.tirer();
    s.aller(27);
    await assert.rejects(s.ech.verifier());                             // l'Échéancier ne peut pas prévenir

    await new Promise((ok) => s.notif.serveur.listen(new URL(s.urlNotif).port, ok)); // retour du service
    await s.cycle(); await s.cycle();
    const textes = s.sms.map((m) => m.texte);
    assert.equal(textes.filter((x) => /Nouvelle demande/.test(x)).length, 1);
    assert.equal(textes.filter((x) => /a validé/.test(x)).length, 1);
    assert.equal(textes.filter((x) => x.startsWith('Rappel')).length, 1);
  } finally {
    s.arreter();
  }
});

test('les routes internes sont invisibles sans le jeton', async () => {
  const s = await monter();
  try {
    for (const url of [`${s.urlPlateforme}/interne/evenements`, `${s.urlNotif}/notifications`]) {
      assert.equal((await fetch(url)).status, 404);
      assert.equal((await fetch(url, { headers: { 'x-jeton-interne': 'mauvais' } })).status, 404);
    }
    assert.equal((await fetch(`${s.urlPlateforme}/interne/evenements`, { headers: { 'x-jeton-interne': JETON } })).status, 200);
  } finally {
    s.arreter();
  }
});

test('inscription : code SMS, confirmation, puis validation ou rejet', async () => {
  const s = await monter();
  const post = (chemin, body, entetes = {}) => fetch(s.urlPlateforme + chemin, {
    method: 'POST', headers: { 'content-type': 'application/json', ...entetes }, body: JSON.stringify(body ?? {}),
  }).then((r) => r.json());
  const superviseur = await post('/admin/amorcage', { nom: 'Superviseur', telephone: '+243899000001' }, { 'x-jeton-amorcage': JETON_AMORCAGE });
  const admin = { 'x-jeton-admin': superviseur.token };
  try {
    const p = await post('/inscriptions', { role: 'pharmacie', nom: 'Pharmacie Limete', telephone: '+243810000011', numeroAgrement: 'PH-11' });
    const d = await post('/inscriptions', { role: 'imf', nom: 'IMF Kin', telephone: '+243810000012', numeroAgrement: 'IMF-12' });
    await s.cycle();
    const pour = (tel) => s.sms.filter((m) => m.telephone === tel).map((m) => m.texte);

    // La pharmacie lit le code dans son SMS et le saisit.
    const [smsCode] = pour('+243810000011');
    const code = /code de vérification : (\d{6})/.exec(smsCode)[1];
    assert.equal((await post(`/admin/acteurs/${p.id}/approuver`, {}, admin)).erreur.includes('Téléphone non vérifié'), true);
    const verifie = await post('/moi/telephone/verifier', { code }, { authorization: `Bearer ${p.token}` });
    assert.equal(verifie.telephoneVerifie, true);

    await post(`/admin/acteurs/${p.id}/approuver`, {}, admin);
    await post(`/admin/acteurs/${d.id}/rejeter`, { motif: 'Agrément BCC non trouvé' }, admin);
    await s.cycle(); await s.cycle();
    assert.equal(pour('+243810000011').length, 3);
    assert.match(pour('+243810000011')[1], /Téléphone confirmé. Inscription de Pharmacie Limete recue/);
    assert.match(pour('+243810000011')[2], /Le compte de Pharmacie Limete est validé/);
    assert.match(pour('+243810000012')[1], /n'a pas été retenue. Motif : Agrément BCC non trouvé/);
  } finally {
    s.arreter();
  }
});

test('un code SMS bloqué pendant une panne n’est pas envoyé une fois expiré', async () => {
  const s = await monter();
  try {
    s.notif.serveur.close();
    const r = await fetch(`${s.urlPlateforme}/inscriptions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'pharmacie', nom: 'Pharmacie Ngaliema', telephone: '+243810000021', numeroAgrement: 'PH-21' }),
    });
    assert.equal(r.status, 201);
    s.aller(1);                                                   // un jour plus tard, le code a expiré depuis longtemps
    await new Promise((ok) => s.notif.serveur.listen(new URL(s.urlNotif).port, ok));
    await s.cycle();
    assert.equal(s.sms.some((m) => /code de vérification/.test(m.texte)), false);
    assert.equal(s.notif.notifications.lister({ statut: 'PERIME' }).length, 1);
  } finally {
    s.arreter();
  }
});

test('connexion par SMS : le code part par le service Notifications et ouvre une session', async () => {
  const s = await monter();
  const p = s.plateforme.identite.inscrire('pharmacie', 'Pharmacie Gombe', '+243810000031');
  const post = (chemin, body) => fetch(s.urlPlateforme + chemin, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }).then(async (r) => ({ code: r.status, json: await r.json() }));
  try {
    assert.equal((await post('/connexion/code', { telephone: '+243810000031' })).code, 200);
    await post('/connexion/code', { telephone: '+243899999999' });            // numéro inconnu : aucun SMS
    await s.cycle();
    const recus = s.sms.filter((m) => /code de connexion/.test(m.texte));
    assert.equal(recus.length, 1);
    assert.equal(recus[0].telephone, '+243810000031');
    assert.match(recus[0].texte, /expire dans 5 minutes/);

    const code = /code de connexion : (\d{6})/.exec(recus[0].texte)[1];
    const session = await post('/connexion/verifier', { telephone: '+243810000031', code });
    assert.equal(session.code, 200);
    const moi = await fetch(`${s.urlPlateforme}/moi`, { headers: { authorization: `Bearer ${session.json.token}` } }).then((r) => r.json());
    assert.equal(moi.id, p.id);
  } finally {
    s.arreter();
  }
});
