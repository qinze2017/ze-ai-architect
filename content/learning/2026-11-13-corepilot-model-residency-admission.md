+++
title = "Senior Java / AI：CorePilot 模型驻留复用与并发准入"
date = 2026-11-13
draft = false
summary = "从文生图和图生图复用同一模型的需求，学习模型状态机、单飞加载与安全卸载。"
tags = ["Java", "AI", "CorePilot", "Concurrency"]
categories = ["Learning"]
showComments = true
+++

## 实际背景
CorePilot 的文生图和图生图可能使用同一个已加载模型。若每次请求都先卸载再加载，会增加等待时间；但只比较模型显示名称也不安全。

## 核心概念
**模型身份**：用权重 SHA-256、运行时、精度和关键适配器配置构成 ModelKey，而不是仅用名称。**Single-flight**：并发请求相同模型时共享一个加载操作。**Lease/引用计数**：任务执行期间持有租约，引用数非零禁止卸载。**状态机**：UNLOADED → LOADING → READY → UNLOADING，失败进入 FAILED 并允许受控重试。

## Java 17 设计契约（示意，非可执行实现）
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

## 常见陷阱
先查询 READY 再启动加载而不加锁，会导致两个 Worker 同时加载；仅凭路径相同忽略文件变更；加载失败不释放预留内存；超时任务迟到后释放了新一代租约；把内存预算当成实际峰值保证。

## Senior 面试题
两个文生图与图生图请求同时需要相同模型，第三个请求需要不同模型。如何避免重复加载、保证容量预算不超卖，并在任务取消和加载失败时安全释放资源？先回答，不看参考答案。

## 15 分钟实战
画出模型状态机，写出 acquire/release 的原子性要求；列出三个并发测试：相同模型同时请求、加载失败后重试、旧租约迟到释放。先做隔离测试，不改生产服务。

## 总结
模型复用是受并发、容量与生命周期约束的资源管理问题，而不是简单的 if 判断。
