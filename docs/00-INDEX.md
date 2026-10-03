# TF2025 文档入口

本文档只负责导航。具体内容以各分类索引和文档引用的代码、配置为准。

## 常用入口

| 主题 | 入口 | 内容 |
| --- | --- | --- |
| 开发与代码规范 | [开发指南](guides/INDEX.md) | API、类型、日志、错误处理、移动端及文档写作规范 |
| 前端强制规范 | [前端规范索引](frontend/INDEX.md) | 唯一权威前端规范；审计清单见 `frontend/standards-manifest.json` |
| 后端 | [后端文档索引](backend/INDEX.md) | 后端接口、上传存储和数据迁移说明 |
| 权限 | [权限文档索引](permissions/INDEX.md) | RBAC、页面能力、字段权限及审计要求 |
| 部署 | [部署文档索引](deployment/INDEX.md) | 环境变量、服务器部署、Nginx 与上传发布 |
| 数据库 | [数据库文档索引](database/INDEX.md) | 表结构、模块映射与字段契约 |
| 业务 | [业务文档索引](business/INDEX.md) | 考勤、库存、预定、租赁及业务规则 |
| 数据同步 | [同步文档索引](sync/INDEX.md) | 数据导入、同步与价格来源 |
| 支付 | [支付文档索引](payments/INDEX.md) | 供应商付款流程 |
| 性能 | [性能文档索引](performance/INDEX.md) | 仍有效的实现说明；历史评估不作为当前基准 |
| 安全 | [安全文档索引](security/INDEX.md) | 密钥管理、公开接口风险与审计记录 |
| 开发进展 | [开发记录索引](development/INDEX.md) | 有日期的实施、审计与进度快照 |
| 兼容接口清理 | [兼容接口与弃用路由台账](guides/compatibility-route-retirement-ledger.md) | 旧接口迁移、权限差异、日志观察和逐项删除条件 |
| 组件专题 | [组件专题索引](components/INDEX.md) | 组件指南和旧资料迁移入口 |
| 示例 | [代码示例索引](examples/INDEX.md) | 组件示例；实际要求以现行规范为准 |
| 数据优化 | [数据优化与导入索引](数据优化/INDEX.md) | 智能导入与匹配专题 |
| 归档 | [归档文档索引](archive/INDEX.md) | 已弃用但保留的历史资料 |

## 文档层级

- `docs/frontend/` 中已登记在 `standards-manifest.json` 的文件是前端强制规范的唯一正文。
- `docs/guides/` 提供跨模块开发指南；`docs/business/`、`docs/backend/` 等目录记录业务和技术专题，不复制强制规范。
- 带日期的进展、排查和验证报告是当时的记录，不自动代表当前实现或线上状态。
- 合并或删除重复规范时，必须在保留的权威规范或迁移说明中写明替代入口，不得让规范要求随重复正文一起消失。
- `docs/standards/` 仅保留旧路径导航；不要在该目录新增规范正文。

## 文档维护

- [文档编写与维护规范](guides/DOCUMENTATION_STANDARDS.md)
- [新文档模板](TEMPLATE.md)
- [项目变更记录](CHANGELOG.md)
- [AI 协作说明](CLAUDE.md)
