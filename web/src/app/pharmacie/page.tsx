import type { Metadata } from "next";
import { CalendarClock, FileText, HandCoins, Plus, TrendingUp, Wallet } from "lucide-react";
import { ListeDemandes } from "@/components/demandes";
import { Alerte, Badge, Carte, Chiffre, EnTete, EtatVide, Jauge, LienBouton } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { TYPES_PRETEUR, maintenant, usd } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";
import type { CreditChezPreteur } from "@/lib/types";

export const metadata: Metadata = { title: "Tableau de bord" };

const initiales = (nom: string) => nom.split(/\s+/).filter((m) => /\p{L}/u.test(m)).slice(0, 2).map((m) => m[0].toUpperCase()).join("");

function CarteCredit({ c }: { c: CreditChezPreteur }) {
  const ratio = c.plafondCents > 0 ? c.encoursCents / c.plafondCents : 0;
  const manque = Math.max(0, c.serieRequise - c.serieEnCours);
  return (
    <Carte className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-marque-50 text-sm font-semibold text-marque-700">
            {initiales(c.nom)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900">{c.nom}</h3>
            <p className="text-xs text-slate-500">{TYPES_PRETEUR[c.type]}</p>
          </div>
        </div>
        {c.bloque ? <Badge ton="alerte">Crédits suspendus</Badge> : <Badge ton="ok">Palier {c.palier + 1}</Badge>}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">Disponible</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{usd(c.disponibleCents)}</p>
        </div>
        <p className="pb-1 text-right text-xs leading-snug text-slate-500">
          plafond
          <br />
          <strong className="text-sm font-semibold tabular-nums text-slate-800">{usd(c.plafondCents)}</strong>
        </p>
      </div>
      <div className="mt-3">
        <Jauge valeur={c.encoursCents} max={c.plafondCents} ton={c.bloque ? "alerte" : ratio >= 0.85 ? "attention" : "ok"} libelle={`Plafond utilisé chez ${c.nom}`} />
        <p className="mt-1.5 text-xs tabular-nums text-slate-500">{usd(c.encoursCents)} en cours</p>
      </div>

      {c.prochainPlafondCents !== null && !c.bloque && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-marque-50 px-3 py-2.5 text-xs leading-relaxed text-marque-900">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-marque-600" aria-hidden />
          {manque > 0
            ? `Encore ${manque} remboursement${manque > 1 ? "s" : ""} à temps pour passer à ${usd(c.prochainPlafondCents)}.`
            : `Prochain remboursement à temps : plafond de ${usd(c.prochainPlafondCents)}.`}
        </p>
      )}
      {c.prochainPlafondCents === null && !c.bloque && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">Vous avez atteint le plafond maximum de ce prêteur.</p>
      )}
    </Carte>
  );
}

export default async function TableauDeBord() {
  const acteur = await exigerActeur("pharmacie");
  const [credits, demandes] = await Promise.all([plateforme.creditChezLesPreteurs(acteur.id), plateforme.demandes()]);
  const maintenantMs = maintenant();

  const aRembourser = demandes.filter((d) => d.etat === "RECEPTIONNEE").sort((a, b) => (a.echeanceLe ?? 0) - (b.echeanceLe ?? 0));
  const enRetard = aRembourser.filter((d) => d.enRetard);
  const encoursTotal = credits.reduce((s, c) => s + c.encoursCents, 0);
  const enCours = demandes.filter((d) => ["SOUMISE", "VALIDEE", "LIVREE", "RECEPTIONNEE"].includes(d.etat));
  const aConfirmer = demandes.filter((d) => d.etat === "LIVREE");
  const recentes = [...demandes].sort((a, b) => b.creeLe - a.creeLe).slice(0, 4);
  const prochaine = aRembourser.find((d) => !d.enRetard);

  return (
    <>
      <EnTete
        surtitre="Tableau de bord"
        titre={`Bonjour, ${acteur.nom}`}
        sousTitre="Votre crédit, vos échéances et vos demandes en un coup d'œil."
        actions={
          <LienBouton href="/pharmacie/demandes/nouvelle">
            <Plus className="size-4" aria-hidden />
            Nouvelle demande
          </LienBouton>
        }
      />

      <div className="space-y-3">
        {enRetard.length > 0 && (
          <Alerte ton="erreur" titre={`${enRetard.length} remboursement${enRetard.length > 1 ? "s" : ""} en retard`}>
            Remboursez {enRetard.map((d) => `${usd(d.soldeCents)} à ${d.creancierNom}`).join(", ")}. Tant que le retard dure, ce prêteur ne peut pas valider de nouvelle
            demande.
          </Alerte>
        )}
        {aConfirmer.length > 0 && (
          <Alerte ton="attention" titre="Marchandise à confirmer">
            {aConfirmer.map((d) => d.creancierNom).join(", ")} indique avoir livré votre commande. Confirmez la réception depuis la demande : le délai de remboursement
            démarre à ce moment.
          </Alerte>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Chiffre
          icone={HandCoins}
          libelle="À rembourser"
          valeur={usd(encoursTotal)}
          note={credits.length > 0 ? `chez ${credits.length} prêteur${credits.length > 1 ? "s" : ""}` : "Aucun crédit en cours"}
          ton={enRetard.length > 0 ? "alerte" : "neutre"}
        />
        <Chiffre icone={FileText} libelle="Demandes en cours" valeur={enCours.length} note={enCours.length > 0 ? "à suivre" : "Aucune demande en cours"} />
        <div className="col-span-2 sm:col-span-1">
        <Chiffre
          icone={CalendarClock}
          libelle="Prochaine échéance"
          valeur={prochaine?.echeanceLe ? new Date(prochaine.echeanceLe).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Kinshasa" }) : "—"}
          note={prochaine ? `${usd(prochaine.soldeCents)} à ${prochaine.creancierNom}` : "Aucune échéance à venir"}
        />
        </div>
      </div>

      <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-900">Votre plafond par prêteur</h2>
      {credits.length === 0 ? (
        <EtatVide
          icone={Wallet}
          titre="Pas encore de crédit"
          action={
            <LienBouton href="/pharmacie/demandes/nouvelle">
              <Plus className="size-4" aria-hidden />
              Faire une première demande
            </LienBouton>
          }
        >
          Dès votre première demande, vous verrez ici votre plafond chez chaque prêteur et comment le faire grandir.
        </EtatVide>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {credits.map((c) => (
            <CarteCredit key={c.creancierId} c={c} />
          ))}
        </div>
      )}

      <div className="mb-3 mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Dernières demandes</h2>
        {demandes.length > 0 && (
          <LienBouton href="/pharmacie/demandes" variante="discret" className="min-h-9">
            Tout voir
          </LienBouton>
        )}
      </div>
      {recentes.length === 0 ? (
        <EtatVide icone={FileText} titre="Aucune demande pour le moment">
          Vos demandes apparaîtront ici avec leur progression.
        </EtatVide>
      ) : (
        <ListeDemandes demandes={recentes} vue="pharmacie" maintenant={maintenantMs} base="/pharmacie/demandes" />
      )}
    </>
  );
}
