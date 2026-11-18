+++
title = "Senior Java / AI: CorePilot offline artifact integrity and release gates"
date = 2026-11-17
draft = false
summary = "Distinguish SHA-256 file integrity from trusted provenance and deployment authorization."
tags = ["CorePilot", "Security", "Release Engineering", "AI Architecture"]
categories = ["Learning"]
showComments = true
+++

## Real learning context
CorePilot B23 offline rehearsal requires reviewing the ZIP archive, `DEPLOYMENT_MAP.json`, and `ROLLBACK_INDEX.json`. File presence alone is not installation approval.

## Core concepts
**Integrity**: SHA-256 detects changes to file bytes. **Authenticity**: a checksum manifest must be independently trusted or authenticated with a verified signature; an attacker can alter both a file and its checksum. **Provenance**: retain source revision, release version, and approval evidence. **Release gate**: matching checksums do not replace environment, permissions, rollback, or safety verification. The decision remains NO-GO until required gates pass.

## Verifiable Bash teaching example
This example only checks file contents against an already trusted SHA256SUMS manifest. It does not verify signatures, prevent path traversal, or perform installation.

~~~bash
#!/usr/bin/env bash
set -euo pipefail
root="${1:?usage: verify_artifacts.sh DIRECTORY}"
manifest="$root/SHA256SUMS"
[[ -f "$manifest" ]] || { echo 'BLOCKED: manifest missing'; exit 1; }
(cd "$root" && shasum -a 256 -c SHA256SUMS)
~~~

## Common pitfalls
Do not treat successful ZIP extraction as a security guarantee; do not automatically trust a manifest shipped inside the same untrusted ZIP; do not mistake a rollback index for a tested rollback; do not extract unreviewed archives into production; do not equate a hash match with release approval.

## Senior interview question (answer first)
If both `DEPLOYMENT_MAP.json` and `SHA256SUMS` inside an offline archive are replaced, but `shasum -c` succeeds, would you approve the first CorePilot Guard installation? What independent evidence would you require?

## 15-minute exercise
In a temporary directory, create `a.txt`, generate SHA256SUMS, verify success, change the file, and observe failure. Then explain why recomputing the manifest defeats this check and how trusted signatures or out-of-band hashes help.

## Summary and verification scope
The Bash syntax, successful check, and tamper-detection case were tested in isolation. No actual CorePilot release package was authenticated, and no production installation, restart, or instance switch occurred.

