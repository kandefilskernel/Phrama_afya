import type { Metadata } from "next";
import { EnTete, EtatVide } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { plateforme } from "@/lib/plateforme";
import { FormulaireDemande, type OptionPreteur } from "./formulaire";

export const metadata: Metadata = { title: "Nouvelle demande" };

export default async function NouvelleDemande({ searchParams }: PageProps<"/pharmacie/demandes/nouvelle">) {
  const acteur = await exigerActeur("pharmacie");
  const { preteur: preselection } = await searchParams;
  const [creanciers, credits] = await Promise.all([plateforme.creanciers(), plateforme.creditChezLesPreteurs(acteur.id)]);

  const options: OptionPreteur[] = creanciers.map((c) => {
    const credit = credits.find((x) => x.creancierId === c.id);
    return {
      id: c.id,
      type: c.type,
      nom: c.nom,
      // Sans historique chez ce prêteur, le plafond de départ s'applique.
      disponibleCents: credit ? credit.disponibleCents : c.conditions.paliersUSD[0] * 100,
      bloque: credit?.bloque ?? false,
      delaiDefautJours: c.conditions.delaiDefautJours,
      expirationHeures: c.conditions.expirationHeures,
    };
  });

  return (
    <>
      <EnTete titre="Nouvelle demande" sousTitre="Choisissez un prêteur et listez les produits dont vous avez besoin." />
      {options.length === 0 ? (
        <EtatVide titre="Aucun prêteur disponible pour le moment">Les prêteurs agréés apparaîtront ici dès qu&apos;ils auront rejoint la plateforme.</EtatVide>
      ) : (
        <div className="max-w-2xl">
          <FormulaireDemande preteurs={options} preselection={typeof preselection === "string" ? preselection : undefined} />
        </div>
      )}
    </>
  );
}
