+++
title = "Senior Java / Security: Why a Revoked Admin Can Still Hold a Valid JWT"
date = 2026-11-02
draft = false
summary = "A PromoLocal case study in stale JWT claims, current authorization, concurrent revocation, and regression testing."
tags = ["Java", "Spring Security", "JWT", "Authorization", "Security", "Concurrency"]
categories = ["Learning"]
showComments = true
+++

## Real-world problem
PromoLocal's admin security review confirmed the original ordinary-JWT privilege escalation was blocked. However, `PATCH /admin/users/{id}` still had a revocation gap when the admin role was changed to user. The release verdict remained **NO-GO**. This is design guidance, not a claim that production code has been fixed.

## Core concepts
**Authentication** establishes identity; **authorization** checks whether the caller **currently** has the required privilege. A role claim in a signed JWT is a snapshot from issuance time. A revoked admin may still hold an unexpired token. MFA completion establishes an authentication assurance, not permanent authorization.

Sensitive endpoints should consult authoritative server-side role and account state, invalidate or bound permission caches, and enforce the same rule on mutation endpoints. Define how concurrent revocation and privileged writes are ordered, and test the resulting guarantee.

## Java / Spring Boot example (illustrative; not integration-tested)
~~~java
// Spring Security: illustrative service-layer guard, not a drop-in patch.
@Transactional
public void updateUserRole(long targetId, Role newRole, long actorId) {
    User actor = users.findByIdForUpdate(actorId).orElseThrow();
    User target = users.findByIdForUpdate(targetId).orElseThrow();
    if (actor.getRole() != Role.ADMIN || !actor.isActive()) {
        throw new AccessDeniedException("Admin role revoked");
    }
    // Check business rules (e.g. cannot remove the last admin) here.
    target.setRole(newRole);
}
// Every privileged request must re-check authoritative server-side state;
// a JWT claim alone must not be treated as current role authorization.
~~~
Production code must also handle deterministic lock ordering, actor equal to target, last-admin policy, auditing, and Spring Security entry-point checks. This snippet alone cannot guarantee that every already-running request is immediately stopped.

## Common pitfalls
1. Checking JWT signature and expiry without current privileges.
2. Securing admin GET endpoints but overlooking PATCH/POST.
3. Treating MFA completion as a substitute for role checks.
4. Checking a role before a long-running write, allowing a race.
5. Asserting only HTTP 403 without asserting no database side effects.
6. Forgetting authorization cache invalidation.

## Senior interview question (answer first)
Admin A obtains a JWT with `admin` at 10:00. Their admin role is revoked at 10:05. At 10:06 they call `PATCH /admin/users/{id}` with the old token. How would you design Spring Security and database authorization to reject the write? What guarantee would you define for a concurrent revocation and admin update? Do not reveal the model answer yet.

## 15-minute practice
Inventory all `/admin/**` GET/PATCH/POST/DELETE endpoints. Record identity checks, current-role checks, MFA, and write side effects. Design regression tests for stale JWTs, concurrent revocation, cached permissions, and unchanged database state on rejection. Run only in an isolated environment.

## Summary
**A valid JWT is not proof of a currently valid privilege.** Revocation spans endpoints, caches, and concurrent transactions. Keep the release at NO-GO until end-to-end evidence is available.
