+++
title = "Senior Java / IA : bascule de répertoire et retour arrière dans CorePilot"
date = 2026-11-12
draft = false
summary = "Comprendre les limites d'une bascule de fichiers et les preuves nécessaires avant de déclarer une version publiée."
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Le 12 novembre, CorePilot A+9.2 a affiché `RESULT: A+9.2 SWITCH PASS` après avoir remplacé `web/out` et conservé une copie de retour arrière. Pourtant, la nouvelle option attendue n'était toujours pas visible dans l'interface. La réussite du déplacement des fichiers ne prouve donc pas que le navigateur reçoit la nouvelle version.

## Concepts essentiels
**Vérifications préalables** : contrôler les fichiers candidats, les processus, les ports et le chemin de sauvegarde. Ces vérifications ne restent pas nécessairement vraies ensuite.
**Bascule** : un renommage unique sur le même système de fichiers est généralement atomique; deux déplacements successifs ne forment **pas** une transaction atomique.
**Retour arrière** : conserver l'ancienne version et tenter de la restaurer en cas d'échec. Cette restauration peut aussi échouer.
**Validation après bascule** : vérifier les fichiers, les réponses HTTP, les ressources JS/CSS, les routes et le comportement du navigateur, y compris les caches.

## Exemple Bash pédagogique
Cet exemple fonctionne uniquement dans un répertoire de test isolé. Il ne contrôle ni les services actifs, ni les déploiements concurrents, ni le HTTP. Il ne doit pas être exécuté tel quel en production. Sa syntaxe et son chemin nominal ont été testés.
~~~bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?root}"; CANDIDATE="${2:?candidate}"
LIVE="$ROOT/out"; BACKUP="$ROOT/.out-backup"
[[ -f "$CANDIDATE/create/index.html" ]] || exit 2
[[ -d "$LIVE" ]] || exit 2
[[ ! -e "$BACKUP" ]] || exit 2
mv "$LIVE" "$BACKUP"
if ! mv "$CANDIDATE" "$LIVE"; then
  mv "$BACKUP" "$LIVE" || { echo 'MANUAL RECOVERY REQUIRED' >&2; exit 3; }
  exit 1
fi
printf 'SWITCHED; backup=%s\n' "$BACKUP"
~~~

## Pièges fréquents
- Confondre deux commandes `mv` avec une opération atomique globale.
- Vérifier uniquement `index.html` sans les ressources statiques.
- Déduire de SWITCH PASS que la fonctionnalité est visible.
- Oublier les processus actifs, les déploiements concurrents et les collisions de sauvegarde.
- Négliger les caches du navigateur et les Service Workers.
- Supposer qu'un retour arrière réussira toujours.

## Question d'entrevue Senior
Après une bascule A+9.2 réussie en ligne de commande, l'option de durée vidéo reste invisible sur iPhone. Comment distinguer un mauvais artefact, un serveur pointant vers l'ancien répertoire et un cache client ? Quelles preuves exiger avant de déclarer la livraison réussie ?

## Exercice pratique de 15 minutes
En lecture seule, relever les chemins du candidat, de `web/out` et de la sauvegarde; inspecter le port et la route réellement servis; comparer les empreintes des fichiers locaux et HTTP; vérifier la présence de la fonctionnalité dans les ressources JS. Ne pas redémarrer ni redéployer.

## Résumé
Une livraison fiable suit des étapes distinctes : prévalidation, bascule, contrôle après bascule et possibilité de retour arrière. SWITCH PASS ne constitue pas une preuve de publication.