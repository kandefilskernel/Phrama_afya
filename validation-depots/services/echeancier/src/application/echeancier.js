// Suivi des échéances, reconstruit à partir du flux d'événements de Crédit.
// L'Échéancier ne décide rien sur le crédit : il prévient au bon moment.

export const JOUR_MS = 24 * 3600 * 1000;
export const RAPPEL_AVANT_JOURS = 3;

// Étape en cours d'une échéance ouverte. Seule l'étape courante est envoyée : si le service
// était arrêté pendant le rappel, il n'envoie pas un rappel devenu inutile une fois en retard.
export function etapeDe(e, now) {
  if (now > e.echeanceLe + e.graceJours * JOUR_MS) return 'retard';
  if (now >= e.echeanceLe) return 'echeance';
  if (now >= e.echeanceLe - RAPPEL_AVANT_JOURS * JOUR_MS) return 'rappel';
  return null;
}

// notifier(message) -> Promise : demande d'envoi au service Notifications (idempotente par clé).
export function creerEcheancier({ stockage, notifier, horloge = Date.now }) {
  const echeances = (stockage.donnees.echeances ??= {});

  const messagesPour = (e, etape) => {
    const msg = (destinataireId, modele) => ({
      cle: `${e.demandeId}:${etape}:${destinataireId}`, destinataireId, modele,
      donnees: { echeanceLe: e.echeanceLe, soldeCents: e.soldeCents },
      pharmacieId: e.pharmacieId, creancierId: e.creancierId,
    });
    if (etape === 'rappel') return [msg(e.pharmacieId, 'rappelEcheance')];
    if (etape === 'echeance') return [msg(e.pharmacieId, 'echeanceAujourdhui')];
    return [msg(e.pharmacieId, 'retardPharmacie'), msg(e.creancierId, 'retardPreteur')];
  };

  return {
    // Traitement d'un événement du flux. Idempotent : le relire ne change rien.
    appliquer(ev) {
      const e = echeances[ev.demandeId];
      if (ev.type === 'MarchandiseRecue' && !e) {
        echeances[ev.demandeId] = {
          demandeId: ev.demandeId, pharmacieId: ev.pharmacieId, creancierId: ev.creancierId,
          echeanceLe: ev.donnees.echeanceLe, graceJours: ev.donnees.graceJours ?? 0,
          soldeCents: ev.donnees.valeurCents, statut: 'OUVERTE', etapesEnvoyees: {},
        };
      } else if (ev.type === 'RemboursementConstate' && e) {
        e.soldeCents = ev.donnees.soldeCents;
      } else if (ev.type === 'DemandeCloturee' && e) {
        e.statut = 'SOLDEE';
      } else {
        return;
      }
      stockage.sauver();
    },

    // Envoie les rappels dus. Une étape n'est marquée envoyée qu'après succès de toutes ses demandes ;
    // en cas d'échec, on réessaie au prochain passage (les clés évitent les doublons).
    async verifier() {
      const now = horloge();
      let demandes = 0;
      for (const e of Object.values(echeances)) {
        if (e.statut !== 'OUVERTE') continue;
        const etape = etapeDe(e, now);
        if (!etape || e.etapesEnvoyees[etape]) continue;
        for (const m of messagesPour(e, etape)) await notifier(m);
        e.etapesEnvoyees[etape] = now;
        stockage.sauver();
        demandes += 1;
      }
      return demandes;
    },

    lister: () => Object.values(echeances),
  };
}
