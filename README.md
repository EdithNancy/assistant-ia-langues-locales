# Assistant IA Vocal et Texte en Langues Locales (Dioula & Baoulé)

Projet d'assistant virtuel interactif capable de comprendre, parler et répondre en langues locales ivoiriennes (Dioula et Baoulé).

---

## 📌 Structure des Phases du Projet

- **Phase 1 — Collecte et préparation** : Constitution des corpus audio/texte, annotation et nettoyage.
- **Phase 2 — Développement et intégration** : Modèles ASR, NLLB (Traduction), TTS et interface application.
- **Phase 3 — Optimisation et déploiement** : Évaluation, optimisation des modèles et API REST.
- **Phase 4 — Livrables et lancement** : Démo, documentation et mise en production.

---

## 🌿 Organisation des Branches Git

Le projet suit le modèle **Git Flow** adapté aux phases du projet :

- `main` : Code stable et validé pour la production.
- `develop` : Branche d'intégration des fonctionnalités.
- `p1/...` : Branches dédiées aux tâches de la Phase 1.
- `p2/...` : Branches dédiées aux tâches de la Phase 2.
- `p3/...` : Branches dédiées aux tâches de la Phase 3.
- `p4/...` : Branches dédiées aux tâches de la Phase 4.

### Attributions actuelles des branches :

| Ressource | Rôle / Pôle | Branche active |
| :--- | :--- | :--- |
| **Ressource 1** | Data (Corpus Dioula) | `p1/data-dioula-corpus` |
| **Ressource 2** | Data (Corpus Baoulé) | `p1/data-baoule-corpus` |
| **Ressource 3** | Data (Annotation & Nettoyage) | `p1/data-annotation-cleaning` |
| **Ressource 4** | Frontend (UI Components) | `p2/frontend-ui-components` |
| **Ressource 5** | Frontend (Flux Vocal) | `p2/frontend-vocal-stream` |

---

## 🚀 Guide de Démarrage Rapide

### 1. Cloner le projet
```bash
git clone https://github.com/EdithNancy/assistant-ia-langues-locales.git
cd assistant-ia-langues-locales
```

### 2. Lancer le frontend en local

**Prérequis :** Node.js 20+

```bash
npm install
cp .env.example .env.local   # puis renseigner VITE_API_URL
npm run dev                  # http://localhost:3000
```

### Connexion au Gateway API

Le front utilise les routes d'authentification du Gateway décrites dans la collection Postman :

- `POST /api/auth/register` avec `full_name`, `email`, `phone_number` et `password`
- `POST /api/auth/login` avec `email` et `password`
- `GET /api/users/me` avec `Authorization: Bearer <access_token>`
- `POST /api/auth/refresh` avec `refresh_token`
- `POST /api/auth/logout` avec le Bearer token à la déconnexion

Pour créer un compte depuis l'interface, renseignez l'e-mail et le numéro ivoirien. La connexion utilise l'adresse e-mail, conformément au contrat actuel du Gateway. Les jetons sont gardés dans `sessionStorage` et effacés à la déconnexion ; ils ne doivent jamais être placés dans une variable `VITE_*`. `sessionStorage` n'est pas protégé contre une faille XSS : pour une mise en production, privilégiez une session par cookie `HttpOnly`, `Secure` et `SameSite`, si le backend la prend en charge.

Le client renouvelle automatiquement l'access token lorsqu'il approche de son expiration (`expires_in`) ou lorsqu'une route protégée renvoie `401`, puis retente cette requête une seule fois. Si le refresh token est refusé, la session locale est effacée et l'utilisateur est renvoyé à la connexion. Au rechargement de la page, le front vérifie le profil côté Gateway avant de restaurer l'état connecté.

Les autres fonctions de l'application (chat, traduction, audio) utilisent encore les anciennes routes du client front (`/chat`, `/translate`, etc.). Elles devront être raccordées séparément aux routes de conversations du Gateway avant que ces fonctions puissent être considérées comme intégrées.

### 3. Lancer avec Docker

```bash
# Développement (rechargement à chaud)
docker compose up frontend-dev        # http://localhost:3000

# Production (build statique servi par NGINX)
docker build -t ivoirai-frontend --build-arg VITE_API_URL=https://api.exemple.ci .
docker run -p 8080:80 ivoirai-frontend   # http://localhost:8080
```

### 4. Vérifications

```bash
npm run lint    # types TypeScript (strict) + oxlint (hooks React, accessibilité)
npm test        # tests Vitest + Testing Library
npm run build   # build de production dans dist/
```

### 5. Ajouter une icône

L'app ne charge que les icônes Material Symbols qu'elle utilise (~20 Ko au lieu de ~1 Mo).
Pour une nouvelle icône, ajoutez son nom dans `icon_names` (ordre alphabétique) dans `index.html` ;
`npm test` signale toute icône utilisée mais non chargée.

### 6. Système de design

- **Couleurs** : uniquement les tokens de `src/index.css` (`bg-primary-container`, `text-on-surface-variant`…), jamais `bg-[#004b49]`.
- **Ombres** : `shadow-soft` (cartes), `shadow-raised` (actions, bandeaux), `shadow-overlay` (fenêtres), `shadow-glow` (éléments vocaux).
- **Arrondis** : `rounded-full` (pilules), `rounded-3xl` (cartes), `rounded-2xl` (blocs internes), `rounded-xl` (petits éléments).
- **Composants** (`src/components/ui`) : `Modal`, `Card`, `Button`, `IconButton`, `Chip`.
