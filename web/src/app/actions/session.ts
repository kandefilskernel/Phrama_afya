"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { administration, plateforme } from "@/lib/plateforme";
import { fermerSession, jetonDeSession, memoriserTelephone, oublierTelephone, ouvrirSession, telephoneMemorise } from "@/lib/session";
import { champ, enEtat } from "@/lib/erreurs";
import { normaliserTelephone } from "@/lib/telephone";
import { ErreurApi } from "@/lib/api";
import type { EtatAction } from "@/components/formulaires";
import type { RoleActeur } from "@/lib/types";

const ROLES: RoleActeur[] = ["pharmacie", "depot", "imf", "banque"];

/** Inscription : ouvre une session pour confirmer le téléphone. Les connexions suivantes se font par SMS. */
export async function inscription(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const role = champ(donnees, "role") as RoleActeur;
  if (!ROLES.includes(role)) return { erreur: "Choisissez votre type d'établissement." };
  const telephone = normaliserTelephone(champ(donnees, "telephone"));
  if (!telephone) return { erreur: "Numéro de téléphone invalide. Exemple : +243 81 234 5678 ou 0812345678." };
  const adresse = champ(donnees, "adresse");
  try {
    const compte = await plateforme.inscrire({
      role,
      nom: champ(donnees, "nom"),
      telephone,
      numeroAgrement: champ(donnees, "numeroAgrement"),
      ...(adresse ? { adresse } : {}),
    });
    await ouvrirSession("acteur", compte.token);
  } catch (e) {
    return enEtat(e);
  }
  redirect("/compte");
}

// ---- Connexion par SMS ----------------------------------------------------------------------
/** Étape 1 : le numéro. La réponse est la même que le numéro ait un compte ou non. */
export async function demanderCode(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const telephone = normaliserTelephone(champ(donnees, "telephone"));
  if (!telephone) return { erreur: "Numéro de téléphone invalide. Exemple : +243 81 234 5678 ou 0812345678." };
  try {
    await plateforme.demanderCodeConnexion(telephone);
  } catch (e) {
    return enEtat(e);
  }
  await memoriserTelephone(telephone);
  redirect("/connexion/code");
}

/** Étape 2 : le code reçu par SMS. Le numéro vient du cookie posé à l'étape 1. */
export async function validerCodeConnexion(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const telephone = await telephoneMemorise();
  if (!telephone) redirect("/connexion");
  const code = champ(donnees, "code").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { erreur: "Le code comporte 6 chiffres." };
  try {
    const session = await plateforme.verifierCodeConnexion(telephone, code);
    await ouvrirSession("acteur", session.token, session.expireLe);
  } catch (e) {
    return enEtat(e);
  }
  await oublierTelephone();
  redirect("/compte");
}

export async function renvoyerCodeConnexion(): Promise<EtatAction> {
  const telephone = await telephoneMemorise();
  if (!telephone) redirect("/connexion");
  try {
    await plateforme.demanderCodeConnexion(telephone);
  } catch (e) {
    return enEtat(e);
  }
  // Même message que le numéro ait un compte ou non, et même si le renvoi est trop rapproché du précédent.
  return { succes: "Si ce numéro correspond à un compte, un code vient de vous être envoyé. Comptez une minute avant de redemander." };
}

export async function changerNumero() {
  await oublierTelephone();
  redirect("/connexion");
}

// ---- Connexion par jeton (intégrations, dépannage) -------------------------------------------
export async function connexion(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const jeton = champ(donnees, "jeton");
  if (!jeton) return { erreur: "Saisissez votre jeton d'accès." };
  try {
    await plateforme.moi(jeton);
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 401) return { erreur: "Jeton d'accès invalide. Vérifiez-le ou contactez l'équipe pour en obtenir un nouveau." };
    return enEtat(e);
  }
  await ouvrirSession("acteur", jeton);
  redirect("/compte");
}

export async function connexionAdmin(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  const jeton = champ(donnees, "jeton");
  if (!jeton) return { erreur: "Saisissez votre jeton d'administrateur." };
  try {
    await administration.moi(jeton);
  } catch (e) {
    if (e instanceof ErreurApi && (e.statut === 401 || e.statut === 404)) return { erreur: "Jeton d'administrateur invalide ou compte désactivé." };
    return enEtat(e);
  }
  await ouvrirSession("admin", jeton);
  redirect("/admin");
}

// ---- Compte ---------------------------------------------------------------------------------
export async function verifierTelephone(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  try {
    await plateforme.verifierTelephone(champ(donnees, "code").replace(/\s/g, ""));
  } catch (e) {
    return enEtat(e);
  }
  revalidatePath("/compte");
  redirect("/compte");
}

export async function renvoyerCode(): Promise<EtatAction> {
  try {
    await plateforme.renvoyerCode();
    return { succes: "Un nouveau code vous a été envoyé par SMS." };
  } catch (e) {
    return enEtat(e);
  }
}

/** Ferme la session côté serveur avant d'effacer le cookie : un jeton copié ailleurs ne vaut plus rien. */
export async function quitter() {
  const jeton = await jetonDeSession("acteur");
  if (jeton) await plateforme.deconnecter(jeton).catch(() => undefined); // même si la plateforme ne répond pas, on se déconnecte ici
  await fermerSession("acteur");
  redirect("/connexion");
}

export async function quitterAdmin() {
  await fermerSession("admin");
  redirect("/admin/connexion");
}
