"use client";

import { Alerte, Bouton } from "@/components/ui";

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-xl font-bold text-slate-900">Un problème est survenu</h1>
      <Alerte ton="erreur">
        {error.message?.includes("indisponible")
          ? error.message
          : "La page n'a pas pu se charger. Vos données ne sont pas perdues : réessayez dans un instant."}
      </Alerte>
      <div>
        <Bouton onClick={reset}>Réessayer</Bouton>
      </div>
      {error.digest && <p className="text-xs text-slate-400">Référence : {error.digest}</p>}
    </main>
  );
}
