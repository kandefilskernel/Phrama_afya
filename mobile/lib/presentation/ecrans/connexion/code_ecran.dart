import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/erreurs.dart';
import '../../../core/telephone.dart';
import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/cadre_auth.dart';
import '../../theme.dart';

/// Étape 2 : le code reçu par SMS. Il ouvre une session qui expire côté serveur.
class CodeEcran extends ConsumerStatefulWidget {
  const CodeEcran({super.key});

  @override
  ConsumerState<CodeEcran> createState() => _CodeEtat();
}

class _CodeEtat extends ConsumerState<CodeEcran> {
  static const _delaiRenvoi = 60;

  final _code = TextEditingController();
  Timer? _minuterie;
  int _attente = _delaiRenvoi;
  bool _envoi = false;
  String? _erreur;
  String? _info;

  @override
  void initState() {
    super.initState();
    _demarrerCompteARebours();
  }

  @override
  void dispose() {
    _minuterie?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _demarrerCompteARebours() {
    _minuterie?.cancel();
    setState(() => _attente = _delaiRenvoi);
    _minuterie = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _attente = _attente - 1);
      if (_attente <= 0) t.cancel();
    });
  }

  Future<void> _valider() async {
    final telephone = ref.read(telephoneEnCoursProvider);
    if (telephone == null || _code.text.length != 6) return;
    setState(() {
      _envoi = true;
      _erreur = null;
      _info = null;
    });
    try {
      final session = await ref.read(depotAuthProvider).ouvrirSession(telephone, _code.text);
      await ref.read(sessionProvider.notifier).ouvrir(session);
      ref.read(telephoneEnCoursProvider.notifier).definir(null);
      // La redirection du routeur emmène l'utilisateur vers son espace.
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _erreur = messageErreur(e);
        _code.clear();
      });
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _renvoyer() async {
    final telephone = ref.read(telephoneEnCoursProvider);
    if (telephone == null) return;
    try {
      await ref.read(depotAuthProvider).demanderCode(telephone);
      if (!mounted) return;
      setState(() {
        _info = 'Si ce numéro correspond à un compte, un nouveau code vient de vous être envoyé.';
        _erreur = null;
      });
      _demarrerCompteARebours();
    } on Object catch (e) {
      if (mounted) setState(() => _erreur = messageErreur(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final telephone = ref.watch(telephoneEnCoursProvider);
    // Écran rouvert sans numéro (application relancée) : retour à la saisie.
    if (telephone == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/connexion');
      });
      return const Scaffold();
    }

    return CadreAuth(
      titre: 'Saisissez votre code',
      sousTitre: 'Si le numéro ${masquerTelephone(telephone)} correspond à un compte, un code à 6 chiffres vient de lui être envoyé. Il est valable 5 minutes.',
      retour: () => context.go('/connexion'),
      enfants: [
        ChampCode(
          controleur: _code,
          surChangement: (v) {
            setState(() {});
            if (v.length == 6) _valider();
          },
        ),
        if (_erreur != null) ...[const SizedBox(height: 14), BandeauInfo(texte: _erreur!, ton: TonBandeau.erreur)],
        if (_info != null) ...[const SizedBox(height: 14), BandeauInfo(texte: _info!, ton: TonBandeau.succes)],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: _envoi || _code.text.length != 6 ? null : _valider,
          child: _envoi ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Me connecter'),
        ),
        const SizedBox(height: 12),
        Center(
          child: _attente > 0
              ? Text('Renvoyer le code dans $_attente s', style: const TextStyle(color: Couleurs.ardoise500))
              : TextButton(onPressed: _renvoyer, child: const Text('Renvoyer le code')),
        ),
        Center(child: TextButton(onPressed: () => context.go('/connexion'), child: const Text('Changer de numéro'))),
      ],
    );
  }
}
