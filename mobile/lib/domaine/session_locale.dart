import 'dart:convert';

import 'acteur.dart';

/// Session ouverte sur ce téléphone : le jeton, sa fin de validité (fixée par la plateforme) et le compte.
class SessionLocale {
  const SessionLocale({required this.token, required this.expireLe, required this.acteur});

  factory SessionLocale.fromJson(Map<String, dynamic> j) => SessionLocale(
        token: j['token'] as String,
        expireLe: (j['expireLe'] as num).toInt(),
        acteur: Acteur.fromJson(j['acteur'] as Map<String, dynamic>),
      );

  static SessionLocale? decoder(String? texte) {
    if (texte == null) return null;
    try {
      return SessionLocale.fromJson(jsonDecode(texte) as Map<String, dynamic>);
    } on Object {
      return null;
    }
  }

  final String token;

  /// Fin de validité, en millisecondes depuis 1970.
  final int expireLe;
  final Acteur acteur;

  bool estExpiree(DateTime maintenant) => maintenant.millisecondsSinceEpoch >= expireLe;

  SessionLocale avecActeur(Acteur a) => SessionLocale(token: token, expireLe: expireLe, acteur: a);

  String encoder() => jsonEncode({'token': token, 'expireLe': expireLe, 'acteur': acteur.toJson()});
}
