import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../presentation/coquille.dart';
import '../presentation/ecrans/accueil/accueil_ecran.dart';
import '../presentation/ecrans/compte/compte_ecran.dart';
import '../presentation/ecrans/compte/reserve_ecran.dart';
import '../presentation/ecrans/connexion/code_ecran.dart';
import '../presentation/ecrans/connexion/connexion_ecran.dart';
import '../presentation/ecrans/demandes/demande_ecran.dart';
import '../presentation/ecrans/demandes/demandes_ecran.dart';
import '../presentation/ecrans/demandes/nouvelle_demande_ecran.dart';
import '../presentation/ecrans/demarrage_ecran.dart';
import '../presentation/ecrans/inscription/inscription_code_ecran.dart';
import '../presentation/ecrans/inscription/inscription_ecran.dart';
import '../presentation/ecrans/preteurs/preteurs_ecran.dart';
import '../presentation/ecrans/profil/profil_ecran.dart';
import 'fournisseurs.dart';

/// Où envoyer l'utilisateur selon son état : lecture de la session, connexion, inscription à finir,
/// compte pas encore actif, compte de prêteur, ou application normale. Séparée du routeur pour être testable.
String? redirection({
  required String lieu,
  required bool chargement,
  required bool connecte,
  required bool pharmacie,
  required bool actif,
  required bool inscriptionEnCours,
}) {
  final publique = lieu.startsWith('/connexion') || lieu.startsWith('/inscription');
  if (chargement) return lieu == '/demarrage' ? null : '/demarrage';

  if (!connecte) {
    if (lieu == '/demarrage') return inscriptionEnCours ? '/inscription/code' : '/connexion';
    return publique ? null : '/connexion';
  }
  if (!pharmacie) return lieu == '/reserve' ? null : '/reserve';
  if (!actif) return lieu == '/compte' ? null : '/compte';
  if (publique || lieu == '/demarrage' || lieu == '/compte' || lieu == '/reserve') return '/accueil';
  return null;
}

final routeurProvider = Provider<GoRouter>((ref) {
  // go_router réévalue la redirection quand cet objet signale un changement.
  final rafraichir = ValueNotifier<int>(0);
  ref.listen(sessionProvider, (_, _) => rafraichir.value++);
  ref.listen(inscriptionProvider, (_, _) => rafraichir.value++);
  ref.onDispose(rafraichir.dispose);

  final routeur = GoRouter(
    initialLocation: '/demarrage',
    refreshListenable: rafraichir,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final inscription = ref.read(inscriptionProvider);
      final acteur = session.value?.acteur;
      return redirection(
        lieu: state.matchedLocation,
        chargement: session.isLoading || inscription.isLoading,
        connecte: acteur != null,
        pharmacie: acteur?.estPharmacie ?? false,
        actif: acteur?.estActif ?? false,
        inscriptionEnCours: inscription.value != null,
      );
    },
    routes: [
      GoRoute(path: '/demarrage', builder: (_, _) => const DemarrageEcran()),
      GoRoute(path: '/connexion', builder: (_, _) => const ConnexionEcran(), routes: [GoRoute(path: 'code', builder: (_, _) => const CodeEcran())]),
      GoRoute(path: '/inscription', builder: (_, _) => const InscriptionEcran(), routes: [GoRoute(path: 'code', builder: (_, _) => const InscriptionCodeEcran())]),
      GoRoute(path: '/compte', builder: (_, _) => const CompteEcran()),
      GoRoute(path: '/reserve', builder: (_, _) => const ReserveEcran()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, coque) => Coquille(coque: coque),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/accueil', builder: (_, _) => const AccueilEcran())]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/demandes',
              builder: (_, _) => const DemandesEcran(),
              routes: [
                // « nouvelle » avant « :id », sinon « nouvelle » serait pris pour un identifiant.
                GoRoute(path: 'nouvelle', builder: (_, state) => NouvelleDemandeEcran(creancierInitial: state.uri.queryParameters['creancier'])),
                GoRoute(path: ':id', builder: (_, state) => DemandeEcran(id: state.pathParameters['id']!)),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/preteurs', builder: (_, _) => const PreteursEcran())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profil', builder: (_, _) => const ProfilEcran())]),
        ],
      ),
    ],
  );
  ref.onDispose(routeur.dispose);
  return routeur;
});
