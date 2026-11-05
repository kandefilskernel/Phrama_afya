import test from 'node:test';
import assert from 'node:assert/strict';
import { creerApp } from '../src/app.js';
import { lireOrigines } from '../src/interfaces/http/api.js';

const AUTORISEE = 'http://localhost:8080';

async function demarrer(origines) {
  const app = creerApp({ origines });
  await new Promise((ok) => app.serveur.listen(0, ok));
  const base = `http://localhost:${app.serveur.address().port}`;
  return { base, arreter: () => app.serveur.close() };
}
const appel = (base, chemin, { methode = 'GET', origine, entetes = {} } = {}) =>
  fetch(base + chemin, { method: methode, headers: { ...(origine ? { origin: origine } : {}), ...entetes } });

test('une origine autorisée reçoit les en-têtes CORS, une autre non', async () => {
  const { base, arreter } = await demarrer([AUTORISEE]);
  try {
    const ok = await appel(base, '/sante', { origine: AUTORISEE });
    assert.equal(ok.headers.get('access-control-allow-origin'), AUTORISEE);
    assert.match(ok.headers.get('vary') ?? '', /Origin/i);
    assert.equal(ok.headers.get('access-control-allow-credentials'), null);        // pas de cookies : l'API authentifie par jeton

    const refus = await appel(base, '/sante', { origine: 'http://autre.example' });
    assert.equal(refus.headers.get('access-control-allow-origin'), null);
    const sans = await appel(base, '/sante');
    assert.equal(sans.headers.get('access-control-allow-origin'), null);
  } finally {
    arreter();
  }
});

test('requête préalable : acceptée pour une origine autorisée, refusée sinon', async () => {
  const { base, arreter } = await demarrer([AUTORISEE]);
  try {
    const entetes = { 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, idempotency-key' };
    const ok = await appel(base, '/demandes', { methode: 'OPTIONS', origine: AUTORISEE, entetes });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get('access-control-allow-origin'), AUTORISEE);
    assert.match(ok.headers.get('access-control-allow-headers'), /idempotency-key/);
    assert.match(ok.headers.get('access-control-allow-methods'), /POST/);

    const refus = await appel(base, '/demandes', { methode: 'OPTIONS', origine: 'http://autre.example', entetes });
    assert.equal(refus.status, 403);
    assert.equal(refus.headers.get('access-control-allow-origin'), null);
  } finally {
    arreter();
  }
});

test('par défaut aucune origine n’est autorisée', async () => {
  const { base, arreter } = await demarrer(undefined);
  try {
    assert.equal((await appel(base, '/sante', { origine: AUTORISEE })).headers.get('access-control-allow-origin'), null);
    assert.equal((await appel(base, '/demandes', { methode: 'OPTIONS', origine: AUTORISEE })).status, 403);
  } finally {
    arreter();
  }
});

test('la configuration refuse le joker et les valeurs douteuses', () => {
  assert.deepEqual(lireOrigines(undefined), []);
  assert.deepEqual(lireOrigines(''), []);
  assert.deepEqual(lireOrigines('http://localhost:8080, https://app.nuruyaafya.cd'), ['http://localhost:8080', 'https://app.nuruyaafya.cd']);
  for (const mauvais of ['*', 'http://*.exemple.cd', 'localhost:8080', 'http://exemple.cd/chemin', 'ftp://exemple.cd', 'http://a.cd, *']) {
    assert.throws(() => lireOrigines(mauvais), /Origine CORS invalide/, mauvais);
  }
});
