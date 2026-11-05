import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { approuverCompte, reactiverCompte, reemettreJetonActeur, rejeterCompte, suspendreCompte } from "@/app/actions/admin";
import { ActionForm, ConfirmerEnvoi, Envoi } from "@/components/formulaires";
import { Alerte, Badge, Carte, Champ, EnTete, Fiche, ZoneTexte } from "@/components/ui";
import { exigerAdmin } from "@/lib/auth";
import { ACTIONS_JOURNAL, ROLES, STATUTS_COMPTE, dateHeure } from "@/lib/format";
import { administration } from "@/lib/plateforme";

export const metadata: Metadata = { title: "Compte" };

export default async function DetailCompte({ params }: PageProps<"/admin/acteurs/[id]">) {
  const admin = await exigerAdmin();
  const { id } = await params;
  const a = (await administration.acteurs()).find((x) => x.id === id);
  if (!a) notFound();
  const superviseur = admin.role === "superviseur";

  return (
    <>
      <EnTete titre={a.nom} sousTitre={ROLES[a.role]} retour={{ href: "/admin", libelle: "Comptes" }} />
      <div className="max-w-2xl space-y-4">
        <Carte>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge ton={STATUTS_COMPTE[a.statut].ton}>{STATUTS_COMPTE[a.statut].libelle}</Badge>
            <Badge ton={a.telephoneVerifie ? "ok" : "attente"}>{a.telephoneVerifie ? "Téléphone vérifié" : "Téléphone non vérifié"}</Badge>
          </div>
          <dl className="divide-y divide-slate-100">
            <Fiche libelle="Numéro d'agrément">
              <span className="font-mono">{a.numeroAgrement ?? "—"}</span>
            </Fiche>
            <Fiche libelle="Téléphone">{a.telephone ?? "—"}</Fiche>
            <Fiche libelle="Adresse">{a.adresse ?? "—"}</Fiche>
            <Fiche libelle="Inscrit le">{dateHeure(a.inscritLe)}</Fiche>
            {a.motif && <Fiche libelle="Dernier motif">{a.motif}</Fiche>}
          </dl>
        </Carte>

        {a.statut === "EN_ATTENTE" && (
          <Carte>
            <h2 className="font-semibold text-slate-900">Décision</h2>
            {!a.telephoneVerifie ? (
              <div className="mt-2">
                <Alerte ton="attention">
                  Le téléphone n&apos;est pas encore vérifié : l&apos;acteur doit d&apos;abord saisir le code reçu par SMS. Vous ne pouvez pas approuver ce compte pour l&apos;instant.
                </Alerte>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                Comparez le numéro d&apos;agrément au registre officiel avant d&apos;approuver. Votre nom sera enregistré avec la décision.
              </p>
            )}
            <div className="mt-4 space-y-4">
              {a.telephoneVerifie && (
                <ActionForm action={approuverCompte}>
                  <input type="hidden" name="id" value={a.id} />
                  <ConfirmerEnvoi variante="primaire" confirmation="Approuver ce compte ?">
                    Approuver
                  </ConfirmerEnvoi>
                </ActionForm>
              )}
              <ActionForm action={rejeterCompte} className={a.telephoneVerifie ? "space-y-3 border-t border-slate-200 pt-4" : "space-y-3"}>
                <input type="hidden" name="id" value={a.id} />
                <Champ libelle="Motif du rejet" aide="L'acteur le reçoit par SMS.">
                  <ZoneTexte name="motif" minLength={3} maxLength={500} className="min-h-20" placeholder="Ex. Agrément introuvable au registre." />
                </Champ>
                <ConfirmerEnvoi confirmation="Rejeter cette inscription ?">Rejeter</ConfirmerEnvoi>
              </ActionForm>
            </div>
          </Carte>
        )}

        {a.statut === "ACTIF" && (
          <Carte>
            <h2 className="font-semibold text-slate-900">Suspendre ce compte</h2>
            <p className="mt-1 text-sm text-slate-600">Un prêteur suspendu disparaît de l&apos;annuaire. Ses crédits en cours restent visibles par les pharmacies.</p>
            <ActionForm action={suspendreCompte} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <Champ libelle="Motif de la suspension">
                <ZoneTexte name="motif" minLength={3} maxLength={500} className="min-h-20" />
              </Champ>
              <ConfirmerEnvoi confirmation="Suspendre ce compte ?">Suspendre</ConfirmerEnvoi>
            </ActionForm>
          </Carte>
        )}

        {a.statut === "SUSPENDU" && (
          <Carte>
            <h2 className="font-semibold text-slate-900">Réactiver ce compte</h2>
            <ActionForm action={reactiverCompte} className="mt-3">
              <input type="hidden" name="id" value={a.id} />
              <Envoi>Réactiver</Envoi>
            </ActionForm>
          </Carte>
        )}

        {superviseur && a.statut !== "REJETE" && (
          <Carte>
            <h2 className="font-semibold text-slate-900">Jeton perdu</h2>
            <p className="mt-1 text-sm text-slate-600">
              Émet un nouveau jeton et invalide l&apos;ancien. Ce jeton permet d&apos;agir au nom du compte : remettez-le en main propre, après avoir vérifié l&apos;identité de la personne.
            </p>
            <ActionForm action={reemettreJetonActeur} className="mt-3">
              <input type="hidden" name="id" value={a.id} />
              <ConfirmerEnvoi variante="secondaire" confirmation="Invalider l'ancien jeton et en émettre un nouveau ?">
                Réémettre un jeton
              </ConfirmerEnvoi>
            </ActionForm>
          </Carte>
        )}

        <Carte>
          <h2 className="mb-3 font-semibold text-slate-900">Historique du compte</h2>
          <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
            {[...a.historique].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-marque-500" />
                <p className="text-sm font-medium text-slate-900">
                  {h.par ? `${h.par.nom} ${ACTIONS_JOURNAL[h.action ?? ""] ?? h.action} ce compte` : h.telephoneVerifie ? "Téléphone vérifié par code SMS" : `Inscription : ${STATUTS_COMPTE[h.statut].libelle}`}
                </p>
                {h.motif && <p className="text-sm text-slate-600">Motif : {h.motif}</p>}
                <p className="text-xs text-slate-500">{dateHeure(h.le)}</p>
              </li>
            ))}
          </ol>
        </Carte>
      </div>
    </>
  );
}
