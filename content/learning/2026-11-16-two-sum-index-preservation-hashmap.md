+++
title = "Senior Java 面试：Two Sum 的索引保持、HashMap 与复杂度"
date = 2026-11-16
draft = false
summary = "从先排序再反推下标的思路出发，理解 Two Sum 的时间空间权衡、重复值与整数溢出。"
tags = ["Java", "Algorithms", "Interview", "Data Structures"]
categories = ["Learning"]
showComments = true
+++

## 真实学习背景
今天在 Blind 75 / NeetCode 150 的 Two Sum 练习中，提出了“用数组保存下标，排序后反推原始下标”的思路。这个思路有价值，但排序会改变位置；如果只排序原始数字，再通过值查找下标，遇到重复值时可能错误地使用同一个元素。

## 核心概念
**问题契约**：给定 `int[] nums` 与 `target`，返回两个不同元素的**原始索引**；通常题目保证恰有一组解。

**方案 A：排序 + 双指针**：建立 `(value, originalIndex)` 配对，按 value 排序后用双指针查找。时间 `O(n log n)`，配对数组额外空间 `O(n)`；若允许修改原始输入，仍需解决索引保留问题。

**方案 B：单遍 HashMap**：从左到右遍历，查找 `target - nums[i]` 是否已经出现；先查再插，避免同一元素重复使用。平均时间 `O(n)`，额外空间 `O(n)`；最坏哈希行为依赖实现和输入，不应无条件承诺严格最坏 `O(n)`。

**整数边界**：Java `int` 减法可能溢出，因此示例先用 `long` 计算补数并检查范围。

## Java 17 教学示例
此示例只实现单遍方案，不是唯一正确解。
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

## 常见陷阱
把排序后的索引直接当作原始索引；使用 `indexOf` 处理重复值；先插入当前元素再查补数导致重复使用同一索引；把 HashMap 的平均复杂度说成无条件最坏复杂度；忽略 `int` 溢出；没有明确无解时的行为。

## Senior 面试题（先回答，不公布答案）
你准备使用“保存原始下标 + 排序 + 双指针”解决 Two Sum。请说明如何设计数据结构保留原始下标，分析复杂度，并解释为什么单遍 HashMap 通常更适合此题。对于 `[3,3]`、`target=6`，你如何保证返回两个不同索引？

## 15 分钟实战
先口述两个算法；然后自己手写 HashMap 版本，使用 `[2,7,11,15]`、`[3,3]`、`[-3,4,3,90]` 测试。再解释 `seen.putIfAbsent` 与“先查再插”的目的。不要直接复制示例作为自己的面试答案。

## 验证与总结
示例核心逻辑已在隔离环境使用 `javac --release 17` 编译，并以三个断言场景运行通过；未接入生产项目。Senior 面试不只看能否找到答案，更看契约、边界、复杂度和可维护性。
