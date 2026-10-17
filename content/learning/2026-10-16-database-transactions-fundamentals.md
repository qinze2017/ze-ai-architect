+++
title = "Java 基础补充：数据库事务是什么？ACID、提交回滚与事务传播"
date = 2026-10-16
draft = false
summary = "从转账示例理解数据库事务，区分 REQUIRED 与 REQUIRES_NEW，并掌握 Spring Boot 事务边界。"
tags = ["Java", "Spring Boot", "Transactions", "PostgreSQL", "ACID"]
categories = ["每日复习"]
showComments = true
+++

## 今日核心主题

**学习目标（20–30 分钟）**：准确解释数据库事务（Transaction）是什么，为什么需要 COMMIT 和 ROLLBACK，以及 Spring Boot 的 `REQUIRED` 与 `REQUIRES_NEW` 如何选择事务边界。这是今天事务回滚实战的基础补充。

## 核心概念

数据库事务是数据库管理的一组操作的逻辑工作单元。它不是 Java 方法，也不等于一条 SQL。事务中的修改可以在提交前撤销；成功提交后，修改成为已提交状态。

- `BEGIN`：开始一个事务。
- `COMMIT`：提交事务中的修改。
- `ROLLBACK`：撤销该事务尚未提交的修改。
- `@Transactional`：让 Spring 在代理调用边界管理事务；正常返回通常提交，未捕获的 `RuntimeException` 或 `Error` 默认触发回滚。受检异常默认不触发回滚，可用 `rollbackFor` 定制。

## 为什么重要

转账包含两步：A 账户扣 100 元，B 账户加 100 元。若第二步失败，不能只扣钱不入账。把两步放在同一数据库事务中，失败时可一起回滚。实际生产还需处理余额不足、并发更新、幂等和数据库约束，事务本身不自动解决所有业务问题。

## ACID 四大特性

| 特性 | 含义 |
|---|---|
| Atomicity 原子性 | 同一事务中的修改作为一个整体提交或回滚 |
| Consistency 一致性 | 事务应保持业务规则与数据库约束 |
| Isolation 隔离性 | 并发事务间的可见性与干扰由隔离级别控制 |
| Durability 持久性 | 成功提交的修改应在故障恢复后保留 |

## 代码或配置示例

```java
@Service
@RequiredArgsConstructor
class TransferService {
    private final AccountRepository accounts;

    @Transactional
    public void transfer(long from, long to, BigDecimal amount) {
        accounts.debit(from, amount);
        accounts.credit(to, amount);
    }
}
```

```java
@Transactional(propagation = Propagation.REQUIRED)
public void reserveStock() { /* joins an existing transaction */ }

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void recordAudit() { /* starts an independent transaction */ }
```

上例是示意代码：需要实际 Repository 实现、账户校验及数据库事务支持。确保方法经 Spring 代理调用；同类内部直接调用可能绕过默认 AOP 事务拦截。

## REQUIRED 与 REQUIRES_NEW

| 情况 | REQUIRED | REQUIRES_NEW |
|---|---|---|
| 外层没有事务 | 新建事务 | 新建事务 |
| 外层已有事务 | 加入外层物理事务 | 挂起外层，创建独立物理事务 |
| 内层提交 | 不能独立提交共享事务 | 可以独立提交 |
| 内层失败 | 可能标记共享事务 rollback-only | 内层回滚不自动回滚外层 |
| 资源 | 通常共用事务连接 | 外层持有连接时通常还需额外连接 |

**关键陷阱**：`REQUIRES_NEW` 抛出的异常若继续传播到外层，外层仍可能因为该异常而回滚。独立事务不等于异常自动被吞掉。若 `REQUIRED` 内层已经将共享事务标记 rollback-only，外层即使捕获异常，最终提交仍可能抛出 `UnexpectedRollbackException`。

## PostgreSQL 与事务隔离

PostgreSQL 默认隔离级别为 `READ COMMITTED`。普通 SELECT 不会看到其他事务尚未提交的 INSERT。即使 `saveAndFlush()` 已发送 SQL，也不等于 `COMMIT`。独立 `REQUIRES_NEW` 事务不能直接读取外层未提交的订单行。

## 常见错误

1. 认为 `@Transactional` 让每条 SQL 立即提交。
2. 认为 `flush()` 等于 `commit()`。
3. 认为捕获异常一定可以挽救已标记 rollback-only 的共享事务。
4. 认为 `REQUIRES_NEW` 可以安全引用外层尚未提交的外键行。
5. 在同一个 Bean 内部调用 `@Transactional` 方法，却以为一定通过代理。

## 面试题

外层事务 A 保存订单，调用另一个 Bean 的 `REQUIRES_NEW` 事务 B 记录审计。B 提交成功后，A 抛出未捕获的 `RuntimeException`。假设没有外键等待或其他异常：

**A.** A、B 都回滚；**B.** A 回滚、B 提交；**C.** A、B 都提交。

**答案：B。** 两个独立物理事务的提交结果可以不同。

## Senior-level answer

`REQUIRED` 是参与现有事务的传播策略；`REQUIRES_NEW` 会挂起外层事务并开启新的物理事务，因此可以独立提交或回滚。它们解决的是**事务边界**问题，不直接决定业务操作是否合理。应评估数据一致性、外键可见性、连接池容量、异常传播及重试幂等性。

## 系统设计思考

订单与库存通常要求原子一致，应优先共享事务；失败尝试的独立审计可以考虑 `REQUIRES_NEW`，但审计记录不应依赖未提交订单的外键。跨数据库、消息队列或第三方 API 的原子性不能仅靠本地数据库事务保证，必要时使用 Outbox 等设计。

## 今日项目实践

1. 用 PostgreSQL 建立两个测试账户并写一个 `@Transactional` 转账服务。
2. 在第二步故意抛出 `RuntimeException`，断言两账户余额均恢复。
3. 在另一个 Bean 中添加 `REQUIRES_NEW` 审计操作，验证外层回滚后审计记录仍存在。

**验收**：能用一句话解释事务，能区分 `COMMIT` 与 `ROLLBACK`，能说明为何 B 的结果可能独立于 A。

## 自测问题

1. 事务等于一条 SQL 吗？**不等于。**
2. `COMMIT` 和 `ROLLBACK` 的区别？**保存已提交修改与撤销未提交修改。**
3. `REQUIRED` 遇到现有事务？**加入。**
4. `REQUIRES_NEW` 遇到现有事务？**挂起外层，创建独立事务。**
5. PostgreSQL `READ COMMITTED` 能看到其他事务未提交数据吗？**普通 SELECT 不能。**

## 今日总结

**事务是数据库的一组操作的提交与回滚边界。** 睡前最小复习：解释 `BEGIN → COMMIT / ROLLBACK`，并说出 `REQUIRED` 与 `REQUIRES_NEW` 的一句话区别。
