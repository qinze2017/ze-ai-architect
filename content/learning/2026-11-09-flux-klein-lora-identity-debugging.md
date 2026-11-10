+++
title = "Senior AI：FLUX.2 Klein LoRA 人物一致性排障与可复现评测"
date = 2026-11-09
draft = false
summary = "以 Mac Studio 的人物 LoRA 测试为例，区分数据、权重、加载与推理参数问题。"
tags = ["AI", "ComfyUI", "LoRA", "FLUX"]
categories = ["Learning"]
showComments = true
+++

## 实际背景
11 月 9 日继续排查 FLUX.2 Klein 人物 LoRA：生成的第二张图与训练人物明显不像。此前在外置硬盘上确认存在 JPG/TXT 训练对以及 checkpoint ZIP；**文件存在并不能证明训练完成、LoRA 被正确加载或人物身份已学到**。本课不假定具体 ComfyUI 节点名称或模型兼容性已经验证。

## 核心概念
将问题拆成四层：**数据层**（清晰度、人物是否一致、角度/表情多样性、caption 是否描述正确）；**训练层**（底模、LoRA 类型、训练步数、loss 与 checkpoint）；**加载层**（底模架构匹配、实际权重文件、节点启用状态和强度）；**推理层**（seed、分辨率、提示词、CFG/采样配置）。checkpoint ZIP 可能是训练恢复包，未必是推理可直接加载的 LoRA 权重。

采用控制变量评测：同一底模、同一提示词、同一 seed 和尺寸，分别测试 LoRA OFF / ON，再只调整 LoRA strength。保存 workflow JSON、模型版本、权重哈希、seed 与输出图。仅凭“看起来不像”不能定位故障；先确认权重真正参与推理。

## Python：数据集预检
以下代码只检查文件配对和图片能否解码，不会证明人物一致性：
~~~python
from pathlib import Path
from PIL import Image
root = Path("04_training/images")
pairs = sorted(root.glob("*.jpg"))
assert pairs, "No training JPGs"
for img in pairs:
    caption = img.with_suffix(".txt")
    assert caption.is_file(), f"Missing caption: {img.name}"
    with Image.open(img) as im:
        im.verify()  # integrity only; does not assess identity quality
print(f"Verified {len(pairs)} image/caption pairs")
~~~

生产排障还需人工核对标签、重复图片和训练人物的一致性。模型权重的 SHA-256 应与可信来源核对，不能只靠重复计算本地哈希。

## 常见陷阱
- 把训练 checkpoint ZIP 当成可推理的 LoRA safetensors。
- 用不同 seed、不同底模比较 ON/OFF，无法归因。
- 训练标签含相互矛盾的人物属性，或触发词与推理 prompt 不一致。
- 只调高 LoRA strength，忽略过拟合、底模不兼容与构图漂移。
- 将一次相似的结果视为稳定复现；需要多 seed、多角度样本。

## Senior 面试题
用户报告第二张生成图完全不像训练人物。你如何用最少的受控实验，区分“LoRA 未加载”“底模不匹配”“训练数据不足”和“推理参数干扰”？先回答，不附答案。

## 15 分钟实践
1. 记录一组固定 seed、prompt、尺寸与底模。
2. 输出 LoRA OFF 与 ON 的两张对照图，并记录实际加载权重路径。
3. 检查 checkpoint 目录中是否有真正用于推理的权重文件；不要删除原始训练文件。
4. 标注 identity / hairstyle / clothing / face-shape 的人工观察结果，暂不声称模型已修复。

## 总结
LoRA 人物一致性是可观测性与实验设计问题。先证明“加载了正确的权重”，再评价训练效果；一次只改变一个变量。
