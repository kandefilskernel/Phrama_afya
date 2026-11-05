// Protège le découpage par responsabilité. Chaque test décrit une règle de dépendance ; une dépendance
// interdite fait échouer le build avec le fichier et la règle en cause.
//
// Plateforme (src/) :
//   contextes/<nom>  responsabilité métier (identité, conditions, crédit, scoring, administration).
//                    Un contexte n'utilise un autre contexte que par son index.js, et seulement s'il est autorisé.
//   transverse/      outils sans métier (erreurs, stockage, bus d'événements, idempotence).
//   interfaces/      entrée HTTP : traduit les requêtes en appels de contextes, sans règle métier.
//   src/*.js         racine de composition : relie les pièces. Seule couche qui connaît tout le monde.
//
// Services (services/<nom>/src/) : domaine (règles pures) / application (cas d'usage) /
//   infrastructure (fournisseurs externes) / racine (composition). Les dépendances vont vers le domaine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projet = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(projet, 'src');
const libs = join(projet, 'libs');
const services = join(projet, 'services');

// Dépendances autorisées entre contextes. Tout le reste est interdit.
const CONTEXTES_AUTORISES = {
  identite: [],
  conditions: [],
  scoring: [],
  credit: ['identite', 'scoring'],
  administration: [],
};

// Dépendances autorisées entre couches d'un service.
const COUCHES_AUTORISEES = {
  domaine: ['domaine'],
  application: ['domaine', 'application'],
  infrastructure: ['domaine', 'infrastructure'],
  racine: ['domaine', 'application', 'infrastructure', 'racine'],
};
const LIBS_AUTORISEES = { domaine: false, application: true, infrastructure: true, racine: true };

const estTest = (f) => /[\\/]test[\\/]/.test(f) || f.endsWith('.test.js');
const dedans = (dossier, f) => f === dossier || f.startsWith(dossier + sep);
const rel = (f) => relative(projet, f).split(sep).join('/');

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return chemin.endsWith('.js') ? [chemin] : [];
  });
}

const importsDe = (f) => [...readFileSync(f, 'utf8').matchAll(/from\s+'(\.[^']+)'/g)].map((m) => resolve(dirname(f), m[1]));

// Où se trouve un fichier de la plateforme.
function placePlateforme(f) {
  const r = relative(src, f).split(sep);
  if (r[0] === 'contextes') return { couche: 'contexte', nom: r[1], index: r.length === 3 && r[2] === 'index.js' };
  if (r[0] === 'transverse') return { couche: 'transverse' };
  if (r[0] === 'interfaces') return { couche: 'interface' };
  return { couche: 'racine' };
}

function verifierPlateforme(f, c, erreurs) {
  const de = placePlateforme(f);
  if (dedans(libs, c)) {
    if (de.couche === 'contexte' || de.couche === 'transverse') erreurs.push(`${rel(f)} importe libs/ depuis ${de.couche}`);
    return;
  }
  if (!dedans(src, c)) {
    erreurs.push(`${rel(f)} importe hors de la plateforme : ${rel(c)}`);
    return;
  }
  const vers = placePlateforme(c);
  if (de.couche === 'racine') return;
  if (de.couche === 'transverse') {
    if (vers.couche !== 'transverse') erreurs.push(`${rel(f)} : transverse ne peut pas dépendre de ${vers.couche}`);
    return;
  }
  if (de.couche === 'interface') {
    if (vers.couche === 'racine') erreurs.push(`${rel(f)} : une interface ne dépend pas de la racine de composition`);
    if (vers.couche === 'contexte' && !vers.index) erreurs.push(`${rel(f)} importe l'intérieur du contexte ${vers.nom} (${rel(c)})`);
    return;
  }
  // de.couche === 'contexte'
  if (vers.couche === 'transverse') return;
  if (vers.couche === 'contexte') {
    if (vers.nom === de.nom) return; // même contexte : usage interne
    if (!CONTEXTES_AUTORISES[de.nom]?.includes(vers.nom)) erreurs.push(`${rel(f)} : le contexte ${de.nom} n'a pas le droit d'utiliser ${vers.nom}`);
    else if (!vers.index) erreurs.push(`${rel(f)} importe l'intérieur du contexte ${vers.nom} (${rel(c)})`);
    return;
  }
  erreurs.push(`${rel(f)} : un contexte ne dépend pas de ${vers.couche}`);
}

// Couche d'un fichier de service, ou null s'il n'est pas dans services/<nom>/src.
function coucheService(f) {
  const r = relative(services, f).split(sep);
  if (r.length < 3 || r[1] !== 'src') return null;
  const couche = r[2];
  return ['domaine', 'application', 'infrastructure'].includes(couche) ? couche : 'racine';
}

function verifierService(f, c, erreurs) {
  const de = coucheService(f);
  if (dedans(libs, c)) {
    if (!LIBS_AUTORISEES[de]) erreurs.push(`${rel(f)} (${de}) importe libs/ : le domaine reste pur`);
    return;
  }
  const serviceDe = relative(services, f).split(sep)[0];
  const dossierSrc = join(services, serviceDe, 'src');
  if (!dedans(dossierSrc, c)) {
    erreurs.push(`${rel(f)} importe hors de son service : ${rel(c)}`);
    return;
  }
  const vers = coucheService(c);
  if (!COUCHES_AUTORISEES[de].includes(vers)) erreurs.push(`${rel(f)} : la couche ${de} ne dépend pas de ${vers}`);
}

function verifierLibs(f, c, erreurs) {
  if (dedans(src, c) || dedans(services, c)) erreurs.push(`${rel(f)} : libs/ est partagé et ne dépend ni de la plateforme ni des services`);
}

const fichiersServices = () => readdirSync(services).flatMap((s) => {
  const dossier = join(services, s, 'src');
  try { return fichiers(dossier); } catch { return []; }
});

test('plateforme : contextes, transverse, interfaces et racine ne se dépendent que dans le sens autorisé', () => {
  const erreurs = [];
  for (const f of fichiers(src)) for (const c of importsDe(f)) verifierPlateforme(f, c, erreurs);
  assert.deepEqual(erreurs, []);
});

test('services : le domaine est pur, l’application et l’infrastructure restent séparées', () => {
  const erreurs = [];
  for (const f of fichiersServices()) for (const c of importsDe(f)) verifierService(f, c, erreurs);
  assert.deepEqual(erreurs, []);
});

test('libs : code partagé sans dépendance vers la plateforme ni les services', () => {
  const erreurs = [];
  for (const f of fichiers(libs)) for (const c of importsDe(f)) verifierLibs(f, c, erreurs);
  assert.deepEqual(erreurs, []);
});

test('aucun module ni service ne contient de notion de paiement', () => {
  const interdits = /\b(iban|mobile.?money|virement|portefeuille|wallet)\b/i;
  const sources = [...fichiers(src), ...fichiers(libs), ...fichiersServices()].filter((f) => !estTest(f));
  const fautifs = sources.filter((f) => readFileSync(f, 'utf8').split('\n').some((l) => !l.trim().startsWith('//') && interdits.test(l)));
  assert.deepEqual(fautifs.map(rel), []);
});
