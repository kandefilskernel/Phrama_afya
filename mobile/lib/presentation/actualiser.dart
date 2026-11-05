import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../etat/fournisseurs.dart';

/// Tirer pour actualiser : on envoie d'abord ce qui attend, puis on relit les données.
Future<void> actualiserTout(WidgetRef ref) async {
  await ref.read(fileProvider.notifier).vider();
  ref
    ..invalidate(demandesProvider)
    ..invalidate(creditsProvider)
    ..invalidate(creanciersProvider);
  await Future.wait([
    ref.read(demandesProvider.future).then((_) {}, onError: (_) {}),
    ref.read(creditsProvider.future).then((_) {}, onError: (_) {}),
  ]);
}
