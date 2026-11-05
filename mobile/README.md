# Nuru ya Afya — application mobile (pharmacies)

Application Flutter pour les pharmacies : voir son plafond chez chaque prêteur, demander des produits à crédit, confirmer une livraison, suivre les remboursements. Les prêteurs et l'administration utilisent le site web (`../web`).

**Nuru ya Afya ne touche jamais à l'argent.** Les remboursements sont déclarés par le prêteur ; l'application les affiche, elle n'en fait pas.

## Ce que fait l'application

- Connexion par SMS (numéro, puis code à 6 chiffres) ; inscription d'une pharmacie avec confirmation du téléphone, qui se reprend si l'application est fermée en route.
- Accueil : plafond et disponible chez chaque prêteur, progression vers le palier suivant, alertes (retard, livraison à confirmer).
- Demandes : liste filtrable, détail avec étapes, remboursements déclarés et historique ; confirmer la réception, annuler.
- Nouvelle demande : choix du prêteur (avec le disponible), produits, note.
- Prêteurs : conditions publiques de chacun.
- **Fonctionne sans réseau** : consultation de la dernière copie, actions mises en file puis renvoyées (même clé d'idempotence, aucun doublon).

## Lancer

Prérequis : Flutter 3.47 ou plus.

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

`API_URL` est l'adresse de la plateforme. `10.0.2.2` est l'ordinateur vu depuis l'émulateur Android ; sur un téléphone réel, utilisez l'adresse de votre machine sur le réseau. Sans `API_URL`, l'application vise `http://localhost:3000` sur le web et `http://10.0.2.2:3000` ailleurs.

**Avec la plateforme de démonstration** (dans `../validation-depots`) :

```bash
npm run demo
```

Numéro de démonstration : `+243810000001` (pharmacie). Le code SMS s'affiche dans la console de la démo.

**Dans un navigateur** (pratique pour regarder l'interface) : la plateforme n'accepte les appels d'un autre site que s'il est autorisé. La démo autorise `http://localhost:8081` :

```bash
flutter build web --release --dart-define=API_URL=http://localhost:3000
cd build/web && python -m http.server 8081
```

En production, autorisez les origines voulues avec `ORIGINES_AUTORISEES` côté plateforme. Une application mobile native n'a pas besoin de CORS.

## Vérifier

```bash
flutter analyze
flutter test
```

Les tests couvrent le dépôt de données (repli sur la copie locale, file hors ligne, reprise après redémarrage, ordre, absence de doublon, erreurs métier), les règles de redirection, et chaque écran sur un petit écran avec un texte agrandi (aucun débordement), y compris hors ligne.

## Construire pour Android

Il faut le SDK Android (`flutter doctor` indique ce qui manque), puis :

```bash
flutter build apk --release --dart-define=API_URL=https://api.exemple.cd
```

iOS n'est pas inclus : `flutter create --platforms ios .` l'ajoute (macOS requis pour compiler).

## Limites connues

- La session dure 12 h côté plateforme : un nouveau code SMS est demandé chaque jour.
- Le build Android n'a pas été vérifié ; l'application a été vérifiée par tests et dans un navigateur (rendu web).
- Pas de notifications push : l'état se met à jour à l'ouverture, au retour dans l'application, au tirage pour actualiser, et toutes les 30 s pour la file d'attente.

## Structure

| Dossier | Rôle |
|---|---|
| `lib/domaine` | Modèles (demande, crédit, prêteur, compte) |
| `lib/donnees` | Dépôts, file d'attente hors ligne |
| `lib/core` | Réseau, stockage sécurisé et cache, formats, erreurs |
| `lib/etat` | Fournisseurs Riverpod, routeur |
| `lib/presentation` | Thème, composants, écrans |
