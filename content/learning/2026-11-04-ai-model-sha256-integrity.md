+++
title = "Senior AI Engineering：用 SHA-256 验证本地 ComfyUI 模型完整性"
date = 2026-11-04
draft = false
summary = "校验模型完整性是 AI 工程供应链的一道门禁；可重复的验证记录比“模型能加载”更可靠。"
tags = ["AI", "ComfyUI", "SHA-256", "Model Integrity", "Security"]
categories = ["Learning"]
showComments = true
+++

## 真实学习背景
今天在 Mac Studio 的外置 CORSAIR 硬盘上，对 Qwen Image Edit FP8 权重运行了 `shasum -a 256`。终端输出在对话中被截断，因此不能断言已与发布方校验值匹配。

## 核心概念
SHA-256 将文件字节映射为 256 位摘要（64 位十六进制）。相同文件应有相同摘要；单个字节改变通常导致不同摘要。它能发现下载损坏或意外修改，但**仅比较本机两次计算并不能证明文件来自可信发布方**。必须从可信的模型发布页面取得预期摘要，并核对文件名、版本和完整摘要。

## 命令示例
~~~bash
shasum -a 256 "/Volumes/CORSAIR/01_AI-Models/ComfyUI/diffusion_models/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors"
# Compare the FULL 64-character digest with the trusted publisher's digest.
# A match checks byte integrity, NOT model safety or authenticity by itself.
~~~

## 常见陷阱
不要把文件名或模型卡上的任意文字当作权威校验值；不要把 SHA-256 匹配当成无恶意代码保证；不要在下载未完成时计算；路径包含空格时必须加引号。

## Senior 面试题（先回答）
你维护一个 ComfyUI 模型缓存，文件可能来自不同镜像。如何设计下载、可信摘要来源、原子落盘、版本锁定与加载前校验流程？如果发布方没有提供可信摘要，系统应该如何标记风险？

## 15 分钟实战
在终端重新运行命令，记录完整 64 位摘要；从模型官方发布页面核对文件版本与预期摘要。找不到可信预期值时记录为“未验证”，不要宣称通过。

## 总结
校验模型完整性是 AI 工程供应链的一道门禁；可重复的验证记录比“模型能加载”更可靠。
