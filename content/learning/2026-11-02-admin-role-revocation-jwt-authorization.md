+++
title = "Senior Java / Security：管理员撤权后，旧 JWT 为什么仍可能越权？"
date = 2026-11-02
draft = false
summary = "从 PromoLocal 管理员角色撤销审查学习 JWT 陈旧权限、服务端授权、并发竞态与安全回归测试。"
tags = ["Java", "Spring Security", "JWT", "Authorization", "Security", "Concurrency"]
categories = ["Learning"]
showComments = true
+++

## 今天的实际问题
PromoLocal 的管理员安全审查发现：原始的普通 JWT 提权绕过已被阻止，但 `PATCH /admin/users/{id}` 仅把 `role` 从管理员改为普通用户的路径仍存在撤权缺口。因此结论是 **NO-GO**，不能把原始测试通过当作完整撤权保证。本文只讨论设计原则，不宣称已修复生产代码。

## 核心概念
**Authentication（身份认证）**确认请求者是谁；**Authorization（授权）**确认请求时是否仍有管理员权限。JWT 里的角色是签发时的快照：如果只相信旧 token 的 `role=admin`，撤权后仍可能放行。MFA 证明某次认证达到额外保证，不代表角色永远有效。

建议在所有敏感管理员入口使用**服务端当前角色和账号状态**作为授权依据；对缓存的权限设定失效机制，并确保角色修改接口也执行同样检查。对于并发撤权和管理操作，明确锁顺序、事务边界与一致性要求；单靠前端隐藏菜单无法防止越权。

## Java / Spring Boot 示例（示意，未经真实项目集成验证）
~~~java
// Spring Security: illustrative service-layer guard, not a drop-in patch.
@Transactional
public void updateUserRole(long targetId, Role newRole, long actorId) {
    User actor = users.findByIdForUpdate(actorId).orElseThrow();
    User target = users.findByIdForUpdate(targetId).orElseThrow();
    if (actor.getRole() != Role.ADMIN || !actor.isActive()) {
        throw new AccessDeniedException("Admin role revoked");
    }
    // Check business rules (e.g. cannot remove the last admin) here.
    target.setRole(newRole);
}
// Every privileged request must re-check authoritative server-side state;
// a JWT claim alone must not be treated as current role authorization.
~~~
注意：示例锁住 actor 和 target，但实际生产设计还要处理两者相同、固定锁顺序避免死锁、管理员数量约束、审计日志和 Spring Security filter / method security 的入口保护。它**不能单独保证**所有已开始的请求立即停止；严格的并发撤权语义需要进一步设计。

## 常见陷阱
1. 仅校验 JWT 签名和过期时间，未检查实时角色。
2. 只修复 GET 管理员列表，遗漏 PATCH、POST 等写入入口。
3. 把 MFA 已完成误认为当前仍有管理员权限。
4. 先读角色再执行长耗时操作，撤权在检查与写入之间发生。
5. 只验证 HTTP 403，却未确认数据库没有副作用。
6. 角色缓存不失效，导致撤权延迟生效。

## Senior 面试题（先回答）
管理员 A 在 10:00 获得带 `admin` 声明的 JWT；10:05 其角色被撤销；10:06 A 使用旧 JWT 调用 `PATCH /admin/users/{id}`。你如何在 Spring Security 和数据库层设计撤权，确保请求不能继续修改角色？如果撤权与管理写入同时发生，你如何定义和验证正确结果？**先自行回答，不附参考答案。**

## 15 分钟实战
1. 列出所有 `/admin/**` 的 GET/PATCH/POST/DELETE 入口。
2. 为每个入口标记：JWT 认证、当前角色查询、MFA 要求、写入副作用。
3. 设计回归用例：撤权前 token、撤权后 token、并发撤权、权限缓存、失败后数据库不变。
4. 在隔离测试环境验证，不触碰生产权限数据。

## 总结
**JWT 能证明过去签发的身份信息，不能天然证明现在仍拥有管理员权限。** 撤权是跨入口、跨缓存和并发事务的一致性问题；未完成端到端验证就应维持 NO-GO。
