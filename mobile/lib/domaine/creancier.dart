/// Conditions de crédit fixées par un prêteur. Elles sont publiques : la pharmacie les voit avant de demander.
class Conditions {
  const Conditions({
    required this.paliersUSD,
    required this.seriesRequises,
    required this.graceJours,
    required this.delaiDefautJours,
    required this.delaiMaxJours,
    required this.expirationHeures,
  });

  factory Conditions.fromJson(Map<String, dynamic> j) => Conditions(
        paliersUSD: (j['paliersUSD'] as List).map((p) => (p as num).toInt()).toList(),
        seriesRequises: (j['seriesRequises'] as num).toInt(),
        graceJours: (j['graceJours'] as num).toInt(),
        delaiDefautJours: (j['delaiDefautJours'] as num).toInt(),
        delaiMaxJours: (j['delaiMaxJours'] as num).toInt(),
        expirationHeures: (j['expirationHeures'] as num).toInt(),
      );

  /// Plafond d'encours à chaque palier, en dollars. Le premier est le plafond de départ.
  final List<int> paliersUSD;
  final int seriesRequises;
  final int graceJours;
  final int delaiDefautJours;
  final int delaiMaxJours;
  final int expirationHeures;

  int get plafondDepartCents => paliersUSD.first * 100;
}

class Creancier {
  const Creancier({required this.id, required this.type, required this.nom, required this.conditions});

  factory Creancier.fromJson(Map<String, dynamic> j) => Creancier(
        id: j['id'] as String,
        type: j['type'] as String,
        nom: j['nom'] as String,
        conditions: Conditions.fromJson(j['conditions'] as Map<String, dynamic>),
      );

  final String id;

  /// depot, imf ou banque.
  final String type;
  final String nom;
  final Conditions conditions;
}
