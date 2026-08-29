# SalesView 拆分进度

更新时间：2026-08-27

## 目标与边界

`SalesView.vue` 的拆分只调整代码归属，不改变路由、权限、API、缓存、表单状态、销售提交和弹窗行为。页面专属 Vue 区块统一放在 `frontend/src/views/sales/page/`；纯函数、类型和组合式函数放在 `frontend/src/views/sales/`；页面专属样式放在 `frontend/src/views/sales/styles/`。

## 当前进度

| 区块 | 状态 | 位置 | 说明 |
| --- | --- | --- | --- |
| 页头操作 | 已完成 | `page/SalesPageHeader.vue` | 保留批量模式、导出、刷新事件 |
| 统计卡片 | 已完成 | `page/SalesStatsCards.vue` | 保留原 DOM 类名和权限控制 |
| 搜索筛选 | 已完成 | `page/SalesSearchFilters.vue` | 保留字段权限、基础数据、品牌联动和搜索事件 |
| 视图与操作工具栏 | 已完成 | `page/SalesViewControls.vue` | 保留调货/划拨权限、视图切换、汇总截图和移动端布局 |
| 图文网格视图 | 已完成 | `page/SalesGridView.vue`、`styles/sales-grid-view.scss` | 保留加载与空状态、字段权限、设备图片、移动端布局及销售/编辑/删除事件 |
| 设备表格视图 | 已完成 | `page/SalesTableView.vue`、`styles/sales-table-view.scss` | 保留自适应列宽、字段权限、状态、全选/单选及销售/编辑/删除事件 |
| 库存汇总视图 | 已完成 | `page/SalesSummaryView.vue`、`styles/sales-summary-view.scss` | 保留自适应列宽、汇总徽章、双击明细及截图 DOM 引用 |
| 库存明细弹窗 | 已完成 | `page/SalesInventoryDetailDialog.vue`、`styles/sales-inventory-detail-dialog.scss` | 保留字段权限、价格权限、汇总卡片、最长在库高亮、动态列宽和响应式布局 |
| 编辑设备弹窗 | 已完成 | `page/SalesEditPhoneDialog.vue`、`styles/sales-edit-phone-dialog.scss` | 父页面继续管理表单状态、权限、IMEI/SN 清洗、品牌型号加载和保存 API，子组件只负责界面与事件转发 |
| 销售弹窗设备信息区 | 已完成 | `page/SalesDeviceInfoPanel.vue`、`styles/sales-device-info-panel.scss` | 保留单台/批量设备展示、字段与价格权限、图片占位、利润汇总、手机端 768px 继承和暗色模式 |
| 销售弹窗客户与销售表单 | 已完成 | `page/SalesCheckoutForm.vue`、`styles/sales-checkout-form.scss` | 保留客户搜索与创建入口、姓名锁定和 PC/iOS 解锁聚焦、字段与价格权限、支付方式、利润展示及手机端双列表单；API、支付规则和提交事务仍由父页面管理 |
| 批量销售表单 | 已完成 | `page/SalesBatchForm.vue`、`styles/sales-batch-form.scss` | 保留批量客户搜索/创建入口、姓名锁定和 PC/iOS 聚焦、门店与销售员、支付信息、利润汇总、提交状态及手机端单列和底部操作布局 |
| 库存/销售纯函数 | 已完成 | `inventory-formatters.ts`、`sales-sort.ts`、`sales-phone-helpers.ts` | 无副作用辅助逻辑 |
| 字段权限映射 | 已完成 | `sales-field-permissions.ts` | 统一销售字段键 |
| 基础选项加载 | 已完成 | `useSalesBaseOptions.ts` | 门店、供应商、品牌、型号、颜色、内存、操作员 |
| 库存汇总与明细数据流程 | 已完成 | `useSalesInventorySummary.ts` | 统一汇总/明细接口、筛选参数、排序、300ms 防抖、弹窗状态和卸载清理；截图 DOM 与下载仍由父页面管理 |
| 客户搜索与资料维护 | 已完成 | `useSalesCustomers.ts` | 保留单台/批量搜索防抖、创建与更新 payload、选择回填、PC 双击、iOS 双触提示和卸载清理；预定关联继续复用返回的客户状态 |
| 销售事务外围流程 | 已完成 | `useSalesCheckout.ts` | 保留弹窗、预定预填、单台/批量校验与 `/sales/phone` payload、批量选择、默认销售员和库存刷新；修正批量选择清空后“今日出库”累计为 0 的顺序问题 |
| 主列表与页面编排 | 已完成 | `SalesView.vue` | 主文件保留路由联动、列表加载、编辑/删除、支付备注规则、监听器和页面生命周期 |

## 验证记录

- 初始主文件：10,244 行。
- 当前主文件：1,894 行（2026-08-27 `wc -l` 结果），较初始减少 8,350 行（约 81.5%）。
- `vue-tsc --noEmit`：通过。
- 销售拆分文件 ESLint 严格检查：通过。
- 完整 `check:standards`（类型、权限、字段、运行时、UI、样式、表格等）：通过。
- Vite 生产构建：通过，共转换 3,113 个模块，`SalesView` 页面产物正常生成。
- 每继续拆分一个区块，必须重新执行类型检查、严格 Lint、统一审计和生产构建。
- 内存筛选回归：内存记录按规范字段 `size` 解析，统一使用 `extractResponseData`，过滤空值并去重；修复销售检索点击内存显示“无数据”。

## 后续拆分顺序

`SalesView.vue` 本轮拆分已完成，主文件仅保留页面编排和紧邻页面生命周期的逻辑。后续大型页面治理转入 `SalaryView.vue`，继续执行“一页完成、单独验证、登记后再进入下一页”的顺序。
