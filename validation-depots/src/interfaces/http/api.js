// Adaptateur HTTP. Il n'a aucune règle métier : il authentifie, route vers les modules
// et formate les réponses. C'est le futur emplacement de l'API Gateway.
import { createServer } from 'node:http';
import { ErreurMetier } from '../../transverse/erreurs.js';
import { STATUTS, estCreancier } from '../../contextes/identite/index.js';
import { ENTETE_JETON, jetonValide } from '../../../libs/http.js';

const CLE = 'idempotency-key';
const ENTETE_ADMIN = 'x-jeton-admin';
const ENTETE_AMORCAGE = 'x-jeton-amorcage';
const ENTETE_BFF = 'x-jeton-bff';
const DECISIONS = ['approuver', 'rejeter', 'suspendre', 'reactiver', 'jeton'];

const MESSAGE_STATUT = {
  [STATUTS.EN_ATTENTE]: 'Compte en attente de vérification de votre agrément',
  [STATUTS.REJETE]: 'Inscription rejetée',
  [STATUTS.SUSPENDU]: 'Compte suspendu',
};

// Limite le nombre d'inscriptions par adresse sur une fenêtre glissante (route publique).
// En mémoire : propre à chaque instance. Derrière un proxy, il faudra lire l'adresse d'origine qu'il transmet.
function creerLimiteur({ max, fenetreMs, horloge }) {
  const passages = new Map();
  return (cle) => {
    const now = horloge();
    const recents = (passages.get(cle) ?? []).filter((t) => now - t < fenetreMs);
    if (recents.length >= max) return false;
    recents.push(now);
    passages.set(cle, recents);
    return true;
  };
}

// jetonInterne : secret partagé avec les services (Notifications, Échéancier). Sans lui, les routes /interne sont désactivées.
// jetonAmorcage : secret qui ne sert qu'à créer le premier superviseur. Ensuite, chaque administrateur a son propre jeton.
// Lit la liste des origines autorisées à appeler l'API depuis un navigateur (CORS), séparées par des virgules.
// Une origine est un schéma, un hôte et éventuellement un port, sans chemin. Le joker `*` est refusé : l'API
// authentifie par jeton, et une origine ouverte à tous n'a pas de raison d'être. Vide : aucune origine (défaut).
export function lireOrigines(texte) {
  const origines = String(texte ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  for (const o of origines) {
    if (!/^https?:\/\/[^/*\s]+$/.test(o)) throw new Error(`Origine CORS invalide : « ${o} » (attendu : https://exemple.cd ou http://localhost:8080)`);
  }
  return origines;
}

// jetonBff : secret du front web. Quand il est présenté, l'adresse du client est lue dans X-Forwarded-For (que le front
// renseigne avec celle de l'utilisateur) ; sans lui, c'est l'adresse de la connexion. Sans ce secret, un client
// pourrait écrire n'importe quelle adresse et contourner les limites.
export function creerApi({
  identite, conditions, credit, idempotence, administration, jetonInterne = null, jetonAmorcage = null, jetonBff = null,
  limiteInscriptions = { max: 5, fenetreMs: 3600_000 },
  limitesConnexion = { code: { max: 60, fenetreMs: 3600_000 }, verification: { max: 60, fenetreMs: 600_000 } },
  origines = [],
  horloge = Date.now,
}) {
  const inscriptionPermise = creerLimiteur({ ...limiteInscriptions, horloge });
  const codeConnexionPermis = creerLimiteur({ ...limitesConnexion.code, horloge });
  const verificationConnexionPermise = creerLimiteur({ ...limitesConnexion.verification, horloge });
  const adresseClient = (req) => {
    if (jetonBff && jetonValide(req.headers[ENTETE_BFF], jetonBff)) {
      const transmise = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim().slice(0, 64);
      return transmise ? `bff:${transmise}` : 'bff:sans-adresse';
    }
    return req.socket.remoteAddress ?? 'inconnue';
  };
  const jetonBearer = (req) => /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? null;
  const parametresFlux = (url) => {
    const apres = Number(url.searchParams.get('apres') ?? 0);
    const limite = Math.min(Number(url.searchParams.get('limite') ?? 100), 500);
    if (!Number.isInteger(apres) || apres < 0 || !Number.isInteger(limite) || limite < 1) throw new ErreurMetier(400, 'apres/limite invalides');
    return [apres, limite];
  };
  const lire = (req) => new Promise((ok, ko) => {
    let brut = '';
    req.on('data', (c) => {
      brut += c;
      if (brut.length > 100_000) { ko(new ErreurMetier(400, 'Corps trop gros')); req.destroy(); }
    });
    req.on('end', () => {
      if (!brut) return ok({});
      try { ok(JSON.parse(brut)); } catch { ko(new ErreurMetier(400, 'JSON invalide')); }
    });
  });

  const acteurDe = (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    const a = m && identite.parToken(m[1]);
    if (!a) throw new ErreurMetier(401, 'Authentification requise');
    return a;
  };

  return createServer(async (req, res) => {
    const envoyer = (code, corps) => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(corps));
    };

    // CORS : seulement pour les origines listées. L'application mobile native n'est pas concernée.
    const origine = req.headers.origin;
    const origineAutorisee = Boolean(origine) && origines.includes(origine);
    if (origineAutorisee) {
      res.setHeader('access-control-allow-origin', origine);
      res.setHeader('vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!origineAutorisee) return envoyer(403, { erreur: 'Origine non autorisée' });
      res.writeHead(204, {
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type, idempotency-key',
        'access-control-max-age': '600',
      });
      return res.end();
    }

    try {
      const url = new URL(req.url, 'http://x');
      const parts = url.pathname.split('/').filter(Boolean);
      // Sonde de disponibilité pour l'orchestrateur : publique, sans donnée.
      if (req.method === 'GET' && url.pathname === '/sante') return envoyer(200, { ok: true });

      // Routes réservées aux autres services. Répondent 404 sans le bon jeton, pour ne pas révéler leur existence.
      if (parts[0] === 'interne') {
        if (!jetonValide(req.headers[ENTETE_JETON], jetonInterne)) throw new ErreurMetier(404, 'Route inconnue');
        if (req.method === 'GET' && parts.length === 2 && parts[1] === 'evenements') {
          return envoyer(200, { evenements: credit.evenementsApres(...parametresFlux(url)) });
        }
        if (req.method === 'GET' && parts.length === 3 && parts[1] === 'evenements' && parts[2] === 'identite') {
          return envoyer(200, { evenements: identite.evenementsApres(...parametresFlux(url)) });
        }
        if (req.method === 'GET' && parts.length === 4 && parts[1] === 'acteurs' && parts[3] === 'contact') {
          const c = identite.contact(parts[2]);
          if (!c) throw new ErreurMetier(404, 'Acteur inconnu');
          return envoyer(200, c);
        }
        if (req.method === 'POST' && parts.length === 2 && parts[1] === 'expirations') {
          return envoyer(200, { expirees: credit.expirerEchues() });
        }
        throw new ErreurMetier(404, 'Route inconnue');
      }

      // Inscription publique. Le jeton renvoyé ne sert qu'à suivre son statut jusqu'à l'approbation.
      if (req.method === 'POST' && url.pathname === '/inscriptions') {
        if (!inscriptionPermise(adresseClient(req))) {
          throw new ErreurMetier(429, "Trop d'inscriptions depuis cette adresse, réessayez plus tard");
        }
        return envoyer(201, identite.demanderInscription(await lire(req)));
      }

      // Connexion par SMS (publique). Les réponses ne révèlent pas si un numéro a un compte.
      if (req.method === 'POST' && url.pathname === '/connexion/code') {
        if (!codeConnexionPermis(adresseClient(req))) throw new ErreurMetier(429, 'Trop de demandes de code depuis cette adresse, réessayez plus tard');
        return envoyer(200, identite.demanderCodeConnexion((await lire(req)).telephone));
      }
      if (req.method === 'POST' && url.pathname === '/connexion/verifier') {
        if (!verificationConnexionPermise(adresseClient(req))) throw new ErreurMetier(429, 'Trop de tentatives depuis cette adresse, réessayez plus tard');
        const { telephone, code } = await lire(req);
        return envoyer(200, identite.verifierCodeConnexion(telephone, code));
      }

      // Amorçage : crée le premier superviseur. Inutilisable dès qu'un administrateur existe.
      if (req.method === 'POST' && url.pathname === '/admin/amorcage') {
        if (!jetonValide(req.headers[ENTETE_AMORCAGE], jetonAmorcage)) throw new ErreurMetier(404, 'Route inconnue');
        return envoyer(201, administration.amorcer(await lire(req)));
      }

      // Administration par comptes nominatifs. Sans jeton d'administrateur actif, ces routes n'existent pas (404).
      if (parts[0] === 'admin') {
        const admin = administration.parJeton(req.headers[ENTETE_ADMIN]);
        if (!admin) throw new ErreurMetier(404, 'Route inconnue');
        const par = administration.auteur(admin);
        const corps = req.method === 'POST' ? await lire(req) : {};
        const [, ressource, id, action] = parts;

        if (req.method === 'GET' && parts.length === 2 && ressource === 'moi') return envoyer(200, administration.publique(admin));
        if (req.method === 'POST' && parts.length === 3 && ressource === 'moi' && id === 'jeton') {
          return envoyer(200, administration.renouvelerJeton(admin.id, admin));
        }

        // Vérification des comptes : agents et superviseurs.
        if (req.method === 'GET' && parts.length === 2 && ressource === 'acteurs') {
          return envoyer(200, identite.lister({ statut: url.searchParams.get('statut'), role: url.searchParams.get('role') }));
        }
        if (req.method === 'POST' && parts.length === 4 && ressource === 'acteurs' && DECISIONS.includes(action)) {
          if (action === 'jeton') {
            // Réémettre le jeton d'un acteur permet d'agir en son nom : réservé aux superviseurs.
            administration.exigerSuperviseur(admin);
            return envoyer(200, identite.renouvelerJeton(id, par));
          }
          if (action === 'rejeter' || action === 'suspendre') {
            if (corps.motif === undefined) throw new ErreurMetier(400, 'motif requis');
            return envoyer(200, identite[action](id, corps.motif, par));
          }
          return envoyer(200, identite[action](id, par));
        }

        // Gestion de l'équipe : superviseurs uniquement (contrôlé dans le module).
        if (ressource === 'administrateurs') {
          if (req.method === 'GET' && parts.length === 2) return envoyer(200, administration.lister(admin));
          if (req.method === 'POST' && parts.length === 2) return envoyer(201, administration.creer(corps, admin));
          if (req.method === 'POST' && parts.length === 4 && action === 'desactiver') return envoyer(200, administration.desactiver(id, corps.motif, admin));
          if (req.method === 'POST' && parts.length === 4 && action === 'jeton') return envoyer(200, administration.renouvelerJeton(id, admin));
        }

        // Journal : décisions sur les comptes et gestion de l'équipe, les plus récentes d'abord.
        if (req.method === 'GET' && parts.length === 2 && ressource === 'journal') {
          const gestion = administration.journal(admin);
          const filtreAdmin = url.searchParams.get('adminId');
          const filtreCible = url.searchParams.get('cibleId');
          return envoyer(200, [...gestion, ...identite.journalDecisions()]
            .filter((e) => (!filtreAdmin || e.par.id === filtreAdmin) && (!filtreCible || e.cibleId === filtreCible))
            .sort((a, b) => b.le - a.le));
        }
        throw new ErreurMetier(404, 'Route inconnue');
      }

      const acteur = acteurDe(req);

      // Routes du compte lui-même, ouvertes quel que soit le statut.
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'moi') return envoyer(200, identite.vuePublique(acteur));
      if (req.method === 'POST' && url.pathname === '/moi/jeton') return envoyer(200, identite.renouvelerJeton(acteur.id));
      // Déconnexion : ferme la session côté serveur (le jeton permanent, lui, n'est pas révoqué).
      if (req.method === 'POST' && url.pathname === '/moi/deconnexion') return envoyer(200, { ferme: identite.revoquerSession(jetonBearer(req)) });
      if (req.method === 'POST' && url.pathname === '/moi/telephone/verifier') {
        const { code } = await lire(req);
        return envoyer(200, identite.verifierTelephone(acteur.id, code));
      }
      if (req.method === 'POST' && url.pathname === '/moi/telephone/renvoyer') return envoyer(200, identite.renvoyerCode(acteur.id));

      if (acteur.statut !== STATUTS.ACTIF) throw new ErreurMetier(403, MESSAGE_STATUT[acteur.statut] ?? 'Compte inactif');

      const ecriture = req.method === 'POST' || req.method === 'PUT';
      const corps = ecriture ? await lire(req) : {};

      // Exécute une écriture, avec rejeu si la même clé d'idempotence revient.
      // Le remboursement exige une clé : un renvoi ne doit jamais l'enregistrer deux fois.
      const ecrire = (obligatoire, fn) => {
        const cle = req.headers[CLE];
        if (!cle) {
          if (obligatoire) throw new ErreurMetier(400, 'En-tête Idempotency-Key requis');
          return fn();
        }
        return idempotence.executer(
          { acteurId: acteur.id, cle, empreinte: idempotence.empreinte(req.method, url.pathname, corps) },
          fn,
        );
      };
      const repondre = ({ code, corps: c }) => envoyer(code, c);

      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'creanciers') {
        return envoyer(200, conditions.annuaire());
      }

      if (parts.length === 1 && parts[0] === 'conditions') {
        if (!estCreancier(acteur.role)) throw new ErreurMetier(403, 'Réservé aux prêteurs');
        if (req.method === 'GET') return envoyer(200, conditions.obtenir(acteur.id));
        if (req.method === 'PUT') return repondre(ecrire(false, () => ({ code: 200, corps: conditions.definir(acteur.id, corps) })));
      }

      if (req.method === 'POST' && parts.length === 1 && parts[0] === 'demandes') {
        return repondre(ecrire(false, () => ({ code: 201, corps: credit.soumettre(acteur, corps) })));
      }

      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'demandes') {
        return envoyer(200, credit.lister(acteur, url.searchParams.get('etat')));
      }

      if (req.method === 'GET' && parts.length === 2 && parts[0] === 'demandes') {
        return envoyer(200, credit.voir(acteur, parts[1]));
      }

      if (req.method === 'POST' && parts.length === 3 && parts[0] === 'demandes') {
        const [, id, action] = parts;
        return repondre(ecrire(action === 'rembourser', () => ({ code: 200, corps: credit.agir(acteur, id, action, corps) })));
      }

      if (req.method === 'GET' && parts.length === 3 && parts[0] === 'pharmacies' && parts[2] === 'credit') {
        return envoyer(200, credit.creditPharmacie(acteur, parts[1]));
      }

      throw new ErreurMetier(404, 'Route inconnue');
    } catch (e) {
      if (e instanceof ErreurMetier) return envoyer(e.code, { erreur: e.message });
      console.error(e);
      envoyer(500, { erreur: 'Erreur interne' });
    }
  });
}
