import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---- Boutons --------------------------------------------------------------------------------
const VARIANTES = {
  primaire: "bg-marque-600 text-white shadow-sm hover:bg-marque-700 active:bg-marque-800 disabled:bg-marque-600/50 disabled:shadow-none",
  secondaire: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-red-600/50 disabled:shadow-none",
  discret: "text-marque-700 hover:bg-marque-50 active:bg-marque-100 disabled:opacity-50",
} as const;
export type Variante = keyof typeof VARIANTES;

const baseBouton =
  "inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed";

export function Bouton({ variante = "primaire", className, ...props }: ComponentProps<"button"> & { variante?: Variante }) {
  return <button {...props} className={cn(baseBouton, VARIANTES[variante], className)} />;
}

export function LienBouton({ variante = "primaire", className, ...props }: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link {...props} className={cn(baseBouton, VARIANTES[variante], className)} />;
}

// ---- Cartes, badges, alertes ----------------------------------------------------------------
export function Carte({ className, ...props }: ComponentProps<"section">) {
  return <section {...props} className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-carte", className)} />;
}

/** Titre de section à l'intérieur d'une carte. */
export function TitreCarte({ icone: Icone, children, droite }: { icone?: LucideIcon; children: ReactNode; droite?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
        {Icone && <Icone className="size-[18px] text-marque-600" aria-hidden />}
        {children}
      </h2>
      {droite}
    </div>
  );
}

const TONS_BADGE = {
  neutre: { fond: "bg-slate-100 text-slate-700", point: "bg-slate-400" },
  attente: { fond: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200", point: "bg-amber-500" },
  ok: { fond: "bg-marque-50 text-marque-800 ring-1 ring-inset ring-marque-200", point: "bg-marque-500" },
  alerte: { fond: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200", point: "bg-red-500" },
  fin: { fond: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200", point: "bg-sky-500" },
} as const;

export function Badge({ ton = "neutre", children }: { ton?: keyof typeof TONS_BADGE; children: ReactNode }) {
  const t = TONS_BADGE[ton];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", t.fond)}>
      <span className={cn("size-1.5 rounded-full", t.point)} aria-hidden />
      {children}
    </span>
  );
}

const TONS_ALERTE = {
  info: { classe: "border-sky-200 bg-sky-50 text-sky-950", icone: Info, couleur: "text-sky-600" },
  succes: { classe: "border-marque-200 bg-marque-50 text-marque-950", icone: CircleCheck, couleur: "text-marque-600" },
  attention: { classe: "border-amber-200 bg-amber-50 text-amber-950", icone: TriangleAlert, couleur: "text-amber-600" },
  erreur: { classe: "border-red-200 bg-red-50 text-red-950", icone: CircleAlert, couleur: "text-red-600" },
} as const;

export function Alerte({ ton = "info", titre, children }: { ton?: keyof typeof TONS_ALERTE; titre?: string; children?: ReactNode }) {
  const t = TONS_ALERTE[ton];
  const Icone = t.icone;
  return (
    <div role={ton === "erreur" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed", t.classe)}>
      <Icone className={cn("mt-0.5 size-[18px] shrink-0", t.couleur)} aria-hidden />
      <div className="min-w-0">
        {titre && <p className="font-semibold">{titre}</p>}
        {children && <div className={titre ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

// ---- Mise en page ---------------------------------------------------------------------------
export function EnTete({
  titre, sousTitre, actions, retour, surtitre,
}: {
  titre: string;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  retour?: { href: string; libelle: string };
  surtitre?: string;
}) {
  return (
    <div className="mb-6">
      {retour && (
        <Link href={retour.href} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-marque-700">
          <ArrowLeft className="size-4" aria-hidden />
          {retour.libelle}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {surtitre && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-marque-600">{surtitre}</p>}
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-[28px] sm:leading-9">{titre}</h1>
          {sousTitre && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">{sousTitre}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EtatVide({ titre, children, action, icone: Icone }: { titre: string; children?: ReactNode; action?: ReactNode; icone?: LucideIcon }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {Icone && (
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-marque-50 text-marque-600">
          <Icone className="size-6" aria-hidden />
        </span>
      )}
      <p className="font-semibold text-slate-900">{titre}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Une ligne « libellé : valeur » pour les fiches de détail. */
export function Fiche({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-sm text-slate-500 sm:w-48 sm:shrink-0">{libelle}</dt>
      <dd className="text-sm font-medium tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}

// ---- Formulaires ----------------------------------------------------------------------------
const baseChamp =
  "block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 shadow-sm transition-shadow placeholder:text-slate-400 focus:border-marque-600 focus:ring-4 focus:ring-marque-100 focus-visible:outline-none sm:text-sm";

export function Champ({ libelle, aide, children }: { libelle: string; aide?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-800">{libelle}</span>
      {children}
      {aide && <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">{aide}</span>}
    </label>
  );
}

export function Entree({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(baseChamp, className)} />;
}
export function Liste({ className, ...props }: ComponentProps<"select">) {
  return <select {...props} className={cn(baseChamp, "pr-8", className)} />;
}
export function ZoneTexte({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(baseChamp, "min-h-24", className)} />;
}

// ---- Indicateurs ----------------------------------------------------------------------------
export function Jauge({ valeur, max, ton = "ok", libelle }: { valeur: number; max: number; ton?: "ok" | "attention" | "alerte"; libelle: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((valeur / max) * 100)) : 0;
  const couleur = ton === "alerte" ? "bg-red-500" : ton === "attention" ? "bg-lumiere-500" : "bg-marque-500";
  return (
    <div role="progressbar" aria-label={libelle} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full transition-all", couleur)} style={{ width: `${pct}%` }} />
    </div>
  );
}

const TONS_CHIFFRE = { neutre: "bg-marque-50 text-marque-600", alerte: "bg-red-50 text-red-600", attention: "bg-lumiere-50 text-lumiere-700" } as const;

/** Indicateur clé d'un tableau de bord. */
export function Chiffre({
  libelle, valeur, note, icone: Icone, ton = "neutre",
}: {
  libelle: string;
  valeur: ReactNode;
  note?: ReactNode;
  icone?: LucideIcon;
  ton?: keyof typeof TONS_CHIFFRE;
}) {
  return (
    <div className="h-full rounded-xl border border-slate-200/80 bg-white p-4 shadow-carte sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500 sm:text-sm">{libelle}</p>
        {Icone && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9", TONS_CHIFFRE[ton])}>
            <Icone className="size-4 sm:size-[18px]" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:mt-2 sm:text-[28px] sm:leading-9">{valeur}</p>
      {note && <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>}
    </div>
  );
}
