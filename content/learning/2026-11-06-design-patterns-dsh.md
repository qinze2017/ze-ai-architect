+++
title = "设计模式与 DeepSeek Harness：从 SOLID 到 Agent 插件架构"
date = 2026-11-06T20:00:00-05:00
draft = false
description = "设计模式与 DeepSeek Harness：从 SOLID 到 Agent 插件架构"
tags = ["Design Patterns", "SOLID", "DeepSeek Harness", "AI Agent"]
categories = ["AI Architecture"]
+++

## 今日学习目标

理解 GoF 23 种设计模式的分类，使用 Java 设计可替换的 LLM Provider，并以 DeepSeek Harness（DSH）为研究案例分析插件架构、Agent Loop 与资源生命周期。

## 1. 设计模式全景

GoF 共 **23 种模式**：创建型 5 种、结构型 7 种、行为型 11 种。Agent 系统尤其值得学习 Strategy、Factory Method、Adapter、Observer、Command、State、Chain of Responsibility 和 Decorator。Dependency Injection、Middleware、Event Sourcing 和 Plugin Architecture 很重要，但并非 GoF 模式。

## 2. Strategy + Adapter + Dependency Injection

Agent 不应硬编码某一家模型 SDK。通过统一的 Provider 接口，具体模型适配器负责请求转换、响应解析和能力差异；依赖注入负责选择实现。

```java
public interface LLMProvider {
    LLMResponse generate(LLMRequest request);
}

public record LLMRequest(String prompt, String model) {}
public record LLMResponse(String content, int inputTokens, int outputTokens) {}

@Service
public class AgentService {
    private final Map<String, LLMProvider> providers;
    public AgentService(Map<String, LLMProvider> providers) {
        this.providers = providers;
    }
    public LLMResponse execute(String name, LLMRequest request) {
        LLMProvider provider = providers.get(name);
        if (provider == null) throw new IllegalArgumentException("Unknown provider: " + name);
        return provider.generate(request);
    }
}
```

该代码是**教学示例**，尚未实现流式响应、工具调用、超时、取消和错误分类。

## 3. SOLID 在 Agent 中的意义

| 原则 | 架构应用 |
|---|---|
| SRP | Agent 编排、模型适配、工具执行分别负责一件事 |
| OCP | 新增模型时尽量不改 Agent 核心 |
| LSP | Provider 必须满足调用方期待的契约 |
| ISP | 将纯文本生成和 Tool Calling 能力拆分 |
| DIP | Agent 依赖接口而非 SDK 实现 |

**高级注意点**：一个不支持工具调用的模型不能悄悄忽略工具参数。应显式声明能力或拆分接口，避免违反 LSP/ISP。

## 4. DeepSeek Harness 架构研究

DSH 的研究重点是插件运行时、Agent Registry、Agent Factory、Agent Loop、Tool Registry、Session 和 Sandbox。通过注册工厂而非让调用方直接 new Agent Loop，可以分离创建契约与具体执行策略。Agent Handle 的 `dispose()` 代表资源所有权与清理责任。

```typescript
// 教学化的接口示意；请对照指定源码版本核验
interface AgentHandle {
  agent: Agent;
  dispose(): Promise<void>;
}
```

**研究方法**：先固定仓库 commit SHA，再从接口、实现、注册位置、调用链和测试五个方面查证。不要把架构推断当作已经逐行验证的事实。

## 5. Middleware 与安全

Agent 工具执行可经过权限检查、危险操作检测、人工审批、审计和隔离执行。责任链/管道有助于扩展，但字符串拦截无法替代操作系统沙箱、最小权限和操作审计。

## 6. 架构权衡

- 工厂与插件降低耦合，却增加动态注册、版本兼容和调试复杂度。
- 统一 LLM 接口便于替换，却可能掩盖模型能力差异。
- 事件机制提升可观察性，却要求处理事件顺序、失败和重复消费。
- 插件卸载应先阻止新任务，再协调运行任务取消或完成，最后释放资源。

## 7. 面试与复习

**题目 1：** 如何在不修改 Agent 核心代码的情况下接入 Ollama？回答需涉及 Strategy、Adapter、DIP 和能力协商。

**题目 2：** 插件卸载时 Agent 正在执行耗时工具，如何保证取消、超时、幂等和资源清理？

**下一步实战：** 克隆官方 DSH 仓库、记录 commit SHA，检查 Agent Registry、Factory 和 Agent Loop 的具体 TypeScript 文件与测试。

## Sources and verification

- [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness)
- [Agent registry](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/core/agent)
- [Agent loop](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/core/agent-loop)

> Architecture notes are based on the concepts discussed in class; individual implementation claims should be checked against a pinned commit before treating them as source-code evidence.
