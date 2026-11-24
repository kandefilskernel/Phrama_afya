/// Résultat d'une lecture : les données, et si elles viennent de la dernière copie enregistrée faute de réseau.
class Lecture<T> {
  const Lecture(this.donnees, {this.horsLigne = false, this.le});

  final T donnees;

  /// Vrai quand la plateforme n'a pas pu être jointe : [donnees] est la dernière copie enregistrée.
  final bool horsLigne;

  /// Moment où ces données ont été lues sur la plateforme.
  final DateTime? le;
}
