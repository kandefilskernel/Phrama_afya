import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:nuru_mobile/core/cle_aleatoire.dart';
import 'package:nuru_mobile/core/formats.dart';
import 'package:nuru_mobile/core/telephone.dart';

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  group('téléphone', () {
    test('les écritures courantes en RDC sont ramenées au format international', () {
      for (final saisie in ['+243 81 234 5678', '0812345678', '081 234 56 78', '00243812345678', '243812345678', '(+243) 81-234-5678']) {
        expect(normaliserTelephone(saisie), '+243812345678', reason: saisie);
      }
    });

    test('un numéro invraisemblable est refusé', () {
      for (final mauvais in ['', 'abc', '12345', '+24381', '08123', '+1234567890123456', '081234567x']) {
        expect(normaliserTelephone(mauvais), isNull, reason: mauvais);
      }
    });

    test('l’affichage masque le milieu du numéro', () {
      expect(masquerTelephone('+243812345678'), '+243 •••••• 678');
      expect(masquerTelephone(null), '—');
    });
  });

  group('formats', () {
    test('montants en dollars', () {
      expect(usd(1800), '18 USD');
      expect(usd(1850), '18,50 USD');
      expect(usd(0), '0 USD');
      expect(usd(null), '—');
    });

    test('dates à l’heure de Kinshasa', () {
      // 23 h 30 UTC le 3 novembre : minuit passé à Kinshasa (UTC+1), donc déjà le 4.
      expect(dateCourte(DateTime.utc(2026, 11, 3, 23, 30).millisecondsSinceEpoch), contains('4 nov'));
      expect(dateCourte(null), '—');
    });

    test('jours restants arrondis vers le haut, négatifs si dépassée', () {
      const j = 86400000;
      const maintenant = 1700000000000;
      expect(joursRestants(maintenant + 30 * j, maintenant), 30);
      expect(joursRestants(maintenant + 1, maintenant), 1);
      expect(joursRestants(maintenant - 3 * j, maintenant), -3);
      expect(joursRestants(null, maintenant), isNull);
    });

    test('ancienneté des données hors ligne', () {
      final t = DateTime(2026, 11, 5, 12);
      expect(ilYa(t, t.add(const Duration(seconds: 20))), "à l'instant");
      expect(ilYa(t, t.add(const Duration(minutes: 5))), 'il y a 5 min');
      expect(ilYa(t, t.add(const Duration(hours: 3))), 'il y a 3 h');
      expect(ilYa(t, t.add(const Duration(days: 2))), 'il y a 2 j');
    });

    test('initiales', () {
      expect(initiales('Pharmacie Gombe'), 'PG');
      expect(initiales('Dépôt'), 'D');
    });
  });

  test('les clés d’idempotence sont longues et ne se répètent pas', () {
    final cles = {for (var i = 0; i < 500; i++) cleAleatoire()};
    expect(cles, hasLength(500));
    expect(cles.every((c) => c.length == 32), isTrue);
  });
}
