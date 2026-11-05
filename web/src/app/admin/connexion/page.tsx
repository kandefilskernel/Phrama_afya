import type { Metadata } from "next";
import { connexionAdmin } from "@/app/actions/session";
import { CadreAuth } from "@/components/cadre";
import { ActionForm, Envoi } from "@/components/formulaires";
import { Alerte, Champ, Entree } from "@/components/ui";

export const metadata: Metadata = { title: "Administration" };

export default async function ConnexionAdmin({ searchParams }: PageProps<"/admin/connexion">) {
  const { raison } = await searchParams;
  return (
    <CadreAuth>
      <h1 className="text-2xl font-semibold text-slate-900">Espace administration</h1>
      <p className="mb-6 mt-1.5 text-sm text-slate-600">Réservé à l&apos;équipe de la plateforme.</p>
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
      <ActionForm action={connexionAdmin} className="space-y-4">
        <Champ libelle="Jeton d'administrateur" aide="Remis par un superviseur à la création de votre compte.">
          <Entree name="jeton" type="password" required autoComplete="current-password" spellCheck={false} />
        </Champ>
        <Envoi className="w-full">Se connecter</Envoi>
      </ActionForm>
    </CadreAuth>
  );
}
