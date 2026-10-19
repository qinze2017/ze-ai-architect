+++
title = "Senior Java：REQUIRES_NEW 与 PostgreSQL 外键审计"
date = 2026-10-18
draft = false
summary = "独立事务、未提交订单外键与失败审计设计。"
tags = ["Java", "Spring Boot", "PostgreSQL", "Transactions", "Audit"]
categories = ["每日复习"]
showComments = true
+++

## 今日知识点

外层事务 T1 创建订单并调用另一个 Spring Bean 的 REQUIRES_NEW 审计事务 T2。即使 T2 可以独立提交，也不能绕过 PostgreSQL 外键约束。

PostgreSQL 默认 READ COMMITTED，其他事务看不到 T1 尚未提交的订单。若审计表的 order_id 外键引用这个新订单，T2 的外键检查可能等待 T1 结束；但同步调用中 T1 正等待 T2 返回，因而可能一直阻塞到超时。不是每次都立即抛出外键异常，也不一定被数据库的死锁检测发现。flush 不等于 commit。

## SQL 实验（只在测试库执行）

```sql
CREATE TABLE orders(id bigint PRIMARY KEY);
CREATE TABLE audit_log(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES orders(id)
);
```

会话 A：

```sql
BEGIN;
INSERT INTO orders(id) VALUES (1001);
-- 暂不提交
```

会话 B：

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
INSERT INTO audit_log(order_id) VALUES (1001);
-- 观察等待或超时；失败后 ROLLBACK
```

之后会话 A 执行 ROLLBACK。注意 DEFERRABLE 只能延后外键检查，不能让最终不存在的父订单合法。

## 更稳妥的失败审计

不要让失败审计必须引用可能回滚的 orders.id。用独立 UUID attempt_id 关联同一次业务尝试，记录状态、错误码和时间；避免保存敏感请求体。

```sql
CREATE TABLE order_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id uuid NOT NULL,
  status text NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

```java
// 独立 Spring Bean，通过事务代理调用
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void recordFailure(UUID attemptId, String code) {
    auditRepository.save(new OrderAudit(attemptId, "FAILED", code));
}
```

在非事务协调层捕获订单事务失败后调用此方法；审计不依赖未提交订单的外键。严格保证持久化还需重试、幂等、告警或可靠队列：数据库故障时 REQUIRES_NEW 本身也会失败。事务内的成功事件可用 Transactional Outbox，但回滚事件不会自动保留。

## 常见陷阱

1. 认为 REQUIRES_NEW 能读取外层未提交的数据。
2. 认为 saveAndFlush 就是 commit。
3. 忽略应用层等待环、超时和连接池容量。
4. 在同一 Bean 内自调用导致事务代理未生效。
5. 把审计记录与可能回滚的订单强制绑定。
6. 只断言异常，不检查最终数据库状态。

## Senior 面试题（先自己回答）

订单 2001 **已经提交存在**。事务 T1 更新其状态，调用 T2（REQUIRES_NEW）保存带 order_id 外键的审计，然后 T1 抛出 RuntimeException。

T2 能否提交？T1 回滚后订单状态与审计各如何？哪些并发锁或异常会改变结果？请先回答，不在这里公布答案。

## 15 分钟实践

1. 用两个 psql 会话复现外键等待，设置 3 秒 lock_timeout。
2. 将失败审计改用 attempt_id，验证 T1 回滚后 T2 的记录仍可保留。
3. 规划集成测试：外层回滚、未提交父行外键、已提交父行审计；测试方法不要加 @Transactional。

## 总结

REQUIRES_NEW 只改变事务边界，不豁免外键或隔离规则。失败审计应拥有独立业务标识，并为持久化故障设计恢复机制。

参考：[Spring 事务传播](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)；[PostgreSQL 外键](https://www.postgresql.org/docs/current/ddl-constraints.html)。
