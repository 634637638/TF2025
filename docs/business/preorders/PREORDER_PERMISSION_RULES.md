# 新品预定权限与库存联动规则

## 权限定义

| 权限 | 页面操作 | 后端接口 | 业务结果 |
| --- | --- | --- | --- |
| `preorders_preordersview:match` | 匹配 | `GET /api/preorders/:id/matchable-phones`<br>`PUT /api/preorders/:id/match` | 为待匹配预定单选择库存设备，设备标记为已预定 |
| `preorders_preordersview:deliver` | 交付 | `PUT /api/preorders/:id/deliver`<br>携带 `preorder_id` 的 `POST /api/sales/phone` | 通过销售出库交付已匹配设备，预定单变为已交付 |
| `preorders_preordersview:cancel` | 取消 | `PUT /api/preorders/:id/cancel` | 取消预定单；已匹配设备释放 `is_preordered` 占用 |

`edit` 只用于编辑待匹配预定单和恢复已取消预定单，`delete` 只用于删除允许删除的历史记录，不得代替 `match`、`deliver` 或 `cancel`。

## 匹配规则

1. 只有 `pending` 状态的预定单可以手动匹配。
2. 可选设备必须是 `status = in_stock` 且 `is_preordered = 0`。
3. 设备的品牌、型号、颜色、内存、机况必须与预定单完全一致。
4. 匹配在同一数据库事务内锁定预定单和设备，同时写入 `matched_phone_id`、IMEI 和匹配时间，防止并发重复占用。
5. 新增预定时的自动库存联动属于系统流程；用户主动打开匹配列表、更换或确认设备时必须校验 `match` 权限。

## 交付规则

1. 只有 `arrived` 状态且已关联设备的预定单可以交付。
2. 交付必须通过预定单已匹配的同一台设备，不允许用其他库存设备替换出库。
3. 从预定单进入销售交付时，账号必须同时拥有 `preorders_preordersview:deliver` 和 `sales_salesview:create`。
4. 权限不足、预定状态不对或设备不一致时，后端必须拒绝请求并回滚销售事务。

## 前端接入规范

- 页面使用 `usePagePermissions('preorders')` 提供的 `canMatch`、`canDeliver`、`canCancel`。
- 操作列宽度使用 `getAdaptiveActionColumnWidth` 按当前状态和权限计算。
- 模态框使用全局 `MobileDialog`，表格使用全局 `el-table` 类名，不在页面内重复定义按钮和表格基础样式。
- 前端的 `v-if` 只负责交互展示，后端接口必须继续使用 `requirePermission` 作为最终边界。
