import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/erreurs.dart';
import '../../../core/telephone.dart';
import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/cadre_auth.dart';

/// Étape 1 : le numéro de téléphone. Un code part par SMS.
class ConnexionEcran extends ConsumerStatefulWidget {
  const ConnexionEcran({super.key});

  @override
  ConsumerState<ConnexionEcran> createState() => _ConnexionEtat();
}

class _ConnexionEtat extends ConsumerState<ConnexionEcran> {
  final _telephone = TextEditingController();
  bool _envoi = false;
  String? _erreur;

  @override
  void dispose() {
    _telephone.dispose();
    super.dispose();
  }

  Future<void> _continuer() async {
    final numero = normaliserTelephone(_telephone.text);
    if (numero == null) {
      setState(() => _erreur = 'Numéro invalide. Exemple : +243 81 234 5678 ou 0812345678.');
      return;
    }
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      await ref.read(depotAuthProvider).demanderCode(numero);
      if (!mounted) return;
      ref.read(telephoneEnCoursProvider.notifier).definir(numero);
      context.push('/connexion/code');
    } on Object catch (e) {
      if (mounted) setState(() => _erreur = messageErreur(e));
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return CadreAuth(
      titre: 'Connexion',
      sousTitre: 'Entrez le numéro de votre pharmacie. Nous vous envoyons un code par SMS.',
      enfants: [
        TextField(
          controller: _telephone,
          keyboardType: TextInputType.phone,
          autofillHints: const [AutofillHints.telephoneNumber],
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _continuer(),
          decoration: const InputDecoration(labelText: 'Numéro de téléphone', hintText: '+243 81 234 5678', prefixIcon: Icon(Icons.phone_outlined)),
        ),
        if (_erreur != null) ...[const SizedBox(height: 14), BandeauInfo(texte: _erreur!, ton: TonBandeau.erreur)],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _envoi ? null : _continuer,
          child: _envoi ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Recevoir un code par SMS'),
        ),
        const SizedBox(height: 16),
        Center(
          child: TextButton(onPressed: () => context.push('/inscription'), child: const Text('Pas encore de compte ? Inscrire ma pharmacie')),
        ),
      ],
    );
  }
}
