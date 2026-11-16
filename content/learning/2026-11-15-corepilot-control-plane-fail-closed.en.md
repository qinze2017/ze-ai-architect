+++
title = "Senior Java / AI: Fail-Closed Admission and Idempotent Starts in CorePilot"
date = 2026-11-15
draft = false
summary = "A practical control-plane lesson on authorization, guard health, atomic transitions and safe retries."
tags = ["Java", "AI", "CorePilot", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
CorePilot exposes sensitive service and instance controls such as Start, Stop, and Restart. Passing tests or receiving HTTP 200 does not prove a process is safely running. This lesson focuses on **control-plane safety**, rather than the memory-admission and model-residency topics covered earlier.

## Core concepts
**Fail-closed:** reject startup if authorization, guard health, or instance state cannot be established. **Idempotency key:** retrying the same command must not launch twice; store request identity and outcome durably. **State machine:** atomically transition STOPPED to STARTING so competing requests cannot both win. **Observation is not execution:** a read-only status endpoint is not evidence that startup has been validated.

## Python 3.10+ example
This pure function only checks eligibility. It does not start a process and is **not a complete idempotency implementation**.

~~~python
from dataclasses import dataclass

@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str

def admit_start(*, authorized: bool, guard_healthy: bool,
                instance_state: str, request_id: str) -> Decision:
    if not request_id.strip():
        return Decision(False, "MISSING_REQUEST_ID")
    if not authorized:
        return Decision(False, "FORBIDDEN")
    if not guard_healthy:
        return Decision(False, "GUARD_UNAVAILABLE")
    if instance_state != "STOPPED":
        return Decision(False, "INVALID_STATE")
    return Decision(True, "ELIGIBLE_ONLY")

assert not admit_start(authorized=True, guard_healthy=False,
                       instance_state="STOPPED", request_id="r1").allowed
assert admit_start(authorized=True, guard_healthy=True,
                   instance_state="STOPPED", request_id="r1").allowed
~~~

## Common pitfalls
Trusting disabled UI controls as authorization; checking permissions after launch; treating guard timeout as success; keeping idempotency keys only in process memory; equating HTTP 200 with READY; retrying Start without reconciling actual instance state.

## Senior interview question
Two clients with different request IDs attempt to start the same STOPPED instance. Both read STOPPED, then the safety guard becomes unavailable. How do you guarantee at most one start and prevent unknown checks from being bypassed?

## 15-minute exercise
Sketch STOPPED → STARTING → RUNNING, plus FAILED and UNKNOWN. Define tests for denied authorization, guard timeout, duplicate request ID, and competing distinct IDs. Do not run production controls.

## Summary
Safe control planes require server-side authorization, atomic state transitions, durable deduplication, and default-deny behavior under uncertainty.
