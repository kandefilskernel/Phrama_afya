import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { quitter, renvoyerCode, verifierTelephone } from "@/app/actions/session";
import { ActionForm, Envoi } from "@/components/formulaires";
import { Alerte, Bouton, Carte, Champ, Entree, Fiche } from "@/components/ui";
import { acteurCourant } from "@/lib/auth";
import { ROLES, dateCourte, espaceDe } from "@/lib/format";
import { masquerTelephone } from "@/lib/telephone";

export const metadata: Metadata = { title: "Mon compte" };

// Page d'étape : tant que le compte n'est pas actif, c'est ici que l'utilisateur arrive.
export default async function PageCompte() {
  const acteur = await acteurCourant();
  if (!acteur) redirect("/deconnexion?raison=expire");
  if (acteur.statut === "ACTIF") redirect(espaceDe(acteur.role));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{acteur.nom}</h1>
        <p className="text-sm text-slate-600">{ROLES[acteur.role]}</p>
      </div>

      {acteur.statut === "EN_ATTENTE" && !acteur.telephoneVerifie && (
        <Carte>
          <h2 className="font-semibold text-slate-900">Étape 1 sur 2 : confirmez votre téléphone</h2>
          <p className="mt-1 text-sm text-slate-600">
            Un code à 6 chiffres a été envoyé par SMS au {masquerTelephone(acteur.telephone)}. Il est valable 10 minutes.
          </p>
          <ActionForm action={verifierTelephone} className="mt-4 space-y-3">
            <Champ libelle="Code reçu par SMS">
              <Entree
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                className="text-center text-2xl tracking-[0.4em]"
                placeholder="••••••"
              />
            </Champ>
            <Envoi className="w-full">Confirmer</Envoi>
          </ActionForm>
          <ActionForm action={renvoyerCode} className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm text-slate-600">Pas de SMS reçu ?</p>
            <Envoi variante="secondaire">Renvoyer le code</Envoi>
          </ActionForm>
        </Carte>
      )}

      {acteur.statut === "EN_ATTENTE" && acteur.telephoneVerifie && (
        <Carte>
          <h2 className="font-semibold text-slate-900">Étape 2 sur 2 : vérification de votre agrément</h2>
          <p className="mt-1 text-sm text-slate-600">
            Votre téléphone est confirmé. Notre équipe vérifie maintenant votre numéro d&apos;agrément. Vous recevrez un SMS dès que votre compte sera
            validé.
          </p>
          <dl className="mt-3 divide-y divide-slate-100">
            <Fiche libelle="Numéro d'agrément">{acteur.numeroAgrement ?? "—"}</Fiche>
            <Fiche libelle="Inscrit le">{dateCourte(acteur.inscritLe)}</Fiche>
          </dl>
        </Carte>
      )}

      {acteur.statut === "REJETE" && (
        <Alerte ton="erreur" titre="Inscription non retenue">
          {acteur.motif ?? "Votre inscription n'a pas été retenue."} Vous pouvez vous réinscrire avec des informations corrigées.
        </Alerte>
      )}

      {acteur.statut === "SUSPENDU" && (
        <Alerte ton="attention" titre="Compte suspendu">
          {acteur.motif ?? "Votre compte est suspendu."} Contactez l&apos;équipe pour en savoir plus.
        </Alerte>
      )}

      <form action={quitter}>
        <Bouton type="submit" variante="secondaire">
          Se déconnecter
        </Bouton>
      </form>
    </div>
  );
}
