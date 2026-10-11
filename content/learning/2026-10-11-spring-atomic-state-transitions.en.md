+++
title = "Spring Conditional Updates and Atomic State Transitions"
date = 2026-10-11
draft = false
summary = "Use conditional database updates to make concurrent state transitions safe, and understand the boundaries of @Transactional, optimistic locking, and idempotency."
tags = ["Java", "Spring Boot", "SQL", "Transactions", "Concurrency", "Idempotency"]
categories = ["Learning"]
showComments = true
+++

## Today's Core Topic

In a Spring Boot backend, `@Transactional` gives a group of database operations a transaction boundary, but it does not automatically stop two different processes, Pods, or concurrent requests from reading the same row in `PENDING` state and both continuing with the business operation.

Today’s pattern is a practical concurrency-control technique: **conditional update + atomic state transition**.

The goal is to let the database decide who successfully claims the work instead of relying on an in-memory JVM lock.

## Core Concepts

Assume `product_scan` has these states:

`PENDING -> FETCHING -> COMPLETED / FAILED`

Avoid a read followed by an unconditional update:

```text
SELECT status FROM product_scan WHERE id = ?;
// status == PENDING
UPDATE product_scan SET status = 'FETCHING' WHERE id = ?;
```

Two requests can read `PENDING` at the same time.

A safer design puts the precondition directly into SQL:

```sql
UPDATE product_scan
SET status = 'FETCHING',
    updated_at = CURRENT_TIMESTAMP
WHERE id = :id
  AND status = 'PENDING';
```

The database atomically performs “check previous state + write next state”. The application then checks the affected-row count:

- `1`: the transition succeeded and processing may continue.
- `0`: the state was already changed, or the row does not exist; this request must not pretend it owns the task.

## Why It Matters

This pattern fits order state, payment flows, background jobs, stock reservations, file processing, crawlers, and message consumers.

The key idea is that **the state transition is a business invariant**.

For example, only `PENDING` may enter `FETCHING`. That rule should be enforced by deterministic software and the database, not by logs, a frontend button, an LLM, a single-process memory lock, or the assumption that concurrent requests are unlikely.

In a multi-instance deployment, `synchronized` or `ReentrantLock` protects only one JVM. A database conditional update coordinates all application instances using that database.

## Code Example

With Spring Data JPA:

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

Service:

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

The REST layer can map that business conflict to `409 Conflict`:

```java
@ExceptionHandler(ScanStateConflictException.class)
ResponseEntity<ApiError> handleConflict(ScanStateConflictException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(new ApiError("SCAN_STATE_CONFLICT", ex.getMessage()));
}
```

One important detail: if an external API call follows the successful state transition, avoid keeping a database transaction open around a long HTTP call. A common pattern is to claim the task in a short transaction, perform the remote work outside that transaction, then persist `COMPLETED` or `FAILED` with another controlled transition.

## Common Pitfalls

1. Assuming `@Transactional` removes concurrency races. A transaction defines a boundary, but multiple transactions may still run concurrently.
2. Reading the state, checking `if (status == PENDING)` in Java, then issuing an unconditional update. That is a classic check-then-act race condition.
3. Continuing with an external side effect after the transition failed, causing duplicate work or duplicate charging.
4. Holding a transaction open during a slow remote call, which increases lock time, connection-pool usage, and recovery complexity.
5. Returning `500` for every failure. When the resource’s current state makes the requested operation invalid, `409 Conflict` is often a better API contract.

## Interview Question

**Question:** Two Spring Boot instances try to move the same row from `PENDING` to `FETCHING` at the same time. Both methods use `@Transactional`. Why can a race still happen, and how would you design the solution?

## Senior-level answer

`@Transactional` defines a transaction boundary; it is not a distributed mutex. Two instances can start separate transactions and observe nearly the same business state.

I would first encode the legal transition in one atomic SQL statement:

```sql
UPDATE ... WHERE id = ? AND status = 'PENDING'
```

The affected-row count becomes the authoritative signal for which caller acquired execution rights. This does not depend on JVM locking and works across instances.

If the domain is better expressed through entity updates, `@Version` optimistic locking is another option; on conflict, catch `OptimisticLockException` and decide whether to retry or return a conflict. Pessimistic locking with `SELECT ... FOR UPDATE` can make sense when a short transaction must inspect and lock more complex state, but throughput and deadlock risk need to be evaluated.

In production I would also consider:

- whether the operation is idempotent;
- whether an external side effect can happen twice;
- retry strategy;
- timeout recovery for tasks stuck in `FETCHING`;
- transition logs, metrics, and traces;
- whether indexes support the `id + status` access pattern;
- whether business conflicts and system failures have distinct error codes.

## System Design Thinking

A reliable state machine must solve not only “who won the update” but also “what happens if the winner crashes afterwards?”

Example:

1. A successfully changes `PENDING -> FETCHING`.
2. A crashes before calling the remote service.
3. The task remains in `FETCHING` forever.

A production design therefore often adds lease/timeout fields such as `claimed_at`, `claimed_by`, or `lease_until`. A recovery job can move stale `FETCHING` work into a retryable state after a threshold.

Responsibilities must also stay explicit: deterministic application code and the database own state, time, permissions, idempotency keys, and critical business rules. If AI/LLM participates, it may handle unstructured extraction, classification, explanation, or drafting, but it must not become the source of truth for whether a payment succeeded, a job already ran, or a transition is legally allowed.

## Project Practice

In your Spring Boot project, implement a `ProductScan` transition API:

```text
POST /api/v1/product-scans/{id}/fetch
```

Requirements:

1. Only `PENDING` may enter `FETCHING`.
2. Use one conditional SQL/JPA update.
3. Return `409 Conflict` when the affected-row count is `0`.
4. Write a concurrency test that sends two requests at the same time and asserts that only one succeeds.
5. Add structured logs containing `scanId`, previous state, target state, and result.
6. Design a timeout recovery mechanism for stale `FETCHING` work.

Bonus: compare conditional update with `@Version` optimistic locking in terms of code complexity, conflict semantics, and suitable use cases.

## Self-check Questions

1. Why can `@Transactional` not stop two different instances from racing on the same row?
2. Why does `UPDATE ... WHERE status = 'PENDING'` remove the check-then-act race condition?
3. Why must business processing stop when the affected-row count is `0`?
4. When would you choose conditional update, optimistic locking, or pessimistic locking?
5. How should the system recover if the application crashes after entering `FETCHING`?

## Takeaway

**Do not treat `@Transactional` as a concurrency lock.** For a simple state machine, put the required previous state in the `WHERE` clause, let the database arbitrate the transition, and use the affected-row count to determine who truly owns the operation. Then complete the design with idempotency, timeout recovery, and observability.