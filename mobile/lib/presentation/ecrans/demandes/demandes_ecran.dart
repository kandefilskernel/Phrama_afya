import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../domaine/demande.dart';
import '../../../donnees/file_attente.dart';
import '../../../etat/fournisseurs.dart';
import '../../actualiser.dart';
import '../../composants/bandeaux.dart';
import '../../composants/bandeaux_file.dart';
import '../../composants/cartes_metier.dart';
import '../../composants/etats.dart';
import '../../theme.dart';

enum _Filtre { toutes, enCours, terminees }

class DemandesEcran extends ConsumerStatefulWidget {
  const DemandesEcran({super.key});

  @override
  ConsumerState<DemandesEcran> createState() => _DemandesEtat();
}

class _DemandesEtat extends ConsumerState<DemandesEcran> {
  _Filtre _filtre = _Filtre.toutes;

  static const _noms = {_Filtre.toutes: 'Toutes', _Filtre.enCours: 'En cours', _Filtre.terminees: 'Terminées'};

  bool _garde(Demande d) => switch (_filtre) {
        _Filtre.toutes => true,
        _Filtre.enCours => d.etat.estEnCours,
        _Filtre.terminees => !d.etat.estEnCours,
      };

  @override
  Widget build(BuildContext context) {
    final demandes = ref.watch(demandesProvider);
    final file = ref.watch(fileProvider).value ?? EtatFile.vide;
    final maintenant = ref.watch(horlogeProvider)();
    final attente = file.commandes.where((c) => c.type == TypeCommande.soumettre).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Mes demandes')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/demandes/nouvelle'),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nouvelle demande'),
      ),
      body: RefreshIndicator(
        onRefresh: () => actualiserTout(ref),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
          children: [
            Wrap(
              spacing: 8,
              children: [
                for (final f in _Filtre.values)
                  ChoiceChip(label: Text(_noms[f]!), selected: _filtre == f, onSelected: (_) => setState(() => _filtre = f)),
              ],
            ),
            const SizedBox(height: 14),
            if (demandes.value?.horsLigne ?? false) ...[BandeauHorsLigne(le: demandes.value!.le, maintenant: maintenant), const SizedBox(height: 12)],
            const BandeauxRejets(),
            // Les demandes faites sans réseau, pas encore parties.
            for (final c in attente) ...[CarteEnAttente(commande: c), const SizedBox(height: 12)],
            demandes.when(
              loading: () => const ChargementListe(),
              error: (e, _) => ErreurChargement(erreur: e, reessayer: () => ref.invalidate(demandesProvider)),
              data: (l) {
                final visibles = l.donnees.where(_garde).toList();
                if (visibles.isEmpty) {
                  return EtatVide(
                    icone: Icons.receipt_long_outlined,
                    titre: l.donnees.isEmpty ? 'Aucune demande' : 'Rien dans cette liste',
                    texte: l.donnees.isEmpty ? 'Demandez des produits à crédit à un dépôt, une IMF ou une banque.' : 'Essayez un autre filtre.',
                  );
                }
                return Column(
                  children: [
                    for (final d in visibles)
                      Padding(padding: const EdgeInsets.only(bottom: 12), child: CarteDemande(demande: d, maintenant: maintenant, onTap: () => context.go('/demandes/${d.id}'))),
                  ],
                );
              },
            ),
            const SizedBox(height: 4),
            const Center(child: Text('Tirez vers le bas pour actualiser.', style: TextStyle(fontSize: 12, color: Couleurs.ardoise500))),
          ],
        ),
      ),
    );
  }
}
