+++
title = "Senior Java / AI：CorePilot 前端目录切换、回滚与发布门禁"
date = 2026-11-12
draft = false
summary = "从 CorePilot A+9.2 实际切换记录学习文件系统发布的故障恢复与验证边界。"
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## 实际背景
11 月 12 日，CorePilot A+9.2 的前端候选目录被切换到 `web/out`，终端显示 `RESULT: A+9.2 SWITCH PASS`，并保留了旧版本回滚目录。但随后浏览器中预期功能仍未显示。这证明**目录切换成功**和**用户实际看到新功能**不是同一件事。

## 核心概念
**Preflight gate（预检门禁）**：先检查候选文件、运行进程、端口、备份目标和所在文件系统；检查结果只代表检查时刻。
**Directory switch（目录切换）**：同一文件系统内单次 `rename` 通常是原子的，但先移动旧目录、再移动新目录是**两个操作，不构成整体原子事务**，中间可能存在短暂空窗。
**Rollback（回滚）**：保留原版本，失败时尝试恢复；回滚本身也可能失败，不能只依赖一行 PASS。
**Post-switch verification（切换后验证）**：验证文件、HTTP 响应、路由、缓存及浏览器实际行为。旧进程或缓存可能继续显示旧页面。

## Bash 教学示例（非生产部署脚本）
以下脚本仅演示本地隔离目录的备份与失败补偿。它**没有**检查运行服务、并发部署、文件系统边界、HTTP 或浏览器，不能直接用于 CorePilot 生产切换。已通过 `bash -n` 和临时目录正常路径测试。
~~~bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:?root}"; CANDIDATE="${2:?candidate}"
LIVE="$ROOT/out"; BACKUP="$ROOT/.out-backup"
[[ -f "$CANDIDATE/create/index.html" ]] || exit 2
[[ -d "$LIVE" ]] || exit 2
[[ ! -e "$BACKUP" ]] || exit 2
mv "$LIVE" "$BACKUP"
if ! mv "$CANDIDATE" "$LIVE"; then
  mv "$BACKUP" "$LIVE" || { echo 'MANUAL RECOVERY REQUIRED' >&2; exit 3; }
  exit 1
fi
printf 'SWITCHED; backup=%s\n' "$BACKUP"
~~~

## 常见陷阱
- 把两次 `mv` 当作一个不可分割的原子发布。
- 只检查候选 `index.html`，不检查 JS/CSS 资源与路由。
- 仅根据终端 SWITCH PASS 宣称浏览器功能可见。
- 没有阻止并发切换或检查服务是否仍持有旧文件。
- 备份目录冲突、跨文件系统移动、回滚失败时没有人工恢复流程。
- 忽视 Service Worker、浏览器缓存和静态服务根目录。

## Senior 面试题
A+9.2 目录切换显示 PASS，但 iPhone 页面仍没有新的视频时长选项。你如何区分“候选构建不包含功能”“静态服务器仍服务旧目录”“浏览器缓存旧资源”？如何设计不会误报成功的发布门禁？先独立作答。

## 15 分钟实战
只读记录 `web/out/create/index.html`、候选包、回滚目录是否存在；检查服务监听端口和实际路由；比较本地文件与 HTTP 响应哈希，检查 JS 资源是否包含目标功能。先收集证据，不要重启、删除备份或重复切换。

## 总结
发布是一个带预检、切换、验证、回滚的状态机；目录切换 PASS 只是其中一步。