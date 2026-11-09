+++
title = "Senior Java / AI：Seata MCP 事务诊断与只读 Agent 安全边界"
date = 2026-11-08
draft = false
summary = "以 Seata 事务诊断为例，理解 MCP 工具权限、证据关联与 Fencing Token。"
tags = ["Java", "AI", "Seata", "MCP"]
categories = ["Learning"]
showComments = true
+++

## 背景
11 月 8 日学习了 Seata 控制台通过 MCP 向 AI 助手暴露事务诊断能力的介绍。实际生产接入前必须以目标版本的官方文档和部署配置核实可用工具、权限与 API；不能把文章介绍当作已验证的接口契约。

## 核心概念
分布式事务排障需要关联全局事务 XID、分支事务、全局锁、日志和时间线。MCP 是连接模型与工具的协议层，不负责自动保证业务授权。AI 可以解释证据，但不能仅凭自然语言请求直接执行解锁、回滚或删除记录。

~~~text
User question -> LLM -> read-only MCP adapter -> authorized Seata console API
              -> structured evidence (XID, branch, lock, time) -> explanation
              -> human-approved remediation
~~~
关键控制：最小权限、只读默认、服务端认证授权、参数校验、审计日志、敏感字段脱敏、超时和限流。工具返回的日志属于不可信输入，不能作为高优先级指令。

## Java / Spring Boot 示例
下面是与 MCP 诊断场景相关的 **独立教学片段**：AI Worker 写回排障结论时，使用版本条件阻止旧 Worker 覆盖新结论。
~~~java
// Spring Data JPA: execute within a service @Transactional boundary.
@Modifying
@Query("UPDATE Job j SET j.status = 'DONE' WHERE j.id = :id AND j.status = 'PROCESSING' AND j.leaseVersion = :version")
int finishIfCurrent(@Param("id") Long id, @Param("version") long version);
~~~
返回 0 表示未匹配行，可能是版本不一致、状态变化或任务不存在；不能直接推断原因。必须在同一数据库事务中完成状态校验与结论保存，并确保失败时不保存旧结果。

## 常见陷阱
- 认为 MCP 工具暴露即意味着调用者已获授权。
- 把 XID 作为唯一证据，不核对分支状态、时间戳与锁记录。
- 让模型自动执行有破坏性的事务补偿操作。
- 在版本检查前保存 AI 结论，造成旧 Worker 污染。
- 把模型对日志的推断误认为确定的根因。

## Senior 面试题
一个 Seata 全局事务长期处于异常状态。Agent 能读取 XID、分支记录和锁信息。如何设计只读诊断、权限边界、证据引用及人工审批？若两个 AI Worker 先后返回不同结论，如何阻止旧结论覆盖新结论？先回答，不附参考答案。

## 15 分钟实践
画出「只读 MCP → 证据快照 → 诊断建议 → 人工确认」状态图；为每次诊断设计 requestId、XID、采集时间、证据来源与 leaseVersion。不要连接或修改生产事务。

## 总结
MCP 让事务证据更容易被 AI 检索，但正确性仍依赖可靠证据、最小权限、幂等写入与人工控制。
