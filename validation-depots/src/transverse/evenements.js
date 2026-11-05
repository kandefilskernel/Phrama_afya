// Bus d'événements en mémoire. Même contrat que le futur bus externe (NATS, RabbitMQ...) :
// livraison au moins une fois, donc les consommateurs doivent être idempotents (champ `id`).
export function creerBus() {
  const abonnes = new Map();
  return {
    abonner(type, fn) {
      if (!abonnes.has(type)) abonnes.set(type, []);
      abonnes.get(type).push(fn);
    },
    // Rejette si un consommateur échoue : l'émetteur peut alors réessayer plus tard.
    async publier(evenement) {
      await Promise.all([...(abonnes.get(evenement.type) ?? []), ...(abonnes.get('*') ?? [])].map((fn) => fn(evenement)));
    },
  };
}
