import 'dart:convert';

import '../core/stockage/cache_local.dart';

/// Actions qu'une pharmacie peut faire sans réseau.
enum TypeCommande { soumettre, receptionner, annuler }

/// Une action faite hors ligne, gardée jusqu'à ce qu'elle parte.
///
/// [cle] est la clé d'idempotence : elle reste la même à chaque tentative, donc un renvoi ne crée jamais de
/// doublon sur la plateforme, même si la réponse précédente s'est perdue en route.
class Commande {
  const Commande({
    required this.id,
    required this.type,
    required this.cle,
    required this.charge,
    required this.libelle,
    required this.creeLe,
  });

  factory Commande.fromJson(Map<String, dynamic> j) => Commande(
        id: j['id'] as String,
        type: TypeCommande.values.byName(j['type'] as String),
        cle: j['cle'] as String,
        charge: Map<String, dynamic>.from(j['charge'] as Map),
        libelle: j['libelle'] as String,
        creeLe: (j['creeLe'] as num).toInt(),
      );

  final String id;
  final TypeCommande type;
  final String cle;

  /// Corps de la requête ; pour une action sur une demande existante, `{'id': <id de la demande>}`.
  final Map<String, dynamic> charge;

  /// Ce que l'utilisateur voit de l'action (« Demande : 8 × Ibuprofène 400 mg »).
  final String libelle;

  /// Création, en millisecondes depuis 1970.
  final int creeLe;

  Map<String, dynamic> toJson() => {'id': id, 'type': type.name, 'cle': cle, 'charge': charge, 'libelle': libelle, 'creeLe': creeLe};
}

/// Action refusée par la plateforme au moment du renvoi, avec sa raison.
class Rejet {
  const Rejet({required this.libelle, required this.message, required this.le});

  factory Rejet.fromJson(Map<String, dynamic> j) =>
      Rejet(libelle: j['libelle'] as String, message: j['message'] as String, le: (j['le'] as num).toInt());

  final String libelle;
  final String message;
  final int le;

  Map<String, dynamic> toJson() => {'libelle': libelle, 'message': message, 'le': le};
}

/// File persistante des actions faites hors ligne, une par compte, dans l'ordre où elles ont été faites.
///
/// Elle vit dans la mémoire locale : elle survit à la fermeture de l'application.
class FileAttente {
  FileAttente({required this.cache, required this.acteurId});

  final CacheLocal cache;
  final String acteurId;

  String get _cleFile => 'file:$acteurId';
  String get _cleRejets => 'rejets:$acteurId';

  Future<List<Commande>> lister() async => [for (final j in await _lire(_cleFile)) Commande.fromJson(j)];

  Future<void> ajouter(Commande c) async => _ecrire(_cleFile, [...(await lister()).map((x) => x.toJson()), c.toJson()]);

  Future<void> retirer(String id) async =>
      _ecrire(_cleFile, [for (final c in await lister()) if (c.id != id) c.toJson()]);

  Future<List<Rejet>> rejets() async => [for (final j in await _lire(_cleRejets)) Rejet.fromJson(j)];

  Future<void> ajouterRejet(Rejet r) async => _ecrire(_cleRejets, [...(await rejets()).map((x) => x.toJson()), r.toJson()]);

  Future<void> effacerRejets() => cache.supprimer(_cleRejets);

  Future<List<Map<String, dynamic>>> _lire(String cle) async {
    final brut = await cache.lire(cle);
    if (brut == null) return const [];
    try {
      return [for (final e in jsonDecode(brut) as List) Map<String, dynamic>.from(e as Map)];
    } on Object {
      // Contenu illisible (ancienne version de l'application) : mieux vaut une file vide qu'un plantage.
      return const [];
    }
  }

  Future<void> _ecrire(String cle, List<Map<String, dynamic>> valeurs) =>
      valeurs.isEmpty ? cache.supprimer(cle) : cache.ecrire(cle, jsonEncode(valeurs));
}
