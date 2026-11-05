import { Fiche } from "./ui";
import { usd } from "@/lib/format";
import type { Conditions } from "@/lib/types";

/** Les conditions d'un prêteur, en langage simple. */
export function ResumeConditions({ c }: { c: Conditions }) {
  const paliers = c.paliersUSD.map((p) => usd(p * 100));
  return (
    <dl className="divide-y divide-slate-100">
      <Fiche libelle="Premier plafond">{paliers[0]}</Fiche>
      <Fiche libelle="Plafonds suivants">{paliers.length > 1 ? paliers.slice(1).join(" → ") : "Aucun, plafond unique"}</Fiche>
      <Fiche libelle="Pour monter d'un palier">
        {c.seriesRequises} remboursement{c.seriesRequises > 1 ? "s" : ""} à temps d&apos;affilée
      </Fiche>
      <Fiche libelle="Délai de remboursement">
        {c.delaiDefautJours} jours par défaut, {c.delaiMaxJours} jours au maximum
      </Fiche>
      <Fiche libelle="Tolérance de retard">{c.graceJours === 0 ? "Aucune" : `${c.graceJours} jours après l'échéance`}</Fiche>
      <Fiche libelle="Réponse à une demande">sous {c.expirationHeures} heures</Fiche>
    </dl>
  );
}
