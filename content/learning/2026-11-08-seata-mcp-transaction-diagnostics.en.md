+++
title = "Senior Java / AI: Seata MCP Transaction Diagnostics and Read-Only Agent Boundaries"
date = 2026-11-08
draft = false
summary = "Explore MCP diagnostic tool permissions, evidence correlation, and fencing tokens."
tags = ["Java", "AI", "Seata", "MCP"]
categories = ["Learning"]
showComments = true
+++

## Context
On November 8, we studied an overview of using an MCP server in the Seata console for transaction troubleshooting. Before integration, verify the exact available tools, permissions, and APIs against the deployed version's official documentation. An article is not an API contract.

## Core concepts
Distributed transaction diagnostics correlate the global transaction XID, branch records, locks, logs, and timestamps. MCP connects a model to tools; it does not automatically enforce business authorization. An AI diagnosis must not independently trigger destructive unlock, rollback, or deletion operations.

~~~text
User question -> LLM -> read-only MCP adapter -> authorized Seata console API
              -> structured evidence (XID, branch, lock, time) -> explanation
              -> human-approved remediation
~~~
Controls: least privilege, read-only defaults, server-side authentication and authorization, input validation, audit logs, redaction, timeouts, and rate limits. Logs returned by tools are untrusted data, not instructions.

## Java / Spring Boot example
Standalone teaching snippet: an AI Worker can finalize a diagnostic task only when its fencing version is still current.
~~~java
// Spring Data JPA: execute within a service @Transactional boundary.
@Modifying
@Query("UPDATE Job j SET j.status = 'DONE' WHERE j.id = :id AND j.status = 'PROCESSING' AND j.leaseVersion = :version")
int finishIfCurrent(@Param("id") Long id, @Param("version") long version);
~~~
Zero updated rows can mean a stale version, a changed status, or a missing task. Do not infer the cause without checking. Keep version validation and diagnostic persistence within one database transaction; reject stale results.

## Common pitfalls
- Assuming an exposed MCP tool is automatically authorized.
- Diagnosing root cause from XID alone without branch and lock evidence.
- Letting an LLM run destructive remediation without human approval.
- Persisting an AI result before the version check.
- Presenting model-generated explanations as verified facts.

## Senior interview question
A Seata global transaction appears stuck. An agent can read XID, branches, locks, and logs. How would you design read-only investigation, authorization, evidence attribution, and human-approved remediation? How would you stop an older AI Worker from overwriting a newer diagnosis? Answer before reviewing a solution.

## 15-minute exercise
Sketch “read-only MCP → evidence snapshot → recommendation → human approval”. Define requestId, XID, capture time, evidence source, and leaseVersion. Do not modify production transactions.

## Summary
MCP makes diagnostic evidence accessible to AI, while reliability still depends on verifiable evidence, least privilege, fenced writes, and human control.
