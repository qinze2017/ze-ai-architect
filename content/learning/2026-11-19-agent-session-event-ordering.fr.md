+++
title = "Senior Java / IA : événements désordonnés et générations de sessions multiagents"
date = 2026-11-19
draft = false
summary = "Étudier les événements tardifs et la cohérence des états dans un watcher OpenCode."
tags = ["Java", "AI Architecture", "Multi-Agent", "Event Ordering"]
categories = ["Learning"]
showComments = true
+++

## Contexte réel

Une équipe locale multiagents utilise un watcher OpenCode pour observer les sessions et les activités des outils. Des hooks publient notamment idle. Il s'agit d'un risque architectural à tester, et non d'un défaut confirmé.

## Concepts fondamentaux

**Ordonnancement des événements (Event Ordering)** : la réception peut différer de l'ordre logique.

**Génération de session (Session Generation / Epoch)** : un événement ancien ne doit pas remplacer l'état d'une nouvelle session.

**Séquence monotone (Monotonic Sequence)** : n'accepter que les numéros supérieurs dans la même génération; les horloges murales ne suffisent pas entre processus.

**Machine à états (State Machine)** : vérifier les transitions permises entre working, idle, waiting et compacting.

**Jeton de clôture (Fencing Token)** : contrôler la génération lors de l'écriture atomique, même avec plusieurs instances.

## Exemple pédagogique Java 17

~~~java
record Event(long generation, long sequence, String phase) {}
record State(long generation, long sequence, String phase) {}
static State apply(State old, Event next) {
    if (next.generation() < old.generation()) return old;
    if (next.generation() == old.generation() && next.sequence() <= old.sequence()) return old;
    return new State(next.generation(), next.sequence(), next.phase());
}
~~~

Ce fragment filtre seulement les événements périmés. En production, vérifier aussi l'identité de la session, la provenance, les transitions et l'atomicité. Les compteurs doivent venir d'une source fiable.

## Pièges courants

- Un ancien agent:idle écrase le nouvel état working.
- L'ordre interprocessus repose uniquement sur Date.now().
- La déduplication existe uniquement dans l'interface.
- Une nouvelle session réutilise les anciens numéros sans augmenter la génération.
- Un affichage idle est pris pour une preuve d'arrêt du processus.

## Question d'entrevue Senior (répondre d'abord)

S1 émet idle, puis S2 démarre et devient working. Le watcher reçoit finalement le vieux idle de S1. Comment empêcher la régression de l'état avec deux instances serveur simultanées?

## Exercice pratique de 15 minutes

Dans un test isolé, rejouer S1:working → S2:working → S1:idle tardif, puis des doublons, des inversions et des redémarrages. Documenter l'état attendu sans toucher à la production.

## Conclusion et limites

La robustesse repose sur le rejet des événements périmés, non sur une livraison parfaitement ordonnée. Ce code n'est pas intégré ni vérifié dans le watcher réel.
