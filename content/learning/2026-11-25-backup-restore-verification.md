+++
title = "备份完整性与恢复验收：从 Mac Studio 到 MacBook"
date = 2026-11-25
draft = false
summary = "区分备份校验、恢复测试与迁移验收。"
tags = ["Backup", "Recovery", "Software Architecture"]
categories = ["Learning"]
showComments = true
+++

## 实际背景
11 月 25 日的 saveTogether 迁移准备涉及 SHA-256 清单、gzip 检查和 Git bundle 验证；随后仍需解决 MacBook 上如何恢复的问题。不能据此认定迁移已完成。

## 核心概念
备份完整性（backup integrity）检查保存的字节；可恢复性（recoverability）要求在隔离目标中实际恢复；恢复时间目标（RTO）和恢复点目标（RPO）分别描述可接受的恢复耗时和数据损失窗口。Git bundle 不包含未提交工作树、未跟踪文件或数据库；数据库需要独立一致性备份。恢复后还应验证依赖、配置、数据库和应用行为。

## Python 教学示例
只在临时目录模拟恢复与篡改检测，不接触真实备份。

~~~python
import tempfile, pathlib, hashlib, shutil
with tempfile.TemporaryDirectory() as d:
    p = pathlib.Path(d)
    a, b = p / 'backup', p / 'restore'
    a.mkdir()
    (a / 'data.txt').write_text('sample')
    expected = hashlib.sha256((a / 'data.txt').read_bytes()).hexdigest()
    shutil.copytree(a, b)
    assert hashlib.sha256((b / 'data.txt').read_bytes()).hexdigest() == expected
    (b / 'data.txt').write_text('changed')
    assert hashlib.sha256((b / 'data.txt').read_bytes()).hexdigest() != expected
~~~

## 常见陷阱
把 gzip 完整性当作数据库一致性；把 bundle verify 当作应用可启动；忽略未提交文件、密钥和外部依赖；直接覆盖目标工作树。

## Senior 面试题
Git bundle 和归档校验均通过，但 MacBook 恢复后应用无法连接数据库。如何设计恢复验收与回退流程？先自行回答。

## 15 分钟实战
在临时目录恢复一个样本，记录校验结果；列出源码、数据库、配置、依赖与启动测试的独立验收项。

## 总结
备份可读不等于业务可恢复。示例的复制和篡改断言已在隔离环境执行通过，未验证真实项目恢复。
