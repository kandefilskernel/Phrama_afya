/**
 * Met un numéro saisi à la main au format attendu par la plateforme (+243...).
 * Accepte les espaces, tirets, points et parenthèses, "00243...", et le format local "0812345678".
 * Renvoie null si le numéro n'est pas plausible.
 */
export function normaliserTelephone(saisie: string): string | null {
  let n = saisie.replace(/[\s().-]/g, "");
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  else if (/^0\d{9}$/.test(n)) n = `+243${n.slice(1)}`; // numéro congolais en format local
  else if (/^243\d{9}$/.test(n)) n = `+${n}`;
  return /^\+\d{8,15}$/.test(n) ? n : null;
}

/** Affichage partiellement masqué : +243 ••• ••• 567. */
export function masquerTelephone(tel: string | null): string {
  if (!tel) return "—";
  return `${tel.slice(0, 4)} ${"•".repeat(Math.max(0, tel.length - 7))} ${tel.slice(-3)}`;
}
