+++
title = "Senior Java / AI：CorePilot 的内存准入控制与安全暂停"
date = 2026-11-07
draft = false
summary = "从 Mac Studio 的 ComfyUI、Swap 和多服务调度理解资源准入与进程生命周期。"
tags = ["Java", "AI", "CorePilot", "Scheduling"]
categories = ["Learning"]
showComments = true
+++

## 背景
11 月 7 日设计 CorePilot：希望统一管理本地 ComfyUI、开发服务和后台任务，在 Swap 增长时避免同时启动过多高内存工作负载，并允许暂停后恢复。监控到 Swap 使用量很高，不等于所有 Swap 都在持续活跃换页；不能仅凭一个数字强制终止进程。

## 核心概念
**Admission control（准入控制）**：启动任务前检查可用资源、预计峰值和安全余量。**Backpressure（背压）**：资源紧张时拒绝或排队新任务，而不是无限并发。**Lifecycle（生命周期）**：STOPPED → STARTING → RUNNING → DRAINING → STOPPED；异常进入 FAILED。暂停新任务与操作系统 SIGSTOP 暂停进程不同：后者可能冻结持锁进程、连接和 GPU 资源，不应默认使用。

## Java 17 教学示例
~~~java
record Snapshot(long availableMb, long swapUsedMb, boolean pressureHigh) {}
record Workload(long estimatedPeakMb, boolean critical) {}

static boolean mayStart(Snapshot s, Workload w, long reserveMb) {
    if (s.pressureHigh()) return false;
    if (w.estimatedPeakMb() < 0 || reserveMb < 0) return false;
    return s.availableMb() >= w.estimatedPeakMb() + reserveMb;
}
~~~此纯函数只演示资源预算决策；`availableMb` 必须来自可信采样，真实系统还需要时间窗口、滞回、并发预留和启动后的二次校验。

## 常见陷阱
- 把 `swapUsed` 当作当前内存压力的唯一指标。
- 认为停止网页按钮就能安全中断 GPU 推理。
- 两个并发启动请求读取同一份余量，导致超额分配（TOCTOU）。
- 只保存进程 PID，不验证进程身份，可能误操作复用的 PID。
- 把任务排队误认为任务已经成功执行。

## Senior 面试题
CorePilot 同时收到两个各需 20GB 的 ComfyUI 作业，而资源预算只剩 30GB。如何原子地保留资源，防止两个请求都通过？运行中的任务如何优雅停止？

## 15 分钟实践
画出 QUEUED、RESERVED、STARTING、RUNNING、DRAINING、STOPPED、FAILED 状态图；标出哪些转换需要持久化和幂等检查。仅设计，不停止真实进程。

## 总结
监控提供事实，准入控制做决策，任务状态机控制执行；安全暂停首先是协作式停止接收新任务，不是随意冻结进程。
