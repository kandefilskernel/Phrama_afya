import 'package:flutter/material.dart';

import '../../domaine/demande.dart';
import '../theme.dart';

const _etapes = ['Demande', 'Validation', 'Livraison', 'Réception', 'Remboursement'];

int? _position(EtatDemande e) => switch (e) {
      EtatDemande.soumise => 0,
      EtatDemande.validee => 1,
      EtatDemande.livree => 2,
      EtatDemande.receptionnee => 3,
      EtatDemande.cloturee => 5,
      _ => null, // refusée, annulée, expirée : pas de progression
    };

/// Progression d'une demande en cinq étapes. Rien ne s'affiche pour une demande refusée, annulée ou expirée.
class EtapesDemande extends StatelessWidget {
  const EtapesDemande({super.key, required this.etat});

  final EtatDemande etat;

  @override
  Widget build(BuildContext context) {
    final position = _position(etat);
    if (position == null) return const SizedBox.shrink();
    return Semantics(
      label: 'Étape ${position.clamp(0, 4) + 1} sur 5 : ${_etapes[position.clamp(0, 4)]}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < _etapes.length; i++)
            Expanded(child: _Etape(nom: _etapes[i], numero: i + 1, fait: i < position, courant: i == position, premier: i == 0, dernier: i == _etapes.length - 1)),
        ],
      ),
    );
  }
}

class _Etape extends StatelessWidget {
  const _Etape({required this.nom, required this.numero, required this.fait, required this.courant, required this.premier, required this.dernier});

  final String nom;
  final int numero;
  final bool fait;
  final bool courant;
  final bool premier;
  final bool dernier;

  @override
  Widget build(BuildContext context) {
    Widget trait(bool visible, bool actif) =>
        Expanded(child: Container(height: 2, color: visible ? (actif ? Couleurs.marque500 : Couleurs.ardoise200) : Colors.transparent));

    return Column(
      children: [
        Row(
          children: [
            trait(!premier, fait || courant),
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: fait ? Couleurs.marque600 : Colors.white,
                border: Border.all(color: fait || courant ? Couleurs.marque600 : Couleurs.ardoise200, width: courant ? 2 : 1),
              ),
              child: fait
                  ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                  : Text('$numero', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: courant ? Couleurs.marque700 : Couleurs.ardoise500)),
            ),
            trait(!dernier, fait),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          nom,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 10.5, height: 1.2, fontWeight: courant ? FontWeight.w700 : FontWeight.w500, color: courant ? Couleurs.encre : (fait ? Couleurs.ardoise600 : Couleurs.ardoise500)),
        ),
      ],
    );
  }
}
