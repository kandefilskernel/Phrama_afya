import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/erreurs.dart';
import '../../../core/telephone.dart';
import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/cadre_auth.dart';

/// Inscription d'une pharmacie : ses coordonnées et son numéro d'agrément, que l'équipe vérifie ensuite.
class InscriptionEcran extends ConsumerStatefulWidget {
  const InscriptionEcran({super.key});

  @override
  ConsumerState<InscriptionEcran> createState() => _InscriptionEtat();
}

class _InscriptionEtat extends ConsumerState<InscriptionEcran> {
  final _cle = GlobalKey<FormState>();
  final _nom = TextEditingController();
  final _telephone = TextEditingController();
  final _agrement = TextEditingController();
  final _adresse = TextEditingController();
  bool _envoi = false;
  String? _erreur;

  @override
  void dispose() {
    for (final c in [_nom, _telephone, _agrement, _adresse]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _inscrire() async {
    if (!(_cle.currentState?.validate() ?? false)) return;
    final numero = normaliserTelephone(_telephone.text)!;
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      final jeton = await ref.read(depotAuthProvider).inscrire(nom: _nom.text.trim(), telephone: numero, numeroAgrement: _agrement.text.trim(), adresse: _adresse.text);
      if (!mounted) return;
      await ref.read(inscriptionProvider.notifier).definir(InscriptionEnCours(telephone: numero, jetonProvisoire: jeton));
      if (!mounted) return;
      context.go('/inscription/code');
    } on Object catch (e) {
      if (mounted) setState(() => _erreur = messageErreur(e));
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  String? _obligatoire(String? v, {int min = 2}) => (v == null || v.trim().length < min) ? 'À remplir' : null;

  @override
  Widget build(BuildContext context) {
    return CadreAuth(
      titre: 'Inscrire ma pharmacie',
      sousTitre: 'Trois étapes : vous vous inscrivez, vous confirmez votre téléphone par SMS, puis notre équipe vérifie votre agrément.',
      retour: () => context.go('/connexion'),
      enfants: [
        Form(
          key: _cle,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(controller: _nom, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Nom de la pharmacie'), validator: _obligatoire),
              const SizedBox(height: 14),
              TextFormField(
                controller: _telephone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Téléphone', hintText: '+243 81 234 5678', helperText: 'Un code de vérification y sera envoyé. Vous vous en servirez pour vous connecter.', helperMaxLines: 2),
                validator: (v) => normaliserTelephone(v ?? '') == null ? 'Numéro invalide. Exemple : 0812345678' : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _agrement,
                decoration: const InputDecoration(labelText: "Numéro d'agrément", helperText: "Délivré par l'ordre des pharmaciens. Notre équipe le vérifie.", helperMaxLines: 2),
                validator: (v) => _obligatoire(v, min: 3),
              ),
              const SizedBox(height: 14),
              TextFormField(controller: _adresse, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Adresse (facultatif)')),
            ],
          ),
        ),
        if (_erreur != null) ...[const SizedBox(height: 14), BandeauInfo(texte: _erreur!, ton: TonBandeau.erreur)],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _envoi ? null : _inscrire,
          child: _envoi ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Créer mon compte'),
        ),
        const SizedBox(height: 12),
        Center(child: TextButton(onPressed: () => context.go('/connexion'), child: const Text('Déjà un compte ? Se connecter'))),
      ],
    );
  }
}
