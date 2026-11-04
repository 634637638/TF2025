# 前端类型统一进展

## 更新日期
2026-11-04

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
- `frontend/src/views/analytics/page/ProfitAnalytics.vue`
- `frontend/src/views/query/QueryView.vue`（首批收口）
- `frontend/src/views/inventory/InventoryView.vue`
- `frontend/src/views/system/phone-warning-config/PhoneWarningConfigView.vue`

处理重点：

- 客户对象、搜索结果、手机详情、批发/划拨载荷、上传文件、媒体对象、考勤行、休假余额、客户消费记录等业务对象已补成本地明确类型。
- 供应商打款页面已补齐店铺、统计、汇总、手机行、批次详情、列表参数、分页响应等最小业务类型。
- 利润分析页的门店利润、员工业绩导出和 ECharts 提示回调已复用公共类型，移除 11 处显式 `any`；ECharts 配置通过 `EChartsOption`、`TopLevelFormatterParams` 和 `CallbackDataParams` 统一约束。
- 综合查询页的列配置、基础选项排序、门店/供应商映射、备注和退库载荷已复用 `QueryItem`、`ReferenceRecord` 和列类型，移除 22 处显式 `any`；原始分组响应转换仍保留独立收口任务。
- 库存页统一复用 `InventoryItem`、库存参考选项和请求错误解析，编辑设备、型号远程检索、供应商/门店/操作员选项及删除/上架异常处理已移除显式 `any`。
- 电话预警配置页新增唯一的配置行、组合草稿和型号分组类型，品牌、型号、颜色、内存复用全局基础类型；分组、批量编辑、开关、删除和错误处理已移除显式 `any`。
- 国补模块新增唯一的 `frontend/src/types/subsidy.ts` 领域类型入口，统一设备搜索结果、设备详情、国补列表记录、统计响应、编辑表单、办理人信息和照片上传响应。
- 国补主页面及申请、编辑、详情、列表、照片管理弹窗已完成显式 `any` 收口；统一使用 `NationalSubsidyRecord` 等类型，上传回调使用 `UploadRequestOptions`，异常统一按 `unknown` 处理。
- 数据检查页新增唯一的 `frontend/src/types/data-check.ts` 类型入口，统一检查项、全量记录、重复组、统计响应和清理结果；动态检查方法改为键控方法表，移除页面 40 处显式 `any`。
- 预订单表单弹窗新增 `PreorderFormDraft`，客户搜索、门店/基础选项、表单校验器和提交异常均复用统一类型，移除页面 22 处显式 `any`。
- 销售分析页统一销售条件、预测组合、时间序列、ECharts tooltip 和门店选项类型，移除 22 处显式 `any`。
- H5 商品列表复用商城 `Product`、`AggregatedProduct`、`ShopConfig` 和基础选项类型，移除 24 处显式 `any`。
- H5 首页复用推荐区商品、Banner、商城配置、基础选项、模板库存和腾讯地图 SDK 类型，移除 33 处显式 `any`。
- 工资页 `SalaryView.vue` 复用工资模板、工资记录、发放记录、员工行、考勤统计和销售明细类型，补齐保存载荷与状态窄化，移除 57 处显式 `any`。
- 价目表页 `PriceListView.vue` 新增唯一的 `frontend/src/types/price-list.ts` 领域类型入口，统一价格行、历史、趋势、同步配置、库存和参考选项，移除 50 处显式 `any`。
- 划拨/批发分析页 `TransferAnalytics.vue` 补齐查询参数、趋势、排行、门店分布、操作记录和 ECharts 回调类型，移除 17 处显式 `any`。
- 权限管理页 `PermissionsView.vue` 统一角色、用户、字段权限、模块和门店绑定类型，移除 16 处显式 `any`，同时修正角色数组到显示文本的响应适配。
- H5 结算与订单链路完成类型收口：`Checkout.vue` 清理 18 处、`OrderQuery.vue` 清理 14 处、`MyOrders.vue` 清理 7 处、`ProductDetail.vue` 清理 17 处；订单公共响应、结算商品、店铺库存、地址和商品详情均复用明确类型。
- H5 聚合商品详情页 `AggregatedProductDetail.vue` 清理 15 处显式 `any`，统一商城配置、模板价格选项、聚合商品、库存分布和图片类型。
- 菜单管理页 `MenuManagementView.vue` 已统一菜单树、模块、导出参数、响应解析和可见行类型，清理页面显式 `any`。
- 员工管理页 `EmployeesView.vue` 已复用 `Employee`、`EmployeeForm`、`Role`、`QueryParams` 和统一错误解析，清理表格引用、请求参数与异常类型。
- 型号、品牌、备份页 `ModelsView.vue`、`BrandsView.vue`、`BackupView.vue` 已统一基础数据、备份记录、查询参数和错误处理。
- 颜色、内存、退库维护、系统设置、销售价展示、预订单和分析总览页已完成本轮类型边界收口；密码记录、操作员选项、销售价展示行、分析门店/供应商列表均使用明确类型。
- H5 用户中心、订单详情、数据导入、公开报价、同步日志和销售页的上轮遗留编译问题已修复，订单 ID、导入历史 ID、站点配置、错误响应和同步详情均完成窄化。
- 错误处理从 `catch (error: any)` 改为 `unknown` 收口。
- 请求参数和响应数据不再默认走 `Record<string, any>`。
- 最后一批视图债务已完成收口：H5 布局与订单成功页统一使用 `ShopConfig`，智能商品详情补齐 API 边界类型，登录和维修页统一使用请求错误解析，指南表单改为明确草稿类型，营销词库响应按 `unknown` 窄化，权限页 `provide/inject` 改为完整上下文契约。
- `frontend/src/views` 显式 `any` 已清零；权限日志详情保留 `Record<string, unknown>` 并在读取嵌套结构前完成类型守卫，不将普通注释文本计入类型债务。

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

### 5. 全前端类型债务与重复导出清零

- 16 个非视图文件中的最后 28 处显式 `any` 已完成收口，全前端与视图层均为 `any=0`。
- Axios 请求拦截器使用 `InternalAxiosRequestConfig & RequestConfig` 描述第三方边界，不再以 `any` 绕过配置扩展。
- 库存预警响应统一到 `frontend/src/types/warnings.ts`，菜单项统一到 `frontend/src/types/menu.ts`，主题与通知记录复用 `@/types` 权威定义。
- 客户姓名原生输入框解析统一到 `frontend/src/utils/native-input.ts`，移除多个组件中的重复 DOM 类型断言。
- 26 组重复导出已全部处理：字段一致的类型改为单一来源转导出，语义不同的类型使用 `ScannerDeviceInfo`、`AnalyticsExportConfig`、`InventoryExportConfig`、`PermissionRole`、`PublicShopBanner` 等领域名称区分。
- TypeScript 债务基线已收紧为 `totalAny=0`、`viewsAny=0`、`duplicateExports={}`，后续任何显式 `any` 或重复导出都会触发门禁失败。

## 本轮验证

每轮改动后均执行：

```bash
npm --prefix frontend run type-check
npm --prefix frontend run check:typescript-debt
npm run lint:strict
git diff --check
```

当前结论：

- 前端 TypeScript 编译通过
- 所有视图文件显式 `any` 已完成收口，`views any=0`。
- 2026-11-04 最新类型债务门禁统计：全前端 `any=0`，`views any=0`，重复导出名称 `0` 组。
- 相对本轮继续完善前的 `any=52`、`views any=24`，累计减少 52 处显式 `any`；相对重复导出基线，累计消除 26 组同名导出。
- 债务基线已同步收紧为全量零容忍，后续新增显式 `any` 或重复导出将直接触发门禁失败。
- 当前 `vue-tsc`、严格 lint、债务门禁和 diff 检查均通过。

## 后续建议

后续重点转为防回退与类型精度提升：

- 新增业务模型必须先确认现有权威入口，不得重新创建同名导出。
- 第三方 SDK 边界继续使用官方类型、`unknown` 和类型守卫，不得恢复显式 `any`。
- 逐步评估开启 `noImplicitAny`、`strictNullChecks` 和 `strictFunctionTypes` 的剩余真实错误，不使用大面积断言掩盖问题。

后续统一原则：

- 优先从 `@/types` 导入公共类型
- 页面内仅保留业务强相关的局部类型
- 新增接口响应结构时，优先补到统一类型或最小业务类型，不直接回退 `any`
- 收口类型时同步清理冗余变量、重复逻辑、未使用导入
