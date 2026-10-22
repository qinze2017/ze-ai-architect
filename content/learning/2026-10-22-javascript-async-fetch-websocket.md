+++
title = "Senior Java：JavaScript 异步、Fetch/AJAX 与 WebSocket 数据同步"
date = 2026-10-22
draft = false
summary = "从 Event Loop 到 HTTP 异步请求与 WebSocket 推送，理解 Web/手机端数据共享、断线恢复和一致性。"
tags = ["JavaScript", "WebSocket", "AJAX", "Fetch API", "Full-Stack", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## 学习目标

学完这一课，能够解释：JavaScript 同步与异步的区别、Promise 与 Event Loop 的关系、AJAX / Fetch 和 WebSocket 的边界，以及 Web 和手机端如何在数据变化时保持一致。

以**自动化养殖管理平台**为业务示例：后台计算费用、接收测量数据，Web 和手机端共享同一份业务信息。**以下是帮助理解的示例架构，并非声称某个历史项目一定采用了这些实现。**

## 1. 同步、异步的本质

**同步**：当前 JavaScript 代码按顺序执行。**异步**：发起网络请求、计时器等操作后，不必阻塞整个页面等待结果；待结果就绪，再调度回调或 Promise 的后续代码。

~~~javascript
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
// A → D → C → B
~~~

为什么？同步代码先跑完；Promise 的回调属于 **microtask（微任务）**，会先于这里的 timer task 执行。Event Loop 协调这些任务。**async/await 是 Promise 的易读写法，不会自动为每个请求创建新线程**；await 暂停当前 async 函数的后续执行，不会冻结整个页面。

## 2. AJAX 与 Fetch：异步 HTTP 请求

假设需要查询最新测量数据，后端提供 GET /api/measurements。原生 Fetch 的写法：

~~~javascript
async function loadMeasurements() {
  const response = await fetch("/api/measurements");
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }
  const data = await response.json();
  document.querySelector("#temperature").textContent =
    String(data.temperature);
}

loadMeasurements().catch(console.error);
~~~

如果使用 jQuery，也可以写：

~~~javascript
$.ajax({
  url: "/api/measurements",
  method: "GET",
  success: function (data) {
    updateDashboard(data);
  },
  error: function (xhr) {
    console.error("Request failed:", xhr.status);
  }
});
~~~

两者都可以**异步发起 HTTP 请求并处理响应**；它们本身不会持续监听服务器。需要定期刷新时，可以做 **Polling（轮询）**。注意：Fetch 遇到 HTTP 404/500 时通常不会自动 reject，需要检查 response.ok；网络错误才会通常导致 Promise reject。

## 3. WebSocket：持续连接与服务器推送

WebSocket 一般先经 HTTP Upgrade 握手，然后双方在持续连接上交换消息（生产环境通常用 wss://）。新测量数据到达服务器后，服务器可以主动向已连接客户端发送更新事件，无须客户端每次重新发起 HTTP 请求。

~~~javascript
const socket = new WebSocket("wss://your-domain.test/ws/measurements");

socket.addEventListener("message", (event) => {
  try {
    const message = JSON.parse(event.data);
    if (message.type === "measurement.updated") {
      refreshMeasurements(); // 再通过 API 拉取权威状态
    }
  } catch (error) {
    console.error("Invalid message", error);
  }
});

socket.addEventListener("close", () => {
  console.warn("Disconnected: reconnect and resync needed");
});
~~~

以上是**教学片段，不是生产级完整客户端**；生产系统还需要授权、重连退避、心跳/存活检测、订阅权限与错误监控。客户端收到消息后，可用 JavaScript 处理 JSON 并更新 UI。

| 技术 | 通信特征 | 常见用途 |
| --- | --- | --- |
| Fetch / AJAX | 客户端发起 HTTP 请求 | 查询、提交费用、保存表单 |
| Polling | 周期性发起 HTTP 请求 | 简单的定期刷新 |
| WebSocket | 持续双向连接，可由服务器主动推送 | 状态通知、测量数据更新 |
| SSE | 服务器经 HTTP 向客户端单向发送事件 | 通知流、单向更新 |

**不要混淆：JavaScript 的“异步执行方式”不等于 WebSocket“通信协议”；Web 与手机端共享数据也不证明一定使用了 WebSocket。**

## 4. 设计案例：Web 与手机端共享数据

一个稳健的设计可以按如下流程实现：

1. Web 或手机端通过 REST API 查询最新费用和测量结果。
2. 用户修改费用 → 后端验证业务规则并写入数据库。
3. **提交成功后**再发送“费用已更新”事件，避免客户端误认为未提交的数据已经生效。
4. 订阅 WebSocket 的客户端收到事件，再 GET 最新状态，更新页面。
5. 断线重连后主动重新查询权威状态；**WebSocket 消息不应被当成唯一数据来源**。

如果两端同时修改同一条记录，需要额外设计并发控制，例如**乐观锁版本号**（version）、409 Conflict 或明确的业务合并策略。仅有 WebSocket 无法解决“谁的修改覆盖谁”的问题。

### 关键失败场景

- **掉线遗漏消息**：重连后执行全量/增量同步。
- **重复或乱序事件**：携带记录 ID、版本或事件序号，更新应幂等。
- **权限问题**：鉴权并限制频道/数据范围，不向无权客户端广播敏感信息。
- **提交与推送之间崩溃**：重要业务可考虑 Transactional Outbox + Worker；不是所有系统都需要。

## 5. 15 分钟动手练习

在本地准备一个返回 JSON 的 /api/measurements 接口。

1. 用 fetch() 读取测量值并显示；增加 HTTP 错误处理。
2. 每隔 5 秒发起一次请求，观察 Polling；注意避免请求重叠。
3. 写一个独立的 WebSocket message 回调，模拟收到 measurement.updated 后重新 fetch。
4. 思考：网络断开 30 秒后，客户端如何确认自己没有遗漏更新？

**验收**：能解释 Fetch 是请求/响应、WebSocket 是双向持续连接、Promise 回调异步调度，以及“消息通知”和“数据库真实状态”的区别。

## 6. Senior Java 面试问题

**Q1. await 会阻塞整个浏览器吗？** 不会。await 暂停当前 async 函数后续执行，其他事件仍可被处理；CPU 密集同步代码仍可能阻塞主线程。

**Q2. Fetch 是否等于 WebSocket？** 不是。Fetch 使用 HTTP 请求/响应；WebSocket 建立持续双向连接。

**Q3. WebSocket 断线后如何恢复数据？** 退避重连后通过 API 拉取最新快照，必要时使用版本/游标补齐事件；不要假设推送可靠且从不丢失。

**Q4. 两端同时修改费用怎么办？** 由后端验证并发冲突（如乐观锁），定义冲突反馈/重试策略；不能单靠前端推送保证一致性。

## 总结

**异步解决等待时如何继续工作；Fetch / AJAX 解决 HTTP 请求；WebSocket 解决持续双向消息传递；数据库事务与并发控制解决业务状态一致性。** 选择技术要从业务的时效性、复杂度和可靠性要求出发。

参考：[MDN JavaScript Event Loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model) · [MDN Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) · [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
