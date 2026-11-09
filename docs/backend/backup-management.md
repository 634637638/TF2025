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

完整 ZIP 包含数据库导出、代码和上传文件快照；后端代码部分会保留 `server.js`、唯一生产入口 `start-production.js` 及 `ecosystem.production.config.js`。它不会自动部署或覆盖运行中的服务。请先在隔离环境检查压缩包内容，再按部署流程恢复。

## Git 管理页项目压缩包

`/git-management` 的“创建压缩包备份”生成 `.tar.gz` 源码快照，与 `/backup` 的完整 ZIP 是不同用途。快照包括 `frontend/`、`docs/`、根目录 `package.json` 和可用的 lockfile、`shared/`（存在时），以及后端 `src/`、`scripts/`、`package.json`、`package-lock.json`、`database/`、`migrations/`、`.env.example` 和 `src/config/runtime-files.js` 登记的生产启动文件。

快照排除 `node_modules/`、构建产物、日志、上传文件、本地备份、`.git/`、SQLite 文件和真实环境文件（包括 `.env.production`）。它带上部署说明和规范正文，但不携带生产凭据、运行数据或上传资产；恢复时仍需安全配置 `.env.production`、运行 `npm ci`，并按业务备份流程恢复数据库与上传文件。

后端生产启动文件的唯一清单位于 `backend/src/config/runtime-files.js`，同时供完整备份与 Git 管理页压缩包复用。若新增或移除部署必需目录/文件，应同步更新 `backend/src/services/git-archive-backup.service.js`、`backend/test/git-archive-backup-controller.check.js` 与本节，并检查环境文件、日志、上传和生成数据的排除规则。

## 权限与验证

- 创建需要 `backup:create`；查看和下载需要 `backup:view`；删除与清理需要 `backup:delete`。
- 下载仍使用短时下载令牌，文件名必须匹配服务端允许的备份命名格式。
- 后端契约测试：在 `backend` 目录运行 `npm test`。
