import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/erreurs.dart';
import '../../../core/formats.dart';
import '../../../domaine/creancier.dart';
import '../../../domaine/credit.dart';
import '../../../domaine/demande.dart';
import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/carte.dart';
import '../../composants/etats.dart';
import '../../libelles.dart';
import '../../theme.dart';

class _Ligne {
  final produit = TextEditingController();
  final quantite = TextEditingController(text: '1');

  void liberer() {
    produit.dispose();
    quantite.dispose();
  }
}

/// Demande de produits à un prêteur. Fonctionne sans réseau : la demande part au retour de la connexion.
class NouvelleDemandeEcran extends ConsumerStatefulWidget {
  const NouvelleDemandeEcran({super.key, this.creancierInitial});

  final String? creancierInitial;

  @override
  ConsumerState<NouvelleDemandeEcran> createState() => _NouvelleEtat();
}

class _NouvelleEtat extends ConsumerState<NouvelleDemandeEcran> {
  final _cle = GlobalKey<FormState>();
  final _lignes = <_Ligne>[_Ligne()];
  final _note = TextEditingController();
  String? _creancierId;
  bool _envoi = false;
  String? _erreur;

  @override
  void initState() {
    super.initState();
    _creancierId = widget.creancierInitial;
  }

  @override
  void dispose() {
    for (final l in _lignes) {
      l.liberer();
    }
    _note.dispose();
    super.dispose();
  }

  void _retour() => context.canPop() ? context.pop() : context.go('/demandes');

  Future<void> _envoyer() async {
    if (_creancierId == null) {
      setState(() => _erreur = 'Choisissez un prêteur.');
      return;
    }
    if (!(_cle.currentState?.validate() ?? false)) return;
    final lignes = [for (final l in _lignes) LigneDemande(produit: l.produit.text.trim(), quantite: int.parse(l.quantite.text))];
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      final resultat = await ref.read(depotDemandesProvider)!.soumettre(creancierId: _creancierId!, lignes: lignes, note: _note.text);
      ref
        ..invalidate(demandesProvider)
        ..invalidate(creditsProvider);
      await ref.read(fileProvider.notifier).rafraichir();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(resultat.enAttente ? 'Pas de réseau : votre demande partira dès le retour de la connexion.' : 'Demande envoyée au prêteur.'),
      ));
      final d = resultat.demande;
      if (d != null) {
        context.go('/demandes/${d.id}');
      } else {
        context.go('/demandes');
      }
    } on Object catch (e) {
      if (mounted) setState(() => _erreur = messageErreur(e));
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final creanciers = ref.watch(creanciersProvider);
    final credits = ref.watch(creditsProvider).value?.donnees ?? const <CreditChezPreteur>[];

    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: _retour), title: const Text('Nouvelle demande')),
      body: creanciers.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: ChargementListe()),
        error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: ErreurChargement(erreur: e, reessayer: () => ref.invalidate(creanciersProvider))),
        data: (l) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            const Text('Chez quel prêteur ?', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            if (l.donnees.isEmpty) const EtatVide(icone: Icons.storefront_outlined, titre: 'Aucun prêteur disponible', texte: 'Les prêteurs agréés apparaîtront ici.'),
            for (final c in l.donnees) ...[
              _ChoixPreteur(
                creancier: c,
                credit: credits.where((x) => x.creancierId == c.id).firstOrNull,
                choisi: _creancierId == c.id,
                surChoix: () => setState(() {
                  _creancierId = c.id;
                  _erreur = null;
                }),
              ),
              const SizedBox(height: 10),
            ],
            const SizedBox(height: 10),
            const Text('Produits demandés', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            Form(
              key: _cle,
              child: Column(
                children: [
                  for (var i = 0; i < _lignes.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 3,
                            child: TextFormField(
                              controller: _lignes[i].produit,
                              textCapitalization: TextCapitalization.sentences,
                              decoration: InputDecoration(labelText: 'Produit ${i + 1}', hintText: 'Paracétamol 500 mg'),
                              validator: (v) => (v == null || v.trim().length < 2) ? 'À remplir' : null,
                            ),
                          ),
                          const SizedBox(width: 10),
                          SizedBox(
                            width: 88,
                            child: TextFormField(
                              controller: _lignes[i].quantite,
                              keyboardType: TextInputType.number,
                              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(5)],
                              decoration: const InputDecoration(labelText: 'Qté'),
                              validator: (v) => (int.tryParse(v ?? '') ?? 0) < 1 ? '≥ 1' : null,
                            ),
                          ),
                          if (_lignes.length > 1)
                            IconButton(
                              tooltip: 'Retirer ce produit',
                              onPressed: () => setState(() => _lignes.removeAt(i).liberer()),
                              icon: const Icon(Icons.close_rounded),
                            ),
                        ],
                      ),
                    ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _lignes.length >= 20 ? null : () => setState(() => _lignes.add(_Ligne())),
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Ajouter un produit'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(controller: _note, maxLines: 3, maxLength: 300, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Note pour le prêteur (facultatif)')),
                ],
              ),
            ),
            const BandeauInfo(texte: 'Le prêteur fixe la valeur des produits et le délai de remboursement. Le paiement se règle directement avec lui : Nuru ya Afya ne touche pas à l’argent.'),
            if (_erreur != null) ...[const SizedBox(height: 14), BandeauInfo(texte: _erreur!, ton: TonBandeau.erreur)],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _envoi ? null : _envoyer,
              child: _envoi ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Text('Envoyer la demande'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChoixPreteur extends StatelessWidget {
  const _ChoixPreteur({required this.creancier, required this.credit, required this.choisi, required this.surChoix});

  final Creancier creancier;
  final CreditChezPreteur? credit;
  final bool choisi;
  final VoidCallback surChoix;

  @override
  Widget build(BuildContext context) {
    final c = creancier;
    final bloque = credit?.bloque ?? false;
    final disponible = credit?.disponibleCents ?? c.conditions.plafondDepartCents;
    return Semantics(
      selected: choisi,
      button: true,
      child: Material(
        color: choisi ? Couleurs.marque50 : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: choisi ? Couleurs.marque600 : Couleurs.ardoise200, width: choisi ? 2 : 1)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: surChoix,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(choisi ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, color: choisi ? Couleurs.marque600 : Couleurs.ardoise500),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c.nom, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                      Text(typePreteur(c.type), style: const TextStyle(fontSize: 12.5, color: Couleurs.ardoise500)),
                      const SizedBox(height: 6),
                      Text(
                        bloque ? 'Crédits suspendus : un remboursement est en retard' : (credit == null ? 'Plafond de départ : ${usd(disponible)}' : 'Disponible : ${usd(disponible)}'),
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: bloque ? Couleurs.rouge700 : Couleurs.marque700),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Résumé des conditions d'un prêteur, partagé avec l'écran des prêteurs.
class ResumeConditions extends StatelessWidget {
  const ResumeConditions({super.key, required this.conditions});

  final Conditions conditions;

  @override
  Widget build(BuildContext context) {
    final c = conditions;
    Widget ligne(String a, String b) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text(a, style: const TextStyle(color: Couleurs.ardoise600, fontSize: 13.5))),
            const SizedBox(width: 12),
            Flexible(child: Text(b, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5))),
          ]),
        );
    return CarteNuru(
      couleur: Couleurs.fond,
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          ligne('Paliers de plafond', '${c.paliersUSD.join(' → ')} USD'),
          ligne('Remboursements à temps pour monter', '${c.seriesRequises}'),
          ligne('Délai par défaut / maximal', '${c.delaiDefautJours} / ${c.delaiMaxJours} jours'),
          ligne('Grâce après l’échéance', '${c.graceJours} jours'),
          ligne('Réponse attendue sous', '${c.expirationHeures} h'),
        ],
      ),
    );
  }
}
