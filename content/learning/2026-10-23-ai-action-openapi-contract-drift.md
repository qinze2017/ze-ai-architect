+++
title = "Senior Java / AI：OpenAPI 契约漂移、动态分类与安全集成"
date = 2026-10-23
draft = false
summary = "以 AI 识别促销照片为例，区分数据库分类、运行时 API 与 AI Action Schema，并设计契约测试。"
tags = ["Java", "AI Agents", "OpenAPI", "API Contracts", "Integration Testing", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## 今天的实际问题

AI 从促销照片识别商品并提交优惠。后台新增 `seafood` 分类，但公开 OpenAPI Action Schema 可能仍是旧版本。**分类在数据库中存在，不等于 AI 工具知道它，也不等于运行时 API 接受它。**

本课基于 PromoLocal 的集成讨论。下面的代码和 YAML 都是教学示例，不代表生产代码已经采用该实现；GPT 编辑器实际保存的 Schema 版本尚未核实。

## 1. 先分清三层事实

1. **数据库**：`seafood` 的 slug 是否存在，是否 active。
2. **运行时 API**：POST 接口接受哪些字段，是否动态校验分类，返回什么错误。
3. **AI Action 契约**：消费者实际加载的 OpenAPI 是否包含正确的路径、`operationId`、字段、`enum` 与认证方式。

这三层不一致就是 **contract drift（契约漂移）**。如果旧 Schema 只允许 `grocery | household`，AI 可能无法提交 `seafood`，即使数据库已支持。反过来，Schema 允许任意字符串，也不保证服务端认可它。

## 2. 正确排查顺序

1. 只读检查数据库：确认 slug 和 active，不要把显示名称当作 slug。
2. 检查公开 OpenAPI 的 `info.version`、`servers`、`operationId`、请求必填字段、枚举和安全方案。
3. 检查 AI Action 编辑器**实际保存**的 Schema；不要假设它自动重新导入。
4. 在隔离环境做契约测试：启用、禁用、未知分类，核对 HTTP 响应和持久化。
5. 对比破坏性变更：新增必填请求字段、改名、删除字段，以及可能影响严格客户端的枚举变化。

**版本号不能替代结构 diff 与真实测试；不应为验证候选契约而直接向生产写入。**

## 3. OpenAPI 教学示例

~~~yaml
openapi: 3.1.0
info:
  title: Example Photo Deal Integration
  version: 2.1.0
paths:
  /integrations/photo-deals:
    post:
      operationId: create_photo_deal
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [categorySlug]
              properties:
                categorySlug:
                  type: string
                  description: Server validates active slugs
      responses:
        '201':
          description: Created
~~~

这不是生产 Schema。没有静态 `enum` 不代表无需业务校验；实际接口还需认证、错误响应和幂等策略。

## 4. Java 17 动态分类校验

~~~java
import java.util.Map;
import java.util.Optional;

record Category(String slug, boolean active) {}

interface CategoryCatalog {
    Optional<Category> findBySlug(String slug);
}

final class CategoryValidator {
    private final CategoryCatalog catalog;

    CategoryValidator(CategoryCatalog catalog) {
        this.catalog = catalog;
    }

    void requireActive(String slug) {
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("category is required");
        }
        Category category = catalog.findBySlug(slug)
            .orElseThrow(() -> new IllegalArgumentException("unknown category"));
        if (!category.active()) {
            throw new IllegalStateException("category is inactive");
        }
    }
}

class CategoryValidatorDemo {
    public static void main(String[] args) {
        Map<String, Category> rows = Map.of(
            "seafood", new Category("seafood", true),
            "archived", new Category("archived", false)
        );
        CategoryValidator validator = new CategoryValidator(
            slug -> Optional.ofNullable(rows.get(slug))
        );
        validator.requireActive("seafood");
        try {
            validator.requireActive("archived");
            throw new AssertionError("inactive category accepted");
        } catch (IllegalStateException expected) {
            System.out.println("inactive category rejected");
        }
    }
}
~~~

以上 Java 17 代码已在本地编译运行。Map 仅模拟数据库；生产环境应由 Repository 查询可信数据源，并在适当事务边界内完成校验与写入。

## 5. Senior 常见陷阱

- 后台新增分类，不代表 AI Action 已更新。
- `info.version` 改了，不代表运行时兼容。
- 删除 OpenAPI 静态 `enum`，不代表服务端可接受所有字符串。
- HTTP 成功不等于数据持久化正确；需要验证写入与重复提交。
- 新增必填请求字段通常破坏旧客户端；枚举新增值也可能破坏严格解析。

## 6. Senior 面试题（请先自行回答）

AI Action 保存的 Schema 只允许 `grocery | household`。后台创建启用的 `seafood`，后端已动态读取分类，但 AI 仍无法提交。

**你会按什么顺序排查？为什么只修改数据库或只修改 OpenAPI 都不足以证明端到端成功？**

## 7. 15 分钟实战

1. 只读检查公开 Schema 的版本、operationId 和分类字段的 enum。
2. 运行 Java 示例，并添加“未知分类”拒绝测试。
3. 设计旧客户端兼容、新分类成功、未知分类拒绝三项隔离契约测试。
4. 记录证据、预期和实际结果；未执行的测试必须标注“未验证”。

**验收**：能区分“数据库存在”“API 接受”“AI Action 知道”三个独立条件。

## 总结

**新增分类是数据变更，更新 OpenAPI 是契约变更，重新导入 Action 是消费者配置变更。** 应分别验证，而不是用一个版本号或一次成功响应替代端到端证据。
