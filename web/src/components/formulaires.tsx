"use client";

import { useActionState, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alerte, Bouton, type Variante } from "./ui";

// Résultat renvoyé par une action serveur : une erreur, un message, ou un jeton à montrer une seule fois.
export interface EtatAction {
  erreur?: string;
  succes?: string;
  jeton?: { libelle: string; valeur: string };
}

type ActionServeur = (precedent: EtatAction, donnees: FormData) => Promise<EtatAction>;

/** Formulaire branché sur une action serveur, avec affichage des erreurs et du résultat. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: ActionServeur;
  children: ReactNode;
  className?: string;
}) {
  const [etat, formAction] = useActionState(action, {} as EtatAction);
  return (
    <form action={formAction} className={className}>
      {children}
      {etat.erreur && (
        <div className="mt-3">
          <Alerte ton="erreur">{etat.erreur}</Alerte>
        </div>
      )}
      {etat.succes && (
        <div className="mt-3">
          <Alerte ton="succes">{etat.succes}</Alerte>
        </div>
      )}
      {etat.jeton && (
        <div className="mt-3">
          <JetonAffiche libelle={etat.jeton.libelle} valeur={etat.jeton.valeur} />
        </div>
      )}
    </form>
  );
}

/** Bouton d'envoi : se désactive pendant l'exécution pour éviter les doubles clics. */
export function Envoi({ children, variante = "primaire", ...props }: ComponentProps<"button"> & { variante?: Variante }) {
  const { pending } = useFormStatus();
  return (
    <Bouton type="submit" variante={variante} disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? "Un instant…" : children}
    </Bouton>
  );
}

/** Jeton affiché une seule fois, avec bouton de copie. */
export function JetonAffiche({ libelle, valeur }: { libelle: string; valeur: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <Alerte ton="attention" titre={libelle}>
      <p className="mb-2">
        Copiez-le et conservez-le maintenant : il ne sera <strong>plus jamais affiché</strong>. Il donne accès au compte.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="block flex-1 break-all rounded-md border border-amber-300 bg-white px-3 py-2 font-mono text-xs text-slate-900">{valeur}</code>
        <Bouton
          type="button"
          variante="secondaire"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(valeur);
              setCopie(true);
            } catch {
              setCopie(false);
            }
          }}
        >
          {copie ? "Copié" : "Copier"}
        </Bouton>
      </div>
    </Alerte>
  );
}

/** Confirmation avant une action grave : un second clic est nécessaire. */
export function ConfirmerEnvoi({
  children,
  confirmation,
  variante = "danger",
}: {
  children: ReactNode;
  confirmation: string;
  variante?: Variante;
}) {
  const [arme, setArme] = useState(false);
  if (!arme) {
    return (
      <Bouton type="button" variante={variante} onClick={() => setArme(true)}>
        {children}
      </Bouton>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-700">{confirmation}</span>
      <Envoi variante={variante}>Oui, confirmer</Envoi>
      <Bouton type="button" variante="secondaire" onClick={() => setArme(false)}>
        Non
      </Bouton>
    </div>
  );
}
