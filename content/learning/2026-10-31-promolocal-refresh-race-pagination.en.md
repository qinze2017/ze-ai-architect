+++
title = "Senior Java and React: Prevent Stale Refresh Results from Resetting PromoLocal Pages"
date = 2026-10-31
draft = false
summary = "A real PromoLocal review case about async request races, refresh coalescing, stale results, and authoritative pagination."
tags = ["Java", "React", "Concurrency", "PromoLocal", "Architecture", "Async"]
categories = ["Learning"]
showComments = true
+++

## Real project context — October 31, 2026

PromoLocal's **R2.1.2** review found two risks: resuming a background tab during an in-flight request could fail to refresh active deals, and a map refresh could reset pagination without an authoritative result. The candidate received a **NO-GO** verdict. A subsequent R2.1.3 review found that resume events only about 5 ms apart could trigger 3 requests and 2 cancellations. Project notes say R2.1.4 adopted a shared 75 ms coalescing window (maximum 500 ms delay) and passed 53 tests plus build, lint and TypeScript checks, but it **had not been pushed or deployed** at that point. Those counts come from project review notes; this article does not claim to have rerun its integration suite.

Today's topic is **asynchronous consistency**, distinct from October 30's price-evidence filtering. The example below is instructional, not production code.

## Core concepts: three separate safeguards

**1. Coalesce refresh triggers.** visibilitychange and focus can fire almost simultaneously. Coalescing nearby refresh intents avoids duplicate requests; it does not by itself guarantee fresh results.

**2. Abort obsolete requests.** AbortController reduces unnecessary network and parsing work. Cancellation alone is insufficient because an asynchronous continuation may already be queued.

**3. Gate results by request generation.** Increment a generation ID whenever a new authoritative request starts. Only a successful response belonging to the latest generation may update the list and page. A filter change must also invalidate earlier results.

**Pagination invariant:** adjust the current page only after a successful response matching the current query, using its authoritative totalPages. A failed, aborted or stale response must not send someone from page 3 back to page 1. The demo assumes 1-based pages; match the real API's 0/1-based convention.

## Tested Java 17 example

This standalone program models React's "only the latest request may write state" rule in Java. It simulates out-of-order completions without a browser or database. Save as StaleResponseGateDemo.java and run:

~~~bash
javac --release 17 StaleResponseGateDemo.java
java StaleResponseGateDemo
~~~

~~~java
public final class StaleResponseGateDemo {
    private long latestRequestId = 0;
    private int page = 3;
    private String data = "existing";

    long beginRequest() { return ++latestRequestId; }

    boolean accept(long requestId, boolean succeeded,
                   int totalPages, String responseData) {
        if (!succeeded || requestId != latestRequestId) return false;
        data = responseData;
        page = Math.min(page, Math.max(1, totalPages)); // 1-based pages
        return true;
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        StaleResponseGateDemo gate = new StaleResponseGateDemo();
        long oldRequest = gate.beginRequest();
        long currentRequest = gate.beginRequest();
        check(!gate.accept(oldRequest, true, 1, "stale"), "reject old response");
        check(gate.page == 3, "old response must not reset page");
        check(gate.accept(currentRequest, true, 2, "fresh"), "accept latest response");
        check(gate.page == 2 && gate.data.equals("fresh"), "clamp after success");
        long failedRequest = gate.beginRequest();
        check(!gate.accept(failedRequest, false, 1, "failed"), "reject failure");
        check(gate.page == 2 && gate.data.equals("fresh"), "preserve state on failure");
        System.out.println("PASS: 6 stale-response and pagination assertions");
    }
}
~~~

Expected output: **PASS: 6 stale-response and pagination assertions**. The example was compiled and run locally with javac --release 17. Production React code also needs AbortController, effect cleanup, event coalescing and a request key tied to filters.

## Common pitfalls

1. **Debounce alone:** fewer calls, but an older response can still overwrite a newer one.
2. **Abort alone:** queued asynchronous continuations may still need a guard.
3. **Resetting to page 1 on every response:** user navigation becomes unstable.
4. **Treating an error as a successful empty result:** data disappears and pagination is wrongly adjusted.
5. **Ignoring filter changes in the generation key:** old search results leak into the new view.
6. **Equating passing tests with a release:** local tests, Git commits, CI and public deployment are separate gates.

## Senior interview question — answer before reading a solution

A user is on page 3 of Rabais, switches tabs, then returns. Old request A is still running; two near-simultaneous resume events trigger B and C. A finishes last, B is aborted, and C succeeds with totalPages = 2. **How would you coalesce triggers, cancel obsolete work, reject stale responses, and correct pagination? What should happen if C fails?** No model answer is provided here.

## 15-minute practice

1. Compile and run the Java 17 program; verify all 6 assertions.
2. Move the old-response acceptance check after the current response and verify that the old result still cannot overwrite state.
3. In development, measure visibilitychange/focus events, requests and cancellations to assess coalescing; do not call production write APIs.
4. Verify that the page changes only after a successful response for the current filters. Do not push or deploy without review.

## Summary

**Coalescing limits request count; aborting saves work; generation guards correctness; pagination follows a successful authoritative response.** The same stale-result principle applies to Java async jobs and AI workers. Only the standalone Java example was directly verified for this article; no live frontend or production validation is claimed.
