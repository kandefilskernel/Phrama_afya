import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/erreurs.dart';
import '../../../core/telephone.dart';
import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/cadre_auth.dart';
import '../../theme.dart';

/// Confirmation du téléphone d'une nouvelle inscription, puis attente de la vérification de l'agrément.
class InscriptionCodeEcran extends ConsumerStatefulWidget {
  const InscriptionCodeEcran({super.key});

  @override
  ConsumerState<InscriptionCodeEcran> createState() => _InscriptionCodeEtat();
}

class _InscriptionCodeEtat extends ConsumerState<InscriptionCodeEcran> {
  final _code = TextEditingController();
  bool _envoi = false;
  bool _confirme = false;
  String? _erreur;
  String? _info;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _verifier(InscriptionEnCours inscription) async {
    if (_code.text.length != 6) return;
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      await ref.read(depotAuthProvider).verifierTelephone(_code.text, jetonProvisoire: inscription.jetonProvisoire);
      if (!mounted) return;
      // Le jeton provisoire a fait son travail : on l'oublie. La connexion se fera par SMS.
      await ref.read(inscriptionProvider.notifier).definir(null);
      if (mounted) setState(() => _confirme = true);
    } on Object catch (e) {
      if (mounted) setState(() => _erreur = messageErreur(e));
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _renvoyer(InscriptionEnCours inscription) async {
    try {
      await ref.read(depotAuthProvider).renvoyerCodeTelephone(jetonProvisoire: inscription.jetonProvisoire);
      if (mounted) {
        setState(() {
          _info = 'Un nouveau code vous a été envoyé par SMS.';
          _erreur = null;
        });
      }
    } on Object catch (e) {
      if (mounted) setState(() => _erreur = messageErreur(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_confirme) {
      return CadreAuth(
        titre: 'Inscription reçue',
        sousTitre: 'Votre téléphone est confirmé. Notre équipe vérifie maintenant votre numéro d’agrément. Vous recevrez un SMS dès que votre compte sera validé.',
        enfants: [
          const BandeauInfo(ton: TonBandeau.succes, titre: 'Étape 2 sur 2', texte: 'Vérification de votre agrément en cours.'),
          const SizedBox(height: 24),
          FilledButton(onPressed: () => context.go('/connexion'), child: const Text('Retour à la connexion')),
        ],
      );
    }

    final inscription = ref.watch(inscriptionProvider).value;
    if (inscription == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/connexion');
      });
      return const Scaffold();
    }

    return CadreAuth(
      titre: 'Confirmez votre téléphone',
      sousTitre: 'Un code à 6 chiffres a été envoyé par SMS au ${masquerTelephone(inscription.telephone)}. Il est valable 10 minutes.',
      enfants: [
        ChampCode(
          controleur: _code,
          surChangement: (v) {
            setState(() {});
            if (v.length == 6) _verifier(inscription);
          },
        ),
        if (_erreur != null) ...[const SizedBox(height: 14), BandeauInfo(texte: _erreur!, ton: TonBandeau.erreur)],
        if (_info != null) ...[const SizedBox(height: 14), BandeauInfo(texte: _info!, ton: TonBandeau.succes)],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _envoi || _code.text.length != 6 ? null : () => _verifier(inscription),
          child: _envoi ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Confirmer'),
        ),
        const SizedBox(height: 12),
        Center(child: TextButton(onPressed: () => _renvoyer(inscription), child: const Text('Renvoyer le code'))),
        const Center(child: Text("Vous pouvez fermer l'application : à votre retour, vous reprendrez ici.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: Couleurs.ardoise500))),
      ],
    );
  }
}
