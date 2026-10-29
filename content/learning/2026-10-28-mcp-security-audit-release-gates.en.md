+++
title = "Senior Java / AI: 139 Passing Tests, Yet MCP Is Still NO-GO"
date = 2026-10-28
draft = false
summary = "Use the PromoLocal Photo Deal audit to understand evidence tiers, fail-closed release gates, and live read-only verification."
tags = ["Java", "AI Agents", "MCP", "Security", "Release Gates", "Architecture", "Testing"]
categories = ["Learning"]
showComments = true
+++

## Today's real engineering problem

The **October 28, 2026 PromoLocal Photo Deal** audit summary reports a matching ZIP SHA-256, **101 passing existing tests**, and **38 passing independent security counterexamples**, with **zero failures**: **139 passes in total**. Nevertheless, the decisions are separate: **GO for phase-one offline audit; NO-GO for real read-only MCP integration; NO-GO for creating deals**.

That is consistent. **Passing tests establish only the properties those tests actually exercised.** This lesson uses the reported audit summary; it does not claim that the original ZIP was rerun or that a real MCP service was connected during this lesson.

## 1. Three distinct evidence tiers

**Offline audit.** Verify artifact digests, unit tests, simulated HTTP calls, and negative authorization cases. This provides evidence about behavior under the specified offline test conditions.

**Real read-only MCP.** Verify the supported MCP transport and protocol negotiation, authenticated owner-only access, expired tokens, audience and scope checks, and **zero upstream API calls after a rejected request**. Keep verifiable results from the actual integration. Read access does not imply write access.

**Create/write.** In addition to the above, verify trusted human approval bound to the entire normalized request, idempotency and reconciliation after ambiguous responses, attachment cleanup, and isolation of write credentials. Until those conditions are met, do not register or expose the create tool.

**139 passing offline tests do not prove a real platform authentication boundary.** Each release stage requires its own evidence.

## 2. Java 17: model fail-closed release gates

This is a **pure in-memory teaching model**, not an MCP server, authentication implementation, or deployment tool. Each boolean must come from trusted verification evidence, never from the AI model's own claim. `eligible` means a gate's evidence is complete, not that deployment should happen automatically.

~~~java
import java.util.Objects;

public class McpReleaseGateDemo {
    enum Gate { OFFLINE_AUDIT, LIVE_READ_ONLY, CREATE_WRITE }

    record Evidence(boolean digestMatched,
                    boolean offlineTestsPassed,
                    boolean ownerAuthVerified,
                    boolean protocolVerified,
                    boolean liveReadOnlyVerified,
                    boolean trustedApprovalVerified,
                    boolean idempotencyVerified,
                    boolean writeIsolationVerified) {}

    static boolean eligible(Gate gate, Evidence e) {
        Objects.requireNonNull(gate);
        Objects.requireNonNull(e);
        boolean offline = e.digestMatched() && e.offlineTestsPassed();
        boolean readOnly = offline && e.ownerAuthVerified()
            && e.protocolVerified() && e.liveReadOnlyVerified();
        return switch (gate) {
            case OFFLINE_AUDIT -> offline;
            case LIVE_READ_ONLY -> readOnly;
            case CREATE_WRITE -> readOnly && e.trustedApprovalVerified()
                && e.idempotencyVerified() && e.writeIsolationVerified();
        };
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        Evidence offlineOnly = new Evidence(true, true, false, false,
                                            false, false, false, false);
        check(eligible(Gate.OFFLINE_AUDIT, offlineOnly), "offline audit");
        check(!eligible(Gate.LIVE_READ_ONLY, offlineOnly), "read-only blocked");
        check(!eligible(Gate.CREATE_WRITE, offlineOnly), "write blocked");

        Evidence readOnly = new Evidence(true, true, true, true,
                                         true, false, false, false);
        check(eligible(Gate.LIVE_READ_ONLY, readOnly), "read-only eligible");
        check(!eligible(Gate.CREATE_WRITE, readOnly), "write still blocked");

        Evidence missingOwnerAuth = new Evidence(true, true, false, true,
                                                 true, true, true, true);
        check(!eligible(Gate.CREATE_WRITE, missingOwnerAuth), "fail closed");
        System.out.println("PASS: release gates fail closed");
    }
}
~~~

Run: `javac --release 17 McpReleaseGateDemo.java && java McpReleaseGateDemo`. Expected output: `PASS: release gates fail closed`.

## 3. Common senior-level pitfalls

- Treating mock tests as proof of live OAuth/MCP authentication and negotiation.
- Checking only HTTP 401, without checking for **zero upstream side effects**.
- Treating a shared backend Bearer token as end-user identity or trusting a model-supplied `user_id`.
- Mistaking permission to list categories for permission to create a deal.
- Blindly retrying POST after a timeout, or leaving orphaned attachments on cancellation.
- Using a single GO/NO-GO flag without recording missing evidence for each stage.

## 4. Senior interview question — answer before seeing a solution

An independent audit reports **139/139 offline tests passed**, but real MCP owner-only authentication and protocol negotiation **have not been verified**. A product manager wants deal creation enabled tomorrow. How would you separate offline, read-only, and write gates? Which missing evidence must block the release? Answer in your own words; no solution is provided here.

## 5. Fifteen-minute practice

1. Save the code as `McpReleaseGateDemo.java`; compile and run it.
2. Change `offlineOnly.digestMatched` to `false` in the constructor and verify that even the offline gate closes.
3. Make a three-column checklist: offline evidence, real read-only evidence, and write evidence; mark each `verified / missing`.
4. Design a negative test asserting **zero upstream calls after authorization rejection**. Do not use production tokens or invoke a real create POST.

## Summary

**A secure release depends on stage-specific verified evidence, not a large total test count.** Audit offline first, verify real read-only behavior second, and consider writes only after trusted approval and idempotency protections. Missing evidence means fail closed.

Source boundary: the 139 tests are reported by the October 28 audit summary, not by the Java teaching program in this article.
