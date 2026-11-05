import type { Metadata } from "next";
import { ResumeConditions } from "@/components/conditions";
import { Badge, Carte, EnTete, EtatVide, LienBouton } from "@/components/ui";
import { exigerActeur } from "@/lib/auth";
import { TYPES_PRETEUR } from "@/lib/format";
import { plateforme } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Prêteurs" };

export default async function Preteurs() {
  await exigerActeur("pharmacie");
  const creanciers = await plateforme.creanciers();

  return (
    <>
      <EnTete
        titre="Prêteurs"
        sousTitre="Chaque prêteur fixe ses propres conditions. Comparez-les avant de faire une demande : le plafond, le délai et la tolérance varient."
      />
      {creanciers.length === 0 ? (
        <EtatVide titre="Aucun prêteur pour le moment">Les prêteurs agréés apparaîtront ici.</EtatVide>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creanciers.map((c) => (
            <Carte key={c.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">{c.nom}</h2>
                <Badge ton="neutre">{TYPES_PRETEUR[c.type]}</Badge>
              </div>
              <ResumeConditions c={c.conditions} />
              <div className="mt-4">
                <LienBouton href={`/pharmacie/demandes/nouvelle?preteur=${c.id}`} className="w-full">
                  Faire une demande
                </LienBouton>
              </div>
            </Carte>
          ))}
        </div>
      )}
    </>
  );
}
