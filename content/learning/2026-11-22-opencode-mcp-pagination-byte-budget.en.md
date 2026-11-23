+++
title = "MCP pagination and byte budgets: why one item can exceed 32 KiB"
summary = "Learn from an OpenCode Bridge 65,614-byte response and design resumable, bounded pagination."
date = 2026-11-22
draft = false
tags = ["Java", "AI Architecture", "MCP", "OpenCode", "Pagination"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
OpenCode Bridge returned inputCount=1, returned=1, bytes=65614, truncated=true, hasMore=true, and nextCursor=null, followed by a failed 32768-byte assertion. A single message can contain a large tool result.

## Core concepts
**Byte budget**: measure the fully serialized UTF-8 JSON response, including metadata. **Pagination**: hasMore=true must have a documented, usable continuation mechanism. **Truncation**: mark incomplete data explicitly instead of pretending a partial message is complete.

## JavaScript teaching example
~~~javascript
function pageWithinBudget(items, maxBytes = 32768) {
  const bytes = value => Buffer.byteLength(JSON.stringify(value), "utf8");
  const out = [];
  for (const item of items) {
    const candidate = { messages: [...out, item], hasMore: true };
    if (bytes(candidate) > maxBytes) break;
    out.push(item);
  }
  const hasMore = out.length < items.length;
  return { messages: out, hasMore, nextCursor: hasMore ? String(out.length) : null };
}
// Demonstration only: production cursors must encode a stable server-side position.
~~~

This example demonstrates size checking, not a production paginator. If one item exceeds the limit, the empty page may not make progress. Production designs need within-message chunking, an explicit oversized error, or a recoverable summary; stable cursors and a final size check including metadata are essential.

## Common pitfalls
- Assuming limit=1 means fewer than 32 KiB.
- Using string.length instead of Buffer.byteLength for UTF-8.
- Measuring the body before adding JSON metadata.
- Returning hasMore=true with nextCursor=null.
- Using unstable offsets while the source changes.
- Cutting serialized JSON at an arbitrary byte offset.

## Senior interview question
One OpenCode message alone exceeds 32 KiB. How would you design chunking, cursors, response metadata, and tests to prevent data loss and infinite pagination loops? Answer before looking up a solution.

## 15-minute exercise
In an isolated test, create ASCII, non-ASCII and oversized messages. Check the final serialized byte count, boundary conditions, cursor progress, retries and source mutations. Do not touch production sessions.

## Summary
Correct pagination requires an actual byte ceiling, explicit completeness semantics and resumable continuation.
