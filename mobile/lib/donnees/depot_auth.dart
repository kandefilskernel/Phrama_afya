import '../core/reseau/client_api.dart';
import '../domaine/acteur.dart';
import '../domaine/session_locale.dart';

/// Inscription, connexion par SMS et compte, auprès de la plateforme.
class DepotAuth {
  DepotAuth(this.api);

  final ClientApi api;

  /// Étape 1 de la connexion : un code part par SMS. La plateforme répond pareil que le numéro ait un compte ou non.
  Future<void> demanderCode(String telephone) =>
      api.post('/connexion/code', corps: {'telephone': telephone}, authentifie: false);

  /// Étape 2 : le code ouvre une session côté serveur, puis on lit le compte avec ce nouveau jeton.
  Future<SessionLocale> ouvrirSession(String telephone, String code) async {
    final r = await api.post('/connexion/verifier', corps: {'telephone': telephone, 'code': code}, authentifie: false) as Map;
    final token = r['token'] as String;
    final acteur = Acteur.fromJson(Map<String, dynamic>.from(await api.get('/moi', jetonExplicite: token) as Map));
    return SessionLocale(token: token, expireLe: (r['expireLe'] as num).toInt(), acteur: acteur);
  }

  /// Le compte de la session ouverte, tel que la plateforme le voit maintenant.
  Future<Acteur> moi() async => Acteur.fromJson(Map<String, dynamic>.from(await api.get('/moi') as Map));

  /// Ferme la session sur la plateforme. Sans réseau, elle expirera d'elle-même : la déconnexion locale suffit.
  Future<void> deconnecter() async {
    try {
      await api.post('/moi/deconnexion');
    } on Object {
      // rien : l'appelant efface la session du téléphone dans tous les cas
    }
  }

  /// Inscrit une pharmacie. Renvoie le jeton provisoire, qui ne sert qu'à confirmer le téléphone.
  Future<String> inscrire({required String nom, required String telephone, required String numeroAgrement, String adresse = ''}) async {
    final r = await api.post(
      '/inscriptions',
      corps: {
        'role': 'pharmacie',
        'nom': nom,
        'telephone': telephone,
        'numeroAgrement': numeroAgrement,
        if (adresse.trim().isNotEmpty) 'adresse': adresse.trim(),
      },
      authentifie: false,
    ) as Map;
    return r['token'] as String;
  }

  Future<void> verifierTelephone(String code, {required String jetonProvisoire}) =>
      api.post('/moi/telephone/verifier', corps: {'code': code}, jetonExplicite: jetonProvisoire);

  Future<void> renvoyerCodeTelephone({required String jetonProvisoire}) =>
      api.post('/moi/telephone/renvoyer', jetonExplicite: jetonProvisoire);
}
