+++
title = "Senior Java / IA : correctifs répétés et cohérence des artefacts dans CorePilot"
date = 2026-11-18
draft = false
summary = "Comprendre l'application répétée d'un correctif, la dérive de référence et la différence entre le code source et les fichiers servis."
tags = ["CorePilot", "Git", "Release Engineering", "AI Architecture"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Dans CorePilot Prompt Studio, les changements de chevrons étaient déjà présents dans les fichiers TSX et CSS. L'ancien correctif entrait en conflit lors d'une seconde application. Un nouveau diff calculé à partir du code actuel était vide. Les vérifications TypeScript, quatre tests ciblés et la compilation Next.js ont réussi dans un environnement isolé. Cependant, le répertoire statique de production `web/out` ne contenait pas encore le style attendu.

## Concepts essentiels
**Idempotence** : répéter une opération ne devrait pas modifier davantage l'état final. `git apply` n'est pas intrinsèquement idempotent : une seconde application échoue généralement. **Dérive de référence** : un échec peut signaler un correctif déjà appliqué ou des modifications concurrentes. **Vérification inverse** : `git apply --reverse --check` aide à détecter un correctif déjà présent, sans remplacer l'inspection du code. **Cohérence des artefacts** : la présence d'une règle CSS dans le dépôt ne prouve pas qu'elle existe dans les fichiers actuellement servis.

## Exemple Bash : diagnostic sans écriture
~~~bash
# Run only inside an isolated Git checkout, never on production.
git status --short
if git apply --check change.patch; then
  echo "PATCH_APPLICABLE"
elif git apply --reverse --check change.patch; then
  echo "PATCH_ALREADY_PRESENT"
else
  echo "PATCH_CONFLICT_OR_DIFFERENT_BASE"
  exit 1
fi
~~~
Exécuter uniquement dans une copie Git isolée. Une vérification réussie avec `--allow-empty` ne constitue pas une preuve de déploiement. Ne pas remplacer `web/out` en production.

## Pièges fréquents
- Forcer l'application après un conflit sans examiner l'état courant.
- Confondre compilation réussie et version effectivement servie.
- Interpréter un diff vide comme une validation de production.
- Oublier les changements non liés dans l'arbre de travail.
- Ignorer les caches du navigateur ou du serveur.

## Question d'entrevue Senior
Le correctif échoue en mode direct, réussit en mode inverse et le CSS est dans les sources, mais Safari affiche toujours l'ancien style. Quel ordre de diagnostic choisiriez-vous et quelles preuves exigerez-vous avant un GO?

## Exercice pratique de 15 minutes
Créer un dépôt Git temporaire, produire un correctif, le vérifier puis l'appliquer une seule fois. Confirmer que la vérification inverse réussit et que la deuxième application directe échoue. Noter les contrôles supplémentaires nécessaires pour les artefacts statiques.

## Conclusion et limites
L'exemple a été vérifié dans un dépôt temporaire : application directe, vérification inverse et rejet de la répétition. Aucun fichier ou service CorePilot réel n'a été modifié. Ce script est pédagogique et ne déploie rien.
