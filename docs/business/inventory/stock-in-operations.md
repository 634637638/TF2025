# 入库操作与安全边界

本文记录采购入库接口的门店权限、事务和入库单号规则。生产数据库状态不能仅由源码推断，部署前置条件见下方说明。

## 门店范围与写入

- 入库列表、统计、详情、创建、编辑和删除由后端按登录用户的 `store_id/store_ids` 校验；前端传入门店 ID 不能扩大授权范围。
- 编辑和删除在事务内对目标 `phones` 行执行 `SELECT ... FOR UPDATE`，校验现有门店归属后，最终 `UPDATE`/`DELETE` 仍携带授权门店条件。
- 更新记录的目标门店必须属于当前账号授权范围。删除不存在的记录返回未找到；跨门店写入返回权限错误。
- 自动匹配预订单与入库写入共用一个事务；预订单按门店与商品规格锁定，并通过 `status = 'pending'` 条件更新防止重复匹配。

## 入库单号

- 手机采购单号格式为 `PO + YYMMDD + HHmm + 4位分钟序号`，例如 `PO26112114300001`，共16位；分钟序号从 `0001` 开始。
- 序号使用 `invoice_sequences` 表中 `(北京时间YYYYMMDDHHmm, type_suffix='PO')` 唯一行锁分配，并与入库事务一起提交。失败回滚时序号更新也回滚，同一分钟内并发分配不会重复。
- 商品销售/赠送、商品采购批次和共同销售单分别使用 `PS + YYMMDD + 6位日序号`、`RK + YYMMDD + 6位日序号` 和 `SO + YYMMDD + 8位日序号`。商品单号统一由 `backend/src/utils/invoice-number.js` 生成。
- 历史单号通过 `npm --prefix backend run repair:document-numbers` 只读预览，确认数据库完整备份后使用同一命令追加 `-- --apply` 执行。脚本同步共同单明细快照中的商品单号；入库时间不能确认分钟的手机采购记录会阻止整批更新，不会按日期伪造时分。
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
