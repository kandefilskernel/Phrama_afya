import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { annulerDemande, enregistrerRemboursement, marquerLivree, refuserDemande, validerDemande } from "@/app/actions/demandes";
import { DetailDemande } from "@/components/demandes";
import { ActionForm, ConfirmerEnvoi, Envoi } from "@/components/formulaires";
import { Alerte, Badge, Carte, Champ, EnTete, Entree, Fiche, Jauge, TitreCarte, ZoneTexte } from "@/components/ui";
import { CircleCheck, CircleX, History, Truck, Wallet, XCircle } from "lucide-react";
import { ErreurApi } from "@/lib/api";
import { exigerActeur } from "@/lib/auth";
import { maintenant, usd } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";
import type { CreditRelation, Demande } from "@/lib/types";

export const metadata: Metadata = { title: "Demande" };

function RelationPharmacie({ nom, c }: { nom: string | null; c: CreditRelation }) {
  const ratio = c.plafondCents > 0 ? c.encoursCents / c.plafondCents : 0;
  return (
    <Carte>
      <TitreCarte icone={History} droite={c.bloque ? <Badge ton="alerte">Retard en cours</Badge> : <Badge ton="ok">Palier {c.palier + 1}</Badge>}>
        {nom ?? "La pharmacie"} chez vous
      </TitreCarte>
      <dl className="divide-y divide-slate-100">
        <Fiche libelle="Plafond actuel">{usd(c.plafondCents)}</Fiche>
        <Fiche libelle="Déjà en cours">{usd(c.encoursCents)}</Fiche>
        <Fiche libelle="Disponible">
          <strong>{usd(c.disponibleCents)}</strong>
        </Fiche>
        <Fiche libelle="Série à temps">
          {c.serieEnCours} sur {c.serieRequise} pour {c.prochainPlafondCents !== null ? `monter à ${usd(c.prochainPlafondCents)}` : "le palier suivant (plafond maximum atteint)"}
        </Fiche>
      </dl>
      <div className="mt-2">
        <Jauge valeur={c.encoursCents} max={c.plafondCents} ton={c.bloque ? "alerte" : ratio >= 0.85 ? "attention" : "ok"} libelle="Plafond utilisé" />
      </div>
    </Carte>
  );
}

function Decision({ d, credit, delaiDefaut, delaiMax }: { d: Demande; credit: CreditRelation; delaiDefaut: number; delaiMax: number }) {
  const maxUSD = credit.disponibleCents / 100;
  return (
    <div className="space-y-4">
      {credit.bloque ? (
        <Alerte ton="erreur" titre="Validation impossible pour le moment">
          Cette pharmacie a un remboursement en retard chez vous. Vous pourrez valider une nouvelle demande une fois ce retard réglé. Vous pouvez la refuser.
        </Alerte>
      ) : (
        <Carte>
          <TitreCarte icone={CircleCheck}>Valider la demande</TitreCarte>
          <p className="mb-3 mt-1 text-sm text-slate-600">
            Fixez le montant du crédit et le délai de remboursement. Vous pouvez accorder jusqu&apos;à <strong>{usd(credit.disponibleCents)}</strong>, selon votre plafond pour cette pharmacie.
          </p>
          <ActionForm action={validerDemande} className="space-y-3">
            <input type="hidden" name="id" value={d.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ libelle="Montant accordé (USD)">
                <Entree name="valeurUSD" inputMode="decimal" required placeholder={`Jusqu'à ${maxUSD}`} />
              </Champ>
              <Champ libelle="Délai de remboursement (jours)" aide={`Au plus ${delaiMax} jours`}>
                <Entree name="delaiAccordeJours" inputMode="numeric" defaultValue={delaiDefaut} />
              </Champ>
            </div>
            <Envoi disabled={credit.disponibleCents <= 0}>Valider la demande</Envoi>
          </ActionForm>
        </Carte>
      )}
      <Carte>
        <TitreCarte icone={CircleX}>Refuser la demande</TitreCarte>
        <ActionForm action={refuserDemande} className="mt-2 space-y-3">
          <input type="hidden" name="id" value={d.id} />
          <Champ libelle="Motif" aide="La pharmacie reçoit ce motif par SMS.">
            <ZoneTexte name="motif" required minLength={3} maxLength={500} className="min-h-20" placeholder="Ex. Stock épuisé cette semaine." />
          </Champ>
          <ConfirmerEnvoi confirmation="Refuser cette demande ?">Refuser</ConfirmerEnvoi>
        </ActionForm>
      </Carte>
    </div>
  );
}

export default async function DetailDemandePreteur({ params }: PageProps<"/preteur/demandes/[id]">) {
  await exigerActeur("preteur");
  const { id } = await params;
  const d = await plateforme.demande(id).catch((e) => {
    if (e instanceof ErreurApi && e.statut === 404) notFound();
    throw e;
  });
  const [credit, conditions] = await Promise.all([plateforme.creditPharmacieChezPreteur(d.pharmacieId), plateforme.conditions()]);

  return (
    <>
      <EnTete titre="Détail de la demande" retour={{ href: "/preteur/demandes", libelle: "Demandes" }} />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <DetailDemande d={d} vue="preteur" maintenant={maintenant()} partie="haut" />

          {d.etat === "SOUMISE" && <Decision d={d} credit={credit} delaiDefaut={conditions.delaiDefautJours} delaiMax={conditions.delaiMaxJours} />}

          {d.etat === "VALIDEE" && (
            <Carte>
              <TitreCarte icone={Truck}>Livraison</TitreCarte>
              <p className="mb-3 mt-1 text-sm text-slate-600">Une fois la marchandise remise à la pharmacie, marquez la demande comme livrée. La pharmacie devra confirmer la réception.</p>
              <ActionForm action={marquerLivree}>
                <input type="hidden" name="id" value={d.id} />
                <Envoi>Marquer comme livrée</Envoi>
              </ActionForm>
            </Carte>
          )}

          {d.etat === "LIVREE" && (
            <Alerte ton="info" titre="En attente de la pharmacie">
              La pharmacie doit confirmer la réception. Le délai de remboursement démarrera à sa confirmation.
            </Alerte>
          )}

          {d.etat === "RECEPTIONNEE" && (
            <Carte>
              <TitreCarte icone={Wallet}>Enregistrer un remboursement</TitreCarte>
              <p className="mb-3 mt-1 text-sm text-slate-600">
                Notez ici chaque paiement que vous avez <strong>reçu directement</strong> de la pharmacie. La plateforme ne fait que suivre : elle ne touche pas à l&apos;argent. Reste dû : <strong>{usd(d.soldeCents)}</strong>.
              </p>
              <ActionForm action={enregistrerRemboursement} className="space-y-3">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="cle" value={randomUUID()} />
                <Champ libelle="Montant reçu (USD)" aide={`Au plus ${usd(d.soldeCents)}`}>
                  <Entree name="montantUSD" inputMode="decimal" required defaultValue={d.soldeCents / 100} />
                </Champ>
                <Envoi>Enregistrer le remboursement</Envoi>
              </ActionForm>
            </Carte>
          )}

          {d.etat === "VALIDEE" && (
            <Carte>
              <TitreCarte icone={XCircle}>Annuler la demande</TitreCarte>
              <p className="mb-3 text-sm text-slate-600">Possible tant que la marchandise n&apos;est pas livrée.</p>
              <ActionForm action={annulerDemande}>
                <input type="hidden" name="id" value={d.id} />
                <ConfirmerEnvoi confirmation="Annuler cette demande ?">Annuler la demande</ConfirmerEnvoi>
              </ActionForm>
            </Carte>
          )}

          <DetailDemande d={d} vue="preteur" maintenant={maintenant()} partie="bas" />
        </div>

        <aside className="space-y-4">
          <RelationPharmacie nom={d.pharmacieNom} c={credit} />
        </aside>
      </div>
    </>
  );
}
