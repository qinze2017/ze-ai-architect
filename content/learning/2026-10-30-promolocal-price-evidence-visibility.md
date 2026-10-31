+++
title = "Senior Java / AI：PromoLocal 如何只展示有价格证据的商品？"
date = 2026-10-30
draft = false
summary = "用真实的商品目录需求理解价格证据门禁、EXISTS、分页一致性和 AI 草稿与公开事实的边界。"
tags = ["Java", "AI", "PostgreSQL", "Data Quality", "PromoLocal", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实项目背景

10 月 30 日，PromoLocal 的产品方向收敛到 **Rabais、Produits、Communauté**：Rabais 应有价格和日期证据，Produits 应有价格历史，Communauté 负责照片与价格分享、验证。暂时隐藏 Comparer，并且不在商品目录显示没有价格记录的空商品。

这不仅是前端隐藏元素的问题，更是 **Data Quality Gate（数据质量门禁）**。本文是教学方案，不声称下面的字段就是当前生产数据库结构，也不代表已经部署。

## 核心概念

**商品主数据存在，不等于价格已被观察到。** 一个稳妥的候选规则是：只有至少一条已批准、金额大于零、关联门店、观察日期有效的价格记录，才把商品列入公开 Produits。批准状态属于建议的业务规则，须与现有后台审核流程对齐。

历史价格可以继续保留在价格历史中；但历史价格**不能自动成为当前 Rabais**，现行促销还要检查活动日期、来源和可核实的优惠证据。AI 从照片中识别的金额应先作为候选数据，而不是自动公开的事实。

## SQL 与 Java 17 示例

以下 SQL 使用**假设的** `products` 和 `price_observations` 表。用 `EXISTS` 可以要求存在至少一条合格记录，又不会因多条价格历史重复返回商品。Java 示例不访问生产环境，已用 Java 17 目标版本编译并运行。

~~~sql
SELECT p.id, p.name
FROM products p
WHERE EXISTS (
    SELECT 1
    FROM price_observations e
    WHERE e.product_id = p.id
      AND e.status = 'PUBLISHED'
      AND e.amount > 0
      AND e.store_id IS NOT NULL
      AND e.observed_at <= CURRENT_TIMESTAMP
);
~~~

将 Java 代码保存为 `PriceEvidenceGateDemo.java`，执行 `javac --release 17 PriceEvidenceGateDemo.java && java PriceEvidenceGateDemo`。预期输出：`PASS: 5 price-evidence visibility cases`。五个断言覆盖已批准、待审核、零价格、未来日期、无记录。金额使用 `BigDecimal`，测试时钟固定以保证可复现。

~~~java
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class PriceEvidenceGateDemo {
    record PriceEvidence(long productId, BigDecimal amount, String storeId,
                         Instant observedAt, boolean approved) {}

    static boolean usable(PriceEvidence e, Instant now) {
        return e != null && e.approved() && e.amount() != null
            && e.amount().signum() > 0 && e.storeId() != null
            && !e.storeId().isBlank() && e.observedAt() != null
            && !e.observedAt().isAfter(now);
    }

    static boolean visible(long productId, List<PriceEvidence> evidence, Instant now) {
        return evidence.stream().anyMatch(e -> e != null
            && e.productId() == productId && usable(e, now));
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        Instant now = Instant.parse("2026-10-30T22:00:00Z");
        PriceEvidence approved = new PriceEvidence(101L, new BigDecimal("2.99"),
            "Super C", now.minusSeconds(3600), true);
        PriceEvidence pending = new PriceEvidence(102L, new BigDecimal("3.99"),
            "Maxi", now.minusSeconds(3600), false);
        PriceEvidence zero = new PriceEvidence(103L, BigDecimal.ZERO,
            "IGA", now.minusSeconds(3600), true);
        PriceEvidence future = new PriceEvidence(104L, new BigDecimal("4.99"),
            "IGA", now.plusSeconds(3600), true);
        List<PriceEvidence> records = List.of(approved, pending, zero, future);
        check(visible(101L, records, now), "approved evidence should be visible");
        check(!visible(102L, records, now), "pending evidence must not count");
        check(!visible(103L, records, now), "zero price must not count");
        check(!visible(104L, records, now), "future observation must not count");
        check(!visible(105L, records, now), "missing evidence must not count");
        System.out.println("PASS: 5 price-evidence visibility cases");
    }
}
~~~


## 常见陷阱

1. 仅在 React 中隐藏：API、搜索、SEO 和分页总数仍不一致。
2. 先分页 20 条，再删除无价格商品：会出现只有一两条的页面，`total` 仍错误。
3. 直接 JOIN 多条历史记录：同一商品可能重复出现。
4. 把 AI/OCR 提取值当成已审核事实：价格、单位、日期、门店都可能识别错误。
5. 将历史价误当成仍有效的促销。
6. 仅隐藏 Comparer 菜单：不代表相关路由和 API 已按设计关闭。

## Senior 面试题（先自行作答）

假设有 2,000 个商品，只有 100 个有合格价格记录。API 先对全部商品按 ID 分页（每页 20），前端再过滤，导致页面常只有 1～2 个商品，但总数仍显示 2,000。**你如何设计后端查询、总数统计、缓存失效，避免 N+1 并保持分页一致？** 本文不公布参考答案。

## 15 分钟实战

1. 编译运行 Java 示例，确认 5 项断言。
2. 给商品 101 增加第二条合格价格记录，说明为何列表仍只能出现一次。
3. 在开发环境使用假数据比较 `EXISTS` 和普通 `JOIN` 的结果。
4. 分别写下 Produits、Rabais、Communauté 允许公开的证据状态；确认 Comparer 的菜单、页面和 API 是否一致处理。不要修改生产数据库或部署。

## 总结

**商品存在 ≠ 有价格证据；历史价 ≠ 当前促销；AI 提取 ≠ 审核通过。** 证据门禁应落在后端查询与发布流程，不能只靠 UI 隐藏。

验证范围：Java 示例已用 `javac --release 17` 编译并运行；示意 `EXISTS` 查询在 SQLite 内存库通过 5 个商品的检查；未在真实 PostgreSQL schema、Spring Boot 集成或线上环境验证。
