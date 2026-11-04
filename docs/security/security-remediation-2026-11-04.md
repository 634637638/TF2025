# TF2025 高优先级安全修复记录（2026-11-04）

本文记录基于 `b7b200e` 和当日未提交工作区快照执行的高优先级修复、验证结果与尚未实施事项，不代表生产环境已经部署。

## 修复基线与备份

- 修复分支：`fix/tf2025-p0-p1-20261104`。
- 工作区快照：Git stash `pre-fix-b7b200e-20261104`，包含已跟踪和未跟踪文件。
- 完整备份：`backend/backups/backup_20261104_101519.zip`，包含云数据库 78 张表、后端代码和上传文件。
- 备份生成后数据库连接池已正常关闭；`unzip -t` 完整性检查通过，未检测到压缩数据错误；备份文件未提交到 Git。

## 已完成

### 门店路由未定义连接池变量

`backend/src/routes/stores.js` 在迁移到 `StoreRepository` 的过程中仍把已删除的 `pool` 传给辅助函数，导致创建、更新和详情接口可能抛出 `ReferenceError`。

修复后，门店查询统一通过 `storeRepository.executePrepared()`，事务连接仍通过 `storeRepository.acquireConnection()` 获取。新增 `backend/test/stores-route-regression.check.js`，覆盖创建、更新、详情和删除路由的运行路径。

### 数据检查动态更新字段

`backend/src/services/data-check.service.js` 原先把请求体字段名直接拼接进 `UPDATE ... SET`，参数绑定只能保护值，不能保护列名，同时允许修改非业务授权字段。

修复后：

- 每种数据类型分别声明表名和允许编辑字段。
- 表名、列名和主键统一使用反引号包裹，值继续使用参数绑定。
- 未知字段、空对象、非法 ID，以及 `id`、`password`、`role`、`status` 等非白名单字段返回 400。
- 更新后的查询只返回允许编辑的字段，不使用 `SELECT *`，避免员工记录携带密码字段。
- 前端编辑框只展示同一业务类型允许编辑的字段，不再回传状态、关联显示字段或重复检查标记。

新增 `backend/test/data-check-edit-security.check.js`，覆盖恶意列名、敏感字段和合法白名单 SQL。

## 待方案评审后实施

以下改动涉及密钥或令牌，尚未写入代码：

1. 价格同步密码迁移到 `PRICE_SYNC_ENCRYPTION_KEY`、AES-256-GCM 和 `enc:v2:` 密文格式。
2. 同步配置接口不再回显已有密码，只接受明确提交的新密码。
3. H5 客户 Token 改存摘要并提供存量迁移与轮换策略。

评审通过前，不修改存量密文、Token 数据或生产启动条件。

## 验证

- `git diff --check`：通过。
- `npm run type-check --prefix frontend`：通过。
- 门店与数据检查专项测试：通过。
- 后端全量测试仍有工作区原有契约失败，需在后续质量门禁阶段修复后重新确认全绿。

备份服务完成日志把文件计数显示为 0，但实际 ZIP 内容和完整性检查正常。该统计显示问题列为 P3 遗留，本轮不修改备份服务。

## 相关资料

- [安全文档索引](INDEX.md)
- [环境配置与密钥管理](ENVIRONMENT_SECRETS.md)
- [文档编写与维护规范](../guides/DOCUMENTATION_STANDARDS.md)
