import 'package:flutter/material.dart';

import '../composants/logo.dart';
import '../theme.dart';

/// Affiché le temps de lire la session enregistrée sur le téléphone.
class DemarrageEcran extends StatelessWidget {
  const DemarrageEcran({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MarqueNuru(taille: 56),
            SizedBox(height: 28),
            SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.5, color: Couleurs.marque600)),
          ],
        ),
      ),
    );
  }
}
