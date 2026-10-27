+++
title = "Senior Java / AI：MCP 只读工具与可信人工批准边界"
date = 2026-10-26
draft = false
summary = "从 PromoLocal Photo Deal 审计理解工具注册、预览、权限隔离与创建操作的 NO-GO 边界。"
tags = ["Java", "AI Agents", "MCP", "Security", "API Contracts", "Architecture", "Testing"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实问题

PromoLocal Photo Deal TEST 3.0.0 的只读审计结论是：FastAPI 动态分类 GET 可以复用，但创建优惠的 POST 目前仍是 **NO-GO**。主要阻塞是可信的完整请求人工批准、MCP 可选文件元数据与后端必填字段的兼容、取消时的附件清理，以及提交结果不确定性。本文只讨论教学架构，不代表已部署 MCP 服务。

## 1. 先理解一个区别

**Prompt 写“不要调用”不等于工具不可调用。** 如果把 `create_photo_deal` 注册到 MCP 工具列表，模型仍有调用能力。第一阶段应在注册表层面只暴露 `list_photo_deal_categories`；商品、价格、门店、分类、actor 和三张照片角色只用于草稿准备与本地预览，不能写入数据库。

## 2. 为什么预览不等于批准？

用户看到的摘要可能遗漏字段。未来的可信批准应由服务端验证，绑定**完整规范化请求**、批准人、有效期和一次性标识；LLM 不能自己声明已获得批准。即使工具未注册，也应限制适配层凭据和网络访问，防止绕过 MCP 直接调用写入 API。

## 3. Java 17 可运行的最小模型

这是一个普通 Java 程序，用不可变 Map 模拟工具注册表；`preview` 不是 MCP 工具，也没有网络或数据库写入。文件 ID 是示例占位符。

~~~java
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

public class SafeMcpDemo {
    static final Map<String, Supplier<List<String>>> TOOLS =
        Map.of("list_photo_deal_categories", () -> List.of("grocery", "seafood"));

    record Draft(String product, BigDecimal price, String store,
                 String category, String actor, Map<String,String> photos) {}

    // Local preview only: not exported as an MCP tool.
    static String preview(Draft d) {
        if (d.product() == null || d.product().isBlank()
            || d.price() == null || d.price().signum() <= 0
            || d.store() == null || d.store().isBlank()
            || d.category() == null || d.category().isBlank()
            || d.actor() == null || d.actor().isBlank()
            || d.photos() == null
            || !d.photos().keySet().containsAll(
                 List.of("product", "price_tag", "store_context")))
            throw new IllegalArgumentException("incomplete draft");
        return d.product() + " | " + d.price() + " | " + d.store();
    }

    public static void main(String[] args) {
        if (TOOLS.containsKey("create_photo_deal"))
            throw new AssertionError("create tool exposed");
        if (!TOOLS.get("list_photo_deal_categories").get().contains("seafood"))
            throw new AssertionError("read-only lookup failed");
        Draft draft = new Draft("Salmon", new BigDecimal("9.99"),
            "Example Store", "seafood", "reviewer-1",
            Map.of("product","f1","price_tag","f2","store_context","f3"));
        if (!preview(draft).contains("Salmon"))
            throw new AssertionError("preview failed");
        System.out.println("PASS");
    }
}
~~~

本地演示的目标是验证注册表不包含创建工具、分类可查询、草稿可预览。实际 MCP 工具发现、文件元数据兼容和服务器授权仍需要独立集成测试。

## 4. Senior 常见陷阱

- 把 Instructions 当成权限控制，实际仍注册了 POST 工具。
- 只批准商品和价格，未绑定完整请求与照片引用。
- MCP 文件元数据不完整时，擅自编造后端必填字段。
- 用户取消后遗留孤儿附件，没有处理取消和清理的竞态。
- HTTP 超时后盲目重试 POST：服务端可能已提交，需要幂等键和结果对账。
- 仅隐藏 UI 按钮，却没有在服务端实施权限隔离。

## 5. Senior 面试题（先回答）

开发者将 `create_photo_deal` 注册为 MCP 工具，却只在 Instructions 中写“未经批准禁止调用”。**为什么仍然不安全？你如何证明第一阶段没有可调用的写入路径？未来怎样处理可信批准与超时后的不确定提交？** 先作答，不提供参考答案。

## 6. 15 分钟实战

1. 把代码保存为 `SafeMcpDemo.java`，运行 `javac --release 17 SafeMcpDemo.java && java SafeMcpDemo`。
2. 检查工具注册表里确实没有 `create_photo_deal`。
3. 删除草稿的 `price_tag`，确认预览拒绝不完整输入。
4. 画出未来创建流程：完整请求 → 人工批准 → 服务端验证 → 幂等提交 → 查询确认。**不要调用实际 POST。**

## 总结

**先限制 Agent 能调用什么，再指导它应该做什么。** 只读 GET 和本地预览可以独立交付；可信批准、附件生命周期和不确定提交未解决前，创建工具继续保持 NO-GO。
