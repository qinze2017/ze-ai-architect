+++
title = "Database Transactions Explained: ACID, Commit, Rollback and Spring Propagation"
date = 2026-10-16
draft = false
summary = "Learn transaction fundamentals and how REQUIRED differs from REQUIRES_NEW in Spring Boot and PostgreSQL."
tags = ["Java", "Spring Boot", "Transactions", "PostgreSQL", "ACID"]
categories = ["Learning"]
showComments = true
+++

## Today's Core Topic

**Goal (20–30 minutes):** explain database transactions, `COMMIT`, `ROLLBACK`, ACID, and Spring's `REQUIRED` versus `REQUIRES_NEW`. A fundamentals companion to today's rollback testing lesson.

## Core Concepts

A transaction is a logical unit of work managed by the database. It is not a Java method and need not be a single SQL statement. `BEGIN` starts a transaction, `COMMIT` makes its changes committed, and `ROLLBACK` undoes its uncommitted changes.

Spring's `@Transactional` normally manages the transaction at an AOP proxy boundary. By default, uncaught `RuntimeException` and `Error` cause rollback, while checked exceptions do not unless rules such as `rollbackFor` are configured.

## Why It Matters

A $100 transfer debits account A and credits account B. If the credit fails, the debit must be undone. One database transaction provides atomicity for both steps, but balance checks, concurrency control and idempotency still require sound application design.

## ACID

| Property | Meaning |
|---|---|
| Atomicity | Changes commit or roll back as one unit |
| Consistency | Constraints and invariants remain valid |
| Isolation | Concurrent transactions have controlled visibility |
| Durability | Committed changes survive recoverable failures |

## Code Example

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

This is illustrative code: real repositories, validation and a transactional database are required. Calling a transactional method directly inside the same bean may bypass Spring's default AOP proxy.

## REQUIRED vs REQUIRES_NEW

| Situation | REQUIRED | REQUIRES_NEW |
|---|---|---|
| No outer transaction | Starts one | Starts one |
| Outer transaction exists | Joins it | Suspends it and starts an independent physical transaction |
| Independent commit | No, when participating | Yes |
| Inner failure | May mark shared transaction rollback-only | Does not automatically roll back outer transaction |
| Connections | Typically shares transaction connection | Typically needs an additional connection while outer holds its own |

An exception from `REQUIRES_NEW` can still cause the outer transaction to roll back if it propagates outward. If a participating `REQUIRED` scope has marked the shared transaction rollback-only, catching the exception does not clear the marker: the outer commit may throw `UnexpectedRollbackException`.

## PostgreSQL Isolation

PostgreSQL defaults to `READ COMMITTED`. An ordinary SELECT cannot see another transaction's uncommitted INSERT. `saveAndFlush()` may execute SQL without committing. Thus an independent `REQUIRES_NEW` transaction normally cannot read the outer transaction's uncommitted order.

## Common Pitfalls

1. Treating flush as commit.
2. Assuming catch clears rollback-only.
3. Referencing uncommitted parent rows through foreign keys.
4. Ignoring additional connection pool demand from `REQUIRES_NEW`.
5. Overlooking Spring proxy-based self-invocation.

## Interview Question

Outer transaction A saves an order. Independent `REQUIRES_NEW` transaction B saves an audit record and commits. A then throws an uncaught `RuntimeException`. Assume no other errors:

**A.** Both roll back; **B.** A rolls back and B stays committed; **C.** Both commit.

**Answer: B.** The physical transactions are independent.

## Senior-level answer

`REQUIRED` participates in an existing transaction; `REQUIRES_NEW` suspends it and starts a separate physical transaction. Choosing between them requires evaluating business consistency, foreign keys, exception propagation, connection pool sizing and retry/idempotency.

## System Design Thinking

Order creation and inventory reservation generally belong in a shared transaction when they must succeed atomically. Independent failure auditing may use `REQUIRES_NEW`, but should avoid requiring a foreign key to an uncommitted order. External services and message delivery need additional patterns such as Transactional Outbox.

## Project Practice

1. Create two PostgreSQL accounts and a `@Transactional` transfer service.
2. Throw `RuntimeException` after debiting and verify both balances are restored.
3. Add a separate bean's `REQUIRES_NEW` audit and verify it survives outer rollback.

**Acceptance:** explain transactions, commit, rollback and propagation clearly.

## Self-check Questions

1. Is a transaction one SQL statement? **Not necessarily.**
2. What does COMMIT do? **Commits changes.**
3. Does REQUIRED join an existing transaction? **Yes.**
4. Does REQUIRES_NEW create an independent transaction? **Yes.**
5. Can READ COMMITTED see other transactions' uncommitted rows? **Not with an ordinary SELECT.**

## Takeaway

**A transaction is a commit-and-rollback boundary.** Minimum bedtime review: explain `BEGIN → COMMIT / ROLLBACK` and the difference between REQUIRED and REQUIRES_NEW.
