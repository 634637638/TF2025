# 设备状态统一规范

## 有效状态

设备对外展示和筛选使用“有效状态”，不要直接把 `phones.status` 和业务标记拼接在页面中：

| 数据状态 | 业务标记 | 有效状态 |
| --- | --- | --- |
| `sold` | 任意 | `sold` |
| `reserved` | 任意 | `reserved` |
| `in_stock` | `is_preordered = 1` | `reserved` |
| 其他状态 | 任意 | 原状态 |

已售优先于预订标记，避免历史数据残留 `is_preordered` 时仍显示为预订。

## 代码入口

- 后端：`backend/src/utils/phone-status.js`
- 前端：`frontend/src/constants/phoneStatuses.ts`

后端查询使用 `getEffectivePhoneStatusSql('p')`，Node.js 数据处理使用
`getEffectivePhoneStatus(status, isPreordered)`；前端展示使用同名函数或对应的
`getEffectivePhoneStatusLabel`、`getEffectivePhoneStatusClass`。

## 规范存储与兼容输入

- `phones.status` 的可售状态只存 `in_stock`；`available` 是历史/外部来源别名，不是新的业务状态。
- 状态名称、搜索词及外部同步值统一经 `normalizePhoneStatus` 转为规范值；状态搜索通过 `isPhoneStatusAlias` 识别，路由不得各自维护映射表。
- 有效状态 SQL 由 `getEffectivePhoneStatusSql` 统一生成，兼容读取历史 `available`，并优先保留 `is_preordered = 1` 对应的 `reserved` 语义。
- 新写入和跨库同步必须归一化后再持久化，包括设备编辑接口；用户界面仍显示“可售”，不展示“可用”作为一个独立状态。前后端共享状态工具都将 `available`（不区分大小写、忽略首尾空格）映射为 `in_stock`。
- 2026-09-28 对当前本地配置的远程数据库执行只读状态分布检查：`phones.status` 中 `available`（忽略大小写与首尾空格）为 0 条，当前值均为规范业务状态；`phones` 表不存在 `sale_status` 列，因此未执行数据库更新。
- 若未来数据库审计发现旧值，应先备份，再仅将 `LOWER(TRIM(status)) = 'available'` 的设备状态更新为 `in_stock`，核对变更数后继续部署；禁止全表替换状态字段。

## 预订与销售

- 匹配预订：保留 `status = 'in_stock'`，设置 `is_preordered = 1`，表示设备仍在库但已被预留。
- 普通销售：不能销售 `is_preordered = 1` 的设备。
- 预定交付：销售页、库存页和预定页都可以发起出库；进入销售表单后必须同时匹配预定单、预定客户和匹配设备，客户信息不可改为其他客户。
- 销售成功：设置 `status = 'sold'` 并清除 `is_preordered`，同时完成预定单。

## 租赁与买断

- 租赁状态由租赁合同流程维护，不允许库存、销售或综合查询的通用设备编辑直接设置或解除 `rented`。
- 按天租赁创建合同后将设备状态设为 `rented`；归还操作由租赁管理完成，并在归还成功后恢复 `in_stock`。
- 到期买断创建合同时必须生成零售销售记录，并将设备状态设为 `sold`，不能显示为 `rented`。
- 通用编辑表单保留已有租赁设备的状态展示，但不允许选择租赁状态；后端也必须校验，不能只依赖前端禁用选项。

## 页面操作口径

- 销售管理和库存管理展示所有非完成交易设备，排除 `sold`、`peer_transfer`、`supplier_proxy`。
- `in_stock` 设备可以普通销售；预订设备可以出库，但只能走预定客户交付流程。
- 维修、租赁、外借、丢失、损坏等设备保留在列表中用于检索和台账查看，不显示销售出库操作。
- 预订设备仍可显示查看、编辑、删除按钮；删除由后端保护，必须先取消或重新处理关联预定单，避免删除后留下悬空预定。
- 划拨、调货和零售/批发销售都属于完成交易，不能再出现在销售出库和库存候选列表。

维修、租赁、外借等状态变更也应调用同一有效状态规则。它们的业务接口负责改变实体状态，展示、筛选和统计不要在页面中单独维护另一套判断。
