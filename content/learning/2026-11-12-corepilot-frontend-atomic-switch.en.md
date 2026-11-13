+++
title = "Senior Java / AI: CorePilot Frontend Directory Switch and Rollback Gates"
date = 2026-11-12
draft = false
summary = "Learn why a successful directory switch is not proof that the new UI is served to users."
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
On November 12, CorePilot A+9.2 reported `RESULT: A+9.2 SWITCH PASS` after moving a frontend candidate into `web/out` and retaining a rollback directory. The expected new UI control was still missing afterward. A successful file operation is not proof of a successful user-facing release.

## Core concepts
**Preflight gate**: check candidate files, active processes, ports, backup destination, and filesystem constraints. These checks can become stale.
**Directory switch**: a single rename within one filesystem is generally atomic, but moving the old directory and then moving the candidate involves **two operations, not one atomic transaction**.
**Rollback**: preserve the prior version and attempt restoration on failure; restoration itself can fail.
**Post-switch verification**: check local files, HTTP responses, JS/CSS assets, routes, and browser behavior. A stale server or browser cache can still serve old content.

## Bash teaching example
This example demonstrates a backup and compensating move in an isolated local test directory only. It does **not** check active services, concurrent deploys, filesystem boundaries, HTTP, or browser behavior. Do not use it directly for production deployment. Its syntax and isolated happy path were tested.
~~~bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?root}"; CANDIDATE="${2:?candidate}"
LIVE="$ROOT/out"; BACKUP="$ROOT/.out-backup"
[[ -f "$CANDIDATE/create/index.html" ]] || exit 2
[[ -d "$LIVE" ]] || exit 2
[[ ! -e "$BACKUP" ]] || exit 2
mv "$LIVE" "$BACKUP"
if ! mv "$CANDIDATE" "$LIVE"; then
  mv "$BACKUP" "$LIVE" || { echo 'MANUAL RECOVERY REQUIRED' >&2; exit 3; }
  exit 1
fi
printf 'SWITCHED; backup=%s\n' "$BACKUP"
~~~

## Common pitfalls
- Treating two `mv` commands as one atomic release.
- Checking only `index.html` while ignoring JS/CSS assets.
- Equating SWITCH PASS with a visible feature.
- Ignoring concurrent switches, active processes, or backup collisions.
- Assuming rollback cannot fail.
- Missing Service Worker and browser caches or an incorrect static root.

## Senior interview question
The A+9.2 directory switch reports PASS, but the new video-duration selector is still missing on an iPhone. How would you distinguish an incorrect candidate build, a server still serving an old directory, and stale browser assets? What evidence would your release gate require?

## 15-minute exercise
Without modifying services, record the candidate, `web/out`, and rollback paths; inspect the serving process and route; compare local and HTTP hashes; inspect JS assets for the expected feature. Do not restart or repeat the switch.

## Summary
Reliable release engineering separates preflight, switching, post-switch verification, and rollback. A successful directory operation is only one piece of evidence.