import type { ReactNode } from "react";
import { quitter } from "@/app/actions/session";
import { CadreEspace } from "@/components/espace";
import { exigerActeur } from "@/lib/auth";
import { ROLES } from "@/lib/format";

export default async function LayoutPreteur({ children }: { children: ReactNode }) {
  const acteur = await exigerActeur("preteur");
  return (
    <CadreEspace
      nom={acteur.nom}
      sousTitre={ROLES[acteur.role]}
      deconnexion={quitter}
      liens={[
        { href: "/preteur", libelle: "Tableau de bord", court: "Accueil", icone: "accueil", exact: true },
        { href: "/preteur/demandes", libelle: "Demandes", icone: "demandes" },
        { href: "/preteur/pharmacies", libelle: "Pharmacies", icone: "pharmacies" },
        { href: "/preteur/conditions", libelle: "Mes conditions", court: "Conditions", icone: "conditions" },
      ]}
    >
      {children}
    </CadreEspace>
  );
}
