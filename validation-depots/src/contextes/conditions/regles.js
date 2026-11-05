// Conditions de crédit propres à chaque prêteur (dépôt, IMF, banque).
// Chaque entité fixe les siennes ; la plateforme ne fait que les appliquer et les rendre visibles.

import { ErreurMetier } from '../../transverse/erreurs.js';

export const DEFAUTS = Object.freeze({
  paliersUSD: [20, 40, 80, 150, 300, 500], // plafond d'encours par palier, le 1er est le plafond de départ
  seriesRequises: 2,      // remboursements à temps pour monter d'un palier
  graceJours: 3,          // tolérance sur l'échéance
  retardGraveJours: 15,   // retard retirant un palier tant qu'il dure
  delaiDefautJours: 30,
  delaiMaxJours: 90,
  expirationHeures: 72,   // délai laissé au prêteur pour répondre à une demande
});

const erreur = (msg) => new ErreurMetier(400, msg);

function entier(nom, v, min, max) {
  if (!Number.isInteger(v) || v < min || v > max) throw erreur(`${nom} doit être un entier entre ${min} et ${max}`);
  return v;
}

// Valide un jeu complet de conditions et renvoie une copie normalisée.
export function validerConditions(c) {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) throw erreur('conditions invalides');
  for (const k of Object.keys(c)) if (!(k in DEFAUTS)) throw erreur(`Condition inconnue : ${k}`);
  for (const k of Object.keys(DEFAUTS)) if (!(k in c)) throw erreur(`Condition manquante : ${k}`);

  const p = c.paliersUSD;
  if (!Array.isArray(p) || p.length < 1 || p.length > 10) throw erreur('paliersUSD : 1 à 10 paliers');
  p.forEach((v, i) => {
    entier('un palier', v, 1, 1_000_000);
    if (i > 0 && v <= p[i - 1]) throw erreur('paliersUSD doit être strictement croissant');
  });

  const graceJours = entier('graceJours', c.graceJours, 0, 30);
  const retardGraveJours = entier('retardGraveJours', c.retardGraveJours, graceJours, 180);
  const delaiDefautJours = entier('delaiDefautJours', c.delaiDefautJours, 1, 365);
  const delaiMaxJours = entier('delaiMaxJours', c.delaiMaxJours, delaiDefautJours, 365);
  return {
    paliersUSD: [...p],
    seriesRequises: entier('seriesRequises', c.seriesRequises, 1, 10),
    graceJours,
    retardGraveJours,
    delaiDefautJours,
    delaiMaxJours,
    expirationHeures: entier('expirationHeures', c.expirationHeures, 1, 720),
  };
}
