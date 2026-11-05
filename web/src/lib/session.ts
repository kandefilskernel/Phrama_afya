import "server-only";
import { cookies } from "next/headers";

// Le jeton de l'utilisateur vit dans un cookie httpOnly : le JavaScript du navigateur ne peut pas le lire.
// Deux sessions indépendantes : un acteur (pharmacie ou prêteur) et un administrateur.
export type TypeSession = "acteur" | "admin";

const NOMS: Record<TypeSession, string> = { acteur: "nuru_acteur", admin: "nuru_admin" };
const DUREE_S = 60 * 60 * 12; // 12 h : la session expire d'elle-même.

export async function jetonDeSession(type: TypeSession): Promise<string | undefined> {
  return (await cookies()).get(NOMS[type])?.value;
}

/** `expireLe` : fin de validité côté serveur (ms) ; le cookie ne dure jamais plus longtemps que la session. */
export async function ouvrirSession(type: TypeSession, jeton: string, expireLe?: number) {
  const restantS = expireLe ? Math.floor((expireLe - Date.now()) / 1000) : DUREE_S;
  (await cookies()).set(NOMS[type], jeton, {
    httpOnly: true,
    sameSite: "lax",
    // À activer derrière HTTPS (COOKIE_SECURE=1). Sinon le navigateur refuserait le cookie en HTTP local.
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: Math.max(1, Math.min(DUREE_S, restantS)),
  });
}

export async function fermerSession(type: TypeSession) {
  (await cookies()).delete(NOMS[type]);
}

// Connexion par SMS : le numéro saisi à la première étape est gardé le temps de recevoir le code. Il reste dans un
// cookie httpOnly plutôt que dans l'adresse de la page, pour ne pas apparaître dans l'historique ni les journaux.
const COOKIE_CONNEXION = "nuru_connexion";

export async function memoriserTelephone(telephone: string) {
  (await cookies()).set(COOKIE_CONNEXION, telephone, {
    httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "1", path: "/", maxAge: 10 * 60,
  });
}
export async function telephoneMemorise(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_CONNEXION)?.value;
}
export async function oublierTelephone() {
  (await cookies()).delete(COOKIE_CONNEXION);
}
