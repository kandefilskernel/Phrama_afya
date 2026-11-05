import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { annulerDemande, confirmerReception } from "@/app/actions/demandes";
import { DetailDemande } from "@/components/demandes";
import { ActionForm, ConfirmerEnvoi, Envoi } from "@/components/formulaires";
import { Alerte, Carte, EnTete, TitreCarte } from "@/components/ui";
import { PackageCheck, XCircle } from "lucide-react";
import { ErreurApi } from "@/lib/api";
import { exigerActeur } from "@/lib/auth";
import { maintenant } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Demande" };

export default async function DetailDemandePharmacie({ params }: PageProps<"/pharmacie/demandes/[id]">) {
  await exigerActeur("pharmacie");
  const { id } = await params;
  const d = await plateforme.demande(id).catch((e) => {
    if (e instanceof ErreurApi && e.statut === 404) notFound();
    throw e;
  });

  return (
    <>
      <EnTete titre="Détail de la demande" retour={{ href: "/pharmacie/demandes", libelle: "Mes demandes" }} />
      <div className="space-y-4">
        {d.etat === "LIVREE" && (
          <Carte className="border-amber-300 bg-amber-50">
            <h2 className="flex items-center gap-2 font-semibold text-amber-900">
              <PackageCheck className="size-5" aria-hidden />
              Avez-vous bien reçu la marchandise ?
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              {d.creancierNom} indique avoir livré votre commande. En confirmant la réception, vous lancez le délai de remboursement ({d.delaiAccordeJours} jours).
              Ne confirmez que si vous avez bien tout reçu.
            </p>
            <ActionForm action={confirmerReception} className="mt-3">
              <input type="hidden" name="id" value={d.id} />
              <Envoi>Oui, j&apos;ai reçu la marchandise</Envoi>
            </ActionForm>
          </Carte>
        )}
        {d.etat === "VALIDEE" && <Alerte ton="succes" titre="Demande validée">{d.creancierNom} a accepté votre demande et prépare la livraison.</Alerte>}
        {d.etat === "RECEPTIONNEE" && d.enRetard && (
          <Alerte ton="erreur" titre="Remboursement en retard">
            Remboursez {d.creancierNom} dès que possible. Une fois le paiement reçu, il l&apos;enregistrera ici. Tant que le retard dure, il ne peut pas valider de nouvelle demande.
          </Alerte>
        )}
        {d.etat === "RECEPTIONNEE" && !d.enRetard && (
          <Alerte ton="info">
            Remboursez {d.creancierNom} directement, avant l&apos;échéance. C&apos;est lui qui enregistrera ici chaque paiement reçu : vous serez prévenu par SMS.
          </Alerte>
        )}

        <DetailDemande d={d} vue="pharmacie" maintenant={maintenant()} />

        {(d.etat === "SOUMISE" || d.etat === "VALIDEE") && (
          <Carte>
            <TitreCarte icone={XCircle}>Annuler la demande</TitreCarte>
            <p className="mb-3 text-sm text-slate-600">Possible tant que la marchandise n&apos;est pas livrée.</p>
            <ActionForm action={annulerDemande}>
              <input type="hidden" name="id" value={d.id} />
              <ConfirmerEnvoi confirmation="Annuler cette demande ?">Annuler la demande</ConfirmerEnvoi>
            </ActionForm>
          </Carte>
        )}
      </div>
    </>
  );
}
