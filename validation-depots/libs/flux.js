// Consommateur d'un flux d'événements ordonné (champ `seq` croissant), avec curseur persistant.
//
// Livraison au moins une fois : le curseur n'avance qu'après un traitement réussi. Si le
// traitement échoue, on s'arrête et le prochain passage reprend au même événement.
// Les traitements doivent donc être idempotents (même événement reçu deux fois = même effet).
export function creerConsommateur({ stockage, nom, lire, traiter, limite = 100 }) {
  const curseurs = (stockage.donnees.curseurs ??= {});
  const curseur = () => curseurs[nom] ?? 0;
  return {
    curseur,
    // lire(apres, limite) -> Promise<evenements[]>
    async tirer() {
      let traites = 0;
      for (;;) {
        const evenements = await lire(curseur(), limite);
        for (const e of evenements) {
          await traiter(e);
          curseurs[nom] = e.seq;
          stockage.sauver();
          traites += 1;
        }
        if (evenements.length < limite) return traites;
      }
    },
  };
}
