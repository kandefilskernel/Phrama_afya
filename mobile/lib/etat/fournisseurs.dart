import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config.dart';
import '../core/reseau/client_api.dart';
import '../core/stockage/cache_local.dart';
import '../core/stockage/coffre_session.dart';
import '../domaine/acteur.dart';
import '../domaine/creancier.dart';
import '../domaine/credit.dart';
import '../domaine/demande.dart';
import '../domaine/session_locale.dart';
import '../donnees/depot_auth.dart';
import '../donnees/depot_demandes.dart';
import '../donnees/file_attente.dart';
import '../donnees/lecture.dart';

// ---- Dépendances de base ------------------------------------------------------------------------
final coffreProvider = Provider<CoffreTexte>((ref) => CoffreSecurise());

/// Fourni au démarrage (voir main.dart) : la mémoire locale s'ouvre de façon asynchrone.
final cacheProvider = Provider<CacheLocal>((ref) => throw UnimplementedError('cacheProvider doit être remplacé au démarrage'));

final horlogeProvider = Provider<DateTime Function()>((ref) => DateTime.now);

// ---- Session ------------------------------------------------------------------------------------
class SessionNotifier extends AsyncNotifier<SessionLocale?> {
  @override
  Future<SessionLocale?> build() async {
    final coffre = ref.read(coffreProvider);
    final session = SessionLocale.decoder(await coffre.lire());
    if (session != null && session.estExpiree(ref.read(horlogeProvider)())) {
      await coffre.effacer(); // la plateforme a de toute façon fermé cette session
      return null;
    }
    return session;
  }

  Future<void> ouvrir(SessionLocale session) async {
    await ref.read(coffreProvider).ecrire(session.encoder());
    state = AsyncData(session);
  }

  /// Relit le compte sur la plateforme : il a pu être approuvé ou suspendu depuis la dernière fois.
  Future<Acteur?> rafraichirCompte() async {
    final actuelle = state.value;
    if (actuelle == null) return null;
    try {
      final acteur = await ref.read(depotAuthProvider).moi();
      final session = actuelle.avecActeur(acteur);
      await ref.read(coffreProvider).ecrire(session.encoder());
      state = AsyncData(session);
      return acteur;
    } on Object {
      return actuelle.acteur; // pas de réseau : on garde ce qu'on sait
    }
  }

  Future<void> fermer({bool surServeur = false}) async {
    if (surServeur) await ref.read(depotAuthProvider).deconnecter();
    await ref.read(coffreProvider).effacer();
    state = const AsyncData(null);
  }
}

final sessionProvider = AsyncNotifierProvider<SessionNotifier, SessionLocale?>(SessionNotifier.new);

// ---- Accès à la plateforme ----------------------------------------------------------------------
final clientApiProvider = Provider<ClientApi>((ref) {
  final api = ClientApi(
    baseUrl: Config.apiUrl,
    jeton: () async => ref.read(sessionProvider).value?.token,
    // 401 : la plateforme a fermé cette session. On le fait aussi ici, sans rappeler le serveur.
    surNonAutorise: () => Future.microtask(() => ref.read(sessionProvider.notifier).fermer()),
  );
  ref.onDispose(api.fermer);
  return api;
});

final depotAuthProvider = Provider<DepotAuth>((ref) => DepotAuth(ref.watch(clientApiProvider)));

/// Les demandes du compte connecté. Nul tant qu'aucune session n'est ouverte.
final depotDemandesProvider = Provider<DepotDemandes?>((ref) {
  final session = ref.watch(sessionProvider).value;
  if (session == null) return null;
  final cache = ref.watch(cacheProvider);
  return DepotDemandes(
    api: ref.watch(clientApiProvider),
    cache: cache,
    file: FileAttente(cache: cache, acteurId: session.acteur.id),
    acteurId: session.acteur.id,
    horloge: ref.watch(horlogeProvider),
  );
});

DepotDemandes _depot(Ref ref) {
  final depot = ref.watch(depotDemandesProvider);
  if (depot == null) throw StateError('Aucune session ouverte');
  return depot;
}

// ---- Données affichées --------------------------------------------------------------------------
final demandesProvider = FutureProvider.autoDispose<Lecture<List<Demande>>>((ref) => _depot(ref).demandes());
final demandeProvider = FutureProvider.autoDispose.family<Lecture<Demande>, String>((ref, id) => _depot(ref).demande(id));
final creditsProvider = FutureProvider.autoDispose<Lecture<List<CreditChezPreteur>>>((ref) => _depot(ref).credits());
final creanciersProvider = FutureProvider.autoDispose<Lecture<List<Creancier>>>((ref) => _depot(ref).creanciers());

// ---- File d'attente hors ligne ------------------------------------------------------------------
class EtatFile {
  const EtatFile({this.commandes = const [], this.rejets = const []});

  static const vide = EtatFile();

  /// Actions faites sans réseau, pas encore envoyées.
  final List<Commande> commandes;

  /// Actions que la plateforme a refusées au renvoi : l'utilisateur doit le savoir.
  final List<Rejet> rejets;
}

class FileNotifier extends AsyncNotifier<EtatFile> {
  @override
  Future<EtatFile> build() async {
    final depot = ref.watch(depotDemandesProvider);
    if (depot == null) return EtatFile.vide;
    // Tant que l'application est ouverte, on réessaie régulièrement. Le renvoi est sans risque : chaque
    // commande porte sa clé d'idempotence.
    final minuterie = Timer.periodic(Config.frequenceFile, (_) => vider());
    ref.onDispose(minuterie.cancel);
    return _lire(depot);
  }

  Future<EtatFile> _lire(DepotDemandes depot) async => EtatFile(commandes: await depot.file.lister(), rejets: await depot.file.rejets());

  Future<void> rafraichir() async {
    final depot = ref.read(depotDemandesProvider);
    if (depot == null) return;
    state = AsyncData(await _lire(depot));
  }

  /// Envoie ce qui attend. Renvoie le nombre d'actions parties.
  Future<int> vider() async {
    final depot = ref.read(depotDemandesProvider);
    if (depot == null) return 0;
    final envoyees = await depot.viderFile();
    state = AsyncData(await _lire(depot));
    if (envoyees > 0) {
      ref.invalidate(demandesProvider);
      ref.invalidate(creditsProvider);
    }
    return envoyees;
  }

  Future<void> effacerRejets() async {
    final depot = ref.read(depotDemandesProvider);
    if (depot == null) return;
    await depot.file.effacerRejets();
    await rafraichir();
  }
}

final fileProvider = AsyncNotifierProvider<FileNotifier, EtatFile>(FileNotifier.new);

// ---- Parcours d'authentification en cours -------------------------------------------------------
/// Numéro saisi à l'étape 1 de la connexion, gardé en mémoire le temps de recevoir le code.
class TelephoneEnCours extends Notifier<String?> {
  @override
  String? build() => null;

  void definir(String? telephone) => state = telephone;
}

final telephoneEnCoursProvider = NotifierProvider<TelephoneEnCours, String?>(TelephoneEnCours.new);

/// Inscription entre sa création et la confirmation du téléphone.
///
/// Le jeton provisoire ne sert qu'à confirmer le téléphone. Il est gardé dans le stockage sécurisé, car un
/// compte dont le téléphone n'est pas confirmé ne peut pas se connecter par SMS : si l'utilisateur ferme
/// l'application avant la fin, il doit pouvoir reprendre là où il s'était arrêté. Il est effacé dès la confirmation.
class InscriptionEnCours {
  const InscriptionEnCours({required this.telephone, required this.jetonProvisoire});

  factory InscriptionEnCours.fromJson(Map<String, dynamic> j) =>
      InscriptionEnCours(telephone: j['telephone'] as String, jetonProvisoire: j['jetonProvisoire'] as String);

  final String telephone;
  final String jetonProvisoire;

  Map<String, dynamic> toJson() => {'telephone': telephone, 'jetonProvisoire': jetonProvisoire};
}

final coffreInscriptionProvider = Provider<CoffreTexte>((ref) => CoffreSecurise(cle: 'inscription'));

class InscriptionNotifier extends AsyncNotifier<InscriptionEnCours?> {
  @override
  Future<InscriptionEnCours?> build() async {
    final brut = await ref.read(coffreInscriptionProvider).lire();
    if (brut == null) return null;
    try {
      return InscriptionEnCours.fromJson(jsonDecode(brut) as Map<String, dynamic>);
    } on Object {
      await ref.read(coffreInscriptionProvider).effacer();
      return null;
    }
  }

  Future<void> definir(InscriptionEnCours? v) async {
    final coffre = ref.read(coffreInscriptionProvider);
    if (v == null) {
      await coffre.effacer();
    } else {
      await coffre.ecrire(jsonEncode(v.toJson()));
    }
    state = AsyncData(v);
  }
}

final inscriptionProvider = AsyncNotifierProvider<InscriptionNotifier, InscriptionEnCours?>(InscriptionNotifier.new);
