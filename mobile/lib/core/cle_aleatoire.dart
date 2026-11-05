import 'dart:math';

final _hasard = Random.secure();

/// Clé d'idempotence : la même clé renvoyée à la plateforme ne s'exécute qu'une fois. C'est ce qui permet de
/// réessayer sans risque une demande dont on n'a pas reçu la réponse.
String cleAleatoire() => List.generate(16, (_) => _hasard.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
