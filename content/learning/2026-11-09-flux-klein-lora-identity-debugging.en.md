+++
title = "Senior AI: Reproducible FLUX.2 Klein LoRA identity debugging"
date = 2026-11-09
draft = false
summary = "A controlled approach to diagnosing training data, weights, loading, and inference drift."
tags = ["AI", "ComfyUI", "LoRA", "FLUX"]
categories = ["Learning"]
showComments = true
+++

## Real-world context
On November 9, a character LoRA test on Mac Studio produced a second image that did not resemble the training subject. JPG/TXT pairs and a checkpoint ZIP were previously found. **Their existence does not prove successful training or that inference loaded the correct LoRA.** Exact ComfyUI nodes and model compatibility must be verified for the installed workflow.

## Core concepts
Separate four failure layers: **data** (consistent identity, caption accuracy, pose diversity), **training** (base model, LoRA format, steps, checkpoints), **loading** (architecture compatibility, actual weight path, enabled nodes and strength), and **inference** (seed, dimensions, prompt, sampling settings). A training-resume ZIP is not necessarily an inference-ready LoRA weights file.

Run a controlled A/B test: hold base model, prompt, seed, resolution, and sampler constant; compare LoRA OFF vs ON. Change only one variable at a time. Save the workflow JSON, model versions, hashes, seed, and outputs. Visual mismatch alone does not identify the root cause.

## Python example: dataset preflight
This checks paired files and image decoding only; it does not measure identity similarity:
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

Also inspect captions, duplicate photos, and whether all training images show the intended subject. Verify model hashes against a trusted source, not merely against another local calculation.

## Common pitfalls
- Mistaking a checkpoint ZIP for inference-ready safetensors weights.
- Changing seeds or base models between OFF/ON runs.
- Inconsistent trigger words or contradictory captions.
- Increasing LoRA strength without checking compatibility or overfitting.
- Declaring success after one good image instead of testing multiple seeds and views.

## Senior interview question
The second generated image looks like a different person. Design the smallest set of controlled tests that distinguish unloaded weights, incompatible base models, inadequate training data, and inference parameter interference. Answer before reviewing a solution.

## 15-minute exercise
Fix one seed, prompt, resolution, and base model. Produce OFF and ON comparisons, record the actual loaded weight path, and inspect checkpoint contents without deleting anything. Score face shape, hair, clothing, and overall identity separately.

## Summary
Reliable character LoRA debugging starts by proving which weights were loaded, then measuring results under controlled conditions. One variable at a time.
