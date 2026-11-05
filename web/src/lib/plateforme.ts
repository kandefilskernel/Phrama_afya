import "server-only";
import { appeler, ErreurApi } from "./api";
import { adresseClient } from "./client";
import { jetonDeSession } from "./session";
import type {
  Acteur, Admin, Conditions, Creancier, CreditChezPreteur, CreditRelation, Demande, EntreeJournal, EtatDemande, RoleActeur,
} from "./types";

async function jetonActeur() {
  const j = await jetonDeSession("acteur");
  if (!j) throw new ErreurApi(401, "Vous n'êtes pas connecté.");
  return j;
}
async function jetonAdmin() {
  const j = await jetonDeSession("admin");
  if (!j) throw new ErreurApi(401, "Vous n'êtes pas connecté.");
  return j;
}

export interface CorpsInscription {
  role: RoleActeur;
  nom: string;
  telephone: string;
  numeroAgrement: string;
  adresse?: string;
}

/** Réponse de création d'un compte : le jeton n'est montré qu'une seule fois. */
export type AvecJeton<T> = T & { token: string };

// ---- Acteurs (pharmacies et prêteurs) -------------------------------------------------------
/** Résultat d'une connexion par SMS : une session qui expire côté serveur. */
export interface SessionOuverte {
  token: string;
  expireLe: number;
  role: RoleActeur;
  statut: string;
}

export const plateforme = {
  async inscrire(corps: CorpsInscription) {
    return appeler<AvecJeton<Acteur>>("POST", "/inscriptions", { corps, adresseClient: await adresseClient() });
  },
  moi: (jeton: string) => appeler<Acteur>("GET", "/moi", { jeton }),

  // Connexion par SMS. La première étape répond toujours de la même façon, que le numéro ait un compte ou non.
  async demanderCodeConnexion(telephone: string) {
    return appeler<{ envoye: boolean }>("POST", "/connexion/code", { corps: { telephone }, adresseClient: await adresseClient() });
  },
  async verifierCodeConnexion(telephone: string, code: string) {
    return appeler<SessionOuverte>("POST", "/connexion/verifier", { corps: { telephone, code }, adresseClient: await adresseClient() });
  },
  /** Ferme la session côté serveur. Sans effet sur un jeton permanent. */
  deconnecter: (jeton: string) => appeler<{ ferme: boolean }>("POST", "/moi/deconnexion", { jeton, corps: {} }),

  async verifierTelephone(code: string) {
    return appeler<Acteur>("POST", "/moi/telephone/verifier", { jeton: await jetonActeur(), corps: { code } });
  },
  async renvoyerCode() {
    return appeler<{ envoye: boolean; expireLe: number }>("POST", "/moi/telephone/renvoyer", { jeton: await jetonActeur(), corps: {} });
  },

  async creanciers() {
    return appeler<Creancier[]>("GET", "/creanciers", { jeton: await jetonActeur() });
  },
  async demandes(etat?: EtatDemande) {
    const q = etat ? `?etat=${encodeURIComponent(etat)}` : "";
    return appeler<Demande[]>("GET", `/demandes${q}`, { jeton: await jetonActeur() });
  },
  async demande(id: string) {
    return appeler<Demande>("GET", `/demandes/${encodeURIComponent(id)}`, { jeton: await jetonActeur() });
  },
  async soumettre(corps: { creancierId: string; lignes: { produit: string; quantite: number }[]; note?: string }) {
    return appeler<Demande>("POST", "/demandes", { jeton: await jetonActeur(), corps });
  },
  async agir(id: string, action: string, corps: Record<string, unknown> = {}, cle?: string) {
    return appeler<Demande>("POST", `/demandes/${encodeURIComponent(id)}/${action}`, { jeton: await jetonActeur(), corps, cle });
  },
  /** Prêteur : sa relation avec une pharmacie. Pharmacie : une ligne par prêteur. */
  async creditPharmacieChezPreteur(pharmacieId: string) {
    return appeler<CreditRelation>("GET", `/pharmacies/${encodeURIComponent(pharmacieId)}/credit`, { jeton: await jetonActeur() });
  },
  async creditChezLesPreteurs(pharmacieId: string) {
    return appeler<CreditChezPreteur[]>("GET", `/pharmacies/${encodeURIComponent(pharmacieId)}/credit`, { jeton: await jetonActeur() });
  },
  async conditions() {
    return appeler<Conditions>("GET", "/conditions", { jeton: await jetonActeur() });
  },
  async definirConditions(corps: Conditions) {
    return appeler<Conditions>("PUT", "/conditions", { jeton: await jetonActeur(), corps });
  },
};

// ---- Administration -------------------------------------------------------------------------
export const administration = {
  moi: (jeton: string) => appeler<Admin>("GET", "/admin/moi", { jetonAdmin: jeton }),
  async renouvelerMonJeton() {
    return appeler<{ id: string; token: string }>("POST", "/admin/moi/jeton", { jetonAdmin: await jetonAdmin(), corps: {} });
  },
  async acteurs(filtre: { statut?: string; role?: string } = {}) {
    const q = new URLSearchParams();
    if (filtre.statut) q.set("statut", filtre.statut);
    if (filtre.role) q.set("role", filtre.role);
    const suffixe = q.size ? `?${q}` : "";
    return appeler<Acteur[]>("GET", `/admin/acteurs${suffixe}`, { jetonAdmin: await jetonAdmin() });
  },
  async decision(id: string, action: "approuver" | "rejeter" | "suspendre" | "reactiver", motif?: string) {
    return appeler<Acteur>("POST", `/admin/acteurs/${encodeURIComponent(id)}/${action}`, {
      jetonAdmin: await jetonAdmin(), corps: motif === undefined ? {} : { motif },
    });
  },
  async reemettreJetonActeur(id: string) {
    return appeler<{ id: string; token: string }>("POST", `/admin/acteurs/${encodeURIComponent(id)}/jeton`, { jetonAdmin: await jetonAdmin(), corps: {} });
  },
  async administrateurs() {
    return appeler<Admin[]>("GET", "/admin/administrateurs", { jetonAdmin: await jetonAdmin() });
  },
  async creerAdministrateur(corps: { nom: string; telephone: string; role: string }) {
    return appeler<AvecJeton<Admin>>("POST", "/admin/administrateurs", { jetonAdmin: await jetonAdmin(), corps });
  },
  async desactiverAdministrateur(id: string, motif: string) {
    return appeler<Admin>("POST", `/admin/administrateurs/${encodeURIComponent(id)}/desactiver`, { jetonAdmin: await jetonAdmin(), corps: { motif } });
  },
  async reemettreJetonAdministrateur(id: string) {
    return appeler<{ id: string; token: string }>("POST", `/admin/administrateurs/${encodeURIComponent(id)}/jeton`, { jetonAdmin: await jetonAdmin(), corps: {} });
  },
  async journal(filtre: { adminId?: string; cibleId?: string } = {}) {
    const q = new URLSearchParams();
    if (filtre.adminId) q.set("adminId", filtre.adminId);
    if (filtre.cibleId) q.set("cibleId", filtre.cibleId);
    const suffixe = q.size ? `?${q}` : "";
    return appeler<EntreeJournal[]>("GET", `/admin/journal${suffixe}`, { jetonAdmin: await jetonAdmin() });
  },
};
