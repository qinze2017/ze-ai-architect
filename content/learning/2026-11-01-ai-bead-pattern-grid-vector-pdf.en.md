+++
title = "Senior Java / AI: From Blurry Bead-Pattern PDFs to Verifiable Pixel Grids"
date = 2026-11-01
draft = false
summary = "Lessons from Xiaodaigua 40×40 and 52×52 bead-pattern candidates: discrete grids, nearest-neighbor previews, bead counts, and vector PDFs."
tags = ["Java", "AI", "Image Processing", "PDF", "Pixel Art", "Testing"]
categories = ["Learning"]
showComments = true
+++

## Real project context — November 1

Two candidate **40×40 and 52×52** perler-bead pattern PDFs prompted a practical question: why do they look less crisp than the reference patterns? This is a **reported visual concern, not a confirmed root-cause diagnosis**; this lesson did not inspect the internal vector or raster structure of the PDFs.

A visually attractive AI-generated image is not automatically a reproducible bead pattern. Each cell, color code, and bead count needs a deterministic source of truth.

## Core concepts

**Discrete grid.** A 40×40 pattern contains 1,600 possible cells; 52×52 contains 2,704. These are *not* necessarily bead counts: empty cells must be excluded. Each cell should encode exactly one palette entry or an explicit empty marker.

**Nearest-neighbor scaling.** An enlarged preview should copy each source cell into a solid block. Bilinear interpolation introduces blended boundary colors and apparent blur. Nearest-neighbor preserves hard edges, but cannot fix an incorrect source grid.

**Vector PDF.** Draw cell rectangles, grid lines, labels, and legend directly from the authoritative grid rather than stretching a small screenshot into a PDF. For an illustrative A4 usable width of 190 mm, cell width is about 3.65 mm at 52 columns or 4.75 mm at 40 columns. These are layout estimates, not measurements of the candidate PDFs.

**Quality gate.** Before approval, check grid dimensions, allowed color codes, empty cells, per-color counts, legend consistency, numbering, actual print readability, and design fidelity. Keep candidate files pending review until a human signs off.

Suggested pipeline: **AI/reference artwork → human-reviewed discrete grid → counts and labels → nearest-neighbor preview + vector PDF → print inspection → approval**.

## Java 17 example: validate grid and preview

This tiny 4×4 example treats `-` as **no bead**, with `R` and `B` as demonstration codes, not real manufacturer palette IDs. It does **not** generate a PDF. Save as `BeadPatternGateDemo.java`:

~~~bash
javac --release 17 BeadPatternGateDemo.java
java BeadPatternGateDemo
~~~

~~~java
public final class BeadPatternGateDemo {
    static final String[] ROWS = {"----", "-RR-", "-RBB", "BBBB"};

    static char[][] enlargeNearest(int factor) {
        int height = ROWS.length;
        int width = ROWS[0].length();
        char[][] preview = new char[height * factor][width * factor];
        for (int y = 0; y < preview.length; y++) {
            for (int x = 0; x < preview[0].length; x++) {
                preview[y][x] = ROWS[y / factor].charAt(x / factor);
            }
        }
        return preview;
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        int width = ROWS[0].length();
        for (String row : ROWS) {
            check(row.length() == width, "all rows must have equal width");
            check(row.matches("[-RB]+"), "unknown color code");
        }
        java.util.Map<Character, Integer> counts = new java.util.TreeMap<>();
        for (String row : ROWS) {
            for (char color : row.toCharArray()) counts.merge(color, 1, Integer::sum);
        }
        check(ROWS.length * width == 16, "grid dimensions");
        check(counts.get('-') == 7 && counts.get('R') == 3 && counts.get('B') == 6,
              "color totals");
        char[][] preview = enlargeNearest(3);
        check(preview.length == 12 && preview[0].length == 12, "preview size");
        for (int y = 0; y < preview.length; y++) {
            for (int x = 0; x < preview[0].length; x++) {
                check(preview[y][x] == ROWS[y / 3].charAt(x / 3),
                      "nearest-neighbor preserves exact cells");
            }
        }
        System.out.println("PASS: 16 cells, empty=7, R=3, B=6, beads=9; 12x12 nearest-neighbor preview");
    }
}
~~~

Expected output:

~~~text
PASS: 16 cells, empty=7, R=3, B=6, beads=9; 12x12 nearest-neighbor preview
~~~

The teaching example was independently compiled and executed with `javac --release 17`. This validates only grid totals and nearest-neighbor enlargement, **not** the real 40×40/52×52 PDFs, printing, or commercial color mapping.

## Common pitfalls

1. Downsampling AI artwork to a tiny image, then bilinearly enlarging it: boundaries acquire mixed colors.
2. Treating transparent/empty cells as white beads: inventory counts become wrong.
3. Generating the legend, pattern, and inventory from different revisions of the grid.
4. Embedding only a low-resolution screenshot in a PDF: zoom and print reveal blurry lines and labels.
5. Approving a digital product from a screen preview without checking printed A4 labels and silhouette.
6. Assuming vector output is automatically readable: tiny text and insufficient contrast still fail.

## Senior interview question — answer before reading a solution

Your service converts an AI-generated character into a **52×52** bead pattern with a preview, per-cell color IDs, and a PDF. A customer reports that the PDF is blurry and the bead inventory disagrees with the chart. **How would you design the single authoritative data model, generation pipeline, and automated checks so that preview, PDF, and inventory always derive from the exact same grid?** No model answer is provided yet.

## 15-minute practice

1. Compile and run the Java example; confirm 16 cells, 7 empty cells, and 9 beads.
2. Shorten one row to see the width assertion fail.
3. Replace one color with `X` to see the palette-code validation fail.
4. Draft a review checklist for the 40×40 and 52×52 candidates: dimensions, transparency, palette, labels, counts, and actual A4 print. Do not mark candidates approved without inspection.

## Summary

**A reliable pattern starts with a validated discrete grid, not merely a polished AI preview.** Nearest-neighbor previews preserve exact cells; vector PDFs support scalable layout. Pattern, legend, and bead inventory must share one authoritative grid. Real PDF and print checks remain necessary before selling.
