import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';

// Stockage JSON minimal : un fichier par module, donc une base propre par module.
// L'écriture est atomique (fichier temporaire puis renommage) : tout ce qui change dans
// un module au sein d'une même opération est enregistré en une seule fois.
// À remplacer par une base par service (PostgreSQL) à l'extraction du module.
export function ouvrirStockage(fichier = null) {
  const donnees = fichier && existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : {};
  const stockage = {
    donnees,
    sauver() {
      if (!fichier) return;
      const tmp = `${fichier}.tmp`;
      writeFileSync(tmp, JSON.stringify(donnees, null, 2));
      renameSync(tmp, fichier);
    },
  };
  // Écriture d'essai dès l'ouverture : un dossier non inscriptible (volume mal configuré)
  // fait échouer le démarrage au lieu de la première opération d'un utilisateur.
  stockage.sauver();
  return stockage;
}
