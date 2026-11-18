+++
title = "Senior Java / AI：CorePilot 离线交付包的完整性、来源与发布门禁"
date = 2026-11-17
draft = false
summary = "从 B23 离线演练和部署映射核对，理解 SHA-256 校验与可信来源的区别。"
tags = ["CorePilot", "Security", "Release Engineering", "AI Architecture"]
categories = ["Learning"]
showComments = true
+++

## 真实学习背景
CorePilot B23 离线演练中，需要核对 ZIP、`DEPLOYMENT_MAP.json` 和 `ROLLBACK_INDEX.json`，而不是因为文件存在就允许安装。这里讨论的是离线交付验证，不是批准部署。

## 核心概念
**完整性（integrity）**：对每个交付文件计算 SHA-256，检测传输后字节是否改变。**真实性（authenticity）**：校验清单必须来自独立可信渠道，或者通过可信签名验证；如果攻击者同时替换文件和清单，单纯 SHA-256 检查也可能通过。**可追溯性（provenance）**：记录构建来源、版本、提交及批准记录。**发布门禁（release gate）**：即使校验通过，运行环境、权限、回滚路径及安全约束未验证时仍应 NO-GO。

## 可验证的 Bash 教学示例
下面只演示已取得可信 SHA256SUMS 清单后的文件内容核对。它不验证签名，不检查路径穿越，也不执行安装。

~~~bash
#!/usr/bin/env bash
set -euo pipefail
root="${1:?usage: verify_artifacts.sh DIRECTORY}"
manifest="$root/SHA256SUMS"
[[ -f "$manifest" ]] || { echo 'BLOCKED: manifest missing'; exit 1; }
(cd "$root" && shasum -a 256 -c SHA256SUMS)
~~~

## 常见陷阱
不要把 ZIP 解压成功当作安全证明；不要信任包内自带的未认证清单；不要把 `DEPLOYMENT_MAP.json` 和 `ROLLBACK_INDEX.json` 混淆为真实回滚演练；不要在生产目录执行未经审查的解压；不要把哈希一致说成系统已获准上线。

## Senior 面试题（先回答）
如果离线 ZIP 中的 `DEPLOYMENT_MAP.json` 和 `SHA256SUMS` 都被替换，且 `shasum -c` 通过，你会批准 CorePilot 首次 Guard 安装吗？你还需要哪些独立证据？

## 15 分钟实战
在临时目录创建 `a.txt`，生成 SHA256SUMS，验证通过；修改文件后验证失败。再解释为什么攻击者重算清单会绕过这项检查，以及如何引入独立签名/可信哈希。

## 总结与验证边界
示例脚本通过 `bash -n`、正常校验及文件篡改检测三项隔离测试。未对 CorePilot 生产包执行真实性认证，也未安装、重启或切换任何服务。

