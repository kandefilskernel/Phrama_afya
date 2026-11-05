import 'package:flutter/material.dart';

import '../../core/formats.dart';
import '../theme.dart';

enum TonBandeau { info, succes, attention, erreur }

/// Message encadré, avec une icône : information, réussite, attention ou erreur.
class BandeauInfo extends StatelessWidget {
  const BandeauInfo({super.key, required this.texte, this.titre, this.ton = TonBandeau.info, this.action});

  final String texte;
  final String? titre;
  final TonBandeau ton;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final (fond, bord, couleur, icone) = switch (ton) {
      TonBandeau.info => (Couleurs.ciel50, const Color(0xFFBAE6FD), Couleurs.ciel700, Icons.info_outline_rounded),
      TonBandeau.succes => (Couleurs.marque50, Couleurs.marque200, Couleurs.marque700, Icons.check_circle_outline_rounded),
      TonBandeau.attention => (Couleurs.lumiere50, const Color(0xFFFDE68A), Couleurs.lumiere700, Icons.warning_amber_rounded),
      TonBandeau.erreur => (Couleurs.rouge50, const Color(0xFFFECACA), Couleurs.rouge700, Icons.error_outline_rounded),
    };
    return Semantics(
      liveRegion: ton == TonBandeau.erreur,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: fond, borderRadius: BorderRadius.circular(12), border: Border.all(color: bord)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icone, size: 20, color: couleur),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (titre != null) Text(titre!, style: TextStyle(fontWeight: FontWeight.w700, color: couleur, height: 1.3)),
                  Text(texte, style: TextStyle(color: couleur, height: 1.4, fontSize: 14)),
                  if (action != null) ...[const SizedBox(height: 8), action!],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bandeau discret : les données affichées sont la dernière copie enregistrée sur le téléphone.
class BandeauHorsLigne extends StatelessWidget {
  const BandeauHorsLigne({super.key, required this.le, required this.maintenant});

  final DateTime? le;
  final DateTime maintenant;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: Couleurs.ardoise100, borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 18, color: Couleurs.ardoise600),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              le == null ? 'Hors ligne' : 'Hors ligne · données de ${ilYa(le!, maintenant)}',
              style: const TextStyle(fontSize: 13, color: Couleurs.ardoise600, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}
