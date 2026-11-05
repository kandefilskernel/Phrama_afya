import type { Metadata } from "next";
import { FormulaireInscription } from "./formulaire";

export const metadata: Metadata = { title: "Créer un compte" };

export default function PageInscription() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Créer un compte</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">
        Trois étapes : vous vous inscrivez, vous confirmez votre téléphone par SMS, puis notre équipe vérifie votre agrément.
      </p>
      <FormulaireInscription />
    </>
  );
}
