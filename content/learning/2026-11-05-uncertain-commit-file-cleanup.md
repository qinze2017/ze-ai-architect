+++
title = "Senior Java：COMMIT 结果未知时的文件清理"
date = 2026-11-05
draft = false
summary = "数据库提交结果未知时保留证据文件，避免孤儿引用。"
tags = ["Java", "Spring Boot", "PostgreSQL", "Transactions"]
categories = ["Learning"]
showComments = true
+++

## Context / 背景 / Contexte

11月5日 PromoLocal Photo Deal 审计发现：COMMIT 报错后新连接暂时查不到记录，不代表提交最终失败。若此时删除图片，稍后提交成功就会留下无效文件引用。

## Core concepts / 核心概念 / Concepts clés

提交结果未知不同于确定回滚。数据库与文件系统没有共同的原子事务。发出 COMMIT 后发生超时或断连，不能把查询暂时无记录当成失败证据。

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

不要把 saveAndFlush 当成 commit；不要在异常处理里无条件删除文件；清理应延迟、幂等、可审计。

## Senior interview question / 面试题 / Question

为什么 COMMIT 超时后不能立即删除已写图片？如何设计安全的孤儿文件回收？

## 15-minute practice / 实战 / Exercice

列出提交前失败、提交成功、提交结果未知三种状态，分别决定是否保留文件，并为延迟清理定义安全等待期。

## Summary / 总结 / Conclusion

提交结果未知时保留文件，待后续核实后清理。
