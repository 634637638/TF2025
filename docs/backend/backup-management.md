# 备份管理

本文说明 `/backup` 管理页支持的备份类型、文件格式和下载边界。备份数据来自后端运行环境配置的 MySQL 连接。

## 备份类型

| 类型 | 内容 | 文件格式 |
| --- | --- | --- |
| 仅数据库 | 当前 `DB_NAME` 对应数据库的结构与数据 | `database_YYYYMMDD_HHMMSS.sql` |
| 完整备份 | 数据库、后端代码及 `backend/uploads` 文件 | `backup_YYYYMMDD_HHMMSS.zip` |

创建接口为 `POST /api/backup/create`，请求体 `type` 可取 `database` 或 `full`。为兼容旧客户端，省略 `type` 时按 `full` 处理。两种文件都会进入同一备份目录，并通过备份列表、受控下载、删除、容量统计和旧备份清理管理。

## 恢复说明

数据库备份是 SQL 导出文件。恢复前应选择目标数据库并确认覆盖影响，再使用 MySQL 客户端导入，例如：

```bash
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < database_YYYYMMDD_HHMMSS.sql
```

完整 ZIP 包含数据库导出和代码/上传文件快照；它不会自动部署或覆盖运行中的服务。请先在隔离环境检查压缩包内容，再按部署流程恢复。

## 权限与验证

- 创建需要 `backup:create`；查看和下载需要 `backup:view`；删除与清理需要 `backup:delete`。
- 下载仍使用短时下载令牌，文件名必须匹配服务端允许的备份命名格式。
- 后端契约测试：在 `backend` 目录运行 `npm test`。
