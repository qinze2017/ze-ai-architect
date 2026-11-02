+++
title = "Senior Java / AI：从模糊拼豆 PDF 到可验证的逐格图纸"
date = 2026-11-01
draft = false
summary = "以小呆瓜 40×40、52×52 拼豆图纸为例，学习离散网格、最近邻预览、颜色统计与矢量 PDF 的质量门禁。"
tags = ["Java", "AI", "Image Processing", "PDF", "Pixel Art", "Testing"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实问题

11 月 1 日，检查“小呆瓜”两份候选拼豆 PDF（40×40 与 52×52）时，提出了一个具体疑问：**为什么图纸看起来不如参考商品清晰？** 这只是观察与待排查的问题；本文没有对原 PDF 进行像素或矢量结构审计，不能断言唯一原因。

这类问题涉及 AI 生成图片与**可生产的数字图纸**之间的区别。AI 生成的好看预览，不等于每个拼豆的位置、颜色、数量都正确。

## 核心概念：以网格数据为唯一事实来源

**1. 离散网格（discrete grid）**：40×40 是 1,600 个格位，52×52 是 2,704 个格位；格位数量**不等于**用豆量，空白格必须排除。每格应有一个确定的颜色代码或“空白”标记。

**2. 最近邻缩放（nearest-neighbor）**：预览放大时，输出像素直接复制来源格子的值，避免双线性插值产生混色、模糊边界。最近邻只适合保持离散图案的硬边；不能修复原图案本身的错误。

**3. 矢量 PDF（vector PDF）**：正式图纸优先由同一份网格生成矢量矩形、网格线和编号，而不是把低分辨率截图拉伸进 PDF。打印尺寸还要核对：A4 可用宽度假设为 190 mm 时，52 列每格约 3.65 mm，40 列每格约 4.75 mm；这只是版面估算，不是已核验的成品尺寸。

**4. 质量门禁（quality gate）**：在标记为可售前，检查行列数、颜色代码合法性、逐色用量、空白格、缩放无混色、图例与网格一致、PDF 实际打印可读性。候选文件应继续保持待审核状态。

建议流程：**AI/参考图 → 人工校对的颜色网格 → 统计/编号 → 最近邻预览 + 矢量 PDF → 打印检查 → 人工批准**。

## Java 17：验证格位、颜色数量与清晰预览

下例使用 4×4 教学网格；`-` 表示**没有豆**，`R` 和 `B` 是演示颜色代码，并非真实品牌色号。它不负责生成 PDF。保存为 `BeadPatternGateDemo.java`：

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

预期输出：

~~~text
PASS: 16 cells, empty=7, R=3, B=6, beads=9; 12x12 nearest-neighbor preview
~~~

该教学程序已使用 `javac --release 17` 独立编译和运行成功。验证范围仅限**网格统计与最近邻预览**；没有验证真实 40×40/52×52 PDF、打印效果或品牌色号映射。

## 常见陷阱

1. 把 AI 图片直接缩小到 40×40，再用双线性插值放大：边缘颜色被混合。
2. 将透明背景当成白色拼豆：用豆量和成本被高估。
3. 图纸、图例、用豆统计来自不同版本的网格：消费者无法复现。
4. PDF 只嵌入一张低分辨率位图：放大和打印时文字/格线发糊。
5. 只看屏幕截图就批准销售：没有核对实际 A4 打印尺寸、编号可读性和角色轮廓。
6. 以为“矢量 PDF”就必然清楚：字号过小、对比度不足、格线过密仍可能难读。

## Senior 面试题（请先作答）

你的服务需要把 AI 生成的角色图转换为 52×52 的拼豆图纸，输出预览、逐格颜色编号和 PDF。用户反馈“PDF 模糊，而且用豆统计与图纸不一致”。**你会如何设计统一的数据模型、生成流水线和自动化测试，保证预览、PDF 与用豆量永远基于同一份网格？** 暂不提供参考答案。

## 15 分钟实战

1. 运行上述 Java 17 示例，确认 16 个格位、7 个空白、9 颗豆。
2. 将 `ROWS` 的某一行故意改短，观察行宽断言。
3. 将一个颜色改为 `X`，观察未知颜色代码断言。
4. 为 40×40 和 52×52 的候选图纸拟定检查清单：网格尺寸、空白格、颜色表、编号、逐色用量、A4 打印。**不要把候选稿直接改为已审核。**

## 总结

**图纸清晰度与正确性首先来自可验证的离散网格，而不是漂亮的 AI 预览。** 最近邻用于忠实预览，矢量 PDF 用于稳定排版；同一份网格必须驱动图纸、图例和用豆量。真正上架前仍需要实际 PDF 和打印检查。
