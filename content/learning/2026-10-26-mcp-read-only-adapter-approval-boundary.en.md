+++
title = "Senior Java / AI: Read-Only MCP Tools and Trusted Human Approval"
date = 2026-10-26
draft = false
summary = "Learn from the PromoLocal Photo Deal review: tool registration is a capability boundary, and a draft preview is not approval."
tags = ["Java", "AI Agents", "MCP", "Security", "API Contracts", "Architecture", "Testing"]
categories = ["Learning"]
showComments = true
+++

## Today's real problem

In PromoLocal Photo Deal TEST 3.0.0, the FastAPI dynamic-category GET can support a read-only MCP adapter. The creation POST is still **NO-GO**. The security review identified four blockers: no trusted approval of the complete request, optional MCP file metadata that may not meet mandatory backend fields, attachment cleanup on cancellation, and ambiguous commit outcomes after a timeout. This article describes an isolated teaching model, not a deployed adapter.

## 1. One security boundary first

**A prompt saying “do not call” does not disable a tool.** If `create_photo_deal` remains registered, the agent can attempt to invoke it. Phase one should register only `list_photo_deal_categories`. Product, price, store, category, actor, and three photo roles may be prepared and previewed locally **without persistence**.

## 2. A preview is not approval

An AI-generated summary may omit fields. Future approval must be **verified by the server** and bound to the canonical complete request, approver identity, expiry, and a single-use identifier. The model cannot authorize itself by claiming the user agreed. Restrict adapter credentials and network reachability as well, so the agent cannot bypass MCP and call the write API directly.

## 3. Runnable Java 17 teaching example

The immutable Map models a read-only tool registry. `preview` is a local Java method, **not an MCP tool**. The file references `f1`, `f2`, and `f3` are placeholders. No network calls or database writes are performed.

~~~java
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

public class SafeMcpDemo {
    static final Map<String, Supplier<List<String>>> TOOLS =
        Map.of("list_photo_deal_categories", () -> List.of("grocery", "seafood"));

    record Draft(String product, BigDecimal price, String store,
                 String category, String actor, Map<String,String> photos) {}

    // Local preview only: not exported as an MCP tool.
    static String preview(Draft d) {
        if (d.product() == null || d.product().isBlank()
            || d.price() == null || d.price().signum() <= 0
            || d.store() == null || d.store().isBlank()
            || d.category() == null || d.category().isBlank()
            || d.actor() == null || d.actor().isBlank()
            || d.photos() == null
            || !d.photos().keySet().containsAll(
                 List.of("product", "price_tag", "store_context")))
            throw new IllegalArgumentException("incomplete draft");
        return d.product() + " | " + d.price() + " | " + d.store();
    }

    public static void main(String[] args) {
        if (TOOLS.containsKey("create_photo_deal"))
            throw new AssertionError("create tool exposed");
        if (!TOOLS.get("list_photo_deal_categories").get().contains("seafood"))
            throw new AssertionError("read-only lookup failed");
        Draft draft = new Draft("Salmon", new BigDecimal("9.99"),
            "Example Store", "seafood", "reviewer-1",
            Map.of("product","f1","price_tag","f2","store_context","f3"));
        if (!preview(draft).contains("Salmon"))
            throw new AssertionError("preview failed");
        System.out.println("PASS");
    }
}
~~~

This demo checks that the create tool is absent, categories can be read, and a draft can be previewed. It does not replace real MCP tool-discovery tests, file metadata compatibility checks, or backend authorization tests.

## 4. Senior-level pitfalls

- **Prompt-as-permission**: a registered POST remains callable regardless of instructions.
- **Preview-as-approval**: approval must bind the complete request, including photo references.
- **Inventing missing file metadata** to satisfy backend required fields.
- **Orphaned attachments** after cancellation or retries.
- **Blind POST retry after timeout**: the server may already have committed; use idempotency and result reconciliation.
- **UI-only controls**: hiding a button does not enforce server-side authentication, authorization, or credential scope.

## 5. Senior interview question (answer first)

A developer registers `create_photo_deal` as an MCP tool but adds “never call without approval” to the Instructions. **Why is this unsafe? How would you prove phase one has no callable write path? How would you later design trustworthy approval and recovery from an ambiguous timeout?** No model answer is provided yet.

## 6. Fifteen-minute exercise

1. Save the example as `SafeMcpDemo.java`, then run `javac --release 17 SafeMcpDemo.java && java SafeMcpDemo`.
2. Confirm `create_photo_deal` is absent from the registry.
3. Remove `price_tag` and confirm the preview rejects the incomplete draft.
4. Sketch a future write flow: complete request → human approval → server verification → idempotent commit → result reconciliation. **Do not call the real POST.**

## Summary

**Restrict what an agent can invoke before telling it what it should do.** Read-only category lookup and local preview can ship independently. Keep creation NO-GO until approval, attachment lifecycle, and uncertain outcomes are resolved.
