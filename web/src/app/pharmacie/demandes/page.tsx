import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { ListeDemandes } from "@/components/demandes";
import { Onglets } from "@/components/navigation";
import { EnTete, EtatVide, LienBouton } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { maintenant } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";
import type { EtatDemande } from "@/lib/types";

export const metadata: Metadata = { title: "Mes demandes" };

const GROUPES: { id: string; libelle: string; etats: EtatDemande[] | null }[] = [
  { id: "suivre", libelle: "À suivre", etats: ["SOUMISE", "VALIDEE", "LIVREE", "RECEPTIONNEE"] },
  { id: "terminees", libelle: "Remboursées", etats: ["CLOTUREE"] },
  { id: "autres", libelle: "Refusées ou annulées", etats: ["REFUSEE", "ANNULEE", "EXPIREE"] },
  { id: "toutes", libelle: "Toutes", etats: null },
];

export default async function MesDemandes({ searchParams }: PageProps<"/pharmacie/demandes">) {
  await exigerActeur("pharmacie");
  const { filtre } = await searchParams;
  const actif = GROUPES.find((g) => g.id === filtre)?.id ?? "suivre";
  const demandes = (await plateforme.demandes()).sort((a, b) => b.creeLe - a.creeLe);
  const pourGroupe = (etats: EtatDemande[] | null) => (etats ? demandes.filter((d) => etats.includes(d.etat)) : demandes);
  const liste = pourGroupe(GROUPES.find((g) => g.id === actif)!.etats);
  const maintenantMs = maintenant();

  return (
    <>
      <EnTete titre="Mes demandes" actions={
          <LienBouton href="/pharmacie/demandes/nouvelle">
            <Plus className="size-4" aria-hidden />
            Nouvelle demande
          </LienBouton>
        } />
      <Onglets
        actif={actif}
        onglets={GROUPES.map((g) => ({ id: g.id, libelle: g.libelle, nombre: pourGroupe(g.etats).length, href: `/pharmacie/demandes?filtre=${g.id}` }))}
      />
      {liste.length === 0 ? (
        <EtatVide icone={FileText} titre="Rien à afficher ici">
          {demandes.length === 0 ? "Vous n'avez pas encore fait de demande." : "Aucune demande dans cette catégorie."}
        </EtatVide>
      ) : (
        <ListeDemandes demandes={liste} vue="pharmacie" maintenant={maintenantMs} base="/pharmacie/demandes" />
      )}
    </>
  );
}
