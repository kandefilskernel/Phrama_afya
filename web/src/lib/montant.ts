/**
 * Lit un montant en dollars saisi à la main : « 18 », « 18,5 », « 18.50 », « 1 250 ».
 * Renvoie null si ce n'est pas un montant valide (au plus 2 décimales, strictement positif).
 */
export function lireMontantUSD(saisie: string): number | null {
  const s = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && Number.isFinite(n) ? n : null;
}

/** Entier strictement positif, sinon null. */
export function lireEntierPositif(saisie: string): number | null {
  const s = saisie.replace(/\s/g, "");
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}
