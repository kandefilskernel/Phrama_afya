// Envoie un SMS d'essai avec le fournisseur configuré, pour valider identifiants et couverture.
//   npm run essai-sms -- [--fournisseur=twilio] +243810000000 [texte]   envoie un SMS d'essai
//   npm run essai-sms -- [--fournisseur=twilio] --verifier              contrôle les identifiants, sans envoyer
// Lit la configuration dans l'environnement ou, à défaut, dans le fichier .env du projet.
// Avec AT_USERNAME=sandbox, rien n'est envoyé à un vrai téléphone : le SMS arrive dans le simulateur
// Africa's Talking.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { choisirFournisseur } from '../services/notifications/src/infrastructure/fournisseurs.js';
import { encodage, segments, versGsm7 } from '../services/notifications/src/domaine/gsm7.js';

const fichierEnv = join(dirname(fileURLToPath(import.meta.url)), '../.env');
const env = { ...process.env };
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}

const args = process.argv.slice(2);
const option = args.find((a) => a.startsWith('--fournisseur='));
const verifierSeulement = args.includes('--verifier');
const [telephone, ...mots] = args.filter((a) => a !== option && a !== '--verifier');
const nom = option?.split('=')[1] || env.FOURNISSEUR || 'journal';

if (verifierSeulement) {
  try {
    const fournisseur = choisirFournisseur(nom, env);
    if (!fournisseur.verifierCompte) { console.error(`Le fournisseur ${nom} n'a pas de vérification de compte.`); process.exit(1); }
    const r = await fournisseur.verifierCompte();
    console.log(`Fournisseur : ${nom}`);
    for (const [k, v] of Object.entries(r)) console.log(`  ${k} : ${v ?? '(inconnu)'}`);
    if (r.type === 'Trial') console.log('  Compte d\'essai : les SMS ne partent qu\'vers des numéros vérifiés dans la console Twilio.');
  } catch (e) {
    console.error(`Échec : ${e.message}`);
    process.exit(2);
  }
  process.exit(0);
}

if (!telephone || !/^\+\d{8,15}$/.test(telephone)) {
  console.error('Usage : npm run essai-sms -- [--fournisseur=twilio] +243XXXXXXXXX [texte]   ou   --verifier');
  process.exit(1);
}
const texte = versGsm7(mots.join(' ') || "Essai d'envoi depuis la plateforme. Ce message confirme que la configuration SMS fonctionne.");

const mode = nom === 'africastalking' ? ` (${env.AT_USERNAME === 'sandbox' ? 'sandbox, aucun SMS réel' : 'PRODUCTION, SMS réel facturé'})`
  : nom === 'twilio' ? ' (SMS réel facturé, sauf avec les identifiants de test de Twilio)' : '';
console.log(`Fournisseur : ${nom}${mode}`);
console.log(`Texte : ${texte.length} caractères, ${encodage(texte)}, ${segments(texte)} SMS facturé(s)`);
try {
  const r = await choisirFournisseur(nom, env).envoyer({ telephone, texte });
  console.log(`Accepté par le fournisseur. Référence : ${r.id ?? '(aucune)'}`);
} catch (e) {
  console.error(`Échec${e.definitif ? ' définitif (lié au destinataire)' : ' (configuration ou panne, à corriger puis réessayer)'} : ${e.message}`);
  process.exit(2);
}
