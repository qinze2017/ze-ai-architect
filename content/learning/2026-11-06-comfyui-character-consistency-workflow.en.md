+++
title = "Senior AI: Character Consistency in ComfyUI"
date = 2026-11-06
draft = false
summary = "Reproducible character views with LoRA, manifests and quality gates."
tags = ["AI", "ComfyUI", "LoRA", "Reproducibility"]
categories = ["Learning"]
showComments = true
+++

## Context
Recent Xiaodaigua experiments involved front/side views, five fingers, Qwen Image Edit multi-angle LoRA, ComfyUI workflows, and portrait video reference images. Repeated generations still showed inconsistent fingers and proportions.

## Core concepts
A **character contract** defines checkable constraints: three hair tufts, fur colors, eye spacing, body proportions, and five fingers on each front paw. Separate hard constraints from subjective aesthetic goals.

A **render manifest** records the workflow JSON revision, node versions, SHA-256 digests of the model, LoRA and reference image, seed, sampling parameters, and canvas dimensions. A fixed seed does not guarantee byte-identical results across different hardware or versions.

A **quality gate** checks dimensions and file integrity first, then requires human review for anatomy and identity consistency. Rejected images should not enter downstream video generation.

## Python example
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

## Common pitfalls
- Stretching the subject to 9:16 instead of extending the background.
- Saving only the prompt and omitting model or node versions.
- Mistaking a well-formed hash for verified provenance.
- Assuming multi-angle LoRA guarantees the correct finger count.
- Scaling video production before character validation.

## Senior interview question
How would you design an auditable ComfyUI pipeline that produces three views of one consistent character? Which checks can be automated, and which need human review?

## 15-minute exercise
Create a manifest for one existing side-view image, record model and reference hashes and output dimensions, then manually verify five fingers, three hair tufts, and proportions. Record PASS/FAIL without touching production.

## Summary
Prompts describe intent; manifests enable traceability; deterministic checks plus human review enforce quality.
