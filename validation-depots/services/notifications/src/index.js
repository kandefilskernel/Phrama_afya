import { boucle } from '../../../libs/http.js';
import { creerService } from './composition.js';
import { choisirFournisseur } from './infrastructure/fournisseurs.js';

const exiger = (nom) => {
  const v = process.env[nom];
  if (!v) { console.error(`Variable ${nom} requise`); process.exit(1); }
  return v;
};

const jeton = exiger('JETON_INTERNE');
const service = creerService({
  dossier: process.env.DATA_DIR ?? './donnees-notifications',
  plateforme: { base: exiger('PLATEFORME_URL'), jeton },
  jetonInterne: jeton,
  fournisseur: choisirFournisseur(process.env.FOURNISSEUR || 'journal'),
  prefixe: process.env.PREFIXE_SMS ?? '',
  gsm7: process.env.SMS_GSM7 !== '0',
  plafondJour: process.env.SMS_PLAFOND_JOUR ? Number(process.env.SMS_PLAFOND_JOUR) : null,
});

boucle(async () => { await service.tirer(); await service.envoyer(); }, Number(process.env.INTERVALLE_MS ?? 5000), 'notifications');
const port = Number(process.env.PORT ?? 3001);
service.serveur.listen(port, () => console.log(`Service Notifications sur :${port}`));
