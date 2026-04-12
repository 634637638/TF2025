# 前端类型统一进展

## 更新日期
2026-04-12

## 背景

本轮优化主要针对前端页面、弹窗、通用组件中分散定义的 `any`、重复 `Props/Emits`、重复表格类型和松散接口响应结构进行收口，目标是让类型入口更集中、组件复用更稳定、后续页面改造成本更低。

## 本轮完成项

### 1. 公共类型统一

- 已在 `frontend/src/types/component.ts` 统一沉淀公共弹窗、表格、事件类型。
- 已补充统一 `TableAction` 类型，并增强 `TableColumn`，支持：
  - `key`
  - `showOverflowTooltip`
  - `sortable: 'custom'`
- 已在 `frontend/src/types/index.ts` 统一转导出，后续页面优先从 `@/types` 导入。

### 2. 通用表格组件收口

已完成以下组件统一：

- `frontend/src/components/MobileTable.vue`
- `frontend/src/components/PaginatedTable.vue`

处理内容：

- 去除组件内部重复定义的表格类型。
- 接入统一 `TableColumn` / `TableAction`。
- 收口 `ref`、`selection`、`rowKey`、排序事件、空状态插槽、`defineExpose` 等类型。
- 统一移动端断点口径，避免继续使用分散硬编码。

### 3. 业务弹窗与页面去 any

已完成显式 `any` 收口的主要文件：

- `frontend/src/components/query/QuickSaleModal.vue`
- `frontend/src/components/WholesaleModal.vue`
- `frontend/src/components/PublishToH5Modal.vue`
- `frontend/src/views/attendance/AttendanceView.vue`
- `frontend/src/views/customers/CustomersView.vue`
- `frontend/src/components/query/QueryEditModal.vue`
- `frontend/src/components/query/SalesReceipt.vue`
- `frontend/src/views/payments/SupplierPhonePaymentsView.vue`

处理重点：

- 客户对象、搜索结果、手机详情、批发/划拨载荷、上传文件、媒体对象、考勤行、休假余额、客户消费记录等业务对象已补成本地明确类型。
- 供应商打款页面已补齐店铺、统计、汇总、手机行、批次详情、列表参数、分页响应等最小业务类型。
- 错误处理从 `catch (error: any)` 改为 `unknown` 收口。
- 请求参数和响应数据不再默认走 `Record<string, any>`。

### 4. 其它通用组件去 any

已完成：

- `frontend/src/components/DraggableList.vue`
- `frontend/src/components/DraggableRow.vue`
- `frontend/src/components/AccessoryDetailsModal.vue`
- `frontend/src/components/MemorySelector.vue`
- `frontend/src/components/InventoryResultDialog.vue`
- `frontend/src/components/PendingApprovals.vue`
- `frontend/src/components/FieldPermissionTable.vue`
- `frontend/src/services/fieldPermissionService.ts`
- `frontend/src/components/OptimizedScanner.vue`
- `frontend/src/components/ProfessionalScanner.vue`
- `frontend/src/components/MobileForm.vue`

处理结果：

- 字段权限表格、搜索表单、表单字段配置已从服务层开始统一返回结构。
- 拖拽、库存结果、待审批提醒、配件详情、内存选择等组件不再依赖显式 `any`。
- 扫码组件已补齐扫码结果、摄像头能力、闪光灯/对焦约束、错误对象等最小类型。
- 移动表单组件已收口表单值、上传回调、上传文件列表和字段选项类型，并修正上传事件参数透传。

## 本轮验证

每轮改动后均执行：

```bash
npx tsc -p frontend/tsconfig.json --noEmit --pretty false
```

当前结论：

- 前端 TypeScript 编译通过
- 本文档列出的已处理文件中，显式 `any` 已完成收口

## 后续建议

下一轮优先继续扫以下高收益文件：

- `frontend/src/views/inventory/InventoryView.vue`
- `frontend/src/views/query/QueryView.vue`
- `frontend/src/components/MobileTable.vue` 相关使用方

后续统一原则：

- 优先从 `@/types` 导入公共类型
- 页面内仅保留业务强相关的局部类型
- 新增接口响应结构时，优先补到统一类型或最小业务类型，不直接回退 `any`
- 收口类型时同步清理冗余变量、重复逻辑、未使用导入
