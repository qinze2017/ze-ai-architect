+++
title = "从 H2 到 Testcontainers：如何用真实 PostgreSQL 验证 Spring Boot 集成测试？"
date = 2026-10-15
draft = false
summary = "用 Spring Boot 3、JUnit 5 和 Testcontainers 练习真实数据库集成测试，理解测试事务与生产差异。"
tags = ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Testing"]
categories = ["每日复习"]
showComments = true
+++

## 今日核心主题
**目标（45–60 分钟）：** 从熟悉的 H2 测试出发，学习 Testcontainers 启动真实 PostgreSQL，验证 Spring Data JPA 保存与读取行为。前置知识：JUnit 5、Spring Boot、Repository。

## 核心概念
H2 是真实数据库，确实执行 SQL；它只是**不等于 PostgreSQL 引擎**。Testcontainers 不是数据库，而是通过容器提供一次性 PostgreSQL 测试环境。集成测试验证 Spring、Hibernate、JDBC 和数据库之间的协作，而非只验证 Mockito 模拟结果。

## 为什么重要
生产环境的 `JSONB`、`ON CONFLICT`、行锁、事务隔离与 SQL 方言可能无法通过 H2 测试可靠验证。测试通过也不代表生产环境一定正确。

## 代码或配置示例
以下示例以 **Spring Boot 3.1+、Java 17+、JUnit 5、Docker 可用**为前提；需有 `spring-boot-starter-data-jpa`、PostgreSQL JDBC 驱动、`spring-boot-starter-test`，并使用与 Spring Boot BOM 兼容的 Testcontainers 版本。

```xml
<!-- Spring Boot 3.x + JUnit 5: choose compatible current versions via your BOM -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-testcontainers</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>postgresql</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>junit-jupiter</artifactId>
  <scope>test</scope>
</dependency>
```

```java
@SpringBootTest
@Testcontainers
class DealRepositoryIT {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired DealRepository deals;

    @Test
    void persistsAndReadsDeal() {
        Deal saved = deals.saveAndFlush(new Deal("Milk"));
        assertThat(deals.findById(saved.getId())).isPresent();
    }
}
```

这里 `Deal(String name)`、`DealRepository` 是示意业务类，需要在练习项目中自行定义。若项目没有使用 `@ServiceConnection`，也可以用 `@DynamicPropertySource` 显式配置 datasource URL、用户名和密码。

## 常见错误
1. 把 H2 说成“假 SQL”：H2 真正执行 SQL。
2. 误以为 Testcontainers 自动验证业务逻辑：断言和测试数据仍需要设计。
3. 在测试方法上加 `@Transactional`，却想验证**真实提交之后**的状态：默认回滚可能掩盖问题。
4. 忽略 Flyway/Liquibase 迁移：测试 schema 应尽量与生产一致。
5. 误以为 Docker 容器启动成功就代表 CI 构建成功：必须运行实际测试。

## 面试题
**问题：** 为什么使用 H2 的 Repository 测试全部通过，仍不足以证明 PostgreSQL 生产环境正确？如何设计更可靠的集成测试？

## Senior-level answer
H2 与 PostgreSQL 在 SQL 方言、数据类型、约束、锁和事务行为方面存在差异。应将快速单元测试保留在测试金字塔底部，针对数据库相关风险使用 Testcontainers + PostgreSQL，运行实际 schema 迁移，验证成功路径、约束冲突、回滚及并发。CI 需要提供容器运行环境，并控制容器启动时间和测试数据隔离。

**追问一：** `saveAndFlush()` 是否等于事务提交？**不是**，flush 只是将待执行 SQL 同步到数据库连接，事务仍可回滚。

**追问二：** 如何证明两个请求不能同时领取一条任务？**用独立事务/连接并发执行带状态条件的 UPDATE，断言只有一个影响行数为 1**；不要用同一个测试事务假装并发。

## 系统设计思考
方案 A：只用 H2，反馈快、配置简单，但无法完整验证 PostgreSQL 专属行为。方案 B：所有测试都启动 PostgreSQL，真实性较高，但耗时、资源需求更大。推荐分层：纯业务逻辑用 JUnit/Mockito，Repository 与事务边界用 Testcontainers，少量 API 级测试覆盖端到端路径。对高风险并发操作加入重复运行与明确的数据库状态断言。

## 今日项目实践
在一个独立 **Spring Boot + PostgreSQL 练习项目**中（不要假定 PromoLocal 后端是 Java）：
1. 加入上述测试依赖并确认 Docker 可运行。
2. 定义最小 `Deal` Entity、`DealRepository`。
3. 用 Testcontainers 跑通保存、读取和唯一约束冲突测试。
4. 记录 H2 与 PostgreSQL 测试耗时、SQL 和失败信息。

**验收：** `mvn test` 通过；能指出哪个测试使用真实 PostgreSQL；能解释 `flush` 和 `commit` 区别。预计 20–30 分钟起步。

## 自测问题
1. H2 执行真实 SQL 吗？**是。**
2. Testcontainers 是数据库吗？**不是，是容器测试工具。**
3. `@ServiceConnection` 用于什么？**向 Spring Boot 提供容器连接信息。**
4. `saveAndFlush()` 等于 commit 吗？**不等于。**
5. 测并发为何需要独立事务？**共享同一事务无法真实重现跨连接竞争。**

## 今日总结
**集成测试不是“使用某个工具”，而是验证真实组件的协作。** 今晚最小动作：说清 H2 与 Testcontainers 的区别，并记住 `flush ≠ commit`。