// Service Échéancier : lit le flux de Crédit, suit les échéances, demande les rappels au service
// Notifications et fait expirer les demandes restées sans réponse.
import { createServer } from 'node:http';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ouvrirStockage } from '../../../libs/stockage.js';
import { creerConsommateur } from '../../../libs/flux.js';
import { ENTETE_JETON, clientInterne, envoyerJson, jetonValide } from '../../../libs/http.js';
import { creerEcheancier } from './application/echeancier.js';

// plateforme, notifications : { base, jeton }.
export function creerService({ dossier = null, plateforme, notifications, jetonInterne, horloge = Date.now }) {
  if (dossier) mkdirSync(dossier, { recursive: true });
  const stockage = ouvrirStockage(dossier ? join(dossier, 'echeancier.json') : null);
  const appelerPlateforme = clientInterne(plateforme);
  const appelerNotifications = clientInterne(notifications);

  const echeancier = creerEcheancier({
    stockage, horloge, notifier: (m) => appelerNotifications('POST', '/notifications', m),
  });

  const flux = creerConsommateur({
    stockage,
    nom: 'credit',
    lire: async (apres, limite) => (await appelerPlateforme('GET', `/interne/evenements?apres=${apres}&limite=${limite}`)).evenements,
    traiter: (e) => echeancier.appliquer(e),
  });

  const serveur = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/sante') return envoyerJson(res, 200, { ok: true, curseur: flux.curseur() });
    if (!jetonValide(req.headers[ENTETE_JETON], jetonInterne)) return envoyerJson(res, 404, { erreur: 'Route inconnue' });
    if (req.method === 'GET' && url.pathname === '/echeances') return envoyerJson(res, 200, echeancier.lister());
    envoyerJson(res, 404, { erreur: 'Route inconnue' });
  });

  return {
    serveur,
    echeancier,
    tirer: () => flux.tirer(),
    verifier: () => echeancier.verifier(),
    expirer: async () => (await appelerPlateforme('POST', '/interne/expirations')).expirees,
  };
}
