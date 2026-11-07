+++
title = "Senior AI：ComfyUI 角色一致性与可复现工作流"
date = 2026-11-06
draft = false
summary = "从小呆瓜三视图与 LoRA 实践学习可复现 AI 图像管线。"
tags = ["AI", "ComfyUI", "LoRA", "Reproducibility"]
categories = ["Learning"]
showComments = true
+++

## 背景
11 月 6 日前后的实际练习涉及小呆瓜角色三视图、五根手指、Qwen Image Edit 多角度 LoRA、ComfyUI 工作流和竖屏视频参考图。反复生成后，角色手指数和比例仍可能漂移。这不是仅靠增加提示词就能彻底解决的问题。

## 核心概念
**角色规格（character contract）**：固定头身比例、眼距、三撮呆毛、毛色、每只前爪五根手指等可检查条件。区分硬约束（手指数量、输出尺寸）与软约束（可爱程度）。

**可复现清单（render manifest）**：记录工作流 JSON 版本、模型与 LoRA 文件 SHA-256、参考图 SHA-256、seed、采样参数、节点版本和目标宽高。固定 seed 只是必要的诊断线索，并不保证跨设备、模型版本完全一致。

**验证门禁（quality gate）**：先检查输出宽高和文件完整性，再人工核验手指、侧脸、比例；失败样本保留原因，不直接进入视频生成。模型无法可靠自动计数时，必须人工审核。

## Python 示例
~~~python
from dataclasses import dataclass

@dataclass(frozen=True)
class RenderSpec:
    width: int
    height: int
    seed: int
    model_sha256: str
    reference_sha256: str

def validate(spec: RenderSpec) -> None:
    if spec.width <= 0 or spec.height <= 0:
        raise ValueError("Invalid dimensions")
    if len(spec.model_sha256) != 64 or len(spec.reference_sha256) != 64:
        raise ValueError("Expected SHA-256 digests")
    if any(c not in "0123456789abcdef" for c in
           spec.model_sha256.lower() + spec.reference_sha256.lower()):
        raise ValueError("Invalid digest encoding")
~~~

This is a self-contained illustrative validation fragment, not an image-generation implementation. Digest formatting does not prove provenance, and fixed seeds do not guarantee identical results across versions or hardware.

## 常见陷阱
- 把参考图直接拉伸成 9:16，会改变角色比例；应该扩展背景。
- 只记录提示词，不记录 LoRA/节点版本，难以复现。
- 把 SHA-256 格式合法误当成模型来源可信。
- 认为多角度 LoRA 必然保证五根手指；它只改变生成倾向。
- 未验证角色一致性就批量生成视频，会放大返工成本。

## Senior 面试题
如何设计一个可审计的 ComfyUI 图像生成管线，使 3 个角度的角色图共享一致的规格？如何区分可自动检测的失败和必须人工审核的失败？

## 15 分钟实践
为一张已生成的小呆瓜侧面图建立 manifest：记录参考图哈希、模型和 LoRA 哈希、seed、画布尺寸；人工核验五根手指、三撮呆毛与头身比例，并写下 PASS/FAIL。不要修改生产工作流。

## 总结
提示词负责表达目标；版本清单负责追溯；确定性检查和人工审核负责质量。
