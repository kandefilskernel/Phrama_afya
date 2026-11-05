import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../erreurs.dart';

typedef FournisseurJeton = Future<String?> Function();

/// Client HTTP vers la plateforme. Il ne connaît aucune règle métier : il envoie, décode la réponse et traduit
/// les échecs en [ErreurApi].
class ClientApi {
  ClientApi({
    required this.baseUrl,
    required this.jeton,
    this.surNonAutorise,
    http.Client? client,
    this.delai = Config.delaiRequete,
  }) : _http = client ?? http.Client();

  final String baseUrl;

  /// Donne le jeton de session courant, lu au moment de chaque appel.
  final FournisseurJeton jeton;

  /// Appelé quand la plateforme répond 401 à un appel authentifié : la session n'est plus valable.
  final void Function()? surNonAutorise;

  final Duration delai;
  final http.Client _http;

  Future<dynamic> get(String chemin, {String? jetonExplicite}) => _appeler('GET', chemin, jetonExplicite: jetonExplicite);

  Future<dynamic> post(
    String chemin, {
    Object? corps,
    String? cle,
    String? jetonExplicite,
    bool authentifie = true,
  }) =>
      _appeler('POST', chemin, corps: corps ?? const {}, cle: cle, jetonExplicite: jetonExplicite, authentifie: authentifie);

  Future<dynamic> _appeler(
    String methode,
    String chemin, {
    Object? corps,
    String? cle,
    String? jetonExplicite,
    bool authentifie = true,
  }) async {
    final entetes = <String, String>{'accept': 'application/json'};
    if (corps != null) entetes['content-type'] = 'application/json';
    if (cle != null) entetes['idempotency-key'] = cle;
    if (authentifie) {
      final token = jetonExplicite ?? await jeton();
      if (token == null) throw const ErreurApi(401, "Vous n'êtes pas connecté.");
      entetes['authorization'] = 'Bearer $token';
    }

    final requete = http.Request(methode, Uri.parse('$baseUrl$chemin'))..headers.addAll(entetes);
    if (corps != null) requete.body = jsonEncode(corps);

    http.Response reponse;
    try {
      reponse = await http.Response.fromStream(await _http.send(requete).timeout(delai)).timeout(delai);
    } on Object {
      // Pas de réseau, serveur injoignable ou délai dépassé : on ne sait pas si la requête est arrivée.
      throw const ErreurApi(0, 'Pas de connexion au serveur.');
    }

    final json = _decoder(reponse);
    if (reponse.statusCode >= 200 && reponse.statusCode < 300) return json;

    if (reponse.statusCode == 401 && authentifie) surNonAutorise?.call();
    final message = json is Map && json['erreur'] is String
        ? json['erreur'] as String
        : (reponse.statusCode >= 500 ? 'Erreur du service, réessayez.' : 'Requête refusée.');
    throw ErreurApi(reponse.statusCode, message);
  }

  dynamic _decoder(http.Response r) {
    if (r.bodyBytes.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(r.bodyBytes));
    } on FormatException {
      return null;
    }
  }

  void fermer() => _http.close();
}
