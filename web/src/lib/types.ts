// Types des réponses de la plateforme (voir validation-depots/README.md).

export type RolePreteur = "depot" | "imf" | "banque";
export type RoleActeur = "pharmacie" | RolePreteur;
export type StatutCompte = "EN_ATTENTE" | "ACTIF" | "REJETE" | "SUSPENDU";

export interface Acteur {
  id: string;
  role: RoleActeur;
  nom: string;
  telephone: string | null;
  telephoneVerifie: boolean;
  numeroAgrement: string | null;
  adresse: string | null;
  statut: StatutCompte;
  motif: string | null;
  inscritLe: number;
  historique: EntreeHistorique[];
}

export interface EntreeHistorique {
  le: number;
  statut: StatutCompte;
  action?: string;
  motif?: string | null;
  telephoneVerifie?: boolean;
  par?: { id: string; nom: string };
}

export type EtatDemande =
  | "SOUMISE"
  | "VALIDEE"
  | "LIVREE"
  | "RECEPTIONNEE"
  | "CLOTUREE"
  | "REFUSEE"
  | "ANNULEE"
  | "EXPIREE";

export interface Demande {
  id: string;
  pharmacieId: string;
  pharmacieNom: string | null;
  creancierId: string;
  creancierNom: string | null;
  creancierType: RolePreteur;
  lignes: { produit: string; quantite: number }[];
  note: string;
  etat: EtatDemande;
  valeurCents: number | null;
  soldeCents: number;
  delaiAccordeJours: number | null;
  graceJours: number | null;
  echeanceLe: number | null;
  receptionLe: number | null;
  clotureLe: number | null;
  remboursements: { le: number; montantCents: number }[];
  motifRefus: string | null;
  creeLe: number;
  expireLe: number;
  enRetard: boolean;
  historique: { le: number; par: string; action: string; etat: EtatDemande }[];
}

export interface Conditions {
  paliersUSD: number[];
  seriesRequises: number;
  graceJours: number;
  retardGraveJours: number;
  delaiDefautJours: number;
  delaiMaxJours: number;
  expirationHeures: number;
}

export interface Creancier {
  id: string;
  type: RolePreteur;
  nom: string;
  conditions: Conditions;
}

export interface CreditRelation {
  palier: number;
  plafondCents: number;
  encoursCents: number;
  disponibleCents: number;
  bloque: boolean;
  enRetardIds: string[];
  serieEnCours: number;
  serieRequise: number;
  prochainPlafondCents: number | null;
}

export interface CreditChezPreteur extends CreditRelation {
  creancierId: string;
  type: RolePreteur;
  nom: string;
}

export type RoleAdmin = "superviseur" | "agent";

export interface Admin {
  id: string;
  nom: string;
  telephone: string;
  role: RoleAdmin;
  actif: boolean;
  creeLe: number;
  desactiveLe?: number;
}

export interface EntreeJournal {
  id?: string;
  le: number;
  par: { id: string; nom: string };
  action: string;
  cibleId: string;
  cibleNom: string;
  motif?: string;
  role?: string;
}
