import type { Metadata } from "next";
import { enregistrerConditions } from "@/app/actions/conditions";
import { ResumeConditions } from "@/components/conditions";
import { ActionForm, Envoi } from "@/components/formulaires";
import { Alerte, Carte, Champ, EnTete, Entree } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { plateforme } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Mes conditions" };

export default async function MesConditions() {
  await exigerActeur("preteur");
  const c = await plateforme.conditions();

  return (
    <>
      <EnTete
        titre="Mes conditions"
        sousTitre="Vous fixez vos propres règles. La plateforme les applique à chaque décision et les montre aux pharmacies avant leur demande."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Carte>
          <ActionForm action={enregistrerConditions} className="space-y-4">
            <Champ
              libelle="Paliers de plafond (USD)"
              aide="Le premier est le plafond de départ d'une nouvelle pharmacie. Chaque palier suivant doit être plus élevé. Exemple : 20, 40, 80, 150."
            >
              <Entree name="paliersUSD" required defaultValue={c.paliersUSD.join(", ")} inputMode="numeric" />
            </Champ>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ libelle="Remboursements à temps pour monter d'un palier">
                <Entree name="seriesRequises" required inputMode="numeric" defaultValue={c.seriesRequises} />
              </Champ>
              <Champ libelle="Délai de réponse à une demande (heures)" aide="Passé ce délai, la demande expire.">
                <Entree name="expirationHeures" required inputMode="numeric" defaultValue={c.expirationHeures} />
              </Champ>
              <Champ libelle="Délai de remboursement par défaut (jours)">
                <Entree name="delaiDefautJours" required inputMode="numeric" defaultValue={c.delaiDefautJours} />
              </Champ>
              <Champ libelle="Délai de remboursement maximum (jours)">
                <Entree name="delaiMaxJours" required inputMode="numeric" defaultValue={c.delaiMaxJours} />
              </Champ>
              <Champ libelle="Tolérance de retard (jours)" aide="Un remboursement dans ce délai après l'échéance compte comme à temps. 0 = aucune.">
                <Entree name="graceJours" required inputMode="numeric" defaultValue={c.graceJours} />
              </Champ>
              <Champ libelle="Retard grave (jours)" aide="Au-delà, la pharmacie perd un palier tant qu'elle n'a pas remboursé.">
                <Entree name="retardGraveJours" required inputMode="numeric" defaultValue={c.retardGraveJours} />
              </Champ>
            </div>
            <Alerte ton="info">
              Les changements s&apos;appliquent aux prochaines décisions. Les crédits déjà accordés gardent la tolérance de retard qu&apos;ils avaient à leur validation.
            </Alerte>
            <Envoi>Enregistrer mes conditions</Envoi>
          </ActionForm>
        </Carte>

        <aside>
          <Carte>
            <h2 className="mb-2 font-semibold text-slate-900">Ce que voient les pharmacies</h2>
            <ResumeConditions c={c} />
          </Carte>
        </aside>
      </div>
    </>
  );
}
