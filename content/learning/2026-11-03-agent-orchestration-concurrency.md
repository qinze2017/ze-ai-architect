+++
title = "Senior Java / AI：多 Agent 并发编排、任务隔离与可靠发布"
date = 2026-11-03
draft = false
summary = "从今天讨论的 Super-agent 架构出发，理解并发任务、隔离、超时、幂等和结果提交。"
tags = ["Java", "AI", "Agents", "Concurrency", "Orchestration", "Idempotency"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实学习背景
今天讨论了所谓 Super-agent 与传统单会话 ReAct 循环的区别。**不要把某篇文章的产品名称或开源声明当作已经核实的官方事实**；这里提炼可复用的架构原则，供 Java/AI 工程实践使用。

## 核心概念
单个 ReAct Loop 依次执行“观察—决策—工具调用”，适合一个任务；多任务系统则需要 **Orchestrator（编排器）** 将任务拆分并调度给独立 Worker。并发不等于共享一个可变会话：每个子任务应有独立输入、权限、预算、截止时间和可追踪 ID。

在 PromoLocal 中，照片识别、价格候选提取和文案草稿可以并行，但**正式发布必须经过可信审核门禁**。并发结果可能乱序到达；只有满足当前版本和业务条件的结果才可提交。取消 Java Future 不保证外部模型调用立即停止，仍需超时、幂等键和写入端 fencing。

## Java 17 示例（教学伪集成）
以下片段假设已有 `tasks` 和 `process`；展示 JDK 17 API 使用方式，**不是可直接编译的完整程序**。
~~~java
record Task(String id, String input) {}
record Outcome(String id, String value) {}

ExecutorService pool = Executors.newFixedThreadPool(3);
try {
    List<Callable<Outcome>> work = tasks.stream()
        .<Callable<Outcome>>map(task -> () ->
            new Outcome(task.id(), process(task.input())))
        .toList();
    List<Future<Outcome>> futures = pool.invokeAll(work, 30, TimeUnit.SECONDS);
    for (Future<Outcome> future : futures) {
        if (future.isCancelled()) { /* record timeout; do not publish */ continue; }
        try {
            Outcome result = future.get();
            // Validate ownership/version and persist idempotently before publishing.
        } catch (ExecutionException ex) {
            // Record failure; retry only if safe and within a bounded policy.
        }
    }
} finally {
    pool.shutdownNow();
}
~~~

## 常见陷阱
- 将所有 Agent 共享同一个可变上下文，产生串扰。
- 只限制线程数，不限制模型 token、重试和外部 API 成本。
- 认为 `Future.cancel` 必然取消远端调用。
- 任务失败后无界重试，导致重复写入或费用激增。
- 将 Agent 的建议直接视为发布授权。
- 只靠完成顺序决定结果有效性，忽略版本和幂等性。

## Senior 面试题（先回答）
一个 PromoLocal AI 编排器并行运行三个子任务：图片识别、价格核对、文案生成。价格核对超时后重试，旧调用却在新调用之后返回。你如何设计任务 ID、重试、超时、结果版本、数据库提交和人工批准，确保旧结果不会覆盖新结果且不会自动发布？请先作答，不提供答案。

## 15 分钟实战
画出 `QUEUED → RUNNING → REVIEW_REQUIRED → APPROVED → PUBLISHED` 状态图，补充 `FAILED` 与 `TIMED_OUT`。给每个状态转换写出“谁有权触发”和“是否允许重复执行”。最后设计一个旧请求晚返回的测试。

## 总结
多 Agent 的价值不只是并行提速，而是**隔离任务、控制资源、验证结果、明确授权边界**。
