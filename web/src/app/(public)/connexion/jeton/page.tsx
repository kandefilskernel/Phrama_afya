import type { Metadata } from "next";
import Link from "next/link";
import { connexion } from "@/app/actions/session";
import { ActionForm, Envoi } from "@/components/formulaires";
import { Champ, Entree } from "@/components/ui";

export const metadata: Metadata = { title: "Connexion par jeton" };

// Chemin de dépannage et d'intégration. La connexion courante se fait par SMS.
export default function ConnexionParJeton() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Connexion par jeton</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Réservé aux comptes qui disposent d&apos;un jeton d&apos;accès. Sinon, connectez-vous par SMS.</p>
      <ActionForm action={connexion} className="space-y-4">
        <Champ libelle="Jeton d'accès" aide="Fourni par l'équipe de la plateforme.">
          <Entree name="jeton" type="password" required autoComplete="current-password" spellCheck={false} />
        </Champ>
        <Envoi className="w-full">Se connecter</Envoi>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-marque-700 underline">
          Se connecter par SMS
        </Link>
      </p>
    </>
  );
}
