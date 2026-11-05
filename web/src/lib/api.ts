import "server-only";

// Client HTTP vers la plateforme. Il ne s'exécute que côté serveur : les jetons ne passent jamais par le navigateur.
const BASE = (process.env.PLATEFORME_URL ?? "http://localhost:3000").replace(/\/$/, "");
// Secret qui prouve à la plateforme que l'appel vient de ce serveur web : elle accepte alors l'adresse du client
// qu'il lui transmet, pour appliquer ses limites par utilisateur et non pour le serveur web tout entier.
const SECRET_BFF = process.env.JETON_BFF;

export class ErreurApi extends Error {
  constructor(
    public statut: number,
    message: string,
  ) {
    super(message);
  }
}

export interface OptionsAppel {
  corps?: unknown;
  /** Jeton d'un acteur (pharmacie ou prêteur). */
  jeton?: string;
  /** Jeton d'un administrateur. */
  jetonAdmin?: string;
  /** Clé d'idempotence : un renvoi avec la même clé n'est exécuté qu'une fois. */
  cle?: string;
  /** Secret d'amorçage, pour créer le premier superviseur. */
  amorcage?: string;
  /** Adresse de l'utilisateur final, pour les limites d'abus des routes publiques. */
  adresseClient?: string;
}

export async function appeler<T>(methode: "GET" | "POST" | "PUT", chemin: string, o: OptionsAppel = {}): Promise<T> {
  const entetes: Record<string, string> = { accept: "application/json" };
  if (o.corps !== undefined) entetes["content-type"] = "application/json";
  if (o.jeton) entetes.authorization = `Bearer ${o.jeton}`;
  if (o.jetonAdmin) entetes["x-jeton-admin"] = o.jetonAdmin;
  if (o.cle) entetes["idempotency-key"] = o.cle;
  if (o.amorcage) entetes["x-jeton-amorcage"] = o.amorcage;
  if (SECRET_BFF) {
    entetes["x-jeton-bff"] = SECRET_BFF;
    if (o.adresseClient) entetes["x-forwarded-for"] = o.adresseClient;
  }

  let reponse: Response;
  try {
    reponse = await fetch(BASE + chemin, {
      method: methode,
      headers: entetes,
      body: o.corps === undefined ? undefined : JSON.stringify(o.corps),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ErreurApi(0, "Le service est momentanément indisponible. Réessayez dans un instant.");
  }

  const json = (await reponse.json().catch(() => null)) as { erreur?: string } | null;
  if (!reponse.ok) {
    const message = json?.erreur ?? (reponse.status >= 500 ? "Erreur du service, réessayez." : "Requête refusée.");
    throw new ErreurApi(reponse.status, message);
  }
  return json as T;
}
