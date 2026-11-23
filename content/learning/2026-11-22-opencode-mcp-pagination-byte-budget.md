+++
title = "MCP 分页与字节预算：为什么 limit=1 仍可能超过 32 KiB"
summary = "结合 OpenCode Bridge 的 65614 字节响应，理解响应预算、截断与游标的正确语义。"
date = 2026-11-22
draft = false
tags = ["Java", "AI Architecture", "MCP", "OpenCode", "Pagination"]
categories = ["Learning"]
showComments = true
+++

## 实际问题
OpenCode Bridge 曾返回 inputCount=1、returned=1、bytes=65614、truncated=true、hasMore=true、nextCursor=null，随后 32768 字节断言失败。单条消息也可能包含很长的工具输出；限制消息数量不等于限制字节数。

## 核心概念
**Byte budget（字节预算）** 应以最终序列化后的 UTF-8 字节数计算，包含协议包装字段，而不是字符串字符数。**Pagination（分页）** 必须提供可继续的游标；hasMore=true 但 nextCursor=null 是不完整的分页契约，除非协议明确允许不可恢复的截断。**Truncation（截断）** 需要标识被截断的消息和安全的恢复策略，避免把部分消息伪装成完整数据。

## JavaScript 教学示例
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

示例只说明预算检测；若单个 item 本身超过预算，会返回空页且可能无法前进。生产实现应采用消息内分块、显式 oversized 错误或内容摘要，并给出可恢复游标；还要为最终 hasMore/nextCursor 包装重新计量字节。

## 常见陷阱
- 以 limit=1 假设一定小于 32 KiB。
- 用 string.length 而非 Buffer.byteLength 测 UTF-8 字节。
- 先测正文再加 JSON 包装，导致超预算。
- hasMore=true 却没有可用游标。
- 使用可变列表偏移量造成重复或遗漏；需要快照或稳定排序键。
- 截断 JSON 字节流导致无效 UTF-8 或损坏 JSON。

## Senior 面试题
如果一条 OpenCode 消息本身就超过 32 KiB，你会如何设计分块、游标、响应元数据和测试，既不丢失内容，也不会无限循环？先独立回答。

## 15 分钟实战
在隔离环境构造 ASCII、中文和超长单条消息，测量最终 JSON 的 Buffer.byteLength；测试预算边界、下一页可达性、重复请求和数据更新。不要读取或修改生产会话。

## 总结
可靠分页同时需要字节上限、明确的完整性语义和可继续的游标。
