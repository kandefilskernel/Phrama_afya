import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/cadre_auth.dart';

/// Un compte de prêteur s'est connecté : cette application est faite pour les pharmacies.
class ReserveEcran extends ConsumerWidget {
  const ReserveEcran({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CadreAuth(
      titre: 'Application réservée aux pharmacies',
      sousTitre: 'Les dépôts, IMF et banques gèrent leurs demandes et leurs remboursements sur le site web de Nuru ya Afya.',
      enfants: [
        const BandeauInfo(texte: 'Connectez-vous sur le site avec votre numéro de téléphone pour accéder à votre espace prêteur.'),
        const SizedBox(height: 24),
        OutlinedButton(onPressed: () => ref.read(sessionProvider.notifier).fermer(surServeur: true), child: const Text('Se déconnecter')),
      ],
    );
  }
}
