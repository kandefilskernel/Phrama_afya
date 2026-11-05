import type { ReactNode } from "react";
import { quitter } from "@/app/actions/session";
import { CadreEspace } from "@/components/espace";
import { exigerActeur } from "@/lib/auth";

export default async function LayoutPharmacie({ children }: { children: ReactNode }) {
  const acteur = await exigerActeur("pharmacie");
  return (
    <CadreEspace
      nom={acteur.nom}
      sousTitre="Pharmacie"
      deconnexion={quitter}
      liens={[
        { href: "/pharmacie", libelle: "Tableau de bord", court: "Accueil", icone: "accueil", exact: true },
        { href: "/pharmacie/demandes", libelle: "Mes demandes", court: "Demandes", icone: "demandes", exact: true },
        { href: "/pharmacie/demandes/nouvelle", libelle: "Nouvelle demande", court: "Nouvelle", icone: "nouvelle" },
        { href: "/pharmacie/preteurs", libelle: "Prêteurs", icone: "preteurs" },
      ]}
    >
      {children}
    </CadreEspace>
  );
}
