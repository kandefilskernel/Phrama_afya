import type { EtatDemande, RoleActeur, RolePreteur, StatutCompte } from "./types";

const FUSEAU = "Africa/Kinshasa";

export function usd(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const entier = cents % 100 === 0;
  return `${(cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: entier ? 0 : 2,
    maximumFractionDigits: 2,
  })} USD`;
}

export function dateCourte(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: FUSEAU });
}

export function dateHeure(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("fr-FR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: FUSEAU,
  });
}

/** Jours entiers entre maintenant et une échéance (négatif si dépassée). */
export function joursRestants(echeanceLe: number | null, maintenant: number): number | null {
  if (!echeanceLe) return null;
  return Math.ceil((echeanceLe - maintenant) / 86_400_000);
}

export const ETATS: Record<EtatDemande, { libelle: string; ton: "neutre" | "attente" | "ok" | "alerte" | "fin" }> = {
  SOUMISE: { libelle: "En attente du prêteur", ton: "attente" },
  VALIDEE: { libelle: "Validée, livraison à venir", ton: "ok" },
  LIVREE: { libelle: "Livrée, à confirmer", ton: "attente" },
  RECEPTIONNEE: { libelle: "Reçue, à rembourser", ton: "ok" },
  CLOTUREE: { libelle: "Remboursée", ton: "fin" },
  REFUSEE: { libelle: "Refusée", ton: "alerte" },
  ANNULEE: { libelle: "Annulée", ton: "neutre" },
  EXPIREE: { libelle: "Expirée sans réponse", ton: "neutre" },
};

export const ROLES: Record<RoleActeur, string> = {
  pharmacie: "Pharmacie",
  depot: "Dépôt pharmaceutique",
  imf: "Institution de microfinance",
  banque: "Banque",
};

export const TYPES_PRETEUR: Record<RolePreteur, string> = {
  depot: "Dépôt",
  imf: "IMF",
  banque: "Banque",
};

export const STATUTS_COMPTE: Record<StatutCompte, { libelle: string; ton: "neutre" | "attente" | "ok" | "alerte" }> = {
  EN_ATTENTE: { libelle: "En attente", ton: "attente" },
  ACTIF: { libelle: "Actif", ton: "ok" },
  REJETE: { libelle: "Rejeté", ton: "alerte" },
  SUSPENDU: { libelle: "Suspendu", ton: "alerte" },
};

export const ACTIONS_JOURNAL: Record<string, string> = {
  amorcer: "a créé le premier superviseur",
  "creer-admin": "a créé l'administrateur",
  "desactiver-admin": "a désactivé l'administrateur",
  "jeton-admin": "a renouvelé le jeton de",
  approuver: "a approuvé",
  rejeter: "a rejeté",
  suspendre: "a suspendu",
  reactiver: "a réactivé",
  "reemettre-jeton": "a réémis le jeton de",
};

/** Espace d'accueil selon le rôle. */
export const espaceDe = (role: RoleActeur) => (role === "pharmacie" ? "/pharmacie" : "/preteur");

/** L'heure du serveur, isolée ici pour garder les pages lisibles. */
export const maintenant = () => Date.now();
