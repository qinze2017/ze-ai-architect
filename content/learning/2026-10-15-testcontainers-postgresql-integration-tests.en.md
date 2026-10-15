+++
title = "From H2 to Testcontainers: Testing Spring Boot Against Real PostgreSQL"
date = 2026-10-15
draft = false
summary = "Hands-on Spring Boot 3, JUnit 5 and PostgreSQL integration tests, including transaction testing pitfalls."
tags = ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Testing"]
categories = ["Learning"]
showComments = true
+++

## Today's Core Topic
**Goal (45–60 minutes):** move from familiar H2 tests to a real PostgreSQL instance with Testcontainers and verify Spring Data JPA persistence. Prerequisites: JUnit 5, Spring Boot and repositories.

## Core Concepts
H2 is a real database that executes real SQL, but its engine **is not PostgreSQL**. Testcontainers manages disposable database containers; it is not a database itself. Integration tests verify Spring, Hibernate, JDBC and database behaviour together, not just Mockito stubs.

## Why It Matters
PostgreSQL-specific features such as `JSONB`, `ON CONFLICT`, locking, transaction isolation and SQL dialects may behave differently on H2. Passing H2 tests cannot prove production correctness.

## Code Example
Assumptions: **Spring Boot 3.1+, Java 17+, JUnit 5 and available Docker**. Also include `spring-boot-starter-data-jpa`, the PostgreSQL JDBC driver and `spring-boot-starter-test`; use Testcontainers versions compatible with your Spring Boot BOM.

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

`Deal(String name)` and `DealRepository` are example application classes to define in the practice project. Without `@ServiceConnection`, use `@DynamicPropertySource` to configure JDBC connection properties.

## Common Pitfalls
1. Claiming H2 only simulates SQL: it genuinely executes SQL.
2. Assuming Testcontainers automatically checks business rules: assertions are still needed.
3. Using a default-rollback `@Transactional` test to prove post-commit behaviour.
4. Skipping the Flyway/Liquibase migrations used in production.
5. Treating a started container as evidence that CI tests passed.

## Interview Question
**Question:** Why do passing H2 repository tests not guarantee PostgreSQL production correctness? What would you change?

## Senior-level answer
H2 and PostgreSQL differ in SQL dialect, types, constraints, locks and transaction semantics. Keep fast unit tests for pure logic, but run database-sensitive tests against Testcontainers PostgreSQL with real schema migrations, assertions for constraints and rollback, and separate transactions for concurrency. Account for container support in CI, startup time and data isolation.

**Follow-up 1:** Is `saveAndFlush()` a commit? **No.** Flush sends pending SQL to the database but the transaction can still roll back.

**Follow-up 2:** How would you test competing task claims? **Use separate transactions/connections with a conditional UPDATE and assert that only one claimant updates a row.**

## System Design Thinking
Option A: H2-only tests are fast but may miss PostgreSQL behaviour. Option B: PostgreSQL for every test is more realistic but more resource-intensive. Prefer a layered strategy: JUnit/Mockito for pure logic, Testcontainers for repository and transaction boundaries, and a few end-to-end API tests. For concurrency, use independent transactions and explicit database-state assertions.

## Project Practice
In a **Spring Boot + PostgreSQL practice project** (do not assume PromoLocal's backend is Java):
1. Add the test dependencies and confirm Docker works.
2. Define a minimal `Deal` entity and `DealRepository`.
3. Test persistence, retrieval and a unique-constraint violation with Testcontainers.
4. Record timings, SQL and observed failures compared with H2.

**Acceptance:** `mvn test` passes; identify which test runs against real PostgreSQL and explain `flush` versus `commit`. Allow at least 20–30 minutes.

## Self-check Questions
1. Does H2 execute real SQL? **Yes.**
2. Is Testcontainers a database? **No, a container testing tool.**
3. What does `@ServiceConnection` do? **Supplies connection details to Spring Boot.**
4. Does `saveAndFlush()` commit? **No.**
5. Why use separate transactions for concurrency? **To reproduce competition across connections.**

## Takeaway
**Integration testing is about real component collaboration, not a specific tool.** Minimum review: explain H2 versus Testcontainers and `flush ≠ commit`.