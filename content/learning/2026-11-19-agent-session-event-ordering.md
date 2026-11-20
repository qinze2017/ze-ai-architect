+++
title = "Senior Java / AI：多 Agent 会话乱序事件与代际隔离"
date = 2026-11-19
draft = false
summary = "从 OpenCode watcher 和 idle hook 学习迟到事件、单调序号与状态一致性。"
tags = ["Java", "AI Architecture", "Multi-Agent", "Event Ordering"]
categories = ["Learning"]
showComments = true
+++

## 实际背景

本地多 Agent 开发团队使用 OpenCode watcher 读取会话、消息和工具活动，状态管理器通过 hook 发布 idle 等事件。这里分析潜在架构风险，不代表项目已确认存在缺陷。

## 核心概念

**Event Ordering（事件顺序）**：异步事件到达顺序不一定等于逻辑发生顺序。

**Session Generation / Epoch（会话代际）**：新会话启动后，旧会话的迟到事件不能覆盖新状态。

**Monotonic Sequence（单调序号）**：同一代际只接受更大序号；墙上时钟时间戳不足以建立跨进程可靠顺序。

**State Machine（状态机）**：还要验证 working、idle、waiting、compacting 的合法转换。

**Fencing（旧写入隔离）**：跨实例时必须在权威存储层原子校验代际。

## Java 17 教学代码

~~~java
record Event(long generation, long sequence, String phase) {}
record State(long generation, long sequence, String phase) {}
static State apply(State old, Event next) {
    if (next.generation() < old.generation()) return old;
    if (next.generation() == old.generation() && next.sequence() <= old.sequence()) return old;
    return new State(next.generation(), next.sequence(), next.phase());
}
~~~

示例只过滤过期 (generation, sequence)；生产系统还必须验证 Agent/session ID、事件来源、状态转换与原子写入。序号须由可信生产者分配。

## 常见陷阱

- 迟到的 agent:idle 覆盖新会话的 working。
- 用 Date.now() 给不同进程事件排序。
- 只在 UI 去重，服务端状态仍可能错误。
- 重启会话后复用旧序号却不增加 generation。
- 把界面 idle 当成进程已停止的证据。

## Senior 面试题（先回答）

Agent A 的旧会话 S1 发出 idle，随后新会话 S2 进入 working；watcher 最后才收到 S1 的 idle。如何保证 UI 和后端不回退？两个服务器实例同时消费时怎么办？

## 15 分钟实战

在隔离测试中重放 S1:working → S2:working → S1:idle(迟到)，再测试重复、逆序、重启。写出最终状态及拒绝原因，不连接生产 Agent。

## 总结与验证边界

系统可靠性来自拒绝过期事件，而非假设事件绝对有序。代码为教学片段，尚未在真实 OpenCode watcher 集成验证。
