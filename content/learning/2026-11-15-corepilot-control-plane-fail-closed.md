+++
title = "Senior Java / AI：CorePilot 控制平面的 Fail-Closed 准入与幂等启动"
date = 2026-11-15
draft = false
summary = "基于 CorePilot 服务控制与隔离验收，学习授权、健康检查、状态门禁和幂等请求。"
tags = ["Java", "AI", "CorePilot", "Architecture"]
categories = ["Learning"]
showComments = true
+++

## 真实背景
CorePilot 的服务管理与实例切换涉及 Start、Stop、Restart。测试通过或控制 API 返回 200 不意味着真实进程已经安全启动。今天将注意力放在 **控制平面（control plane）的启动准入**，与此前的内存准入和模型驻留课程不同。

## 核心概念
**Fail-closed**：权限、守卫健康状态或实例状态无法确认时，拒绝启动，不应把未知当作允许。**Idempotency key**：同一请求重试不应重复启动；需在持久化存储中原子记录请求 ID 和结果。**State machine**：仅允许从明确的 STOPPED 进入 STARTING；RUNNING、STARTING 和 UNKNOWN 不能重复启动。**Observation ≠ execution**：只读状态接口不能代替真实启动验收。

## Python 3.10+ 教学示例
以下纯函数仅计算资格，不执行进程操作；示例断言可单独运行，**不构成完整幂等实现**。

~~~python
from dataclasses import dataclass

@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str

def admit_start(*, authorized: bool, guard_healthy: bool,
                instance_state: str, request_id: str) -> Decision:
    if not request_id.strip():
        return Decision(False, "MISSING_REQUEST_ID")
    if not authorized:
        return Decision(False, "FORBIDDEN")
    if not guard_healthy:
        return Decision(False, "GUARD_UNAVAILABLE")
    if instance_state != "STOPPED":
        return Decision(False, "INVALID_STATE")
    return Decision(True, "ELIGIBLE_ONLY")

assert not admit_start(authorized=True, guard_healthy=False,
                       instance_state="STOPPED", request_id="r1").allowed
assert admit_start(authorized=True, guard_healthy=True,
                   instance_state="STOPPED", request_id="r1").allowed
~~~

## 常见陷阱
只检查 UI 按钮是否禁用；先启动后鉴权；把 guard 超时当作通过；仅在内存中保存请求 ID；把启动 API 的 HTTP 200 当作进程 READY；发生异常时自动重试 Start 而不查询当前状态。

## Senior 面试题（先独立作答）
两个客户端同时使用不同 request_id 请求启动同一个 STOPPED 实例。两者都读取到 STOPPED；随后安全守卫短暂失联。你如何保证最多启动一次，且任何无法确认的检查都不会绕过？

## 15 分钟实战
画出 STOPPED → STARTING → RUNNING、FAILED 和 UNKNOWN 的状态转移；列出授权失败、guard 超时、重复 request_id、并发不同 request_id 四个测试。不要操作生产实例。

## 总结
控制平面的安全来自服务端原子状态转换、权限校验、可审计的请求去重与故障时拒绝，而不是按钮状态或单次健康检查。
