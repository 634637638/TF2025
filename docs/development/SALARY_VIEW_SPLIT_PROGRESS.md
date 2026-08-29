# SalaryView 拆分进度

更新时间：2026-08-28

## 权限边界

根路由页面继续由 `salary:view` 的 `PermissionGate` 控制。TAB 展示权限继续保留在 `SalaryView.vue`：工资模板使用 `salary-templates:view`，员工工资与工资计算使用 `salary-records:view`，工资发放使用 `my-salary:view` 或工资记录查看权限。

所有新增、编辑、删除、审批和结算 API 在调用前继续执行 `requireSalaryTemplatePermission` 或 `requireSalaryRecordPermission`。字段权限统一复用父页面的 `canViewSalaryField`、`canEditSalaryField`，模块 Key 保持为 `salary_salarytemplatesview`、`salary_salaryrecordsview`、`salary_mysalaryview`。

## 当前进度

| 区块 | 状态 | 位置 | 说明 |
| --- | --- | --- | --- |
| 权限与字段边界 | 已确认 | `SalaryView.vue` | 根权限、TAB 权限、操作权限和字段模块 Key 不迁移、不改名 |
| 页头操作 | 已完成 | `page/SalaryPageHeader.vue` | 只接收父页面权限结果并转发新增、重算、刷新事件 |
| 统计卡片 | 已完成 | `page/SalaryStatsCards.vue` | 保留团队/个人视角及字段权限 |
| 工资模板表格状态 | 已完成 | `useSalaryTemplateTable.ts` | 筛选、分页和移动端双击展开已抽离；API、写操作和权限仍由主页面控制 |
| 员工工资表格状态 | 已完成 | `useSalaryEmployeeTable.ts` | 搜索、模板筛选、月份、分页和移动端双击展开已抽离；员工考勤、销售计算和权限仍由主页面控制 |
| 工资计算/发放表格状态 | 已完成 | `useSalaryPayoutTable.ts` | 员工与工资记录合并、状态筛选、分页和移动端展开已抽离；结算、编辑和删除权限仍由主页面控制 |
| 工资发放记录状态 | 已完成 | `useSalaryMyRecordsTable.ts` | 员工选择、月份范围、分页和筛选状态已抽离；团队/本人数据接口仍由主页面按权限选择 |
| 工资发放记录视图 | 已完成 | `page/SalaryMyRecordsTab.vue` | 表格、筛选和手机端双击展开已抽离；字段模块 Key 仍为 `salary_mysalaryview`，详情与销售明细事件交回主页面 |
| 员工工资视图 | 已完成 | `page/SalaryEmployeesTab.vue` | 员工工资筛选、表格、字段显示和手机端操作已抽离；模板、考勤、销售操作事件交回主页面 |
| 员工考勤与销售计算 | 已完成 | `salary-employee-data.ts` | 底薪合并、两个月考勤汇总、提成与加班费计算已抽离；移除 `record.date` 和旧销售响应兼容，考勤改为分页完整读取 |
| 工资字段兼容清理 | 已完成 | 控制器、字段契约 | `limit/templateId` 入口兼容已移除，工资记录与模板运行时兼容边界均为 0 |
| 工资计算视图 | 已完成 | `page/SalaryPayoutTab.vue` | 筛选、工资计算表格、结算/重算/编辑/删除事件及手机端双击展开已抽离；父页面继续控制 API 与权限 |
| 工资详情弹窗 | 已完成 | `page/SalaryDetailDialog.vue` | 详情展示、字段权限和移动端布局已抽离；父页面继续控制打开状态和记录来源 |
| 工资发放销售明细弹窗 | 已完成 | `page/SalarySalesDetailDialog.vue` | 销售明细表格、桌面拖动和手机横向滚动已抽离；数据请求和字段权限仍由父页面控制 |
| 员工销售明细弹窗 | 已完成 | `page/SalaryEmployeeSalesDetailDialog.vue` | 员工销售汇总、明细表格和响应式布局已抽离；数据请求和操作权限仍由父页面控制 |
| 编辑工资记录弹窗 | 已完成 | `page/SalaryEditPayoutDialog.vue` | 表单字段与响应式布局已抽离；表单状态、保存接口、创建/编辑权限和月份计算仍由父页面控制 |
| 结算工资弹窗 | 已完成 | `page/SalarySettleDialog.vue` | 员工、金额和支付方式表单已抽离；工资计算、保存、结算权限和临时数据仍由父页面控制 |
| 员工工资模板设置弹窗 | 已完成 | `page/SalaryEmployeeTemplateDialog.vue` | 员工、模板选择与预览已抽离；模板数据、字段权限结果和保存操作仍由父页面控制 |
| 工资模板新增/编辑弹窗 | 已完成 | `page/SalaryTemplateFormDialog.vue` | 模板字段、提成方式和自动涨薪表单已抽离；初始化、保存接口和新增/编辑权限仍由父页面控制 |
| 考勤记录列表弹窗 | 已完成 | `page/SalaryAttendanceListDialog.vue` | 考勤表格、快捷操作和响应式布局已抽离；加载、删除确认和操作权限仍由父页面控制 |
| 新增/编辑考勤记录弹窗 | 已完成 | `page/SalaryAttendanceFormDialog.vue` | 三种考勤类型、备注、状态字段和响应式布局已抽离；类型切换、初始化、保存 API 和校验仍由父页面控制 |

## 验证要求

- 初始主文件：8,445 行；当前主文件：4,068 行。
- 每完成一个区块必须通过类型检查、严格 ESLint、权限审计、统一 UI 审计和生产构建。
- 管理员、工资记录管理员和仅查看本人薪资三类访问路径必须保持原权限结果。

## 本轮验证

- `npm run type-check`：通过。
- 工资目录严格 ESLint `--max-warnings=0`：通过。
- 字段、权限、统一 UI、TAB 审计：通过。
- 工资相关契约用例通过；完整契约测试当前受手机、配件和分析等并行迁移影响为 77/84，7 个失败均不在工资模块。
- 字段一致性审计通过（47 个兼容字段、274 个已退役字段、7 个兼容边界），新增弹窗均已登记为 `salary-records` 审计源。
- `npx vite build`：通过；当前共转换 3134 个模块，工资页面产物约 144.81 KB。
- `SalaryPayoutTab.vue`：严格 ESLint 0 error、0 warning；工资计算 TAB 的字段权限指令和分页交互保持不变。
- `SalaryDetailDialog.vue`：严格 ESLint 0 error、0 warning；工资详情字段权限与原显示条件保持一致。
- 已拆出的所有工资弹窗和 TAB：严格 ESLint 0 error、0 warning；桌面与手机端交互、字段权限和父页面 API 边界保持不变。
- 工资页面内联业务弹窗已全部拆出，`SalaryView.vue` 当前只保留页面编排、数据加载、权限和业务操作逻辑。
- 完整 `npm run build`：工资相关检查均通过，但 prebuild 被销售、H5、公开商城与入库并行迁移中的 12 个 `eqeqeq` 错误阻塞；不属于工资模块，本轮未覆盖相关文件。
