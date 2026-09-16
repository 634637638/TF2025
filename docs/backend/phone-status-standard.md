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

## 预订与销售

- 匹配预订：保留 `status = 'in_stock'`，设置 `is_preordered = 1`，表示设备仍在库但已被预留。
- 普通销售：不能销售 `is_preordered = 1` 的设备。
- 预定交付：销售页、库存页和预定页都可以发起出库；进入销售表单后必须同时匹配预定单、预定客户和匹配设备，客户信息不可改为其他客户。
- 销售成功：设置 `status = 'sold'` 并清除 `is_preordered`，同时完成预定单。

## 页面操作口径

- 销售管理和库存管理展示所有非完成交易设备，排除 `sold`、`peer_transfer`、`supplier_proxy`。
- `in_stock` 设备可以普通销售；预订设备可以出库，但只能走预定客户交付流程。
- 维修、租赁、外借、丢失、损坏等设备保留在列表中用于检索和台账查看，不显示销售出库操作。
- 预订设备仍可显示查看、编辑、删除按钮；删除由后端保护，必须先取消或重新处理关联预定单，避免删除后留下悬空预定。
- 划拨、调货和零售/批发销售都属于完成交易，不能再出现在销售出库和库存候选列表。

维修、租赁、外借等状态变更也应调用同一有效状态规则。它们的业务接口负责改变实体状态，展示、筛选和统计不要在页面中单独维护另一套判断。
