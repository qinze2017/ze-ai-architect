+++
title = "Senior Java / AI：CorePilot 可复现构建与发布门禁"
date = 2026-11-10
draft = false
summary = "从 CorePilot RB.2 的跨目录 Web 构建差异理解可复现构建、证据和 NO-GO。"
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## 实际背景
11 月 10 日 CorePilot RB.2 的隔离验收有 60 项检查通过，但生产仍为 NO-GO。Python wheel 字节复现通过，Web 跨目录复现失败；固定路径下 103 个文件一致。真实 iPhone/Safari、生产 Keychain 和部署兼容性尚未验收。这些是测试报告中的观察，不等于生产发布许可。

## 核心概念
**Functional correctness** 表示测试行为正确；**reproducible build** 表示在声明的相同输入和受控环境下，独立构建产物字节一致；**release gate** 决定证据是否足够允许部署。三者不能互相替代。跨目录失败可能涉及绝对路径、构建时间、文件排序、环境变量或工具链差异，不能仅凭结果断定根因。构建比较应排除不属于交付物的缓存，并记录依赖锁文件、构建工具版本、环境与输入哈希。

## Java 17：目录产物指纹
~~~java
import java.nio.file.*;
import java.security.*;
import java.util.*;
public class TreeDigest {
  static String digest(Path root) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-256");
    try (var paths = Files.walk(root)) {
      for (Path p : paths.filter(Files::isRegularFile)
          .sorted(Comparator.comparing(x -> root.relativize(x).toString())).toList()) {
        md.update(root.relativize(p).toString().replace('\\','/')
            .getBytes(java.nio.charset.StandardCharsets.UTF_8));
        md.update((byte) 0);
        md.update(Files.readAllBytes(p));
      }
    }
    return HexFormat.of().formatHex(md.digest());
  }
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("two directories required");
    String a = digest(Path.of(args[0])), b = digest(Path.of(args[1]));
    System.out.println(a.equals(b) ? "PASS identical trees" : "FAIL different trees");
    if (!a.equals(b)) System.exit(1);
  }
}
~~~

Compile with `javac --release 17 TreeDigest.java` and run with `java TreeDigest buildA buildB`. This educational example hashes relative paths and bytes, not metadata, permissions or symlink semantics; it is not a complete supply-chain attestation.

## 常见陷阱
- 把“103 个文件在固定路径一致”当作跨目录可复现。
- 把测试通过当作 iPhone/Safari、Keychain 和生产部署验收。
- 只比较文件内容，不比较相对路径；或忽略文件权限与符号链接。
- 为了得到 PASS 随意排除有差异的交付文件。
- 未定位差异根因就修改生产配置。

## Senior 面试题
CorePilot 的 Python wheel 字节复现 PASS，但 Web 跨目录 FAIL；其余功能测试 PASS。你会批准上线吗？如何设计最小化实验定位差异，并定义清晰的 GO/NO-GO 条件？先自行回答。

## 15 分钟实践
用两个临时目录分别创建同名同内容文件，运行 TreeDigest 应 PASS；修改其中一个文件，应 FAIL 且退出码为 1。随后列出构建输入、环境变量、工具版本和未验证的真实设备场景；不要操作生产服务。

## 总结
构建正确、构建可复现和生产可发布是不同的证据层。存在未解释的跨目录差异和关键验收缺口时，保留 NO-GO。
