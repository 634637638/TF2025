# 销售与调货事务标准

本文说明销售、批发、划拨等出库流程中发票序号初始化和数据库事务的约束，避免序列表建表语句破坏业务事务。

## 规则

- `invoice_sequences` 只允许在业务事务开始前通过 `ensureInvoiceSequenceTable` 完成初始化。
- MySQL 的 `CREATE TABLE` 可能隐式提交当前事务并清除 `SAVEPOINT`；禁止在销售、批发或划拨事务内部首次初始化序列表。
- 销售（单台和批量）、批发、划拨以及租赁买断使用发票号时，必须先完成序列表预检，再调用 `beginTransaction()`。
- 批发和划拨按设备使用保存点；单台失败应记录失败设备并继续处理，不能因为回滚保存点失败而把请求升级为 500。
- 综合查询快速出库使用独立的 `POST /inventory/quick-sale` 事务，不生成发票序号、也不使用批发/划拨保存点；失败时统一回滚并释放连接。
- 统计查询必须复用销售库存筛选条件所需的品牌、型号、颜色和内存关联，不能只查询 `phones` 表却引用 `b`、`m`、`co` 或 `mem` 别名。

## 当前实现

- `backend/src/utils/invoice-number.js` 暴露 `ensureInvoiceSequenceTable` 作为统一预检入口。
- `backend/src/routes/sales.js` 在销售事务前预检，统计接口补齐参考资料关联。
- `backend/src/services/transfer.service.js` 在批发、划拨事务前预检。
- `backend/src/routes/rentals.js` 在租赁买断事务前预检。
- `backend/src/routes/inventory.js` 的快速出库保持独立事务回滚，不属于弃用接口。

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
