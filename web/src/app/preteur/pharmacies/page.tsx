import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Carte, EnTete, EtatVide, Jauge } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { usd } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Pharmacies" };

export default async function Pharmacies() {
  await exigerActeur("preteur");
  const demandes = await plateforme.demandes();

  // Une ligne par pharmacie qui vous a déjà adressé une demande.
  const parPharmacie = new Map<string, { nom: string; demandes: typeof demandes }>();
  for (const d of demandes) {
    const e = parPharmacie.get(d.pharmacieId) ?? { nom: d.pharmacieNom ?? "Pharmacie", demandes: [] };
    e.demandes.push(d);
    parPharmacie.set(d.pharmacieId, e);
  }
  const lignes = await Promise.all(
    [...parPharmacie.entries()].map(async ([id, p]) => ({ id, ...p, credit: await plateforme.creditPharmacieChezPreteur(id) })),
  );
  lignes.sort((a, b) => Number(b.credit.bloque) - Number(a.credit.bloque) || a.nom.localeCompare(b.nom, "fr"));

  return (
    <>
      <EnTete titre="Pharmacies" sousTitre="Le plafond et l'historique de remboursement de chaque pharmacie, calculés d'après vos propres conditions." />
      {lignes.length === 0 ? (
        <EtatVide titre="Aucune pharmacie pour le moment">Les pharmacies qui vous adressent une demande apparaîtront ici.</EtatVide>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lignes.map(({ id, nom, demandes: ds, credit: c }) => {
            const remboursees = ds.filter((d) => d.etat === "CLOTUREE").length;
            const ratio = c.plafondCents > 0 ? c.encoursCents / c.plafondCents : 0;
            const premiere = ds.find((d) => d.etat === "SOUMISE") ?? ds[0];
            return (
              <Carte key={id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{nom}</h2>
                  {c.bloque ? <Badge ton="alerte">Retard en cours</Badge> : <Badge ton="ok">Palier {c.palier + 1}</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {ds.length} demande{ds.length > 1 ? "s" : ""} · {remboursees} remboursée{remboursees > 1 ? "s" : ""}
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Disponible</p>
                    <p className="text-xl font-bold text-slate-900">{usd(c.disponibleCents)}</p>
                  </div>
                  <p className="text-right text-xs text-slate-500">
                    plafond <strong className="text-slate-800">{usd(c.plafondCents)}</strong>
                  </p>
                </div>
                <div className="mt-2">
                  <Jauge valeur={c.encoursCents} max={c.plafondCents} ton={c.bloque ? "alerte" : ratio >= 0.85 ? "attention" : "ok"} libelle={`Plafond utilisé par ${nom}`} />
                  <p className="mt-1 text-xs text-slate-500">
                    {usd(c.encoursCents)} en cours · série à temps {c.serieEnCours}/{c.serieRequise}
                  </p>
                </div>
                {premiere && (
                  <Link href={`/preteur/demandes/${premiere.id}`} className="mt-3 inline-block text-sm font-semibold text-marque-700 underline">
                    Voir la dernière demande
                  </Link>
                )}
              </Carte>
            );
          })}
        </div>
      )}
    </>
  );
}
