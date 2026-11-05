import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { changerNumero, renvoyerCodeConnexion, validerCodeConnexion } from "@/app/actions/session";
import { ActionForm, Envoi } from "@/components/formulaires";
import { Bouton, Champ, Entree } from "@/components/ui";
import { telephoneMemorise } from "@/lib/session";
import { masquerTelephone } from "@/lib/telephone";

export const metadata: Metadata = { title: "Code de connexion" };

export default async function PageCodeConnexion() {
  const telephone = await telephoneMemorise();
  if (!telephone) redirect("/connexion");

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Saisissez votre code</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Si le numéro {masquerTelephone(telephone)} correspond à un compte, un code à 6 chiffres vient de lui être envoyé par SMS. Il est valable 5
        minutes.
      </p>
      <ActionForm action={validerCodeConnexion} className="space-y-4">
        <Champ libelle="Code reçu par SMS">
          <Entree
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            className="text-center text-2xl tracking-[0.4em]"
            placeholder="••••••"
          />
        </Champ>
        <Envoi className="w-full">Me connecter</Envoi>
      </ActionForm>

      <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
        <ActionForm action={renvoyerCodeConnexion}>
          <p className="mb-2 text-sm text-slate-600">Pas de SMS reçu ?</p>
          <Envoi variante="secondaire">Renvoyer le code</Envoi>
        </ActionForm>
        <form action={changerNumero}>
          <Bouton type="submit" variante="discret">
            Changer de numéro
          </Bouton>
        </form>
      </div>
    </>
  );
}
