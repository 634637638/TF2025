# 数据库结构与模块资料入口

仓库没有一份可代表生产数据库的完整 DDL 或统一 SQL 迁移目录。过去的手工模块/数据表映射已移除，避免把已漂移的表名和不存在的迁移脚本误当成事实。

## 可核实的维护入口

- 字段/API 契约：`config/field-contracts.json`
- 字段迁移与模块状态：[字段统一迁移进度](field-consistency-progress.md)
- 客户表结构专题：[客户表结构文档](customers-table-schema.md)
- 数据库连接配置：`backend/src/config/database.js`
- 后端维护脚本：`backend/scripts/` 和 `backend/src/scripts/`
- 部署数据库环境变量：服务器本地的 `backend/.env.production`；密钥管理见[环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md)

## 变更要求

- 先确认目标数据库和当前真实表结构；不能仅凭旧文档或本地代码假设生产库状态。
- 执行脚本前检查其 SQL、写入范围、是否幂等及回滚方式，并先做数据库备份。
- 新字段或接口变更时同步更新字段契约、对应测试和迁移记录。
- 不在文档、命令示例或截图中写入数据库凭据。
