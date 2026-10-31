+++
title = "Senior Java and AI: Show Products Only When Price Evidence Exists"
date = 2026-10-30
draft = false
summary = "A PromoLocal case study in price-evidence gates, EXISTS queries, consistent pagination and the boundary between AI suggestions and published facts."
tags = ["Java", "AI", "PostgreSQL", "Data Quality", "PromoLocal", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## Real project context — October 30, 2026

PromoLocal's immediate focus is **Rabais** (deals backed by price and date evidence), **Produits** (products with price history), and **Communauté** (photos, shared prices and verification). Comparer stays hidden until sufficient data exists, and the public product catalog should not show products with no price records.

This is a **data-quality gate**, not just a CSS change. The table names and approval rules below are illustrative, not a claim about the current production schema.

## Core concept

A product name, brand and image do not establish an observed store price. A defensible proposed rule is to show a product only when at least one observation is **approved, positive, linked to a store and timestamped**. Adapt the approval condition to the actual moderation workflow.

An old price can remain in the history, but **does not prove a discount is currently active**. Rabais needs separate date and source validation. A price extracted by AI from a photo is a **candidate fact**, not automatically a verified public price.

## SQL and Java 17 example

The `products` and `price_observations` schema is hypothetical. `EXISTS` selects products with at least one qualifying observation without duplicating products with multiple historical prices. The Java program is standalone and does not access production services.

~~~sql
SELECT p.id, p.name
FROM products p
WHERE EXISTS (
    SELECT 1
    FROM price_observations e
    WHERE e.product_id = p.id
      AND e.status = 'PUBLISHED'
      AND e.amount > 0
      AND e.store_id IS NOT NULL
      AND e.observed_at <= CURRENT_TIMESTAMP
);
~~~

Save the Java code as `PriceEvidenceGateDemo.java`, then run `javac --release 17 PriceEvidenceGateDemo.java && java PriceEvidenceGateDemo`. Expected output: `PASS: 5 price-evidence visibility cases`. The assertions cover approved evidence, pending evidence, zero price, a future observation and no evidence. `BigDecimal` is used for monetary amounts and the fixed clock keeps tests repeatable.

~~~java
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class PriceEvidenceGateDemo {
    record PriceEvidence(long productId, BigDecimal amount, String storeId,
                         Instant observedAt, boolean approved) {}

    static boolean usable(PriceEvidence e, Instant now) {
        return e != null && e.approved() && e.amount() != null
            && e.amount().signum() > 0 && e.storeId() != null
            && !e.storeId().isBlank() && e.observedAt() != null
            && !e.observedAt().isAfter(now);
    }

    static boolean visible(long productId, List<PriceEvidence> evidence, Instant now) {
        return evidence.stream().anyMatch(e -> e != null
            && e.productId() == productId && usable(e, now));
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        Instant now = Instant.parse("2026-10-30T22:00:00Z");
        PriceEvidence approved = new PriceEvidence(101L, new BigDecimal("2.99"),
            "Super C", now.minusSeconds(3600), true);
        PriceEvidence pending = new PriceEvidence(102L, new BigDecimal("3.99"),
            "Maxi", now.minusSeconds(3600), false);
        PriceEvidence zero = new PriceEvidence(103L, BigDecimal.ZERO,
            "IGA", now.minusSeconds(3600), true);
        PriceEvidence future = new PriceEvidence(104L, new BigDecimal("4.99"),
            "IGA", now.plusSeconds(3600), true);
        List<PriceEvidence> records = List.of(approved, pending, zero, future);
        check(visible(101L, records, now), "approved evidence should be visible");
        check(!visible(102L, records, now), "pending evidence must not count");
        check(!visible(103L, records, now), "zero price must not count");
        check(!visible(104L, records, now), "future observation must not count");
        check(!visible(105L, records, now), "missing evidence must not count");
        System.out.println("PASS: 5 price-evidence visibility cases");
    }
}
~~~


## Common Senior-level pitfalls

1. Frontend-only hiding leaves API, search, SEO and pagination counts inconsistent.
2. Filtering after pagination can leave only two items on a nominal 20-item page.
3. A naive JOIN can duplicate products with several price observations.
4. AI/OCR extraction can misread prices, units, dates or stores; it must not bypass review.
5. Historical prices must not be presented as currently valid discounts.
6. Hiding the Comparer navigation link alone does not gate its routes or APIs.

## Senior interview question — answer first

A catalog contains 2,000 products, but only 100 have qualifying price evidence. The API paginates all products in groups of 20; React then removes those without prices. Some pages show only one or two products while the total still says 2,000. **How would you redesign the query, total count and cache invalidation without introducing N+1 queries?** No model answer is given here.

## Fifteen-minute practice

1. Compile and run the Java example; confirm all five assertions.
2. Add a second qualifying observation for product 101; explain why the product should still appear once.
3. Compare `EXISTS` and a naive `JOIN` with synthetic development data.
4. Define which evidence statuses Produits, Rabais and Communauté may display, and check Comparer's navigation, routes and APIs. Do not deploy or alter production data.

## Summary

**A product entry is not price evidence; a historical price is not a live deal; AI extraction is not reviewed fact.** Enforce the evidence gate in backend queries and publishing rules, not only in the UI.

Verification scope: the Java example was compiled and run targeting Java 17; the illustrative `EXISTS` logic passed a five-product SQLite in-memory check. It was not tested against the real PostgreSQL schema, Spring Boot integration or live website.
