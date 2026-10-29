+++
title = "Senior Java / AI：139 项测试通过，为什么 MCP 仍不能上线？"
date = 2026-10-28
draft = false
summary = "用 PromoLocal Photo Deal 的离线审计理解证据分层、fail-closed 发布闸门和真实只读联调。"
tags = ["Java", "AI Agents", "MCP", "Security", "Release Gates", "Architecture", "Testing"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实问题：测试全部通过，为什么还是 NO-GO？

在 2026-10-28 的 PromoLocal Photo Deal 第一阶段审计总结中，报告称 ZIP 的 SHA-256 与预期一致，原有测试 **101 通过、0 失败**，新增独立安全反例 **38 通过、0 失败**，共 **139 通过**。但结论明确分开：**离线第一阶段审计 GO；真实只读 MCP 联调 NO-GO；创建 Deal NO-GO**。

这并不矛盾。**测试通过，只能证明被测试的条件通过；不能证明尚未测试的真实集成已安全。** 本文依据审计总结讲解架构原则，不代表本次重新运行了原 ZIP 或连接真实 MCP 服务。

## 1. 三层证据，不能互相替代

**第一层：离线审计**。校验制品摘要、单元测试、模拟 HTTP、负面授权测试。它证明当前代码在规定的离线环境中表现符合预期。

**第二层：真实只读 MCP**。使用实际受支持的 MCP 传输和协议协商，验证平台身份、owner-only 权限、token 的过期/audience/scope，以及拒绝时绝不触发上游请求；仅允许读取，且要有可追溯的真实测试记录。

**第三层：创建写入**。需要在只读边界已验证的基础上，另外证明可信人工批准绑定完整请求、幂等键与结果对账、附件清理和写入凭据隔离。未通过前不注册或暴露创建工具。

关键不是“139 大不大”，而是**每个发布阶段需要什么独立证据**。139 项离线测试不能自动变成真实 MCP 认证通过的证据。

## 2. Java 17：用 fail-closed 决策表表达发布闸门

下面是**纯内存教学模型**，不是 MCP 服务器、认证系统或部署脚本。布尔值必须来自可信验证记录，不能由 AI 自己填写。 `eligible` 表示相应阶段的证据已经齐全，而不是授权代码自动上线。

~~~java
import java.util.Objects;

public class McpReleaseGateDemo {
    enum Gate { OFFLINE_AUDIT, LIVE_READ_ONLY, CREATE_WRITE }

    record Evidence(boolean digestMatched,
                    boolean offlineTestsPassed,
                    boolean ownerAuthVerified,
                    boolean protocolVerified,
                    boolean liveReadOnlyVerified,
                    boolean trustedApprovalVerified,
                    boolean idempotencyVerified,
                    boolean writeIsolationVerified) {}

    static boolean eligible(Gate gate, Evidence e) {
        Objects.requireNonNull(gate);
        Objects.requireNonNull(e);
        boolean offline = e.digestMatched() && e.offlineTestsPassed();
        boolean readOnly = offline && e.ownerAuthVerified()
            && e.protocolVerified() && e.liveReadOnlyVerified();
        return switch (gate) {
            case OFFLINE_AUDIT -> offline;
            case LIVE_READ_ONLY -> readOnly;
            case CREATE_WRITE -> readOnly && e.trustedApprovalVerified()
                && e.idempotencyVerified() && e.writeIsolationVerified();
        };
    }

    static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        Evidence offlineOnly = new Evidence(true, true, false, false,
                                            false, false, false, false);
        check(eligible(Gate.OFFLINE_AUDIT, offlineOnly), "offline audit");
        check(!eligible(Gate.LIVE_READ_ONLY, offlineOnly), "read-only blocked");
        check(!eligible(Gate.CREATE_WRITE, offlineOnly), "write blocked");

        Evidence readOnly = new Evidence(true, true, true, true,
                                         true, false, false, false);
        check(eligible(Gate.LIVE_READ_ONLY, readOnly), "read-only eligible");
        check(!eligible(Gate.CREATE_WRITE, readOnly), "write still blocked");

        Evidence missingOwnerAuth = new Evidence(true, true, false, true,
                                                 true, true, true, true);
        check(!eligible(Gate.CREATE_WRITE, missingOwnerAuth), "fail closed");
        System.out.println("PASS: release gates fail closed");
    }
}
~~~

运行：`javac --release 17 McpReleaseGateDemo.java && java McpReleaseGateDemo`。预期输出：`PASS: release gates fail closed`。

## 3. Senior 常见陷阱

- 把模拟测试通过当成真实 OAuth/MCP 协商已通过。
- 只检查 HTTP 401，却不检查**被拒绝的请求是否仍调用了上游 API**。
- 将共享后端 Bearer token 误当作用户身份，或者相信模型提供的 `user_id`。
- 把“可读取分类”误当作“可以创建 Deal”。
- 超时后盲目重试 POST，造成重复创建；或者没有处理已上传但取消的附件。
- 只有 GO/NO-GO 一个总开关，没有记录每个阶段缺失的证据。

## 4. Senior 面试题：先自己回答

假设独立审计报告显示 139/139 离线测试通过，但**尚未验证真实 MCP owner-only 身份边界和协议协商**。产品经理要求明天开放创建 Deal。你会如何划分离线、只读和写入三个闸门？哪些证据缺失时必须拒绝？**先作答，不在这里公布参考答案。**

## 5. 15 分钟实战

1. 将示例保存为 `McpReleaseGateDemo.java`，编译并运行。
2. 将 `offlineOnly` 的 `digestMatched` 改成 `false`，验证连离线闸门也关闭。
3. 在纸上写三列：离线证据、真实只读证据、创建写入证据；逐项标记 `verified / missing`。
4. 为真实只读联调设计一个**拒绝后上游调用次数必须为 0**的测试案例；不要使用生产 token，不调用创建 POST。

## 总结

**安全发布不是“测试总数够多”，而是“对应阶段的可信证据齐全”。** 先离线审计，再真实只读验证，最后才讨论带人工批准和幂等保护的写入。任何证据缺失都应 fail closed。

资料边界：本文依据 2026-10-28 的 Photo Deal 审计总结；139 项测试是该报告的结果，不是本文章教学代码的测试数量。
