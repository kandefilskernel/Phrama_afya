import Link from "next/link";

/** Symbole : une croix de santé et un point de lumière (« nuru » signifie lumière). */
export function Symbole({ taille = 36 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" className="fill-marque-600" />
      <path
        d="M14 8.5h4a1 1 0 0 1 1 1V13h3.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H19v3.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V19H9.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1H13V9.5a1 1 0 0 1 1-1z"
        fill="#fff"
      />
      <circle cx="24" cy="8" r="3.2" className="fill-lumiere-500" />
    </svg>
  );
}

/** Logo complet. `clair` : texte blanc, pour les fonds sombres. */
export function Marque({ clair = false, href = "/" }: { clair?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Nuru ya Afya, accueil">
      <Symbole />
      <span className={`text-[17px] font-semibold tracking-tight ${clair ? "text-white" : "text-marque-950"}`}>
        Nuru <span className={clair ? "text-marque-200" : "text-marque-600"}>ya Afya</span>
      </span>
    </Link>
  );
}
