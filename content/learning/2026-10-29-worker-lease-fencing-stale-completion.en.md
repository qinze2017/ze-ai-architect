+++
title = "Senior Java: Stop a Stale Worker from Overwriting Results"
date = 2026-10-29
draft = false
summary = "Use leases, fencing tokens and conditional completion to protect asynchronous jobs."
tags = ["Java", "PostgreSQL", "Workers", "Lease", "Fencing Token", "Concurrency", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## Today's learning context

We already established that PostgreSQL row locks end with the transaction, while the PROCESSING business state remains persisted. The next problem is not another SKIP LOCKED explanation: **what if an old Worker resumes after its lease expires and another Worker takes over?**

This is a realistic failure mode for PDF parsing, AI inference and background jobs.

## 1. Core concept: an expired lease does not stop a process

At 10:00, Worker A claims job 1001 with a lease until 10:01. Its AI call stalls. At 10:01:01, Worker B reclaims the job. At 10:01:02, A resumes and attempts to save its result.

Lease expiration permits recovery; it does **not** prove that A has terminated. Checking status = PROCESSING is insufficient because both workers can see that same state.

Each claim should receive a monotonically increasing **fencing token**, such as lease_version. A holds version 7; B receives version 8. Completion must match the job ID, current owner, current version, PROCESSING status and a non-expired lease. An old token must not update the final state.

## 2. Keep the transaction short

A claim transaction should select and lock an eligible row, change it to PROCESSING, record the owner and lease deadline, increment lease_version, and commit. Perform the AI call **outside** that transaction.

Completion must be an **atomic conditional database update**. If it affects zero rows, the worker may have lost its right to commit. Do not blindly retry the old result.

Avoid a separate SELECT check followed by an unconditional UPDATE: another worker can reclaim the job between those statements. The example below illustrates the state-machine rule in memory; it is not a PostgreSQL repository implementation.

## 3. Tested Java 17 example

~~~java
import java.time.Instant;

public class WorkerFencingDemo {
    static final class Job {
        String status = "PENDING";
        String owner = "";
        long version = 0;
        Instant leaseUntil = Instant.EPOCH;

        synchronized long claim(String worker, Instant now) {
            boolean available = status.equals("PENDING")
                || (status.equals("PROCESSING") && !now.isBefore(leaseUntil));
            if (!available) throw new IllegalStateException("not claimable");
            status = "PROCESSING";
            owner = worker;
            version++;
            leaseUntil = now.plusSeconds(60);
            return version;
        }

        synchronized boolean complete(String worker, long token, Instant now) {
            if (!status.equals("PROCESSING") || !owner.equals(worker)
                    || version != token || !now.isBefore(leaseUntil)) return false;
            status = "DONE";
            return true;
        }
    }

    public static void main(String[] args) {
        Job job = new Job();
        Instant t = Instant.parse("2026-10-29T22:00:00Z");
        long tokenA = job.claim("A", t);
        long tokenB = job.claim("B", t.plusSeconds(61));
        if (job.complete("A", tokenA, t.plusSeconds(62)))
            throw new AssertionError("stale worker was accepted");
        if (!job.complete("B", tokenB, t.plusSeconds(63)))
            throw new AssertionError("current worker was rejected");
        if (job.complete("B", tokenB, t.plusSeconds(64)))
            throw new AssertionError("duplicate completion was accepted");
        System.out.println("PASS: stale and duplicate completion rejected");
    }
}
~~~

Save as WorkerFencingDemo.java and run:

~~~text
javac --release 17 WorkerFencingDemo.java
java WorkerFencingDemo
~~~

Expected output: PASS: stale and duplicate completion rejected.

The synchronized methods only simulate atomic state changes **within one JVM**. They do not implement a distributed lock or prove real PostgreSQL behavior. In production, enforce owner/version/lease predicates in an atomic database UPDATE and verify with two independent connections.

## 4. Common pitfalls

1. Assuming an expired lease means the previous process is dead.
2. Checking only PROCESSING, without a claim version.
3. Keeping a database transaction open during a long AI request.
4. Checking a version in one query and writing unconditionally in another.
5. Protecting the database row but letting a stale worker overwrite object storage or send duplicate notifications. External effects need idempotency keys, versioned object names or conditional writes at the destination.
6. Assuming fencing tokens alone provide end-to-end exactly-once execution.

## 5. Senior interview question — answer before reading a solution

A owns lease_version = 7. Its lease expires; B reclaims the job with version 8. Both complete their AI work nearly simultaneously.

**Which predicates should the database completion operation enforce? What should A do if its update affects zero rows? How would you prevent A from overwriting an external object-storage result?**

Write your own reasoning first; this article intentionally does not reveal a model answer.

## 6. Fifteen-minute exercise

1. Compile and run the Java 17 demonstration.
2. Move A's completion timestamp to before its lease expires and before B reclaims the job; inspect the behavior.
3. Draw the timeline: A claims, stalls, lease expires, B claims, A resumes, B completes.
4. Draft three assertions for a future PostgreSQL Testcontainers test: increasing claim version, stale completion rejected, current completion accepted. Do not test against production data.

## Summary

**A row lock protects a short claim transaction; PROCESSING records business state; a lease enables recovery; a fencing token prevents stale completion.** Database fencing does not automatically protect external side effects.

Verification boundary: the Java 17 demo was compiled and executed; real PostgreSQL/distributed-worker integration was not tested in this run.
