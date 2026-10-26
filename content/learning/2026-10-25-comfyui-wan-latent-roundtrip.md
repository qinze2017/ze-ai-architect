+++
title = "ComfyUI / Wan Latent：为什么归一化必须成对使用？"
date = 2026-10-25
draft = false
summary = "从 Wan21/Wan22 的 process_in/process_out 出发，理解潜变量格式、可逆变换与版本兼容测试。"
tags = ["AI", "ComfyUI", "Wan", "Python", "Latent", "Testing", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实问题

最近调试 ComfyUI 的 Wan 视频工作流时，我们用 Python 的 `inspect.getsource` 查看了 `Wan21`、`Wan22` 的 `process_in` / `process_out`。随后把 `def process_in(...)` 直接粘贴进 zsh，出现 `zsh: no matches found`。**这不是模型损坏，而是把 Python 代码交给了 shell。** 本文只解释已讨论的变换形式；不声称已实测两种 Wan 格式的所有真实参数。

## 1. 先理解一个最小问题

模型内部的 latent 不是普通图片，而是按约定形状与数值尺度表示的数据。一个简化的输入变换是：

`z = (x - mean) × scale / std`

对应输出变换：

`x = z × std / scale + mean`

在 **mean、std、scale 完全一致且 std 与 scale 非零** 的前提下，两式在数学上互逆。实际浮点计算允许微小误差。这里的 `process_in/out` 是数值格式变换，**不等于完整 VAE 编码/解码，也不代表视频已生成成功**。

## 2. 为什么模型版本不能随意混用？

想象 A 工作流用参数组 A 归一化，B 工作流却用参数组 B 反归一化。代码可能不报错，但结果会偏离原始 latent。不同 checkpoint、VAE、latent 格式及通道数必须作为一个兼容性契约检查；**不能仅凭名字 Wan21/Wan22 就推断两者的具体数值差异**，应检查当前安装版本源码和模型说明。

## 3. 可运行的 Python 最小测试

~~~python
import numpy as np

def process_in(x, mean, std, scale):
    if np.any(std <= 0) or scale == 0:
        raise ValueError("invalid latent parameters")
    return (x - mean) * scale / std

def process_out(z, mean, std, scale):
    if np.any(std <= 0) or scale == 0:
        raise ValueError("invalid latent parameters")
    return z * std / scale + mean

x = np.array([[-1, 0, 1], [2, 3, 4]], dtype=np.float32)
mean = np.array([0.1, 0.2, 0.3], dtype=np.float32)
std = np.array([1.0, 1.5, 2.0], dtype=np.float32)
scale = np.float32(0.8)

z = process_in(x, mean, std, scale)
restored = process_out(z, mean, std, scale)
assert np.allclose(x, restored, atol=1e-6)

wrong_std = np.array([1.0, 1.2, 2.0], dtype=np.float32)
wrong = process_out(z, mean, wrong_std, scale)
assert not np.allclose(x, wrong, atol=1e-6)
print("PASS: round-trip; mismatched spec detected")
~~~

测试覆盖两个情形：同一套参数往返后近似还原；故意更换 `std` 后不能还原。示例采用二维数组来演示广播，真实视频 latent 常有更高维度，必须额外验证通道轴和广播形状。**此 NumPy 教学示例已独立执行；并未在真实 Wan 推理图上验证。**

## 4. 正确检查 ComfyUI 源码

~~~bash
cd ~/AI-Tools/ComfyUI
source .venv/bin/activate
python - <<'PY'
import inspect
from comfy.latent_formats import Wan21, Wan22
for cls in (Wan21, Wan22):
    print(cls.__name__)
    print(inspect.getsource(cls.process_in))
    print(inspect.getsource(cls.process_out))
PY
~~~

`def`、`import` 等 Python 语句要放在 Python 解释器、`.py` 文件或上述 heredoc 中，而不是直接输入 zsh。

## 5. Senior 常见陷阱

- **数值可逆 ≠ 模型兼容**：还要核查 latent 通道、形状、VAE 和 checkpoint。
- **错误的广播轴**：参数长度对了，但对应了错误的维度。
- **浮点误差**：不要用 `==` 判断浮点数组，应使用容差。
- **错误诊断方向**：shell 语法错误不能说明 CUDA/MPS 或模型参数有问题。
- **缺少来源记录**：保存工作流、模型版本、参数、输入和错误日志，才能复现。
- **过度推断**：未实际加载模型和运行推理，就不能宣称视频质量或兼容性已通过。

## 6. Senior 面试题（先回答，不公布答案）

某个 ComfyUI 视频工作流在升级 Wan 模型后仍能执行，但输出明显失真。日志没有异常。**你如何分层定位是 latent 归一化参数、张量维度、VAE 配对，还是采样配置造成的问题？先验证什么，为什么？**

## 7. 15 分钟实战

1. 运行上面的 NumPy 测试，确认 `PASS`。
2. 改动 `wrong_std`，观察往返误差。
3. 用 `inspect.getsource` 检查本地 Wan21/Wan22，不在 zsh 直接执行 Python 函数定义。
4. 记录模型、VAE、ComfyUI 版本和 latent 形状；**只读检查，不修改生产工作流**。

## 总结

**先验证数学变换，再验证张量契约，最后验证真实模型输出。** 能跑通 Python 代码，不等于 Wan 视频工作流已通过端到端测试。
