"use server";

import { revalidatePath } from "next/cache";
import { plateforme } from "@/lib/plateforme";
import { champ, enEtat } from "@/lib/erreurs";
import { lireEntierPositif } from "@/lib/montant";
import type { EtatAction } from "@/components/formulaires";
import type { Conditions } from "@/lib/types";

const entier = (donnees: FormData, nom: string, libelle: string): number | string => {
  const brut = champ(donnees, nom);
  if (brut === "0") return 0;
  const n = lireEntierPositif(brut);
  return n === null ? `${libelle} : entrez un nombre entier.` : n;
};

export async function enregistrerConditions(_: EtatAction, donnees: FormData): Promise<EtatAction> {
  // Paliers saisis « 20, 40, 80 » : séparés par des virgules, points-virgules ou espaces.
  const paliers = champ(donnees, "paliersUSD")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(lireEntierPositif);
  if (paliers.length === 0 || paliers.some((p) => p === null)) {
    return { erreur: "Paliers : entrez des montants entiers en dollars, séparés par des virgules (exemple : 20, 40, 80)." };
  }

  const champs = {
    seriesRequises: entier(donnees, "seriesRequises", "Remboursements pour monter d'un palier"),
    graceJours: entier(donnees, "graceJours", "Tolérance de retard"),
    retardGraveJours: entier(donnees, "retardGraveJours", "Retard grave"),
    delaiDefautJours: entier(donnees, "delaiDefautJours", "Délai par défaut"),
    delaiMaxJours: entier(donnees, "delaiMaxJours", "Délai maximum"),
    expirationHeures: entier(donnees, "expirationHeures", "Délai de réponse"),
  };
  for (const v of Object.values(champs)) if (typeof v === "string") return { erreur: v };

  try {
    await plateforme.definirConditions({ paliersUSD: paliers as number[], ...(champs as Omit<Conditions, "paliersUSD">) });
  } catch (e) {
    return enEtat(e);
  }
  revalidatePath("/preteur", "layout");
  revalidatePath("/pharmacie", "layout");
  return { succes: "Conditions enregistrées. Elles s'appliquent aux prochaines décisions ; les crédits déjà accordés gardent leurs conditions." };
}
