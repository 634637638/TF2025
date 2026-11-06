# 数据库文档索引

本目录提供字段契约、结构专题和迁移状态入口。版本化 DDL 基线由 `backend/scripts/migrate-schema.js` 统一编排，独立专项脚本仍保留自己的预览与执行边界；本目录不等同于生产数据库快照。

- 生产应用进程不执行 DDL。`SCHEMA_MIGRATION_MODE=true` 仅与 `backend/scripts/migrate-*.js` 显式维护入口配合使用；普通 API 进程即使误配该变量也不获得 schema 变更授权。
- schema baseline 和独立数据库验收分别见[后端索引](../backend/INDEX.md)及[后端数据库回归测试](../backend/database-testing.md)。

- [数据库结构与模块资料入口](DATABASE_MODULE_MAPPING.md)
- 站内公告数据库结构和迁移边界见[站内公告接口说明](../backend/site-announcements.md)。
- [字段统一迁移进度](field-consistency-progress.md)
- [字段一致性迁移记录](field-consistency-migration.md) - 按日期记录的历史核验
- [字段兼容清单](field-compatibility-inventory.md) - 契约迁移与退役字段记录
- [客户表结构文档](customers-table-schema.md)
- [客户销售积分统一规范](../guides/customer-points-standard.md) - `customers.points` 与 `sales` 逐单积分凭据、迁移和事务边界

客户销售积分字段迁移使用 `npm --prefix backend run migrate:customer-sale-points` 预览，确认目标和备份后才可追加 `-- --apply`；应用请求进程不执行该 DDL。

相关入口：

- 字段/API 契约：`config/field-contracts.json`
- 后端数据库连接：`backend/src/config/database.js`
- [后端数据库回归测试](../backend/database-testing.md) - 独立测试库、明确授权的业务库模式、14 项用例及回滚/只读复核方法
- 部署环境变量与密钥：[环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md)
- [权限数据模型](../permissions/INDEX.md)
- [部署文档](../deployment/INDEX.md)
