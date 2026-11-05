import 'package:flutter/material.dart';

import '../theme.dart';

/// Part du plafond déjà utilisée. Devient ambre près de la limite et rouge en cas de retard.
class Jauge extends StatelessWidget {
  const Jauge({super.key, required this.taux, this.alerte = false, this.libelle = 'Plafond utilisé'});

  final double taux;
  final bool alerte;
  final String libelle;

  @override
  Widget build(BuildContext context) {
    final couleur = alerte ? Couleurs.rouge600 : (taux >= 0.85 ? Couleurs.lumiere500 : Couleurs.marque500);
    return Semantics(
      label: libelle,
      value: '${(taux * 100).round()} %',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(999),
        child: LinearProgressIndicator(value: taux.clamp(0.0, 1.0), minHeight: 8, backgroundColor: Couleurs.ardoise100, color: couleur),
      ),
    );
  }
}
