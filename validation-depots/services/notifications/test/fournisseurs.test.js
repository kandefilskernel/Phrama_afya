// Les adaptateurs sont testés contre de faux serveurs locaux qui imitent les API des fournisseurs :
// aucun vrai SMS n'est envoyé, aucun identifiant réel n'est utilisé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ouvrirStockage } from '../../../libs/stockage.js';
import { ErreurFournisseur, africasTalking, choisirFournisseur, twilio } from '../src/infrastructure/fournisseurs.js';
import { creerNotifications, masquerNumeros } from '../src/application/notifications.js';
import { encodage, segments, versGsm7 } from '../src/domaine/gsm7.js';

// Faux fournisseur : enregistre chaque requête et répond selon `repondre(requete)` -> { code, json } ou null (pas de réponse).
async function fauxServeur(repondre) {
  const requetes = [];
  const serveur = createServer((req, res) => {
    let brut = '';
    req.on('data', (c) => { brut += c; });
    req.on('end', () => {
      const r = { methode: req.method, chemin: req.url, entetes: req.headers, formulaire: Object.fromEntries(new URLSearchParams(brut)) };
      requetes.push(r);
      const reponse = repondre(r);
      if (!reponse) return; // simule un fournisseur qui ne répond jamais
      res.writeHead(reponse.code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reponse.json));
    });
  });
  await new Promise((ok) => serveur.listen(0, ok));
  return { base: `http://localhost:${serveur.address().port}`, requetes, fermer: () => { serveur.closeAllConnections(); serveur.close(); } };
}

const atReponse = (statusCode, status, messageId = 'ATXid_1') => ({
  code: 201, json: { SMSMessageData: { Message: 'Sent to 1/1', Recipients: [{ statusCode, number: '+243810000001', status, cost: 'USD 0.02', messageId }] } },
});
const rejette = async (promesse, attendu) => {
  try { await promesse; } catch (e) {
    assert.ok(e instanceof ErreurFournisseur, e.message);
    for (const [k, v] of Object.entries(attendu)) assert.equal(e[k], v, `${k} : ${e.message}`);
    return e;
  }
  assert.fail('une erreur était attendue');
};

test("Africa's Talking : requête conforme et référence du message renvoyée", async () => {
  const f = await fauxServeur(() => atReponse(101, 'Success'));
  try {
    const at = africasTalking({ username: 'nuru', apiKey: 'cle-test', expediteur: 'NURU', base: f.base });
    const r = await at.envoyer({ telephone: '+243810000001', texte: 'Bonjour' });
    assert.equal(r.id, 'ATXid_1');
    const [req] = f.requetes;
    assert.equal(req.chemin, '/version1/messaging');
    assert.equal(req.entetes.apikey, 'cle-test');
    assert.equal(req.entetes.accept, 'application/json');
    assert.deepEqual(req.formulaire, { username: 'nuru', to: '+243810000001', message: 'Bonjour', from: 'NURU' });
  } finally {
    f.fermer();
  }
});

test("Africa's Talking : numéro invalide définitif, solde insuffisant et clé refusée réessayés", async () => {
  let reponse = atReponse(403, 'InvalidPhoneNumber');
  const f = await fauxServeur(() => reponse);
  try {
    const at = africasTalking({ username: 'nuru', apiKey: 'k', base: f.base });
    const sms = { telephone: '+243810000001', texte: 'x' };
    await rejette(at.envoyer(sms), { definitif: true, code: 403 });
    reponse = atReponse(406, 'UserInBlacklist');
    await rejette(at.envoyer(sms), { definitif: true });
    reponse = atReponse(405, 'InsufficientBalance');
    await rejette(at.envoyer(sms), { definitif: false, code: 405 });
    reponse = { code: 401, json: 'The supplied authentication is invalid' };
    await rejette(at.envoyer(sms), { definitif: false, code: 401 });
    assert.equal(f.requetes[0].formulaire.from, undefined); // sans expéditeur : celui par défaut du compte
  } finally {
    f.fermer();
  }
});

test('Twilio : authentification, numéro ou service expéditeur, référence renvoyée', async () => {
  const f = await fauxServeur(() => ({ code: 201, json: { sid: 'SM123', status: 'queued' } }));
  try {
    const t = twilio({ accountSid: 'AC42', authToken: 'secret', expediteur: '+15005550006', base: f.base });
    assert.equal((await t.envoyer({ telephone: '+243810000001', texte: 'Bonjour' })).id, 'SM123');
    const [req] = f.requetes;
    assert.equal(req.chemin, '/2010-04-01/Accounts/AC42/Messages.json');
    assert.equal(req.entetes.authorization, `Basic ${Buffer.from('AC42:secret').toString('base64')}`);
    assert.deepEqual(req.formulaire, { To: '+243810000001', Body: 'Bonjour', From: '+15005550006' });

    const service = twilio({ accountSid: 'AC42', authToken: 'secret', expediteur: 'MG999', base: f.base });
    await service.envoyer({ telephone: '+243810000001', texte: 'x' });
    assert.equal(f.requetes[1].formulaire.MessagingServiceSid, 'MG999');
    assert.equal(f.requetes[1].formulaire.From, undefined);
  } finally {
    f.fermer();
  }
});

test('Twilio : erreurs liées au destinataire définitives, les autres réessayées', async () => {
  let reponse;
  const f = await fauxServeur(() => reponse);
  try {
    const t = twilio({ accountSid: 'AC42', authToken: 's', expediteur: '+15005550006', base: f.base });
    const sms = { telephone: '+243810000001', texte: 'x' };
    reponse = { code: 400, json: { code: 21211, message: "The 'To' number +243810000001 is not a valid phone number." } };
    const e = await rejette(t.envoyer(sms), { definitif: true, code: 21211 });
    assert.match(masquerNumeros(e.message), /••••••••••001/);
    assert.equal(masquerNumeros(e.message).includes('+243810000001'), false);
    reponse = { code: 400, json: { code: 21408, message: 'Permission to send an SMS has not been enabled for the region' } };
    await rejette(t.envoyer(sms), { definitif: false });   // réglage du compte : à corriger, pas à abandonner
    reponse = { code: 401, json: { code: 20003, message: 'Authenticate' } };
    await rejette(t.envoyer(sms), { definitif: false });
    reponse = { code: 503, json: {} };
    await rejette(t.envoyer(sms), { definitif: false });
  } finally {
    f.fermer();
  }
});

test('fournisseur qui ne répond pas : délai dépassé, réessayé plus tard', async () => {
  const f = await fauxServeur(() => null);
  try {
    const t = twilio({ accountSid: 'AC42', authToken: 's', expediteur: '+15005550006', base: f.base, delaiMs: 200 });
    await rejette(t.envoyer({ telephone: '+243810000001', texte: 'x' }), { definitif: false });
  } finally {
    f.fermer();
  }
});

test('choix du fournisseur : variables manquantes refusées au démarrage', () => {
  assert.throws(() => choisirFournisseur('twilio', { TWILIO_ACCOUNT_SID: 'AC' }), /TWILIO_AUTH_TOKEN, SMS_EXPEDITEUR/);
  assert.throws(() => choisirFournisseur('africastalking', {}), /AT_USERNAME, AT_API_KEY/);
  assert.throws(() => choisirFournisseur('orange', {}), /Fournisseur inconnu/);
  assert.ok(choisirFournisseur('africastalking', { AT_USERNAME: 'sandbox', AT_API_KEY: 'k' }).envoyer);
});

test('GSM-7 : accents simplifiés, segments comptés', () => {
  assert.equal(versGsm7('Inscription reçue, être payé « à temps » – merci…'), 'Inscription recue, etre payé " à temps " - merci...');
  assert.equal(encodage('Inscription reçue'), 'UCS-2');
  assert.equal(encodage(versGsm7('Inscription reçue')), 'GSM-7');
  assert.equal(segments('a'.repeat(160)), 1);
  assert.equal(segments('a'.repeat(161)), 2);
  assert.equal(segments('€'.repeat(80)), 1);                  // caractère étendu : compte double
  assert.equal(segments('€'.repeat(81)), 2);
  assert.equal(segments(`ç${'a'.repeat(69)}`), 1);             // UCS-2 : 70 caractères par SMS
  assert.equal(segments(`ç${'a'.repeat(70)}`), 2);
});

const CONTACTS = {
  p1: { id: 'p1', nom: 'Pharmacie Gombe', telephone: '+243810000001' },
  d1: { id: 'd1', nom: 'Dépôt Kinshasa', telephone: '+243810000002' },
};
const msg = (cle) => ({ cle, destinataireId: 'p1', modele: 'creditSolde', donnees: {}, pharmacieId: 'p1', creancierId: 'd1' });

test('envoi : texte en GSM-7, référence et segments enregistrés ; erreur définitive sans nouvel essai', async () => {
  const envoyes = [];
  let echec = null;
  const n = creerNotifications({
    stockage: ouvrirStockage(), contacts: async (id) => CONTACTS[id],
    fournisseur: { envoyer: async (m) => { if (echec) throw echec; envoyes.push(m); return { id: `ref-${envoyes.length}` }; } },
  });
  n.demander(msg('a'));
  await n.envoyerEnAttente();
  const [m] = n.lister();
  assert.equal(m.texte, 'Votre crédit auprès de Dépot Kinshasa est entièrement remboursé. Merci.');
  assert.deepEqual([m.fournisseurId, m.encodage, m.segments], ['ref-1', 'GSM-7', 1]);

  echec = new ErreurFournisseur('Twilio HTTP 400 21211 numéro +243810000001 invalide', { definitif: true });
  n.demander(msg('b'));
  await n.envoyerEnAttente();
  const b = n.lister().find((x) => x.cle === 'b');
  assert.equal(b.statut, 'ECHEC_DEFINITIF');
  assert.equal(b.tentatives, 1);
  assert.equal(b.derniereErreur.includes('+243810000001'), false);
});

test('plafond journalier : au-delà, les messages attendent le lendemain sans être perdus', async () => {
  let t = Date.UTC(2026, 10, 4, 8);
  const envoyes = [];
  const n = creerNotifications({
    stockage: ouvrirStockage(), contacts: async (id) => CONTACTS[id], horloge: () => t, plafondJour: 2,
    fournisseur: { envoyer: async (m) => { envoyes.push(m); return { id: null }; } },
  });
  for (const cle of ['a', 'b', 'c']) n.demander(msg(cle));
  await n.envoyerEnAttente();
  await n.envoyerEnAttente();
  assert.equal(envoyes.length, 2);
  assert.equal(n.lister({ statut: 'EN_ATTENTE' }).length, 1);
  t = Date.UTC(2026, 10, 5, 0, 1);                           // lendemain
  await n.envoyerEnAttente();
  assert.equal(envoyes.length, 3);
});

test('chaque modèle de SMS reste en GSM-7 et tient dans un seul SMS', async () => {
  const { MODELES } = await import('../src/domaine/modeles.js');
  const c = {
    destinataire: { nom: 'Pharmacie Grande Avenue de Kintambo' },
    pharmacie: { nom: 'Pharmacie Grande Avenue de Kintambo' },
    preteur: { nom: 'Institution de Microfinance du Congo' },
  };
  const d = {
    code: '123456', expireLe: Date.UTC(2026, 10, 7), echeanceLe: Date.UTC(2026, 11, 4), valeurCents: 15000, soldeCents: 12550,
    montantCents: 2450, delaiAccordeJours: 30, motif: 'Agrément introuvable au registre',
  };
  const trop = [];
  for (const [nom, modele] of Object.entries(MODELES)) {
    const texte = versGsm7(modele(d, c));
    assert.equal(encodage(texte), 'GSM-7', `${nom} : ${texte}`);
    if (segments(texte) > 1) trop.push(`${nom} (${texte.length} car.)`);
  }
  assert.deepEqual(trop, []);
});

test('Twilio : vérification du compte sans envoi, avec le type d’essai ou complet', async () => {
  let reponse = { code: 200, json: { friendly_name: 'Nuru ya Afya', status: 'active', type: 'Trial' } };
  const f = await fauxServeur(() => reponse);
  try {
    const t = twilio({ accountSid: 'AC42', authToken: 'secret', expediteur: '+15005550006', base: f.base });
    assert.deepEqual(await t.verifierCompte(), { identifiants: 'acceptés', compte: 'Nuru ya Afya', statut: 'active', type: 'Trial' });
    assert.equal(f.requetes[0].methode, 'GET');
    assert.equal(f.requetes[0].chemin, '/2010-04-01/Accounts/AC42.json');
    assert.equal(f.requetes[0].entetes.authorization, `Basic ${Buffer.from('AC42:secret').toString('base64')}`);
    assert.equal(f.requetes.some((r) => r.chemin.includes('Messages')), false);          // aucun SMS créé

    reponse = { code: 401, json: { code: 20003, message: 'Authenticate' } };
    await rejette(t.verifierCompte(), { code: 401 });
    reponse = { code: 404, json: {} };
    await rejette(t.verifierCompte(), { code: 404 });
    reponse = { code: 503, json: {} };
    await rejette(t.verifierCompte(), { code: 503 });
  } finally {
    f.fermer();
  }
});

test("Africa's Talking : vérification du compte sans envoi", async () => {
  let reponse = { code: 200, json: { UserData: { balance: 'USD 4.5000' } } };
  const f = await fauxServeur(() => reponse);
  try {
    const at = africasTalking({ username: 'nuru', apiKey: 'cle-test', base: f.base });
    assert.deepEqual(await at.verifierCompte(), { identifiants: 'acceptés', solde: 'USD 4.5000' });
    assert.equal(f.requetes[0].chemin, '/version1/user?username=nuru');
    assert.equal(f.requetes[0].entetes.apikey, 'cle-test');
    reponse = { code: 401, json: 'The supplied authentication is invalid' };
    const e = await rejette(at.verifierCompte(), { code: 401 });
    assert.match(e.message, /refuse ces identifiants/);
  } finally {
    f.fermer();
  }
});
