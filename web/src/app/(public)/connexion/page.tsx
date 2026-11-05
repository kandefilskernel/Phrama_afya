import type { Metadata } from "next";
import Link from "next/link";
import { demanderCode } from "@/app/actions/session";
import { ActionForm, Envoi } from "@/components/formulaires";
import { Alerte, Champ, Entree } from "@/components/ui";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: PageProps<"/connexion">) {
  const { raison } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Pharmacies, dépôts, IMF et banques. Nous vous envoyons un code par SMS.</p>
      {raison === "expire" && (
        <div className="mb-4">
          <Alerte ton="attention">Votre session a expiré. Reconnectez-vous.</Alerte>
        </div>
      )}
      {raison === "sortie" && (
        <div className="mb-4">
          <Alerte ton="info">Vous êtes déconnecté.</Alerte>
        </div>
      )}
      <ActionForm action={demanderCode} className="space-y-4">
        <Champ libelle="Votre numéro de téléphone" aide="Le numéro de votre inscription.">
          <Entree name="telephone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+243 81 234 5678" autoFocus />
        </Champ>
        <Envoi className="w-full">Recevoir un code par SMS</Envoi>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-600">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-marque-700 underline">
          Créer un compte
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        <Link href="/connexion/jeton" className="underline">
          Se connecter avec un jeton d&apos;accès
        </Link>
      </p>
    </>
  );
}
