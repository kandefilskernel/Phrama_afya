// Plateforme de démonstration LOCALE, avec des comptes et des demandes d'exemple.
//   npm run demo
// Réservée au développement : refuse de démarrer en production. Les jetons sont écrits en clair dans
// donnees-demo/identifiants.json pour pouvoir se connecter ; ne jamais réutiliser ce dossier ailleurs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { creerApp } from '../src/app.js';
import { DEFAUTS } from '../src/contextes/conditions/index.js';

if (process.env.NODE_ENV === 'production') {
  console.error('npm run demo est réservé au développement.');
  process.exit(1);
}

const dossier = process.env.DATA_DIR ?? './donnees-demo';
const fichier = join(dossier, 'identifiants.json');
const port = Number(process.env.PORT ?? 3000);
const JETON_INTERNE = 'demo-jeton-interne';
const JETON_BFF = 'demo-bff';
const app = creerApp({ dossier, jetonInterne: JETON_INTERNE, jetonAmorcage: 'demo-amorcage', jetonBff: JETON_BFF, origines: ['http://localhost:8081'] });

let ids;
if (existsSync(fichier)) {
  ids = JSON.parse(readFileSync(fichier, 'utf8'));
} else {
  const sup = app.administration.amorcer({ nom: 'Mireille Superviseure', telephone: '+243899000001' });
  const agent = app.administration.creer({ nom: 'Jean Agent', telephone: '+243899000002', role: 'agent' }, sup);
  const garder = (a) => ({ id: a.id, nom: a.nom, role: a.role, jeton: a.token });
  const ph1 = app.identite.inscrire('pharmacie', 'Pharmacie Gombe', '+243810000001');
  const ph2 = app.identite.inscrire('pharmacie', 'Pharmacie Limete', '+243810000002');
  const dep = app.identite.inscrire('depot', 'Dépôt Central Kinshasa', '+243810000003');
  const imf = app.identite.inscrire('imf', 'IMF Espoir', '+243810000004');
  app.conditions.definir(imf.id, { ...structuredClone(DEFAUTS), paliersUSD: [50, 100, 200], seriesRequises: 1, delaiMaxJours: 60 });

  // Quelques demandes pour que les écrans ne soient pas vides.
  const ligne = (produit, quantite) => ({ produit, quantite });
  const soumettre = (ph, pre, lignes) => app.credit.soumettre(ph, { creancierId: pre.id, lignes });
  const d1 = soumettre(ph1, dep, [ligne('Amoxicilline 500 mg (boîte de 20)', 10), ligne('Paracétamol 500 mg (boîte de 100)', 5)]);
  app.credit.agir(dep, d1.id, 'valider', { valeurUSD: 18, delaiAccordeJours: 30 });
  app.credit.agir(dep, d1.id, 'livrer');
  app.credit.agir(ph1, d1.id, 'receptionner');
  app.credit.agir(dep, d1.id, 'rembourser', { montantUSD: 6 });
  const d2 = soumettre(ph1, imf, [ligne('Sels de réhydratation orale', 40)]);
  app.credit.agir(imf, d2.id, 'valider', { valeurUSD: 35 });
  soumettre(ph2, dep, [ligne('Artéméther-luméfantrine (traitement paludisme)', 12)]);
  soumettre(ph2, imf, [ligne('Gants d\'examen (boîte de 100)', 6)]);
  const d5 = soumettre(ph2, dep, [ligne('Sérum physiologique 500 ml', 20)]);
  app.credit.agir(dep, d5.id, 'refuser', { motif: 'Stock épuisé cette semaine' });

  // Une inscription en attente d'agrément, téléphone déjà vérifié.
  const attente = app.identite.demanderInscription({ role: 'pharmacie', nom: 'Pharmacie Ngaliema', telephone: '+243810000005', numeroAgrement: 'PH-2026-0457', adresse: 'Avenue de la Libération, Ngaliema' });
  app.identite.verifierTelephone(attente.id, app.identite.evenementsApres(0, 1000).filter((e) => e.type === 'CodeVerificationEmis' && e.acteurId === attente.id).at(-1).donnees.code);

  ids = {
    administration: { superviseur: { nom: sup.nom, jeton: sup.token }, agent: { nom: agent.nom, jeton: agent.token } },
    pharmacies: [garder(ph1), garder(ph2)],
    preteurs: [garder(dep), garder(imf)],
  };
  writeFileSync(fichier, JSON.stringify(ids, null, 2));
}

// Sans service SMS en local, les codes de vérification s'affichent ici.
let vus = 0;
setInterval(() => {
  const evenements = app.identite.evenementsApres(vus, 100);
  for (const e of evenements) {
    vus = e.seq;
    const tel = app.identite.contact(e.acteurId)?.telephone;
    if (e.type === 'CodeVerificationEmis') console.log(`[démo] code de vérification SMS pour ${tel} : ${e.donnees.code}`);
    if (e.type === 'CodeConnexionEmis') console.log(`[démo] code de connexion SMS pour ${tel} : ${e.donnees.code}`);
  }
}, 500).unref();
setInterval(() => app.relayer().catch(() => {}), 1000).unref();

app.serveur.listen(port, () => {
  console.log(`Plateforme de démonstration sur http://localhost:${port}`);
  console.log(`Identifiants : ${fichier}`);
  console.log(`Jeton interne : ${JETON_INTERNE}`);
  console.log('Front web : dans un autre terminal, cd web puis npm run demo (http://localhost:3100).');
  console.log("Connexion par SMS : les codes s'affichent ici. Numéros de démonstration : +243810000001 (pharmacie), +243810000003 (dépôt).");
});
