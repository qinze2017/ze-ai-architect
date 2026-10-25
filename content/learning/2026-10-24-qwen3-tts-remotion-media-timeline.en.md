+++
title = "AI Video Engineering: Reliable Qwen3-TTS to Remotion Timelines"
date = 2026-10-24
draft = false
summary = "Plan reliable media timelines from French TTS audio, verified caption timing, and recoverable rendering stages."
tags = ["AI", "Qwen3-TTS", "Remotion", "TypeScript", "Java", "Media Pipeline", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## Real context

Today's PromoLocal French voiceover work used Qwen3-TTS VoiceDesign. After three listening samples, voice B (adult male) was selected. MPS, SDPA, and `bfloat16` were mentioned as generation settings, with Remotion integration considered next. A `NameError: name 'model' is not defined` occurred. **No end-to-end video render is claimed as verified.**

The new question: **why not hard-code the video length and subtitle positions after TTS?** Pauses and speech rate vary. Measure the actual audio before planning frames.

## 1. Four stages

1. **TTS**: French text, VoiceDesign description, model settings → `voice.wav`; record the model version and approved sample.
2. **Inspection**: measure actual duration, sample rate, and channels, rather than guessing from word count.
3. **Alignment**: derive phrase start/end timestamps from actual audio or reviewed annotations.
4. **Rendering**: feed the audio and frame timeline into Remotion; verify output before marking success.

## 2. Audio duration → frames

~~~bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 voice.wav
~~~

**Hypothetical** 12.34 seconds at 30 FPS requires `ceil(12.34 × 30) = 371` frames. This is not a measurement of today's samples. Avoid trimming speech; add intentional end padding only when needed.

## 3. Java 17: safe frame calculation

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

Integer ceiling avoids losing a partial last frame. `multiplyExact` and `addExact` prevent silent overflow. This Java 17 program was compiled and executed locally.

## 4. TypeScript: caption timeline

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

This standalone function passed strict TypeScript compilation and a Node execution test. A Remotion component can consume `durationInFrames` and `segments`, but **the actual Remotion integration has not been tested**. Timestamps must come from real alignment, not from subtitle text alone.

## 5. Connecting to Spring Boot Workers

A possible job lifecycle is `TTS_PENDING → TTS_DONE → TIMELINE_READY → RENDERING → DONE`, plus `FAILED` with a recorded reason. Verify artifacts, process exit status, and media metadata before advancing state. Keep long TTS and rendering **outside short database transactions**. Store input hashes, model/code versions, duration, and output paths so retries can reuse approved voice artifacts.

## 6. Senior-level pitfalls

- `NameError` is a Python initialization/scope problem: initialize the model in the current process or pass it explicitly.
- VoiceDesign descriptions do not guarantee identical accents or durations.
- MPS, SDPA, and `bfloat16` are execution settings, not proof of successful video rendering.
- Text and total audio length do not provide phrase-level subtitle timestamps.
- A video file may exist but be corrupt: check exit status, metadata, and sample playback.
- Retries must not overwrite an approved voice; isolate artifact paths by job/input hash.

## 7. Senior interview question (answer first)

TTS generated `voice.wav` successfully, but the Remotion rendering process crashed. The user retries. **How would you design states, artifact reuse, and validation to avoid repeating costly TTS and to prevent a corrupt video from being marked DONE?**

## 8. A 15-minute exercise

1. Measure an existing WAV with `ffprobe`, or use the hypothetical 12.34 seconds.
2. Run the Java 17 example and verify 371 frames.
3. Run the TypeScript timeline example for one French caption.
4. Define three acceptance checks: sufficient duration, valid caption intervals, and no DONE after failed rendering.

## Summary

**Qwen3-TTS creates audio; inspection determines duration; alignment locates speech; Remotion renders frames.** Reliable AI video workflows require validated artifacts and recoverable stage boundaries.
