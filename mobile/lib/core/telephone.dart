/// Met un numéro saisi à la main au format attendu par la plateforme (+243...).
/// Accepte les espaces, tirets, points et parenthèses, « 00243... » et le format local « 0812345678 ».
/// Renvoie null si le numéro n'est pas plausible.
String? normaliserTelephone(String saisie) {
  var n = saisie.replaceAll(RegExp(r'[\s().-]'), '');
  if (n.startsWith('00')) {
    n = '+${n.substring(2)}';
  } else if (RegExp(r'^0\d{9}$').hasMatch(n)) {
    n = '+243${n.substring(1)}'; // numéro congolais en format local
  } else if (RegExp(r'^243\d{9}$').hasMatch(n)) {
    n = '+$n';
  }
  return RegExp(r'^\+\d{8,15}$').hasMatch(n) ? n : null;
}

/// Affichage partiellement masqué : +243 ••••• 567.
String masquerTelephone(String? tel) {
  if (tel == null || tel.length < 8) return '—';
  return '${tel.substring(0, 4)} ${'•' * (tel.length - 7)} ${tel.substring(tel.length - 3)}';
}
