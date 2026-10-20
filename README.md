# Projet IA langues locales

Le notebook `COLLECTE DONNEES BAOULE.ipynb` fonctionne en local. Suivre `INSTALLATION_PC.md` pour installer les dépendances sur un PC gamer et sélectionner le noyau Jupyter.

Le corpus français–baoulé est adapté dans les deux sens avec NLLB et LoRA. Le token akan sert de repère technique pour le baoulé ; une validation linguistique reste nécessaire. Les sources et licences du corpus doivent être contrôlées.

Les CSV d’origine sont conservés. La préparation génère les jeux `datasets/baoule_v2_train.csv`, `baoule_v2_validation.csv` et `baoule_v2_test.csv` (1 612, 201 et 201 paires). Les résultats seront enregistrés dans `models/nllb-baoule-lora`.

Le notebook original reste disponible dans `COLLECTE DONNEES BAOULE.original.ipynb`. Le dioula, l’API, le chatbot et la voix restent des étapes distinctes.
