+++
title = "Senior Java / React：PromoLocal 恢复刷新时，如何防止旧请求覆盖新数据？"
date = 2026-10-31
draft = false
summary = "从 PromoLocal 的真实审查学习请求竞态、刷新合并、分页状态和安全发布门禁。"
tags = ["Java", "React", "Concurrency", "PromoLocal", "Architecture", "Async"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实项目背景

10 月 31 日，PromoLocal 的 Rabais 页面在 R2.1.2 审查中暴露两个风险：页面从后台恢复时，如果已有请求尚未完成，可能没有重新获取最新有效优惠；地图刷新可能在缺乏权威结果时重置分页。因此该候选版本被判为 **NO-GO**。后续 R2.1.3 审查又发现，相隔约 5 毫秒的恢复事件可触发 3 次请求、2 次取消。R2.1.4 采用共享 75 毫秒合并窗口（最长延迟 500 毫秒）；项目记录显示 53 项测试及构建、Lint、TypeScript 检查通过，但当时**尚未 push 或部署**。这些数字来自项目审查记录，并非本文独立执行的集成测试。

本文讨论的是**异步一致性**，与 10 月 30 日的价格证据过滤是不同问题。代码为独立教学示例，并非现有生产代码。

## 核心概念：三道不同的防线

**1. 合并刷新事件（coalescing）**：visibilitychange、窗口焦点恢复等事件可能连续触发。将短时间内的多个刷新意图合并，避免重复请求；合并窗口不等于数据新鲜度保证。

**2. 取消旧请求（AbortController）**：新请求启动时尽量取消旧请求，减少无效网络与解析工作。但取消并不等于旧异步回调绝不执行，因此还要验证结果归属。

**3. 结果世代号（request generation）**：每次启动新的权威请求时递增 ID。只有最新 ID 且成功的响应，才允许更新商品列表和分页。筛选条件变化也必须让旧响应失效。

分页原则：**只有收到与当前查询条件匹配的成功响应后，才能根据服务端的 totalPages 校正页码**。失败、取消、过期响应都不得把用户从第 3 页跳回第 1 页。示例使用从 1 开始的页码；真实项目须与 API 的 0/1 起始约定保持一致。

## Java 17 可运行示例

这个小程序把 React 中的“最新请求才可写入 UI 状态”抽象成 Java 状态门禁；它按顺序模拟响应乱序到达，不需要浏览器或数据库。保存为 StaleResponseGateDemo.java，运行：

~~~bash
javac --release 17 StaleResponseGateDemo.java
java StaleResponseGateDemo
~~~

~~~java
public final class StaleResponseGateDemo {
    private long latestRequestId = 0;
    private int page = 3;
    private String data = "existing";

    long beginRequest() { return ++latestRequestId; }

    boolean accept(long requestId, boolean succeeded,
                   int totalPages, String responseData) {
        if (!succeeded || requestId != latestRequestId) return false;
        data = responseData;
        page = Math.min(page, Math.max(1, totalPages)); // 1-based pages
        return true;
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        StaleResponseGateDemo gate = new StaleResponseGateDemo();
        long oldRequest = gate.beginRequest();
        long currentRequest = gate.beginRequest();
        check(!gate.accept(oldRequest, true, 1, "stale"), "reject old response");
        check(gate.page == 3, "old response must not reset page");
        check(gate.accept(currentRequest, true, 2, "fresh"), "accept latest response");
        check(gate.page == 2 && gate.data.equals("fresh"), "clamp after success");
        long failedRequest = gate.beginRequest();
        check(!gate.accept(failedRequest, false, 1, "failed"), "reject failure");
        check(gate.page == 2 && gate.data.equals("fresh"), "preserve state on failure");
        System.out.println("PASS: 6 stale-response and pagination assertions");
    }
}
~~~

预期输出：**PASS: 6 stale-response and pagination assertions**。已在本地用 javac --release 17 编译并运行通过。示例只演示结果门禁；实际 React 代码还需要管理 AbortController、清理 effect、合并事件和筛选条件的请求键。

## 常见陷阱

1. **只做 debounce**：减少请求数量，却允许较早响应覆盖较晚响应。
2. **只调用 abort()**：忽略取消时机与已排队回调的竞态。
3. **收到任何响应就 setPage(1)**：用户浏览位置被不必要地重置。
4. **请求失败时用空数据当成功**：清空列表并错误校正分页。
5. **只比较 request ID，不在筛选变化时递增**：旧筛选结果仍可能污染新视图。
6. **测试通过就自动部署**：本地测试、Git 提交、CI 和线上验证是不同门禁。

## Senior 面试题（先自行作答）

用户停留在 Rabais 第 3 页，切换浏览器标签后返回；此时旧请求 A 未完成，刷新事件几乎同时触发 B 和 C。A 最后返回，B 被取消，C 成功且服务端报告仅有 2 页。**你如何设计刷新合并、请求取消、响应归属判断与分页校正？如果 C 失败，页码应如何处理？** 请先自行回答，本文不公布参考答案。

## 15 分钟实战

1. 编译运行上面的 Java 17 示例，确认 6 项断言。
2. 把旧响应的 accept 检查移到最新响应之后，确认旧响应仍不能覆盖数据。
3. 在开发环境记录连续 visibilitychange/focus 的触发次数、网络请求数与取消次数，验证合并策略；不要访问生产写入接口。
4. 检查页面是否只在成功且匹配当前筛选条件的响应后调整页码。未经审查，不 push、不部署。

## 总结

**合并事件控制请求数量；取消减少浪费；世代号保护结果正确性；分页只服从成功的权威响应。** 这是跨 React、Java 异步任务和 AI Worker 都适用的“过期结果不能覆盖新状态”原则。本文的 Java 示例已独立编译运行；未声称完成真实前端集成或生产验证。
