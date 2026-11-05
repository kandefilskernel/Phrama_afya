import type { Metadata } from "next";
import { creerAdministrateur, desactiverAdministrateur, reemettreJetonAdministrateur } from "@/app/actions/admin";
import { ActionForm, ConfirmerEnvoi, Envoi } from "@/components/formulaires";
import { Badge, Carte, Champ, EnTete, Entree, Liste } from "@/components/ui";
import { exigerAdmin } from "@/lib/auth";
import { dateCourte } from "@/lib/format";
import { administration } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Équipe" };

export default async function Equipe() {
  const moi = await exigerAdmin(true);
  const equipe = await administration.administrateurs();
  const actifs = equipe.filter((a) => a.actif);
  const anciens = equipe.filter((a) => !a.actif);

  return (
    <>
      <EnTete titre="Équipe" sousTitre="Chaque membre a son propre compte et son propre jeton : toute décision est enregistrée à son nom." />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {actifs.map((a) => (
            <Carte key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    {a.nom} {a.id === moi.id && <span className="text-xs font-normal text-slate-500">(vous)</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.telephone} · depuis le {dateCourte(a.creeLe)}
                  </p>
                </div>
                <Badge ton={a.role === "superviseur" ? "fin" : "neutre"}>{a.role === "superviseur" ? "Superviseur" : "Agent"}</Badge>
              </div>
              {a.id !== moi.id && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <ActionForm action={reemettreJetonAdministrateur}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmerEnvoi variante="secondaire" confirmation="Invalider son jeton et en émettre un nouveau ?">
                      Réémettre son jeton
                    </ConfirmerEnvoi>
                  </ActionForm>
                  <ActionForm action={desactiverAdministrateur} className="space-y-2">
                    <input type="hidden" name="id" value={a.id} />
                    <Entree name="motif" placeholder="Motif de la désactivation" minLength={3} maxLength={300} aria-label={`Motif de désactivation de ${a.nom}`} />
                    <ConfirmerEnvoi confirmation="Il perdra l'accès immédiatement. Confirmer ?">Désactiver</ConfirmerEnvoi>
                  </ActionForm>
                </div>
              )}
            </Carte>
          ))}
          {anciens.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Comptes désactivés ({anciens.length})</summary>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {anciens.map((a) => (
                  <li key={a.id}>
                    {a.nom} · désactivé le {dateCourte(a.desactiveLe)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <aside>
          <Carte>
            <h2 className="mb-3 font-semibold text-slate-900">Ajouter un membre</h2>
            <ActionForm action={creerAdministrateur} className="space-y-3">
              <Champ libelle="Nom complet">
                <Entree name="nom" required minLength={2} maxLength={120} />
              </Champ>
              <Champ libelle="Téléphone">
                <Entree name="telephone" type="tel" required inputMode="tel" placeholder="+243 99 900 0002" />
              </Champ>
              <Champ libelle="Rôle" aide="Un agent vérifie les comptes. Un superviseur gère aussi l'équipe et lit le journal.">
                <Liste name="role" required defaultValue="agent">
                  <option value="agent">Agent</option>
                  <option value="superviseur">Superviseur</option>
                </Liste>
              </Champ>
              <Envoi className="w-full">Créer le compte</Envoi>
            </ActionForm>
          </Carte>
          <p className="mt-3 text-xs text-slate-500">
            Le jeton du nouveau membre n&apos;est affiché qu&apos;une fois, juste après la création : remettez-le en main propre.
          </p>
        </aside>
      </div>
    </>
  );
}
