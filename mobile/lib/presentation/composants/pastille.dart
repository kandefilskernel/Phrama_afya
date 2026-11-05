import 'package:flutter/material.dart';

import '../theme.dart';

enum TonPastille { neutre, attente, ok, alerte, fin }

/// Étiquette d'état avec un point de couleur : le sens ne repose jamais sur la couleur seule.
class Pastille extends StatelessWidget {
  const Pastille(this.texte, {super.key, this.ton = TonPastille.neutre});

  final String texte;
  final TonPastille ton;

  @override
  Widget build(BuildContext context) {
    final (fond, texteCouleur, point) = switch (ton) {
      TonPastille.neutre => (Couleurs.ardoise100, Couleurs.ardoise600, Couleurs.ardoise500),
      TonPastille.attente => (Couleurs.lumiere50, Couleurs.lumiere700, Couleurs.lumiere500),
      TonPastille.ok => (Couleurs.marque50, Couleurs.marque800, Couleurs.marque500),
      TonPastille.alerte => (Couleurs.rouge50, Couleurs.rouge700, Couleurs.rouge600),
      TonPastille.fin => (Couleurs.ciel50, Couleurs.ciel700, const Color(0xFF0EA5E9)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: fond, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: point, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Flexible(child: Text(texte, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: texteCouleur), overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}
