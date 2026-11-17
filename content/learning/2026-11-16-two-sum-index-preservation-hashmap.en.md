+++
title = "Senior Java Interview: Two Sum, Original Indices, and HashMap"
date = 2026-11-16
draft = false
summary = "Compare sorting with index preservation against a one-pass HashMap, including duplicates, complexity and integer overflow."
tags = ["Java", "Algorithms", "Interview", "Data Structures"]
categories = ["Learning"]
showComments = true
+++

## Learning context
In today's Blind 75 / NeetCode 150 Two Sum practice, one proposed approach was to store indices, sort the numbers, then recover the original positions. That is workable if each value stays paired with its original index. Sorting bare values and searching indices afterward can mishandle duplicates.

## Core concepts
**Contract**: return the **original indices** of two distinct elements whose sum equals `target` (the common problem variant guarantees exactly one solution).

**Sort and two pointers**: build `(value, originalIndex)` pairs, sort by value, and use two pointers. Time `O(n log n)`, extra space `O(n)` for the pairs.

**One-pass HashMap**: look up the complement among previously visited values before inserting the current value. Expected time `O(n)` and extra space `O(n)`; do not confuse average hash-table performance with an unconditional worst-case guarantee.

**Overflow**: compute the complement in `long` and range-check before converting to `int`.

## Java 17 example
This is a teaching example of the one-pass approach:
~~~java
import java.util.*;
public class TwoSumLesson {
  static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
      long needed = (long) target - nums[i];
      if (needed >= Integer.MIN_VALUE && needed <= Integer.MAX_VALUE) {
        Integer j = seen.get((int) needed);
        if (j != null) return new int[]{j, i};
      }
      seen.putIfAbsent(nums[i], i);
    }
    throw new IllegalArgumentException("No solution");
  }
}
~~~

## Common pitfalls
Returning sorted positions instead of original indices; mishandling `[3,3]`; inserting before lookup and reusing one index; overstating worst-case complexity; overlooking integer overflow; failing to define no-solution behavior.

## Senior interview question (answer first)
How would you preserve original indices in a sort-and-two-pointer solution? Compare its complexity with a one-pass HashMap. For `[3,3]` and `target=6`, how do you ensure the returned indices are different?

## 15-minute practice
Explain both approaches aloud, then implement the HashMap approach yourself. Test `[2,7,11,15]`, `[3,3]`, and `[-3,4,3,90]`. Explain why lookup happens before insertion.

## Verification and takeaway
The educational core compiled using `javac --release 17` and passed three isolated assertion scenarios; no production integration was performed. Senior-level answers should make the contract, edge cases, and trade-offs explicit.
