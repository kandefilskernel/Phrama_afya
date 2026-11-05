import 'package:shared_preferences/shared_preferences.dart';

/// Mémoire locale clé-valeur pour le mode hors ligne : dernières données lues et file d'attente.
/// Elle ne contient aucun secret (le jeton est dans le coffre sécurisé).
abstract class CacheLocal {
  Future<String?> lire(String cle);
  Future<void> ecrire(String cle, String valeur);
  Future<void> supprimer(String cle);
}

class CachePreferences implements CacheLocal {
  CachePreferences(this._prefs);

  final SharedPreferences _prefs;

  @override
  Future<String?> lire(String cle) async => _prefs.getString(cle);

  @override
  Future<void> ecrire(String cle, String valeur) => _prefs.setString(cle, valeur);

  @override
  Future<void> supprimer(String cle) => _prefs.remove(cle);
}

/// Version en mémoire, pour les tests.
class CacheMemoire implements CacheLocal {
  final Map<String, String> _m = {};

  @override
  Future<String?> lire(String cle) async => _m[cle];

  @override
  Future<void> ecrire(String cle, String valeur) async => _m[cle] = valeur;

  @override
  Future<void> supprimer(String cle) async => _m.remove(cle);
}
