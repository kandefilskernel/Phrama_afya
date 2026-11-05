import Link from "next/link";
import { CalendarClock, Check, ChevronRight, ClipboardList, History, PackageSearch } from "lucide-react";
import { Alerte, Badge, Carte, Fiche, TitreCarte, cn } from "./ui";
import { ETATS, TYPES_PRETEUR, dateCourte, dateHeure, joursRestants, usd } from "@/lib/format";
import type { Demande, EtatDemande } from "@/lib/types";

export function BadgeEtat({ etat, enRetard }: { etat: EtatDemande; enRetard?: boolean }) {
  if (enRetard) return <Badge ton="alerte">En retard</Badge>;
  const e = ETATS[etat];
  return <Badge ton={e.ton}>{e.libelle}</Badge>;
}

/** Texte d'échéance : « dans 12 jours », « aujourd'hui », « en retard de 3 jours ». */
export function TexteEcheance({ echeanceLe, maintenant }: { echeanceLe: number | null; maintenant: number }) {
  const j = joursRestants(echeanceLe, maintenant);
  if (j === null) return <>—</>;
  const date = dateCourte(echeanceLe);
  if (j > 1) return <>{date} <span className="font-normal text-slate-500">(dans {j} jours)</span></>;
  if (j === 1) return <>{date} <span className="font-normal text-slate-500">(demain)</span></>;
  if (j === 0) return <>{date} <span className="font-normal text-amber-700">(aujourd&apos;hui)</span></>;
  return <span className="text-red-700">{date} <span className="font-normal">(en retard de {-j} jour{-j > 1 ? "s" : ""})</span></span>;
}

const ETAPES = ["Demande", "Validation", "Livraison", "Réception", "Remboursement"];
const POSITION: Partial<Record<EtatDemande, number>> = { SOUMISE: 0, VALIDEE: 1, LIVREE: 2, RECEPTIONNEE: 3, CLOTUREE: 5 };

/** Progression d'une demande en cinq étapes. Les demandes refusées, annulées ou expirées n'en ont pas. */
export function Etapes({ etat }: { etat: EtatDemande }) {
  const position = POSITION[etat];
  if (position === undefined) return null;
  return (
    <ol className="flex items-start" aria-label="Progression de la demande">
      {ETAPES.map((nom, i) => {
        const fait = i < position;
        const courant = i === position;
        return (
          <li key={nom} className="flex flex-1 flex-col items-center text-center" aria-current={courant ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1 rounded-full", i === 0 ? "invisible" : fait || courant ? "bg-marque-500" : "bg-slate-200")} />
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  fait && "bg-marque-600 text-white",
                  courant && "border-2 border-marque-600 bg-white text-marque-700 ring-4 ring-marque-100",
                  !fait && !courant && "border border-slate-200 bg-white text-slate-400",
                )}
              >
                {fait ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1 rounded-full", i === ETAPES.length - 1 ? "invisible" : fait ? "bg-marque-500" : "bg-slate-200")} />
            </div>
            <span className={cn("mt-2 text-[11px] leading-tight sm:text-xs", courant ? "font-semibold text-slate-900" : fait ? "font-medium text-slate-600" : "text-slate-400")}>
              {nom}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const resume = (d: Demande) => d.lignes.map((l) => `${l.quantite} × ${l.produit}`).join(" · ");

/** Une demande en carte : lisible et facile à toucher sur téléphone. */
function CarteDemande({ d, href, vue, maintenant }: { d: Demande; href: string; vue: "pharmacie" | "preteur"; maintenant: number }) {
  const autre = vue === "pharmacie" ? d.creancierNom : d.pharmacieNom;
  return (
    <li>
      <Link href={href} className="block rounded-xl border border-slate-200/80 bg-white p-4 shadow-carte transition-shadow hover:shadow-releve">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{autre ?? "—"}</p>
            <p className="text-xs text-slate-500">
              {vue === "pharmacie" && `${TYPES_PRETEUR[d.creancierType]} · `}
              {dateCourte(d.creeLe)}
            </p>
          </div>
          <BadgeEtat etat={d.etat} enRetard={d.enRetard} />
        </div>
        <p className="mt-2.5 line-clamp-2 text-sm text-slate-600">{resume(d)}</p>
        {d.valeurCents !== null && (
          <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3">
            <div>
              <p className="text-xs text-slate-500">{d.etat === "RECEPTIONNEE" ? "Reste dû" : "Montant"}</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{usd(d.etat === "RECEPTIONNEE" ? d.soldeCents : d.valeurCents)}</p>
            </div>
            {d.etat === "RECEPTIONNEE" && (
              <p className="text-right text-xs font-medium tabular-nums text-slate-700">
                <TexteEcheance echeanceLe={d.echeanceLe} maintenant={maintenant} />
              </p>
            )}
          </div>
        )}
      </Link>
    </li>
  );
}

/**
 * Liste de demandes : un tableau sur ordinateur (on compare d'un coup d'œil), des cartes sur téléphone.
 * Toute la ligne est cliquable.
 */
export function ListeDemandes({
  demandes, vue, maintenant, base,
}: {
  demandes: Demande[];
  vue: "pharmacie" | "preteur";
  maintenant: number;
  base: string;
}) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {demandes.map((d) => (
          <CarteDemande key={d.id} d={d} href={`${base}/${d.id}`} vue={vue} maintenant={maintenant} />
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-carte md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">{vue === "pharmacie" ? "Prêteur" : "Pharmacie"}</th>
              <th scope="col" className="px-3 py-3 font-medium">Produits</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Montant</th>
              <th scope="col" className="px-3 py-3 font-medium">Statut</th>
              <th scope="col" className="px-3 py-3 font-medium">Échéance</th>
              <th scope="col" className="w-10 px-3 py-3"><span className="sr-only">Ouvrir</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {demandes.map((d) => {
              const autre = vue === "pharmacie" ? d.creancierNom : d.pharmacieNom;
              return (
                <tr key={d.id} className="relative transition-colors hover:bg-marque-50/40">
                  <td className="px-5 py-3.5">
                    <Link href={`${base}/${d.id}`} className="font-semibold text-slate-900 after:absolute after:inset-0 after:content-['']">
                      {autre ?? "—"}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {vue === "pharmacie" && `${TYPES_PRETEUR[d.creancierType]} · `}
                      {dateCourte(d.creeLe)}
                    </p>
                  </td>
                  <td className="max-w-[18rem] px-3 py-3.5">
                    <p className="line-clamp-2 text-slate-600">{resume(d)}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                    {d.valeurCents === null ? <span className="font-normal text-slate-400">—</span> : usd(d.etat === "RECEPTIONNEE" ? d.soldeCents : d.valeurCents)}
                    {d.etat === "RECEPTIONNEE" && <p className="text-xs font-normal text-slate-500">reste dû</p>}
                  </td>
                  <td className="px-3 py-3.5">
                    <BadgeEtat etat={d.etat} enRetard={d.enRetard} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-slate-700 tabular-nums">
                    {d.etat === "RECEPTIONNEE" ? <TexteEcheance echeanceLe={d.echeanceLe} maintenant={maintenant} /> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3.5 text-slate-300">
                    <ChevronRight className="size-4" aria-hidden />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

const LIBELLES_ACTION: Record<string, string> = {
  soumettre: "Demande soumise",
  valider: "Validée par le prêteur",
  refuser: "Refusée par le prêteur",
  livrer: "Marquée comme livrée",
  receptionner: "Réception confirmée par la pharmacie",
  rembourser: "Remboursement enregistré",
  annuler: "Demande annulée",
  expirer: "Expirée sans réponse",
};

export function Historique({ d }: { d: Demande }) {
  return (
    <ol className="space-y-4 border-l-2 border-slate-100 pl-5">
      {[...d.historique].reverse().map((h, i) => (
        <li key={i} className="relative">
          <span className={cn("absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full ring-4 ring-white", i === 0 ? "bg-marque-600" : "bg-slate-300")} />
          <p className="text-sm font-medium text-slate-900">{LIBELLES_ACTION[h.action] ?? h.action}</p>
          <p className="text-xs text-slate-500">{dateHeure(h.le)}</p>
        </li>
      ))}
    </ol>
  );
}

function Mini({ libelle, valeur, ton }: { libelle: string; valeur: React.ReactNode; ton?: "alerte" }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{libelle}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", ton === "alerte" ? "text-red-700" : "text-slate-900")}>{valeur}</p>
    </div>
  );
}

/**
 * Détail d'une demande : le même pour la pharmacie et le prêteur. Les actions sont ajoutées par la page.
 * `partie` permet de glisser les actions entre le résumé (haut) et les détails du crédit avec l'historique (bas).
 */
export function DetailDemande({
  d, vue, maintenant, partie = "tout",
}: {
  d: Demande;
  vue: "pharmacie" | "preteur";
  maintenant: number;
  partie?: "tout" | "haut" | "bas";
}) {
  const haut = partie !== "bas";
  const bas = partie !== "haut";
  return (
    <div className="space-y-4">
      {haut && (
        <>
          <Carte>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{vue === "pharmacie" ? d.creancierNom : d.pharmacieNom}</h2>
                <p className="text-sm text-slate-500">
                  {vue === "pharmacie" ? TYPES_PRETEUR[d.creancierType] : "Pharmacie"} · Demande du {dateCourte(d.creeLe)}
                </p>
              </div>
              <BadgeEtat etat={d.etat} enRetard={d.enRetard} />
            </div>
            <div className="mt-6">
              <Etapes etat={d.etat} />
            </div>
            {d.valeurCents !== null && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Mini libelle="Montant accordé" valeur={usd(d.valeurCents)} />
                <Mini libelle="Reste dû" valeur={usd(d.soldeCents)} ton={d.enRetard ? "alerte" : undefined} />
                {d.echeanceLe && (
                  <div className="col-span-2 sm:col-span-1">
                    <Mini libelle="Échéance" valeur={<span className="text-base"><TexteEcheance echeanceLe={d.echeanceLe} maintenant={maintenant} /></span>} />
                  </div>
                )}
              </div>
            )}
          </Carte>

          {d.etat === "REFUSEE" && (
            <Alerte ton="erreur" titre="Demande refusée">
              Motif : {d.motifRefus}
            </Alerte>
          )}
          {d.etat === "EXPIREE" && (
            <Alerte ton="info">Le prêteur n&apos;a pas répondu avant le {dateHeure(d.expireLe)}. La demande a expiré : vous pouvez en soumettre une nouvelle.</Alerte>
          )}
          {d.etat === "ANNULEE" && <Alerte ton="info">Cette demande a été annulée.</Alerte>}
          {d.etat === "SOUMISE" && (
            <Alerte ton="info">Le prêteur peut répondre jusqu&apos;au {dateHeure(d.expireLe)}. Passé ce délai, la demande expire.</Alerte>
          )}

          <Carte>
            <TitreCarte icone={PackageSearch}>Produits demandés</TitreCarte>
            <ul className="divide-y divide-slate-100">
              {d.lignes.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="text-slate-900">{l.produit}</span>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-semibold tabular-nums text-slate-700">× {l.quantite}</span>
                </li>
              ))}
            </ul>
            {d.note && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Note : {d.note}</p>}
          </Carte>
        </>
      )}

      {bas && (
        <>
          {d.valeurCents !== null && (
            <Carte>
              <TitreCarte icone={CalendarClock}>Conditions du crédit</TitreCarte>
              <dl className="divide-y divide-slate-100">
                <Fiche libelle="Délai de remboursement">{d.delaiAccordeJours} jours après réception</Fiche>
                {d.etat !== "SOUMISE" && d.graceJours ? <Fiche libelle="Tolérance de retard">{d.graceJours} jours</Fiche> : null}
                <Fiche libelle="Déjà remboursé">{usd(d.valeurCents - d.soldeCents)}</Fiche>
              </dl>
              {d.remboursements.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <ClipboardList className="size-4 text-slate-400" aria-hidden />
                    Remboursements enregistrés
                  </h4>
                  <ul className="space-y-1.5 text-sm">
                    {d.remboursements.map((r, i) => (
                      <li key={i} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-slate-600">{dateHeure(r.le)}</span>
                        <strong className="tabular-nums">{usd(r.montantCents)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Carte>
          )}

          <Carte>
            <TitreCarte icone={History}>Historique</TitreCarte>
            <Historique d={d} />
          </Carte>
        </>
      )}
    </div>
  );
}
