+++
title = "Senior Java / IA : intégrité et provenance d'un paquet hors ligne CorePilot"
date = 2026-11-17
draft = false
summary = "Distinguer la vérification SHA-256 de l'authenticité et des critères d'autorisation d'un déploiement."
tags = ["CorePilot", "Security", "Release Engineering", "AI Architecture"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Dans la répétition hors ligne B23 de CorePilot, il faut examiner l'archive ZIP, `DEPLOYMENT_MAP.json` et `ROLLBACK_INDEX.json`. La présence de ces fichiers n'autorise pas une installation.

## Concepts essentiels
**Intégrité** : SHA-256 permet de détecter une modification des octets. **Authenticité** : la liste de sommes doit provenir d'une source indépendante et fiable ou être authentifiée par une signature vérifiée. Un attaquant pourrait modifier à la fois le fichier et sa somme. **Provenance** : conserver la version, la révision source et les approbations. **Critère de mise en production** : des sommes valides ne remplacent ni la validation des droits, ni les tests de restauration, ni les contrôles de sécurité.

## Exemple Bash vérifiable
Cet exemple vérifie uniquement les fichiers à partir d'un manifeste SHA256SUMS déjà obtenu d'une source fiable. Il ne valide aucune signature et n'installe rien.

~~~bash
#!/usr/bin/env bash
set -euo pipefail
root="${1:?usage: verify_artifacts.sh DIRECTORY}"
manifest="$root/SHA256SUMS"
[[ -f "$manifest" ]] || { echo 'BLOCKED: manifest missing'; exit 1; }
(cd "$root" && shasum -a 256 -c SHA256SUMS)
~~~

## Pièges fréquents
Ne pas assimiler une extraction ZIP réussie à une preuve de sécurité; ne pas faire confiance automatiquement au manifeste inclus; ne pas confondre un index de restauration avec une restauration testée; ne pas extraire dans un répertoire de production sans contrôle; ne pas déclarer GO uniquement à partir des empreintes.

## Question d'entrevue senior (à répondre d'abord)
Si `DEPLOYMENT_MAP.json` et `SHA256SUMS` sont tous deux remplacés dans l'archive, mais que `shasum -c` réussit, autoriseriez-vous la première installation du Guard? Quelles preuves indépendantes exigeriez-vous?

## Exercice de 15 minutes
Dans un dossier temporaire, créer `a.txt`, générer SHA256SUMS, vérifier, modifier le fichier et constater l'échec. Expliquer ensuite pourquoi une liste de sommes recalculée peut tromper cette vérification.

## Bilan et limites de validation
La syntaxe Bash, le cas nominal et la détection d'une modification ont été testés isolément. Aucun paquet CorePilot réel n'a été authentifié; aucun service n'a été installé, redémarré ou basculé.

