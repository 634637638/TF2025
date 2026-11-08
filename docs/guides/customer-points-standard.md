# 客户销售积分统一规范

本文规定客户积分的唯一计算、入账、冲减和迁移边界。适用于正常销售、批量销售、快速出库、综合查询交易转换与编辑、退库、设备删除、租赁买断、批发、划拨和历史数据导入。

最后核实日期：2026-11-06。

## 积分规则

- 积分基数固定为每消费 100 元；全新和二手可多选参与，并分别设置每 100 元累计 1 至 100 积分。
- 每条 `sales` 记录独立计算并向下取整。批量销售中的每台设备都有独立销售记录和积分凭据，禁止先汇总整单金额再取整。
- 只有零售类型 `retail`、`sale`、`normal`、`batch`、`batch_item` 参与积分。
- `wholesale`、`peer_transfer`、`supplier_proxy` 以及其他非零售类型固定为 0 积分。
- 规则关闭、设备类型未参与、客户为空或销售金额不足 100 元时，本条销售积分为 0。

设置接口为 `GET /api/customers/points-config` 和 `PUT /api/customers/points-config`。读取要求 `customers:view`，修改要求 `customers:manage`；权限仍按“用户 → 角色 → 权限”统一校验，前端按钮隐藏不能代替后端鉴权。

## 唯一公共实现

`backend/src/services/customer-points.service.js` 是销售积分的唯一业务入口：

- `calculateCustomerPointsForSaleRecord` 计算一条销售记录的目标积分。
- `reconcileCustomerPointsForSale` 在调用方现有事务内完成首次累计、差额调整、客户转移和非零售冲减。
- `reverseCustomerPointsForSale` 在退库或删除销售记录前按该销售的实际凭据冲减。

业务路由、控制器、仓储和导入服务不得复制积分公式，不得直接根据当前规则反算历史销售，也不得自行提交或回滚积分事务。公共服务只接受调用方已有的数据库事务连接，积分、销售记录、设备状态和客户关联必须一起提交或一起回滚。

## 销售积分凭据

`sales` 表使用以下字段保存逐单事实：

| 字段 | 定义 | 用途 |
| --- | --- | --- |
| `points_awarded` | `INT UNSIGNED NOT NULL DEFAULT 0` | 该销售记录实际发放的积分，是后续冲减和差额调整的唯一数值凭据 |
| `points_accounted_at` | `DATETIME NULL` | 该销售首次纳入统一积分核算的时间；用于区分新核算记录和历史无凭据记录 |

新增销售必须在同一事务内调用 `reconcileCustomerPointsForSale` 并设置初始化标记，即使批发、划拨或规则关闭导致积分为 0，也要写入核算时间。禁止仅依赖 `customers.points` 推断某条销售曾发多少积分。

## 必须接入的业务入口

| 场景 | 当前入口 | 必须行为 |
| --- | --- | --- |
| 正常单台、批量销售 | `backend/src/routes/sales.js` | 每条销售记录独立初始化积分凭据 |
| 快速出库 | `backend/src/controllers/inventory.controller.js` | 零售累计；批发、划拨登记 0 积分凭据 |
| 综合查询编辑与类型转换 | `backend/src/routes/phones.js` | 售价、全新/二手、客户或交易类型变化时同步差额 |
| 综合查询退库、设备删除 | `backend/src/services/query-mutation.service.js` | 同一事务连接内，删除销售记录前按 `points_awarded` 冲减 |
| 租赁买断及买断价格编辑 | `backend/src/routes/rentals.js` | 按零售销售初始化，改价时更新差额 |
| 批发、供应商划拨 | `backend/src/services/transfer.service.js` | 强制登记 0 积分凭据 |
| 历史数据导入 | `backend/src/services/data-import.service.js` | 明确禁止重放积分；已有可核算销售转为 0 时先冲减 |

新增任何会创建、更新或删除 `sales` 的入口时，必须同步加入本表、行为测试和入口审计。只更新 `phones` 状态而不处理销售积分属于事务不完整。

## 变更行为

- 售价或全新/二手变化：用目标积分减去 `points_awarded`，只更新差额。
- 客户变化：从旧客户扣除本单 `points_awarded`，再给新客户增加目标积分。
- 零售转批发或划拨：目标积分为 0，冲减本单原积分。
- 批发或划拨转零售：按当前生效规则计算并增加目标积分。
- 重复保存同一业务状态：目标积分与凭据相同，不得重复累计。
- 退库或物理删除销售：删除前先冲减；冲减失败时整个业务事务回滚。
- 客户积分不足以完整冲减时最低归零，不能产生负积分；销售凭据仍按本次事务更新，异常情况应通过业务日志和人工核对处理。

## 历史销售与迁移

迁移入口为：

```bash
npm --prefix backend run migrate:customer-sale-points
npm --prefix backend run migrate:customer-sale-points -- --apply
```

第一条命令只预览；第二条命令才执行 DDL。生产应用进程不得自动建列。未得到目标数据库、备份和本次执行授权前，只能运行预览或静态检查，不能执行 `--apply`。

执行 `--apply` 并完成字段校验后，必须重启后端服务。结构检查结果会在应用进程内缓存；未重启的旧进程可能继续使用迁移前的“字段不存在”结果，导致销售或快速出库事务被拒绝。重启后应先检查健康接口，再进行一笔受控业务验收。

迁移不会按当前规则反算历史销售，也不会改写历史客户积分。原因是历史规则可能已经变化，且迁移前没有逐单凭据；盲目回填可能重复增加或错误扣除。历史行的 `points_accounted_at` 保持空值，首次经编辑、转换、导入、退库或删除触达时只建立 0 基线，不自动改变客户既有积分。需要准确清理历史积分时，必须根据可验证的原始单据和当时规则另行人工审计。

回滚命令仅在所有 `points_awarded` 都为 0 时允许删除字段：

```bash
npm --prefix backend run migrate:customer-sale-points -- --rollback
```

已有非零凭据时脚本必须拒绝回滚，避免丢失冲减依据。

## 测试门禁

至少覆盖：

- 单台、批量和快速出库零售积分。
- 全新、二手分别计分及多选配置。
- 批发、调货、划拨固定 0 积分。
- 售价和成色变化只调整差额。
- 客户变化时旧客户扣除、新客户增加。
- 零售与非零售双向转换。
- 重复保存不重复累计。
- 退库、删除及事务失败回滚。
- 历史无凭据记录不按当前规则反算。
- 所有销售写入、转换和删除入口引用公共积分服务。

专项检查使用 `node --test backend/test/customer-points.check.js`。数据库结构验证必须使用已迁移的独立测试库；业务库测试遵循[后端数据库回归测试](../backend/database-testing.md)，跳过数据库测试不能写成数据库功能已通过。

## 相关文档

- [销售与调货事务标准](sales-transfer-transaction-standards.md)
- [客户表结构说明](../database/customers-table-schema.md)
- [数据库资料索引](../database/INDEX.md)
- [权限文档索引](../permissions/INDEX.md)
- [全局测试与清理规范](TESTING_STANDARDS.md)
