import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Marque } from "./logo";

export { Marque };

const LIENS_SITE = [
  { href: "/#fonctionnement", libelle: "Comment ça marche" },
  { href: "/#acteurs", libelle: "Pour qui" },
  { href: "/#questions", libelle: "Questions" },
];

/** Cadre des pages publiques : en-tête fixe, contenu, pied de page. */
export function CadrePublic({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Marque />
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {LIENS_SITE.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                {l.libelle}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/connexion" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="hidden rounded-lg bg-marque-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-marque-700 sm:inline-flex"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Marque />
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
                Le crédit de proximité entre les pharmacies de quartier et leurs prêteurs : commandes, plafonds, échéances et remboursements, suivis au même
                endroit.
              </p>
            </div>
            <nav aria-label="Pied de page" className="text-sm">
              <p className="mb-3 font-semibold text-slate-900">Le service</p>
              <ul className="space-y-2">
                {LIENS_SITE.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-slate-500 hover:text-slate-900">
                      {l.libelle}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Espaces" className="text-sm">
              <p className="mb-3 font-semibold text-slate-900">Votre espace</p>
              <ul className="space-y-2">
                <li>
                  <Link href="/connexion" className="text-slate-500 hover:text-slate-900">
                    Se connecter
                  </Link>
                </li>
                <li>
                  <Link href="/inscription" className="text-slate-500 hover:text-slate-900">
                    Créer un compte
                  </Link>
                </li>
                <li>
                  <Link href="/admin/connexion" className="text-slate-500 hover:text-slate-900">
                    Administration
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:justify-between">
            <p>© 2026 Nuru ya Afya</p>
            <p>Nuru ya Afya ne détient jamais votre argent : les remboursements se font directement auprès du prêteur.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

/**
 * Cadre des écrans de connexion et d'inscription : une carte claire, centrée, sous le logo.
 * Volontairement sobre : l'attention va au formulaire.
 */
export function CadreAuth({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
      <Marque />
      <main className={`mt-8 w-full ${large ? "max-w-lg" : "max-w-md"} rounded-2xl border border-slate-200/80 bg-white p-6 shadow-releve sm:p-8`}>{children}</main>
      <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-marque-700">
        <ArrowLeft className="size-4" aria-hidden />
        Retour au site
      </Link>
    </div>
  );
}
