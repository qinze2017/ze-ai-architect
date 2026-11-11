+++
title = "Senior Java / AI: Reproducible Builds and Release Gates for CorePilot"
date = 2026-11-10
draft = false
summary = "Use CorePilot RB.2 to separate functional checks, reproducible artifacts and production release evidence."
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
On November 10, CorePilot RB.2 passed 60 isolated checks, yet production remained **NO-GO**. Python wheel byte-for-byte reproduction passed; Web cross-directory reproduction failed. Under a fixed path, 103 files matched. Real iPhone/Safari, production Keychain and deployment compatibility were not yet validated.

## Core concepts
**Functional correctness** measures behavior; a **reproducible build** yields byte-identical deliverables from declared inputs and controlled environments; a **release gate** requires sufficient deployment evidence. Cross-directory differences may arise from absolute paths, timestamps, ordering, environment variables or tool versions, but none is proven as the cause. Record lockfiles, input hashes, toolchain versions and environment settings.

## Java 17: artifact-tree fingerprint
~~~java
import java.nio.file.*;
import java.security.*;
import java.util.*;
public class TreeDigest {
  static String digest(Path root) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-256");
    try (var paths = Files.walk(root)) {
      for (Path p : paths.filter(Files::isRegularFile)
          .sorted(Comparator.comparing(x -> root.relativize(x).toString())).toList()) {
        md.update(root.relativize(p).toString().replace('\\','/')
            .getBytes(java.nio.charset.StandardCharsets.UTF_8));
        md.update((byte) 0);
        md.update(Files.readAllBytes(p));
      }
    }
    return HexFormat.of().formatHex(md.digest());
  }
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("two directories required");
    String a = digest(Path.of(args[0])), b = digest(Path.of(args[1]));
    System.out.println(a.equals(b) ? "PASS identical trees" : "FAIL different trees");
    if (!a.equals(b)) System.exit(1);
  }
}
~~~

Compile with `javac --release 17 TreeDigest.java` and run with `java TreeDigest buildA buildB`. This educational example hashes relative paths and bytes, not metadata, permissions or symlink semantics; it is not a complete supply-chain attestation.

## Common pitfalls
- Treating 103 matching files under one fixed path as cross-directory reproducibility.
- Mistaking passing isolated tests for real-device or production approval.
- Comparing bytes but ignoring relative paths, permissions or symlinks.
- Excluding divergent deliverables merely to obtain PASS.
- Changing production configuration before diagnosing the root cause.

## Senior interview question
CorePilot's Python wheel is reproducible, while Web cross-directory builds differ. All functional checks pass. Would you authorize deployment? Propose a minimal experiment to locate the difference and explicit GO/NO-GO criteria. Answer before viewing any reference solution.

## 15-minute exercise
Create two temporary directories with matching files and run TreeDigest (PASS). Change one file and rerun (FAIL, exit code 1). List missing evidence for real Safari, production Keychain and deployment compatibility. Do not touch production.

## Summary
Passing tests, reproducible artifacts and production readiness are separate claims. Unexplained cross-directory drift and missing release evidence warrant NO-GO.
