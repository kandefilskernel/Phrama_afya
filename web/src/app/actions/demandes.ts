"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { plateforme } from "@/lib/plateforme";
import { champ, enEtat } from "@/lib/erreurs";
import { lireEntierPositif, lireMontantUSD } from "@/lib/montant";
import type { EtatAction } from "@/components/formulaires";

function rafraichir(id: string) {
  revalidatePath("/pharmacie", "layout");
  revalidatePath("/preteur", "layout");
  revalidatePath(`/pharmacie/demandes/${id}`);
  revalidatePath(`/preteur/demandes/${id}`);
}

// ---- Pharmacie ------------------------------------------------------------------------------
export async function soumettreDemande(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const produits = donnees.getAll("produit").map((v) => String(v).trim());
  const quantites = donnees.getAll("quantite").map((v) => String(v).trim());
  const lignes: { produit: string; quantite: number }[] = [];
  for (let i = 0; i < produits.length; i++) {
    if (!produits[i] && !quantites[i]) continue; // ligne laissée vide
    const quantite = lireEntierPositif(quantites[i] ?? "");
    if (!produits[i]) return { erreur: `Ligne ${i + 1} : indiquez le produit.` };
    if (quantite === null) return { erreur: `Ligne ${i + 1} : la quantité doit être un nombre entier supérieur à 0.` };
    lignes.push({ produit: produits[i], quantite });
  }
  if (lignes.length === 0) return { erreur: "Ajoutez au moins un produit." };
  const creancierId = champ(donnees, "creancierId");
  if (!creancierId) return { erreur: "Choisissez un prêteur." };
  const note = champ(donnees, "note");

  let id: string;
  try {
    id = (await plateforme.soumettre({ creancierId, lignes, ...(note ? { note } : {}) })).id;
  } catch (e) {
    return enEtat(e);
  }
  revalidatePath("/pharmacie", "layout");
  redirect(`/pharmacie/demandes/${id}`);
}

export async function confirmerReception(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  try {
    await plateforme.agir(id, "receptionner");
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Réception confirmée. Le délai de remboursement a démarré." };
}

export async function annulerDemande(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  try {
    await plateforme.agir(id, "annuler");
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Demande annulée." };
}

// ---- Prêteur --------------------------------------------------------------------------------
export async function validerDemande(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  const valeurUSD = lireMontantUSD(champ(donnees, "valeurUSD"));
  if (valeurUSD === null) return { erreur: "Montant invalide. Exemple : 18 ou 18,50." };
  const delai = champ(donnees, "delaiAccordeJours");
  const corps: Record<string, unknown> = { valeurUSD };
  if (delai) {
    const jours = lireEntierPositif(delai);
    if (jours === null) return { erreur: "Le délai doit être un nombre entier de jours." };
    corps.delaiAccordeJours = jours;
  }
  try {
    await plateforme.agir(id, "valider", corps);
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Demande validée. La pharmacie est prévenue par SMS." };
}

export async function refuserDemande(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  const motif = champ(donnees, "motif");
  if (motif.length < 3) return { erreur: "Indiquez le motif du refus (la pharmacie le recevra par SMS)." };
  try {
    await plateforme.agir(id, "refuser", { motif });
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Demande refusée." };
}

export async function marquerLivree(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  try {
    await plateforme.agir(id, "livrer");
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Marquée comme livrée. La pharmacie doit maintenant confirmer la réception." };
}

/** La clé d'idempotence vient du formulaire : un double clic ou un renvoi n'enregistre le remboursement qu'une fois. */
export async function enregistrerRemboursement(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  const montantUSD = lireMontantUSD(champ(donnees, "montantUSD"));
  if (montantUSD === null) return { erreur: "Montant invalide. Exemple : 6 ou 6,50." };
  const cle = champ(donnees, "cle") || randomUUID();
  try {
    await plateforme.agir(id, "rembourser", { montantUSD }, cle);
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Remboursement enregistré." };
}
