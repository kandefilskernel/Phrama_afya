import { boucle } from '../../../libs/http.js';
import { creerService } from './composition.js';

const exiger = (nom) => {
  const v = process.env[nom];
  if (!v) { console.error(`Variable ${nom} requise`); process.exit(1); }
  return v;
};

const jeton = exiger('JETON_INTERNE');
const service = creerService({
  dossier: process.env.DATA_DIR ?? './donnees-echeancier',
  plateforme: { base: exiger('PLATEFORME_URL'), jeton },
  notifications: { base: exiger('NOTIFICATIONS_URL'), jeton },
  jetonInterne: jeton,
});

// Trois tâches indépendantes : une panne de l'une n'empêche pas les autres.
const intervalle = Number(process.env.INTERVALLE_MS ?? 60_000);
boucle(() => service.tirer(), intervalle, 'flux');
boucle(() => service.verifier(), intervalle, 'rappels');
boucle(() => service.expirer(), intervalle, 'expirations');

const port = Number(process.env.PORT ?? 3002);
service.serveur.listen(port, () => console.log(`Service Échéancier sur :${port}`));
