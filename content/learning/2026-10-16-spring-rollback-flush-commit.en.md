+++
title = "Spring Boot Rollback Testing: save, flush, commit and PostgreSQL"
date = 2026-10-16
draft = false
summary = "Use Testcontainers to verify rollback after flush against real PostgreSQL."
tags = ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Transactions"]
categories = ["Learning"]
showComments = true
+++

## Today's Core Topic

Building on the October 15 Testcontainers lesson, understand save, flush and commit, and verify service rollback with real PostgreSQL. Target: 45–60 minutes.

## Core Concepts

- **save()** makes an entity persistent; INSERT timing depends on identifier strategy and other factors.
- **flush()** synchronizes pending SQL with the database **without committing**.
- **commit()** commits the transaction; prior changes can still be rolled back.
- Spring defaults to rollback for uncaught RuntimeException and Error; checked exceptions often need rollbackFor.
- Spring Test-managed @Transactional tests roll back by default and may hide real service commit behaviour.

## Why It Matters

Orders, payments and price submissions need correct transaction boundaries. SQL execution does not prove that data was committed. Assert both the exception and the final database state.

## Code Example

Assume Spring Boot 3.1+, Java 17+, JUnit 5, AssertJ, Spring Data JPA, PostgreSQL JDBC, Testcontainers and Docker. Define Deal and DealRepository in the practice project.

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

The test **deliberately omits @Transactional**, checking the database after the service transaction has rolled back. Isolate data when tests run concurrently.

## Common Pitfalls

1. Treating flush as commit.
2. Asserting only an exception without inspecting final database state.
3. Confusing test-framework rollback with service rollback.
4. Forgetting self-invocation can bypass the Spring AOP proxy.
5. Assuming database rollback can undo external emails.

## Interview Question

A transactionally proxied service throws RuntimeException after saveAndFlush. Is the row retained? A. Yes, SQL ran; B. No, rollback; C. Depends on H2.

**Answer B.** Flush is not commit.

## Senior-level answer

Flush synchronizes the persistence context with the database without committing the physical transaction. When RuntimeException escapes to Spring's transaction interceptor, Spring normally rolls back the transaction, undoing the INSERT. With IDENTITY generation, save() might execute INSERT earlier, but that still is not a commit. REQUIRES_NEW, bypassed proxies or custom rollback rules can change the outcome.

**Follow-up:** Why omit @Transactional on the test? To observe the final state after the service transaction, rather than relying on test-managed rollback.

## System Design Thinking

Database transactions cannot undo external side effects such as already-sent email. For cross-system events, consider Transactional Outbox, retries and idempotency.

## Project Practice

① Run rollbackAfterFlush; ② add a successful commit test; ③ try a checked exception and rollbackFor. Acceptance: mvn test passes, final database state is checked, and flush versus commit can be explained. Start with 20–30 minutes.

## Self-check Questions

1. Is flush commit? **No.**
2. Does save() always defer INSERT? **No.**
3. Default rollback exceptions? **RuntimeException and Error.**
4. Why omit @Transactional on the test? **To observe service transaction state.**
5. Does rollback unsend email? **No.**

## Takeaway

**Executed SQL ≠ committed data.** Before bed, review one concept, answer one interview question or spend 15 minutes on the project.
