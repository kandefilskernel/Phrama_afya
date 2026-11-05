import type { Metadata } from "next";
import Link from "next/link";
import { Onglets } from "@/components/navigation";
import { Badge, EnTete, EtatVide } from "@/components/ui";
import { exigerAdmin } from "@/lib/auth";
import { ROLES, STATUTS_COMPTE, dateCourte } from "@/lib/format";
import { administration } from "@/lib/plateforme";
import type { StatutCompte } from "@/lib/types";

export const metadata: Metadata = { title: "Comptes" };

const ONGLETS: { id: StatutCompte; libelle: string }[] = [
  { id: "EN_ATTENTE", libelle: "À vérifier" },
  { id: "ACTIF", libelle: "Actifs" },
  { id: "SUSPENDU", libelle: "Suspendus" },
  { id: "REJETE", libelle: "Rejetés" },
];

export default async function Comptes({ searchParams }: PageProps<"/admin">) {
  await exigerAdmin();
  const { statut } = await searchParams;
  const actif = ONGLETS.find((o) => o.id === statut)?.id ?? "EN_ATTENTE";
  const tous = await administration.acteurs();
  const liste = tous.filter((a) => a.statut === actif).sort((a, b) => b.inscritLe - a.inscritLe);

  return (
    <>
      <EnTete
        titre="Comptes"
        sousTitre="Vérifiez l'agrément des pharmacies et des prêteurs avant de les activer. Chaque décision est enregistrée à votre nom."
      />
      <Onglets
        actif={actif}
        onglets={ONGLETS.map((o) => ({ id: o.id, libelle: o.libelle, nombre: tous.filter((a) => a.statut === o.id).length, href: `/admin?statut=${o.id}` }))}
      />
      {liste.length === 0 ? (
        <EtatVide titre="Aucun compte dans cette catégorie">{actif === "EN_ATTENTE" ? "Toutes les inscriptions ont été traitées." : undefined}</EtatVide>
      ) : (
        <ul className="space-y-3">
          {liste.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/acteurs/${a.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-marque-500">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{a.nom}</p>
                    <p className="text-xs text-slate-500">
                      {ROLES[a.role]} · inscrit le {dateCourte(a.inscritLe)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge ton={STATUTS_COMPTE[a.statut].ton}>{STATUTS_COMPTE[a.statut].libelle}</Badge>
                    {a.statut === "EN_ATTENTE" && <Badge ton={a.telephoneVerifie ? "ok" : "attente"}>{a.telephoneVerifie ? "Téléphone vérifié" : "Téléphone non vérifié"}</Badge>}
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-700">Agrément : {a.numeroAgrement ?? "—"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
