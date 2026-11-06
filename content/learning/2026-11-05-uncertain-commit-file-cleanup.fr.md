+++
title = "Senior Java : nettoyage des fichiers après un COMMIT incertain"
date = 2026-11-05
draft = false
summary = "Conserver les preuves quand le résultat du COMMIT reste inconnu."
tags = ["Java", "Spring Boot", "PostgreSQL", "Transactions"]
categories = ["Learning"]
showComments = true
+++

## Context / 背景 / Contexte

Le 5 novembre, une revue de PromoLocal Photo Deal a révélé un risque : après une erreur de COMMIT, une nouvelle connexion peut ne pas voir la ligne, même si la transaction précédente finira par réussir.

## Core concepts / 核心概念 / Concepts clés

Un résultat de COMMIT inconnu n'est pas un rollback confirmé. PostgreSQL et le système de fichiers n'ont pas de transaction atomique commune. Une absence temporaire de ligne ne prouve pas un échec définitif.

## Java 17 / Spring Boot example

~~~java
// Illustrative pseudocode: transaction boundaries must be verified.
enum CommitState { BEFORE_COMMIT, CONFIRMED, UNKNOWN }

void handleCommitFailure(CommitState state, Path image) throws IOException {
    if (state == CommitState.BEFORE_COMMIT) {
        Files.deleteIfExists(image); // only when no commit was attempted
    } else if (state == CommitState.UNKNOWN) {
        scheduleDelayedOrphanCheck(image); // retain file for now
    }
}
~~~

The snippet is conceptual, not a compiled production patch; scheduleDelayedOrphanCheck and transaction orchestration require implementation and integration tests.

## Pitfalls / 常见陷阱 / Pièges

Ne pas confondre saveAndFlush et commit. Éviter la suppression immédiate après une erreur incertaine. Prévoir un nettoyage différé, idempotent et journalisé.

## Senior interview question / 面试题 / Question

Pourquoi faut-il conserver les images après un COMMIT incertain ? Comment nettoyer les fichiers orphelins sans casser les références ?

## 15-minute practice / 实战 / Exercice

Dessiner trois états : échec avant COMMIT, succès confirmé, résultat inconnu. Définir une politique de conservation et un délai de nettoyage.

## Summary / 总结 / Conclusion

En cas d'incertitude, conserver les fichiers puis vérifier avant tout nettoyage.
