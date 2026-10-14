# Backend — assistant IA en langues locales

Les clients n'accèdent qu'à la Gateway. Elle valide les JWT, applique les
autorisations par rôle, limite le débit, attribue un identifiant de requête et
transmet l'identité vérifiée aux services internes.

```text
Clients ──> Gateway :8000 ──> Identity :8001 ──> PostgreSQL
                         ├──> Conversation :8002 ──> PostgreSQL
                         └──> Learning :8003 ──> PostgreSQL
                              Redis : rate limit distribué + événements d'usage

Gateway et services ──OTLP──> OpenTelemetry Collector ──> Tempo (traces)
                                                 └─────> Loki (logs)
Prometheus <── /metrics des services             Grafana <── Prometheus/Loki/Tempo
```

## Services et API

| Service | Rôle | Routes accessibles à travers la Gateway |
| --- | --- | --- |
| Identity | Connexion, inscription, utilisateurs, rôles, sessions, usage et données linguistiques | `/api/auth/*`, `/api/users/*`, `/api/roles/*`, `/api/permissions/*`, `/api/sessions/*`, `/api/usage/*`, `/api/data/*` |
| Conversation | Conversations texte et WebSocket audio | `/api/conversations/*`, `/ws/conversation` |
| Learning | Scénarios, tentatives et progression, réservés aux rôles `PRO`, `ADMIN` et `SUPER_ADMIN` | `/api/learning/*` |

Les changements de données linguistiques exigent la permission Identity
`data.manage`; les lectures requièrent une authentification. Les services
Identity, Conversation, Learning, les bases de données et Redis ne publient pas
de port sur l'hôte dans Compose. Les en-têtes `X-User-*` ne sont jamais repris
du client : la Gateway les supprime puis transmet l'identité du JWT vérifié.

Les services STT, Dialogue et TTS restent des prototypes/mockups dans
`ml/prototypes/` et Conversation. Billing et Feedback ne sont pas encore des
services : la Gateway ne leur déclare donc pas de routes actives.

## Démarrage local avec Compose

Depuis la racine du dépôt :

```bash
cp backend/.env.example backend/.env
# Remplacer chaque valeur CHANGE_ME par un secret aléatoire URL-safe.
docker compose --env-file backend/.env -f backend/docker-compose.yml up --build
```

Le JWT secret doit être identique pour Identity et la Gateway. Les mots de
passe PostgreSQL et Redis doivent être URL-safe (lettres, chiffres, `_` et
`-`) car ils sont intégrés aux URL de connexion. Le fichier d'exemple est
volontairement inutilisable tant que ses valeurs `CHANGE_ME` ne sont pas
remplacées.

- API : `http://localhost:8000`
- Grafana : `http://127.0.0.1:3000` (compte et mot de passe du fichier `.env`)
- Les ports Prometheus, Loki, Tempo, Collector, bases et services applicatifs
  restent privés aux réseaux Compose.

La Gateway est l'unique point d'entrée client. En local, ne publiez pas
directement les ports Identity, Conversation ou Learning. Si un reverse proxy
est placé devant la Gateway, configurez `GATEWAY_TRUSTED_PROXIES` avec ses
adresses exactes ; ne le réglez pas à `*`.

## Parcours de test via la Gateway

Une collection Postman couvrant les principales routes Gateway est disponible dans
[`postman/gateway-api.postman_collection.json`](./postman/gateway-api.postman_collection.json).
Importez-la dans Postman; la variable `baseUrl` vaut par défaut
`http://localhost:8000`. Envoyez Register puis Login pour créer un utilisateur
de test et enregistrer automatiquement les jetons dans les variables de
collection. Envoyez ensuite les requêtes nécessaires une par une; certaines
routes administratives ou Learning répondront `403` pour un compte standard.
Les actions de révocation invalident le jeton et il ne
faut en exécuter qu'une seule, après les autres tests.

Inscription et connexion passent toutes deux par la Gateway :

```bash
curl -i http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Test Utilisateur","email":"test@example.com","phone_number":"+2250102030405","password":"UnMotDePasseTresSolide123"}'

curl -i http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"UnMotDePasseTresSolide123"}'
```

Copiez `access_token` de la réponse de connexion, puis testez une route
protégée :

```bash
curl -i http://localhost:8000/api/conversations/ \
  -H 'Authorization: Bearer <access_token>'
```

La Gateway retourne `401` pour un jeton absent/invalide, `403` pour un rôle
non autorisé, `429` lorsque la limite est dépassée, `502` si l'upstream est
indisponible et `504` sur expiration du délai. Un `X-Request-ID` est retourné
pour chaque réponse et peut être transmis à l'avance par un client si sa valeur
est sûre et fait au plus 64 caractères.

`GET /health` vérifie la vie du processus. `GET /ready` vérifie aussi la
disponibilité de Redis pour le limiteur. Les services vérifient leurs
dépendances critiques sur `/ready`. Quand Redis est configuré mais indisponible,
la Gateway échoue de manière fermée (`503`) au lieu de désactiver la limite.
Hors Compose, si `REDIS_URL` est omis, le limiteur mémoire convient seulement
à une instance unique.

## Observabilité

- `/metrics` expose les compteurs et latences HTTP à Prometheus, sans étiquette
  à forte cardinalité (pas d'URL utilisateur, d'identifiant ni de jeton).
- L'instrumentation OpenTelemetry envoie les traces et logs au Collector.
- Grafana provisionne Prometheus, Loki et Tempo comme sources de données.
- Les configurations sont sous `observability/`. Les données de Grafana,
  Prometheus, Loki et Tempo résident dans des volumes Compose.

## Tests et validation

Créer l'environnement et installer les dépendances d'un service depuis la
racine du dépôt :

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/gateway/requirements-dev.txt
backend/.venv/bin/pip install -r backend/identity/requirements-dev.txt
backend/.venv/bin/pip install -r backend/conversation/requirements-dev.txt
backend/.venv/bin/pip install -r backend/learning/requirements-dev.txt
```

Lancer les suites depuis chaque répertoire afin d'éviter toute ambiguïté entre
les modules `app` :

```bash
(cd backend/gateway && ../.venv/bin/python -m pytest -q tests)
(cd backend/identity && ../.venv/bin/python -m pytest -q tests)
(cd backend/conversation && ../.venv/bin/python -m pytest -q tests)
(cd backend/learning && ../.venv/bin/python -m pytest -q tests)
```

Les migrations Identity et l'initialisation idempotente des rôles/permissions
sont exécutées avant le démarrage de son serveur.
Conversation et Learning créent toujours leurs tables au démarrage ; il faudra
leur ajouter des migrations avant d'utiliser ces deux services pour une mise
à niveau de schéma en production.
