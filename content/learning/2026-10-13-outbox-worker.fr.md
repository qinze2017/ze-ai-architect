---
title: "Jour 13 : Worker Transactional Outbox, SKIP LOCKED et Testcontainers"
date: 2026-10-13T20:30:00-04:00
draft: false
slug: "day-13-outbox-worker-testcontainers"
tags: ["Java", "Spring Boot", "PostgreSQL", "Testcontainers", "Architecture"]
---

**Bonne réponse : B.** Récupérer les baux expirés et réessayer, avec une stratégie d'idempotence. Une livraison au moins une fois n'est pas une livraison exactement une fois.

## Architecture

Deal approval and an outbox event are persisted in **one PostgreSQL transaction**. A scheduled worker claims events with `FOR UPDATE SKIP LOCKED`, commits the claim, calls the email provider, then records the result in a separate short transaction.

```sql
ALTER TABLE outbox_events ADD COLUMN claim_token UUID;

WITH picked AS (
 SELECT id FROM outbox_events
 WHERE (status = 'PENDING' AND next_attempt_at <= now())
    OR (status = 'PROCESSING' AND claimed_until < now())
 ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events e
SET status = 'PROCESSING',
    claim_token = gen_random_uuid(),
    claimed_until = now() + interval '2 minutes',
    attempts = attempts + 1
FROM picked WHERE e.id = picked.id
RETURNING e.*;
```

```java
@Component
@RequiredArgsConstructor
public class OutboxWorker {
    private final OutboxStore store;
    private final EmailGateway gateway;

    @Scheduled(fixedDelayString = "${outbox.poll-ms:5000}")
    public void process() {
        for (ClaimedEvent e : store.claimBatch(20)) {
            try {
                gateway.sendDealApproved(e.aggregateId(), e.id().toString());
                store.markSent(e.id(), e.claimToken());
            } catch (Exception ex) {
                store.scheduleRetry(e.id(), e.claimToken(), ex.getMessage());
            }
        }
    }
}
```

A successful completion must check both `id` and `claim_token`:

```sql
UPDATE outbox_events
SET status='SENT', processed_at=now(),
    claimed_until=NULL, claim_token=NULL
WHERE id=:id AND claim_token=:token AND status='PROCESSING';
```

## Testcontainers exercises

- Two workers claiming the same batch must not both own the same event.
- Email failure schedules a retry with exponential backoff.
- Expired leases are reclaimable.
- A stale claim token cannot mark a re-claimed event as sent.
- Exceeding the retry budget moves the event to FAILED.
- Rolling back deal approval also rolls back the outbox insert.

**Reliability boundary:** Transactional Outbox gives atomic business-event persistence and typically *at-least-once* delivery, not exactly-once email delivery. A provider-supported idempotency key based on the stable event UUID is preferred. The email request timeout should be shorter than the lease, or the lease should be renewed. Use a dead-letter/FAILED state and alerting for permanent errors.

> The Java snippet is an architecture skeleton: `OutboxStore`, `EmailGateway`, and the record types are interfaces to implement and test; it is not a copy-paste runnable project.
