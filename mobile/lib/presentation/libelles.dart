import '../domaine/demande.dart';
import 'composants/pastille.dart';

/// Libellés affichés à l'utilisateur, identiques à ceux du site.
String libelleEtat(EtatDemande e) => switch (e) {
      EtatDemande.soumise => 'En attente du prêteur',
      EtatDemande.validee => 'Validée, livraison à venir',
      EtatDemande.livree => 'Livrée, à confirmer',
      EtatDemande.receptionnee => 'Reçue, à rembourser',
      EtatDemande.cloturee => 'Remboursée',
      EtatDemande.refusee => 'Refusée',
      EtatDemande.annulee => 'Annulée',
      EtatDemande.expiree => 'Expirée sans réponse',
    };

TonPastille tonEtat(EtatDemande e) => switch (e) {
      EtatDemande.soumise || EtatDemande.livree => TonPastille.attente,
      EtatDemande.validee || EtatDemande.receptionnee => TonPastille.ok,
      EtatDemande.cloturee => TonPastille.fin,
      EtatDemande.refusee => TonPastille.alerte,
      EtatDemande.annulee || EtatDemande.expiree => TonPastille.neutre,
    };

String typePreteur(String type) => switch (type) {
      'depot' => 'Dépôt',
      'imf' => 'IMF',
      'banque' => 'Banque',
      _ => type,
    };

String libelleAction(String action) => switch (action) {
      'soumettre' => 'Demande soumise',
      'valider' => 'Validée par le prêteur',
      'refuser' => 'Refusée par le prêteur',
      'livrer' => 'Marquée comme livrée',
      'receptionner' => 'Réception confirmée',
      'rembourser' => 'Remboursement enregistré',
      'annuler' => 'Demande annulée',
      'expirer' => 'Expirée sans réponse',
      _ => action,
    };
