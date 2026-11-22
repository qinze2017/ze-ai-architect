+++
title = "Senior Java / AI：OpenCode MCP 工具契约与失败语义"
summary = "从 OpenCode MCP bridge 的工具注册、参数读取和 CallToolResult 返回值，理解协议边界、契约测试和安全失败。"
date = 2026-11-21
draft = false
tags = ["Java", "AI Architecture", "MCP", "OpenCode", "Contract Testing"]
categories = ["Learning"]
showComments = true
+++

## 实际学习背景

今天在 OpenCode MCP bridge 中排查了 registerTool 调用形式、session_id 参数解析和工具返回结构；使用 Node 语法检查与 MCP Inspector 的 tools/list 检查工具发现。这里把实践抽象为跨语言 API 契约课程，不宣称 Java 示例实现了 MCP 服务器。

## 核心概念

**Tool Contract（工具契约）**：工具名、输入 schema、返回结构和错误语义共同决定客户端能否可靠调用。

**Protocol Boundary（协议边界）**：业务逻辑返回的数据需要由适配层转换为协议要求的 CallToolResult；仅业务方法成功不代表协议消息有效。

**Contract Test（契约测试）**：至少检查 tools/list、合法参数调用、缺失参数、下游失败与返回结构。发现成功不等于调用成功。

**Fail-Closed（安全失败）**：session_id 缺失或访问受限时拒绝读取，不回退到任意默认会话。不要把用户输入直接当成可信授权。

## Java 17 教学代码

以下为简化的 Java 业务结果验证示例，**不是** MCP JSON 序列化器，也不替代 MCP SDK：

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

本次使用 javac --release 17 编译并执行，输出 PASS。真实 MCP 服务器仍需用对应 SDK 产生合法的 content 数组、文本块、isError 字段，并对 session_id 做权限校验。

## 常见陷阱

- 工具在 tools/list 可见，就认为 tools/call 一定正常。
- registerTool 的 handler 签名不符合 SDK 版本要求。
- 从错误的参数层级读取 session_id。
- 返回裸字符串或业务对象而非协议结构。
- 将错误文本包装为成功响应，导致 Agent 继续错误决策。
- 日志打印会话敏感内容或将不存在的会话当作空会话。

## Senior 面试题（先回答）

工具发现成功，但 getSessionMessages 在 tools/call 阶段失败。你会如何设计注册、参数校验、权限检查、返回适配和契约测试，区分协议错误、业务错误和下游故障？请先自行回答。

## 15 分钟实战

在隔离环境检查工具列表，分别模拟合法 session_id、缺失 session_id、无权访问和下游异常；记录每个响应的结构与错误标记。不要在生产环境执行会话数据写入。

## 总结

工具被发现、工具被调用、业务执行成功和返回协议正确，是四个必须分别验证的环节。