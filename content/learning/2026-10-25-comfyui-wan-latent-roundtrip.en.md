+++
title = "ComfyUI / Wan Latents: Testing Reversible Normalization"
date = 2026-10-25
draft = false
summary = "Learn process_in/process_out, latent normalization, and model-compatibility checks with a minimal Python round-trip test."
tags = ["AI", "ComfyUI", "Wan", "Python", "Latent", "Testing", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## Real debugging context

In a recent ComfyUI Wan video workflow session, we inspected `Wan21` and `Wan22` using Python's `inspect.getsource`. A subsequent attempt to paste `def process_in(...)` directly into zsh caused `zsh: no matches found`. **That is a shell-versus-Python mistake, not evidence that the model is broken.** This lesson uses the transformation formula discussed in that session; it does not claim to have measured every actual parameter of either Wan format.

## 1. Start with one concept

A latent is numerical data with a defined shape and scaling convention. Consider this simplified input transform:

`z = (x - mean) × scale / std`

and its inverse:

`x = z × std / scale + mean`

The formulas are mathematical inverses **only when they use identical parameters and both std and scale are nonzero**. Floating-point round trips can have small numerical error. These transformations are **not the entire VAE encoder/decoder and do not prove successful video rendering**.

## 2. Why version contracts matter

If workflow A normalizes with parameter set A but workflow B reverses the transformation with set B, the pipeline may run without throwing an exception while corrupting its latent values. Check the checkpoint, VAE, latent format, dimensions, and channel layout as one compatibility contract. **Do not infer the exact differences between Wan21 and Wan22 from their names alone**; inspect the installed source and model documentation.

## 3. Runnable minimal Python test

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

The first assertion checks a matching-parameter round trip; the second detects a deliberately mismatched `std`. This 2D array demonstrates broadcasting; actual video latents typically have more dimensions, so verify the channel axis explicitly. **This NumPy teaching example was executed independently, not on a real Wan inference graph.**

## 4. Inspect ComfyUI in the correct interpreter

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

Run `def` and `import` inside Python, a `.py` file, or this heredoc—not as raw zsh commands.

## 5. Senior-level pitfalls

- **Numerical invertibility is not model compatibility**: also verify channels, shapes, VAE, and checkpoint.
- **Wrong broadcasting axis**: matching sizes can still produce semantically wrong values.
- **Floating-point precision**: compare with tolerances, not array equality.
- **Misdiagnosis**: a zsh syntax error says nothing about MPS or model weights.
- **Missing provenance**: save workflow, versions, parameters, input, and logs for reproduction.
- **Overclaiming validation**: without a real inference run, do not claim video quality or full compatibility has been verified.

## 6. Senior interview question (answer first)

A ComfyUI video workflow still runs after a Wan model upgrade, but its output is visibly distorted and no exception is raised. **How would you distinguish a latent normalization mismatch from tensor-shape, VAE-pairing, or sampling-configuration problems? What would you verify first, and why?**

## 7. Fifteen-minute exercise

1. Run the NumPy snippet and confirm `PASS`.
2. Change `wrong_std` and inspect the round-trip error.
3. Inspect the locally installed Wan21/Wan22 methods with Python.
4. Record the ComfyUI, checkpoint, and VAE versions and latent shape; do not change production workflows.

## Summary

**Verify the mathematical round trip, then the tensor contract, then actual model output.** Passing a Python unit test is not equivalent to validating an end-to-end Wan video workflow.
