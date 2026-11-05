import "server-only";
import { ErreurApi } from "./api";
import type { EtatAction } from "@/components/formulaires";

/** Transforme une erreur en message pour l'écran. Les erreurs inattendues sont journalisées, pas affichées. */
export function enEtat(e: unknown): EtatAction {
  if (e instanceof ErreurApi) return { erreur: e.message };
  console.error(e);
  return { erreur: "Une erreur inattendue est survenue. Réessayez." };
}

/** Lit un champ texte d'un formulaire. */
export function champ(donnees: FormData, nom: string): string {
  const v = donnees.get(nom);
  return typeof v === "string" ? v.trim() : "";
}
