// Tests des utilitaires de saisie et d'affichage. Lancer : npm test
import test from "node:test";
import assert from "node:assert/strict";
import { lireEntierPositif, lireMontantUSD } from "./montant.ts";
import { masquerTelephone, normaliserTelephone } from "./telephone.ts";
import { dateCourte, joursRestants, usd } from "./format.ts";

test("téléphone : les écritures courantes en RDC sont ramenées au format international", () => {
  assert.equal(normaliserTelephone("+243 81 234 5678"), "+243812345678");
  assert.equal(normaliserTelephone("0812345678"), "+243812345678");
  assert.equal(normaliserTelephone("081 234 56 78"), "+243812345678");
  assert.equal(normaliserTelephone("00243812345678"), "+243812345678");
  assert.equal(normaliserTelephone("243812345678"), "+243812345678");
  assert.equal(normaliserTelephone("(+243) 81-234-5678"), "+243812345678");
});

test("téléphone : un numéro invraisemblable est refusé", () => {
  for (const mauvais of ["", "abc", "12345", "+24381", "08123", "+1234567890123456", "081234567x"]) {
    assert.equal(normaliserTelephone(mauvais), null, mauvais);
  }
});

test("téléphone : l'affichage masque le milieu du numéro", () => {
  assert.equal(masquerTelephone("+243812345678"), "+243 •••••• 678");
  assert.equal(masquerTelephone(null), "—");
});

test("montant : virgule ou point décimal, espaces ignorés", () => {
  assert.equal(lireMontantUSD("18"), 18);
  assert.equal(lireMontantUSD("18,5"), 18.5);
  assert.equal(lireMontantUSD("18.50"), 18.5);
  assert.equal(lireMontantUSD("1 250"), 1250);
  assert.equal(lireMontantUSD("1 250,75"), 1250.75);
});

test("montant : rien de douteux n'est accepté", () => {
  for (const mauvais of ["", "0", "0,00", "-5", "abc", "1,234", "1e3", "5 USD", "$5", "1,5,5", "Infinity", "NaN"]) {
    assert.equal(lireMontantUSD(mauvais), null, mauvais);
  }
});

test("quantité : entier strictement positif", () => {
  assert.equal(lireEntierPositif("10"), 10);
  assert.equal(lireEntierPositif(" 7 "), 7);
  for (const mauvais of ["", "0", "-3", "2,5", "1e2", "abc", "9999999999"]) {
    assert.equal(lireEntierPositif(mauvais), null, mauvais);
  }
});

test("affichage des montants en dollars", () => {
  assert.equal(usd(1800), "18 USD");
  assert.equal(usd(1850), "18,50 USD");
  assert.equal(usd(0), "0 USD");
  assert.equal(usd(null), "—");
  assert.match(usd(125_000), /^1\s?250 USD$/);
});

test("échéances : jours restants arrondis vers le haut, négatifs si dépassée", () => {
  const J = 86_400_000;
  const maintenant = Date.UTC(2026, 10, 4, 10);
  assert.equal(joursRestants(maintenant + 30 * J, maintenant), 30);
  assert.equal(joursRestants(maintenant + 1, maintenant), 1);
  assert.equal(joursRestants(maintenant, maintenant), 0);
  assert.equal(joursRestants(maintenant - 3 * J, maintenant), -3);
  assert.equal(joursRestants(null, maintenant), null);
});

test("dates affichées à l'heure de Kinshasa", () => {
  // 23 h UTC le 3 novembre = minuit à Kinshasa (UTC+1) : déjà le 4.
  assert.match(dateCourte(Date.UTC(2026, 10, 3, 23, 30)), /^4 nov\.? 2026$/);
  assert.equal(dateCourte(null), "—");
});
