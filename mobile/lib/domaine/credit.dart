/// Plafond et encours d'une pharmacie chez un prêteur donné, calculés d'après les règles de ce prêteur.
class CreditChezPreteur {
  const CreditChezPreteur({
    required this.creancierId,
    required this.type,
    required this.nom,
    required this.palier,
    required this.plafondCents,
    required this.encoursCents,
    required this.disponibleCents,
    required this.bloque,
    required this.serieEnCours,
    required this.serieRequise,
    this.prochainPlafondCents,
  });

  factory CreditChezPreteur.fromJson(Map<String, dynamic> j) => CreditChezPreteur(
        creancierId: j['creancierId'] as String,
        type: j['type'] as String,
        nom: j['nom'] as String,
        palier: (j['palier'] as num).toInt(),
        plafondCents: (j['plafondCents'] as num).toInt(),
        encoursCents: (j['encoursCents'] as num).toInt(),
        disponibleCents: (j['disponibleCents'] as num).toInt(),
        bloque: j['bloque'] as bool? ?? false,
        serieEnCours: (j['serieEnCours'] as num).toInt(),
        serieRequise: (j['serieRequise'] as num).toInt(),
        prochainPlafondCents: (j['prochainPlafondCents'] as num?)?.toInt(),
      );

  final String creancierId;
  final String type;
  final String nom;

  /// Numéro du palier, à partir de 0.
  final int palier;
  final int plafondCents;
  final int encoursCents;
  final int disponibleCents;

  /// Un remboursement est en retard : ce prêteur ne peut plus valider de nouveau crédit.
  final bool bloque;
  final int serieEnCours;
  final int serieRequise;
  final int? prochainPlafondCents;

  double get tauxUtilisation => plafondCents > 0 ? (encoursCents / plafondCents).clamp(0.0, 1.0) : 0;

  /// Remboursements à temps encore nécessaires pour monter d'un palier.
  int get remboursementsManquants => (serieRequise - serieEnCours).clamp(0, serieRequise);
}
