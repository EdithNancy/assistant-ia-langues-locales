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

### Contrat JSON de la Gateway

Les réponses JSON des routes `/api/*` utilisent cette enveloppe :

```json
{
  "item": {"id": "…"},
  "message": "Requête traitée avec succès.",
  "hasError": false
}
```

Une erreur conserve le statut HTTP et fournit la même enveloppe :

```json
{
  "item": null,
  "message": "Les données envoyées ne sont pas valides.",
  "hasError": true
}
```

`item` contient la réponse métier (objet, liste ou `null`). `pagination`
n'apparaît que pour les réponses de listes paginées et contient `offset`,
`limit`, `total` et `hasMore`. En cas d'erreur, `item` vaut `null` et
`hasError` vaut `true`; le statut HTTP identifie la catégorie de l'erreur. Les
messages de validation ne répercutent pas les valeurs reçues (notamment les
mots de passe), et les détails internes des erreurs `5xx` ne sont pas exposés.

Les corps JSON des routes sont définis par des modèles Pydantic propres à
chaque opération; les champs inconnus sont refusés et renvoient `422`. Les
corps multipart/audio et le protocole WebSocket gardent leur format spécifique.
Les listes de conversations, messages, scénarios, tentatives, sessions,
utilisateurs, rôles, permissions, langues, entrées de vocabulaire et événements
d'usage sont paginées via `offset` et `limit`, avec des plafonds par route.

Exemple de liste paginée :

```json
{
  "item": [{"id": "…"}],
  "message": "Requête traitée avec succès.",
  "hasError": false,
  "pagination": {
    "offset": 0,
    "limit": 20,
    "total": 47,
    "hasMore": true
  }
}
```

La page suivante se demande avec `?offset=20&limit=20`. Tous les critères de
liste sont des paramètres d'URL sur les requêtes `GET` (jamais un body JSON).
Le contrat commun est :

| Paramètre | Rôle | Valeurs |
| --- | --- | --- |
| `offset` | Nombre d'éléments ignorés | Entier `>= 0`, défaut `0` |
| `limit` | Taille de page | Entier `1..100` (jusqu'à `500` pour `/api/data/*`), défaut `50` (données linguistiques : `100`) |
| `search` | Recherche textuelle propre à la ressource | Texte de 1 à 200 caractères |
| `sort_by` | Champ de tri | Uniquement les champs autorisés pour la route |
| `sort_order` | Sens du tri | `asc` ou `desc`; le sens historique de la route est utilisé par défaut |

Exemple combinant pagination, recherche et tri :

```http
GET /api/conversations?offset=0&limit=20&search=prononciation&sort_by=created_at&sort_order=desc
```

Les filtres métier sont également des paramètres de query string et peuvent
être combinés avec ces critères :

| Liste | Filtres | Champs `sort_by` | Recherche `search` |
| --- | --- | --- | --- |
| `/api/data/languages` | `active_only` | `name`, `code`, `created_at` | nom et code |
| `/api/data/entries` | `source_language`, `target_language`, `kind` | `created_at`, `source_text`, `target_text`, `kind` | textes source et cible (`q` reste accepté pour compatibilité) |
| `/api/users` | `is_active` | `created_at`, `full_name`, `email` | nom et email |
| `/api/sessions` | `revoked` | `created_at`, `expires_at`, `last_used_at` | agent utilisateur |
| `/api/roles`, `/api/permissions` | aucun | `code`, `name` | code et nom |
| `/api/usage/events` | `user_id`, `event_type` | `created_at`, `event_type`, `status_code`, `duration_ms` | route, méthode et type d'événement |
| `/api/conversations` | aucun | `created_at`, `title` | titre |
| `/api/conversations/{id}/messages` | aucun | `created_at`, `role` | contenu du message |
| `/api/learning/scenarios` | `level` | `created_at`, `title`, `level` | titre et description |
| `/api/learning/attempts` | `scenario_id`, `status` | `started_at`, `completed_at`, `status`, `score` | titre du scénario |

Un `sort_by` non autorisé, un filtre inconnu ou une valeur hors format est
rejeté avec `422`; aucune valeur fournie pour le tri n'est injectée dans une
requête SQL. Les totaux de pagination sont calculés après application de tous
les filtres et de la recherche. Pour une conversation, ces mêmes paramètres
s'appliquent aux messages imbriqués de la route détail et à la route dédiée
`/messages`.
Les réponses non JSON, WebSocket, santé et `204` ne sont pas enveloppées; la
réponse JSON de l'endpoint audio reste, elle, enveloppée. Ce changement concerne
le contrat client de la Gateway. Les services internes renvoient les éléments
et les métadonnées nécessaires; la Gateway les expose dans le format uniforme
documenté ci-dessus.

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

Hors Compose, utilisez `backend/.env` comme source commune de
`JWT_SECRET_KEY`, `JWT_ALGORITHM` et `JWT_AUDIENCE` pour Identity et la Gateway.
Identity peut aussi lire `identity/.env`, mais les valeurs communes de
`backend/.env` y sont prioritaires; les variables exportées dans chaque
processus restent prioritaires sur les fichiers. Évitez de définir une ancienne
valeur `JWT_KEY` différente. En Compose, `backend/.env` est également la source
commune transmise aux deux services.

Si la Gateway est lancée directement sur l'hôte, son service Conversation doit
être joignable sur `http://127.0.0.1:8002` (défaut de la Gateway) ou être
configuré avec `CONVERSATION_URL`. Dans Compose, cette variable est définie
automatiquement sur `http://conversation:8002`, nom DNS valable uniquement dans
le réseau Compose.

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

Copiez `item.access_token` de la réponse de connexion, puis testez une route
protégée :

```bash
curl -i http://localhost:8000/api/conversations/ \
  -H 'Authorization: Bearer <access_token>'
```

Chaque échange doit cibler une conversation créée au préalable. Conservez son
`item.id` comme conversation active et réutilisez-le pour le texte ou le vocal :

```bash
curl -i http://localhost:8000/api/conversations/ \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Ma conversation"}'

curl -i http://localhost:8000/api/conversations/<conversation_id>/messages \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"content":"Bonjour"}'

curl -i http://localhost:8000/api/conversations/<conversation_id>/messages \
  -H 'Authorization: Bearer <access_token>'
```

Le `GET` liste, dans l'ordre chronologique, les messages de l'utilisateur et
les réponses de l'IA. Il renvoie `404` si la conversation n'existe pas ou
n'appartient pas à l'utilisateur.

L'utilisateur peut faire une requête soit en écrivant, soit en parlant. Le
parcours vocal est prioritaire : le client transmet l'audio de l'utilisateur,
Conversation le transcrit et le traite comme une requête, puis renvoie la
réponse sous forme de texte et d'audio synthétisé. Le texte du transcript et
celui de la réponse sont aussi disponibles pour affichage ou sous-titrage.
Pour parler, connectez le WebSocket Gateway avec ce même identifiant :
`ws://localhost:8000/ws/conversation?token=<access_token>&conversation_id=<conversation_id>`.
Une connexion sans conversation ou vers une conversation qui n'appartient pas
à l'utilisateur est refusée. Envoyez les trames audio de la parole puis
`{"type":"end_of_speech"}` pour lancer la requête. Le transcript et la réponse
IA sont enregistrés comme messages de cette conversation; les événements
WebSocket incluent `conversation_id`.

Pour tester un fichier vocal depuis Postman, utilisez plutôt
`POST /api/conversations/<conversation_id>/messages/audio` et choisissez un
fichier dans le champ `audio` de type fichier (`multipart/form-data`) :

```bash
curl -i http://localhost:8000/api/conversations/<conversation_id>/messages/audio \
  -H 'Authorization: Bearer <access_token>' \
  -F 'audio=@./question.wav'
```

La réponse JSON contient ces champs dans `item` : transcription, texte de réponse
et `audio_output_base64`, à décoder côté client. Ne définissez pas manuellement
`Content-Type`, car la boundary multipart doit être ajoutée par le client.
Cette route partage la limite de 50 tours vocaux quotidiens du WebSocket.
Les implémentations STT/TTS actuelles sont des mocks; pour obtenir une sortie
réellement lisible, branchez un moteur TTS et précisez son format audio.

Les comptes gratuits reçoivent 1 000 jetons, rechargés à minuit UTC
(minuit à Abidjan), sans report du solde gratuit inutilisé. Chaque échange
Conversation débite les jetons d'entrée et de réponse du modèle; le solde
gratuit est consommé avant le solde acheté. Tant que `MockDialogue` est utilisé,
le débit est une estimation lexicale temporaire. Un adaptateur de modèle réel
doit fournir ses compteurs d'entrée et de sortie. Les échanges texte exposent
le débit de crédits dans `X-Credit-Tokens-Charged`. `Authorization: Bearer`
contient uniquement le JWT d'authentification; le corps interne de débit
transporte séparément `credit_tokens`. Le comptage du modèle est signalé par
`X-Model-Token-Usage-Estimated` lorsqu'il s'agit encore de l'estimation du mock.

En mode gratuit, les comptes sans rôle `PRO` sont limités à 500 requêtes de
message texte et 50 tours vocaux par jour UTC, tous deux remis à zéro à minuit
UTC. Les requêtes qui dépassent ces limites reçoivent `429` (avec `Retry-After`
pour le texte); les tours WebSocket reçoivent un événement `error` de statut
`429`. Ces plafonds ne s'appliquent pas aux comptes `PRO` ni aux administrateurs.

La Gateway retourne `401` pour un jeton absent/invalide, `403` pour un rôle
non autorisé, `429` lorsque la limite est dépassée, `502` si l'upstream est
indisponible et `504` sur expiration du délai. Les erreurs API JSON suivent
l'enveloppe documentée ci-dessus. Un `X-Request-ID` est retourné
pour chaque réponse et peut être transmis à l'avance par un client si sa valeur
est sûre et fait au plus 64 caractères.

Le worker des événements d'usage retente chaque événement au plus cinq fois.
Les événements toujours invalides ou impossibles à persister sont déplacés
vers le stream Redis `app:usage:events:dead-letter` plutôt que de bloquer
indéfiniment le traitement; les erreurs Redis utilisent un backoff interruptible
plafonné à 30 secondes.

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
