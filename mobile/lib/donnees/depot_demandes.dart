import 'dart:convert';

import '../core/cle_aleatoire.dart';
import '../core/erreurs.dart';
import '../core/reseau/client_api.dart';
import '../core/stockage/cache_local.dart';
import '../domaine/creancier.dart';
import '../domaine/credit.dart';
import '../domaine/demande.dart';
import 'file_attente.dart';
import 'lecture.dart';

/// Issue d'une action : partie tout de suite (avec la demande renvoyée par la plateforme), ou mise en file faute
/// de réseau.
class ResultatCommande {
  const ResultatCommande.envoyee(this.demande) : enAttente = false;
  const ResultatCommande.miseEnAttente()
      : demande = null,
        enAttente = true;

  final Demande? demande;
  final bool enAttente;
}

/// Demandes, crédits et prêteurs d'une pharmacie, avec le mode hors ligne.
///
/// Lecture : la plateforme d'abord, la dernière copie enregistrée sinon.
/// Écriture : envoyée tout de suite ; si le réseau manque, gardée dans la [file] et renvoyée plus tard avec la
/// même clé d'idempotence. Une erreur de la plateforme (plafond dépassé, demande déjà traitée…) n'est jamais
/// mise en file : elle est remontée à l'appelant.
///
/// Aucune règle de crédit ici : la plateforme décide, ce dépôt transmet.
class DepotDemandes {
  DepotDemandes({
    required this.api,
    required this.cache,
    required this.file,
    required this.acteurId,
    DateTime Function()? horloge,
  }) : horloge = horloge ?? DateTime.now;

  final ClientApi api;
  final CacheLocal cache;
  final FileAttente file;
  final String acteurId;
  final DateTime Function() horloge;

  // ---- Lecture ----------------------------------------------------------------------------------

  Future<Lecture<List<Demande>>> demandes() => _lire('/demandes', _liste(Demande.fromJson));

  Future<Lecture<Demande>> demande(String id) async {
    try {
      return await _lire('/demandes/$id', (j) => Demande.fromJson(j as Map<String, dynamic>));
    } on ErreurApi catch (e) {
      // Jamais ouverte avec du réseau : la copie de la liste suffit pour l'afficher.
      if (!e.temporaire) rethrow;
      final liste = await _copie('/demandes');
      if (liste == null) rethrow;
      for (final j in liste.json as List) {
        if (j is Map && j['id'] == id) {
          return Lecture(Demande.fromJson(Map<String, dynamic>.from(j)), horsLigne: true, le: liste.le);
        }
      }
      rethrow;
    }
  }

  Future<Lecture<List<CreditChezPreteur>>> credits() =>
      _lire('/pharmacies/${Uri.encodeComponent(acteurId)}/credit', _liste(CreditChezPreteur.fromJson));

  Future<Lecture<List<Creancier>>> creanciers() => _lire('/creanciers', _liste(Creancier.fromJson));

  static List<T> Function(dynamic) _liste<T>(T Function(Map<String, dynamic>) lire) =>
      (j) => [for (final e in j as List) lire(Map<String, dynamic>.from(e as Map))];

  Future<Lecture<T>> _lire<T>(String chemin, T Function(dynamic) decoder) async {
    try {
      final json = await api.get(chemin);
      final donnees = decoder(json); // décodé avant d'être enregistré : on ne garde pas une copie illisible
      final le = horloge();
      await cache.ecrire(_cleCopie(chemin), jsonEncode({'le': le.millisecondsSinceEpoch, 'json': json}));
      return Lecture(donnees, le: le);
    } on ErreurApi catch (e) {
      if (!e.temporaire) rethrow;
      final copie = await _copie(chemin);
      if (copie == null) rethrow;
      return Lecture(decoder(copie.json), horsLigne: true, le: copie.le);
    }
  }

  String _cleCopie(String chemin) => 'copie:$acteurId:$chemin';

  Future<({DateTime le, dynamic json})?> _copie(String chemin) async {
    final brut = await cache.lire(_cleCopie(chemin));
    if (brut == null) return null;
    try {
      final m = jsonDecode(brut) as Map<String, dynamic>;
      return (le: DateTime.fromMillisecondsSinceEpoch((m['le'] as num).toInt()), json: m['json']);
    } on Object {
      return null;
    }
  }

  // ---- Écriture ---------------------------------------------------------------------------------

  Future<ResultatCommande> soumettre({required String creancierId, required List<LigneDemande> lignes, String note = ''}) {
    final texte = note.trim();
    return _envoyer(
      TypeCommande.soumettre,
      {
        'creancierId': creancierId,
        'lignes': [for (final l in lignes) l.toJson()],
        if (texte.isNotEmpty) 'note': texte,
      },
      'Demande : ${lignes.map((l) => '${l.quantite} × ${l.produit}').join(' · ')}',
    );
  }

  Future<ResultatCommande> confirmerReception(Demande d) =>
      _envoyer(TypeCommande.receptionner, {'id': d.id}, 'Réception : ${d.resume()}');

  Future<ResultatCommande> annuler(Demande d) => _envoyer(TypeCommande.annuler, {'id': d.id}, 'Annulation : ${d.resume()}');

  Future<ResultatCommande> _envoyer(TypeCommande type, Map<String, dynamic> charge, String libelle) async {
    final commande = Commande(
      id: cleAleatoire(),
      type: type,
      cle: cleAleatoire(),
      charge: charge,
      libelle: libelle,
      creeLe: horloge().millisecondsSinceEpoch,
    );
    try {
      return ResultatCommande.envoyee(await _executer(commande));
    } on ErreurApi catch (e) {
      // Panne passagère : la même clé d'idempotence rend le renvoi sans risque, même si la requête était arrivée.
      if (!e.temporaire) rethrow;
      await file.ajouter(commande);
      return const ResultatCommande.miseEnAttente();
    }
  }

  Future<Demande?> _executer(Commande c) async {
    final json = switch (c.type) {
      TypeCommande.soumettre => await api.post('/demandes', corps: c.charge, cle: c.cle),
      TypeCommande.receptionner => await api.post('/demandes/${Uri.encodeComponent(c.charge['id'] as String)}/receptionner', cle: c.cle),
      TypeCommande.annuler => await api.post('/demandes/${Uri.encodeComponent(c.charge['id'] as String)}/annuler', cle: c.cle),
    };
    return json is Map ? Demande.fromJson(Map<String, dynamic>.from(json)) : null;
  }

  // ---- File d'attente ---------------------------------------------------------------------------

  bool _envoiEnCours = false;

  /// Envoie dans l'ordre les actions en attente. Renvoie le nombre d'actions parties.
  ///
  /// Une panne passagère arrête l'envoi sans rien retirer : l'ordre est gardé pour la prochaine fois.
  /// Une action refusée par la plateforme est retirée et notée dans les rejets, puis l'envoi continue.
  Future<int> viderFile() async {
    if (_envoiEnCours) return 0; // un envoi tourne déjà : le lancer deux fois doublerait les requêtes
    _envoiEnCours = true;
    var envoyees = 0;
    try {
      for (final c in await file.lister()) {
        try {
          await _executer(c);
          await file.retirer(c.id);
          envoyees++;
        } on ErreurApi catch (e) {
          if (e.temporaire || e.nonAutorise) break;
          await file.retirer(c.id);
          await file.ajouterRejet(Rejet(libelle: c.libelle, message: e.message, le: horloge().millisecondsSinceEpoch));
        }
      }
    } finally {
      _envoiEnCours = false;
    }
    return envoyees;
  }
}
