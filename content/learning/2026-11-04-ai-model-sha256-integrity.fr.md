+++
title = "Ingénierie IA senior : vérifier l’intégrité d’un modèle ComfyUI avec SHA-256"
date = 2026-11-04
draft = false
summary = "La vérification d’intégrité constitue une étape de la chaîne d’approvisionnement IA; le chargement réussi du modèle ne suffit pas."
tags = ["AI", "ComfyUI", "SHA-256", "Model Integrity", "Security"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Aujourd’hui, une commande `shasum -a 256` a été exécutée sur un poids Qwen Image Edit FP8 stocké sur un disque CORSAIR externe du Mac Studio. Le résultat visible est tronqué : aucune correspondance avec une empreinte de référence n’est établie.

## Concepts clés
SHA-256 produit une empreinte de 256 bits, représentée par 64 caractères hexadécimaux. Elle permet de détecter une corruption ou une modification du fichier. Toutefois, **recalculer deux fois la même empreinte locale ne prouve pas la provenance du modèle**. Il faut comparer l’empreinte complète à une valeur attendue obtenue auprès d’une source de publication fiable, avec la version exacte.

## Exemple de commande
~~~bash
shasum -a 256 "/Volumes/CORSAIR/01_AI-Models/ComfyUI/diffusion_models/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors"
# Compare the FULL 64-character digest with the trusted publisher's digest.
# A match checks byte integrity, NOT model safety or authenticity by itself.
~~~

## Pièges courants
Ne pas confondre empreinte identique et innocuité; ne pas utiliser une valeur provenant d’une source non fiable; éviter de calculer pendant un téléchargement; mettre les chemins contenant des espaces entre guillemets.

## Question d’entrevue senior
Vous gérez un cache de modèles ComfyUI provenant de plusieurs miroirs. Comment concevoir le téléchargement, la provenance de l’empreinte, l’écriture atomique, le verrouillage de version et la vérification avant chargement? Que faire sans empreinte fiable?

## Exercice de 15 minutes
Relancer la commande, conserver les 64 caractères de l’empreinte et vérifier la version exacte auprès de l’éditeur. Sans référence fiable, inscrire « non vérifié » plutôt que « validé ».

## Conclusion
La vérification d’intégrité constitue une étape de la chaîne d’approvisionnement IA; le chargement réussi du modèle ne suffit pas.
