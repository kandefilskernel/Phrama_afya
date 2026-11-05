import { ArrowRight, BellRing, Check, ChevronDown, FileText, HandCoins, Handshake, Landmark, Lock, PackageCheck, ShieldCheck, SlidersHorizontal, Store, TrendingUp } from "lucide-react";
import Link from "next/link";
import { CadrePublic } from "@/components/cadre";
import { Badge, Jauge } from "@/components/ui";

const ETAPES = [
  { icone: FileText, titre: "Vous commandez", texte: "La pharmacie demande des produits à un dépôt, une IMF ou une banque, en quelques lignes." },
  { icone: Handshake, titre: "Le prêteur décide", texte: "Il valide selon ses propres conditions, et fixe le montant et le délai de remboursement." },
  { icone: PackageCheck, titre: "Vous êtes livré", texte: "La pharmacie confirme la réception. C'est à ce moment que le délai de remboursement démarre." },
  { icone: HandCoins, titre: "Vous remboursez", texte: "Directement auprès du prêteur. Chaque remboursement à temps fait monter votre plafond." },
];

const ATOUTS = [
  { icone: Lock, titre: "Pas d'argent entre vos mains… ni entre les nôtres", texte: "Vous remboursez directement le prêteur. La plateforme ne détient et ne transfère jamais de fonds." },
  { icone: SlidersHorizontal, titre: "Chaque prêteur fixe ses règles", texte: "Plafonds, délais, tolérance de retard : visibles avant votre demande, jamais imposés par la plateforme." },
  { icone: BellRing, titre: "Alertes par SMS", texte: "Réponse du prêteur, livraison, rappel d'échéance : vous êtes prévenu à chaque étape." },
];

const QUESTIONS = [
  {
    q: "Qui décide du montant que je peux obtenir ?",
    r: "Le prêteur, selon ses propres conditions et votre historique de remboursement chez lui. Vous voyez ses conditions avant de faire une demande, et votre plafond restant à tout moment sur votre tableau de bord.",
  },
  {
    q: "Nuru ya Afya détient-il mon argent ?",
    r: "Non. Vous remboursez directement le prêteur, qui enregistre ensuite chaque paiement reçu sur la plateforme. Nuru ya Afya ne fait que suivre les demandes, les plafonds et les échéances.",
  },
  {
    q: "Comment mon plafond augmente-t-il ?",
    r: "À chaque remboursement fait à temps, selon la règle du prêteur : par exemple deux remboursements à temps d'affilée pour passer au palier suivant. Un retard peut au contraire vous faire redescendre et suspendre les nouveaux crédits chez ce prêteur.",
  },
  {
    q: "Qui peut s'inscrire ?",
    r: "Les pharmacies, les dépôts pharmaceutiques, les institutions de microfinance et les banques. Votre téléphone est confirmé par SMS, puis notre équipe vérifie votre numéro d'agrément avant d'activer votre compte.",
  },
];

function Liste({ points }: { points: string[] }) {
  return (
    <ul className="space-y-3">
      {points.map((p) => (
        <li key={p} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-marque-100">
            <Check className="size-3 text-marque-700" aria-hidden />
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

/** Aperçu du produit, construit avec les vrais composants : ce que verra une pharmacie. Les chiffres sont un exemple. */
function Apercu() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">Aperçu de votre tableau de bord · exemple</p>
      <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-releve ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-10 items-center justify-center rounded-lg bg-marque-50 text-sm font-semibold text-marque-700">
              DC
            </span>
            <div>
              <p className="font-semibold">Dépôt Central</p>
              <p className="text-xs text-slate-500">Dépôt pharmaceutique</p>
            </div>
          </div>
          <Badge ton="ok">Palier 1</Badge>
        </div>
        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Disponible</p>
            <p className="text-4xl font-semibold tabular-nums tracking-tight">8 USD</p>
          </div>
          <p className="pb-1 text-right text-xs text-slate-500">
            plafond
            <br />
            <strong className="text-sm text-slate-800">20 USD</strong>
          </p>
        </div>
        <div className="mt-4">
          <Jauge valeur={12} max={20} libelle="Plafond utilisé (exemple)" />
          <p className="mt-1.5 text-xs text-slate-500">12 USD en cours</p>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-marque-50 px-3 py-2.5 text-xs leading-relaxed text-marque-900">
          <TrendingUp className="mt-0.5 size-4 shrink-0 text-marque-600" aria-hidden />
          Encore 2 remboursements à temps pour passer à 40 USD.
        </p>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-4 text-slate-900 shadow-releve ring-1 ring-slate-200 sm:absolute sm:-bottom-10 sm:-left-10 sm:mt-0 sm:w-80">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marque-600 text-white">
          <Check className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Demande validée</p>
          <p className="truncate text-xs text-slate-500">IMF Espoir · 35 USD · livraison à venir</p>
        </div>
      </div>
    </div>
  );
}

export default function Accueil() {
  return (
    <CadrePublic>
      {/* Bandeau d'accueil */}
      <section className="border-b border-slate-200/70 bg-gradient-to-b from-marque-50/80 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-marque-800 ring-1 ring-inset ring-marque-200">
              <span className="size-1.5 rounded-full bg-lumiere-500" aria-hidden />
              Crédit de proximité pour les pharmacies
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              Ne manquez plus de médicaments <span className="text-marque-600">faute de trésorerie</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Commandez à crédit auprès de prêteurs agréés, suivez vos échéances et gagnez la confiance qui fait grandir votre plafond.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/inscription"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-marque-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-marque-700"
              >
                Créer un compte
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/connexion"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
              >
                Se connecter
              </Link>
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="size-4 shrink-0 text-marque-600" aria-hidden />
              Agrément vérifié par notre équipe, téléphone confirmé par SMS.
            </p>
          </div>
          <Apercu />
        </div>
      </section>

      {/* Atouts */}
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-20 sm:px-6 sm:pt-24">
        <div className="grid gap-4 md:grid-cols-3">
          {ATOUTS.map(({ icone: Icone, titre, texte }) => (
            <div key={titre} className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-carte">
              <span className="flex size-10 items-center justify-center rounded-lg bg-marque-50 text-marque-600">
                <Icone className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-semibold text-slate-900">{titre}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-marque-600">Comment ça marche</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">De la commande au remboursement, en quatre étapes</h2>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES.map(({ icone: Icone, titre, texte }, i) => (
            <li key={titre} className="relative rounded-xl border border-slate-200/80 bg-white p-6 shadow-carte">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-marque-600 text-white">
                  <Icone className="size-5" aria-hidden />
                </span>
                <span className="text-3xl font-semibold tabular-nums text-slate-200">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{titre}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{texte}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Pour qui */}
      <section id="acteurs" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-fond p-8">
            <span className="flex size-11 items-center justify-center rounded-xl bg-marque-600 text-white">
              <Store className="size-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Pour les pharmacies</h2>
            <p className="mt-2 text-slate-600">Gardez vos rayons garnis sans bloquer votre trésorerie.</p>
            <div className="mt-6">
              <Liste
                points={[
                  "Comparez les conditions de chaque prêteur avant de choisir",
                  "Suivez votre plafond, vos échéances et vos demandes sur un seul écran",
                  "Faites grandir votre plafond à chaque remboursement à temps",
                  "Recevez un SMS à chaque étape de votre demande",
                ]}
              />
            </div>
            <Link href="/inscription" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-marque-700 hover:text-marque-800">
              Inscrire ma pharmacie
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-fond p-8">
            <span className="flex size-11 items-center justify-center rounded-xl bg-marque-900 text-white">
              <Landmark className="size-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Pour les dépôts, IMF et banques</h2>
            <p className="mt-2 text-slate-600">Vous gardez la décision et le suivi, la plateforme s&apos;occupe du reste.</p>
            <div className="mt-6">
              <Liste
                points={[
                  "Fixez vos propres paliers, délais et règles de retard",
                  "Validez, livrez et enregistrez les remboursements depuis un tableau de bord",
                  "Voyez l'historique de chaque pharmacie chez vous, calculé d'après vos règles",
                  "Aucun flux d'argent à confier à un tiers",
                ]}
              />
            </div>
            <Link href="/inscription" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-marque-700 hover:text-marque-800">
              Rejoindre en tant que prêteur
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section id="questions" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-marque-600">Questions fréquentes</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Ce qu&apos;il faut savoir</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200/80 bg-white shadow-carte">
          {QUESTIONS.map(({ q, r }) => (
            <details key={q} className="group px-5 py-4 open:bg-marque-50/30">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Appel final */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-marque-200 bg-marque-50 px-6 py-12 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-slate-900">Prêt à ne plus manquer de médicaments essentiels ?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">Créez votre compte en quelques minutes. Notre équipe vérifie votre agrément, puis vous pouvez faire votre première demande.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/inscription" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-marque-600 px-6 text-base font-semibold text-white shadow-sm hover:bg-marque-700">
              Créer un compte
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/connexion" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
              Se connecter
            </Link>
          </div>
        </div>
      </section>
    </CadrePublic>
  );
}
