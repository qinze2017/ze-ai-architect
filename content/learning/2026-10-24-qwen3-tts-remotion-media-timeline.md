+++
title = "AI 视频工程：Qwen3-TTS 配音到 Remotion 的可靠时间轴"
date = 2026-10-24
draft = false
summary = "本地法语配音、音频元数据、字幕时间轴、任务阶段与可复现渲染。"
tags = ["AI", "Qwen3-TTS", "Remotion", "TypeScript", "Java", "Media Pipeline", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实场景

PromoLocal 的 Qwen3-TTS VoiceDesign 法语配音完成三版试听，选择 B（成年男声），讨论了 MPS、SDPA、`bfloat16` 和下一步 Remotion 集成；还遇到 Python `NameError: name 'model' is not defined`。本课是教学设计，不代表端到端渲染已经验证。

**今天只学一个新问题：为什么 TTS 生成后不能把视频时长和字幕位置写死？** 语速和停顿会变化；必须先检查实际音频，再按帧生成时间轴。

## 1. 先分清四步

1. **TTS**：输入法语文本、VoiceDesign 描述、模型配置，输出 `voice.wav`；记录模型版本、输入和试听选择。
2. **探测**：读取真实时长、采样率、声道，不用字数估算时长。
3. **对齐**：字幕的起止时间来自人工标注或语音对齐，不是简单平均分配整段音频。
4. **渲染**：Remotion 消费音频和字幕时间轴；验证产物之后才标记完成。

## 2. 音频时长 → 视频帧数

~~~bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.wav
~~~

例如**假设** WAV 为 12.34 秒、视频为 30 FPS，需 `ceil(12.34 × 30) = 371` 帧。这不是今天试听文件的实测值。不要截断末尾语音；片尾留白需要另行设计。

## 3. Java 17：安全计算帧数

~~~java
public class RenderPlanDemo {
    record AudioInfo(long durationMs, int fps) {
        AudioInfo {
            if (durationMs <= 0 || fps <= 0) {
                throw new IllegalArgumentException("positive duration and fps required");
            }
        }
        long frames() {
            long scaled = Math.multiplyExact(durationMs, (long) fps);
            return Math.floorDiv(Math.addExact(scaled, 999L), 1000L);
        }
    }
    public static void main(String[] args) {
        AudioInfo audio = new AudioInfo(12_340, 30);
        if (audio.frames() != 371L) throw new AssertionError("frame count");
        System.out.println("PASS: " + audio.frames() + " frames");
    }
}
~~~

整数向上取整避免少一帧；`multiplyExact` 和 `addExact` 避免静默溢出。此 Java 17 示例已在隔离环境编译和运行。

## 4. TypeScript：生成字幕时间轴

~~~typescript
type Caption = { startMs: number; endMs: number; text: string };

function makeTimeline(durationMs: number, fps: number, captions: Caption[]) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 ||
      !Number.isInteger(fps) || fps <= 0) throw new Error("invalid media metadata");
  const durationInFrames = Math.ceil(durationMs * fps / 1000);
  const segments = captions.map(c => {
    if (c.startMs < 0 || c.endMs <= c.startMs || c.endMs > durationMs) {
      throw new Error("invalid caption interval");
    }
    const from = Math.floor(c.startMs * fps / 1000);
    const until = Math.ceil(c.endMs * fps / 1000);
    return { from, durationInFrames: until - from, text: c.text };
  });
  return { durationInFrames, segments };
}

const plan = makeTimeline(12_340, 30, [
  { startMs: 0, endMs: 1200, text: "Un bon prix à Sherbrooke" }
]);
if (plan.durationInFrames !== 371 || plan.segments[0].durationInFrames !== 36) {
  throw new Error("timeline test failed");
}
console.log("PASS: timeline", plan.durationInFrames);
~~~

这段函数不依赖 Remotion，已通过 TypeScript 严格编译和 Node 运行；Remotion 组件可以消费 `durationInFrames` 和 `segments`，但具体渲染集成**尚未测试**。字幕时间戳需从真实对齐数据取得。

## 5. 连接 Spring Boot Worker

建议阶段：`TTS_PENDING → TTS_DONE → TIMELINE_READY → RENDERING → DONE`，失败记录 `FAILED` 和错误原因。每步验证文件、退出码和媒体元数据，再更新任务状态；TTS 和渲染属于长操作，应在短数据库事务之外执行。记录输入哈希、模型/代码版本、音频时长和输出路径，以便重试时复用已确认的配音。

## 6. Senior 常见陷阱

- `NameError` 是 Python 变量作用域/初始化问题：在当前进程加载模型，或将模型实例显式传参；不是 TTS 质量问题。
- VoiceDesign 描述不能保证完全一致的口音、停顿和时长。
- MPS、SDPA、`bfloat16` 是执行设置，不证明 Remotion 渲染成功。
- 只有文本和总时长不能推断每句字幕的准确时间。
- 文件存在不等于有效；要检查退出码、元数据与抽样播放。
- 重试不要覆盖已确认的语音；产物路径按任务/输入哈希隔离。

## 7. Senior 面试题（先回答，不公布答案）

TTS 已成功生成 `voice.wav`，但 Remotion 渲染进程崩溃。用户点击重试。**你如何设计任务状态、产物复用和验收，既不重复生成昂贵的配音，也不把损坏视频标记为 DONE？**

## 8. 15 分钟实战

1. 对已有 WAV 运行 `ffprobe`，或使用假设的 12.34 秒练习。
2. 运行 Java 17 示例，确认 371 帧。
3. 运行 TypeScript 时间轴示例，为一句法语生成字幕帧区间。
4. 写出三个验收条件：音频时长匹配、字幕区间合法、失败渲染不能进入 DONE。

## 总结

**TTS 生成声音，媒体探测确认真实时长，语音对齐决定字幕位置，Remotion 按帧渲染。** 可靠流水线要求每一步都有可验证的输出和可恢复的失败状态。
