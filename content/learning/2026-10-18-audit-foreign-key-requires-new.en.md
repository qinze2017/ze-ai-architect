+++
title = "Senior Java: REQUIRES_NEW and Audit Foreign Keys"
date = 2026-10-18
draft = false
summary = "Uncommitted PostgreSQL orders, foreign keys, and failure-audit design."
tags = ["Java", "Spring Boot", "PostgreSQL", "Transactions", "Audit"]
categories = ["Learning"]
showComments = true
+++

## Today's Core Concept

An outer transaction **T1** creates an order. A separate Spring bean opens **T2** with `REQUIRES_NEW` and writes an audit row referencing that order. T2 has its own physical transaction, but cannot bypass PostgreSQL's foreign-key constraints.

At the default `READ COMMITTED` isolation level, T2 cannot see T1's uncommitted order. A foreign-key check may wait for T1 to finish, while T1 is synchronously waiting for T2 to return. This creates an **application-level wait cycle** that PostgreSQL may not recognize as a database deadlock. Use bounded timeouts. `flush()` does not mean `COMMIT`.

If the parent order was **already committed**, T2 may reference it, assuming no conflicting locks or other errors. A `DEFERRABLE` constraint delays validation but cannot make a nonexistent parent valid.

## PostgreSQL Experiment (test database only)

```sql
CREATE TABLE orders(id bigint PRIMARY KEY);
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES orders(id)
);
```

Session A:

```sql
BEGIN;
INSERT INTO orders VALUES (1001);
-- Keep T1 open.
```

Session B:

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
INSERT INTO audit_log(order_id) VALUES (1001);
-- Observe the wait or timeout; then ROLLBACK.
```

Finally, roll back session A. Exact wait and error details depend on timing and constraint configuration.

## Designing an Independent Failure Audit

If an order attempt must remain auditable after its order transaction rolls back, use a standalone UUID `attempt_id` rather than a mandatory foreign key to the uncommitted order.

```sql
CREATE TABLE order_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id uuid NOT NULL,
  status text NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Illustrative Java (repository and constructor omitted):

```java
// A separate Spring bean, called through the transaction proxy
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void recordFailure(UUID attemptId, String code) {
    auditRepository.save(new OrderAudit(attemptId, "FAILED", code));
}
```

A **non-transactional orchestrator** calls the transactional order service and, on failure, invokes this audit service. The audit can commit independently, but `REQUIRES_NEW` cannot guarantee storage during a database outage. For strict durability, design a previously persisted attempt, durable recovery, retries, monitoring, and idempotency. Transactional Outbox is appropriate for events tied to **committed** transactions; it does not automatically retain data from a rolled-back transaction.

## Common Pitfalls

1. Assuming independent transactions can read each other's uncommitted data.
2. Confusing `flush` with `commit`.
3. Assuming PostgreSQL always detects an application-level wait cycle as a database deadlock.
4. Using self-invocation and bypassing the Spring transaction proxy.
5. Ignoring extra connection-pool capacity, timeouts, and final database-state assertions.
6. Logging unnecessary sensitive data in an audit record.

## Senior Interview Question — Answer Before Looking It Up

Order **2001 was committed earlier**. T1 updates its status. T2 (`REQUIRES_NEW`) inserts an audit row with a foreign key referencing that order. T1 later throws a `RuntimeException`.

**Can T2 commit? What are the final order and audit states? Which concurrent locks or other errors might change the result?**

## 15-Minute Practice

1. Run the two-session SQL experiment with a short `lock_timeout`.
2. Replace the mandatory `order_id` foreign key with `attempt_id` and verify that the audit survives T1 rollback.
3. Plan three integration tests: outer rollback with surviving audit; foreign-key wait for an uncommitted parent; audit for an already committed parent. Avoid `@Transactional` on the test method itself.

## Summary

`REQUIRES_NEW` separates commit boundaries; it does not bypass isolation or foreign-key rules. Failure audits need an independent attempt identity and a recovery strategy.

References: [Spring transaction propagation](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html) · [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
