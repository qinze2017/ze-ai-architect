+++
title = "Senior Java / AI: Why a Job Candidate Is Not Yet Published"
date = 2026-10-27
draft = false
summary = "Use JobPilot (51 candidates, 6 public jobs) to learn human approval gates, immutable publication plans, and safe retries."
tags = ["Java", "AI Agents", "Human-in-the-Loop", "JobPilot", "Architecture", "Testing"]
categories = ["Learning"]
showComments = true
+++

## Today's real problem

On October 27, 2026, JobPilot's scripts/job-candidates.json contained **51 candidate jobs**, but frontend/public/data/jobs.json still contained **6 public jobs**. Collection and publication are different operations. The repository's scripts/PUBLISHING.md explicitly describes the current flow as **preview only**, and prepare-publication.mjs reports publication_enabled: false.

Think of a store: receiving 51 items at the warehouse does not put 51 items on the shelves. Discovery does not grant publishing permission.

## 1. Three stages and responsibilities

**Discovery (Candidate)**: collect possible jobs without assuming they are verified.

**Review (Approval)**: check official sources, Québec eligibility, 100% remote work, and recruiting status. A trusted human process places the stable job_id into approved_ids. HIGH or MEDIUM is a ranking, not approval.

**Publication (Publication)**: a separate stage reads the latest main, validates schema and stable IDs, detects conflicts, and prepares only approved changes. This stage is **not currently enabled in JobPilot**.

An increasing candidate count with a stable public count does not, by itself, prove a collection failure.

## 2. Runnable Java 17 approval-gate example

This is an **isolated educational model**, not a full translation of JobPilot's JavaScript publisher. It deliberately uses stricter example requirements: quebecEligible=true and OPEN. It performs no network calls or file writes.

~~~java
import java.util.List;
import java.util.Set;

public class ApprovalGateDemo {
    record Job(String id, boolean remote, boolean quebecEligible,
               String recruitingStatus, String tier) {}

    // Educational model: stricter than JobPilot's actual preview logic.
    static boolean canPublish(Job job, Set<String> approvedIds) {
        return approvedIds.contains(job.id())
            && job.remote()
            && job.quebecEligible()
            && "OPEN".equals(job.recruitingStatus())
            && Set.of("HIGH", "MEDIUM").contains(job.tier());
    }

    static List<Job> plan(List<Job> candidates, Set<String> approvedIds) {
        return candidates.stream()
            .filter(job -> canPublish(job, approvedIds))
            .toList(); // Immutable result; no network or file writes.
    }

    public static void main(String[] args) {
        Job approved = new Job("job-1", true, true, "OPEN", "HIGH");
        Job pending  = new Job("job-2", true, true, "OPEN", "HIGH");
        Job excluded = new Job("job-3", true, true, "OPEN", "EXCLUDE");
        Job notQc    = new Job("job-4", true, false, "OPEN", "HIGH");
        var result = plan(List.of(approved, pending, excluded, notQc),
                          Set.of("job-1", "job-3", "job-4"));
        if (result.size() != 1 || !result.get(0).id().equals("job-1")) {
            throw new AssertionError("Approval gate failed");
        }
        if (canPublish(pending, Set.of())) {
            throw new AssertionError("Unapproved job was accepted");
        }
        System.out.println("PASS: only approved eligible job selected");
    }
}
~~~

Run / Exécution / 运行: `javac --release 17 ApprovalGateDemo.java && java ApprovalGateDemo`.

## 3. Production requirements beyond the demo

An in-memory filter is not a publishing system. Before any write, recheck official source freshness, stable IDs, URL collisions, output schema, and the current remote main SHA. If the branch moved, recompute or stop rather than overwrite newer work. JobPilot's current documentation explicitly forbids force-pushing or directly publishing to main in the review workflow.

## 4. Common Senior-level pitfalls

- Treating an AI-generated HIGH match score as human approval.
- Treating UNKNOWN or quebec_eligible=null as verified.
- Assuming collection failed merely because the public website did not change.
- Duplicating job_id on retry or overwriting newer remote data.
- Hiding a publish button without restricting server-side write permissions.
- Claiming success from a preview that explicitly says publication_enabled=false.

## 5. Senior interview question: answer first

Five new jobs increase the candidate pool from 46 to 51, while the public site still shows 6. How would you distinguish a healthy approval backlog from a real publication failure? If two Workers publish the same approved batch concurrently, how would you prevent duplicates and lost updates? Answer first; this article deliberately provides no solution.

## 6. Fifteen-minute practice

1. Save the code as ApprovalGateDemo.java; run javac --release 17 ApprovalGateDemo.java && java ApprovalGateDemo.
2. Set approvedIds to an empty set and confirm the plan is empty.
3. Set job-1's quebecEligible to false and confirm rejection even if approved.
4. Draw Candidate → Reviewed → Approved → Proposed → Published, marking the human approval step. Do not modify JobPilot public data.

## Summary

**Discovery is not approval; approval is not publication.** Reliable AI-assisted workflows separate human authorization, side-effect-free planning, duplicate detection, and restricted write capabilities.

Verified sources: qinze2017/JobPilot scripts/PUBLISHING.md, scripts/prepare-publication.mjs, scripts/job-reviews.json, and the JSON datasets inspected on October 27, 2026.

