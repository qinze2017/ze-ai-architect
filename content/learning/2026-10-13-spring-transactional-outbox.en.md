---
title: "Java/AI Day 13: Spring Boot, PostgreSQL and Transactional Outbox"
date: 2026-10-13
draft: false
description: "Concurrent approvals, atomic state changes, Outbox workers, idempotency and Testcontainers."
tags: ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Outbox"]
---

# Day 13 — Reliable deal approvals and event delivery

**B is correct:** persist the approval and the Outbox event in **the same database transaction**, then let a background Worker deliver notifications. The pattern guarantees atomic persistence, **not exactly-once delivery**: retries may duplicate external side effects.

## Core design / 核心设计

A deal approval and its notification event must be committed in **one PostgreSQL transaction**. The notification is delivered asynchronously and may be delivered more than once; use idempotency where supported.

```sql
CREATE TABLE outbox_events (
 id UUID PRIMARY KEY,
 aggregate_id BIGINT NOT NULL,
 event_type VARCHAR(80) NOT NULL,
 payload JSONB NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
 attempts INT NOT NULL DEFAULT 0,
 next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 claimed_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON outbox_events(next_attempt_at,created_at)
WHERE status='PENDING';
```

```java
@Transactional
public boolean approve(long dealId) {
  int updated = dealRepository.approveIfPending(dealId);
  if (updated == 0) return false;
  outboxRepository.save(OutboxEvent.dealApproved(dealId, UUID.randomUUID()));
  return true;
}
```

The repository must implement an atomic conditional update: `UPDATE deals SET status='APPROVED' WHERE id=:id AND status='PENDING_REVIEW'`. An update count of 1 means success; 0 means no transition.

## Safe worker claiming

```sql
WITH picked AS (
 SELECT id FROM outbox_events
 WHERE status='PENDING' AND next_attempt_at<=now()
 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events e
SET status='PROCESSING', attempts=attempts+1,
    claimed_until=now()+interval '2 minutes'
FROM picked WHERE e.id=picked.id
RETURNING e.*;
```

Commit this short claim transaction **before** calling the email provider. On success mark SENT; on failure reschedule with backoff. Recover expired leases and guard completion with a lease token. A provider idempotency key based on the event UUID helps avoid duplicate side effects, if supported.

## Testcontainers exercise

Use Spring Boot integration tests with `@Testcontainers`, `@Container` and `@ServiceConnection` for `PostgreSQLContainer<>("postgres:16-alpine")`.

1. First approval succeeds; second returns false; exactly one Outbox event exists.
2. Two concurrent approvals produce exactly one successful transition and one event.
3. Force the Outbox insert to fail and verify the Deal update rolls back.
4. Simulate Worker crash after sending and before marking SENT; verify retry behavior and idempotency strategy.

Do not wrap the whole concurrency test in a test-level `@Transactional`: other threads may not see uncommitted fixtures.

**Interview takeaway:** database atomicity, business-event consistency, and external side-effect idempotency are three different guarantees.


## Next practice

Implement Worker retries, expired-lease recovery, dead-letter handling and PostgreSQL-backed concurrency tests with Testcontainers.
