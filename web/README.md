# Interface web Nuru ya Afya

Application Next.js (App Router, TypeScript, Tailwind) pour les trois publics de la plateforme de crédit de proximité :

| Espace | Adresse | Pour qui |
|---|---|---|
| Public | `/`, `/inscription`, `/connexion`, `/compte` | inscription en trois étapes, connexion, statut du compte |
| Pharmacie | `/pharmacie` | tableau de bord (plafond par prêteur, échéances), demandes, annuaire des prêteurs |
| Prêteur (dépôt, IMF, banque) | `/preteur` | demandes à traiter, validation et refus, livraison, remboursements, pharmacies suivies, conditions |
| Administration | `/admin` | comptes à vérifier, équipe (superviseur), journal (superviseur) |

L'interface est en français, pensée d'abord pour téléphone : cartes empilées, grandes cibles tactiles, montants en USD avec virgule décimale acceptée (« 18,50 »), numéros congolais acceptés au format local (« 0812345678 »).

## Lancer en développement

La plateforme doit tourner (port 3000 par défaut). Pour une plateforme de démonstration avec des comptes et des demandes d'exemple :

```bash
cd ../validation-depots
npm run demo
```

Elle écrit les jetons de connexion de démonstration dans `donnees-demo/identifiants.json`. Ensuite :

```bash
npm install
npm run dev
```

L'application répond sur http://localhost:3000. Si la plateforme occupe déjà ce port, lancez le front sur un autre : `npx next dev -p 3100`. Sans `PLATEFORME_URL`, le front cherche la plateforme sur `http://localhost:3000`.

Avec Docker, depuis `validation-depots/` : `docker compose up --build`. Le front est alors sur http://localhost:3100.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PLATEFORME_URL` | `http://localhost:3000` | adresse de la plateforme, jamais exposée au navigateur |
| `COOKIE_SECURE` | `0` | `1` derrière HTTPS : le cookie de session n'est alors envoyé qu'en HTTPS |
| `JETON_BFF` | (aucun) | secret partagé avec la plateforme : lui prouve que l'adresse du client transmise vient bien de ce serveur. Sans lui, les limites anti-abus de la plateforme s'appliquent à tout le site ensemble |

## Commandes

```bash
npm test          # utilitaires : téléphone, montants, dates
npm run typecheck # génère les types de routes puis vérifie le typage
npm run lint
npm run build
```

## Comment ça marche

**Tout passe par le serveur Next.** Le navigateur ne parle jamais à la plateforme. Les pages sont des composants serveur qui lisent les données, et chaque action (valider, rembourser, approuver...) est une action serveur. Conséquences :
- le jeton de l'utilisateur vit dans un cookie `httpOnly` (`nuru_acteur` ou `nuru_admin`), illisible par le JavaScript de la page ;
- la protection contre les requêtes intersites est assurée par Next (contrôle de l'origine des actions) et par `SameSite=Lax` ;
- le jeton ne transite jamais dans une adresse ni dans le code envoyé au navigateur, sauf au moment où il est montré une seule fois à son titulaire.

**Connexion par SMS.** `/connexion` demande le numéro (formats locaux acceptés), `/connexion/code` demande le code reçu. Le numéro est gardé entre les deux étapes dans un cookie `httpOnly` de 10 minutes plutôt que dans l'adresse. La session obtenue expire côté serveur au bout de 12 h, et « Quitter » la ferme réellement sur la plateforme. La page répond de la même façon que le numéro ait un compte ou non. Un chemin de dépannage par jeton reste disponible sur `/connexion/jeton`.

**Contrôle d'accès** (`src/lib/auth.ts`). Chaque page demande qui est connecté. Une page d'espace exige un compte actif du bon type : sinon redirection vers la connexion, la page de statut du compte, ou l'espace correspondant au rôle. Les règles métier (plafond, droits, états) restent dans la plateforme : l'interface ne fait que les afficher et relayer ses refus en français.

**Double envoi.** Le formulaire de remboursement porte une clé d'idempotence générée par le serveur à chaque affichage : un double clic ou un renvoi n'enregistre le paiement qu'une fois. Les boutons se désactivent pendant l'envoi, et les actions graves demandent une seconde confirmation.

**Pas de mise en cache.** Chaque écran dépend de l'utilisateur et de montants qui doivent être à jour. L'option « Cache Components » de Next 16, activée par défaut dans le modèle de projet, est désactivée dans `next.config.ts` : toutes les pages de données sont rendues à chaque requête.

**Aucune ressource externe.** La police est embarquée, pas de CDN : l'application ne dépend d'aucun service tiers au chargement, ce qui compte sur des connexions lentes.

## Design

- **Identité** : un vert profond (`marque-*`) et un accent chaud « lumière » (`lumiere-*`), réservé aux repères importants. Les couleurs, ombres et la police sont des variables dans `src/app/globals.css` : tout se change à un seul endroit. Le logo est dans `src/components/logo.tsx` (et `src/app/icon.svg` pour l'onglet du navigateur).
- **Typographie** : Inter (variable), embarquée avec l'application grâce à `@fontsource-variable/inter`. Aucun appel à un service de polices externe. Les montants utilisent des chiffres de largeur fixe (`tabular-nums`) pour s'aligner.
- **Icônes** : `lucide-react`, un seul jeu cohérent.
- **Structure des espaces connectés** : barre latérale fixe sur ordinateur, avec le compte et la déconnexion en bas ; sur téléphone, en-tête compact et barre d'onglets en bas de l'écran, à portée du pouce (`src/components/espace.tsx`, `navigation.tsx`).
- **Listes de demandes** : un tableau sur ordinateur, des cartes sur téléphone (`ListeDemandes`). Toute la ligne est cliquable.
- **Fiches** : le résumé de la demande vient avant les actions, puis le détail du crédit et l'historique.
- **Chargement** : un écran de squelette par espace (`loading.tsx`) évite l'écran vide pendant que la page se prépare.
- **Composants** : `src/components/ui.tsx` regroupe boutons, cartes, badges, alertes, champs, indicateurs. Les pages ne définissent pas leurs propres styles de base.
- Respecte `prefers-reduced-motion`, avec des cibles tactiles d'au moins 44 px.

## Structure

```
src/
  app/
    page.tsx, (public)/…          accueil, inscription, connexion, statut du compte
    pharmacie/…, preteur/…        espaces connectés, chacun avec son layout et sa navigation
    admin/connexion, admin/(protege)/…
    actions/                      actions serveur : session, demandes, conditions, administration
    deconnexion/route.ts          efface la session expirée (un cookie ne se modifie pas depuis une page)
  components/                     ui.tsx (kit), formulaires.tsx, navigation.tsx, demandes.tsx…
  lib/
    api.ts, plateforme.ts         client de la plateforme, côté serveur uniquement
    session.ts, auth.ts           cookies de session et contrôle d'accès
    format.ts, montant.ts, telephone.ts   affichage et lecture des saisies (testés)
```

## Limites connues

- **La connexion par SMS dépend de l'envoi réel des SMS.** Tant qu'aucun fournisseur n'est branché, les codes ne s'affichent que dans le journal du service Notifications.
- **Limites par adresse.** Pour qu'elles s'appliquent par utilisateur, placez devant le site un serveur frontal (proxy) qui renseigne `X-Forwarded-For` en écrasant la valeur envoyée par le client. Sans lui, tous les utilisateurs partagent une seule limite.
- **Session de 12 heures**, sans renouvellement glissant.
- **Pas de test de bout en bout automatisé.** Les parcours ont été vérifiés à la main dans un navigateur (inscription, vérification du code, validation, remboursement, approbation, affichage téléphone) ; seuls les utilitaires ont des tests automatiques.
- **Pas de pagination.** Les listes affichent toutes les demandes de l'utilisateur. À ajouter avant un fort volume.
- **Pas de rafraîchissement automatique** : une demande validée par le prêteur apparaît à la pharmacie au prochain chargement de la page (elle reçoit aussi un SMS).
- **Français uniquement**, et fuseau d'affichage fixé à Kinshasa.
- **Accessibilité** : libellés associés aux champs, navigation au clavier, `aria-current` sur la navigation, contrastes soignés. Pas encore audité avec un lecteur d'écran.
