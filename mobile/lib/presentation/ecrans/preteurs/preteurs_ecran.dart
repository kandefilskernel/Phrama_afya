import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formats.dart';
import '../../../etat/fournisseurs.dart';
import '../../actualiser.dart';
import '../../composants/bandeaux.dart';
import '../../composants/carte.dart';
import '../../composants/etats.dart';
import '../../libelles.dart';
import '../../theme.dart';
import '../demandes/nouvelle_demande_ecran.dart' show ResumeConditions;

/// Les prêteurs et leurs conditions, publiques : on sait à quoi s'attendre avant de demander.
class PreteursEcran extends ConsumerWidget {
  const PreteursEcran({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final creanciers = ref.watch(creanciersProvider);
    final maintenant = ref.watch(horlogeProvider)();

    return Scaffold(
      appBar: AppBar(title: const Text('Prêteurs')),
      body: RefreshIndicator(
        onRefresh: () => actualiserTout(ref),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const Text('Chaque prêteur fixe ses propres conditions. Votre plafond monte chez lui à mesure que vous remboursez à temps.', style: TextStyle(color: Couleurs.ardoise600, height: 1.4)),
            const SizedBox(height: 14),
            if (creanciers.value?.horsLigne ?? false) ...[BandeauHorsLigne(le: creanciers.value!.le, maintenant: maintenant), const SizedBox(height: 12)],
            creanciers.when(
              loading: () => const ChargementListe(),
              error: (e, _) => ErreurChargement(erreur: e, reessayer: () => ref.invalidate(creanciersProvider)),
              data: (l) => l.donnees.isEmpty
                  ? const EtatVide(icone: Icons.storefront_outlined, titre: 'Aucun prêteur', texte: 'Les prêteurs agréés apparaîtront ici.')
                  : Column(
                      children: [
                        for (final c in l.donnees)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: CarteNuru(
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
                                            Text(c.nom, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                                            Text('${typePreteur(c.type)} · départ à ${usd(c.conditions.plafondDepartCents)}', style: const TextStyle(fontSize: 12.5, color: Couleurs.ardoise500)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 14),
                                  ResumeConditions(conditions: c.conditions),
                                  const SizedBox(height: 12),
                                  OutlinedButton(
                                    onPressed: () => context.go('/demandes/nouvelle?creancier=${c.id}'),
                                    child: const Text('Faire une demande'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
