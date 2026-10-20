+++
title = "Senior Java: MVCC, NOWAIT, and SKIP LOCKED"
date = 2026-10-19
draft = false
summary = "Understand PostgreSQL row locks, READ COMMITTED snapshots, and nonblocking lock acquisition."
tags = ["Java", "PostgreSQL", "MVCC", "Transactions", "Locking"]
categories = ["Learning"]
showComments = true
+++

## Core Concept

**MVCC** stands for *Multi-Version Concurrency Control*. It controls data **visibility**, while row-level locks control **conflicts** between concurrent operations. Under PostgreSQL's `READ COMMITTED` isolation level, a plain `SELECT` uses a statement-level snapshot to read visible committed versions. It normally does not wait for another transaction's uncommitted update. A `SELECT ... FOR UPDATE`, however, must acquire a row lock and can wait for an incompatible lock.

| Row-lock mode | Effect on `UPDATE status` (a non-key column) |
| --- | --- |
| `FOR KEY SHARE` | Usually compatible; protects the key and row's existence |
| `FOR SHARE` | Blocks concurrent updates of that row |
| `FOR NO KEY UPDATE` | Normally acquired by updates that do not change key columns |
| `FOR UPDATE` | Strongest; conflicts with all four row-lock modes |

With PostgreSQL and Hibernate, `PESSIMISTIC_READ` commonly maps to `FOR SHARE`, **not** `FOR KEY SHARE`. Verify the SQL emitted by the actual JPA provider and dialect.

## SQL Example: Two Sessions (Test Database Only)

```sql
CREATE TABLE orders (id bigint PRIMARY KEY, status text NOT NULL);
INSERT INTO orders VALUES (2001, 'PENDING'), (2002, 'PENDING');
```

Session A:

```sql
BEGIN;
UPDATE orders SET status = 'PAID' WHERE id = 2001;
-- Keep the transaction open.
```

Session B:

```sql
SELECT status FROM orders WHERE id = 2001;
-- Under READ COMMITTED: normally PENDING.

BEGIN;
SELECT id FROM orders WHERE id = 2001 FOR UPDATE NOWAIT;
-- Incompatible lock: immediate error, typically SQLSTATE 55P03.
ROLLBACK;

BEGIN;
SELECT id FROM orders
WHERE id IN (2001, 2002)
ORDER BY id
FOR UPDATE SKIP LOCKED;
-- In this example: skip 2001; lock and return 2002.
ROLLBACK;
```

Finish session A with `COMMIT;`. `NOWAIT` reports an error when a **row lock** cannot be obtained immediately. `SKIP LOCKED` omits locked candidate rows; **omitted does not mean nonexistent**. It is useful for multi-consumer job queues, not general-purpose pagination. Both options still acquire table-level locks under the usual rules.

## Spring Boot Connection

`@Transactional` establishes a transaction boundary; it does not turn a normal query into a locking query. `PESSIMISTIC_WRITE` generally maps to `FOR UPDATE` on PostgreSQL. For explicit `NOWAIT` semantics, use native SQL verified for the database. Spring JDBC method fragment (assumes an injected `jdbcTemplate`):

```java
@Transactional
public String lockOrderNowait(long orderId) {
    return jdbcTemplate.queryForObject(
        "SELECT status FROM orders WHERE id = ? FOR UPDATE NOWAIT",
        String.class, orderId);
}
```

Handle a lock-conflict exception **outside the failed transaction boundary**. After an SQL error, an explicit PostgreSQL transaction generally needs a rollback before further statements can execute.

## Common Pitfalls

1. Treating a plain MVCC read as equivalent to `SELECT FOR UPDATE`.
2. Assuming `NOWAIT` reads the old version instead of reporting a lock conflict.
3. Treating an empty `SKIP LOCKED` result as proof that a queue is empty.
4. Missing that `READ COMMITTED` can recheck a `WHERE` condition after a lock wait.
5. Assuming `PESSIMISTIC_READ` maps identically across JPA dialects.
6. Forgetting `ROLLBACK` after an error inside an explicit transaction.

## Senior Interview Question — Answer First

Order 2001 initially has status `PENDING`. T1 executes `BEGIN; UPDATE orders SET status = 'PAID' WHERE id = 2001;` and leaves the transaction open. T2, under `READ COMMITTED`, executes:

```sql
SELECT status FROM orders
WHERE id = 2001 AND status = 'PENDING'
FOR UPDATE;
```

Does T2 wait? If T1 then commits, does T2 return `PAID`, `PENDING`, or **zero rows**? Explain the interaction between the snapshot, row lock, and `WHERE` predicate.

## 15-Minute Practice

Reproduce the two-session example in a disposable test database and compare a plain `SELECT` with `FOR UPDATE NOWAIT` and `FOR UPDATE SKIP LOCKED`. Then explain why claiming a job and changing its state should occur in the same transaction in a job queue.

## Summary

**MVCC controls visibility; row-level locks control conflicting operations.** `NOWAIT` fails fast; `SKIP LOCKED` skips busy rows. Choosing correctly requires understanding the business workflow.

References: [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html) · [Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · [Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).
