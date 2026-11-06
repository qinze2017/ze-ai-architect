+++
title = "Senior Java: Safe file cleanup after an uncertain COMMIT"
date = 2026-11-05
draft = false
summary = "Preserve evidence files when a database commit outcome is unknown."
tags = ["Java", "Spring Boot", "PostgreSQL", "Transactions"]
categories = ["Learning"]
showComments = true
+++

## Context / 背景 / Contexte

A November 5 PromoLocal Photo Deal review found a race: after a COMMIT error, a new connection might not yet see the row even though the earlier transaction may later commit successfully.

## Core concepts / 核心概念 / Concepts clés

An unknown commit outcome is not a confirmed rollback. PostgreSQL and the filesystem do not share an atomic transaction. A temporary missing row is not proof of a failed commit.

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

Do not equate saveAndFlush with commit. Avoid unconditional file deletion on exceptions. Use delayed, idempotent, auditable orphan cleanup.

## Senior interview question / 面试题 / Question

Why is immediate file deletion unsafe after a COMMIT timeout? How would you design reliable orphan cleanup?

## 15-minute practice / 实战 / Exercice

Draw states for failure before commit, confirmed success, and unknown outcome. Define retention and delayed cleanup rules.

## Summary / 总结 / Conclusion

Preserve files when commit outcome is unknown; verify before delayed cleanup.
