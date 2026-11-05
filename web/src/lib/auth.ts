import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ErreurApi } from "./api";
import { administration, plateforme } from "./plateforme";
import { jetonDeSession } from "./session";
import type { Acteur, Admin } from "./types";

// Couche d'accès aux données : chaque page demande ici qui est connecté. `cache` évite de répéter l'appel
// à la plateforme plusieurs fois pendant une même requête.

/** L'acteur connecté, ou null s'il n'y a pas de session valide. Les pannes du service remontent en erreur. */
export const acteurCourant = cache(async (): Promise<Acteur | null> => {
  const jeton = await jetonDeSession("acteur");
  if (!jeton) return null;
  try {
    return await plateforme.moi(jeton);
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 401) return null;
    throw e;
  }
});

export const adminCourant = cache(async (): Promise<Admin | null> => {
  const jeton = await jetonDeSession("admin");
  if (!jeton) return null;
  try {
    return await administration.moi(jeton);
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 401) return null;
    throw e;
  }
});

/** Page réservée à un compte actif d'un type donné. Sinon : connexion, ou page de statut du compte. */
export async function exigerActeur(type: "pharmacie" | "preteur"): Promise<Acteur> {
  const acteur = await acteurCourant();
  if (!acteur) redirect("/deconnexion?raison=expire");
  if (acteur.statut !== "ACTIF") redirect("/compte");
  const bonEspace = type === "pharmacie" ? acteur.role === "pharmacie" : acteur.role !== "pharmacie";
  if (!bonEspace) redirect(acteur.role === "pharmacie" ? "/pharmacie" : "/preteur");
  return acteur;
}

export async function exigerAdmin(superviseur = false): Promise<Admin> {
  const admin = await adminCourant();
  if (!admin) redirect("/admin/deconnexion?raison=expire");
  if (superviseur && admin.role !== "superviseur") redirect("/admin");
  return admin;
}
