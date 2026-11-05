import type { Metadata } from "next";
import { Coins, Inbox, Settings2, TriangleAlert, Truck } from "lucide-react";
import { ListeDemandes } from "@/components/demandes";
import { Alerte, Chiffre, EnTete, EtatVide, LienBouton } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { dateHeure, maintenant, usd } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";
import type { Demande } from "@/lib/types";

export const metadata: Metadata = { title: "Tableau de bord" };

function Section({ titre, demandes, maintenantMs, lien }: { titre: string; demandes: Demande[]; maintenantMs: number; lien: string }) {
  if (demandes.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {titre} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{demandes.length}</span>
        </h2>
        <LienBouton href={lien} variante="discret" className="min-h-9">
          Tout voir
        </LienBouton>
      </div>
      <ListeDemandes demandes={demandes.slice(0, 5)} vue="preteur" maintenant={maintenantMs} base="/preteur/demandes" />
    </section>
  );
}

export default async function TableauDeBordPreteur() {
  const acteur = await exigerActeur("preteur");
  const demandes = await plateforme.demandes();
  const maintenantMs = maintenant();

  const aTraiter = demandes.filter((d) => d.etat === "SOUMISE").sort((a, b) => a.expireLe - b.expireLe);
  const aLivrer = demandes.filter((d) => d.etat === "VALIDEE");
  const aRembourser = demandes.filter((d) => d.etat === "RECEPTIONNEE").sort((a, b) => (a.echeanceLe ?? 0) - (b.echeanceLe ?? 0));
  const enRetard = aRembourser.filter((d) => d.enRetard);
  const engage = demandes.filter((d) => ["VALIDEE", "LIVREE", "RECEPTIONNEE"].includes(d.etat)).reduce((s, d) => s + d.soldeCents, 0);
  const urgent = aTraiter.filter((d) => d.expireLe - maintenantMs < 12 * 3600_000);

  return (
    <>
      <EnTete
        surtitre="Tableau de bord"
        titre={`Bonjour, ${acteur.nom}`}
        sousTitre="Les demandes à traiter, les livraisons à faire et les remboursements à suivre."
      />

      <div className="space-y-3">
        {urgent.length > 0 && (
          <Alerte ton="attention" titre={`${urgent.length} demande${urgent.length > 1 ? "s" : ""} bientôt expirée${urgent.length > 1 ? "s" : ""}`}>
            Sans réponse de votre part, elles expireront avant {dateHeure(Math.max(...urgent.map((d) => d.expireLe)))}.
          </Alerte>
        )}
        {enRetard.length > 0 && (
          <Alerte ton="erreur" titre={`${enRetard.length} remboursement${enRetard.length > 1 ? "s" : ""} en retard`}>
            {enRetard.map((d) => `${d.pharmacieNom} : ${usd(d.soldeCents)}`).join(" · ")}
          </Alerte>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre icone={Inbox} libelle="À traiter" valeur={aTraiter.length} note="en attente de votre réponse" ton={urgent.length > 0 ? "attention" : "neutre"} />
        <Chiffre icone={Truck} libelle="À livrer" valeur={aLivrer.length} note="demandes validées" />
        <Chiffre icone={Coins} libelle="À récupérer" valeur={usd(engage)} note="crédits en cours" />
        <Chiffre
          icone={TriangleAlert}
          libelle="En retard"
          valeur={enRetard.length}
          note={enRetard.length ? usd(enRetard.reduce((s, d) => s + d.soldeCents, 0)) : "Aucun retard"}
          ton={enRetard.length ? "alerte" : "neutre"}
        />
      </div>

      {demandes.length === 0 ? (
        <div className="mt-10">
          <EtatVide
            icone={Inbox}
            titre="Aucune demande pour le moment"
            action={
              <LienBouton href="/preteur/conditions" variante="secondaire">
                <Settings2 className="size-4" aria-hidden />
                Vérifier mes conditions
              </LienBouton>
            }
          >
            Les pharmacies peuvent vous envoyer des demandes dès que vos conditions sont visibles dans l&apos;annuaire.
          </EtatVide>
        </div>
      ) : (
        <>
          <Section titre="À traiter" demandes={aTraiter} maintenantMs={maintenantMs} lien="/preteur/demandes?filtre=traiter" />
          <Section titre="À livrer" demandes={aLivrer} maintenantMs={maintenantMs} lien="/preteur/demandes?filtre=livrer" />
          <Section titre="Remboursements à suivre" demandes={aRembourser} maintenantMs={maintenantMs} lien="/preteur/demandes?filtre=rembourser" />
        </>
      )}
    </>
  );
}
