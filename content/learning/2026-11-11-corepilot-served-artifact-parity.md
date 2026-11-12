+++
title = "Senior Java / AI：CorePilot 静态文件与 HTTP 实际响应的一致性"
date = 2026-11-11
draft = false
summary = "通过 CorePilot 的页面 SHA-256 对比学习如何证明线上服务实际返回的是预期构建产物。"
tags = ["Java", "AI", "CorePilot", "Release Engineering"]
categories = ["Learning"]
showComments = true
+++

## 实际背景
11 月 11 日你在 CorePilot 上检查了 API 状态、iPhone HTTPS 入口、磁盘上的 `web/out/create/index.html` SHA-256，以及服务实际返回的 `/create/` 页面 SHA-256。这些命令是核验步骤；当前没有完整输出证据，不能断言两个哈希已经一致。

## 核心概念
**Build artifact（构建产物）**是磁盘中的文件；**served artifact（实际提供的内容）**是 HTTP 客户端收到的字节。两者可能因反向代理路由、旧进程、缓存、重定向、压缩或错误页面而不同。只有同时检查 HTTP 状态、目标 URL、响应内容和 SHA-256，才可以判断是否是预期页面。哈希相等只能证明所比较字节一致，不能证明整个站点安全或部署完成。

## Java 17：比较文件和 HTTP 响应
下面的程序对本地文件和 HTTP 200 响应计算 SHA-256；使用 `BodyHandlers.ofByteArray()` 避免字符编码转换。代码已用 `javac --release 17` 编译通过，尚未对 CorePilot 真机接口执行集成测试。

~~~java
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.security.*;
import java.util.HexFormat;
public class ArtifactParity {
  static String sha(byte[] bytes) throws Exception {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  }
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("local file and HTTP URL required");
    byte[] local = Files.readAllBytes(Path.of(args[0]));
    HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    HttpResponse<byte[]> response = client.send(
        HttpRequest.newBuilder(URI.create(args[1])).GET().build(),
        HttpResponse.BodyHandlers.ofByteArray());
    if (response.statusCode() != 200)
      throw new IllegalStateException("HTTP " + response.statusCode());
    String a = sha(local), b = sha(response.body());
    System.out.println("local=" + a + "\nserved=" + b);
    if (!a.equals(b)) { System.err.println("MISMATCH"); System.exit(1); }
    System.out.println("MATCH");
  }
}
~~~

运行：`javac --release 17 ArtifactParity.java`，然后 `java ArtifactParity /path/to/index.html https://example.test/create/`。使用自己的可信测试地址，不要将示例域名当作实际服务。

## 常见陷阱
- 只看到 HTTP 200 就认定返回的是正确页面。
- 只比较磁盘文件，未比较服务真正返回的字节。
- 代理返回登录页、错误页或旧缓存却未检查响应内容。
- 混淆压缩传输字节与解压后的实体内容；必须说明比较的是哪一种。
- 把某一页面的哈希一致当成所有路由、权限和移动端均通过。

## Senior 面试题
CorePilot 的本地 `index.html` SHA 与 `curl` 得到的 SHA 不同，但 HTTP 状态是 200。你如何逐层定位差异？在什么证据充分时才允许发布？请先自行回答。

## 15 分钟实践
只读检查：`shasum -a 256 web/out/create/index.html`；再用 `curl -fsS -o /tmp/corepilot-served-create.html https://<你的可信地址>/create/` 保存实际响应并计算哈希。记录 URL、状态码、响应头、时间和两个摘要。避免用 `-k` 的成功结果证明 TLS 身份可信；不要重启或部署服务。

## 总结
构建产物存在、HTTP 200、实际响应字节一致，以及生产发布获准，是四项不同的证据。