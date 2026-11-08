+++
title = "Senior Java / AI: Memory Admission Control for CorePilot"
date = 2026-11-07
draft = false
summary = "Scheduling local ComfyUI and services safely under memory pressure."
tags = ["Java", "AI", "CorePilot", "Scheduling"]
categories = ["Learning"]
showComments = true
+++

## Context
On November 7, CorePilot was planned as a controller for local ComfyUI and development services on Mac Studio. High allocated swap alone does not prove current paging pressure; evaluate trends and actual memory pressure.

## Core concepts
**Admission control** checks capacity before starting a job. **Backpressure** queues work when capacity is insufficient. **Lifecycle**: STOPPED → STARTING → RUNNING → DRAINING → STOPPED, with FAILED for errors. Cooperative draining is different from SIGSTOP, which can freeze locks, connections and GPU resources.

## Java 17 example
~~~java
record Snapshot(long availableMb, long swapUsedMb, boolean pressureHigh) {}
record Workload(long estimatedPeakMb, boolean critical) {}

static boolean mayStart(Snapshot s, Workload w, long reserveMb) {
    if (s.pressureHigh()) return false;
    if (w.estimatedPeakMb() < 0 || reserveMb < 0) return false;
    return s.availableMb() >= w.estimatedPeakMb() + reserveMb;
}
~~~This pure function demonstrates budgeting only. Production requires trustworthy sampling, atomic reservations, hysteresis and post-start checks.

## Common pitfalls
- Treating total swap usage as the only pressure signal.
- Assuming a UI stop button safely cancels GPU inference.
- Allowing two concurrent starts to spend the same capacity (TOCTOU).
- Trusting a PID without verifying process identity.
- Confusing queued work with completed work.

## Senior interview question
Two ComfyUI jobs each require 20 GB, but the scheduler has only 30 GB of available budget. How would you reserve capacity atomically and drain running jobs safely?

## 15-minute exercise
Sketch QUEUED, RESERVED, STARTING, RUNNING, DRAINING, STOPPED and FAILED, marking idempotent transitions. Do not stop real processes.

## Summary
Telemetry informs decisions, admission control protects capacity, and the state machine governs execution.
