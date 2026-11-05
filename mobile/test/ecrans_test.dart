import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nuru_mobile/domaine/acteur.dart';
import 'package:nuru_mobile/domaine/creancier.dart';
import 'package:nuru_mobile/domaine/credit.dart';
import 'package:nuru_mobile/domaine/demande.dart';
import 'package:nuru_mobile/domaine/session_locale.dart';
import 'package:nuru_mobile/donnees/file_attente.dart';
import 'package:nuru_mobile/donnees/lecture.dart';
import 'package:nuru_mobile/etat/fournisseurs.dart';
import 'package:nuru_mobile/presentation/ecrans/accueil/accueil_ecran.dart';
import 'package:nuru_mobile/presentation/ecrans/demandes/demande_ecran.dart';
import 'package:nuru_mobile/presentation/ecrans/demandes/demandes_ecran.dart';
import 'package:nuru_mobile/presentation/ecrans/demandes/nouvelle_demande_ecran.dart';
import 'package:nuru_mobile/presentation/ecrans/preteurs/preteurs_ecran.dart';
import 'package:nuru_mobile/presentation/ecrans/profil/profil_ecran.dart';
import 'package:nuru_mobile/presentation/theme.dart';

final _maintenant = DateTime.utc(2026, 11, 5, 10);
final _jour = const Duration(days: 1).inMilliseconds;
int _ms(int jours) => _maintenant.millisecondsSinceEpoch + jours * _jour;

final _session = SessionLocale(
  token: 't',
  expireLe: _ms(1),
  acteur: const Acteur(id: 'p1', role: 'pharmacie', nom: 'Pharmacie Gombe', statut: 'ACTIF', telephone: '+243810000001', numeroAgrement: 'PH-001', adresse: 'Avenue du Commerce, Gombe'),
);

const _conditions = Conditions(paliersUSD: [20, 40, 80], seriesRequises: 3, graceJours: 5, delaiDefautJours: 30, delaiMaxJours: 60, expirationHeures: 48);
const _creanciers = [
  Creancier(id: 'c1', type: 'depot', nom: 'Dépôt Central Kinshasa avec un nom particulièrement long pour tester', conditions: _conditions),
  Creancier(id: 'c2', type: 'imf', nom: 'IMF Espoir', conditions: _conditions),
];
const _credits = [
  CreditChezPreteur(creancierId: 'c1', type: 'depot', nom: 'Dépôt Central Kinshasa avec un nom particulièrement long pour tester', palier: 0, plafondCents: 2000, encoursCents: 1200, disponibleCents: 800, bloque: false, serieEnCours: 1, serieRequise: 3, prochainPlafondCents: 4000),
  CreditChezPreteur(creancierId: 'c2', type: 'imf', nom: 'IMF Espoir', palier: 0, plafondCents: 5000, encoursCents: 5000, disponibleCents: 0, bloque: true, serieEnCours: 0, serieRequise: 3),
];

Demande _demande(String id, EtatDemande etat, {bool retard = false}) => Demande(
      id: id,
      creancierId: 'c1',
      creancierNom: 'Dépôt Central Kinshasa avec un nom particulièrement long pour tester',
      creancierType: 'depot',
      lignes: const [LigneDemande(produit: 'Amoxicilline 500 mg (boîte de 20)', quantite: 10), LigneDemande(produit: 'Paracétamol 500 mg (boîte de 100)', quantite: 4)],
      note: 'Livraison avant vendredi si possible',
      etat: etat,
      valeurCents: etat == EtatDemande.soumise ? null : 3500,
      soldeCents: 1200,
      delaiAccordeJours: 30,
      graceJours: 5,
      echeanceLe: _ms(retard ? -3 : 12),
      remboursements: [Remboursement(le: _ms(-2), montantCents: 2300)],
      creeLe: _ms(-10),
      expireLe: _ms(2),
      enRetard: retard,
      historique: [EvenementDemande(le: _ms(-10), action: 'soumettre', etat: EtatDemande.soumise)],
    );

final _demandes = [
  _demande('d1', EtatDemande.livree),
  _demande('d2', EtatDemande.receptionnee, retard: true),
  _demande('d3', EtatDemande.soumise),
  _demande('d4', EtatDemande.cloturee),
  _demande('d5', EtatDemande.refusee),
];

class _FausseSession extends SessionNotifier {
  @override
  Future<SessionLocale?> build() async => _session;
}

class _FausseFile extends FileNotifier {
  @override
  Future<EtatFile> build() async => EtatFile(
        commandes: [Commande(id: 'x', type: TypeCommande.soumettre, cle: 'k', charge: const {}, libelle: 'Demande : 10 × Amoxicilline 500 mg (boîte de 20)', creeLe: 0)],
        rejets: const [Rejet(libelle: 'Demande : 3 × Quinine', message: 'Plafond dépassé chez ce prêteur.', le: 0)],
      );
}

Widget _app(Widget ecran, {bool horsLigne = false}) {
  Lecture<T> lire<T>(T v) => Lecture(v, horsLigne: horsLigne, le: _maintenant.subtract(const Duration(minutes: 12)));
  return ProviderScope(
    overrides: [
      horlogeProvider.overrideWithValue(() => _maintenant),
      sessionProvider.overrideWith(_FausseSession.new),
      fileProvider.overrideWith(_FausseFile.new),
      demandesProvider.overrideWith((ref) async => lire(_demandes)),
      creditsProvider.overrideWith((ref) async => lire(_credits)),
      creanciersProvider.overrideWith((ref) async => lire(_creanciers)),
      demandeProvider.overrideWith((ref, id) async => lire(_demandes.firstWhere((d) => d.id == id))),
    ],
    child: MaterialApp(
      theme: themeNuru(),
      locale: const Locale('fr', 'FR'),
      supportedLocales: const [Locale('fr', 'FR')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      // Petit écran et texte agrandi : le cas où les mises en page débordent.
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(size: MediaQueryData.fromView(View.of(context)).size, textScaler: const TextScaler.linear(1.3)),
        child: child!,
      ),
      home: ecran,
    ),
  );
}

Future<void> _afficher(WidgetTester t, Widget ecran, {bool horsLigne = false, double hauteur = 700}) async {
  t.view.physicalSize = Size(340, hauteur);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.reset);
  await t.pumpWidget(_app(ecran, horsLigne: horsLigne));
  await t.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  // Chaque écran, sur un écran étroit avec un texte agrandi : aucune erreur de mise en page ne doit survenir.
  final ecrans = <String, Widget>{
    'accueil': const AccueilEcran(),
    'liste des demandes': const DemandesEcran(),
    'demande livrée (à confirmer)': const DemandeEcran(id: 'd1'),
    'demande en retard': const DemandeEcran(id: 'd2'),
    'demande soumise': const DemandeEcran(id: 'd3'),
    'demande refusée': const DemandeEcran(id: 'd5'),
    'nouvelle demande': const NouvelleDemandeEcran(),
    'prêteurs': const PreteursEcran(),
    'profil': const ProfilEcran(),
  };

  for (final MapEntry(:key, :value) in ecrans.entries) {
    for (final horsLigne in [false, true]) {
      testWidgets('$key s’affiche sans débordement${horsLigne ? ' (hors ligne)' : ''}', (t) async {
        await _afficher(t, value, horsLigne: horsLigne);
        expect(t.takeException(), isNull);
        if (horsLigne && key != 'profil' && key != 'nouvelle demande') expect(find.textContaining('Hors ligne'), findsOneWidget);
      });
    }
  }

  testWidgets('l’accueil signale le retard, la livraison à confirmer, l’action en attente et l’action refusée', (t) async {
    await _afficher(t, const AccueilEcran(), hauteur: 3000); // assez haut pour que tout soit construit
    expect(find.textContaining('remboursement est en retard'), findsOneWidget);
    expect(find.textContaining('attend votre confirmation'), findsOneWidget);
    expect(find.text("En attente d'envoi"), findsOneWidget);
    expect(find.textContaining('Plafond dépassé chez ce prêteur.'), findsOneWidget);
  });

  testWidgets('une demande livrée propose de confirmer la réception ET de ne pas annuler', (t) async {
    await _afficher(t, const DemandeEcran(id: 'd1'));
    await t.scrollUntilVisible(find.text('Confirmer la réception'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Confirmer la réception'), findsOneWidget);
    expect(find.text('Annuler la demande'), findsNothing);
  });

  testWidgets('une demande clôturée ne propose aucune action', (t) async {
    await _afficher(t, const DemandeEcran(id: 'd4'));
    expect(find.text('Confirmer la réception'), findsNothing);
    expect(find.text('Annuler la demande'), findsNothing);
  });

  testWidgets('envoyer une demande sans choisir de prêteur est refusé avec un message', (t) async {
    await _afficher(t, const NouvelleDemandeEcran());
    await t.scrollUntilVisible(find.text('Envoyer la demande'), 300, scrollable: find.byType(Scrollable).first);
    await t.tap(find.text('Envoyer la demande'));
    await t.pumpAndSettle();
    expect(find.text('Choisissez un prêteur.'), findsOneWidget);
  });

  testWidgets('un prêteur dont le crédit est suspendu le dit clairement', (t) async {
    await _afficher(t, const NouvelleDemandeEcran(creancierInitial: 'c2'));
    expect(find.textContaining('Crédits suspendus'), findsOneWidget);
  });
}
