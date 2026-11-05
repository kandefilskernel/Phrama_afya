/// Erreur renvoyée par la plateforme, ou perdue en route.
///
/// `statut` vaut 0 quand la requête n'a pas pu aboutir (pas de réseau, délai dépassé). Les messages de la
/// plateforme sont déjà en français et destinés à l'utilisateur.
class ErreurApi implements Exception {
  const ErreurApi(this.statut, this.message);

  final int statut;
  final String message;

  /// Pas de réseau : la demande peut être mise en attente et renvoyée plus tard.
  bool get horsLigne => statut == 0;

  /// Panne passagère (réseau ou serveur) : réessayer plus tard a un sens.
  bool get temporaire => statut == 0 || statut >= 500 || statut == 429;

  bool get nonAutorise => statut == 401;

  @override
  String toString() => message;
}

String messageErreur(Object e) {
  if (e is ErreurApi) return e.message;
  return 'Une erreur inattendue est survenue. Réessayez.';
}
