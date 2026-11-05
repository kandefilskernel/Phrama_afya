import 'package:flutter_test/flutter_test.dart';
import 'package:nuru_mobile/etat/routeur.dart';

String? aller(
  String lieu, {
  bool chargement = false,
  bool connecte = false,
  bool pharmacie = true,
  bool actif = true,
  bool inscription = false,
}) =>
    redirection(lieu: lieu, chargement: chargement, connecte: connecte, pharmacie: pharmacie, actif: actif, inscriptionEnCours: inscription);

void main() {
  group('redirection', () {
    test('pendant la lecture de la session, tout passe par le démarrage', () {
      expect(aller('/accueil', chargement: true), '/demarrage');
      expect(aller('/demarrage', chargement: true), isNull);
    });

    test('sans session : connexion, sauf pour les écrans publics', () {
      expect(aller('/demarrage'), '/connexion');
      expect(aller('/accueil'), '/connexion');
      expect(aller('/demandes/abc'), '/connexion');
      expect(aller('/connexion'), isNull);
      expect(aller('/connexion/code'), isNull);
      expect(aller('/inscription'), isNull);
    });

    test('une inscription à finir est reprise au démarrage', () {
      expect(aller('/demarrage', inscription: true), '/inscription/code');
      expect(aller('/connexion', inscription: true), isNull);
    });

    test('un compte en attente ou suspendu reste sur son écran de statut', () {
      expect(aller('/accueil', connecte: true, actif: false), '/compte');
      expect(aller('/compte', connecte: true, actif: false), isNull);
    });

    test('un compte de prêteur est renvoyé vers l’écran réservé', () {
      expect(aller('/accueil', connecte: true, pharmacie: false), '/reserve');
      expect(aller('/reserve', connecte: true, pharmacie: false), isNull);
    });

    test('un compte actif quitte les écrans d’accès et ne voit pas ceux des autres statuts', () {
      for (final lieu in ['/demarrage', '/connexion', '/connexion/code', '/inscription', '/compte', '/reserve']) {
        expect(aller(lieu, connecte: true), '/accueil', reason: lieu);
      }
      expect(aller('/demandes', connecte: true), isNull);
      expect(aller('/profil', connecte: true), isNull);
    });
  });
}
