"use server";

import { revalidatePath } from "next/cache";
import { administration } from "@/lib/plateforme";
import { champ, enEtat } from "@/lib/erreurs";
import { normaliserTelephone } from "@/lib/telephone";
import type { EtatAction } from "@/components/formulaires";

function rafraichir(id?: string) {
  revalidatePath("/admin", "layout");
  if (id) revalidatePath(`/admin/acteurs/${id}`);
}

// ---- Comptes des acteurs --------------------------------------------------------------------
export async function approuverCompte(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  try {
    await administration.decision(id, "approuver");
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Compte approuvé. L'acteur est prévenu par SMS." };
}

export async function rejeterCompte(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  const motif = champ(donnees, "motif");
  if (motif.length < 3) return { erreur: "Indiquez le motif : l'acteur le recevra par SMS." };
  try {
    await administration.decision(id, "rejeter", motif);
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Inscription rejetée. L'acteur est prévenu par SMS." };
}

export async function suspendreCompte(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  const motif = champ(donnees, "motif");
  if (motif.length < 3) return { erreur: "Indiquez le motif de la suspension." };
  try {
    await administration.decision(id, "suspendre", motif);
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Compte suspendu." };
}

export async function reactiverCompte(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  try {
    await administration.decision(id, "reactiver");
  } catch (e) {
    return enEtat(e);
  }
  rafraichir(id);
  return { succes: "Compte réactivé." };
}

/** Réservé aux superviseurs : le nouveau jeton permet d'agir au nom du compte, à remettre en main propre. */
export async function reemettreJetonActeur(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const id = champ(donnees, "id");
  try {
    const { token } = await administration.reemettreJetonActeur(id);
    rafraichir(id);
    return { succes: "Jeton réémis. L'ancien ne fonctionne plus.", jeton: { libelle: "Nouveau jeton d'accès du compte", valeur: token } };
  } catch (e) {
    return enEtat(e);
  }
}

// ---- Équipe d'administration ----------------------------------------------------------------
export async function creerAdministrateur(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const telephone = normaliserTelephone(champ(donnees, "telephone"));
  if (!telephone) return { erreur: "Numéro de téléphone invalide. Exemple : +243 99 900 0002." };
  try {
    const admin = await administration.creerAdministrateur({ nom: champ(donnees, "nom"), telephone, role: champ(donnees, "role") });
    rafraichir();
    return { succes: `Compte créé pour ${admin.nom}.`, jeton: { libelle: `Jeton de ${admin.nom}`, valeur: admin.token } };
  } catch (e) {
    return enEtat(e);
  }
}

export async function desactiverAdministrateur(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const motif = champ(donnees, "motif");
  if (motif.length < 3) return { erreur: "Indiquez le motif de la désactivation." };
  try {
    await administration.desactiverAdministrateur(champ(donnees, "id"), motif);
  } catch (e) {
    return enEtat(e);
  }
  rafraichir();
  return { succes: "Administrateur désactivé : il perd l'accès immédiatement." };
}

export async function reemettreJetonAdministrateur(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  try {
    const { token } = await administration.reemettreJetonAdministrateur(champ(donnees, "id"));
    return { succes: "Jeton réémis. L'ancien ne fonctionne plus.", jeton: { libelle: "Nouveau jeton de l'administrateur", valeur: token } };
  } catch (e) {
    return enEtat(e);
  }
}
