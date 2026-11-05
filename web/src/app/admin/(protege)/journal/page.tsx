import type { Metadata } from "next";
import Link from "next/link";
import { Carte, EnTete, EtatVide } from "@/components/ui";
import { exigerAdmin } from "@/lib/auth";
import { ACTIONS_JOURNAL, dateHeure } from "@/lib/format";
import { administration } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Journal" };

export default async function Journal({ searchParams }: PageProps<"/admin/journal">) {
  await exigerAdmin(true);
  const { adminId, cibleId } = await searchParams;
  const filtre = {
    ...(typeof adminId === "string" && adminId ? { adminId } : {}),
    ...(typeof cibleId === "string" && cibleId ? { cibleId } : {}),
  };
  const [entrees, equipe] = await Promise.all([administration.journal(filtre), administration.administrateurs()]);

  return (
    <>
      <EnTete titre="Journal" sousTitre="Qui a fait quoi, quand et pourquoi. Les plus récentes décisions d'abord." />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Filtrer par administrateur :</span>
        <Link href="/admin/journal" className={`rounded-full border px-3 py-1 ${!filtre.adminId ? "border-marque-600 bg-marque-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
          Tous
        </Link>
        {equipe.map((a) => (
          <Link
            key={a.id}
            href={`/admin/journal?adminId=${a.id}`}
            className={`rounded-full border px-3 py-1 ${filtre.adminId === a.id ? "border-marque-600 bg-marque-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}
          >
            {a.nom}
          </Link>
        ))}
        {filtre.cibleId && (
          <Link href="/admin/journal" className="ml-2 text-marque-700 underline">
            Retirer le filtre par compte
          </Link>
        )}
      </div>

      {entrees.length === 0 ? (
        <EtatVide titre="Aucune entrée">Rien à afficher pour ce filtre.</EtatVide>
      ) : (
        <Carte className="p-0 sm:p-0">
          <ul className="divide-y divide-slate-100">
            {entrees.map((e, i) => (
              <li key={e.id ?? i} className="px-4 py-3">
                <p className="text-sm text-slate-900">
                  <strong>{e.par.nom}</strong> {ACTIONS_JOURNAL[e.action] ?? e.action}{" "}
                  <Link href={`/admin/journal?cibleId=${e.cibleId}`} className="font-semibold text-marque-700 underline">
                    {e.cibleNom}
                  </Link>
                </p>
                {e.motif && <p className="text-sm text-slate-600">Motif : {e.motif}</p>}
                <p className="text-xs text-slate-500">{dateHeure(e.le)}</p>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </>
  );
}
