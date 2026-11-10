+++
title = "Senior AI : diagnostiquer la fidélité d'identité d'un LoRA FLUX.2 Klein"
date = 2026-11-09
draft = false
summary = "Méthode reproductible pour distinguer les problèmes de données, d'entraînement, de chargement et d'inférence."
tags = ["AI", "ComfyUI", "LoRA", "FLUX"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Le 9 novembre, un essai de LoRA de personnage sur Mac Studio a produit une deuxième image dont le visage ne ressemblait pas au sujet d'entraînement. Des paires JPG/TXT et une archive checkpoint ZIP ont été repérées. **Leur présence ne prouve ni que l'entraînement est terminé ni que le LoRA est effectivement chargé.** Les noms précis des nœuds ComfyUI et leur compatibilité doivent être vérifiés dans l'installation utilisée.

## Concepts essentiels
Analyser quatre couches : **données** (identité cohérente, diversité des poses, légendes exactes), **entraînement** (modèle de base, format LoRA, étapes et points de contrôle), **chargement** (compatibilité de l'architecture, poids réellement chargés, intensité), **inférence** (seed, dimensions, prompt, échantillonnage). Une archive de reprise d'entraînement n'est pas nécessairement un fichier de poids utilisable pour l'inférence.

Faire un test contrôlé : même modèle de base, même prompt, même seed, mêmes dimensions, puis comparer LoRA désactivé et activé. Ne modifier qu'un paramètre à la fois. Conserver le workflow JSON, les versions, les empreintes et les sorties.

## Exemple Python : contrôle du jeu de données
Ce script vérifie seulement les paires image/légende et l'intégrité de décodage, pas la ressemblance :
~~~python
from pathlib import Path
from PIL import Image
root = Path("04_training/images")
pairs = sorted(root.glob("*.jpg"))
assert pairs, "No training JPGs"
for img in pairs:
    caption = img.with_suffix(".txt")
    assert caption.is_file(), f"Missing caption: {img.name}"
    with Image.open(img) as im:
        im.verify()  # integrity only; does not assess identity quality
print(f"Verified {len(pairs)} image/caption pairs")
~~~

Une inspection humaine des légendes, des doublons et de l'identité reste nécessaire. Comparer les empreintes SHA-256 avec une source fiable.

## Pièges fréquents
- Confondre une archive ZIP de checkpoint avec un fichier de poids LoRA pour l'inférence.
- Changer le seed ou le modèle de base entre les essais.
- Employer un mot déclencheur différent de celui appris, ou des légendes contradictoires.
- Augmenter l'intensité sans vérifier la compatibilité du modèle et le surapprentissage.
- Généraliser à partir d'une seule image réussie.

## Question d'entrevue Senior
La deuxième image ne ressemble pas au sujet. Quels tests minimaux permettent de distinguer un LoRA non chargé, un modèle incompatible, des données insuffisantes et des paramètres d'inférence inadéquats ? Répondre avant de consulter une solution.

## Exercice de 15 minutes
Fixer le seed, le prompt, les dimensions et le modèle de base. Produire une paire OFF/ON, noter le chemin réel des poids et inspecter les fichiers disponibles sans effacer les checkpoints. Comparer séparément visage, coiffure, vêtements et proportions.

## Conclusion
La fidélité d'identité se diagnostique par des expériences reproductibles et des preuves de chargement, et non en multipliant les prompts au hasard.
