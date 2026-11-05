+++
title = "Senior AI Engineering: verifying local ComfyUI model integrity with SHA-256"
date = 2026-11-04
draft = false
summary = "Integrity verification is an AI supply-chain gate. A model loading successfully does not establish artifact integrity."
tags = ["AI", "ComfyUI", "SHA-256", "Model Integrity", "Security"]
categories = ["Learning"]
showComments = true
+++

## Real learning context
Today a `shasum -a 256` command was run against a Qwen Image Edit FP8 weight on an external CORSAIR drive connected to a Mac Studio. The digest shown in the conversation was truncated, so no match with an authoritative expected digest has been established.

## Core concepts
SHA-256 produces a 256-bit digest represented by 64 hexadecimal characters. It detects accidental corruption or changed bytes. However, **hashing the same local file twice does not establish trustworthy provenance**. Compare the complete digest against an expected value obtained from a trusted publisher for the exact model version.

## Command example
~~~bash
shasum -a 256 "/Volumes/CORSAIR/01_AI-Models/ComfyUI/diffusion_models/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors"
# Compare the FULL 64-character digest with the trusted publisher's digest.
# A match checks byte integrity, NOT model safety or authenticity by itself.
~~~

## Common pitfalls
Do not treat a hash match as a malware-safety guarantee; do not trust an arbitrary checksum page; do not hash a file while it is still downloading; quote paths with spaces.

## Senior interview question
You operate a ComfyUI model cache populated from multiple mirrors. How would you design trusted digest acquisition, atomic downloads, version pinning and pre-load validation? What should happen when no trusted digest is available?

## 15-minute exercise
Rerun the command and record the full 64-character digest. Verify the exact release and expected digest from the publisher. If no trusted reference is available, mark the artifact unverified rather than verified.

## Summary
Integrity verification is an AI supply-chain gate. A model loading successfully does not establish artifact integrity.
