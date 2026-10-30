+++
title = "Senior Java：租约到期后，如何阻止旧 Worker 写回？"
date = 2026-10-29
draft = false
summary = "从 PROCESSING 状态深入到 Lease、Fencing Token 和过期任务的安全完成。"
tags = ["Java", "PostgreSQL", "Workers", "Lease", "Fencing Token", "Concurrency", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实学习背景

在可靠 Worker 基础课中，我们已经区分了：数据库行锁随事务结束而释放，而任务的 PROCESSING 状态会继续保留。接下来的问题不是重复解释 SKIP LOCKED，而是：**租约过期后旧 Worker 恢复运行，能否覆盖新 Worker 的结果？**

这是处理 PDF、AI 推理和后台任务时都可能遇到的竞态。

## 1. 核心概念：Lease 不等于 Worker 已死亡

假设任务 1001 由 Worker A 在 10:00 领取，租约到 10:01。A 的 AI 调用卡住；10:01:01 Worker B 重新领取任务。A 在 10:01:02 恢复并尝试保存结果。

租约到期只是**允许系统重新分配**，不代表 A 的进程已经停止。单靠 status = PROCESSING 也无法区分 A 和 B，因为它们看到的是同一个状态。

解决思路是为每次领取发一个单调递增的 **Fencing Token**（例如 lease_version）。A 获得版本 7，B 重新领取获得版本 8。完成任务时必须同时验证任务 ID、当前 owner、版本和未过期的租约。旧版本不应更新最终状态。

## 2. 领取与完成的事务边界

在 PostgreSQL 中，领取任务应该是**一个短事务**：锁定可领取行、将状态改为 PROCESSING、写入 owner 和租约截止时间、递增 lease_version，然后提交。AI 调用放在事务外。

完成时使用**条件更新**，只允许匹配当前 owner、当前 lease_version、PROCESSING 状态且租约未过期的请求把状态改为 DONE。受影响行数为 0 时，说明提交权可能已丢失，不能盲目覆盖或重试同一结果。

生产系统还应通过数据库原子更新保证并发安全，不能先 SELECT 检查版本、再无条件 UPDATE。以下 Java 示例只演示版本门禁逻辑，不是 PostgreSQL repository 实现。

## 3. Java 17：可运行的最小 Fencing 演示

~~~java
import java.time.Instant;

public class WorkerFencingDemo {
    static final class Job {
        String status = "PENDING";
        String owner = "";
        long version = 0;
        Instant leaseUntil = Instant.EPOCH;

        synchronized long claim(String worker, Instant now) {
            boolean available = status.equals("PENDING")
                || (status.equals("PROCESSING") && !now.isBefore(leaseUntil));
            if (!available) throw new IllegalStateException("not claimable");
            status = "PROCESSING";
            owner = worker;
            version++;
            leaseUntil = now.plusSeconds(60);
            return version;
        }

        synchronized boolean complete(String worker, long token, Instant now) {
            if (!status.equals("PROCESSING") || !owner.equals(worker)
                    || version != token || !now.isBefore(leaseUntil)) return false;
            status = "DONE";
            return true;
        }
    }

    public static void main(String[] args) {
        Job job = new Job();
        Instant t = Instant.parse("2026-10-29T22:00:00Z");
        long tokenA = job.claim("A", t);
        long tokenB = job.claim("B", t.plusSeconds(61));
        if (job.complete("A", tokenA, t.plusSeconds(62)))
            throw new AssertionError("stale worker was accepted");
        if (!job.complete("B", tokenB, t.plusSeconds(63)))
            throw new AssertionError("current worker was rejected");
        if (job.complete("B", tokenB, t.plusSeconds(64)))
            throw new AssertionError("duplicate completion was accepted");
        System.out.println("PASS: stale and duplicate completion rejected");
    }
}
~~~

运行：将代码保存为 WorkerFencingDemo.java，然后执行：

~~~text
javac --release 17 WorkerFencingDemo.java
java WorkerFencingDemo
~~~

预期输出：PASS: stale and duplicate completion rejected。

示例使用 synchronized 模拟单进程中的原子状态变更，并使用固定 Instant 模拟时间。**它不是分布式锁，也没有证明真实 PostgreSQL 并发语义**。真实部署应将校验条件下推到数据库的原子 UPDATE，并在集成测试中模拟两个独立连接。

## 4. 常见陷阱

1. 误以为 Lease 到期就意味着旧 Worker 已退出；旧进程可能继续执行。
2. 只比较 PROCESSING，不比较 lease_version，导致旧结果覆盖新结果。
3. 领取后一直保持数据库事务打开，等待外部 AI 调用。
4. 先查询版本再执行无条件 UPDATE，产生检查与写入之间的竞态。
5. 只保护数据库状态，却允许旧 Worker 覆盖外部对象存储或重复发送通知。外部副作用还需要幂等键、版本化对象或目标端条件写入。
6. 认为 Fencing Token 本身就实现 exactly-once；网络超时和外部副作用仍可能重复。

## 5. Senior 面试题：先自行回答

A 的 lease_version = 7，租约到期后 B 领取同一任务并得到版本 8。随后 A 和 B 几乎同时完成 AI 处理。

**你会在数据库完成操作中检查哪些字段？如果 A 的 UPDATE 影响 0 行，应用层应该怎么处理？如果 A 已经把文件写到对象存储，又如何避免外部结果被覆盖？**

先写出自己的判断，不在这里公布参考答案。

## 6. 15 分钟实战

1. 运行 Java 17 演示，确认旧 Worker 和重复完成均被拒绝。
2. 将 A 的完成时间改为租约未过期、B 领取之前，观察结果如何变化。
3. 用纸画出 A 领取、A 暂停、租约过期、B 领取、A 恢复、B 完成的时间线。
4. 为未来的 PostgreSQL Testcontainers 测试列出三个断言：版本单调递增；旧版本不能完成；新版本可以完成。不要直接在生产数据库测试。

## 总结

**行锁保证短事务内的领取互斥，PROCESSING 记录业务状态，Lease 允许恢复，Fencing Token 阻止旧 Worker 误写。** 数据库完成门禁并不自动保护外部副作用，仍需幂等与目标端版本控制。

验证边界：本文 Java 17 演示已编译运行；PostgreSQL SQL 与真实分布式 Worker 集成测试未在本次执行。
