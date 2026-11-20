+++
title = "Senior Java / AI: Out-of-Order Events and Session Generations in Multi-Agent Systems"
date = 2026-11-19
draft = false
summary = "Reason about stale events, session epochs, and safe state transitions in an OpenCode watcher."
tags = ["Java", "AI Architecture", "Multi-Agent", "Event Ordering"]
categories = ["Learning"]
showComments = true
+++

## Real-world context

A local multi-agent team uses an OpenCode watcher to observe sessions, messages and tool activity. Hooks can publish idle events. This is an architectural failure mode to test, not a confirmed project defect.

## Core concepts

**Event Ordering:** asynchronous arrival order may differ from logical occurrence order.

**Session Generation / Epoch:** an old session event must never overwrite a newer session's state.

**Monotonic Sequence:** accept only higher sequence numbers within one generation; wall-clock timestamps cannot reliably order multiple processes.

**State Machine:** also validate transitions among working, idle, waiting and compacting.

**Fencing Token:** enforce the generation at an authoritative atomic write boundary when multiple instances consume events.

## Illustrative Java 17 code

~~~java
record Event(long generation, long sequence, String phase) {}
record State(long generation, long sequence, String phase) {}
static State apply(State old, Event next) {
    if (next.generation() < old.generation()) return old;
    if (next.generation() == old.generation() && next.sequence() <= old.sequence()) return old;
    return new State(next.generation(), next.sequence(), next.phase());
}
~~~

This only rejects stale (generation, sequence) pairs. Production code also needs agent/session identity, trusted event origins, valid transitions and atomic persistence. Counters must be issued by a trusted producer.

## Common pitfalls

- A delayed agent:idle overwrites a new working state.
- Date.now() is treated as a cross-process ordering guarantee.
- Deduplication exists only in the UI.
- A restart reuses sequence numbers without advancing the generation.
- A visual idle state is mistaken for proof of process termination.

## Senior interview question (answer first)

Agent A's old session S1 emits idle. New session S2 becomes working, but the watcher delivers S1's idle last. How would you prevent backend/UI state regression across two concurrent server instances?

## 15-minute practical exercise

In an isolated test, replay S1:working → S2:working → S1:idle (late), followed by duplicates, reversed ordering and restarts. Record expected final states without touching production agents.

## Summary and validation limits

Reliable systems reject stale events rather than assuming perfect ordering. This teaching fragment has not been integrated or validated in the real OpenCode watcher.
