// Textes des SMS. Chaque modèle reçoit les données du message et les contacts
// (destinataire, et pharmacie et prêteur pour un message lié à un crédit) résolus au moment de l'envoi.

const usd = (cents) => `${(cents / 100).toFixed(2)} USD`;
const date = (ms) => new Date(ms).toISOString().slice(0, 10);

export const MODELES = {
  nouvelleDemande: (d, c) => `Nouvelle demande de crédit de ${c.pharmacie.nom}. Répondez avant le ${date(d.expireLe)}.`,
  demandeValidee: (d, c) => `${c.preteur.nom} a validé votre demande : ${usd(d.valeurCents)}, à rembourser sous ${d.delaiAccordeJours} jours après réception.`,
  demandeRefusee: (d, c) => `${c.preteur.nom} a refusé votre demande. Motif : ${d.motif}`,
  demandeExpiree: (d, c) => `Votre demande à ${c.preteur.nom} a expiré sans réponse. Vous pouvez en soumettre une nouvelle.`,
  remboursementConstate: (d, c) => `${c.preteur.nom} a enregistré un remboursement de ${usd(d.montantCents)}. Reste dû : ${usd(d.soldeCents)}. Si c'est inexact, signalez-le.`,
  creditSolde: (d, c) => `Votre crédit auprès de ${c.preteur.nom} est entièrement remboursé. Merci.`,
  rappelEcheance: (d, c) => `Rappel : ${usd(d.soldeCents)} à rembourser à ${c.preteur.nom} avant le ${date(d.echeanceLe)}.`,
  echeanceAujourdhui: (d, c) => `Échéance aujourd'hui : ${usd(d.soldeCents)} à rembourser à ${c.preteur.nom}.`,
  retardPharmacie: (d, c) => `Retard : ${usd(d.soldeCents)} dus à ${c.preteur.nom} depuis le ${date(d.echeanceLe)}. Nouveaux crédits chez ce prêteur suspendus jusqu'au remboursement.`,
  retardPreteur: (d, c) => `${c.pharmacie.nom} est en retard de remboursement : ${usd(d.soldeCents)}, échéance du ${date(d.echeanceLe)}.`,
  codeVerification: (d) => `Votre code de vérification : ${d.code}. Il expire dans 10 minutes. Ne le communiquez à personne.`,
  codeConnexion: (d) => `Votre code de connexion : ${d.code}. Il expire dans 5 minutes. Ne le communiquez à personne.`,
  inscriptionRecue: (d, c) => `Téléphone confirmé. Inscription de ${c.destinataire.nom} reçue : nous vérifions votre agrément et vous prévenons par SMS.`,
  inscriptionApprouvee: (d, c) => `Le compte de ${c.destinataire.nom} est validé. Vous pouvez utiliser la plateforme.`,
  inscriptionRejetee: (d) => `Votre inscription n'a pas été retenue. Motif : ${d.motif}`,
  compteSuspendu: (d) => `Votre compte est suspendu. Motif : ${d.motif}`,
  compteReactive: () => 'Votre compte est de nouveau actif.',
};

// Événement du flux Crédit -> messages à envoyer. La clé rend la création idempotente :
// un événement relu après une panne ne produit pas de second SMS.
export function messagesPourEvenement(e) {
  const pour = (destinataireId, modele) => ({
    cle: `${e.id}:${destinataireId}`, destinataireId, modele, donnees: e.donnees ?? {},
    pharmacieId: e.pharmacieId, creancierId: e.creancierId,
  });
  switch (e.type) {
    case 'DemandeSoumise': return [pour(e.creancierId, 'nouvelleDemande')];
    case 'DemandeValidee': return [pour(e.pharmacieId, 'demandeValidee')];
    case 'DemandeRefusee': return [pour(e.pharmacieId, 'demandeRefusee')];
    case 'DemandeExpiree': return [pour(e.pharmacieId, 'demandeExpiree')];
    case 'RemboursementConstate': return [pour(e.pharmacieId, 'remboursementConstate')];
    case 'DemandeCloturee': return [pour(e.pharmacieId, 'creditSolde')];
    default: return [];
  }
}

// Événement du flux Identité -> message à l'acteur concerné.
const MODELE_IDENTITE = {
  CodeVerificationEmis: 'codeVerification',
  CodeConnexionEmis: 'codeConnexion',
  TelephoneVerifie: 'inscriptionRecue',
  InscriptionApprouvee: 'inscriptionApprouvee',
  InscriptionRejetee: 'inscriptionRejetee',
  CompteSuspendu: 'compteSuspendu',
  CompteReactive: 'compteReactive',
};
export function messagesPourEvenementIdentite(e) {
  const modele = MODELE_IDENTITE[e.type];
  if (!modele) return [];
  const m = { cle: `${e.id}:${e.acteurId}`, destinataireId: e.acteurId, modele, donnees: e.donnees ?? {} };
  // Un code expiré ne sert plus à rien : inutile de l'envoyer après une panne.
  if (e.donnees?.expireLe) m.perimeLe = e.donnees.expireLe;
  return [m];
}
