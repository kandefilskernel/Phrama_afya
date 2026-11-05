import type { ReactNode } from "react";
import { quitterAdmin } from "@/app/actions/session";
import { CadreEspace } from "@/components/espace";
import type { LienNav } from "@/components/navigation";
import { exigerAdmin } from "@/lib/auth";

export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigerAdmin();
  const liens: LienNav[] = [{ href: "/admin", libelle: "Comptes", icone: "comptes", exact: true }];
  // Équipe et journal : réservés aux superviseurs.
  if (admin.role === "superviseur") {
    liens.push({ href: "/admin/administrateurs", libelle: "Équipe", icone: "equipe" }, { href: "/admin/journal", libelle: "Journal", icone: "journal" });
  }
  return (
    <CadreEspace nom={admin.nom} sousTitre={admin.role === "superviseur" ? "Superviseur" : "Agent"} deconnexion={quitterAdmin} liens={liens}>
      {children}
    </CadreEspace>
  );
}
