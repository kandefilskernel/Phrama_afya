import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formats.dart';
import '../../../domaine/demande.dart';
import '../../../etat/fournisseurs.dart';
import '../../actualiser.dart';
import '../../composants/bandeaux.dart';
import '../../composants/bandeaux_file.dart';
import '../../composants/carte.dart';
import '../../composants/cartes_metier.dart';
import '../../composants/etats.dart';
import '../../theme.dart';

/// Vue d'ensemble : ce que la pharmacie peut encore prendre à crédit, et ce qui demande son attention.
class AccueilEcran extends ConsumerWidget {
  const AccueilEcran({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final acteur = ref.watch(sessionProvider).value?.acteur;
    final demandes = ref.watch(demandesProvider);
    final credits = ref.watch(creditsProvider);
    final file = ref.watch(fileProvider).value ?? EtatFile.vide;
    final maintenant = ref.watch(horlogeProvider)();

    final horsLigne = (demandes.value?.horsLigne ?? false) || (credits.value?.horsLigne ?? false);
    final copieDu = demandes.value?.le ?? credits.value?.le;

    final liste = demandes.value?.donnees ?? const <Demande>[];
    final aConfirmer = liste.where((d) => d.aConfirmer).toList();
    final enRetard = liste.where((d) => d.enRetard && d.resteDu).toList();
    final totalDu = liste.where((d) => d.resteDu).fold<int>(0, (s, d) => s + d.soldeCents);
    final recentes = liste.take(3).toList();

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => actualiserTout(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
            children: [
              Text('Bonjour', style: const TextStyle(fontSize: 13, color: Couleurs.ardoise500)),
              Text(acteur?.nom ?? '', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.4)),
              const SizedBox(height: 16),
              if (horsLigne) ...[BandeauHorsLigne(le: copieDu, maintenant: maintenant), const SizedBox(height: 12)],
              const BandeauxRejets(),
              for (final c in file.commandes) ...[CarteEnAttente(commande: c), const SizedBox(height: 12)],
              if (enRetard.isNotEmpty) ...[
                BandeauInfo(
                  ton: TonBandeau.erreur,
                  titre: enRetard.length == 1 ? 'Un remboursement est en retard' : '${enRetard.length} remboursements sont en retard',
                  texte: 'Tant qu’il n’est pas réglé auprès du prêteur, il ne peut plus valider de nouveau crédit.',
                ),
                const SizedBox(height: 12),
              ],
              if (aConfirmer.isNotEmpty) ...[
                BandeauInfo(
                  ton: TonBandeau.attention,
                  titre: aConfirmer.length == 1 ? 'Une livraison attend votre confirmation' : '${aConfirmer.length} livraisons attendent votre confirmation',
                  texte: 'Vérifiez les produits reçus, puis confirmez la réception.',
                  action: TextButton(
                    onPressed: () => context.go('/demandes/${aConfirmer.first.id}'),
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(48, 36), alignment: Alignment.centerLeft),
                    child: const Text('Ouvrir la demande'),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (totalDu > 0)
                CarteNuru(
                  child: Row(
                    children: [
                      const Icon(Icons.account_balance_wallet_outlined, color: Couleurs.ardoise500),
                      const SizedBox(width: 12),
                      Expanded(child: Text('Total restant à rembourser', style: const TextStyle(color: Couleurs.ardoise600))),
                      Text(usd(totalDu), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                    ],
                  ),
                ),
              TitreSection('Votre crédit', action: TextButton(onPressed: () => context.go('/preteurs'), child: const Text('Prêteurs'))),
              credits.when(
                loading: () => const ChargementListe(),
                error: (e, _) => ErreurChargement(erreur: e, reessayer: () => ref.invalidate(creditsProvider)),
                data: (l) => l.donnees.isEmpty
                    ? EtatVide(
                        icone: Icons.storefront_outlined,
                        titre: 'Pas encore de crédit',
                        texte: 'Faites une première demande à un prêteur : votre plafond de départ s’ouvrira à sa validation.',
                        action: FilledButton(onPressed: () => context.go('/demandes/nouvelle'), style: FilledButton.styleFrom(minimumSize: const Size(200, 48)), child: const Text('Nouvelle demande')),
                      )
                    : Column(children: [for (final c in l.donnees) Padding(padding: const EdgeInsets.only(bottom: 12), child: CarteCredit(credit: c))]),
              ),
              TitreSection('Dernières demandes', action: TextButton(onPressed: () => context.go('/demandes'), child: const Text('Tout voir'))),
              demandes.when(
                loading: () => const ChargementListe(),
                error: (e, _) => ErreurChargement(erreur: e, reessayer: () => ref.invalidate(demandesProvider)),
                data: (_) => recentes.isEmpty
                    ? const EtatVide(icone: Icons.receipt_long_outlined, titre: 'Aucune demande', texte: 'Vos demandes de produits à crédit apparaîtront ici.')
                    : Column(
                        children: [
                          for (final d in recentes)
                            Padding(padding: const EdgeInsets.only(bottom: 12), child: CarteDemande(demande: d, maintenant: maintenant, onTap: () => context.go('/demandes/${d.id}'))),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
