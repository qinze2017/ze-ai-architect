+++
title = "Senior Java / AI: Verifying the Actual HTTP Artifact Served by CorePilot"
date = 2026-11-11
draft = false
summary = "Use SHA-256 to distinguish local build output from the bytes a CorePilot endpoint actually serves."
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
On November 11, you prepared read-only checks for the CorePilot API, the iPhone HTTPS endpoint, the SHA-256 of `web/out/create/index.html`, and the SHA-256 of the actual `/create/` HTTP response. Without the complete command output, parity cannot be claimed.

## Core concepts
A **build artifact** is a file on disk; a **served artifact** is the response body delivered to a client. Reverse-proxy routing, stale processes, caches, redirects, or an error page can make them differ. HTTP 200 alone does not establish that the intended version was served. Matching hashes establish equality of the compared bytes, not overall security or release readiness.

## Java 17 example
The program hashes a local file and the body of an HTTP 200 response. `BodyHandlers.ofByteArray()` avoids character decoding differences. The example compiled with `javac --release 17`; it has not been integration-tested against CorePilot.

~~~java
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.security.*;
import java.util.HexFormat;
public class ArtifactParity {
  static String sha(byte[] bytes) throws Exception {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  }
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("local file and HTTP URL required");
    byte[] local = Files.readAllBytes(Path.of(args[0]));
    HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    HttpResponse<byte[]> response = client.send(
        HttpRequest.newBuilder(URI.create(args[1])).GET().build(),
        HttpResponse.BodyHandlers.ofByteArray());
    if (response.statusCode() != 200)
      throw new IllegalStateException("HTTP " + response.statusCode());
    String a = sha(local), b = sha(response.body());
    System.out.println("local=" + a + "\nserved=" + b);
    if (!a.equals(b)) { System.err.println("MISMATCH"); System.exit(1); }
    System.out.println("MATCH");
  }
}
~~~

Compile with `javac --release 17 ArtifactParity.java`, then run `java ArtifactParity /path/to/index.html https://example.test/create/`. Substitute a trusted test endpoint for the placeholder URL.

## Common pitfalls
- Treating a 200 response as proof that the correct page was returned.
- Hashing only local files instead of the real network response.
- Ignoring caches, redirects, or authentication and error pages.
- Confusing compressed transfer bytes with the decoded response body.
- Assuming one matching page validates all routes, permissions, and mobile behavior.

## Senior interview question
The local `index.html` hash differs from the hash of the HTTP response, even though the status is 200. How would you isolate the cause and define the evidence required for a release decision? Answer before reading any solution.

## 15-minute exercise
Read-only: hash the local HTML file, save the HTTP response to a temporary file, and hash that file. Record URL, status, headers, timestamp, and both digests. A successful `curl -k` request does not validate the server's TLS identity. Do not restart or deploy anything.

## Summary
An existing build artifact, HTTP 200, byte-for-byte parity, and approval for production release are separate pieces of evidence.