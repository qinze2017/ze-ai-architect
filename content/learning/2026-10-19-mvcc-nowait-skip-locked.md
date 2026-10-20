+++
title = "Senior Java：MVCC、NOWAIT 与 SKIP LOCKED"
date = 2026-10-19
draft = false
summary = "用两个事务理解 READ COMMITTED、PostgreSQL 行锁和非阻塞锁获取。"
tags = ["Java", "PostgreSQL", "MVCC", "Transactions", "Locking"]
categories = ["Learning"]
showComments = true
+++

## 核心概念

**MVCC**（Multi-Version Concurrency Control，多版本并发控制）决定数据版本的可见性；**行级锁**处理并发操作之间的冲突。PostgreSQL 的默认隔离级别 `READ COMMITTED` 下，普通 `SELECT` 通常读取旧的已提交版本，不等待另一事务尚未提交的更新；但 `SELECT ... FOR UPDATE` 必须取得行锁，遇到冲突会等待。

- `FOR KEY SHARE`：保护关键字段及记录存在性，通常允许更新非键字段。
- `FOR SHARE`：共享行锁，阻止并发更新该行。
- `FOR NO KEY UPDATE`：普通非键字段 UPDATE 通常取得的行锁。
- `FOR UPDATE`：最强行锁，与以上四种行锁均冲突。

在 PostgreSQL/Hibernate 中，`PESSIMISTIC_READ` 通常对应 `FOR SHARE`，不是 `FOR KEY SHARE`；具体应核对 JPA 方言实际生成的 SQL。

## SQL 示例：两个会话（仅测试数据库）

```sql
CREATE TABLE orders (id bigint PRIMARY KEY, status text NOT NULL);
INSERT INTO orders VALUES (2001, 'PENDING'), (2002, 'PENDING');
```

会话 A：

```sql
BEGIN;
UPDATE orders SET status = 'PAID' WHERE id = 2001;
-- 保持事务未提交
```

会话 B：

```sql
SELECT status FROM orders WHERE id = 2001;
-- READ COMMITTED 下通常立即返回 PENDING

SELECT status FROM orders WHERE id = 2001 FOR UPDATE NOWAIT;
-- 行锁冲突：立即报错，不等待

SELECT status FROM orders WHERE id = 2001 FOR UPDATE SKIP LOCKED;
-- 跳过锁定中的订单：返回 0 行
```

如果会话 A 提交，随后新的普通 SELECT 会读到 PAID。`SKIP LOCKED` 返回零行并不代表订单不存在。

## Spring Boot / JPA 示例

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id = :id")
    Optional<Order> lockOrder(@Param("id") Long id);
}
```

JPA 的 `PESSIMISTIC_WRITE` 通常生成 `FOR UPDATE`，但 `NOWAIT` / `SKIP LOCKED` 的写法依赖 Hibernate 版本与方言。需要精确控制时可在 PostgreSQL 专用 repository 中使用原生 SQL，并通过集成测试验证实际行为。

## 常见陷阱

1. `flush()` 不等于 `COMMIT`，不会释放事务行锁。
2. MVCC 不意味着 `SELECT FOR UPDATE` 永远不阻塞。
3. `NOWAIT` 遇锁冲突立即失败；需要处理 SQLSTATE 55P03（lock_not_available）。
4. `SKIP LOCKED` 适合任务领取，不适合需要完整结果的普通查询。
5. `READ COMMITTED` 每条语句通常使用新的快照；加锁查询等待后还可能重新检查 `WHERE` 条件。

## Senior 面试题（先自行回答）

T1 在 `READ COMMITTED` 下把订单 2001 从 PENDING 更新为 PAID，但未提交。T2 执行：

```sql
SELECT status FROM orders
WHERE id = 2001 AND status = 'PENDING'
FOR UPDATE;
```

T2 会等待吗？如果 T1 随后提交，T2 返回 PENDING、PAID、零行还是错误？请解释行锁与 WHERE 条件的关系。

## 实战练习

在测试 PostgreSQL 中打开两个独立会话，分别尝试普通 SELECT、FOR UPDATE、FOR UPDATE NOWAIT 和 FOR UPDATE SKIP LOCKED。记录返回值、等待时间与错误码。不要在生产数据库运行示例建表或更新语句。

## 总结

**MVCC 管可见性，行锁管冲突；NOWAIT 立即失败，SKIP LOCKED 跳过冲突行。** 设计并发任务队列时必须同时考虑幂等性、重试和事务边界。
