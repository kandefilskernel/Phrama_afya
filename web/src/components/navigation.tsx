"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, House, Landmark, Plus, ScrollText, ShieldCheck, SlidersHorizontal, Store, Users, type LucideIcon } from "lucide-react";
import { cn } from "./ui";

// Les icônes sont désignées par un nom : un composant serveur ne peut pas passer une fonction à un composant client.
const ICONES = {
  accueil: House,
  demandes: FileText,
  nouvelle: Plus,
  preteurs: Landmark,
  pharmacies: Store,
  conditions: SlidersHorizontal,
  comptes: ShieldCheck,
  equipe: Users,
  journal: ScrollText,
} satisfies Record<string, LucideIcon>;
export type NomIcone = keyof typeof ICONES;

export interface LienNav {
  href: string;
  libelle: string;
  /** Libellé raccourci pour la barre du bas sur téléphone. */
  court?: string;
  icone: NomIcone;
  /** Actif seulement sur cette adresse exacte (pour les pages d'accueil). */
  exact?: boolean;
}

// Le lien le plus précis gagne : « /demandes/nouvelle » n'active pas aussi « /demandes ».
function lienActif(liens: LienNav[], chemin: string): string | undefined {
  const correspond = (l: LienNav) => (l.exact ? chemin === l.href : chemin === l.href || chemin.startsWith(`${l.href}/`));
  return liens.filter(correspond).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Navigation de la barre latérale (ordinateur). */
export function NavLateral({ liens }: { liens: LienNav[] }) {
  const actifHref = lienActif(liens, usePathname());
  return (
    <nav aria-label="Navigation principale" className="space-y-1">
      {liens.map((l) => {
        const Icone = ICONES[l.icone];
        const actif = l.href === actifHref;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              actif ? "bg-marque-50 text-marque-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icone className={cn("size-[18px] shrink-0", actif ? "text-marque-600" : "text-slate-400 group-hover:text-slate-600")} aria-hidden />
            {l.libelle}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre d'onglets fixée en bas de l'écran (téléphone). */
export function NavMobile({ liens }: { liens: LienNav[] }) {
  const actifHref = lienActif(liens, usePathname());
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${liens.length}, minmax(0, 1fr))` }}>
        {liens.map((l) => {
          const Icone = ICONES[l.icone];
          const actif = l.href === actifHref;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={actif ? "page" : undefined}
                className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium", actif ? "text-marque-700" : "text-slate-500")}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", actif && "bg-marque-100")}>
                  <Icone className="size-5" aria-hidden />
                </span>
                {l.court ?? l.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Onglets de filtre : chaque onglet est un lien, l'état du filtre reste dans l'adresse. */
export function Onglets({ onglets, actif }: { onglets: { href: string; libelle: string; nombre?: number; id: string }[]; actif: string }) {
  return (
    <div role="tablist" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {onglets.map((o) => {
        const selectionne = o.id === actif;
        return (
          <Link
            key={o.id}
            href={o.href}
            role="tab"
            aria-selected={selectionne}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              selectionne
                ? "border-marque-600 bg-marque-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {o.libelle}
            {o.nombre !== undefined && (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums",
                  selectionne ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600",
                )}
              >
                {o.nombre}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
