import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/erreurs.dart';
import '../../../core/formats.dart';
import '../../../domaine/demande.dart';
import '../../../donnees/depot_demandes.dart';
import '../../../etat/fournisseurs.dart';
import '../../composants/bandeaux.dart';
import '../../composants/carte.dart';
import '../../composants/cartes_metier.dart';
import '../../composants/etapes.dart';
import '../../composants/etats.dart';
import '../../composants/pastille.dart';
import '../../libelles.dart';
import '../../theme.dart';

class DemandeEcran extends ConsumerStatefulWidget {
  const DemandeEcran({super.key, required this.id});

  final String id;

  @override
  ConsumerState<DemandeEcran> createState() => _DemandeEtat();
}

class _DemandeEtat extends ConsumerState<DemandeEcran> {
  bool _envoi = false;

  void _retour() => context.canPop() ? context.pop() : context.go('/demandes');

  Future<bool> _confirmer(String titre, String texte, String bouton, {bool danger = false}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(titre),
        content: Text(texte),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Retour')),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            style: danger ? FilledButton.styleFrom(backgroundColor: Couleurs.rouge600) : null,
            child: Text(bouton),
          ),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _agir(Future<ResultatCommande> Function() action, String reussite) async {
    setState(() => _envoi = true);
    try {
      final resultat = await action();
      ref
        ..invalidate(demandeProvider(widget.id))
        ..invalidate(demandesProvider)
        ..invalidate(creditsProvider);
      await ref.read(fileProvider.notifier).rafraichir();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(resultat.enAttente ?'Pas de réseau : l’action partira dès le retour de la connexion.' : reussite)));
    } on Object catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(messageErreur(e)), backgroundColor: Couleurs.rouge700));
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lecture = ref.watch(demandeProvider(widget.id));
    final maintenant = ref.watch(horlogeProvider)();
    // Une action déjà mise en attente sur cette demande : inutile de la proposer deux fois.
    final enAttente = (ref.watch(fileProvider).value?.commandes ?? const []).any((c) => c.charge['id'] == widget.id);

    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: _retour), title: const Text('Demande')),
      body: lecture.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: ChargementListe()),
        error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: ErreurChargement(erreur: e, reessayer: () => ref.invalidate(demandeProvider(widget.id)))),
        data: (l) {
          final d = l.donnees;
          final e = echeance(d.echeanceLe, maintenant.millisecondsSinceEpoch);
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(demandeProvider(widget.id));
              await ref.read(demandeProvider(widget.id).future).then((_) {}, onError: (_) {});
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                if (l.horsLigne) ...[BandeauHorsLigne(le: l.le, maintenant: maintenant), const SizedBox(height: 12)],
                Text(d.creancierNom ?? '—', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.3)),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: d.enRetard ? const Pastille('En retard', ton: TonPastille.alerte) : Pastille(libelleEtat(d.etat), ton: tonEtat(d.etat)),
                ),
                const SizedBox(height: 6),
                Text('${typePreteur(d.creancierType)} · demandée le ${dateCourte(d.creeLe)}', style: const TextStyle(color: Couleurs.ardoise500, fontSize: 13)),
                const SizedBox(height: 18),
                CarteNuru(child: EtapesDemande(etat: d.etat)),
                if (d.etat == EtatDemande.refusee && d.motifRefus != null) ...[
                  const SizedBox(height: 12),
                  BandeauInfo(ton: TonBandeau.erreur, titre: 'Demande refusée', texte: d.motifRefus!),
                ],
                if (d.etat == EtatDemande.soumise) ...[
                  const SizedBox(height: 12),
                  BandeauInfo(texte: 'Sans réponse du prêteur avant le ${dateHeure(d.expireLe)}, la demande expire d’elle-même.'),
                ],
                if (d.aConfirmer) ...[
                  const SizedBox(height: 12),
                  const BandeauInfo(
                    ton: TonBandeau.attention,
                    titre: 'Livraison à confirmer',
                    texte: 'Le prêteur indique avoir livré. Confirmez seulement si vous avez bien reçu tous les produits : le délai de remboursement commence à ce moment.',
                  ),
                ],
                if (d.valeurCents != null) ...[
                  const SizedBox(height: 12),
                  CarteNuru(
                    child: Column(
                      children: [
                        _Ligne('Valeur des produits', usd(d.valeurCents)),
                        if (d.etat == EtatDemande.receptionnee || d.etat == EtatDemande.cloturee) _Ligne('Reste dû', usd(d.soldeCents), fort: true),
                        if (d.delaiAccordeJours != null) _Ligne('Délai accordé', '${d.delaiAccordeJours} jours'),
                        if (d.etat == EtatDemande.receptionnee) _Ligne('À rembourser avant le', e.texte, rouge: e.retard),
                        if (d.graceJours != null && d.etat == EtatDemande.receptionnee) _Ligne('Grâce après l’échéance', '${d.graceJours} jours'),
                      ],
                    ),
                  ),
                ],
                const TitreSection('Produits demandés'),
                CarteNuru(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Column(
                    children: [
                      for (var i = 0; i < d.lignes.length; i++) ...[
                        if (i > 0) const Divider(height: 1),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Row(children: [
                            Expanded(child: Text(d.lignes[i].produit)),
                            Text('× ${d.lignes[i].quantite}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          ]),
                        ),
                      ],
                    ],
                  ),
                ),
                if (d.note.isNotEmpty) ...[const SizedBox(height: 10), Text('Note : ${d.note}', style: const TextStyle(color: Couleurs.ardoise600, height: 1.4))],
                if (d.remboursements.isNotEmpty) ...[
                  const TitreSection('Remboursements déclarés'),
                  CarteNuru(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: Column(
                      children: [
                        for (var i = 0; i < d.remboursements.length; i++) ...[
                          if (i > 0) const Divider(height: 1),
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(children: [
                              Expanded(child: Text(dateHeure(d.remboursements[i].le))),
                              Text(usd(d.remboursements[i].montantCents), style: const TextStyle(fontWeight: FontWeight.w600)),
                            ]),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text('Les remboursements sont déclarés par le prêteur, qui les reçoit directement. Nuru ya Afya ne touche jamais à l’argent.', style: TextStyle(fontSize: 12.5, color: Couleurs.ardoise500, height: 1.4)),
                ],
                const TitreSection('Historique'),
                CarteNuru(
                  child: Column(
                    children: [
                      for (final h in d.historique.reversed)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(padding: EdgeInsets.only(top: 6, right: 12), child: Icon(Icons.circle, size: 8, color: Couleurs.marque500)),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(libelleAction(h.action)),
                                    Text(dateHeure(h.le), style: const TextStyle(fontSize: 12, color: Couleurs.ardoise500)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (enAttente) ...[
                  const SizedBox(height: 16),
                  const BandeauInfo(texte: 'Une action sur cette demande attend le retour du réseau pour partir.'),
                ] else if (d.aConfirmer || d.annulable) ...[
                  const SizedBox(height: 24),
                  if (d.aConfirmer)
                    FilledButton.icon(
                      onPressed: _envoi
                          ? null
                          : () async {
                              final depot = ref.read(depotDemandesProvider)!;
                              if (await _confirmer('Confirmer la réception ?', 'Vous confirmez avoir reçu tous les produits. Le délai de remboursement démarre maintenant.', 'Oui, j’ai tout reçu')) {
                                await _agir(() => depot.confirmerReception(d), 'Réception confirmée.');
                              }
                            },
                      icon: const Icon(Icons.inventory_2_outlined),
                      label: const Text('Confirmer la réception'),
                    ),
                  if (d.annulable)
                    Padding(
                      padding: EdgeInsets.only(top: d.aConfirmer ? 12 : 0),
                      child: OutlinedButton(
                        onPressed: _envoi
                            ? null
                            : () async {
                                final depot = ref.read(depotDemandesProvider)!;
                                if (await _confirmer('Annuler cette demande ?', 'Le prêteur ne la traitera plus. Vous pourrez en faire une nouvelle.', 'Annuler la demande', danger: true)) {
                                  await _agir(() => depot.annuler(d), 'Demande annulée.');
                                }
                              },
                        style: OutlinedButton.styleFrom(foregroundColor: Couleurs.rouge700),
                        child: const Text('Annuler la demande'),
                      ),
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Ligne extends StatelessWidget {
  const _Ligne(this.nom, this.valeur, {this.fort = false, this.rouge = false});

  final String nom;
  final String valeur;
  final bool fort;
  final bool rouge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(nom, style: const TextStyle(color: Couleurs.ardoise600))),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              valeur,
              textAlign: TextAlign.right,
              style: TextStyle(fontWeight: fort ? FontWeight.w700 : FontWeight.w600, fontSize: fort ? 17 : 15, color: rouge ? Couleurs.rouge700 : null),
            ),
          ),
        ],
      ),
    );
  }
}
