/// Compte connecté : une pharmacie, dans cette application.
class Acteur {
  const Acteur({
    required this.id,
    required this.role,
    required this.nom,
    required this.statut,
    this.telephone,
    this.telephoneVerifie = false,
    this.numeroAgrement,
    this.adresse,
    this.motif,
  });

  factory Acteur.fromJson(Map<String, dynamic> j) => Acteur(
        id: j['id'] as String,
        role: j['role'] as String,
        nom: j['nom'] as String,
        statut: j['statut'] as String,
        telephone: j['telephone'] as String?,
        telephoneVerifie: j['telephoneVerifie'] as bool? ?? false,
        numeroAgrement: j['numeroAgrement'] as String?,
        adresse: j['adresse'] as String?,
        motif: j['motif'] as String?,
      );

  final String id;
  final String role;
  final String nom;

  /// EN_ATTENTE, ACTIF, REJETE ou SUSPENDU.
  final String statut;
  final String? telephone;
  final bool telephoneVerifie;
  final String? numeroAgrement;
  final String? adresse;
  final String? motif;

  bool get estPharmacie => role == 'pharmacie';
  bool get estActif => statut == 'ACTIF';

  Map<String, dynamic> toJson() => {
        'id': id,
        'role': role,
        'nom': nom,
        'statut': statut,
        'telephone': telephone,
        'telephoneVerifie': telephoneVerifie,
        'numeroAgrement': numeroAgrement,
        'adresse': adresse,
        'motif': motif,
      };
}
