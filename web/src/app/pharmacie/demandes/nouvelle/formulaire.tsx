"use client";

import { useActionState, useState } from "react";
import { soumettreDemande } from "@/app/actions/demandes";
import { Alerte, Bouton, Champ, Entree, Liste, ZoneTexte } from "@/components/ui";
import { Envoi, type EtatAction } from "@/components/formulaires";
import { TYPES_PRETEUR, usd } from "@/lib/format";
import type { Creancier } from "@/lib/types";

export interface OptionPreteur extends Pick<Creancier, "id" | "type" | "nom"> {
  /** Ce que la pharmacie peut encore demander chez ce prêteur, en cents. */
  disponibleCents: number;
  bloque: boolean;
  delaiDefautJours: number;
  expirationHeures: number;
}

let prochaineCle = 1;
const nouvelleLigne = () => ({ cle: prochaineCle++ });

export function FormulaireDemande({ preteurs, preselection }: { preteurs: OptionPreteur[]; preselection?: string }) {
  const [etat, action] = useActionState(soumettreDemande, {} as EtatAction);
  const [lignes, setLignes] = useState([nouvelleLigne()]);
  const [choisi, setChoisi] = useState(preteurs.find((p) => p.id === preselection)?.id ?? "");
  const preteur = preteurs.find((p) => p.id === choisi);

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-3">
        <Champ libelle="Prêteur">
          <Liste name="creancierId" required value={choisi} onChange={(e) => setChoisi(e.target.value)}>
            <option value="" disabled>
              Choisissez un prêteur…
            </option>
            {preteurs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom} ({TYPES_PRETEUR[p.type]})
              </option>
            ))}
          </Liste>
        </Champ>
        {preteur && (
          <Alerte ton={preteur.bloque ? "erreur" : "info"}>
            {preteur.bloque ? (
              <>Vous avez un remboursement en retard chez ce prêteur : il ne peut pas valider de nouvelle demande tant qu&apos;il n&apos;est pas réglé.</>
            ) : (
              <>
                Vous pouvez encore demander jusqu&apos;à <strong>{usd(preteur.disponibleCents)}</strong> chez ce prêteur. Il répond sous {preteur.expirationHeures} heures et
                fixe le montant et un délai de {preteur.delaiDefautJours} jours par défaut.
              </>
            )}
          </Alerte>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-slate-900">Produits demandés</h2>
        <div className="space-y-3">
          {lignes.map((l, i) => (
            <div key={l.cle} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Champ libelle={i === 0 ? "Produit" : ""}>
                  <Entree name="produit" maxLength={200} placeholder="Ex. Amoxicilline 500 mg, boîte de 20" aria-label={`Produit ${i + 1}`} />
                </Champ>
              </div>
              <div className="w-24 shrink-0">
                <Champ libelle={i === 0 ? "Quantité" : ""}>
                  <Entree name="quantite" inputMode="numeric" pattern="[0-9]*" placeholder="10" aria-label={`Quantité ${i + 1}`} />
                </Champ>
              </div>
              <Bouton
                type="button"
                variante="secondaire"
                className="shrink-0 px-3"
                disabled={lignes.length === 1}
                aria-label={`Retirer la ligne ${i + 1}`}
                onClick={() => setLignes(lignes.filter((x) => x.cle !== l.cle))}
              >
                ✕
              </Bouton>
            </div>
          ))}
        </div>
        <Bouton type="button" variante="discret" className="mt-2" onClick={() => setLignes([...lignes, nouvelleLigne()])}>
          + Ajouter un produit
        </Bouton>
      </section>

      <Champ libelle="Note pour le prêteur (facultatif)">
        <ZoneTexte name="note" maxLength={500} placeholder="Livraison souhaitée avant vendredi, par exemple." />
      </Champ>

      {etat.erreur && <Alerte ton="erreur">{etat.erreur}</Alerte>}
      <Envoi className="w-full sm:w-auto" disabled={preteur?.bloque}>
        Envoyer la demande
      </Envoi>
      <p className="text-xs text-slate-500">Le prêteur décide du montant accordé. Vous serez prévenu par SMS dès sa réponse.</p>
    </form>
  );
}
