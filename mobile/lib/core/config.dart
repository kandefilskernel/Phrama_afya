import 'package:flutter/foundation.dart';

/// Configuration de l'application, fixée à la compilation :
///   flutter run --dart-define=API_URL=http://192.168.1.20:3000
class Config {
  static const _apiUrl = String.fromEnvironment('API_URL');

  /// Adresse de la plateforme. Par défaut : l'ordinateur hôte, vu depuis l'émulateur Android (10.0.2.2),
  /// ou `localhost` pour la version web de développement. Sur un vrai téléphone, passer l'adresse de
  /// l'ordinateur sur le réseau local, ou celle du serveur en production.
  static String get apiUrl {
    if (_apiUrl.isNotEmpty) return _apiUrl.replaceAll(RegExp(r'/+$'), '');
    return kIsWeb ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
  }

  /// Délai d'attente d'une requête avant de la considérer comme perdue (réseau instable).
  static const delaiRequete = Duration(seconds: 12);

  /// Fréquence à laquelle la file d'attente hors ligne est réessayée tant que l'application est ouverte.
  static const frequenceFile = Duration(seconds: 30);
}
