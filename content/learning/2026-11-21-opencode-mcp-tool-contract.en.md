+++
title = "Senior Java / AI: OpenCode MCP Tool Contracts and Failure Semantics"
summary = "Learn MCP tool registration, session_id validation, CallToolResult adaptation, and contract testing from an OpenCode bridge."
date = 2026-11-21
draft = false
tags = ["Java", "AI Architecture", "MCP", "OpenCode", "Contract Testing"]
categories = ["Learning"]
showComments = true
+++

## Practical context

Today's OpenCode MCP bridge debugging covered the registerTool handler signature, extraction of session_id, and protocol-compliant tool results. Node syntax and MCP Inspector tools/list checks were performed. The Java example below teaches business-level validation, not MCP server implementation.

## Core concepts

**Tool Contract:** the name, input schema, output shape, and failure semantics define the tool's externally observable behavior.

**Protocol Boundary:** an adapter must transform domain results into the SDK's expected CallToolResult structure.

**Contract Testing:** independently test tools/list, tools/call, missing inputs, downstream errors, and output structure. Discovery alone does not prove invocation works.

**Fail-Closed:** reject missing or unauthorized session IDs rather than silently falling back to another session.

## Java 17 teaching example

This intentionally simplified example **does not** serialize MCP messages:

~~~java
import java.util.*;
public class McpToolResultCheck {
  record Result(List<String> content, boolean isError) {}
  static Result validate(Object sessionId, List<String> messages) {
    if (!(sessionId instanceof String id) || id.isBlank())
      return new Result(List.of("session_id is required"), true);
    if (messages == null) return new Result(List.of("messages unavailable"), true);
    return new Result(List.of("messages=" + messages.size()), false);
  }
  public static void main(String[] args) {
    if (!validate("s1", List.of("hello")).content().equals(List.of("messages=1"))) throw new AssertionError();
    if (!validate(null, List.of()).isError()) throw new AssertionError();
    if (!validate("s1", null).isError()) throw new AssertionError();
    System.out.println("PASS");
  }
}
~~~

The sample was compiled with javac --release 17 and executed successfully (PASS). A real implementation must use the appropriate MCP SDK, content blocks, isError semantics, and session authorization.

## Common pitfalls

- Treating successful tool discovery as proof that tools/call works.
- Using a handler signature from a different SDK version.
- Reading session_id from the wrong argument level.
- Returning a raw string instead of a protocol-compliant result.
- Reporting domain failures as successful tool calls.
- Logging sensitive session contents or skipping authorization.

## Senior interview question (answer first)

tools/list succeeds, but getSessionMessages fails on tools/call. How would you separate protocol, validation, authorization, and downstream failures, and what contract tests would you require before release?

## 15-minute exercise

In an isolated environment, invoke a tool with a valid session, a missing session_id, an unauthorized session, and a downstream exception. Record the returned shape and error flag. Do not write production session data.

## Summary

Tool discovery, tool invocation, successful domain execution, and protocol compliance are four separate acceptance checks.