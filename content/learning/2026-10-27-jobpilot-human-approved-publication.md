+++
title = "Senior Java / AI：JobPilot 候选池为何不等于已发布职位"
date = 2026-10-27
draft = false
summary = "从 51 条候选与 6 条公开职位理解人工审核闸门、不可变发布计划和安全重试。"
tags = ["Java", "AI Agents", "Human-in-the-Loop", "JobPilot", "Architecture", "Testing"]
categories = ["Learning"]
showComments = true
+++

## 今天的真实问题：新增职位为何没出现在网站？

2026-10-27，JobPilot 的 scripts/job-candidates.json 已有 51 条候选职位，而 frontend/public/data/jobs.json 仍是 6 条公开职位。已检查仓库的 scripts/PUBLISHING.md：当前流程明确是只读预览，不会自动写入正式职位；prepare-publication.mjs 返回 publication_enabled: false。

想象超市：仓库收到 51 件商品，不等于货架上自动出现 51 件。采集和发布是两个独立步骤。

## 1. 三步理解发布闸门

**发现（Candidate）**：采集器收集可能的职位，但尚未获得发布资格。

**审核（Approval）**：核验官方来源、Québec 资格、100% 远程、招聘状态；可信人工审核将稳定 job_id 加入 approved_ids。HIGH/MEDIUM 只是推荐优先级，不代表批准。

**发布（Publication）**：单独的发布流程读取最新 main、验证 Schema、稳定 ID 与来源冲突，仅准备已获批准的变更。当前 JobPilot 的发布阶段尚未启用。

候选数量增加但公开列表不变，可能是正常的审核等待，不应直接判断采集器故障。

## 2. Java 17：最小可运行模型

以下是隔离教学示例，不是 JobPilot JavaScript 发布器的完整翻译。它特意采用更严格的条件：Québec 资格必须明确为 true，招聘状态必须是 OPEN。代码只计算不可变列表，没有网络或文件写入。

~~~java
import java.util.List;
import java.util.Set;

public class ApprovalGateDemo {
    record Job(String id, boolean remote, boolean quebecEligible,
               String recruitingStatus, String tier) {}

    // Educational model: stricter than JobPilot's actual preview logic.
    static boolean canPublish(Job job, Set<String> approvedIds) {
        return approvedIds.contains(job.id())
            && job.remote()
            && job.quebecEligible()
            && "OPEN".equals(job.recruitingStatus())
            && Set.of("HIGH", "MEDIUM").contains(job.tier());
    }

    static List<Job> plan(List<Job> candidates, Set<String> approvedIds) {
        return candidates.stream()
            .filter(job -> canPublish(job, approvedIds))
            .toList(); // Immutable result; no network or file writes.
    }

    public static void main(String[] args) {
        Job approved = new Job("job-1", true, true, "OPEN", "HIGH");
        Job pending  = new Job("job-2", true, true, "OPEN", "HIGH");
        Job excluded = new Job("job-3", true, true, "OPEN", "EXCLUDE");
        Job notQc    = new Job("job-4", true, false, "OPEN", "HIGH");
        var result = plan(List.of(approved, pending, excluded, notQc),
                          Set.of("job-1", "job-3", "job-4"));
        if (result.size() != 1 || !result.get(0).id().equals("job-1")) {
            throw new AssertionError("Approval gate failed");
        }
        if (canPublish(pending, Set.of())) {
            throw new AssertionError("Unapproved job was accepted");
        }
        System.out.println("PASS: only approved eligible job selected");
    }
}
~~~

Run / Exécution / 运行: `javac --release 17 ApprovalGateDemo.java && java ApprovalGateDemo`.

## 3. 真实发布仍需要哪些保障？

仅有内存过滤器不够。写入前还需重新核验招聘来源及更新时间、稳定 ID 和 URL 去重、输出 Schema，以及远程 main 的最新 SHA。如果 main 已变化，必须重新计算或停止，不能用旧数据覆盖新提交。现有 JobPilot 文档明确禁止强制推送和直接向 main 发布。

## 4. Senior 常见陷阱

- 把 AI 给出的 HIGH 匹配度当成人工批准。
- 将 UNKNOWN 或 quebec_eligible=null 当作已核实。
- 只因为公开列表没变，就认定职位采集失败。
- 重试时重复添加同一 job_id，或者覆盖更新后的远程数据。
- 前端隐藏按钮，却没有限制服务端写入权限。
- 把 publication_enabled=false 的预览误报成已经发布。

## 5. Senior 面试题（先回答）

自动采集新增 5 个职位，候选池从 46 增至 51，但公开列表仍为 6。你如何区分正常的人工审核等待和真正的发布故障？若两个 Worker 同时发布相同的获批职位，如何避免重复和丢失更新？先自行回答，本文不提前公布答案。

## 6. 15 分钟实战

1. 将 Java 代码保存为 ApprovalGateDemo.java，运行 javac --release 17 ApprovalGateDemo.java && java ApprovalGateDemo。
2. 将 approvedIds 改成空集合，确认计划为空。
3. 将 job-1 的 quebecEligible 改为 false，确认即使已批准也不能发布。
4. 画出 Candidate → Reviewed → Approved → Proposed → Published，标出人工批准位置。不要修改 JobPilot 正式数据。

## 总结

**发现不等于审核，审核不等于发布。** 可靠 AI 工作流需要可验证的人工批准、无副作用的发布计划、重复检测，以及独立的写入权限。

核验依据：qinze2017/JobPilot 的 scripts/PUBLISHING.md、scripts/prepare-publication.mjs、scripts/job-reviews.json 和 2026-10-27 的候选与公开数据。

