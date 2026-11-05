import 'package:intl/intl.dart';

/// Montant en dollars : « 18 USD », « 18,50 USD ». Les montants sont reçus en cents.
String usd(int? cents) {
  if (cents == null) return '—';
  final entier = cents % 100 == 0;
  final f = NumberFormat(entier ? '#,##0' : '#,##0.00', 'fr_FR');
  return '${f.format(cents / 100)} USD';
}

// Les dates s'affichent à l'heure de Kinshasa (UTC+1, sans changement d'heure).
DateTime _kinshasa(int ms) => DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).add(const Duration(hours: 1));

String dateCourte(int? ms) => ms == null ? '—' : DateFormat('d MMM yyyy', 'fr_FR').format(_kinshasa(ms));

String dateHeure(int? ms) => ms == null ? '—' : DateFormat('d MMM yyyy, HH:mm', 'fr_FR').format(_kinshasa(ms));

String jourMois(int? ms) => ms == null ? '—' : DateFormat('d MMM', 'fr_FR').format(_kinshasa(ms));

/// Jours entiers jusqu'à une échéance, arrondis vers le haut (négatif si dépassée).
int? joursRestants(int? echeanceLe, int maintenantMs) {
  if (echeanceLe == null) return null;
  return ((echeanceLe - maintenantMs) / 86400000).ceil();
}

/// « il y a 3 min », pour dire à quel point des données hors ligne sont anciennes.
String ilYa(DateTime depuis, DateTime maintenant) {
  final d = maintenant.difference(depuis);
  if (d.inMinutes < 1) return "à l'instant";
  if (d.inMinutes < 60) return 'il y a ${d.inMinutes} min';
  if (d.inHours < 24) return 'il y a ${d.inHours} h';
  return 'il y a ${d.inDays} j';
}

String initiales(String nom) {
  final mots = nom.split(RegExp(r'\s+')).where((m) => RegExp(r'\p{L}', unicode: true).hasMatch(m)).take(2);
  return mots.map((m) => m.substring(0, 1).toUpperCase()).join();
}
