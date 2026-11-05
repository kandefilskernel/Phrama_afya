int _entier(dynamic v) => (v as num).toInt();
int? _entierOuNull(dynamic v) => v == null ? null : (v as num).toInt();

enum EtatDemande {
  soumise('SOUMISE'),
  validee('VALIDEE'),
  livree('LIVREE'),
  receptionnee('RECEPTIONNEE'),
  cloturee('CLOTUREE'),
  refusee('REFUSEE'),
  annulee('ANNULEE'),
  expiree('EXPIREE');

  const EtatDemande(this.code);
  final String code;

  static EtatDemande depuis(String code) => values.firstWhere((e) => e.code == code, orElse: () => EtatDemande.soumise);

  /// Encore en cours : la demande attend une action de l'une des deux parties.
  bool get estEnCours => this == soumise || this == validee || this == livree || this == receptionnee;
}

class LigneDemande {
  const LigneDemande({required this.produit, required this.quantite});

  factory LigneDemande.fromJson(Map<String, dynamic> j) => LigneDemande(produit: j['produit'] as String, quantite: _entier(j['quantite']));

  final String produit;
  final int quantite;

  Map<String, dynamic> toJson() => {'produit': produit, 'quantite': quantite};
}

class Remboursement {
  const Remboursement({required this.le, required this.montantCents});

  factory Remboursement.fromJson(Map<String, dynamic> j) => Remboursement(le: _entier(j['le']), montantCents: _entier(j['montantCents']));

  final int le;
  final int montantCents;
}

class EvenementDemande {
  const EvenementDemande({required this.le, required this.action, required this.etat});

  factory EvenementDemande.fromJson(Map<String, dynamic> j) =>
      EvenementDemande(le: _entier(j['le']), action: j['action'] as String, etat: EtatDemande.depuis(j['etat'] as String));

  final int le;
  final String action;
  final EtatDemande etat;
}

class Demande {
  const Demande({
    required this.id,
    required this.creancierId,
    required this.creancierType,
    required this.lignes,
    required this.etat,
    required this.soldeCents,
    required this.creeLe,
    required this.expireLe,
    required this.enRetard,
    required this.remboursements,
    required this.historique,
    this.creancierNom,
    this.note = '',
    this.valeurCents,
    this.delaiAccordeJours,
    this.graceJours,
    this.echeanceLe,
    this.motifRefus,
  });

  factory Demande.fromJson(Map<String, dynamic> j) => Demande(
        id: j['id'] as String,
        creancierId: j['creancierId'] as String,
        creancierNom: j['creancierNom'] as String?,
        creancierType: j['creancierType'] as String,
        lignes: (j['lignes'] as List).map((l) => LigneDemande.fromJson(l as Map<String, dynamic>)).toList(),
        note: j['note'] as String? ?? '',
        etat: EtatDemande.depuis(j['etat'] as String),
        valeurCents: _entierOuNull(j['valeurCents']),
        soldeCents: _entier(j['soldeCents']),
        delaiAccordeJours: _entierOuNull(j['delaiAccordeJours']),
        graceJours: _entierOuNull(j['graceJours']),
        echeanceLe: _entierOuNull(j['echeanceLe']),
        remboursements: (j['remboursements'] as List? ?? const []).map((r) => Remboursement.fromJson(r as Map<String, dynamic>)).toList(),
        motifRefus: j['motifRefus'] as String?,
        creeLe: _entier(j['creeLe']),
        expireLe: _entier(j['expireLe']),
        enRetard: j['enRetard'] as bool? ?? false,
        historique: (j['historique'] as List? ?? const []).map((h) => EvenementDemande.fromJson(h as Map<String, dynamic>)).toList(),
      );

  final String id;
  final String creancierId;
  final String? creancierNom;

  /// depot, imf ou banque.
  final String creancierType;
  final List<LigneDemande> lignes;
  final String note;
  final EtatDemande etat;

  /// Fixé par le prêteur à la validation.
  final int? valeurCents;
  final int soldeCents;
  final int? delaiAccordeJours;
  final int? graceJours;
  final int? echeanceLe;
  final List<Remboursement> remboursements;
  final String? motifRefus;
  final int creeLe;
  final int expireLe;
  final bool enRetard;
  final List<EvenementDemande> historique;

  /// Une demande reçue dont le solde n'est pas nul : de l'argent reste dû.
  bool get resteDu => etat == EtatDemande.receptionnee && soldeCents > 0;

  /// Le prêteur a livré : à la pharmacie de confirmer qu'elle a bien tout reçu.
  bool get aConfirmer => etat == EtatDemande.livree;

  bool get annulable => etat == EtatDemande.soumise || etat == EtatDemande.validee;

  String resume() => lignes.map((l) => '${l.quantite} × ${l.produit}').join(' · ');
}
