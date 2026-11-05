import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../etat/fournisseurs.dart';

/// Barre de navigation du bas, commune aux quatre sections de l'application.
class Coquille extends ConsumerWidget {
  const Coquille({super.key, required this.coque});

  final StatefulNavigationShell coque;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enAttente = ref.watch(fileProvider).value?.commandes.length ?? 0;
    final rejets = ref.watch(fileProvider).value?.rejets.length ?? 0;

    return Scaffold(
      body: coque,
      bottomNavigationBar: NavigationBar(
        selectedIndex: coque.currentIndex,
        // Toucher l'onglet déjà ouvert revient au début de sa pile.
        onDestinationSelected: (i) => coque.goBranch(i, initialLocation: i == coque.currentIndex),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Accueil'),
          NavigationDestination(
            icon: Badge(isLabelVisible: enAttente > 0, label: Text('$enAttente'), child: const Icon(Icons.receipt_long_outlined)),
            selectedIcon: Badge(isLabelVisible: enAttente > 0, label: Text('$enAttente'), child: const Icon(Icons.receipt_long_rounded)),
            label: 'Demandes',
          ),
          const NavigationDestination(icon: Icon(Icons.storefront_outlined), selectedIcon: Icon(Icons.storefront_rounded), label: 'Prêteurs'),
          NavigationDestination(
            icon: Badge(isLabelVisible: rejets > 0, smallSize: 9, child: const Icon(Icons.person_outline_rounded)),
            selectedIcon: Badge(isLabelVisible: rejets > 0, smallSize: 9, child: const Icon(Icons.person_rounded)),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
