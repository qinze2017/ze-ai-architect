+++
title = "Senior Java / IA : réutilisation sécurisée des modèles chargés dans CorePilot"
date = 2026-11-13
draft = false
summary = "Gérer les modèles résidents, le chargement unique et les réservations concurrentes pour la génération d'images."
tags = ["Java", "AI", "CorePilot", "Concurrency"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel
Dans CorePilot, la génération texte-image et image-image peuvent utiliser le même modèle déjà chargé. Le décharger systématiquement ralentit les requêtes, mais comparer uniquement son nom ne suffit pas.

## Concepts essentiels
**Identité du modèle** : combiner l'empreinte SHA-256 des poids, le moteur d'exécution, la précision et les adaptateurs pertinents. **Chargement unique (single-flight)** : les requêtes concurrentes partagent la même opération de chargement. **Bail et compteur de références** : aucun déchargement tant qu'une tâche utilise le modèle. **États** : UNLOADED → LOADING → READY → UNLOADING, avec FAILED en cas d'échec.

## Contrat Java 17 (illustratif, non exécutable)
~~~java
enum State { UNLOADED, LOADING, READY, UNLOADING, FAILED }
record ModelKey(String modelSha256, String runtime, String precision) {}
record Lease(ModelKey key, long generation) {}
// Pseudocode contract: implement under one coordinator lock or DB transaction.
// acquire(key): if READY and matching key, increment reference count;
// if LOADING, wait for the same in-flight future;
// otherwise reserve capacity and start exactly one load.
// release(lease): decrement only when generation matches.
// Never unload while active references > 0.
~~~

## Pièges fréquents
Vérifier READY sans verrou puis lancer deux chargements; ignorer un changement de poids derrière un chemin identique; oublier de libérer la mémoire réservée après un échec; accepter un ancien bail après une nouvelle génération; confondre budget estimé et consommation maximale réelle.

## Question d'entrevue Senior
Deux requêtes texte-image et image-image demandent simultanément le même modèle; une troisième demande un autre modèle. Comment éviter les chargements doubles, protéger le budget mémoire et gérer annulation et échec? Répondez avant de consulter une solution.

## Exercice de 15 minutes
Dessiner les transitions d'état et définir les opérations atomiques acquire/release. Prévoir trois tests : demandes simultanées, échec suivi d'une reprise et libération tardive d'un ancien bail. Ne pas toucher au service de production.

## Conclusion
La réutilisation des modèles exige une gestion cohérente de la concurrence, de la capacité et du cycle de vie.
