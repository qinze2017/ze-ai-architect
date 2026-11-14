+++
title = "Senior Java / AI: Safe Model Residency and Reuse in CorePilot"
date = 2026-11-13
draft = false
summary = "Design single-flight model loading, leases, and concurrency-safe capacity admission for image generation."
tags = ["Java", "AI", "CorePilot", "Concurrency"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
CorePilot text-to-image and image-to-image workflows may use the same loaded model. Unloading on every request wastes time, but matching only a display name can reuse the wrong weights.

## Core concepts
**Model identity**: combine weight SHA-256, runtime, precision, and relevant adapter configuration. **Single-flight loading**: concurrent callers share one in-flight load. **Lease/reference count**: active tasks prevent unload. **Lifecycle**: UNLOADED → LOADING → READY → UNLOADING, with FAILED and controlled retry.

## Java 17 design contract (illustrative, not executable)
~~~java
enum State { UNLOADED, LOADING, READY, UNLOADING, FAILED }
record ModelKey(String modelSha256, String runtime, String precision) {}
record Lease(ModelKey key, long generation) {}
// Pseudocode contract: implement under one coordinator lock or DB transaction.
// acquire(key): if READY and matching key, increment reference count;
// if LOADING, wait for the same in-flight future;
// otherwise reserve capacity and start exactly one load.
// release(lease): decrement only when generation matches.
// Never unload while active references > 0.
~~~

## Common pitfalls
Checking READY and then loading without synchronization creates duplicate loads; a stable path can point to changed weights; failed loads can leak reserved capacity; stale lease releases can corrupt a newer generation; estimated memory demand is not a guaranteed peak.

## Senior interview question
Two concurrent text-to-image and image-to-image jobs need the same model while a third needs another model. How would you prevent duplicate loads and memory oversubscription, and handle cancellation or load failure? Answer before viewing a solution.

## 15-minute exercise
Sketch the state machine and atomic acquire/release contract. Specify three tests: concurrent identical requests, failed load then retry, and a stale lease release. Run only isolated tests, without modifying production.

## Summary
Model reuse is a concurrency-controlled resource lifecycle, not merely an if statement.
