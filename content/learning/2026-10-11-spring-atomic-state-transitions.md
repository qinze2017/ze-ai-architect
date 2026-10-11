+++
title = "Spring 条件更新与原子状态转换"
date = 2026-10-11
draft = false
summary = "用数据库条件更新实现并发安全的状态转换，并理解它与 @Transactional、乐观锁和幂等性的边界。"
tags = ["Java", "Spring Boot", "SQL", "Transactions", "Concurrency", "Idempotency"]
categories = ["每日复习"]
showComments = true
+++

## 今日核心主题

在 Spring Boot 后端中，`@Transactional` 只能保证当前事务中的一组数据库操作具有事务边界，它并不能自动阻止两个不同进程、两个 Pod 或两个并发请求同时读取同一条 `PENDING` 记录，然后都继续执行业务逻辑。

今天学习一个非常实用的并发控制模式：**条件更新（conditional update）+ 原子状态转换（atomic state transition）**。

目标是让数据库决定“谁成功抢到这条任务”，而不是依赖 JVM 内存锁。

## 核心概念

假设 `product_scan` 有状态：

`PENDING -> FETCHING -> COMPLETED / FAILED`

不要先 `SELECT` 再无条件 `UPDATE`：

```text
SELECT status FROM product_scan WHERE id = ?;
// status == PENDING
UPDATE product_scan SET status = 'FETCHING' WHERE id = ?;
```

因为两个请求可能同时读到 `PENDING`。

更可靠的方法是把前置条件直接放进 SQL：

```sql
UPDATE product_scan
SET status = 'FETCHING',
    updated_at = CURRENT_TIMESTAMP
WHERE id = :id
  AND status = 'PENDING';
```

数据库会原子地完成“检查旧状态 + 写入新状态”。应用只需要检查受影响行数：

- `1`：你成功完成了状态转换，可以继续处理。
- `0`：状态已经被别人修改，或者记录不存在；当前请求不能继续假装自己获得了任务。

## 为什么重要

这个模式适合订单状态、支付流程、后台任务、库存预占、文件处理、爬虫任务、消息消费等场景。

关键点是：**状态转换本身是业务不变量（business invariant）**。

例如只有 `PENDING` 才能进入 `FETCHING`。这个规则应该由确定性软件和数据库保证，而不是由日志、前端按钮、LLM、单机内存锁或“通常不会同时发生”的假设保证。

在多实例部署中，`synchronized` 或 `ReentrantLock` 只能保护单个 JVM。数据库条件更新则可以协调所有连接到同一数据库的应用实例。

## 代码或配置示例

Spring Data JPA 可以这样写：

```java
public interface ProductScanRepository extends JpaRepository<ProductScan, Long> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update ProductScan s
           set s.status = :nextStatus,
               s.updatedAt = CURRENT_TIMESTAMP
         where s.id = :id
           and s.status = :expectedStatus
        """)
    int transitionStatus(
        @Param("id") Long id,
        @Param("expectedStatus") ScanStatus expectedStatus,
        @Param("nextStatus") ScanStatus nextStatus
    );
}
```

Service：

```java
@Transactional
public void startFetching(Long id) {
    int updated = repository.transitionStatus(
        id,
        ScanStatus.PENDING,
        ScanStatus.FETCHING
    );

    if (updated == 0) {
        throw new ScanStateConflictException(id);
    }
}
```

REST 层可以把业务冲突映射为 `409 Conflict`：

```java
@ExceptionHandler(ScanStateConflictException.class)
ResponseEntity<ApiError> handleConflict(ScanStateConflictException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(new ApiError("SCAN_STATE_CONFLICT", ex.getMessage()));
}
```

注意：如果状态转换成功之后要调用外部 API，不要把一个耗时很长的 HTTP 调用一直包在数据库事务里。常见做法是先以很短的事务成功 claim 任务，再在事务外执行远程工作，最后用另一个受控状态转换写回 `COMPLETED` 或 `FAILED`。

## 常见错误

1. 认为加了 `@Transactional` 就不会有并发竞争。事务保证原子性、一致性等属性，但两个事务仍然可以并发运行。
2. 先读状态，再在 Java 中 `if (status == PENDING)` 判断，然后无条件更新。这是典型的 check-then-act race condition。
3. 更新失败后仍继续调用外部服务，造成重复任务或重复扣费。
4. 把整个远程调用放进长事务，导致锁时间变长、连接池占用增加、失败恢复更复杂。
5. 返回 `500` 表示所有失败。对于“资源当前状态不允许这次操作”，`409 Conflict` 往往更准确。

## 面试题

**问题：** 两个 Spring Boot 实例同时尝试把同一条记录从 `PENDING` 改成 `FETCHING`。方法都加了 `@Transactional`，为什么仍可能发生竞争？你会如何设计？

## Senior-level answer

`@Transactional` 定义的是事务边界，不是分布式互斥锁。两个实例可以分别开启事务，并在接近相同的时间观察同一个业务状态。

我会优先把合法状态转换编码进单条原子 SQL：

```sql
UPDATE ... WHERE id = ? AND status = 'PENDING'
```

并把受影响行数作为是否获得执行权的事实来源。这样无需依赖 JVM 锁，而且能跨实例工作。

如果领域模型更适合实体更新，也可以使用带 `@Version` 的 optimistic locking；冲突时捕获 `OptimisticLockException` 并决定重试还是返回冲突。悲观锁 `SELECT ... FOR UPDATE` 适合必须锁定并读取复杂状态的短事务，但吞吐量和死锁风险需要评估。

生产环境还要考虑：

- 操作是否幂等；
- 外部副作用是否可能执行两次；
- 失败后的重试策略；
- `FETCHING` 卡死后的超时恢复；
- 状态转换日志与指标；
- 数据库索引是否支持 `id + status` 的访问模式；
- 业务冲突和系统故障是否使用不同错误码。

## 系统设计思考

一个可靠的任务状态机不能只解决“谁先更新成功”，还要解决“更新成功后进程挂了怎么办”。

例如：

1. A 成功把任务从 `PENDING` 改成 `FETCHING`。
2. A 在调用远程服务前崩溃。
3. 任务永久停在 `FETCHING`。

因此生产设计通常需要 lease/timeout：增加 `claimed_at`、`claimed_by` 或 `lease_until`。后台恢复任务可以把超过阈值的 `FETCHING` 标记为可重试状态。

这里要严格区分：数据库负责状态、时间、权限、幂等键和业务约束；AI/LLM 如果参与，只适合做非结构化提取、分类、解释或生成建议，不能决定支付是否成功、任务是否已执行或状态是否允许跳转。

## 今日项目实践

在你的 Spring Boot 项目中实现一个 `ProductScan` 状态转换 API：

```text
POST /api/v1/product-scans/{id}/fetch
```

要求：

1. 只有 `PENDING` 可以进入 `FETCHING`。
2. 使用单条条件更新 SQL/JPA update。
3. 更新行数为 `0` 时返回 `409 Conflict`。
4. 写一个并发测试，同时发送两个请求；断言只有一个成功。
5. 增加结构化日志：`scanId`、旧状态、目标状态、结果。
6. 思考如何给 `FETCHING` 增加超时恢复机制。

加分项：比较 conditional update 和 `@Version` optimistic locking 的代码复杂度、冲突语义和适用场景。

## 自测问题

1. 为什么 `@Transactional` 不能阻止两个不同实例同时竞争同一条记录？
2. `UPDATE ... WHERE status = 'PENDING'` 为什么可以消除 check-then-act race condition？
3. 更新行数为 `0` 时，为什么不能继续执行业务逻辑？
4. conditional update、optimistic locking 和 pessimistic locking 分别更适合什么场景？
5. 如果任务已经进入 `FETCHING` 后应用崩溃，系统应该如何恢复？

## 今日总结

**不要把 `@Transactional` 当成并发锁。** 对简单状态机，优先用数据库条件更新把“合法旧状态”写进 `WHERE`，再用受影响行数判断谁真正获得执行权；同时用幂等、超时恢复和可观测性补齐生产级可靠性。