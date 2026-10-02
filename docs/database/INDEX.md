# 数据库文档索引

本目录提供字段契约、结构专题和迁移状态入口。仓库没有统一 DDL 或 SQL migration 目录；任何文档均不等同于生产数据库快照。

- [数据库结构与模块资料入口](DATABASE_MODULE_MAPPING.md)
- [字段统一迁移进度](field-consistency-progress.md)
- [字段一致性迁移记录](field-consistency-migration.md) - 按日期记录的历史核验
- [字段兼容清单](field-compatibility-inventory.md) - 契约迁移与退役字段记录
- [客户表结构文档](customers-table-schema.md)

相关入口：

- 字段/API 契约：`config/field-contracts.json`
- 后端数据库连接：`backend/src/config/database.js`
- 部署环境变量与密钥：[环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md)
- [权限数据模型](../permissions/INDEX.md)
- [部署文档](../deployment/INDEX.md)
