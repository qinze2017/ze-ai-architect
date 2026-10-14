+++
title = "Spring Boot 事务传播实战：REQUIRES_NEW、回滚与 UnexpectedRollbackException"
date = 2026-10-13
draft = false
summary = "从集成测试到事务传播，理解 REQUIRED、REQUIRES_NEW、rollback-only 和 Spring AOP 自调用陷阱。"
tags = ["Java", "Spring Boot", "Transactions", "Testing"]
categories = ["每日复习"]
showComments = true
+++

## 今日核心主题
Spring 声明式事务的传播、提交与回滚。这是一篇**专题补充**，不替代当天已有的 Outbox 学习文章。

## 核心概念
- **Unit Test**：通常隔离单个类，使用 Mockito 模拟依赖。
- **Integration Test**：验证 Repository、Hibernate、JDBC 和数据库协作。H2 真正执行 SQL，但不等同于 PostgreSQL；Testcontainers 可以启动真实 PostgreSQL。
- **测试事务**：Spring Test 管理的 `@Transactional` 测试默认回滚；断言通过不等于数据已提交。
- **REQUIRED**：存在事务则加入，否则新建。
- **REQUIRES_NEW**：挂起外层事务并开启独立事务，内层可先提交。
- **rollback-only**：共享事务被标记必须回滚，捕获异常并不会清除标记。

## 为什么重要
生产环境的订单、支付、审计和 Outbox 流程不能仅凭异常是否被 catch 来推断数据是否提交。独立审计事务还可能需要额外连接，带来连接池容量问题。

## 代码或配置示例

```java
@Service
class OrderService {
  private final AuditService auditService;
  private final OrderRepository orders;
  OrderService(AuditService auditService, OrderRepository orders) {
    this.auditService = auditService; this.orders = orders;
  }
  @Transactional
  public void create() {
    orders.save(new Order());
    auditService.record();
    throw new IllegalStateException("Order failed");
  }
}
@Service
class AuditService {
  private final AuditRepository audits;
  AuditService(AuditRepository audits) { this.audits = audits; }
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void record() { audits.save(new AuditLog()); }
}
```

如果 `record()` 成功提交，之后外层抛出未捕获的运行时异常，**Order 回滚而 AuditLog 保留**。前提是审计记录无需引用尚未提交的订单，且代理与事务管理器配置正确。

## 常见错误
1. 同一类内部调用 `this.record()` 绕过默认 Spring AOP 代理，方法上的 `REQUIRES_NEW` 不生效。
2. 在 `@Transactional` 测试里看到数据就以为生产事务一定能提交。
3. 在 `REQUIRES_NEW` 内引用外层未提交记录，可能发生外键检查失败或锁等待。
4. 认为捕获异常后，事务的 rollback-only 标记会自动清除。

## 面试题
**问题：** 外层 `@Transactional` 调用另一个 Bean 的 `@Transactional(REQUIRED)` 方法。内层抛出 `RuntimeException`，外层 catch 后继续保存 Payment。最后能提交吗？

## Senior-level answer
通常**不能**。内层事务拦截器将共享物理事务标记为 rollback-only；外层捕获异常后继续执行，最终提交时 Spring 会回滚并通常抛出 `UnexpectedRollbackException`。前提是调用经过代理、使用同一事务管理器，且默认回滚规则未被修改。解决方案不是吞掉异常，而是重新设计失败边界：让整个操作失败，或将确实独立的工作放入独立事务，并明确业务一致性要求。

**追问 1：** 为什么 `REQUIRES_NEW` 可能耗尽连接池？因为外层事务占用连接时，内层事务通常还需要另一条连接。

**追问 2：** `@SpringBootTest(RANDOM_PORT)` 的 HTTP 请求会被测试方法事务回滚吗？通常不会；服务器线程有自己的事务边界。

## 系统设计思考
订单失败也必须留下审计记录时，可以选择：A. 同一事务（强一致，但失败时审计也回滚）；B. 独立审计事务（可保留失败事件，但须避免依赖外层未提交数据）。如果需要可靠地向外部系统发送事件，优先考虑 Transactional Outbox，并接受至少一次投递与幂等处理。

## 今日项目实践
在一个**使用 Spring Boot + PostgreSQL 的练习项目**中（不要假设 PromoLocal 当前后端使用 Java），用 Testcontainers 写两个集成测试：① 外层失败但独立 AuditLog 保留；② REQUIRED 内层异常被 catch 后，外层提交出现 `UnexpectedRollbackException`。验收：分别断言数据库记录数与异常类型；测试结束后清理数据。预计 20–30 分钟。

## 自测问题
1. H2 是否真正执行 SQL？**是。**
2. Testcontainers 是数据库吗？**不是，它管理测试容器。**
3. REQUIRED 和 REQUIRES_NEW 最大区别？**共享与独立物理事务。**
4. 捕获异常能否清除 rollback-only？**不能。**
5. 为什么 self-invocation 有风险？**绕过默认代理。**

## 今日总结
**异常被捕获 ≠ 事务可以提交；方法返回成功 ≠ 数据已经持久化。** 最小复习动作：用自己的话解释 `UnexpectedRollbackException`。