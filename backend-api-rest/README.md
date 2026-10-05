# IA Langues Locales CI — Authentification, utilisateurs et tokens

## Installation

Créer un environnement virtuel, installer `requirements.txt`, puis copier `.env.example` vers `.env`. Renseigner l'URL PostgreSQL et remplacer `JWT_SECRET_KEY` par une valeur aléatoire longue et privée. Ne jamais versionner `.env`.

Renseigner aussi les identifiants OAuth de chaque application cliente dans `GOOGLE_CLIENT_IDS` et `APPLE_CLIENT_IDS`. Plusieurs identifiants sont acceptés, séparés par des virgules (par exemple les identifiants Web et mobiles).

Pour installer les dépendances de développement et lancer les tests :

```sh
pip install -r requirements-dev.txt
pytest
```

## Base de données

Créer la base PostgreSQL, puis exécuter à la racine de `backend-api-rest` :

```sh
alembic upgrade head
python -m scripts.seed_rbac
```

La migration attribue également le solde de bienvenue aux comptes déjà présents.

## Authentification

- `POST /api/v1/auth/register` : inscription avec nom, e-mail, numéro de téléphone et mot de passe (10 caractères minimum).
- `POST /api/v1/auth/login` et `POST /api/v1/auth/refresh` : connexion par mot de passe et renouvellement de session.
- `POST /api/v1/auth/social/nonce` : demander un nonce à usage unique avant de lancer la connexion Google ou Apple.
- `POST /api/v1/auth/social/login` : envoyer le jeton d'identité signé par le fournisseur et le nonce brut reçu du backend. Pour Apple, le client transmet au fournisseur le SHA-256 du nonce, mais renvoie le nonce brut au backend.
- `GET /api/v1/users/me` : profil du compte ; `POST /api/v1/auth/logout` et `/logout-all` ferment les sessions.

Lors de sa première connexion sociale, l'utilisateur doit aussi fournir son nom et son téléphone si le fournisseur ne les donne pas. Une adresse e-mail vérifiée par Google ou Apple peut être liée à un compte existant ayant la même adresse. Les jetons d'identité sont vérifiés côté serveur avec les clés publiques officielles, l'émetteur, l'audience, l'expiration et un nonce à usage unique.

## Limitation des requêtes

SlowAPI applique par adresse IP une limite générale, plus stricte sur l'inscription, la connexion, le renouvellement de session et la connexion sociale. Par défaut : `120/minute` pour les routes et `5/minute` pour les opérations d'authentification (`10/minute` pour demander un nonce social). Les paramètres `RATE_LIMIT_DEFAULT`, `RATE_LIMIT_AUTH` et `RATE_LIMIT_SOCIAL_NONCE` permettent de les configurer. Les réponses comprennent les en-têtes standards de limite ; un dépassement renvoie HTTP 429.

`REDIS_URL` configure le stockage partagé des compteurs, nécessaire en production avec plusieurs processus ou instances. Docker Compose pointe déjà l'API vers Redis. Le développement local nécessite également un serveur Redis joignable. Si l'API est derrière un proxy inverse, ne faire confiance qu'aux en-têtes proxy ajoutés par une infrastructure de confiance ; ne pas accepter directement les adresses fournies par les clients.

## Journal d'activité et audit

Les requêtes API et les opérations sensibles (authentification, changements de corpus) sont ajoutées au flux Redis `app:usage:events`. Un worker Redis Streams les persiste dans `usage_events` et ne les acquitte qu'après validation de la transaction SQL ; les événements déjà enregistrés sont idempotents en cas de reprise. Les opérations de consommation, de refus ou de renouvellement de tokens créent également un événement dans la même transaction que le portefeuille, en plus du grand livre `token_transactions`.

Un administrateur disposant de `usage.read` peut consulter le journal avec `GET /api/v1/usage/events`, et filtrer par `user_id` ou `event_type`. `python -m scripts.seed_rbac` attribue cette permission aux rôles `ADMIN` et `SUPER_ADMIN`. Le journal ne stocke pas le corps des requêtes, les paramètres d'URL, les mots de passe, les jetons d'accès ni les adresses IP. `REDIS_URL` doit être disponible pour démarrer l'API ; Docker Compose configure déjà le service Redis et son stockage persistant.

Les échecs de mise en file Redis sont explicitement signalés dans les journaux du serveur ; la requête métier n'est pas annulée après coup. Les événements de consommation de tokens restent cependant persistés dans la même transaction que le solde et dans `token_transactions`.

## Solde de tokens

Chaque nouveau compte reçoit **1 000 tokens gratuits**. Le quota gratuit est remis à 1 000 tous les 30 jours à partir de l'inscription ; les tokens gratuits non utilisés ne sont pas reportés. `GET /api/v1/users/me/tokens` indique le solde gratuit, le solde acheté, le total, la présence de tokens et la prochaine date de renouvellement.

`TokenService.consume_tokens` permet aux fonctionnalités métier de débiter le portefeuille de façon transactionnelle, en utilisant d'abord les tokens gratuits, puis ceux achetés. Les crédits achetés sont conservés séparément du quota gratuit. Aucun moyen de paiement ni point d'entrée HTTP d'achat n'est activé pour l'instant ; un futur webhook de paiement devra vérifier la transaction avant d'appeler le service interne de crédit.

Le nombre initial et l'intervalle peuvent être configurés avec `FREE_TOKEN_GRANT` et `FREE_TOKEN_REFILL_DAYS`.

## Données linguistiques

Le module `/api/v1/data` permet de gérer les langues et un corpus bilingue de mots, expressions ou phrases. Aucun vocabulaire de démonstration n'est inséré automatiquement.

- `GET /api/v1/data/languages` : langues actives.
- `GET /api/v1/data/entries` : rechercher les entrées, avec les filtres facultatifs `source_language`, `target_language`, `q` et `kind`, puis `offset`/`limit`.
- `GET /api/v1/data/entries/{id}` : consulter une entrée.
- `POST /api/v1/data/languages`, `PATCH /api/v1/data/languages/{id}`, `POST /api/v1/data/entries`, `PATCH/DELETE /api/v1/data/entries/{id}` : gestion réservée aux comptes disposant de `data.manage`.

Le script `python -m scripts.seed_rbac` attribue cette permission aux rôles `LINGUIST`, `MODERATOR`, `ADMIN` et `SUPER_ADMIN`. Un administrateur existant doit relancer ce script après la migration. Les entrées enregistrent les deux langues, le terme et sa traduction, une prononciation facultative et une paire facultative d'exemples dans chaque langue.

## Rôles et administrateur initial

Préparer les variables `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` et `BOOTSTRAP_ADMIN_PASSWORD` dans l'environnement d'exécution, puis lancer :

```sh
python -m scripts.create_super_admin
```

Ne pas placer de mot de passe réel dans le dépôt. Les rôles ne sont jamais fournis par l'inscription publique.

## Démarrage

```sh
uvicorn app.main:app --reload
```

Swagger : http://127.0.0.1:8000/docs

## Avant mise en production

Configurer HTTPS et les identifiants OAuth de production, garder un stockage Redis partagé et correctement protégé pour les limites, mettre en place les parcours de vérification d'e-mail/téléphone et de récupération de compte, puis intégrer et vérifier côté serveur le prestataire de paiement choisi. La vérification du téléphone n'est pas encore effectuée par ce backend.
