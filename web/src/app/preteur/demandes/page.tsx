import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { ListeDemandes } from "@/components/demandes";
import { Onglets } from "@/components/navigation";
import { EnTete, EtatVide } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { maintenant } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";
import type { EtatDemande } from "@/lib/types";

export const metadata: Metadata = { title: "Demandes" };

const GROUPES: { id: string; libelle: string; etats: EtatDemande[] | null }[] = [
  { id: "traiter", libelle: "À traiter", etats: ["SOUMISE"] },
  { id: "livrer", libelle: "À livrer", etats: ["VALIDEE"] },
  { id: "confirmer", libelle: "Livrées", etats: ["LIVREE"] },
  { id: "rembourser", libelle: "À rembourser", etats: ["RECEPTIONNEE"] },
  { id: "terminees", libelle: "Terminées", etats: ["CLOTUREE", "REFUSEE", "ANNULEE", "EXPIREE"] },
  { id: "toutes", libelle: "Toutes", etats: null },
];

export default async function DemandesPreteur({ searchParams }: PageProps<"/preteur/demandes">) {
  await exigerActeur("preteur");
  const { filtre } = await searchParams;
  const actif = GROUPES.find((g) => g.id === filtre)?.id ?? "traiter";
  const demandes = (await plateforme.demandes()).sort((a, b) => b.creeLe - a.creeLe);
  const pourGroupe = (etats: EtatDemande[] | null) => (etats ? demandes.filter((d) => etats.includes(d.etat)) : demandes);
  const liste = pourGroupe(GROUPES.find((g) => g.id === actif)!.etats);
  const maintenantMs = maintenant();

  return (
    <>
      <EnTete titre="Demandes" />
      <Onglets
        actif={actif}
        onglets={GROUPES.map((g) => ({ id: g.id, libelle: g.libelle, nombre: pourGroupe(g.etats).length, href: `/preteur/demandes?filtre=${g.id}` }))}
      />
      {liste.length === 0 ? (
        <EtatVide icone={Inbox} titre="Rien à afficher ici">{actif === "traiter" ? "Aucune demande n'attend votre réponse." : "Aucune demande dans cette catégorie."}</EtatVide>
      ) : (
        <ListeDemandes demandes={liste} vue="preteur" maintenant={maintenantMs} base="/preteur/demandes" />
      )}
    </>
  );
}
