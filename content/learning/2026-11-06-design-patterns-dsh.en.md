+++
title = "Design Patterns and DeepSeek Harness: SOLID and Agent Architecture"
date = 2026-11-06T20:00:00-05:00
draft = false
description = "Design Patterns and DeepSeek Harness: SOLID and Agent Architecture"
tags = ["Design Patterns", "SOLID", "DeepSeek Harness", "AI Agent"]
categories = ["AI Architecture"]
+++

## Learning objectives

Understand the 23 GoF patterns, apply SOLID to an extensible LLM integration, and investigate DeepSeek Harness (DSH) plugin and agent lifecycle architecture.

## The 23 GoF patterns

The classic patterns comprise **5 creational, 7 structural, and 11 behavioral** patterns. Agent engineering particularly benefits from Strategy, Factory Method, Adapter, Observer, Command, State, Chain of Responsibility, and Decorator. Dependency Injection, middleware, and plugin architecture are useful architectural techniques outside the original 23.

## Strategy + Adapter + Dependency Injection

An agent should depend on an `LLMProvider` contract rather than a specific vendor SDK. Adapters translate provider-specific request and response formats; dependency injection selects implementations.

```java
public interface LLMProvider {
    LLMResponse generate(LLMRequest request);
}
public record LLMRequest(String prompt, String model) {}
public record LLMResponse(String content, int inputTokens, int outputTokens) {}
```

This is a teaching example, not a production-ready contract: streaming, tool calls, cancellation, timeouts, and error taxonomy are still needed.

## SOLID applied to agents

- **SRP:** Separate orchestration, model integration, and tool execution.
- **OCP:** Add providers without changing orchestration logic.
- **LSP:** Implementations must preserve their interface guarantees.
- **ISP:** Separate text generation from tool-calling capabilities.
- **DIP:** Depend on abstractions, not concrete SDKs.

A provider that silently ignores unsupported tools can break caller expectations.

## DeepSeek Harness source study

Investigate the plugin runtime, Agent Registry, Agent Factory, Agent Loop, Tool Registry, session storage, and sandbox. A factory contract separates agent creation from execution strategies. A handle exposing `dispose()` makes resource ownership explicit. Verify all concrete behavior against a pinned repository commit before claiming source-level confirmation.

## Security and trade-offs

A middleware chain can coordinate authorization, risky-operation detection, human approval, and audit. String matching alone is insufficient: sandboxing and least privilege are also required. Plugin systems improve extensibility while increasing lifecycle, compatibility, and debugging complexity.

## Interview exercises

1. Integrate Ollama without modifying the agent core; explain Strategy, Adapter, and DIP.
2. Uninstall a plugin during a 30-second tool call: reject new work, coordinate cancellation or completion, and release resources safely.

## Sources and verification

- [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
- [Agent registry](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/core/agent)
- [Agent loop](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/core/agent-loop)

> Architecture notes are based on the concepts discussed in class; individual implementation claims should be checked against a pinned commit before treating them as source-code evidence.
