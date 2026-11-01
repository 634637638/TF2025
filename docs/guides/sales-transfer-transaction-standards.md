# 销售与调货事务标准

本文说明销售、批发、划拨等出库流程中发票序号初始化和数据库事务的约束，避免序列表建表语句破坏业务事务。

## 规则

- `invoice_sequences` 只允许在业务事务开始前通过 `ensureInvoiceSequenceTable` 完成初始化。
- MySQL 的 `CREATE TABLE` 可能隐式提交当前事务并清除 `SAVEPOINT`；禁止在销售、批发或划拨事务内部首次初始化序列表。
- 销售（单台和批量）、批发、划拨以及租赁买断使用发票号时，必须先完成序列表预检，再调用 `beginTransaction()`。
- 批发和划拨按设备使用保存点；单台失败应记录失败设备并继续处理，不能因为回滚保存点失败而把请求升级为 500。
- 综合查询快速出库使用独立的 `POST /inventory/quick-sale` 事务，按交易类型生成统一单据号；失败时统一回滚并释放连接。
- 统计查询必须复用销售库存筛选条件所需的品牌、型号、颜色和内存关联，不能只查询 `phones` 表却引用 `b`、`m`、`co` 或 `mem` 别名。

### 单据号类型后缀

单据号格式为 `YYYYMMDD + 四位序号 + 类型后缀`。调货和批发属于同一种同行交易类型，必须共用 `PF` 后缀；供应商划拨仍使用 `HB`，普通销售使用 `XS`。

| 业务类型 | 后缀 | 说明 |
| --- | --- | --- |
| `retail` | `XS` | 普通销售 |
| `wholesale` | `PF` | 批发 |
| `peer_transfer` | `PF` | 调货，与批发共用序列空间 |
| `supplier_proxy` | `HB` | 供应商划拨 |

公共工具 `backend/src/utils/invoice-number.js` 是唯一的新单号规则入口。历史已经生成的 `DH` 调货单号不改写，解析工具继续识别 `DH`，但任何新建或补生成单号都不得再使用 `DH`。

## 当前实现

- `backend/src/utils/invoice-number.js` 暴露 `ensureInvoiceSequenceTable` 作为统一预检入口。
- `backend/src/routes/sales.js` 在销售事务前预检，统计接口补齐参考资料关联。
- `backend/src/services/transfer.service.js` 在批发、划拨事务前预检。
- `backend/src/routes/rentals.js` 在租赁买断事务前预检。
- `backend/src/routes/inventory.js` 的快速出库保持独立事务回滚，不属于弃用接口。
- 调货和批发的新单号均由公共工具生成 `PF`；手机编辑接口的历史补生成分支也遵循该规则。

## 交易类型转换

综合查询、库存编辑提交 `status` 为 `sold`、`peer_transfer` 或 `supplier_proxy` 时，设备状态和对应的 `sales` 记录必须在同一事务内联动更新：

- `sold` 对应销售，单据后缀为 `XS`；`peer_transfer` 对应批发/调货，后缀为 `PF`；`supplier_proxy` 对应划拨，后缀为 `HB`。
- 转换后按目标类型重新生成单据号，销售时间只决定单号日期，不能直接沿用错误后缀的旧号。
- 转为划拨时交易记录的销售金额和成本统一为 `0`，并清理设备的批发日期和批发金额；设备原始入库成本保留，便于之后转换回销售或批发；转为销售或批发时必须有大于 `0` 的交易价格。
- 转换使用 `FOR UPDATE` 锁定设备，并在失败时回滚设备、销售记录和单号序列变更。
- 执行类型转换时，除原页面编辑权限外，还必须具备目标交易权限：销售为 `sales:sell` 或 `inventory:sell`，批发/调货为 `sales:wholesale`，划拨为 `sales:proxy-transfer`。快速出库同样按所选类型校验权限。
- 已存在成功收款（`payment_status=success/paid`）的设备允许转换为批发或划拨；转换保留原收款流水，不删除、不伪造、不自动冲正财务历史。后续退款或冲正仍按原收款流水处理。

快速出库也支持上述三种类型。销售要求支付方式；批发/调货使用批发价格；划拨金额归零并生成 `HB` 单据，不伪造销售收款。快速出库销售会以新建的 `sales.id` 写入成功收款流水，批发/调货和划拨不自动写销售收款流水。

## 验证

```bash
cd backend
node --test test/sales-filters-contract.check.js test/transaction-contract.check.js
node --check src/routes/sales.js
node --check src/services/transfer.service.js
node --check src/routes/rentals.js
```

线上验证应分别执行：销售单台、批量销售、批发多台、划拨多台，并检查接口返回 2xx、设备状态、销售记录、发票号和失败设备明细。若仍出现 500，优先查看 `TransferController`、销售路由及数据库错误码，不要按弃用接口处理。

## 相关资料

- [API 调用标准](api-standards.md)
- [兼容接口与弃用路由台账](compatibility-route-retirement-ledger.md)
