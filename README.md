# Ze Hugo Personal Site

一个不依赖数据库的个人网站基础项目，包含：

- 个人介绍与简历页面
- 项目、学习、开发进度、文章四类内容
- 自定义响应式主题与明暗模式
- 本地全文搜索
- RSS 与 sitemap.xml
- SEO / Open Graph / JSON-LD
- Giscus 评论与 GitHub 表情反应
- GitHub Actions 构建检查
- Cloudflare Pages 部署方案

## 1. 本地运行

macOS：

```bash
brew install hugo
hugo version
hugo server --buildDrafts
```

浏览器打开：`http://localhost:1313`

当前 Hugo 官方快速入门建议使用 Hugo v0.158.0 或更高版本。本项目已采用 Hugo v0.146.0 之后的新模板目录结构。

## 2. 首次修改

编辑 `hugo.toml`：

```toml
baseURL = "https://你的域名/"
title = "你的站点标题"
```

编辑：

- `data/profile.yaml`：首页资料、技能和方向
- `content/about/_index.md`：完整个人介绍
- `content/projects/`：项目
- `content/learning/`：学习记录
- `content/progress/`：开发进度
- `content/posts/`：正式文章

## 3. 新建内容

```bash
./scripts/new-entry.sh learning rag-evaluation
./scripts/new-entry.sh progress 2026-07-24-progress
```

然后把新文件中的 `draft = true` 改成 `draft = false` 才会正式发布。

## 4. 配置 Giscus 评论和点赞反应

1. 把项目推送到公开 GitHub 仓库。
2. 在仓库 Settings → General 中启用 Discussions。
3. 安装 Giscus GitHub App，并允许访问该仓库。
4. 打开 giscus.app，选择仓库、Discussion 分类、pathname 映射和 reactions。
5. 将生成的 `repoId`、`categoryId` 等值复制进 `hugo.toml`。
6. 把 `[params.giscus]` 下的 `enabled = false` 改为 `true`。

Giscus 数据保存在你的 GitHub Discussions 中。关闭或移除脚本不会删除 Discussion 数据。

## 5. 部署到 Cloudflare Pages

1. 在 GitHub 创建仓库并推送代码。
2. Cloudflare Dashboard → Workers & Pages → Create application → Pages。
3. 选择 `Import an existing Git repository`。
4. 构建配置：

```text
Framework preset: Hugo
Build command: hugo --minify --gc
Build output directory: public
Environment variable: HUGO_VERSION = 0.158.0（或更新稳定版）
```

5. 部署后，在 Pages 项目的 Custom domains 中添加你的域名。
6. 如果域名仍由 Namecheap 管理，可按 Cloudflare 提示修改 nameservers，或使用它提供的 DNS 记录完成绑定。

## 6. Google 收录

网站发布后：

1. 在 Google Search Console 验证域名。
2. 提交 `https://你的域名/sitemap.xml`。
3. 对首页和重要文章使用 URL Inspection 请求索引。
4. 持续发布原创、有清晰标题和内部链接的内容。

Hugo 会自动生成 `sitemap.xml` 和 RSS `index.xml`。站点地图能帮助 Google 更高效地发现页面，但不能保证排名或立即收录。

## 7. 搜索

构建时自动生成 `/search-index.json`。搜索完全在浏览器本地执行，不需要数据库或外部搜索服务。

## 8. 推荐下一阶段

- Phase 1：替换真实资料、域名和社交链接
- Phase 2：连接 GitHub、Cloudflare Pages、Giscus
- Phase 3：加入中 / 法 / 英多语言
- Phase 4：从 GitHub Actions 或个人学习系统自动创建 Markdown 更新
- Phase 5：加入项目时间线、技能证据、访问统计和邮件订阅

## Design V2（美观版）

首页已经升级为现代技术作品集风格：

- Bento 网格能力卡片
- 交互式 AI 产品架构示意
- PromoLocal 重点案例仪表板
- 玻璃质感导航和完整深色模式
- 更清晰的内容分类卡片
- 滚动出现、状态脉冲和轻量 3D 交互
- 针对手机、平板和桌面分别优化

所有视觉效果均由原生 HTML、CSS 和少量 JavaScript 实现，不依赖大型前端框架，不会影响 Hugo 的静态部署优势。
