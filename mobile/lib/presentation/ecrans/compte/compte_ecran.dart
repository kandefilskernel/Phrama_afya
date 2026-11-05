import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/cadre_auth.dart';
import '../../theme.dart';

/// Compte pas encore utilisable : en attente de vérification, rejeté ou suspendu.
class CompteEcran extends ConsumerStatefulWidget {
  const CompteEcran({super.key});

  @override
  ConsumerState<CompteEcran> createState() => _CompteEtat();
}

class _CompteEtat extends ConsumerState<CompteEcran> {
  bool _actualisation = false;

  Future<void> _actualiser() async {
    setState(() => _actualisation = true);
    await ref.read(sessionProvider.notifier).rafraichirCompte();
    if (mounted) setState(() => _actualisation = false);
  }

  @override
  Widget build(BuildContext context) {
    final acteur = ref.watch(sessionProvider).value?.acteur;
    if (acteur == null) return const Scaffold();

    final (titre, texte, ton) = switch (acteur.statut) {
      'EN_ATTENTE' => (
          'Vérification de votre agrément',
          'Notre équipe vérifie votre numéro d’agrément (${acteur.numeroAgrement ?? '—'}). Vous recevrez un SMS dès que votre compte sera validé.',
          TonBandeau.attention,
        ),
      'REJETE' => ('Inscription non retenue', '${acteur.motif ?? 'Votre inscription n’a pas été retenue.'} Vous pouvez vous réinscrire avec des informations corrigées.', TonBandeau.erreur),
      'SUSPENDU' => ('Compte suspendu', '${acteur.motif ?? 'Votre compte est suspendu.'} Contactez l’équipe pour en savoir plus.', TonBandeau.erreur),
      _ => ('Compte', 'Votre compte n’est pas encore utilisable.', TonBandeau.info),
    };

    return CadreAuth(
      titre: acteur.nom,
      sousTitre: 'Pharmacie',
      enfants: [
        BandeauInfo(titre: titre, texte: texte, ton: ton),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _actualisation ? null : _actualiser,
          child: _actualisation ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Actualiser le statut'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: () => ref.read(sessionProvider.notifier).fermer(surServeur: true), child: const Text('Se déconnecter')),
        const SizedBox(height: 16),
        const Center(child: Text('Dès que votre compte est validé, vos demandes et votre plafond apparaissent ici.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: Couleurs.ardoise500))),
      ],
    );
  }
}
