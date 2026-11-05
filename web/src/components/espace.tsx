import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Marque } from "./logo";
import { NavLateral, NavMobile, type LienNav } from "./navigation";

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .filter((m) => /\p{L}/u.test(m))
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("");

function Avatar({ nom }: { nom: string }) {
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marque-100 text-xs font-semibold text-marque-800">
      {initiales(nom)}
    </span>
  );
}

/**
 * Cadre des espaces connectés. Ordinateur : barre latérale fixe avec le compte en bas.
 * Téléphone : en-tête compact et barre d'onglets en bas de l'écran.
 */
export function CadreEspace({
  liens,
  nom,
  sousTitre,
  deconnexion,
  children,
}: {
  liens: LienNav[];
  nom: string;
  sousTitre: string;
  deconnexion: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Marque />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLateral liens={liens} />
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <Avatar nom={nom} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{nom}</p>
              <p className="truncate text-xs text-slate-500">{sousTitre}</p>
            </div>
          </div>
          <form action={deconnexion}>
            <button
              type="submit"
              className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="size-[18px] text-slate-400" aria-hidden />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <Marque />
          <div className="flex items-center gap-2">
            <span className="max-w-[9rem] truncate text-xs font-medium text-slate-600">{nom}</span>
            <form action={deconnexion}>
              <button
                type="submit"
                aria-label="Se déconnecter"
                className="flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-8 lg:px-10 lg:py-10 lg:pb-12">{children}</main>
      </div>
      <NavMobile liens={liens} />
    </div>
  );
}
