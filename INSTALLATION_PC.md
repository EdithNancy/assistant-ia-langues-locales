# Installation sur HP Omen avec RTX 5070 8 Go

Copier le projet sur le PC. Installer Python 3.11 (64 bits), VS Code et ses extensions Python et Jupyter. Ne pas copier `.venv` depuis le Mac : il doit être recréé sur le PC.

## Windows avec RTX 5070

Ouvrir un terminal PowerShell dans le dossier extrait :

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
```

Pour la RTX 5070, utiliser PyTorch 2.7.1 avec CUDA 12.8 et un pilote NVIDIA récent. La Radeon intégrée n’est pas utilisée par ce parcours. Les 32 Go de RAM système ne remplacent pas les 8 Go de mémoire vidéo.

```powershell
.\.venv\Scripts\python.exe -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cu128
.\.venv\Scripts\python.exe -m pip install -r requirements-pc-rtx5070.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -c "import torch; print('PyTorch:', torch.__version__); print('CUDA:', torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'GPU non detecte')"
```

Cette commande CUDA est issue de https://pytorch.org/get-started/previous-versions/ (version 2.7.1). Le pilote NVIDIA doit être compatible. Le toolkit CUDA complet n’est normalement pas nécessaire pour ces paquets précompilés.

Après l’installation, lancer aussi un calcul CUDA réel :

```powershell
.\.venv\Scripts\python.exe verifier_gpu.py
```

Ce test vérifie le GPU sélectionné, réalise un calcul matriciel et un calcul de gradients. Si CUDA reste indisponible, vérifier le pilote et le noyau Python avant de lancer le notebook.

## Linux avec NVIDIA

Avec Python 3.11 installé :

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cu128
.venv/bin/python -m pip install -r requirements-pc-rtx5070.txt
.venv/bin/python -m pip check
```

Vérifier ensuite le GPU avec `.venv/bin/python verifier_gpu.py`.

## Lancer le notebook

1. Ouvrir le dossier extrait dans VS Code.
2. Ouvrir `COLLECTE DONNEES BAOULE.ipynb`.
3. Sélectionner le noyau Python de `.venv` (sur Windows : `.venv\Scripts\python.exe`).
4. Passer la cellule d’installation si les commandes précédentes sont terminées.
5. Exécuter les cellules à partir de la configuration, dans l’ordre.

Le premier chargement nécessite Internet pour télécharger le tokenizer puis le modèle NLLB. Les modèles sont mis en cache dans `.cache/huggingface` dans le projet. Aucun compte Hugging Face n’est requis pour ces fichiers publics.

La configuration utilise LoRA, un batch de 1 et le checkpointing pour réduire la mémoire. La mémoire nécessaire dépend du GPU et des séquences ; 8 Go ne garantissent pas que tout l’entraînement tiendra. Fermer les autres logiciels utilisant le GPU. Si une erreur mémoire survient, redémarrer le noyau ; réduire `MAX_LENGTH` à 96 ou 64 est possible, mais augmente la troncature et impose de refaire la tokenisation.

## Reprise et résultats

Après une interruption, redémarrer le noyau, refaire configuration, préparation et tokenisation, puis renseigner `RESUME_FROM_CHECKPOINT` avec un dossier `models/nllb-baoule-lora/checkpoint-*` existant dans la cellule d’entraînement.

Après réussite, les adaptateurs, les prédictions et les scores sont stockés dans `models/nllb-baoule-lora`. Les checkpoints sont enregistrés à chaque époque : une interruption avant la première sauvegarde ne permet pas la reprise depuis cette étape.

Le modèle complet n’a pas été entraîné sur le PC cible. Les tests locaux précédents ont validé la préparation, la tokenisation et un cycle LoRA sur un modèle miniature ; ils ne mesurent pas la qualité du futur modèle baoulé.
