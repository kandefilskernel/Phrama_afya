// Suivi d'une relation prêteur-pharmacie, selon les conditions de CE prêteur.
// Chaque prêteur ne voit et ne calcule que son propre historique avec la pharmacie.
// Montants en cents de dollar (entiers). Calcul pur : rien n'est stocké.

export const JOUR_MS = 24 * 3600 * 1000;

const ETATS_ENGAGES = ['VALIDEE', 'LIVREE', 'RECEPTIONNEE'];

export const dejaRembourse = (d) => (d.remboursements ?? []).reduce((s, r) => s + r.montantCents, 0);
export const solde = (d) => (d.valeurCents ?? 0) - dejaRembourse(d);

// La tolérance est celle figée sur la demande à sa validation : changer ses conditions
// plus tard ne modifie pas les crédits déjà accordés.
export const enRetard = (d, now, jours = d.graceJours ?? 0) =>
  d.etat === 'RECEPTIONNEE' && d.echeanceLe != null && now > d.echeanceLe + jours * JOUR_MS;

export function scoringRelation(demandes, conditions, now = Date.now()) {
  const paliers = conditions.paliersUSD.map((usd) => usd * 100);
  const siennes = demandes.filter((d) => d.valeurCents != null);

  let palier = 0;
  let serie = 0;
  const soldees = siennes.filter((d) => d.etat === 'CLOTUREE').sort((a, b) => a.clotureLe - b.clotureLe);
  for (const d of soldees) {
    if (d.clotureLe <= d.echeanceLe + (d.graceJours ?? 0) * JOUR_MS) {
      serie += 1;
      if (serie >= conditions.seriesRequises && palier < paliers.length - 1) { palier += 1; serie = 0; }
    } else {
      serie = 0;
      palier = Math.max(0, palier - 1);
    }
  }

  const retardsGraves = siennes.filter((d) => enRetard(d, now, conditions.retardGraveJours));
  const palierEffectif = Math.max(0, palier - retardsGraves.length);

  const encoursCents = siennes
    .filter((d) => ETATS_ENGAGES.includes(d.etat))
    .reduce((s, d) => s + solde(d), 0);
  const plafondCents = paliers[palierEffectif];
  const enRetardIds = siennes.filter((d) => enRetard(d, now)).map((d) => d.id);

  return {
    palier: palierEffectif,
    plafondCents,
    encoursCents,
    disponibleCents: Math.max(0, plafondCents - encoursCents),
    bloque: enRetardIds.length > 0,
    enRetardIds,
    serieEnCours: serie,
    serieRequise: conditions.seriesRequises,
    prochainPlafondCents: palierEffectif < paliers.length - 1 ? paliers[palierEffectif + 1] : null,
  };
}
