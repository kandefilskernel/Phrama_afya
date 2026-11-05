import { createHash } from 'node:crypto';
import { ErreurMetier } from './erreurs.js';

// Rejoue la réponse d'origine quand un client renvoie la même requête avec la même clé
// (réseau instable, SMS en double). Une clé réutilisée pour une autre requête est refusée.
// `executer` est synchrone : vérification et enregistrement ne peuvent pas s'entrelacer.
export function creerIdempotence(stockage) {
  const cles = (stockage.donnees.cles ??= {});
  return {
    empreinte: (methode, chemin, corps) => createHash('sha256').update(`${methode} ${chemin} ${JSON.stringify(corps)}`).digest('hex'),
    executer({ acteurId, cle, empreinte }, fn) {
      const k = `${acteurId}:${cle}`;
      const connue = cles[k];
      if (connue) {
        if (connue.empreinte !== empreinte) throw new ErreurMetier(409, "Clé d'idempotence déjà utilisée pour une autre requête");
        return connue.reponse;
      }
      const reponse = fn();
      if (reponse.code < 300) { cles[k] = { empreinte, reponse }; stockage.sauver(); } // seuls les succès sont rejoués
      return reponse;
    },
  };
}
