# 站内公告

## 功能范围

系统管理的“站点信息”Tab 包含 Logo、站点信息、站内公告三个并列卡片。系统查看权限可读取公告列表；系统编辑权限可新增和编辑公告，系统删除权限可删除公告。仪表盘只显示已发布且未过期的公告，最多读取 20 条，按置顶优先、发布时间最新排序，首页显示一条并提供上一条/下一条切换。

公告标题上限 150 字符；正文使用统一富文本编辑器，最多 100000 字符，可插入图片和视频。支持草稿/发布、单条置顶和可选有效期。时间以北京时间保存和比较。已发布公告在有效期到达后自动从员工端隐藏，后台仍可编辑或删除。富文本入口、安全净化和媒体范围见[富文本内容统一规范](../frontend/rich-content-standards.md)。

## API

站内请求复用统一认证、CSRF/XSRF 和 `unifiedApi`。

| 方法与路径 | 访问要求 | 用途 |
| --- | --- | --- |
| `GET /api/system/announcements` | 登录用户 | 读取有效公告 |
| `GET /api/system/announcements/admin` | `system:view` | 读取后台公告列表 |
| `POST /api/system/announcements` | `system:edit` | 新建草稿或发布公告 |
| `PUT /api/system/announcements/:id` | `system:edit` | 编辑公告及发布状态 |
| `DELETE /api/system/announcements/:id` | `system:delete` | 删除公告 |
| `POST /api/content-media` | `system:edit` 或 `guide:edit` | 上传公开公告图片或视频（单文件，最多 100 MiB） |

站内员工接口不返回草稿；后端每个写入入口独立鉴权。公告内容以文本节点显示，不作为 HTML 执行。

## 数据库迁移与部署

数据存储于 `site_announcements`，正文为 `MEDIUMTEXT`，置顶状态为 `is_pinned`，由 `backend/scripts/migrate-site-announcements.js` 管理。迁移脚本默认只检查目标库并输出待办，不会创建表或变更结构：

```bash
cd backend
npm run migrate:site-announcements
```

确认输出的目标数据库是当前部署使用的云端数据库，并完成备份后，显式执行：

```bash
npm run migrate:site-announcements -- --apply
```

迁移后部署/重启后端与前端。不要在普通应用进程中自动创建表。真实数据库迁移需按仓库数据库变更授权要求单独确认。2026-11-06 已在当前后端环境配置的数据库执行迁移并复核：`content` 为 `MEDIUMTEXT`、`is_pinned` 为 `TINYINT UNSIGNED NOT NULL`，再次运行迁移检查返回 `already_ready`。迁移前备份位于 `backend/backups/database_20261106_155822.sql`。
