import test from 'node:test';
import assert from 'node:assert/strict';
import { ouvrirStockage } from '../../../libs/stockage.js';
import { MAX_TENTATIVES, attenteApres, creerNotifications } from '../src/application/notifications.js';
import { messagesPourEvenement } from '../src/domaine/modeles.js';

const CONTACTS = {
  p1: { id: 'p1', nom: 'Pharmacie Gombe', telephone: '+243810000001' },
  d1: { id: 'd1', nom: 'Dépôt A', telephone: '+243810000002' },
  sans: { id: 'sans', nom: 'Sans téléphone', telephone: null },
};
const msg = (cle, extra = {}) => ({
  cle, destinataireId: 'p1', modele: 'creditSolde', donnees: {}, pharmacieId: 'p1', creancierId: 'd1', ...extra,
});

function monter({ fournisseur, contacts = async (id) => CONTACTS[id] ?? null } = {}) {
  let t = 1_000_000;
  const envoyes = [];
  const n = creerNotifications({
    stockage: ouvrirStockage(),
    contacts,
    fournisseur: fournisseur ?? { envoyer: async (m) => { envoyes.push(m); } },
    horloge: () => t,
  });
  return { n, envoyes, avancer: (ms) => { t += ms; } };
}

test('chaque événement utile produit le bon message, au bon destinataire', () => {
  const e = (type) => ({ id: 'e1', type, pharmacieId: 'p1', creancierId: 'd1', donnees: {} });
  assert.equal(messagesPourEvenement(e('DemandeSoumise'))[0].destinataireId, 'd1');
  assert.equal(messagesPourEvenement(e('DemandeValidee'))[0].destinataireId, 'p1');
  assert.equal(messagesPourEvenement(e('RemboursementConstate'))[0].modele, 'remboursementConstate');
  assert.deepEqual(messagesPourEvenement(e('MarchandiseLivree')), []);
});

test('une même clé ne produit qu’un seul SMS', async () => {
  const { n, envoyes } = monter();
  assert.equal(n.demander(msg('k')).cree, true);
  assert.equal(n.demander(msg('k')).cree, false);
  await n.envoyerEnAttente();
  await n.envoyerEnAttente();
  assert.equal(envoyes.length, 1);
  assert.match(envoyes[0].texte, /Dépot A/); // ô simplifié : le SMS reste en GSM-7
  assert.equal(envoyes[0].telephone, '+243810000001');
});

test('échec du fournisseur : reprises espacées, puis échec définitif', async () => {
  let echecs = 0;
  const { n, avancer } = monter({ fournisseur: { envoyer: async () => { echecs += 1; throw new Error('opérateur indisponible'); } } });
  n.demander(msg('k'));
  await n.envoyerEnAttente();
  assert.equal(echecs, 1);
  await n.envoyerEnAttente();                        // trop tôt : pas de nouvelle tentative
  assert.equal(echecs, 1);
  for (let i = 1; i < MAX_TENTATIVES; i++) { avancer(attenteApres(i)); await n.envoyerEnAttente(); }
  assert.equal(echecs, MAX_TENTATIVES);
  assert.equal(n.lister()[0].statut, 'ECHEC_DEFINITIF');
});

test('plateforme injoignable : on réessaie sans consommer de tentative', async () => {
  let panne = true;
  const { n, envoyes, avancer } = monter({
    contacts: async (id) => { if (panne) throw new Error('injoignable'); return CONTACTS[id]; },
  });
  n.demander(msg('k'));
  for (let i = 0; i < 20; i++) { await n.envoyerEnAttente(); avancer(60_000); }
  assert.equal(n.lister()[0].tentatives, 0);
  panne = false;
  await n.envoyerEnAttente();
  assert.equal(envoyes.length, 1);
});

test('destinataire sans téléphone : marqué, pas envoyé', async () => {
  const { n, envoyes } = monter();
  n.demander(msg('k', { destinataireId: 'sans' }));
  await n.envoyerEnAttente();
  assert.equal(envoyes.length, 0);
  assert.equal(n.lister()[0].statut, 'SANS_CONTACT');
});

test('demande invalide refusée', () => {
  const { n } = monter();
  assert.throws(() => n.demander(msg('k', { modele: 'inconnu' })));
  assert.throws(() => n.demander(msg('k', { telephone: '+243...' })));
  assert.throws(() => n.demander({ ...msg('k'), cle: '' }));
});
