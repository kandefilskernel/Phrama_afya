import "server-only";
import { headers } from "next/headers";

/**
 * Adresse de l'utilisateur, telle que la renseigne le serveur frontal (X-Forwarded-For).
 * Vide si le site est joint directement, sans serveur frontal : la plateforme applique alors ses limites
 * à tous les utilisateurs ensemble. En production, placez un serveur frontal qui ÉCRASE cet en-tête.
 */
export async function adresseClient(): Promise<string | undefined> {
  const premiere = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  return premiere || undefined;
}
