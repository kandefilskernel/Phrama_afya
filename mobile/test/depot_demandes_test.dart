import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nuru_mobile/core/erreurs.dart';
import 'package:nuru_mobile/core/reseau/client_api.dart';
import 'package:nuru_mobile/core/stockage/cache_local.dart';
import 'package:nuru_mobile/domaine/demande.dart';
import 'package:nuru_mobile/donnees/depot_demandes.dart';
import 'package:nuru_mobile/donnees/file_attente.dart';

Map<String, dynamic> demandeJson({String id = 'd1', String etat = 'SOUMISE'}) => {
      'id': id,
      'pharmacieId': 'p1',
      'creancierId': 'c1',
      'creancierNom': 'Dépôt Central',
      'creancierType': 'depot',
      'lignes': [
        {'produit': 'Ibuprofène 400 mg', 'quantite': 8}
      ],
      'note': '',
      'etat': etat,
      'valeurCents': null,
      'soldeCents': 0,
      'creeLe': 1700000000000,
      'expireLe': 1700259200000,
      'enRetard': false,
      'remboursements': [],
      'historique': [],
    };

const json = {'content-type': 'application/json; charset=utf-8'};

/// Plateforme simulée : on y règle le comportement réseau et on y lit les requêtes reçues.
class FausseApi {
  bool reseau = true;
  int statutPost = 201;
  Object corpsPost = demandeJson();
  final List<http.Request> requetes = [];

  http.Client client() => MockClient((req) async {
        if (!reseau) throw http.ClientException('hors ligne');
        requetes.add(req);
        if (req.method == 'GET') {
          return http.Response(jsonEncode(req.url.path == '/demandes' ? [demandeJson()] : <dynamic>[]), 200, headers: json);
        }
        return http.Response(jsonEncode(corpsPost), statutPost, headers: json);
      });
}

({DepotDemandes depot, FausseApi api, CacheMemoire cache, FileAttente file}) monter() {
  final api = FausseApi();
  final cache = CacheMemoire();
  final file = FileAttente(cache: cache, acteurId: 'p1');
  final client = ClientApi(baseUrl: 'http://plateforme', jeton: () async => 'jeton', client: api.client());
  final depot = DepotDemandes(api: client, cache: cache, file: file, acteurId: 'p1');
  return (depot: depot, api: api, cache: cache, file: file);
}

const lignes = [LigneDemande(produit: 'Ibuprofène 400 mg', quantite: 8)];

void main() {
  test('lecture : le réseau d’abord, puis la dernière copie quand il tombe', () async {
    final m = monter();
    final enLigne = await m.depot.demandes();
    expect(enLigne.horsLigne, isFalse);
    expect(enLigne.donnees.single.creancierNom, 'Dépôt Central');

    m.api.reseau = false;
    final copie = await m.depot.demandes();
    expect(copie.horsLigne, isTrue);
    expect(copie.donnees.single.id, 'd1');
    expect(copie.le, isNotNull);
  });

  test('lecture : sans réseau ni copie, l’échec est signalé', () async {
    final m = monter();
    m.api.reseau = false;
    await expectLater(m.depot.demandes(), throwsA(isA<ErreurApi>().having((e) => e.horsLigne, 'horsLigne', isTrue)));
  });

  test('une demande envoyée avec réseau part tout de suite et ne passe pas par la file', () async {
    final m = monter();
    final r = await m.depot.soumettre(creancierId: 'c1', lignes: lignes);
    expect(r.enAttente, isFalse);
    expect(r.demande!.id, 'd1');
    expect(await m.file.lister(), isEmpty);
    expect(m.api.requetes.single.headers['idempotency-key'], isNotEmpty);
    expect(jsonDecode(m.api.requetes.single.body), {
      'creancierId': 'c1',
      'lignes': [
        {'produit': 'Ibuprofène 400 mg', 'quantite': 8}
      ],
    });
  });

  test('hors ligne : la demande est gardée, puis envoyée avec la MÊME clé d’idempotence au retour du réseau', () async {
    final m = monter();
    m.api.reseau = false;
    final r = await m.depot.soumettre(creancierId: 'c1', lignes: lignes, note: 'Avant vendredi');
    expect(r.enAttente, isTrue);
    final enAttente = await m.file.lister();
    expect(enAttente, hasLength(1));
    final cle = enAttente.single.cle;

    expect(await m.depot.viderFile(), 0); // toujours pas de réseau : rien n'est perdu
    expect(await m.file.lister(), hasLength(1));

    m.api.reseau = true;
    expect(await m.depot.viderFile(), 1);
    expect(await m.file.lister(), isEmpty);
    expect(m.api.requetes.single.headers['idempotency-key'], cle);
    expect(jsonDecode(m.api.requetes.single.body)['note'], 'Avant vendredi');
  });

  test('la file survit à un redémarrage : elle est relue depuis la mémoire locale', () async {
    final m = monter();
    m.api.reseau = false;
    await m.depot.soumettre(creancierId: 'c1', lignes: lignes);
    final apresRedemarrage = FileAttente(cache: m.cache, acteurId: 'p1');
    expect(await apresRedemarrage.lister(), hasLength(1));
    expect(await FileAttente(cache: m.cache, acteurId: 'autre').lister(), isEmpty); // une file par compte
  });

  test('une erreur de la plateforme n’est jamais mise en attente : elle est remontée', () async {
    final m = monter();
    m.api.statutPost = 409;
    m.api.corpsPost = {'erreur': 'Plafond dépassé : disponible 8.00 USD'};
    await expectLater(
      m.depot.soumettre(creancierId: 'c1', lignes: lignes),
      throwsA(isA<ErreurApi>().having((e) => e.message, 'message', contains('Plafond dépassé'))),
    );
    expect(await m.file.lister(), isEmpty);
  });

  test('au renvoi, une commande refusée est retirée et signalée, les suivantes partent', () async {
    final m = monter();
    m.api.reseau = false;
    await m.depot.soumettre(creancierId: 'c1', lignes: lignes);
    await m.depot.confirmerReception(Demande.fromJson(demandeJson(id: 'd9', etat: 'LIVREE')));
    expect(await m.file.lister(), hasLength(2));

    m.api.reseau = true;
    var appels = 0;
    final client = ClientApi(
      baseUrl: 'http://plateforme',
      jeton: () async => 'jeton',
      client: MockClient((req) async {
        appels++;
        return appels == 1
            ? http.Response(jsonEncode({'erreur': 'Plafond dépassé'}), 409, headers: json)
            : http.Response(jsonEncode(demandeJson(id: 'd9', etat: 'RECEPTIONNEE')), 200, headers: json);
      }),
    );
    final depot = DepotDemandes(api: client, cache: m.cache, file: m.file, acteurId: 'p1');

    expect(await depot.viderFile(), 1);
    expect(await m.file.lister(), isEmpty);
    final rejets = await m.file.rejets();
    expect(rejets.single.message, 'Plafond dépassé');
    expect(rejets.single.libelle, startsWith('Demande'));
  });

  test('une panne en cours de route garde l’ordre : la commande en échec et les suivantes restent', () async {
    final m = monter();
    m.api.reseau = false;
    await m.depot.soumettre(creancierId: 'c1', lignes: lignes);
    await m.depot.annuler(Demande.fromJson(demandeJson(id: 'd2')));
    final avant = (await m.file.lister()).map((c) => c.id).toList();

    m.api.reseau = true;
    m.api.statutPost = 503;
    expect(await m.depot.viderFile(), 0);
    expect((await m.file.lister()).map((c) => c.id).toList(), avant);
    expect(m.api.requetes, hasLength(1)); // la seconde commande n'est pas tentée avant la première
  });

  test('deux envois simultanés de la file ne se doublent pas', () async {
    final m = monter();
    m.api.reseau = false;
    await m.depot.soumettre(creancierId: 'c1', lignes: lignes);
    m.api.reseau = true;
    final resultats = await Future.wait([m.depot.viderFile(), m.depot.viderFile()]);
    expect(resultats.reduce((a, b) => a + b), 1);
    expect(m.api.requetes.where((r) => r.method == 'POST'), hasLength(1));
  });

  test('une session refusée (401) déclenche le rappel de fin de session', () async {
    var expiree = false;
    final client = ClientApi(
      baseUrl: 'http://plateforme',
      jeton: () async => 'vieux',
      surNonAutorise: () => expiree = true,
      client: MockClient((_) async => http.Response(jsonEncode({'erreur': 'Authentification requise'}), 401, headers: json)),
    );
    await expectLater(client.get('/demandes'), throwsA(isA<ErreurApi>().having((e) => e.nonAutorise, '401', isTrue)));
    expect(expiree, isTrue);
  });
}
