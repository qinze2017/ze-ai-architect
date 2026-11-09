+++
title = "Senior Java / IA : diagnostic des transactions Seata avec MCP et contrôle des accès"
date = 2026-11-08
draft = false
summary = "Comprendre les outils MCP en lecture seule, la traçabilité des preuves et les fencing tokens."
tags = ["Java", "AI", "Seata", "MCP"]
categories = ["Learning"]
showComments = true
+++

## Contexte
Le 8 novembre, nous avons étudié une présentation du diagnostic des transactions Seata à l'aide d'un serveur MCP intégré à la console. Avant toute intégration, il faut vérifier les outils réellement disponibles et les autorisations dans la documentation officielle de la version déployée.

## Concepts essentiels
Pour analyser une transaction distribuée, on corrèle le XID, les branches, les verrous, les journaux et les horodatages. MCP relie le modèle aux outils, mais ne remplace pas l'autorisation côté serveur. Une recommandation de l'IA ne doit jamais déclencher automatiquement une opération destructive.

~~~text
User question -> LLM -> read-only MCP adapter -> authorized Seata console API
              -> structured evidence (XID, branch, lock, time) -> explanation
              -> human-approved remediation
~~~
Mesures indispensables : privilèges minimaux, lecture seule par défaut, authentification, validation des paramètres, journal d'audit, masquage des données sensibles, délais d'expiration et limitation du débit. Les journaux renvoyés par un outil restent des données non fiables.

## Exemple Java / Spring Boot
Extrait pédagogique autonome : un Worker d'IA ne peut enregistrer un état final que si sa version est toujours valide.
~~~java
// Spring Data JPA: execute within a service @Transactional boundary.
@Modifying
@Query("UPDATE Job j SET j.status = 'DONE' WHERE j.id = :id AND j.status = 'PROCESSING' AND j.leaseVersion = :version")
int finishIfCurrent(@Param("id") Long id, @Param("version") long version);
~~~
Un résultat de 0 ligne modifiée peut indiquer une version périmée, un autre état ou une tâche inexistante. La validation et l'enregistrement du diagnostic doivent respecter la même transaction; une écriture obsolète doit être refusée.

## Pièges fréquents
- Confondre l'exposition d'un outil MCP et l'autorisation d'y accéder.
- Déduire la cause d'une panne à partir du seul XID.
- Permettre au modèle de libérer un verrou sans approbation humaine.
- Enregistrer le résultat d'un ancien Worker avant de vérifier sa version.
- Prendre une hypothèse générée par l'IA pour une preuve.

## Question d'entrevue Senior
Une transaction globale Seata reste bloquée. L'agent peut lire les branches, les verrous et les journaux. Comment organiser le diagnostic en lecture seule, les preuves et l'approbation humaine? Comment empêcher un ancien Worker de remplacer un diagnostic récent? Répondez avant de consulter une solution.

## Exercice de 15 minutes
Dessinez le flux « MCP en lecture seule → instantané des preuves → recommandation → approbation ». Définissez requestId, XID, date de collecte, source et leaseVersion. Ne touchez pas à la production.

## Conclusion
MCP facilite l'accès aux données de diagnostic; la fiabilité exige des preuves vérifiables, des permissions minimales et des écritures protégées.
