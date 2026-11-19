+++
title = "Senior Java / AI: Repeat Patch Application and Artifact Parity in CorePilot"
date = 2026-11-18
draft = false
summary = "Distinguish already-applied patches, baseline drift, successful isolated builds, and stale production assets."
tags = ["CorePilot", "Git", "Release Engineering", "AI Architecture"]
categories = ["Learning"]
showComments = true
+++

## Real engineering context
CorePilot Prompt Studio's select-chevron changes were already present in the current TSX/CSS sources. Reapplying the older patch conflicted. A newly generated diff against current sources was empty. TypeScript checks, four focused tests, and an isolated Next.js build passed, yet the existing production `web/out` did not contain the unified chevron styling.

## Core concepts
**Idempotency** means repeated operations leave the same intended final state. `git apply` is not inherently idempotent: applying an already-applied patch commonly fails. **Baseline drift** means patch context no longer matches; failure may indicate a previously applied change or unrelated edits. **Reverse check** with `git apply --reverse --check` helps identify already-present changes, but source inspection is still required. **Artifact parity** requires separately proving that the built assets and the bytes served to clients contain the intended change. An empty diff does not prove deployment.

## Bash example: read-only classification
~~~bash
# Run only inside an isolated Git checkout, never on production.
git status --short
if git apply --check change.patch; then
  echo "PATCH_APPLICABLE"
elif git apply --reverse --check change.patch; then
  echo "PATCH_ALREADY_PRESENT"
else
  echo "PATCH_CONFLICT_OR_DIFFERENT_BASE"
  exit 1
fi
~~~
Run only in an isolated Git checkout. Do not treat `--allow-empty` as evidence of a deployed change or overwrite production `web/out` based on this check.

## Common pitfalls
- Forcing a failed patch without examining the current baseline.
- Treating successful TypeScript tests as proof that production assets are current.
- Mistaking an empty patch for a new release.
- Overlooking unrelated dirty working-tree files.
- Ignoring server and browser caching after a successful build.

## Senior interview question
A patch fails its forward check, passes its reverse check, and the intended CSS exists in source, but the browser still renders the old style. How would you isolate patch duplication, stale builds, stale server files, and caching? What evidence determines GO versus NO-GO?

## 15-minute exercise
Create a temporary Git repository, generate a patch, restore the original file, and verify forward applicability. Apply once, verify reverse applicability, and confirm the second forward application is rejected. Document additional static-asset checks before any release.

## Summary and validation boundary
Forward application, reverse checking, and duplicate rejection were tested in a temporary Git repository. No actual CorePilot source, service, or production assets were modified. This is a diagnostic example, not a deployment procedure.
