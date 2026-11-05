import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../etat/fournisseurs.dart';
import 'bandeaux.dart';

/// Actions refusées au renvoi, avec la raison donnée par la plateforme. L'utilisateur doit les voir et les fermer.
class BandeauxRejets extends ConsumerWidget {
  const BandeauxRejets({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rejets = ref.watch(fileProvider).value?.rejets ?? const [];
    if (rejets.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: BandeauInfo(
        ton: TonBandeau.erreur,
        titre: rejets.length == 1 ? 'Une action n’a pas pu être envoyée' : '${rejets.length} actions n’ont pas pu être envoyées',
        texte: rejets.map((r) => '${r.libelle} — ${r.message}').join('\n'),
        action: TextButton(
          onPressed: () => ref.read(fileProvider.notifier).effacerRejets(),
          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(48, 36), alignment: Alignment.centerLeft),
          child: const Text('J’ai compris'),
        ),
      ),
    );
  }
}
