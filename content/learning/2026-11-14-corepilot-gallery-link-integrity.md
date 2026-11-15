+++
title = "Senior AI / Backend：CorePilot 任务历史与图库链接完整性"
date = 2026-11-14
draft = false
summary = "从 CorePilot 的真实 UX 需求理解媒体可用性、权限校验与失效链接治理。"
tags = ["AI", "CorePilot", "Backend", "Media"]
categories = ["Learning"]
showComments = true
+++

## 实际背景
CorePilot 创作历史应保留已删除或过期的任务记录，但只有图片或视频确实可以在图库定位、且用户有权访问时，才显示“查看生成作品”。无效链接不应占位；“移除记录”应独立可用。

## 核心概念
**Task Record ≠ Media Asset**：任务历史是审计和体验记录，媒体是可独立删除或过期的资源。**Link eligibility**：需要同时验证任务关联、媒体状态、图库可见性、文件可用性和访问权限。**TOCTOU**：列表检查通过后文件仍可能被删除，点击时服务端必须再次授权并返回正确的 404/410。

## Python 3.10+ 纯函数示例（已隔离测试）
常见陷阱

## 只用非空 media_id 显示按钮；仅在前端隐藏链接却不校验下载权限；把磁盘路径暴露给浏览器；将任务删除与媒体删除混为一谈；依赖缓存中的旧可用状态；将文件存在检查误当作永久可用性保证。
Senior 面试题

~~~python
from dataclasses import dataclass

@dataclass(frozen=True)
class Media:
    id: str
    status: str
    gallery_visible: bool
    file_exists: bool
    owner_id: str

def can_view_generated_media(media: Media | None, requester_id: str) -> bool:
    return (media is not None and media.owner_id == requester_id
            and media.status == "READY" and media.gallery_visible
            and media.file_exists)
~~~

## CorePilot 有一条 SUCCEEDED 视频任务，media_id 非空，但图库文件已被清理。如何设计 API、数据库关联和前端状态，既保留任务历史、隐藏无效查看按钮，又避免并发删除与越权访问？先作答，不提前看答案。
15 分钟实战

## 画出 Task → Media → Gallery 的关系；列出 READY、DELETED、EXPIRED、MISSING、FORBIDDEN 六种情况的按钮与 HTTP 行为；编写一个仅用于隔离环境的 eligibility 测试。
总结

## 任务记录的存在不能证明媒体可访问。UI 只展示当前有根据的操作，真正的授权与存在性检查必须由服务端执行。
undefined

