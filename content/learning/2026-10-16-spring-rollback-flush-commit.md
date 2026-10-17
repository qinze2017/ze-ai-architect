+++
title = "Spring Boot 事务回滚测试：save、flush、commit 与 PostgreSQL"
date = 2026-10-16
draft = false
summary = "用 Testcontainers 验证 flush 不等于 commit，并练习事务回滚集成测试。"
tags = ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Transactions"]
categories = ["每日复习"]
showComments = true
+++

## 今日核心主题

在 10 月 15 日 Testcontainers 基础上，深入理解 JPA 的 save、flush 和事务 commit，并用真实 PostgreSQL 验证回滚。建议学习 45–60 分钟。

## 核心概念

- **save()**：使实体进入持久化管理；INSERT 的具体时机与主键生成策略等有关，不一定延迟到 flush。
- **flush()**：同步待执行的 SQL 到数据库，但**不等于 commit**。
- **commit()**：提交事务；此前修改仍可回滚。
- Spring 默认对未捕获的 RuntimeException 和 Error 回滚；受检异常通常需要 rollbackFor 配置。
- 测试类上加 @Transactional 会让 Spring Test 默认回滚测试事务，可能掩盖服务真实提交行为。

## 为什么重要

订单、支付、价格发布都依赖正确的事务边界。SQL 已执行并不代表数据最终保留。必须同时断言异常与事务结束后的数据库状态。

## 代码或配置示例

假设 Spring Boot 3.1+、Java 17+、JUnit 5、AssertJ、Spring Data JPA、PostgreSQL JDBC、Testcontainers、Docker 已配置。Deal Entity 与 DealRepository 需要自行定义。

```java
@Service class DealService {
  private final DealRepository repo;
  DealService(DealRepository repo) { this.repo = repo; }
  @Transactional public void createThenFail() {
    repo.saveAndFlush(new Deal("Milk"));
    throw new IllegalStateException("failed");
  }
}
@SpringBootTest @Testcontainers
class DealRollbackIT {
  @Container @ServiceConnection
  static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16-alpine");
  @Autowired DealService service;
  @Autowired DealRepository repo;
  // No @Transactional on test: observe service transaction after rollback.
  @Test void rollbackAfterFlush() {
    long before = repo.count();
    assertThatThrownBy(() -> service.createThenFail())
        .isInstanceOf(IllegalStateException.class);
    assertThat(repo.count()).isEqualTo(before);
  }
}
```

测试方法**故意不使用 @Transactional**，让服务层事务自行开始、回滚并结束，然后查询最终数据库状态。并行测试还需隔离测试数据。

## 常见错误

1. 把 flush 误认为 commit。
2. 只断言异常，不检查最终数据库状态。
3. 用测试自身的默认回滚代替验证服务层回滚。
4. 忽略 Spring AOP 自调用可能绕过事务代理。
5. 以为数据库回滚可以撤销邮件或外部 API 调用。

## 面试题

一个被事务代理拦截的 Service 在 saveAndFlush 后抛出 RuntimeException，记录是否保留？A. 保留，因为 SQL 已执行；B. 不保留，因为事务回滚；C. 取决于 H2。

**答案 B。** flush 不等于 commit。

## Senior-level answer

flush 将持久化上下文同步到数据库，但不会提交物理事务。Spring 事务拦截器捕获到向外传播的 RuntimeException，默认回滚事务，撤销该事务的 INSERT。注意 save() 在 IDENTITY 主键策略下可能提前执行 INSERT；即便如此，仍可回滚。若使用 REQUIRES_NEW、绕过代理或自定义回滚规则，结果可能不同。

**追问：** 为什么不在测试方法上加 @Transactional？因为我们要验证服务事务结束后的真实状态，而不是依赖测试框架的回滚。

## 系统设计思考

数据库事务只能保护同一数据库内的操作，无法撤销已经发送的邮件。跨系统可靠通知可以采用 Transactional Outbox、重试和幂等机制。

## 今日项目实践

① 跑通 rollbackAfterFlush；② 添加成功保存并提交的测试；③ 改用受检异常，观察默认回滚行为并尝试 rollbackFor。验收：mvn test 通过，能解释 flush 和 commit 的区别，测试检查最终数据库状态。预计先做 20–30 分钟。

## 自测问题

1. flush 等于 commit 吗？**否。**
2. save 一定不立即执行 INSERT 吗？**否。**
3. 默认哪些异常触发回滚？**RuntimeException 与 Error。**
4. 为什么测试不加 @Transactional？**验证服务事务结束后的状态。**
5. 数据库回滚能撤销邮件吗？**不能。**

## 今日总结

**SQL 已执行 ≠ 数据已提交。** 睡前至少回顾一个知识点、回答一道面试题，或推进 15 分钟项目。
