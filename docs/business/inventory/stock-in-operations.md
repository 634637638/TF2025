# 入库操作与安全边界

本文记录采购入库接口的门店权限、事务和入库单号规则。生产数据库状态不能仅由源码推断，部署前置条件见下方说明。

## 门店范围与写入

- 入库列表、统计、详情、创建、编辑和删除由后端按登录用户的 `store_id/store_ids` 校验；前端传入门店 ID 不能扩大授权范围。
- 编辑和删除在事务内对目标 `phones` 行执行 `SELECT ... FOR UPDATE`，校验现有门店归属后，最终 `UPDATE`/`DELETE` 仍携带授权门店条件。
- 更新记录的目标门店必须属于当前账号授权范围。删除不存在的记录返回未找到；跨门店写入返回权限错误。
- 自动匹配预订单与入库写入共用一个事务；预订单按门店与商品规格锁定，并通过 `status = 'pending'` 条件更新防止重复匹配。

## 入库单号

- 入库单号格式为 `PO + 北京时间日期 + 至少 6 位日序号`，例如 `PO20261105000001`。
- 序号使用 `invoice_sequences` 表中 `(sequence_date, type_suffix='PO')` 的唯一行锁分配，并与入库事务一起提交。失败回滚时序号更新也回滚。
- 历史入库单号不会被改写。旧格式包含时分秒和随机后缀，与新格式 `PO + 日期 + 序号` 不同；新格式序号以事务序列表为唯一分配来源。
- 所有采购入库单号都由 `backend/src/utils/invoice-number.js` 生成；不要在页面或其他路由自行拼接 `PO` 单号。

## 部署和验证

生产数据库必须已存在 `invoice_sequences`。当前销售单号生成也依赖此表；数据库结构由 `backend/scripts/migrate-schema.js` 显式管理。若表不存在，应先备份并按[数据库迁移与测试说明](../../backend/database-testing.md)确认目标库和迁移预览，再通过受控维护流程执行迁移，不能让 API 请求补建表。

生产应用进程即使配置了 `SCHEMA_MIGRATION_MODE=true` 也不能执行 DDL；只有 `backend/scripts/migrate-*.js` 入口结合该开关才允许使用受控 schema helper。此变量不得配置在常规 `.env.production` 应用环境中。

自动化验证：

- `npm --prefix backend test`
- 独立测试库可用时，按[后端数据库回归测试](../../backend/database-testing.md)运行 `npm --prefix backend run test:db`。

当前单元与契约测试覆盖门店范围 SQL、序列表锁、事务提交/回滚和模拟并发号码分配；它们不能替代真实 MySQL 多连接并发验收。

## 相关入口

- [库存专题索引](INDEX.md)
- [数据库资料索引](../../database/INDEX.md)
- [全局技术债务进度](../../development/TECHNICAL_DEBT_PROGRESS.md)
