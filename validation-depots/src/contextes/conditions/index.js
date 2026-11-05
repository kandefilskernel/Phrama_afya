// Module Conditions : les conditions de crédit propres à chaque prêteur, et l'annuaire.
import { DEFAUTS, validerConditions } from './regles.js';

export { DEFAUTS, validerConditions };

// ports.creanciers() : liste des prêteurs, fournie par le module Identité via la racine de composition.
export function creerConditions({ stockage, bus = null, ports }) {
  const parPreteur = (stockage.donnees.parPreteur ??= {});
  const obtenir = (id) => parPreteur[id] ?? validerConditions(structuredClone(DEFAUTS));
  return {
    obtenir,
    definir(id, corps) {
      const conditions = validerConditions(corps);
      parPreteur[id] = conditions;
      stockage.sauver();
      // Publication simple en phase 1 : pas d'outbox ici, l'événement est informatif.
      bus?.publier({ id: crypto.randomUUID(), type: 'ConditionsModifiees', le: Date.now(), creancierId: id }).catch(() => {});
      return conditions;
    },
    // Annuaire public pour que la pharmacie choisisse en connaissance de cause.
    annuaire: () => ports.creanciers().map((c) => ({ id: c.id, type: c.role, nom: c.nom, conditions: obtenir(c.id) })),
  };
}
