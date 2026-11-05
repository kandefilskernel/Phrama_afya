import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Endroit où l'on garde la session de l'utilisateur. Le jeton donne accès au compte : il va dans le stockage
/// sécurisé du téléphone (Keystore sur Android), jamais dans les préférences ordinaires.
abstract class CoffreTexte {
  Future<String?> lire();
  Future<void> ecrire(String valeur);
  Future<void> effacer();
}

class CoffreSecurise implements CoffreTexte {
  CoffreSecurise({FlutterSecureStorage? stockage, this.cle = 'session'}) : _s = stockage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;
  final String cle;

  @override
  Future<String?> lire() async {
    try {
      return await _s.read(key: cle);
    } on Object {
      // Stockage illisible (données d'une ancienne installation) : on repart d'une session vide.
      await effacer();
      return null;
    }
  }

  @override
  Future<void> ecrire(String valeur) => _s.write(key: cle, value: valeur);

  @override
  Future<void> effacer() async {
    try {
      await _s.delete(key: cle);
    } on Object {
      // Rien à faire : sans valeur lisible, la session est de toute façon perdue.
    }
  }
}

/// Version en mémoire, pour les tests.
class CoffreMemoire implements CoffreTexte {
  String? _v;

  @override
  Future<String?> lire() async => _v;

  @override
  Future<void> ecrire(String valeur) async => _v = valeur;

  @override
  Future<void> effacer() async => _v = null;
}
