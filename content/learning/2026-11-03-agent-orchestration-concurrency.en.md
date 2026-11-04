+++
title = "Senior Java / AI: Multi-Agent Orchestration, Concurrency and Safe Publication"
date = 2026-11-03
draft = false
summary = "A practical lesson on task isolation, deadlines, idempotency and human approval gates."
tags = ["Java", "AI", "Agents", "Concurrency", "Orchestration", "Idempotency"]
categories = ["Learning"]
showComments = true
+++

## Today's learning context
Today we discussed so-called super-agent architectures and how they differ from a single-session ReAct loop. A blog post's project name or open-source claim is not, by itself, verified official evidence. This lesson focuses on reusable engineering principles.

## Core concepts
An **orchestrator** dispatches independent tasks to workers. Each task needs its own ID, context, permissions, budget and deadline. Parallel execution must not imply sharing mutable conversation state.

In PromoLocal, image recognition, price checking and draft writing may run concurrently. **Publishing still requires trusted approval.** Results can arrive out of order: stale versions must not overwrite current results. Cancelling a Java `Future` does not necessarily stop a remote model request; enforce deadlines, idempotency and write-side fencing.

## Java 17 example (teaching excerpt)
This excerpt assumes `tasks` and `process` exist. It demonstrates Java 17 APIs but **is not a standalone compilable program**.
~~~java
record Task(String id, String input) {}
record Outcome(String id, String value) {}

ExecutorService pool = Executors.newFixedThreadPool(3);
try {
    List<Callable<Outcome>> work = tasks.stream()
        .<Callable<Outcome>>map(task -> () ->
            new Outcome(task.id(), process(task.input())))
        .toList();
    List<Future<Outcome>> futures = pool.invokeAll(work, 30, TimeUnit.SECONDS);
    for (Future<Outcome> future : futures) {
        if (future.isCancelled()) { /* record timeout; do not publish */ continue; }
        try {
            Outcome result = future.get();
            // Validate ownership/version and persist idempotently before publishing.
        } catch (ExecutionException ex) {
            // Record failure; retry only if safe and within a bounded policy.
        }
    }
} finally {
    pool.shutdownNow();
}
~~~

## Common pitfalls
- Sharing mutable context across agents.
- Limiting threads but not tokens, retries or API spending.
- Assuming `Future.cancel()` stops a remote request.
- Retrying indefinitely without idempotency keys.
- Treating an AI suggestion as publication authorization.
- Accepting whichever response completes last without checking version.

## Senior interview question (answer first)
A PromoLocal orchestrator runs image recognition, price verification and copywriting concurrently. Price verification times out and is retried, but the old call returns after the new one. How would you design task IDs, retries, deadlines, result versions, database commits and human approval to prevent stale writes and automatic publication? Answer before reviewing any solution.

## 15-minute practice
Draw `QUEUED → RUNNING → REVIEW_REQUIRED → APPROVED → PUBLISHED`, plus `FAILED` and `TIMED_OUT`. For each transition, specify who can trigger it and whether it is idempotent. Design one test for a late stale response.

## Summary
Reliable multi-agent systems are about **isolation, bounded resources, validated results and explicit authorization**, not just parallel speed.
