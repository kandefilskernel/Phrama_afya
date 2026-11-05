import { LienBouton } from "@/components/ui";

export default function IntrouvableGlobal() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-xl font-bold text-slate-900">Page introuvable</h1>
      <p className="text-sm text-slate-600">Cette page n&apos;existe pas, ou vous n&apos;y avez pas accès.</p>
      <div>
        <LienBouton href="/">Retour à l&apos;accueil</LienBouton>
      </div>
    </main>
  );
}
