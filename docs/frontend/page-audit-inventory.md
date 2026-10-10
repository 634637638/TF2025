# 前端页面与功能单元台账

> 状态：强制登记，持续维护
> 统计日期：2026-10-07
> 统计来源：`frontend/src/router/index.ts`、`frontend/src/views/**/*.vue`、`frontend/src/components/**/*.vue`

> 导航审计记录：后台 PC 与手机入口均由 `views/system/page/SimpleAdminView.vue` 统一承载；菜单数据来自 `stores/menu.ts`，菜单点击统一派发 `menu-click`，权限预检统一由主布局执行。手机端不再将菜单分流到未渲染的底部导航；`DynamicSidebar` 已退役，`ResponsiveLayout` 仅作为通用内容布局保留。

## 1. 目的与统计口径

本台账是所有前端页面、页面内功能单元和公共组件的统一入口。后续新增页面、路由、Tab、弹窗、列表、表单或公共交互时，必须先登记，再实现；修改公共规范或跨页面功能时，必须按本台账确认受影响范围，不能只修改当前打开的页面。

统计时严格区分以下对象：

| 对象 | 统计口径 | 当前数量 |
| --- | --- | ---: |
| 懒加载路由入口 | `router/index.ts` 中的 `component: () => import(...)` | 63 |
| 实际叶子路由 | 可直接访问的页面路由，排除 3 个布局容器 | 60 |
| 页面源文件 | `frontend/src/views/**/*.vue`，包括 Tab、弹窗和页面内部单元 | 128 |
| 非路由功能单元 | 页面源文件中未被路由直接加载的 Tab、弹窗或复用单元 | 68 |
| 公共组件源文件 | `frontend/src/components/**/*.vue` | 71 |
| 涉及表格的页面源文件 | 页面中出现 Element/原生表格或公共表格入口 | 56 |
| 涉及表格的公共组件 | 公共组件中出现表格或表格封装 | 5 |
| 含按钮的页面/功能单元源文件 | `frontend/src/views/**/*.vue` 中出现 `el-button` | 110 |
| 含按钮的公共组件源文件 | `frontend/src/components/**/*.vue` 中出现 `el-button` | 48 |
| 原生按钮 | 所有 Vue 页面和公共组件中的 `<button>` | 0 |

“实际叶子路由”与“页面源文件”不能相加作为页面总数：一个路由页通常由多个 Tab、弹窗和业务组件组成；同一个源文件也可能被多个 URL 复用。没有路由入口的 Tab、弹窗和组件仍然属于后续统一审计范围。

## 2. 路由页面清单

状态字段含义：`已登记` 表示已纳入统一审计范围，不代表所有专项规范均已完成逐项人工回归；专项完成情况以对应审计命令和后续人工记录为准。

### 2.1 后台登录、系统与业务页面

| 路由 | 页面文件 | 页面类型 | 表格专项 | 当前状态 |
| --- | --- | --- | --- | --- |
| `/login` | `views/auth/LoginViewSimple.vue` | 登录页 | 否 | 已登记 |
| `/404` | `views/system/page/404.vue` | 错误页 | 否 | 已登记 |
| `/dashboard` | `views/dashboard/DashboardView.vue` | 后台首页 | 否 | 已登记 |
| `/suppliers` | `views/suppliers/SuppliersView.vue` | 业务列表 | 是 | 已登记 |
| `/payments` | `views/payments/SupplierPhonePaymentsView.vue` | 业务列表 | 是 | 已登记 |
| `/system` | `views/system/SystemView.vue` | 设置页/多 Tab | 是 | 已登记 |
| `/standards` | `views/standards/StandardsAuditView.vue` | 规范与审计管理页 | 否 | 已接入 |
| `/git-management` | `views/system/page/GitManagement.vue` | 系统工具页 | 否 | 已登记 |
| `/backup` | `views/backup/BackupView.vue` | 系统工具页 | 是 | 已登记 |
| `/data-optimization` | `views/data-optimization/DataOptimizationView.vue` | 多 Tab 工具页 | 否 | 已登记 |
| `/menu` | `views/menu/MenuManagementView.vue` | 配置列表 | 是 | 已登记 |
| `/sales` | `views/sales/SalesView.vue` | 销售管理 | 是 | 已登记 |
| `/models` | `views/models/ModelsView.vue` | 基础资料列表 | 是 | 已登记 |
| `/colors` | `views/colors/ColorsView.vue` | 基础资料列表 | 是 | 已登记 |
| `/memories` | `views/memories/MemoriesView.vue` | 基础资料列表 | 是 | 已登记 |
| `/brands` | `views/brands/BrandsView.vue` | 基础资料列表 | 是 | 已登记 |
| `/stores` | `views/stores/StoresView.vue` | 基础资料列表 | 是 | 已登记 |
| `/employees` | `views/employees/EmployeesView.vue` | 人员列表 | 是 | 已登记 |
| `/customers` | `views/customers/CustomersView.vue` | 客户列表 | 是 | 已登记 |
| `/accessories` | `views/accessories/AccessoriesView.vue` | 配件列表 | 是 | 已登记 |
| `/inventory` | `views/inventory/InventoryView.vue` | 库存管理 | 是 | 已登记 |
| `/preorders` | `views/preorders/PreordersView.vue` | 预定管理 | 是 | 已登记 |
| `/reminders` | `views/reminders/ReminderView.vue` | 提醒列表 | 是 | 已登记 |
| `/shared` | `views/shared/SharedView.vue` | 经验分享 | 是 | 已登记 |
| `/marketing` | `views/marketing/MarketingManagementView.vue` | 营销管理 | 否 | 已登记 |
| `/error-management` | `components/ErrorManagement/ErrorDashboardSimple.vue` | 错误管理 | 是 | 已登记 |
| `/query` | `views/query/QueryView.vue` | 综合查询 | 是 | 已登记 |
| `/permissions` | `views/permissions/PermissionsView.vue` | 权限管理 | 否 | 已登记 |
| `/analytics` | `views/analytics/AnalyticsView.vue` | 数据分析 | 否 | 已登记 |
| `/attendance` | `views/attendance/AttendanceView.vue` | 考勤管理 | 是 | 已登记 |
| `/salary` | `views/salary/SalaryView.vue` | 工资管理 | 否 | 已登记 |
| `/subsidy` | `views/subsidy/SubsidyView.vue` | 国补管理 | 是 | 已登记 |
| `/rentals` | `views/rentals/RentalsView.vue` | 租赁管理 | 是 | 已登记 |
| `/repairs` | `views/repairs/RepairsView.vue` | 维修管理 | 是 | 已登记 |
| `/price-list` | `views/price-list/PriceListView.vue` | 价目表管理（支持批量绑定采集来源） | 是 | 已登记 |
| `/price-list/sync-logs` | `views/price-list/page/SyncLogView.vue` | 同步日志 | 是 | 已登记 |

### 2.2 H5 商城管理页面

`/H5-admin` 是布局容器，不计入叶子页；以下 6 个子路由均需按后台规范检查，同时补充 H5 触控和窄屏检查。

| 路由 | 页面文件 | 页面类型 | 表格专项 | 当前状态 |
| --- | --- | --- | --- | --- |
| `/H5-admin/page/templates` | `views/H5-admin/page/templates.vue` | H5 管理页 | 否 | 已登记 |
| `/H5-admin/page/config` | `views/H5-admin/page/config.vue` | H5 管理页 | 否 | 已登记 |
| `/H5-admin/page/home-sections` | `views/H5-admin/page/home-sections.vue` | H5 管理页 | 否 | 已登记 |
| `/H5-admin/page/banners` | `views/H5-admin/page/banners.vue` | H5 管理页 | 否 | 已登记 |
| `/H5-admin/page/orders` | `views/H5-admin/page/orders.vue` | H5 管理列表 | 是 | 已登记 |
| `/H5-admin/page/sold-products` | `views/H5-admin/page/SoldProductsView.vue` | H5 管理页 | 否 | 已登记 |

### 2.3 公开报价与营销页面

| 路由 | 页面文件 | 页面类型 | 表格专项 | 当前状态 |
| --- | --- | --- | --- | --- |
| `/price-query` | `views/price-list/page/PublicPriceQuery.vue` | 公开查询 | 是 | 已登记 |
| `/sales-price-display` | `views/price-list/page/SalesPriceDisplay.vue` | 公开报价 | 是 | 已登记 |
| `/Marketing_Copy` | `views/marketing/MarketingView.vue` | 公开营销页 | 否 | 已登记 |

### 2.4 H5 手机端页面

`/m` 是移动布局容器；以下 15 个子路由均需检查 iOS/Android、窄屏文字、触控和上传/支付流程。

| 路由 | 页面文件 | 页面类型 | 表格专项 | 当前状态 |
| --- | --- | --- | --- | --- |
| `/m` | `views/H5-mobile/page/MobileHome.vue` | 手机首页 | 否 | 已登记 |
| `/m/products` | `views/H5-mobile/page/ProductList.vue` | 商品列表 | 否 | 已登记 |
| `/m/product/new/:id` | `views/H5-mobile/page/AggregatedProductDetail.vue` | 新机详情 | 否 | 已登记 |
| `/m/product/:id` | `views/H5-mobile/page/SmartProductDetail.vue` | 商品详情 | 否 | 已登记 |
| `/m/product` | `views/H5-mobile/page/AggregatedProductDetail.vue` | 聚合详情 | 否 | 已登记 |
| `/m/cart` | `views/H5-mobile/page/Cart.vue` | 购物车 | 否 | 已登记 |
| `/m/checkout` | `views/H5-mobile/page/Checkout.vue` | 结算页 | 否 | 已登记 |
| `/m/order/success` | `views/H5-mobile/page/OrderSuccess.vue` | 订单结果 | 否 | 已登记 |
| `/m/order/detail` | `views/H5-mobile/page/OrderDetail.vue` | 订单详情兼容页 | 否 | 已登记 |
| `/m/my-orders` | `views/H5-mobile/page/MyOrders.vue` | 我的订单 | 否 | 已登记 |
| `/m/order-detail/:orderNumber` | `views/H5-mobile/page/OrderDetail.vue` | 订单详情 | 否 | 已登记 |
| `/m/order-query` | `views/H5-mobile/page/OrderQuery.vue` | 订单查询 | 否 | 已登记 |
| `/m/login` | `views/H5-mobile/page/LoginView.vue` | 手机登录 | 否 | 已登记 |
| `/m/register` | `views/H5-mobile/page/RegisterView.vue` | 手机注册 | 否 | 已登记 |
| `/m/my` | `views/H5-mobile/page/MyCenter.vue` | 个人中心 | 否 | 已登记 |

### 2.5 布局容器（不计入 59 个叶子路由）

| 挂载路径 | 容器文件 | 职责 |
| --- | --- | --- |
| `/` | `views/system/page/SimpleAdminView.vue` | 后台主布局、侧栏和顶栏 |
| `/H5-admin` | `views/H5-admin/H5-adminView.vue` | H5 商城管理布局 |
| `/m` | `views/H5-mobile/H5-mobileView.vue` | H5 手机端布局 |

## 3. 非路由页面功能单元

以下文件没有独立 URL，但会在功能修改时影响对应父页面，必须纳入同一轮检查。路由清单中已经登记的页面文件不在本节重复列出；一个源文件被多个路由复用时，以路由清单中的多个 URL 为准。

### 3.1 数据分析、数据优化与库存

- `views/analytics/page/CustomerAnalytics.vue`
- `views/analytics/page/EmployeeAnalytics.vue`
- `views/analytics/page/InventoryAnalytics.vue`
- `views/analytics/page/ProfitAnalytics.vue`
- `views/analytics/page/SalesAnalytics.vue`
- `views/analytics/page/TransferAnalytics.vue`
- `views/data-optimization/page/DataCheckTab.vue`
- `views/data-optimization/page/DataImportTab.vue`
- `views/data-optimization/page/DatabaseSyncTab.vue`
- `views/inventory/page/InventoryEditDialog.vue`
- `views/inventory/page/InventorySearchFilters.vue`
- `views/inventory/page/InventoryStatsCards.vue`
- `views/inventory/page/InventoryTable.vue`

### 3.2 权限管理

- `views/permissions/page/LogsPage.vue`
- `views/permissions/page/ModuleFieldPermissionDialog.vue`
- `views/permissions/page/ModuleManagementView.vue`
- `views/permissions/page/ModulesPage.vue`
- `views/permissions/page/RoleFieldPermissionDialog.vue`
- `views/permissions/page/RoleFormDialog.vue`
- `views/permissions/page/RolePermissionsPage.vue`
- `views/permissions/page/RolesPage.vue`
- `views/permissions/page/SharedSearchPanel.vue`
- `views/permissions/page/StoreBindingDialog.vue`
- `views/permissions/page/StoreBindingsPage.vue`
- `views/permissions/page/UserRoleAssignmentBody.vue`
- `views/permissions/page/UserRoleAssignmentDialog.vue`
- `views/permissions/page/UserRoleAssignmentSummary.vue`
- `views/permissions/page/UserRolesPage.vue`

### 3.3 预定、销售与工资

- `views/preorders/page/DeliverConfirmModal.vue`
- `views/preorders/page/MatchPreorderModal.vue`
- `views/preorders/page/PreorderFormModal.vue`
- `views/preorders/page/QuickAddCustomerModal.vue`
- `views/sales/page/SalesBatchForm.vue`
- `views/sales/page/SalesCheckoutForm.vue`
- `views/sales/page/SalesDeviceInfoPanel.vue`
- `views/sales/page/SalesEditPhoneDialog.vue`
- `views/sales/page/SalesGridView.vue`
- `views/sales/page/SalesInventoryDetailDialog.vue`
- `views/sales/page/SalesPageHeader.vue`
- `views/sales/page/SalesSearchFilters.vue`
- `views/sales/page/SalesStatsCards.vue`
- `views/sales/page/SalesSummaryView.vue`
- `views/sales/page/SalesTableView.vue`
- `views/sales/page/SalesViewControls.vue`
- `views/salary/page/SalaryAttendanceFormDialog.vue`
- `views/salary/page/SalaryAttendanceListDialog.vue`
- `views/salary/page/SalaryDetailDialog.vue`
- `views/salary/page/SalaryEditPayoutDialog.vue`
- `views/salary/page/SalaryEmployeeSalesDetailDialog.vue`
- `views/salary/page/SalaryEmployeeTemplateDialog.vue`
- `views/salary/page/SalaryEmployeesTab.vue`
- `views/salary/page/SalaryMyRecordsTab.vue`
- `views/salary/page/SalaryPageHeader.vue`
- `views/salary/page/SalaryPayoutTab.vue`
- `views/salary/page/SalarySalesDetailDialog.vue`
- `views/salary/page/SalarySettleDialog.vue`
- `views/salary/page/SalaryStatsCards.vue`
- `views/salary/page/SalaryTemplateFormDialog.vue`
- `views/salary/page/SalaryTemplatesTab.vue`

### 3.4 价格、国补与系统

- `views/subsidy/components/SubsidyApplyDialog.vue`
- `views/subsidy/components/SubsidyDetailDialog.vue`
- `views/subsidy/components/SubsidyEditDialog.vue`
- `views/subsidy/components/SubsidyListSection.vue`
- `views/subsidy/components/SubsidyPhotoManageDialog.vue`
- `views/system/page/Returngoods.vue`
- `views/system/phone-warning-config/PhoneWarningConfigView.vue`

### 3.5 H5 管理和手机端内部页面

- `views/H5-mobile/page/ProductDetail.vue`
- `views/auth/index.vue`

## 4. 表格专项清单

以下 56 个页面文件和 6 个组件文件由 `check:tables` 纳入表格审计。`check:tables` 当前通过，表示公共表格入口、基本布局和禁止覆盖规则通过静态审计；不替代手机/PC 实机视觉回归。

### 4.1 页面文件（56）

表格页面按业务目录统计：

- H5 管理：`views/H5-admin/page/orders.vue`
- 基础资料与业务：`accessories/AccessoriesView.vue`、`brands/BrandsView.vue`、`colors/ColorsView.vue`、`customers/CustomersView.vue`、`employees/EmployeesView.vue`、`memories/MemoriesView.vue`、`models/ModelsView.vue`、`stores/StoresView.vue`、`suppliers/SuppliersView.vue`
- 分析、考勤与系统：`analytics/page/CustomerAnalytics.vue`、`analytics/page/EmployeeAnalytics.vue`、`analytics/page/InventoryAnalytics.vue`、`analytics/page/ProfitAnalytics.vue`、`analytics/page/SalesAnalytics.vue`、`analytics/page/TransferAnalytics.vue`、`attendance/AttendanceView.vue`、`backup/BackupView.vue`、`system/SystemView.vue`、`system/page/Returngoods.vue`、`system/phone-warning-config/PhoneWarningConfigView.vue`
- 数据、权限与预定：`data-optimization/page/DataCheckTab.vue`、`data-optimization/page/DataImportTab.vue`、`data-optimization/page/DatabaseSyncTab.vue`、`menu/MenuManagementView.vue`、`permissions/page/LogsPage.vue`、`permissions/page/ModuleManagementView.vue`、`permissions/page/RolesPage.vue`、`permissions/page/StoreBindingsPage.vue`、`permissions/page/UserRolesPage.vue`、`preorders/PreordersView.vue`、`preorders/page/MatchPreorderModal.vue`
- 库存、报价与综合查询：`inventory/InventoryView.vue`、`inventory/page/InventoryTable.vue`、`price-list/PriceListView.vue`、`price-list/page/PublicPriceQuery.vue`、`price-list/page/SalesPriceDisplay.vue`、`price-list/page/SyncLogView.vue`、`query/QueryView.vue`、`reminders/ReminderView.vue`、`rentals/RentalsView.vue`、`repairs/RepairsView.vue`
- 工资、销售、分享与国补：`salary/page/SalaryAttendanceListDialog.vue`、`salary/page/SalaryEmployeeSalesDetailDialog.vue`、`salary/page/SalaryEmployeesTab.vue`、`salary/page/SalaryMyRecordsTab.vue`、`salary/page/SalaryPayoutTab.vue`、`salary/page/SalarySalesDetailDialog.vue`、`salary/page/SalaryTemplatesTab.vue`、`sales/page/SalesBatchForm.vue`、`sales/page/SalesInventoryDetailDialog.vue`、`sales/page/SalesSummaryView.vue`、`sales/page/SalesTableView.vue`、`shared/SharedView.vue`、`subsidy/components/SubsidyListSection.vue`
- 供应商付款：`payments/SupplierPhonePaymentsView.vue`

### 4.2 公共组件文件（5）

- `components/ComprehensiveWarnings.vue`
- `components/ErrorManagement/ErrorDashboardSimple.vue`
- `components/MobileTable.vue`
- `components/PaginatedTable.vue`
- `components/stock-in/StockInPhoneListSection.vue`

`components/common/CustomerSearchDropdown.vue` 使用部分公共数据表格令牌保持搜索下拉的视觉一致，但自身不渲染表格，因此归入客户搜索规范，不计入本节表格组件数量。

## 5. 全局功能维度

页面台账不是只检查表格。每次功能修改必须根据任务勾选以下维度，并回看所有适用页面：

| 维度 | 统一入口/规范 | 必查对象 |
| --- | --- | --- |
| 页面结构、标题、Tab | `page-structure-standards.md`、`tab-standards.md` | 所有后台页、H5 管理页、含 Tab 的子页 |
| 表格、行高、字体、操作列 | `admin-table-standards.md`、`npm run check:tables` | 56 个页面承载单元、5 个表格组件 |
| 全局文字与排版 | `typography-standards.md`、`npm run check:typography` | 128 个页面源文件、71 个公共组件、全局样式 |
| 按钮、底部操作区 | `button-standards.md`、`dialog-standards.md` | 所有列表、表单、弹窗和移动端 footer |
| 权限、字段与操作列 | `permission-capability-standards.md`、`field-permission-guide.md` | 权限管理、库存、销售、综合查询及所有操作列 |
| 搜索、选项和分页 | `search-standards.md`、`model-search-standard.md`、`pagination-standards.md` | 所有检索页、基础资料、库存/销售/综合查询 |
| 弹窗、表单与文本框 | `dialog-standards.md`、`form-control-standards.md` | 所有 `*Dialog.vue`、`*Modal.vue`、设置表单 |
| Loading、空状态、通知 | `global-loading-standard.md`、`empty-state-standard.md`、`notification-standards.md` | 所有异步列表、提交、上传和错误分支 |
| 日期、金额、支付 | `time-standards.md`、表格金额规则、`payment-method-standard.md` | 销售、批发、划拨、库存、报价、工资和支付组件 |
| 响应式与手机端 | `responsive-breakpoint-standard.md`、`visual-regression-checklist.md` | 后台页、H5 管理页、`/m` 全部路由 |
| 上传与媒体 | 后端上传规范及页面上传台账 | 综合查询、库存、销售、国补、商城管理和公共上传组件 |
| API、缓存、错误边界与安全 | 开发指南、运行时和安全规范 | 所有调用 API 的页面和公共 composable |

## 6. 新增与修改前置流程（强制）

### 页面生命周期登记要求（不可跳过）

- **新增后必须更新文档**：新增路由、页面文件、Tab、弹窗、列表、表单或公共组件完成实现后，必须在本台账登记实际路径、父页面、类型、适用规范和审计结果；只提交代码而不更新台账视为未完成。
- **删除后必须更新文档**：删除路由或页面文件后，必须在同一变更中移除台账条目，并同步检查 `router/index.ts`、父页面引用、菜单/权限模块、规范清单和相关文档链接；不能留下“幽灵页面”记录。
- **改名、迁移和合并也必须更新文档**：文件路径、路由路径、组件职责或父页面发生变化时，先更新台账的旧记录和新记录，再提交实现；若保留兼容路由，必须注明兼容期限和删除条件。
- **数量变化必须可追溯**：每次新增、删除、迁移或合并后，更新第 1 节统计数量和第 8 节维护记录；不能继续沿用旧数量。
- **文档更新与代码变更同一提交闭环**：页面代码、路由、菜单权限和本台账必须一起评审。发现台账与代码不一致时，优先标记为“待处理”，不能假设页面已经完成统一。

### 新增页面或功能单元

1. 先在本台账登记路由、源文件、页面类型、父页面、是否含表格/弹窗/上传/权限和响应式范围。
2. 若新增路由，必须同步更新 `frontend/src/router/index.ts` 与本文件的路由清单；若只新增 Tab、弹窗或组件，登记到第 3 节对应业务分组。
3. 选择适用的全局规范和公共入口，禁止先写页面私有实现再补登记。
4. 实现后运行相关专项审计，并在台账中记录命令、日期和结果。

### 修改既有页面或公共功能

1. 从本台账定位直接页面和同类页面，不得只验证当前 URL。
2. 根据第 5 节功能维度检查所有受影响页面；公共组件或全局样式改动必须检查全部引用方。
3. 页面修改至少执行：类型检查、对应专项审计、`git diff --check`；涉及表格/权限/按钮/弹窗/搜索/响应式时，必须执行相应 `check:*` 命令。
4. 涉及手机端的页面必须验收 360px、390px、430px、768px 和桌面宽度；涉及公开 H5 页面还要检查 iOS/Android。
5. 完成后更新本台账“当前状态”和变更日期；发现未接入、例外或无法实机验证时必须明确记录，不能写成“已统一”。

### 状态定义

- **已登记**：已纳入页面台账，但不代表所有规范已完成人工确认。
- **已接入**：对应公共实现和静态审计通过，并完成必要的视口回归。
- **部分接入**：部分公共入口已使用，仍有明确待处理项。
- **待处理**：尚未满足对应规范，必须在后续任务中优先处理。
- **例外登记**：确有打印模板、第三方协议或业务限制，已记录原因和替代验证方式。

## 7. 当前审计结果与边界

- 页面清单统计已完成：路由入口 63、叶子路由 60、视图源文件 128、公共组件 71。
- 表格逐页审计已完成：台账范围为 56 个页面承载单元、5 个公共表格组件；当前 56 个页面模板直接渲染表格，库存 `InventoryView.vue` 与 `InventoryTable.vue` 按承载关系共同纳入范围。当前模板实际包含 90 个 Element 表格和 55 个操作列，`npm run check:tables` 已逐文件通过。
- “审计通过”仅表示静态规则通过；文字溢出、触摸滚动、按钮位置、真实权限和云端 API 行为仍需按本台账进行浏览器/云端回归。
- 当前台账不把 `views` 目录下的每个文件都当作独立 URL；新增路由、Tab、弹窗和公共组件必须分别登记，防止重复计数或漏查。
- 按钮专项已完成零容忍迁移：Vue 源码共扫描 `el-button=969`，原生 `<button>=0`；以后新增按钮必须使用 `el-button`，不得新增原生按钮例外。
- Loading 已按本台账逐文件审计：128 个页面/功能单元、71 个公共组件和 1 个应用入口全部通过 `npm run check:loading`；扫描结果为 `GlobalLoading=1`、`v-tf-loading=48`、`TableLoadingRow=56`、`SectionLoading=32`、`InlineLoading=46`、登记 `v-loading` 例外 1 处。
- Loading 触发边界已收口：页面切换和明确的全局长操作由 `App.vue` 唯一挂载的 `GlobalLoading` 承载；表格刷新由 `v-tf-loading` 锁定表格边界并显示“加载数据中...”；局部状态通过 `useLoadingStore.hasLocalLoading/isGlobalVisible` 互斥仲裁，同一次操作不得同时显示全屏与局部 Loading。
- 徽章专项已按台账扫描全部页面和公共组件：徽章 hover 外包围线与过渡唯一由 `styles/components/_badges.scss` 控制；页面仅保留业务颜色、图标和文字，禁止私有 hover、阴影、位移和重复 `global.css` 状态入口。结果由 `npm run check:badges` 强制校验。
- 统一 API 已补齐默认 Loading：128 个页面及其公共功能单元不再依赖逐页传入 `showLoading: true`；首次数据请求默认进入全局 Loading，只有明确的 `showLoading: false` 请求保持静默。
- 全屏 Loading 例外仅保留 2 个已登记场景：规范页的真实演示，以及数据优化页的清理、批量合并和删除等明确长操作；数据优化页的表格查询仍使用局部 Loading，两类操作不能共用同一次反馈。
- 逐页核对结论已同步至 `global-loading-standard.md`：无专属 Loading 标记的布局、父级和公共功能单元均已注明统一 API 或父子组件承载关系；详情弹窗使用 `SectionLoading`，首屏和表格刷新不再叠加两层反馈。
- 仪表盘预警和待审批组件已接入根区域 `v-tf-loading`；提醒弹窗的后台轮询明确关闭 Loading，避免定时探测覆盖用户当前页面。
- 统计变化时，以路由文件和源文件实际扫描结果为准；文档中的数量和分组必须随代码变更同步更新。

## 8. 维护记录

| 日期 | 变更 | 结果 |
| --- | --- | --- |
| 2026-10-06 | 首次建立全局页面、功能单元和表格专项台账 | 已登记，后续新增/修改必须按第 6 节执行 |
| 2026-10-06 | 新增 `/standards` 规范与审计管理页及独立权限模块 | 已接入，纳入页面、权限和规范审计流程 |
| 2026-10-06 | 按台账逐页复核表格入口、操作列、行高、表头、滚动和私有覆盖；校正表格组件统计口径 | 56 个页面承载单元、5 个公共表格组件全部通过 `npm run check:tables`；90 个 Element 表格、55 个操作列已接入公共规则 |
| 2026-10-06 | 按台账迁移全部原生按钮，并将组件采用审计改为零容忍；同步收口公共按钮选择器和规范文档 | 当日记录 Vue 源码 `el-button=967`、原生 `<button>=0`；`check:component-adoption` 和 `check:buttons` 纳入后续强制门禁 |
| 2026-10-06 | 手机端按钮专项复核：侧滑菜单展开/关闭、通知关闭、锁屏密码切换、分页、媒体预览和 H5 登录统一触控尺寸、语义 class、无障碍标签及窄屏布局 | `check:component-adoption` 原生 `<button>=0`、`check:responsive`、`check:buttons`、`check:dialog-actions`、`check:design-tokens`、`type-check` 和生产构建通过；手机端需按 360/390/430px 实机回归 |
| 2026-10-06 | 导航视觉专项复核：顶部栏、标签页、面包屑、桌面侧栏、手机侧滑菜单及二级菜单统一导航令牌，移除白色背景兜底 | 新增 `navigation-standards.md` 与 `check:navigation`；PC/手机展示组件仍可不同，但背景、状态层级和权限菜单数据统一 |
| 2026-10-07 | 按台账逐文件复核 Loading 分层和触发边界；新增页面/公共组件逐项审计输出，并把全局/局部 Loading 互斥规则接入 `useLoadingStore`、`v-tf-loading` 和 `useRefreshData` | 128 个页面/功能单元、71 个公共组件、1 个应用入口通过 `npm run check:loading`；GlobalLoading=1、v-tf-loading=48；仅保留 2 个有原因的全局长操作例外 |
| 2026-10-07 | 统一首次进入/F5 与手动刷新的 Loading 生命周期；`v-tf-loading` 首次加载不再抢占全局层，首次完成后的再次请求才显示表格遮罩 | 全站首次加载只使用 `GlobalLoading`，手动刷新/搜索/分页使用 `v-tf-loading`；`check:loading` 和完整 `check:standards` 通过 |
| 2026-10-07 | 修复统一 API 默认不展示 Loading 的缺口；未显式关闭的首次请求统一进入 `GlobalLoading`，继续由局部刷新互斥规则接管手动刷新 | 页面/功能单元不再因遗漏 `showLoading: true` 而无任何加载反馈；`check:loading`、类型检查和完整规范审计通过 |
| 2026-10-07 | 按台账补充无直接 Loading 标记页面的承载说明，并为国补详情弹窗接入 `SectionLoading`；详情请求关闭全局层避免重复反馈 | 128 个页面/功能单元、71 个公共组件逐项核对；`check:loading`、`check:coverage`、`type-check` 通过 |
| 2026-10-07 | 报价管理主表新增批量选择和批量来源绑定，接入统一权限、API、弹窗和表格规范 | 支持绑定具体采集账户或恢复默认来源；来源校验、500 条上限、类型检查和相关规范审计通过 |
| 2026-10-10 | 按台账逐页复核徽章接入；删除旧 `global.css` 状态入口和各页面私有 hover/过渡，统一徽章外包围线、动效和触摸设备行为 | 71 个实际使用徽章的页面/公共样式文件、863 个引用通过 `check:badges`；完整 `check:standards` 通过 |
