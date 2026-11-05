import 'package:flutter/material.dart';

import '../../core/formats.dart';
import '../../domaine/credit.dart';
import '../../domaine/demande.dart';
import '../../donnees/file_attente.dart';
import '../libelles.dart';
import '../theme.dart';
import 'carte.dart';
import 'jauge.dart';
import 'pastille.dart';

/// « 4 déc. 2026 (dans 30 jours) », avec le retard en rouge.
({String texte, bool retard}) echeance(int? echeanceLe, int maintenantMs) {
  final j = joursRestants(echeanceLe, maintenantMs);
  if (j == null) return (texte: '—', retard: false);
  final date = dateCourte(echeanceLe);
  if (j > 1) return (texte: '$date (dans $j jours)', retard: false);
  if (j == 1) return (texte: '$date (demain)', retard: false);
  if (j == 0) return (texte: "$date (aujourd'hui)", retard: false);
  return (texte: '$date (en retard de ${-j} jour${-j > 1 ? 's' : ''})', retard: true);
}

/// Une demande dans une liste : lisible d'un coup d'œil, facile à toucher.
class CarteDemande extends StatelessWidget {
  const CarteDemande({super.key, required this.demande, required this.maintenant, required this.onTap});

  final Demande demande;
  final DateTime maintenant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final d = demande;
    final e = echeance(d.echeanceLe, maintenant.millisecondsSinceEpoch);
    return CarteNuru(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(d.creancierNom ?? '—', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16), overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text('${typePreteur(d.creancierType)} · ${dateCourte(d.creeLe)}', style: const TextStyle(fontSize: 12.5, color: Couleurs.ardoise500)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Flexible(child: d.enRetard ? const Pastille('En retard', ton: TonPastille.alerte) : Pastille(libelleEtat(d.etat), ton: tonEtat(d.etat))),
            ],
          ),
          const SizedBox(height: 10),
          Text(d.resume(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Couleurs.ardoise600, height: 1.35)),
          if (d.valeurCents != null) ...[
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(d.etat == EtatDemande.receptionnee ? 'Reste dû' : 'Montant', style: const TextStyle(fontSize: 12, color: Couleurs.ardoise500)),
                    Text(usd(d.etat == EtatDemande.receptionnee ? d.soldeCents : d.valeurCents), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                  ],
                ),
                const Spacer(),
                if (d.etat == EtatDemande.receptionnee)
                  Flexible(
                    child: Text(e.texte, textAlign: TextAlign.right, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: e.retard ? Couleurs.rouge700 : Couleurs.ardoise600)),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Une action faite hors ligne, qui part au retour du réseau.
class CarteEnAttente extends StatelessWidget {
  const CarteEnAttente({super.key, required this.commande});

  final Commande commande;

  @override
  Widget build(BuildContext context) {
    return CarteNuru(
      couleur: Couleurs.lumiere50,
      child: Row(
        children: [
          const Icon(Icons.schedule_send_rounded, color: Couleurs.lumiere700),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("En attente d'envoi", style: TextStyle(fontWeight: FontWeight.w700, color: Couleurs.lumiere700)),
                const SizedBox(height: 2),
                Text(commande.libelle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Couleurs.lumiere700, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Plafond, disponible et progression d'une pharmacie chez un prêteur.
class CarteCredit extends StatelessWidget {
  const CarteCredit({super.key, required this.credit});

  final CreditChezPreteur credit;

  @override
  Widget build(BuildContext context) {
    final c = credit;
    return CarteNuru(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: Couleurs.marque50, borderRadius: BorderRadius.circular(10)),
                child: Text(initiales(c.nom), style: const TextStyle(fontWeight: FontWeight.w700, color: Couleurs.marque700)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c.nom, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16), overflow: TextOverflow.ellipsis),
                    Text(typePreteur(c.type), style: const TextStyle(fontSize: 12.5, color: Couleurs.ardoise500)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Flexible(child: c.bloque ? const Pastille('Crédits suspendus', ton: TonPastille.alerte) : Pastille('Palier ${c.palier + 1}', ton: TonPastille.ok)),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Disponible', style: TextStyle(fontSize: 12, color: Couleurs.ardoise500)),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(usd(c.disponibleCents), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -0.5, height: 1.15)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Spacer(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('plafond', style: TextStyle(fontSize: 12, color: Couleurs.ardoise500)),
                  Text(usd(c.plafondCents), style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Jauge(taux: c.tauxUtilisation, alerte: c.bloque, libelle: 'Plafond utilisé chez ${c.nom}'),
          const SizedBox(height: 6),
          Text('${usd(c.encoursCents)} en cours', style: const TextStyle(fontSize: 12.5, color: Couleurs.ardoise500)),
          if (c.prochainPlafondCents != null && !c.bloque) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Couleurs.marque50, borderRadius: BorderRadius.circular(10)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.trending_up_rounded, size: 18, color: Couleurs.marque600),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      c.remboursementsManquants > 0
                          ? 'Encore ${c.remboursementsManquants} remboursement${c.remboursementsManquants > 1 ? 's' : ''} à temps pour passer à ${usd(c.prochainPlafondCents)}.'
                          : 'Prochain remboursement à temps : plafond de ${usd(c.prochainPlafondCents)}.',
                      style: const TextStyle(fontSize: 13, color: Couleurs.marque800, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
