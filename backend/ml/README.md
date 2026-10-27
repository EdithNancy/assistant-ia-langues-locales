# Modèles de langues et de parole

Ce dossier contient les données et outils d'entraînement. Les API métier ne
doivent pas charger les poids GPU dans leur processus : Conversation appelle un
service d'inférence séparé afin que STT, normalisation, traduction et dialogue
puissent être déployés et mis à l'échelle indépendamment.

## Arborescence

```text
ml/
├── data/
│   ├── manifests/       # CSV/JSONL versionnés décrivant les exemples
│   ├── raw/             # audio et corpus source, ignorés par Git
│   └── processed/       # jeux préparés, ignorés par Git
├── experiments/         # configurations et notes d'expériences
├── models/              # checkpoints locaux, ignorés par Git
├── prototypes/          # démonstrations historiques, pas les services de prod
├── src/
│   ├── asr/             # reconnaissance vocale
│   ├── orthography/     # normalisation de graphies
│   └── translation/
│       └── nllb/        # entraînement et inférence NLLB-200
└── artifacts/           # métriques et sorties générées, ignorées par Git
```

## Données

- `data/manifests/`: manifestes versionnés, jamais les enregistrements privés.
- `data/raw/`, `data/processed/` et `models/`: fichiers locaux ignorés par Git.
- Les transcriptions de référence doivent suivre une convention orthographique
  explicitement validée par des locuteurs.
- Chaque jeu d'entraînement doit séparer les locuteurs entre entraînement,
  validation et test pour éviter les fuites d'identité vocale.

## Couches

- `src/asr/`: préparation, entraînement et évaluation de la reconnaissance.
- `src/orthography/`: règles explicites et évaluation de la normalisation.
- `src/translation/nllb/`: fine-tuning et inférence NLLB.

## Fine-tuning NLLB

Préparez deux TSV UTF-8 avec les colonnes `source` et `target` (une phrase par
ligne), en séparant les locuteurs ou sources entre entraînement, validation et
test. Puis lancez depuis la racine du dépôt :

```bash
python backend/ml/src/translation/nllb/train.py \
  --train backend/ml/data/processed/train.tsv \
  --validation backend/ml/data/processed/validation.tsv \
  --source-lang CODE_NLLB_SOURCE --target-lang CODE_NLLB_CIBLE \
  --output backend/ml/models/mon-experience
```

Les dépendances d'entraînement sont facultatives et s'installent dans un
environnement ML dédié : `torch`, `transformers`, `datasets`, `sentencepiece` et
`accelerate`. Vérifiez que les codes de langue sont supportés par le tokenizer
et que les graphies du corpus sont validées avant tout entraînement.

L'inférence en ligne n'est pas encore branchée à Conversation. À terme, ces
scripts doivent être servis par un processus ML séparé, avec une API stable,
plutôt que de charger un checkpoint NLLB dans le serveur Conversation.

Le service Conversation expose la langue au STT, au normaliseur et au TTS. Tant
qu'un modèle ou un corpus validé n'est pas configuré, ces interfaces restent
neutres; elles ne doivent pas inventer de graphies locales.
