// Racine de composition : seul endroit qui connaît tous les modules et les relie entre eux.
// Les modules ne s'appellent jamais directement : ils reçoivent leurs dépendances (`ports`) d'ici.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirStockage } from '../libs/stockage.js';
import { creerBus } from './transverse/evenements.js';
import { creerIdempotence } from './transverse/idempotence.js';
import { creerIdentite } from './contextes/identite/index.js';
import { creerConditions } from './contextes/conditions/index.js';
import { creerCredit } from './contextes/credit/index.js';
import { creerAdministration } from './contextes/administration/index.js';
import { creerApi, lireOrigines } from './interfaces/http/api.js';

// `dossier` null = tout en mémoire (tests). Sinon un fichier par module : une base par module.
export function creerApp({
  dossier = null, horloge = Date.now, jetonInterne = null, jetonAmorcage = null, jetonBff = null, limiteInscriptions, limitesConnexion, origines,
} = {}) {
  if (dossier) mkdirSync(dossier, { recursive: true });
  const base = (nom) => ouvrirStockage(dossier ? join(dossier, `${nom}.json`) : null);

  const bus = creerBus();
  const identite = creerIdentite({ stockage: base('identite'), horloge });
  const conditions = creerConditions({ stockage: base('conditions'), bus, ports: { creanciers: identite.creanciers } });
  const credit = creerCredit({ stockage: base('credit'), ports: { identite, conditions }, horloge });
  const administration = creerAdministration({ stockage: base('administration'), horloge });
  const idempotence = creerIdempotence(base('idempotence'));
  const serveur = creerApi({
    identite, conditions, credit, idempotence, administration, jetonInterne, jetonAmorcage, jetonBff, limiteInscriptions, limitesConnexion, origines, horloge,
  });

  return { serveur, bus, identite, conditions, credit, administration, relayer: () => credit.relayer(bus) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = creerApp({
    dossier: process.env.DATA_DIR ?? './donnees',
    jetonInterne: process.env.JETON_INTERNE ?? null,
    jetonAmorcage: process.env.JETON_AMORCAGE ?? null,
    jetonBff: process.env.JETON_BFF ?? null,
    origines: lireOrigines(process.env.ORIGINES_AUTORISEES),
    limiteInscriptions: { max: Number(process.env.INSCRIPTIONS_MAX_HEURE ?? 5), fenetreMs: 3600_000 },
  });
  if (!process.env.JETON_BFF) console.warn('JETON_BFF absent : l\'adresse des clients derrière le front web n\'est pas connue, les limites par adresse s\'appliquent à tous ensemble');
  if (!process.env.JETON_INTERNE) console.warn('JETON_INTERNE absent : routes /interne désactivées, les services ne pourront pas se connecter');
  if (!process.env.JETON_AMORCAGE) console.warn('JETON_AMORCAGE absent : le premier superviseur ne pourra pas être créé (inutile s\'il existe déjà)');
  // Journal des événements en console. Les services Notifications et Échéancier lisent le flux /interne/evenements.
  app.bus.abonner('*', (e) => console.log(JSON.stringify({ evenement: e.type, id: e.id, demandeId: e.demandeId })));
  setInterval(() => app.relayer().catch((e) => console.error('relais', e)), 1000).unref();
  const port = Number(process.env.PORT ?? 3000);
  app.serveur.listen(port, () => console.log(`Plateforme de suivi de crédit sur :${port}`));
}
