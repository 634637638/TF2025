# 前后端逐页与路由模块审计报告（2026-11-02）

本文保留 2026-11-02 对 TF2025 前端叶子路由、页面功能单元、公共组件及后端路由模块的审计快照。后续复核单独注明日期，不以历史统计替代当前工作区检查。

2026-11-02 曾将后端数据库连接主机切换为内网 `10.2.3.10:3306`，只读 `SELECT 1` 与当时的 299 项真实数据库回归通过。该历史结果不代表新增测试或当前环境已经通过。

## 2026-11-04 云端数据库补验

用户确认云端已备份并明确授权直接测试后，使用 `test:db -- --all --live --backup-confirmed` 并准确指定目标连接 `10.2.3.10:3306/TF2025`。复用当前环境凭据，未修改业务 `.env` 或服务器全局参数。

- **最终结果**：完整后端 330 项通过，0 失败、0 跳过，退出码 0，约 44.86 秒。此前跳过的 14 项数据库回归已全部执行，包含 8 个并发事务各生成 20 个单号，断言事务内唯一且回滚后可复用；单号用例约 30.10 秒。
- **测试机制修复**：初跑的 15 秒测试锁等待引发 `ER_LOCK_WAIT_TIMEOUT`，现移除该覆盖、沿用服务器默认 50 秒；修复预检连接池被后续建池覆盖后未关闭，以及单元测试继承业务模式环境的问题。保留并发数量和原断言，不使用强制退出掩盖泄漏。21 项安全/清理单元测试通过。
- **数据核验**：样本查询只读，库存只在事务内创建随机设备并回滚，未改既有业务设备、用户、门店或销售。结束回读及独立只读回查确认临时设备 0、测试日期销售 0、序列值仍为 0。回滚插入可能消耗自增 ID，不重置自增值。
- **范围**：本轮未修改业务单号算法；未重新执行前端构建或浏览器/真机验收。默认隔离测试保护继续保留，独立库合成样本路径仍待独立环境实测。操作及完整用例见[数据库测试文档](../backend/database-testing.md)。

下节是云端补验之前的同日记录，其“待执行”状态已由本节补验结果更新。

## 2026-11-04 收尾复核

本节保留云端补验前的检查结果。323 项测试、14 项跳过及专用环境缺失均为当时状态；本次云端最终结果见上节，独立测试库的合成样本流程仍未实测。

- **Lint 清理**：工资页、门店页缩进已修复；Vue 使用 TypeScript 的未使用变量规则，保留真实未使用变量告警，并补充 2 项正反例测试。旧字段契约文件的 513 项分号告警已按 ESLint 修复，并比对修复前后 JavaScript AST，确认断言内容不变。
- **行为测试**：补充 18 项前端用例，覆盖价目表后端渠道价格保留、零价/空值、公共客户姓名锁定、预订单选择/清空/改名，以及桌面和移动端国补权限组合；当前前端共 38 项通过。价目表映射提取到页面领域 helper，复用权威 `PriceListRow`，字段审计范围同步包含实际映射入口。
- **后端结果**：`RUN_DB_TESTS=false npm --prefix backend test` 为 323 项，309 通过、14 项数据库条件用例跳过、0 失败；新增的 14 项数据库测试安全/清理机制单元测试已经通过。
- **当前静态门禁**：`npm --prefix frontend run check:standards` 全部通过，包含类型检查、38 项前端测试、字段/权限/响应式/Loading/安全审计和严格 Lint；源码 Lint 为 0 errors、0 warnings，类型债务扫描为显式 `any=0`、`views any=0`、重复导出名称 `=0`。本轮新增的四份前端测试文件另经真实 TS/Vue 编译通过。
- **文档与变更检查**：`npm run check:docs` 检查 193 份 Markdown 导航及 6 个标记 TS/Vue 示例通过；修改涉及的测试、辅助工具与配置定向 ESLint 通过，`git diff --check` 通过。未重新执行生产构建、真实数据库回归或浏览器/真机验收。
- **数据库测试机制**：新增专用 `TEST_DB_*` 环境校验、实际库名核对、InnoDB/结构预检与合成样本；并发任务全部清理后才汇总结果，异常回滚失败销毁连接，库存缺样本不再空跑通过。样本只在隔离库创建并按本轮主键逆序清理。
- **当时未完成的验收**：当时没有专用测试库配置，`npm --prefix backend run test:db` 已验证会在连接前拒绝缺失配置。该阶段未执行的 14 项真实数据库用例随后已在明确授权的业务模式下通过；独立云端测试库中的合成样本创建、提交和清理流程仍待实测。

执行入口及逐项清单见[后端数据库回归测试](../backend/database-testing.md)。以下“审计结论”及其后统计仍为原日期历史快照，不能作为当前类型债务或包体积数量。

## 审计结论

- 前端共扫描 65 个懒加载入口、62 个叶子路由、130 个 `views` 页面/功能单元和 71 个公共组件；路由文件缺失为 0。
- 62 个叶子 URL 映射到 59 个唯一 `views` 页面文件和 1 个公共组件；另有 3 个布局容器、68 个未被路由直接加载的 Tab、弹窗或页面内部功能单元。
- 后端完善后共扫描 64 个路由模块、41,980 行路由代码和 733 个 `router.<method>` 接口声明。命名路由对象和中间件内部 `.get()` 不计入 733 的口径。
- 权限能力审计覆盖 47 个模块和 41 个受保护叶子路由；字段权限审计覆盖 39 个模块。未发现新的路由权限绕过或字段权限扩大问题。
- 本轮已关闭 2 类运行时/接口问题：移除依赖不存在数据表的 `/api/data` CRUD，国补照片下载统一接入受保护文件下载入口。
- 本轮已关闭 3 类统一性问题：营销前后台共用定位/天气服务、租赁页面改用统一 logger、前后端未使用导入和变量已清理。
- 严格 Lint 已从 1,105 个 warning 清零；待办和经验分享页面累计完成 49 处显式 `any` 清零。TypeScript AST 当前统计 `views` 809 个、前端合计 1,044 个，已由发布门禁锁定基线，新增或反弹会失败。
- 历史云端后端完整测试曾达到 297/297 通过、0 失败、0 跳过；本次复核改用 `10.2.3.10:3306` 后修复单号并发锁顺序问题，真实回归 299/299 通过。最新正式构建首屏 JS 617,323 字节、CSS 275,658 字节、总量 892,981 字节，体积门禁通过。
- H5 和手机端静态门禁已覆盖，但 iOS/Android 真机触摸、软键盘、安全区和支付/上传流程仍未完成真实验收；弃用路由日志也尚未覆盖完整发布周期。

## 本次重新分析处理结果

| 级别 | 原问题 | 当前处理 | 剩余边界 |
| --- | --- | --- | --- |
| P1 | 错误管理单条删除假成功 | 已增加全局单条删除、响应式刷新和防回退检查 | 已闭环 |
| P1 | Vue 显式 `any` 未受发布门禁约束 | AST 基线门禁已接入 `check:standards`，覆盖 `.ts/.tsx/.vue`、新文件、全量和 `views` | 1,044 个存量继续按模块清理，最终启用 ESLint 规则 |
| P1 | TypeScript 核心严格子选项被关闭 | 已开启 `noImplicitThis`、`strictBindCallApply`、`strictBuiltinIteratorReturn`、`useUnknownInCatchVariables` | 其余严格项按错误清单分批治理 |
| P2 | 36 个导出类型名称重复 | 考勤、基础资料、工资、预订单状态和 API 响应完成首批收口，当前降至 26 组并锁定基线 | 对剩余同名不同语义模型逐项核对 |
| P2 | 库存模块 7 个弃用入口返回 501 | 已统一为 `410 Gone`，保留认证、权限、弃用日志和契约测试 | 完整发布周期无访问后可删除路由 |
| P2 | 私有配置和旧文档 ZIP 存在误提交风险 | 根目录私有配置及文档 ZIP 已加入 `.gitignore` | 提交时仍需按职责拆分已有改动 |

本次未重新打开已闭环的销售单号、历史单号数据、唯一索引、北京时间和国补字段/操作权限问题。相关结论见[本站代码、数据与发布检查报告](site-analysis-2026-11-02.md)。

## 检查范围与方法

| 范围 | 数量 | 主要验证 |
| --- | ---: | --- |
| 懒加载路由入口 | 65 | 路由 AST、文件存在性、布局与叶子路由区分 |
| 叶子路由 | 62 | 页面文件、认证、权限映射、API、Loading、响应式静态规则 |
| `views` 页面/功能单元 | 130 | TypeScript、统一 API、Loading、表格、弹窗、按钮、时间、响应式 |
| 公共组件 | 71 | 公共组件采用、Loading、按钮、表格、响应式和样式规则 |
| 后端路由模块 | 64 | 路由声明、认证/权限、安全门禁、错误响应、SQL 和文件规模 |
| `router.<method>` 声明 | 733 | `get/post/put/patch/delete/options/head/all` 静态统计 |

已复核命令：

```bash
npm --prefix frontend run check:field-permissions
npm run check:reference-options
npm --prefix backend run audit:deprecated-routes
npm run lint:strict
```

上述检查均通过。`lint:strict` 在完善前为 0 errors、1,105 warnings，其中 970 条可自动修复；完成格式、未使用代码和作用域问题清理后，当前结果为 0 errors、0 warnings。

## 前端逐页结果

状态说明：

- **通过**：当前静态门禁和路由/权限检查未发现明确缺陷，不代表已完成所有人工业务回归。
- **已闭环**：本轮发现的问题已修复并增加自动防回退检查。
- **待真机**：静态与构建检查通过，但仍需 iOS/Android 实机验证。
- **大文件债务**：功能未确认故障，但文件规模会显著增加修改和回归风险。

### 后台、系统与业务页面

| 路由 | 页面文件 | 结论 |
| --- | --- | --- |
| `/login` | `views/auth/LoginViewSimple.vue` | 通过；公开登录页，认证前访问符合设计 |
| `/404` | `views/system/page/404.vue` | 通过；公开错误页 |
| `/dashboard` | `views/dashboard/DashboardView.vue` | 通过；受保护路由和权限映射完整 |
| `/suppliers` | `views/suppliers/SuppliersView.vue` | 通过；未使用帮助函数已清理 |
| `/payments` | `views/payments/SupplierPhonePaymentsView.vue` | 通过；页面 3,395 行，列入大文件债务 |
| `/system` | `views/system/SystemView.vue` | 通过；页面 2,672 行，原未使用 `InlineLoading` 导入已清理 |
| `/standards` | `views/standards/StandardsAuditView.vue` | 通过；模板格式已统一并通过严格 Lint |
| `/git-management` | `views/system/page/GitManagement.vue` | 通过；后端 `git.js` 为 1,654 行大路由 |
| `/backup` | `views/backup/BackupView.vue` | 通过；下载和归档专项已有门禁 |
| `/data-optimization` | `views/data-optimization/DataOptimizationView.vue` | 通过；实际 API 位于三个子 Tab |
| `/menu` | `views/menu/MenuManagementView.vue` | 通过；菜单点击与权限预检由统一布局承载 |
| `/sales` | `views/sales/SalesView.vue` | 通过；API 和表格能力分布在销售子组件 |
| `/models` | `views/models/ModelsView.vue` | 通过；原未使用 Loading 导入已清理 |
| `/colors` | `views/colors/ColorsView.vue` | 通过；原未使用 Loading 导入已清理 |
| `/memories` | `views/memories/MemoriesView.vue` | 通过；原未使用 Loading 导入已清理 |
| `/brands` | `views/brands/BrandsView.vue` | 通过；原未使用 Loading 导入已清理 |
| `/stores` | `views/stores/StoresView.vue` | 通过；原未使用 Loading 导入已清理 |
| `/employees` | `views/employees/EmployeesView.vue` | 通过；3,047 行，列入大文件债务 |
| `/customers` | `views/customers/CustomersView.vue` | 通过；4,202 行，为当前最大页面文件 |
| `/accessories` | `views/accessories/AccessoriesView.vue` | 通过；原未使用 Loading 导入已清理 |
| `/inventory` | `views/inventory/InventoryView.vue` | 通过；3,295 行，API 和表格能力由子组件共同承载 |
| `/preorders` | `views/preorders/PreordersView.vue` | 通过；后端 `preorders.js` 为 1,695 行大路由 |
| `/reminders` | `views/reminders/ReminderView.vue` | 已闭环；轮询请求已登记静默 Loading 边界，页面 26 处显式 `any` 已清零并接入防回退审计 |
| `/shared` | `views/shared/SharedView.vue` | 已闭环；私有附件访问已有受控入口，页面 23 处显式 `any` 已清零并复用全局分享类型 |
| `/guide` | `views/guide/GuideManagementView.vue` | 通过；模板格式已统一并通过严格 Lint |
| `/marketing` | `views/marketing/MarketingManagementView.vue` | 已闭环；与公开营销页共用营销上下文服务 |
| `/error-management` | `components/ErrorManagement/ErrorDashboardSimple.vue` | 已闭环；单条删除调用全局日志入口并同步刷新列表/详情，防假删除契约已进入规范门禁 |
| `/query` | `views/query/QueryView.vue` | 通过；3,758 行且显式 `any` 较多，列入结构债务 |
| `/permissions` | `views/permissions/PermissionsView.vue` | 通过；权限链路为用户→角色→权限；页面 2,673 行，未使用导入已清理 |
| `/analytics` | `views/analytics/AnalyticsView.vue` | 通过；主要 API 和风险位于分析子页，`ProfitAnalytics.vue` 达 4,199 行 |
| `/attendance` | `views/attendance/AttendanceView.vue` | 通过；3,605 行，列入大文件债务 |
| `/salary` | `views/salary/SalaryView.vue` | 通过；4,091 行且显式 `any` 最集中 |
| `/subsidy` | `views/subsidy/SubsidyView.vue` | 已闭环；字段/操作权限及受保护照片下载均使用统一入口 |
| `/rentals` | `views/rentals/RentalsView.vue` | 已闭环；销售选项失败改用统一 logger，响应类型同步收紧 |
| `/repairs` | `views/repairs/RepairsView.vue` | 通过；原未使用 Loading 导入已清理 |
| `/price-list` | `views/price-list/PriceListView.vue` | 通过；3,769 行且显式 `any` 较多，列入大文件债务 |
| `/price-list/sync-logs` | `views/price-list/page/SyncLogView.vue` | 通过；同步日志独立权限已登记 |

### H5 商城管理页面

| 路由 | 页面文件 | 结论 |
| --- | --- | --- |
| `/H5-admin/page/templates` | `views/H5-admin/page/templates.vue` | 通过静态审计；2,652 行，需继续控制模板编辑复杂度 |
| `/H5-admin/page/config` | `views/H5-admin/page/config.vue` | 通过静态审计；真实支付配置仍需部署联调 |
| `/H5-admin/page/home-sections` | `views/H5-admin/page/home-sections.vue` | 通过静态审计 |
| `/H5-admin/page/banners` | `views/H5-admin/page/banners.vue` | 通过静态审计；上传链路需部署验证 |
| `/H5-admin/page/orders` | `views/H5-admin/page/orders.vue` | 通过静态审计；2,183 行，需真机检查表格和操作区 |
| `/H5-admin/page/sold-products` | `views/H5-admin/page/SoldProductsView.vue` | 通过静态审计 |

### 公开页面

| 路由 | 页面文件 | 结论 |
| --- | --- | --- |
| `/price-query` | `views/price-list/page/PublicPriceQuery.vue` | 通过静态审计；公开查询与截图导出已登记 |
| `/sales-price-display` | `views/price-list/page/SalesPriceDisplay.vue` | 通过静态审计；报价样式已改为懒加载 |
| `/DH` | `views/guide/GuidePublicView.vue` | 通过静态审计；密码分类和文件签名仍需部署回归 |
| `/Marketing_Copy` | `views/marketing/MarketingView.vue` | 已闭环；共用带超时、取消和 HTTP 状态校验的外部服务 |

### H5 手机端页面

| 路由 | 页面文件 | 结论 |
| --- | --- | --- |
| `/m` | `views/H5-mobile/page/MobileHome.vue` | 待真机；静态响应式门禁通过 |
| `/m/products` | `views/H5-mobile/page/ProductList.vue` | 待真机；需验证滚动、筛选和触控 Loading |
| `/m/product/new/:id` | `views/H5-mobile/page/AggregatedProductDetail.vue` | 待真机；与 `/m/product` 复用页面文件 |
| `/m/product/:id` | `views/H5-mobile/page/SmartProductDetail.vue` | 待真机；需验证图片、规格和购买操作 |
| `/m/product` | `views/H5-mobile/page/AggregatedProductDetail.vue` | 待真机；兼容聚合详情入口 |
| `/m/cart` | `views/H5-mobile/page/Cart.vue` | 待真机；需验证数量修改和窄屏操作区 |
| `/m/checkout` | `views/H5-mobile/page/Checkout.vue` | 待真机；真实支付、地址和软键盘流程未验收 |
| `/m/order/success` | `views/H5-mobile/page/OrderSuccess.vue` | 待真机；需验证支付资料和订单状态展示 |
| `/m/order/detail` | `views/H5-mobile/page/OrderDetail.vue` | 待真机；与参数化订单详情复用页面文件 |
| `/m/my-orders` | `views/H5-mobile/page/MyOrders.vue` | 待真机；需验证分页和登录失效处理 |
| `/m/order-detail/:orderNumber` | `views/H5-mobile/page/OrderDetail.vue` | 待真机；正式订单详情入口 |
| `/m/order-query` | `views/H5-mobile/page/OrderQuery.vue` | 待真机；需验证输入法和查询错误反馈 |
| `/m/login` | `views/H5-mobile/page/LoginView.vue` | 待真机；需验证键盘遮挡和会话恢复 |
| `/m/register` | `views/H5-mobile/page/RegisterView.vue` | 待真机；需验证表单校验和密码安全提示 |
| `/m/my` | `views/H5-mobile/page/MyCenter.vue` | 待真机；需验证登录态、订单入口和安全区 |

## 非路由页面与公共组件

130 个 `views` 文件的准确拆分如下：

| 类型 | 数量 | 说明 |
| --- | ---: | --- |
| 唯一叶子 `views` 页面文件 | 59 | 62 个叶子 URL 中有两个页面文件各被两个 URL 复用，另有 1 个 URL 使用公共组件 |
| 布局容器 | 3 | 后台、H5 管理、H5 手机端布局 |
| 非路由功能单元 | 68 | Tab、弹窗、页面内部功能区和复用单元 |
| 合计 | 130 | 与 `frontend/src/views/**/*.vue` 实际扫描一致 |

68 个非路由功能单元和 71 个公共组件已由[前端页面与功能单元台账](../frontend/page-audit-inventory.md)逐文件登记。自动检查对这些文件继续覆盖 Loading、表格、按钮、弹窗、排版、响应式和公共组件采用；本报告不重复复制完整文件清单。

## 后端逐模块结果

下表接口数只统计直接写成 `router.<method>(...)` 的声明。`guide.js` 等使用命名路由或委托服务的模块会显示为 0，不代表模块没有对外能力。

| 路由模块 | 接口数 | 行数 | 结论 |
| --- | ---: | ---: | --- |
| `accessories.js` | 14 | 650 | 通过静态安全与权限扫描 |
| `analytics.js` | 32 | 4,525 | 通过；超大路由，优先按分析域拆分 |
| `attendance.js` | 13 | 91 | 通过；主要逻辑在服务层 |
| `auth.js` | 6 | 579 | 通过认证与安全门禁 |
| `backup.js` | 7 | 245 | 通过；归档和下载专项已有回归 |
| `brands.js` | 8 | 498 | 通过 |
| `colors.js` | 8 | 459 | 通过 |
| `csrf.js` | 3 | 466 | 通过 CSRF/XSRF 门禁 |
| `customers.js` | 13 | 946 | 通过；接近大文件阈值 |
| `dashboard.js` | 7 | 413 | 通过 |
| `data-check.js` | 17 | 97 | 通过；保留有明确业务语义的数据检查接口 |
| `data-import.js` | 9 | 585 | 通过；导入事务与单号链路已有专项回归 |
| `database-sync.js` | 20 | 102 | 通过 |
| `dbStatus.js` | 1 | 64 | 通过 |
| `debug-permissions.js` | 2 | 149 | 通过现有认证门禁；生产用途仍应持续限制 |
| `employees.js` | 16 | 1,180 | 通过；大路由拆分债务 |
| `git.js` | 16 | 1,654 | 通过；大路由拆分债务 |
| `guide-public.js` | 4 | 76 | 通过；公开接口与签名文件边界已登记 |
| `guide.js` | 0 | 236 | 使用命名路由/委托实现；静态安全门禁通过 |
| `home-sections.js` | 12 | 277 | 通过 |
| `icons.js` | 10 | 942 | 通过；接近大文件阈值 |
| `index.js` | 7 | 405 | 通过挂载检查；遗留 `/data` 已移除 |
| `inventory.js` | 15 | 1,333 | 通过；大路由拆分债务 |
| `memories.js` | 8 | 575 | 通过 |
| `menus.js` | 13 | 129 | 通过 |
| `models.js` | 9 | 651 | 通过 |
| `module-management.js` | 22 | 1,096 | 通过；大路由拆分债务 |
| `operators.js` | 1 | 53 | 通过 |
| `options.js` | 1 | 186 | 通过；公共选项固定数量严格审计已通过 |
| `payments.js` | 9 | 160 | 通过 |
| `permission-logs.js` | 4 | 329 | 通过 |
| `permission-management.js` | 38 | 3,442 | 通过权限能力审计；超大路由，优先拆分 |
| `phone-stock-warnings.js` | 10 | 187 | 通过 |
| `phones.js` | 18 | 1,995 | 通过；原未使用导入和 `prefer-const` 警告已清理，仍属于大路由债务 |
| `preorders.js` | 13 | 1,695 | 通过；大路由拆分债务 |
| `price-list-public.js` | 6 | 18 | 通过；实际实现主要委托控制器/服务 |
| `price-list.js` | 30 | 327 | 通过 |
| `product-mapping.js` | 4 | 25 | 通过 |
| `query.js` | 13 | 140 | 通过 |
| `reminders.js` | 15 | 188 | 通过 |
| `rentals.js` | 14 | 1,001 | 通过；大路由拆分债务 |
| `repairs.js` | 14 | 778 | 通过 |
| `salary-records.js` | 15 | 95 | 通过 |
| `salary-templates.js` | 8 | 50 | 通过 |
| `sales-management.js` | 8 | 261 | 通过 |
| `sales.js` | 9 | 1,737 | 通过单号和事务专项回归；大路由拆分债务 |
| `screen-lock.js` | 10 | 668 | 通过 |
| `settings.js` | 10 | 39 | 通过 |
| `shared.js` | 13 | 319 | 通过；私有附件访问已受控 |
| `shop-public.js` | 35 | 1,547 | 通过；公开接口较多且文件偏大，需保持白名单响应 |
| `shop.js` | 40 | 1,211 | 通过；原未使用导入已清理，仍属于大路由债务 |
| `stock-in.js` | 6 | 946 | 通过；接近大文件阈值 |
| `stores.js` | 9 | 580 | 通过 |
| `subsidy.js` | 18 | 2,540 | 通过权限和私有文件门禁；超大路由，优先按列表、审核、照片和统计拆分 |
| `supplier-payments.js` | 9 | 215 | 通过 |
| `suppliers.js` | 8 | 424 | 通过；原未使用 `parsePositiveInteger` 已清理 |
| `system-management.js` | 4 | 263 | 通过 |
| `system-settings.js` | 11 | 79 | 通过 |
| `system.js` | 13 | 990 | 通过；接近大文件阈值 |
| `transfers.js` | 4 | 59 | 通过事务与单号专项回归 |
| `upload-common.js` | 1 | 157 | 通过上传安全门禁 |
| `user-preferences.js` | 5 | 29 | 通过 |
| `user-stores.js` | 6 | 234 | 通过 |
| `users.js` | 9 | 649 | 通过 |

## 本轮已闭环问题

### 登录服务不可用时的错误分类

修复登录失败处理中间件将所有 `success:false` 响应计为密码错误的问题。现在只有 401 凭证失败会累计登录次数并返回 `X-Login-Attempts-Remaining`；数据库不可用的 5xx 会清除该响应头，不会锁定账号或记录 `invalid_credentials`。登录页和认证 Pinia store 均按 HTTP 状态码处理，503 显示服务不可用，只有 401 显示用户名或密码错误。新增登录限流契约测试并通过。

### 移除失效的 `/api/data` CRUD

已删除 `backend/src/routes/data.js`，并从 `backend/src/routes/index.js` 移除导入和 `/data` 挂载。`/api/data-check`、`/api/data-import` 和 `/api/database-sync` 等有明确业务语义的接口保持不变。

新增 `backend/test/legacy-data-route-contract.check.js`，除源码挂载检查外，还会启动隔离 HTTP 服务，确认 `/api/data` 返回 404，而 `/api/data-check`、`/api/data-import` 返回认证错误而不是 404。相关示例文档中的 `/api/data` 也改为 `/api/example-resource`，避免示例与真实接口混淆；已删除接口同步登记到兼容接口台账的“已删除且禁止恢复”区域。

云端没有创建无业务语义的 `data_table`，也没有修改现有业务数据。

### 统一国补照片下载

`frontend/src/views/subsidy/components/SubsidyPhotoManageDialog.vue` 已改为 `unifiedApi.download()`，由统一 Axios 实例处理认证、HTTP 错误、Blob 解包和临时 URL 释放。单张、选中照片和全部照片继续复用同一个下载函数。

下载安全审计新增防回退规则：国补照片管理必须使用 `unifiedApi.download()`，不得重新使用 `fetch(formatImageUrl(...))` 下载受保护文件。公共 `download-response.ts` 会拒绝非 2xx、JSON/HTML 错误体和无效 Blob；7 项自动测试覆盖 200、401、403、404、500，以及伪装成 200 的错误内容，确保错误响应不会保存成 JPG。

### 合并营销定位和天气服务

新增 `frontend/src/services/marketing-context.ts`，统一浏览器定位、Open-Meteo 地址解析、天气请求、8 秒超时、`AbortController`、`response.ok` 校验、类型转换和失败日志。

`MarketingView.vue` 和 `MarketingManagementView.vue` 只消费结构化上下文和统一状态文字。运行时模式审计禁止页面重新出现 Open-Meteo 域名或 `navigator.geolocation` 私有实现。

### 日志、未使用代码和异常作用域

- `RentalsView.vue` 的直接 `console.warn` 已改为统一 `logger.warn`，同时为销售员和门店选项补充明确响应类型。
- 12 个前端文件的未使用 `InlineLoading` 导入已清理。
- 后端未使用导入和变量已清理，涉及 `phones.js`、`shop.js`、`suppliers.js`、`attendance.service.js` 和 `price-list.service.js`。
- `price-list.service.js` 的 `syncConfigForError` 原来声明在 `try` 块内，却在 `catch` 中读取；现已提升到 `try/catch` 共同作用域，避免同步失败时二次触发 `ReferenceError`。
- 错误管理单条删除已接入 `ErrorLogger.removeError()`；页面不再只弹成功提示，删除当前详情记录后会同步关闭弹窗。独立契约检查已接入全量规范门禁。

导航和交易契约审计中原先依赖单行模板格式的断言也已改为结构化正则，避免合法格式化造成假失败。

## 技术债与发布边界

### 严格 Lint

2026-11-02 完善前结果为 47 个文件、1,105 warnings、0 errors，其中 970 条可自动修复。完成清理后的实际结果为 0 errors、0 warnings。

| 规则 | 数量 |
| --- | ---: |
| `vue/html-indent` | 443 |
| `vue/singleline-html-element-content-newline` | 302 |
| `vue/max-attributes-per-line` | 282 |
| `indent` | 23 |
| `no-unused-vars` | 20 |
| `vue/attributes-order` | 13 |
| `unused-imports/no-unused-imports` | 12 |
| `vue/multiline-html-element-content-newline` | 8 |
| `prefer-const` | 1 |
| `comma-dangle` | 1 |

格式、未使用导入和人工确认项均已处理。`npm run lint:strict` 当前通过，`frontend` 的 `check:lint` 已改为调用严格 Lint，因此 `check:standards`、`prebuild` 和 `check:release` 均会以 `--max-warnings 0` 阻断错误和警告。

### TypeScript 类型

130 个 `views` 页面/功能单元中，最新 TypeScript AST 统计存在 809 个显式 `any` 类型节点；前端全体共 1,044 个，分布于 89 个文件。旧报告约 755 处的文本扫描口径已废止。`check:typescript-debt` 现已覆盖 `.ts/.tsx/.vue`，逐文件、全量、`views` 和新文件均不得增加 `any`；重复导出类型也不得新增名称或定义文件。`ReminderView.vue` 原有 26 处与 `SharedView.vue` 原有 23 处已清零，工资域类型已统一到 `types/salary.ts`，剩余高集中页面包括 `SalaryView.vue`、`QueryView.vue`、`ProfitAnalytics.vue`、`PriceListView.vue`、`PermissionsView.vue`、`MobileHome.vue`、`SubsidyView.vue` 和 `SalesAnalytics.vue`。

统一 `ApiResponse` 已增加 `summary` 泛型，且不再由 `unified-api.ts` 二次导出同名类型；`Brand`、`Model`、`Color` 直接复用 `@/types`。考勤类型迁移到 `types/attendance.ts`，工资类型迁移到 `types/salary.ts`，预订单状态迁移到 `types/order.ts`，旧 `limit/pages` 响应已删除。重复导出名称由 36 组降至 26 组并收紧基线。

`noImplicitThis`、`strictBindCallApply`、`strictBuiltinIteratorReturn`、`useUnknownInCatchVariables` 已在 `tsconfig.json` 开启且类型检查通过。`noImplicitAny`、`strictNullChecks`、`strictFunctionTypes` 仍因存量错误暂未开启；后续必须按业务模块修复后分批开启，不能通过大面积断言或放宽公共类型绕过。

### 文件规模

前端最大文件包括 `CustomersView.vue` 4,202 行、`ProfitAnalytics.vue` 4,199 行、`SalaryView.vue` 4,091 行、`PriceListView.vue` 3,769 行和 `QueryView.vue` 3,758 行。

后端最大路由包括 `analytics.js` 4,525 行、`permission-management.js` 3,442 行、`subsidy.js` 2,540 行和 `phones.js` 1,995 行。

这些是维护和回归风险，不应直接等同于功能故障。拆分时必须复用统一类型、权限、API、时间和错误处理入口，禁止复制第二套实现。

### 兼容路由与真机验收

- 2026-10-21 至 2026-11-02 共扫描 9 个 combined 日志文件、14,241 行；弃用访问和兼容接口访问均为 0。
- 7 个未实现库存入口已由 501 改为 410，表示接口正式退役；权限和访问日志继续保留，完整观察周期后再决定是否删除路由定义。
- 日志默认只保留 14 天，且尚未覆盖新版本完整发布周期，因此本轮不能据此删除 28 个弃用路由或 10 个兼容标记路由。
- H5 和手机端仍需在 360px、390px、430px、768px 和桌面宽度进行浏览器回归，并完成 iOS/Android 真机触摸、软键盘、安全区、上传和支付流程验收。

2026-11-03 已补做 Chrome 移动设备仿真回归：`375px`、`390px`、`430px`、`768px` 下 H5 公开路由均无页面级横向溢出；测试账号 `test/test` 在 390px 仿真视口登录并通过 `/dashboard` 权限守卫。该结果不改变“待真机”状态，iOS/Android 实机触摸、软键盘、安全区、上传、支付和摄像头扫码仍需在真实设备完成。

2026-11-03 HTTPS 交互回归补充：390px 移动设备仿真下底部导航进入 `/m/products`、筛选弹窗打开、订单查询输入和空购物车展示均通过，页面级横向溢出为 0；扫码组件的摄像头失败路径保留“手动输入”兜底。该结果仍不等同于 iOS/Android 真机验收。

## 剩余治理顺序

1. 按业务域继续收口显式 `any` 与剩余 26 组重复导出类型，优先处理工资、综合查询、盈利分析、价目表和权限页面；每次降低后同步收紧债务基线。
2. 分批拆分超过 3,000 行的页面与超过 1,500 行的后端路由；复用现有类型、API、权限、时间和错误处理入口。
3. 完成 H5 真机验收和兼容路由完整发布周期观察后，再决定兼容接口删除时间。
4. 部署后使用测试销售员账户验证字段权限、操作权限、国补下载和营销外部服务在真实代理环境下的表现。

## 相关资料

- [本站代码、数据与发布检查报告](site-analysis-2026-11-02.md)
- [前端页面与功能单元台账](../frontend/page-audit-inventory.md)
- [前端规范索引](../frontend/INDEX.md)
- [权限文档索引](../permissions/INDEX.md)
- [兼容接口与弃用路由台账](../guides/compatibility-route-retirement-ledger.md)
- [文档编写与维护规范](../guides/DOCUMENTATION_STANDARDS.md)
