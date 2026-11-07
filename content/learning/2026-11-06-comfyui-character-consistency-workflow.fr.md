+++
title = "Senior IA : cohérence d’un personnage dans ComfyUI"
date = 2026-11-06
draft = false
summary = "Reproductibilité des vues d’un personnage, LoRA et contrôles qualité."
tags = ["AI", "ComfyUI", "LoRA", "Reproducibility"]
categories = ["Learning"]
showComments = true
+++

## Contexte
Les essais récents de Xiaodaigua portent sur les vues de face/profil, les cinq doigts, une LoRA multi-angle Qwen Image Edit et une référence verticale pour la vidéo. Malgré les itérations, le nombre de doigts et les proportions peuvent varier.

## Concepts clés
Un **contrat de personnage** précise les contraintes vérifiables : trois mèches, couleur du pelage, distance entre les yeux, proportions et cinq doigts par patte avant. On sépare les exigences strictes des préférences esthétiques.

Un **manifeste de rendu** consigne le JSON du workflow, les versions des nœuds, les empreintes SHA-256 du modèle, de la LoRA et de l’image de référence, la graine, les paramètres d’échantillonnage et la résolution. Une graine fixe ne garantit pas un résultat identique entre versions ou matériels.

Une **barrière de qualité** vérifie d’abord les dimensions et les fichiers, puis demande une inspection humaine pour l’anatomie et la cohérence visuelle. Une sortie rejetée ne doit pas alimenter la génération vidéo.

## Exemple Python
~~~python
from dataclasses import dataclass

@dataclass(frozen=True)
class RenderSpec:
    width: int
    height: int
    seed: int
    model_sha256: str
    reference_sha256: str

def validate(spec: RenderSpec) -> None:
    if spec.width <= 0 or spec.height <= 0:
        raise ValueError("Invalid dimensions")
    if len(spec.model_sha256) != 64 or len(spec.reference_sha256) != 64:
        raise ValueError("Expected SHA-256 digests")
    if any(c not in "0123456789abcdef" for c in
           spec.model_sha256.lower() + spec.reference_sha256.lower()):
        raise ValueError("Invalid digest encoding")
~~~

This is a self-contained illustrative validation fragment, not an image-generation implementation. Digest formatting does not prove provenance, and fixed seeds do not guarantee identical results across versions or hardware.

## Pièges fréquents
- Étendre l’image en l’étirant plutôt qu’en prolongeant le décor.
- Sauvegarder uniquement le prompt, sans versions de modèles et de nœuds.
- Confondre empreinte SHA-256 bien formée et provenance fiable.
- Supposer qu’une LoRA multi-angle garantit cinq doigts.
- Automatiser la vidéo avant la validation du personnage.

## Question d’entrevue senior
Comment concevoir un pipeline ComfyUI traçable pour trois angles d’un même personnage? Quelles validations peuvent être automatiques et lesquelles exigent une révision humaine?

## Exercice de 15 minutes
Créer un manifeste pour une image de profil existante, noter les empreintes et les dimensions, puis vérifier manuellement les cinq doigts, les trois mèches et les proportions. Inscrire PASS ou FAIL sans modifier la production.

## Résumé
Le prompt décrit l’objectif; le manifeste assure la traçabilité; les validations déterministes et humaines protègent la qualité.
