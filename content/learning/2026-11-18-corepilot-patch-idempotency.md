+++
title = "Senior Java / AI：CorePilot 补丁重复应用、基线漂移与构建产物一致性"
date = 2026-11-18
draft = false
summary = "从 Prompt Studio 箭头补丁冲突，理解 git apply、幂等性与源码/静态产物验证。"
tags = ["CorePilot", "Git", "Release Engineering", "AI Architecture"]
categories = ["Learning"]
showComments = true
+++

## 实际学习背景
CorePilot Prompt Studio 的下拉箭头修改已经存在于当前 TSX/CSS 源码。旧补丁再次应用时发生冲突；基于当前源码重建的差异为零字节。隔离副本中的 TypeScript、4 项定向测试与 Next.js 构建通过，但既有生产静态目录 web/out 尚未包含统一箭头样式。**源码正确、补丁无差异、生产产物仍旧**是三种不同事实。

## 核心概念
**补丁幂等性**：重复执行同一变更不应产生额外修改；但 `git apply` 本身不是幂等操作，已应用的补丁通常无法再次正向应用。**基线漂移**：补丁的上下文与当前工作树不同，冲突既可能来自已应用，也可能来自其他修改，不能仅凭失败判定原因。**反向检查**：`git apply --reverse --check` 可以帮助判断补丁是否已存在，但也需检查目标源码和仓库状态。**产物一致性**：源码包含 CSS 不代表当前 web/out 已包含对应构建结果。空补丁仅表示对所比较的两份状态没有差异，不能证明发布完成。

## 只读诊断示例
~~~bash
# Run only inside an isolated Git checkout, never on production.
git status --short
if git apply --check change.patch; then
  echo "PATCH_APPLICABLE"
elif git apply --reverse --check change.patch; then
  echo "PATCH_ALREADY_PRESENT"
else
  echo "PATCH_CONFLICT_OR_DIFFERENT_BASE"
  exit 1
fi
~~~
在已确认补丁来源、目标目录和干净基线后，先只读检查。不要将 `--allow-empty` 的成功当作实际变更已部署的证据。不要直接覆盖生产 web/out。

## 常见陷阱
- 看到 `git apply` 失败就再次强制打补丁，可能破坏已有修改。
- 只运行 TypeScript 检查，不核实 Next.js 静态构建产物。
- 将隔离目录构建通过等同于浏览器已加载新资源。
- 忽略 Git 工作树中与本次补丁无关的改动。
- 把零字节补丁当成新版本的发布证明。

## Senior 面试题（先回答）
如果一个补丁正向检查失败、反向检查通过，源码中也能看到预期样式，但线上页面仍显示旧样式，你会怎样区分重复应用、构建过期、服务器旧文件与浏览器缓存？什么证据足以决定 GO / NO-GO？

## 15 分钟实战
在临时 Git 仓库创建一个文本文件、生成 diff、还原文件并验证正向应用；应用一次后验证反向检查通过且重复正向应用失败。最后只读比较构建目录与目标静态资源的哈希，记录未验证项。

## 总结与验证边界
已在临时 Git 仓库验证正向应用、反向检查及重复应用拒绝；未触碰 CorePilot 真实源码、服务或生产目录。此例仅为安全诊断教学，不是自动部署脚本。
