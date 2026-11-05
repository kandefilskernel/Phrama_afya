import 'package:flutter/material.dart';

import '../../core/erreurs.dart';
import '../theme.dart';

/// Écran ou zone sans contenu : une icône, ce qui manque, et si possible quoi faire.
class EtatVide extends StatelessWidget {
  const EtatVide({super.key, required this.icone, required this.titre, this.texte, this.action});

  final IconData icone;
  final String titre;
  final String? texte;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(14), border: Border.all(color: Couleurs.ardoise300)),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(color: Couleurs.marque50, shape: BoxShape.circle),
            child: Icon(icone, color: Couleurs.marque600, size: 26),
          ),
          const SizedBox(height: 14),
          Text(titre, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          if (texte != null) ...[
            const SizedBox(height: 6),
            Text(texte!, textAlign: TextAlign.center, style: const TextStyle(color: Couleurs.ardoise600, height: 1.4)),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}

/// Bloc gris qui occupe la place du contenu pendant le chargement.
class Squelette extends StatelessWidget {
  const Squelette({super.key, this.hauteur = 16, this.largeur, this.rayon = 8});

  final double hauteur;
  final double? largeur;
  final double rayon;

  @override
  Widget build(BuildContext context) =>
      Container(height: hauteur, width: largeur, decoration: BoxDecoration(color: Couleurs.ardoise200.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(rayon)));
}

/// Forme d'un écran de liste, affichée tout de suite pendant que les données arrivent.
class ChargementListe extends StatelessWidget {
  const ChargementListe({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Chargement en cours',
      child: Column(
        children: [
          for (var i = 0; i < 3; i++) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Couleurs.ardoise200)),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Squelette(largeur: 140, hauteur: 18), Squelette(largeur: 90, hauteur: 22, rayon: 99)]),
                  SizedBox(height: 12),
                  Squelette(hauteur: 12),
                  SizedBox(height: 8),
                  Squelette(largeur: 180, hauteur: 12),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

/// Échec de chargement avec un bouton pour réessayer.
class ErreurChargement extends StatelessWidget {
  const ErreurChargement({super.key, required this.erreur, required this.reessayer});

  final Object erreur;
  final VoidCallback reessayer;

  @override
  Widget build(BuildContext context) {
    final horsLigne = erreur is ErreurApi && (erreur as ErreurApi).horsLigne;
    return EtatVide(
      icone: horsLigne ? Icons.cloud_off_rounded : Icons.error_outline_rounded,
      titre: horsLigne ? 'Pas de connexion' : 'Chargement impossible',
      texte: horsLigne ? 'Rien n’est encore enregistré sur ce téléphone. Réessayez quand le réseau est revenu.' : messageErreur(erreur),
      action: OutlinedButton(onPressed: reessayer, style: OutlinedButton.styleFrom(minimumSize: const Size(160, 48)), child: const Text('Réessayer')),
    );
  }
}
