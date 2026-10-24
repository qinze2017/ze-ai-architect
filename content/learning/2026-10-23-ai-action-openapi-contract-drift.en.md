+++
title = "Senior Java and AI: OpenAPI Contract Drift and Dynamic Categories"
date = 2026-10-23
draft = false
summary = "Distinguish database categories, runtime API behavior, and an AI Action schema; prevent integration drift with contract tests."
tags = ["Java", "AI Agents", "OpenAPI", "API Contracts", "Integration Testing", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## The real problem

An AI workflow recognizes promotional products from photos. An administrator creates a `seafood` category, but the AI Action might still use an older OpenAPI schema. **A category existing in the database does not prove the running API accepts it or that the AI consumer has loaded it.**

This lesson draws on PromoLocal integration discussions. The Java and YAML below are **teaching examples**, not claims about the deployed FastAPI code or the version actually saved in the Action editor.

## 1. Three separate sources of truth

1. **Database**: does the `seafood` slug exist, and is it active?
2. **Runtime API**: which request fields does POST accept, and how does it validate categories?
3. **Consumer contract**: which OpenAPI schema is actually loaded by the AI Action? Inspect `operationId`, required fields, `enum`, and security.

**Contract drift** occurs when these layers disagree. An older static `enum` can prevent a client from submitting a value that the database already accepts. Conversely, a schema declaring a `string` does not mean the backend must accept every value.

## 2. A safe diagnostic sequence

1. **Read-only**: confirm the category slug and active status; a display label is not necessarily the slug.
2. Inspect the public OpenAPI: `info.version`, `servers`, POST path, `operationId`, required fields, enums, and authentication.
3. Inspect the schema **saved in the AI Action editor**. Do not assume automatic refresh.
4. Run **isolated contract tests** for active, unknown, and inactive categories; assert HTTP behavior and persistence.
5. Review structural compatibility: newly required request fields, renamed/removed fields, and enum changes that may break strict clients.

A version string alone does not prove compatibility. Avoid production writes just to test a candidate contract.

## 3. Illustrative OpenAPI (not the deployed contract)

~~~yaml
openapi: 3.1.0
info:
  title: Example Photo Deal Integration
  version: 2.1.0
paths:
  /integrations/photo-deals:
    post:
      operationId: create_photo_deal
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [categorySlug]
              properties:
                categorySlug:
                  type: string
                  description: Server validates active slugs
      responses:
        '201':
          description: Created
~~~

Without a static `enum`, server-side business validation is still required. Production contracts also need authentication, error responses, and a retry/idempotency policy.

## 4. Java 17: validate a dynamic category

The following Java 17 example was compiled and run locally. A Spring Boot Repository can implement `CategoryCatalog` against a real database.

~~~java
import java.util.Map;
import java.util.Optional;

record Category(String slug, boolean active) {}

interface CategoryCatalog {
    Optional<Category> findBySlug(String slug);
}

final class CategoryValidator {
    private final CategoryCatalog catalog;

    CategoryValidator(CategoryCatalog catalog) {
        this.catalog = catalog;
    }

    void requireActive(String slug) {
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("category is required");
        }
        Category category = catalog.findBySlug(slug)
            .orElseThrow(() -> new IllegalArgumentException("unknown category"));
        if (!category.active()) {
            throw new IllegalStateException("category is inactive");
        }
    }
}

class CategoryValidatorDemo {
    public static void main(String[] args) {
        Map<String, Category> rows = Map.of(
            "seafood", new Category("seafood", true),
            "archived", new Category("archived", false)
        );
        CategoryValidator validator = new CategoryValidator(
            slug -> Optional.ofNullable(rows.get(slug))
        );
        validator.requireActive("seafood");
        try {
            validator.requireActive("archived");
            throw new AssertionError("inactive category accepted");
        } catch (IllegalStateException expected) {
            System.out.println("inactive category rejected");
        }
    }
}
~~~

The `Map` is only a test double; production categories should not be hard-coded. Validation and persistence need an appropriate transaction boundary.

## 5. Common Senior-level traps

- A category shown in the admin UI is not necessarily known to the AI Action.
- Updating `info.version` does not prove deployed behavior or backward compatibility.
- Removing a static `enum` does not remove the need to reject unknown or inactive categories.
- A successful HTTP response alone does not prove correct persistence or duplicate handling.
- Adding a required request field often breaks old clients; new enum values can also break strict parsers.

## 6. Senior interview question (answer first)

An AI Action's saved schema permits only `grocery | household`. The admin creates active `seafood`, and the backend now validates slugs dynamically, but the AI still cannot submit `seafood`.

**What is your troubleshooting order? Why is changing only the database or only OpenAPI insufficient to demonstrate end-to-end success?**

## 7. A 15-minute exercise

1. Read the current schema without changes; record its version, operationId, and category field definition.
2. Run the Java example and add an unknown-category rejection test.
3. Define three isolated contract tests: old-client compatibility, new active category acceptance, unknown-category rejection.
4. Record evidence, expected behavior, and observed behavior. Mark unexecuted checks **unverified**.

**Acceptance criterion:** distinguish “exists in database,” “accepted by runtime API,” and “known to the AI Action.”

## Summary

**Adding a category changes data; updating OpenAPI changes a contract; reloading an AI Action changes consumer configuration.** Verify each layer separately rather than treating a version number or a single HTTP response as end-to-end proof.
