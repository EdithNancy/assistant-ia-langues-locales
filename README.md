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
git clone [https://github.com/votre-compte/assistant-ia-langues-locales.git](https://github.com/votre-compte/assistant-ia-langues-locales.git)
cd assistant-ia-langues-locales
