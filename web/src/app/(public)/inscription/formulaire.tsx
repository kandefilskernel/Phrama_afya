"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inscription } from "@/app/actions/session";
import { Alerte, Champ, Entree, Liste } from "@/components/ui";
import { Envoi, type EtatAction } from "@/components/formulaires";

export function FormulaireInscription() {
  const [etat, action] = useActionState(inscription, {} as EtatAction);

  return (
    <form action={action} className="space-y-4">
      <Champ libelle="Vous êtes">
        <Liste name="role" required defaultValue="">
          <option value="" disabled>
            Choisissez…
          </option>
          <option value="pharmacie">Une pharmacie</option>
          <option value="depot">Un dépôt pharmaceutique</option>
          <option value="imf">Une institution de microfinance (IMF)</option>
          <option value="banque">Une banque</option>
        </Liste>
      </Champ>
      <Champ libelle="Nom de l'établissement">
        <Entree name="nom" required minLength={2} maxLength={120} autoComplete="organization" placeholder="Pharmacie Gombe" />
      </Champ>
      <Champ libelle="Téléphone" aide="Un code de vérification sera envoyé par SMS à ce numéro. Vous l'utiliserez aussi pour vous connecter.">
        <Entree name="telephone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+243 81 234 5678" />
      </Champ>
      <Champ
        libelle="Numéro d'agrément"
        aide="Agrément de l'ordre des pharmaciens, ou de la Banque centrale pour une IMF ou une banque. Notre équipe le vérifie."
      >
        <Entree name="numeroAgrement" required minLength={3} maxLength={60} />
      </Champ>
      <Champ libelle="Adresse (facultatif)">
        <Entree name="adresse" maxLength={300} autoComplete="street-address" />
      </Champ>
      {etat.erreur && <Alerte ton="erreur">{etat.erreur}</Alerte>}
      <Envoi className="w-full">Créer mon compte</Envoi>
      <p className="text-center text-sm text-slate-600">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-semibold text-marque-700 underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
