// Service Notifications : lit les flux d'événements de Crédit et d'Identité, reçoit les demandes de
// l'Échéancier, puis envoie les SMS. Sa base et son processus sont séparés de la plateforme.
import { createServer } from 'node:http';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ouvrirStockage } from '../../../libs/stockage.js';
import { creerConsommateur } from '../../../libs/flux.js';
import { ENTETE_JETON, clientInterne, envoyerJson, jetonValide, lireJson } from '../../../libs/http.js';
import { ErreurRequete, creerNotifications } from './application/notifications.js';
import { messagesPourEvenement, messagesPourEvenementIdentite } from './domaine/modeles.js';

// plateforme : { base, jeton } ; jetonInterne : secret attendu des appelants.
export function creerService({ dossier = null, plateforme, jetonInterne, fournisseur, horloge = Date.now, prefixe = '', gsm7 = true, plafondJour = null }) {
  if (dossier) mkdirSync(dossier, { recursive: true });
  const stockage = ouvrirStockage(dossier ? join(dossier, 'notifications.json') : null);
  const appelerPlateforme = clientInterne(plateforme);

  const contacts = async (id) => {
    try { return await appelerPlateforme('GET', `/interne/acteurs/${encodeURIComponent(id)}/contact`); } catch (e) {
      if (e.statut === 404) return null;
      throw e;
    }
  };
  const notifications = creerNotifications({ stockage, contacts, fournisseur, horloge, prefixe, gsm7, plafondJour });

  // Un consommateur par flux, chacun avec son curseur.
  const lecteur = (chemin, versMessages, nom) => creerConsommateur({
    stockage,
    nom,
    lire: async (apres, limite) => (await appelerPlateforme('GET', `${chemin}?apres=${apres}&limite=${limite}`)).evenements,
    traiter: (e) => { for (const m of versMessages(e)) notifications.demander(m); },
  });
  const flux = lecteur('/interne/evenements', messagesPourEvenement, 'credit');
  const fluxIdentite = lecteur('/interne/evenements/identite', messagesPourEvenementIdentite, 'identite');

  const serveur = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && url.pathname === '/sante') {
        return envoyerJson(res, 200, { ok: true, curseur: flux.curseur(), curseurIdentite: fluxIdentite.curseur() });
      }
      if (!jetonValide(req.headers[ENTETE_JETON], jetonInterne)) return envoyerJson(res, 404, { erreur: 'Route inconnue' });
      if (req.method === 'POST' && url.pathname === '/notifications') {
        const r = notifications.demander(await lireJson(req));
        return envoyerJson(res, r.cree ? 202 : 200, r);
      }
      if (req.method === 'GET' && url.pathname === '/notifications') {
        return envoyerJson(res, 200, notifications.lister({
          destinataireId: url.searchParams.get('destinataireId'), statut: url.searchParams.get('statut'),
        }));
      }
      envoyerJson(res, 404, { erreur: 'Route inconnue' });
    } catch (e) {
      if (e instanceof ErreurRequete || e.statut === 400) return envoyerJson(res, 400, { erreur: e.message });
      console.error(e);
      envoyerJson(res, 500, { erreur: 'Erreur interne' });
    }
  });

  // Les deux flux sont indépendants : une erreur sur l'un n'empêche pas la lecture de l'autre.
  const tirer = async () => {
    const resultats = await Promise.allSettled([flux.tirer(), fluxIdentite.tirer()]);
    const echec = resultats.find((r) => r.status === 'rejected');
    if (echec) throw echec.reason;
  };
  return { serveur, notifications, tirer, envoyer: () => notifications.envoyerEnAttente() };
}
