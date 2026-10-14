+++
title = "Spring Boot Transaction Propagation: REQUIRES_NEW, Rollback and UnexpectedRollbackException"
date = 2026-10-13
draft = false
summary = "Review integration testing, REQUIRED, REQUIRES_NEW, rollback-only and Spring proxy self-invocation pitfalls."
tags = ["Java", "Spring Boot", "Transactions", "Testing"]
categories = ["Learning"]
showComments = true
+++

## Today's Core Topic
Spring declarative transaction propagation, commit and rollback. This is a **supplementary topic**, not a replacement for today's existing Outbox articles.

## Core Concepts
- **Unit test**: typically isolates a class and mocks dependencies with Mockito.
- **Integration test**: verifies Repository, Hibernate, JDBC and the database working together. H2 executes real SQL but is not equivalent to PostgreSQL; Testcontainers can launch real PostgreSQL.
- **Test transaction**: Spring Test-managed `@Transactional` tests roll back by default even when assertions pass.
- **REQUIRED**: joins an existing transaction or creates one.
- **REQUIRES_NEW**: suspends the outer transaction and starts an independent physical transaction.
- **rollback-only**: catching an exception does not clear a shared transaction's rollback-only marker.

## Why It Matters
Order, payment, audit and Outbox workflows depend on precise transaction boundaries. An independent audit transaction may also require another database connection, affecting pool capacity.

## Code Example

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

If `record()` commits successfully and the outer method then throws an uncaught runtime exception, **Order rolls back while AuditLog remains committed**. This assumes the audit record does not depend on an uncommitted order and that proxies and transaction managers are configured correctly.

## Common Pitfalls
1. Calling `this.record()` inside the same class bypasses Spring's default AOP proxy, so `REQUIRES_NEW` does not apply.
2. Seeing data inside a `@Transactional` test does not prove it was committed.
3. An independent audit transaction referencing an uncommitted order may hit foreign-key constraints or lock waits.
4. Catching an exception does not reset rollback-only.

## Interview Question
**Question:** An outer `@Transactional` method invokes another bean's `@Transactional(REQUIRED)` method. The inner method throws `RuntimeException`; the outer method catches it and saves a Payment. Can the transaction commit?

## Senior-level answer
**Normally no.** The inner transactional interceptor marks the shared physical transaction rollback-only. When the outer method attempts to commit, Spring rolls it back and normally throws `UnexpectedRollbackException`. This assumes proxy interception, the same transaction manager and default rollback rules. Fix the business failure boundary instead of simply swallowing the exception.

**Follow-up 1:** Why can `REQUIRES_NEW` exhaust a connection pool? The outer transaction may hold its connection while the inner transaction requests another.

**Follow-up 2:** Does a test transaction roll back HTTP requests in `@SpringBootTest(RANDOM_PORT)`? Usually not: the server thread has its own transaction boundary.

## System Design Thinking
To retain an audit when an order fails, compare A. a shared transaction (strong atomicity but audit rolls back) with B. an independent audit transaction (audit survives, but must not rely on uncommitted order data). For reliable external event delivery, consider Transactional Outbox, at-least-once delivery and idempotency.

## Project Practice
In a **Spring Boot + PostgreSQL practice project** (do not assume PromoLocal's backend uses Java), write two Testcontainers integration tests: ① outer failure with AuditLog retained; ② caught inner REQUIRED exception followed by `UnexpectedRollbackException` at outer commit. Assert both database state and exception type, and clean up test data. Allow 20–30 minutes.

## Self-check Questions
1. Does H2 execute real SQL? **Yes.**
2. Is Testcontainers a database? **No, it manages containers.**
3. REQUIRED versus REQUIRES_NEW? **Shared versus independent physical transaction.**
4. Does catch clear rollback-only? **No.**
5. Why is self-invocation risky? **It bypasses the default proxy.**

## Takeaway
**Caught exception ≠ committable transaction; normal method return ≠ persisted data.** Minimum review: explain `UnexpectedRollbackException` in your own words.