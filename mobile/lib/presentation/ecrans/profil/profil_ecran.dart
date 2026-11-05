import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config.dart';
import '../../../core/telephone.dart';
import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux_file.dart';
import '../../composants/carte.dart';
import '../../composants/pastille.dart';
import '../../theme.dart';

class ProfilEcran extends ConsumerWidget {
  const ProfilEcran({super.key});

  Future<void> _deconnecter(BuildContext context, WidgetRef ref, int enAttente) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Se déconnecter ?'),
        content: Text(enAttente > 0
            ? 'Vous avez $enAttente action${enAttente > 1 ? 's' : ''} en attente d’envoi. Elles restent sur ce téléphone et partiront à votre prochaine connexion.'
            : 'Vous devrez saisir un nouveau code reçu par SMS pour vous reconnecter.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Rester connecté')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Se déconnecter')),
        ],
      ),
    );
    if (ok ?? false) await ref.read(sessionProvider.notifier).fermer(surServeur: true);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider).value;
    final acteur = session?.acteur;
    final enAttente = ref.watch(fileProvider).value?.commandes.length ?? 0;
    if (acteur == null) return const Scaffold();

    Widget ligne(String nom, String? valeur) => valeur == null || valeur.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text(nom, style: const TextStyle(color: Couleurs.ardoise600))),
              const SizedBox(width: 12),
              Flexible(child: Text(valeur, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
            ]),
          );

    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          const BandeauxRejets(),
          CarteNuru(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(child: Text(acteur.nom, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700))),
                  const Pastille('Actif', ton: TonPastille.ok),
                ]),
                const SizedBox(height: 8),
                ligne('Téléphone', acteur.telephone == null ? null : masquerTelephone(acteur.telephone!)),
                ligne('Numéro d’agrément', acteur.numeroAgrement),
                ligne('Adresse', acteur.adresse),
              ],
            ),
          ),
          const TitreSection('Synchronisation'),
          CarteNuru(
            child: Row(
              children: [
                Icon(enAttente > 0 ? Icons.schedule_send_rounded : Icons.cloud_done_outlined, color: enAttente > 0 ? Couleurs.lumiere700 : Couleurs.marque600),
                const SizedBox(width: 12),
                Expanded(child: Text(enAttente > 0 ? '$enAttente action${enAttente > 1 ? 's' : ''} en attente d’envoi' : 'Tout est à jour', style: const TextStyle(fontWeight: FontWeight.w500))),
                if (enAttente > 0) TextButton(onPressed: () => ref.read(fileProvider.notifier).vider(), child: const Text('Envoyer')),
              ],
            ),
          ),
          const SizedBox(height: 28),
          OutlinedButton.icon(onPressed: () => _deconnecter(context, ref, enAttente), icon: const Icon(Icons.logout_rounded), label: const Text('Se déconnecter')),
          const SizedBox(height: 20),
          Center(child: Text('Nuru ya Afya · ${Config.apiUrl}', style: const TextStyle(fontSize: 11.5, color: Couleurs.ardoise500))),
        ],
      ),
    );
  }
}
