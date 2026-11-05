// Écrans de chargement : la forme de la page apparaît tout de suite, le contenu la remplit ensuite.
function Bloc({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`squelette rounded-lg ${className}`} />;
}

export function SqueletteEspace() {
  return (
    <div role="status" aria-live="polite" aria-label="Chargement en cours">
      <span className="sr-only">Chargement en cours…</span>
      <div className="mb-6 space-y-3">
        <Bloc className="h-3 w-28" />
        <Bloc className="h-8 w-72 max-w-full" />
        <Bloc className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-carte">
            <Bloc className="h-3 w-20" />
            <Bloc className="mt-3 h-7 w-24" />
            <Bloc className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-10 space-y-3">
        <Bloc className="h-5 w-48" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-carte">
            <div className="flex items-center justify-between gap-4">
              <Bloc className="h-4 w-40" />
              <Bloc className="h-6 w-28 rounded-full" />
            </div>
            <Bloc className="mt-3 h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
