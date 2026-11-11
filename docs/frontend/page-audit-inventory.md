# 前端页面与功能单元台账

> 状态：强制登记，持续维护
> 统计日期：2026-11-11
> 统计来源：`frontend/src/router/index.ts`、`frontend/src/views/**/*.vue`、`frontend/src/components/**/*.vue`

> 导航审计记录：后台 PC 与手机入口均由 `views/system/page/SimpleAdminView.vue` 统一承载；菜单数据来自 `stores/menu.ts`，菜单点击统一派发 `menu-click`，权限预检统一由主布局执行。手机端不再将菜单分流到未渲染的底部导航；`DynamicSidebar` 已退役，`ResponsiveLayout` 仅作为通用内容布局保留。

> 2026-10-17 导航站维护：`/DH` 无直属连接的一级分类不再显示同名 TAB，默认展示第一个二级分类；后台仍保留一级 TAB 便于维护。`/guide` 导航设置统一维护顶部副标题、主标题和底部信息，通过 `GuideSettings` 与公开接口展示；旧数据库由后端启动时补齐字段。分类切换已在 360px 和 1440px 的本地 Chromium 拦截响应中验证，未修改云端业务数据；不代表安卓或 iOS 真机验收。

> 本次验证：顶部和底部自定义文字、120 字符长内容换行及旧接口默认回退均通过 360px/1440px 浏览器检查；设置服务通过模拟数据库验证独立保存、旧客户端保留值、必填与长度限制。TypeScript、TAB、表单控件、响应式、视觉令牌、后端安全、定向 ESLint 和文档检查通过；未执行云端数据库迁移或写入验收。

> 2026-11-09 手机弹窗操作区统一：以 `/query` 设备销售信息按钮为标杆，手机公共按钮采用约 30–32px 高、12px 字号、6px 圆角/间距，综合查询接入 `.tf-dialog-actions` 并移除私有按钮尺寸和排列。默认/自定义/原生 footer、确认框及正文 `.tf-dialog-toolbar` 共用公共令牌，平板 40px、PC 32px 保持原规格。手机和平板底部按钮按可用空间等分且每个最多 150px，空间充足时每个为 150px，整组居中；综合查询编辑、详情、公共 footer 和确认框共用这一上限。验收命令见按钮及弹窗专项规范。

> 2026-11-09 销售出库宽度调整：`/sales` 单台及批量出库弹窗显式声明桌面 `880px`，移除样式中重复的 `1000px` 声明，沿用公共视口边界与手机/平板响应式收缩。

> 2026-11-09 公共默认宽度：桌面 `--tf-dialog-width` 统一为 `880px`，未声明宽度且未使用尺寸档位的弹窗自动使用该默认值；显式尺寸和档位优先，手机和平板继续按公共视口规则收缩。

> 2026-11-11 首轮全局序号：页面、弹窗及公共表格的 37 个序号/ID 列统一使用 `table-number-badge` 浅紫色圆角标签，样式和深色主题由 `admin-layout.css` 控制，长数字通过公共 `$getNumberColumnWidth` 自动扩列；员工、门店及权限列表的位置编号标题改为“序号”，真实 ID 保留原值。序号/ID 接入、公共列宽及私有样式覆盖纳入 `check:badges` 门禁，`/standards` 提供预览；分页、倒序和组内编号沿用业务规则。使用真实列模板和公共分页组件完成 375/430/768/1024/1440px × 明暗主题共 10 组本地 Chromium 检查，验证长序号、聚合 ID、行高和无页面横向溢出；未连接真实业务 API，不代表安卓/iOS 真机或所有页面的整页验收。

## 1. 目的与统计口径

本台账是所有前端页面、页面内功能单元和公共组件的统一入口。后续新增页面、路由、Tab、弹窗、列表、表单或公共交互时，必须先登记，再实现；修改公共规范或跨页面功能时，必须按本台账确认受影响范围，不能只修改当前打开的页面。

统计时严格区分以下对象：

| 对象 | 统计口径 | 当前数量 |
| --- | --- | ---: |
| 懒加载路由入口 | `router/index.ts` 中的 `component: () => import(...)` | 65 |
| 实际叶子路由 | 可直接访问的页面路由，排除 3 个布局容器 | 62 |
| 页面源文件 | `frontend/src/views/**/*.vue`，包括 Tab、弹窗和页面内部单元 | 130 |
| 叶子路由唯一视图文件 | 62 个叶子 URL 对应的唯一 `views` 文件；两个文件各被两个 URL 复用，另有 1 个 URL 使用公共组件 | 59 |
| 布局容器视图文件 | 后台、H5 管理和 H5 手机端布局 | 3 |
| 非路由功能单元 | 未被路由直接加载的 Tab、弹窗、页面内部单元或复用单元 | 68 |
| 公共组件源文件 | `frontend/src/components/**/*.vue` | 73 |
| 涉及表格的页面源文件 | 页面中出现 Element/原生表格或公共表格入口 | 56 |
| 涉及表格的公共组件 | 公共组件中出现表格或表格封装 | 6 |
| 含按钮的页面/功能单元源文件 | `frontend/src/views/**/*.vue` 中出现 `el-button` | 110 |
| 含按钮的公共组件源文件 | `frontend/src/components/**/*.vue` 中出现 `el-button` | 46 |
| 原生按钮 | 所有 Vue 页面和公共组件中的 `<button>` | 0 |

“实际叶子路由”与“页面源文件”不能相加作为页面总数：62 个叶子 URL 实际映射到 59 个唯一 `views` 文件和 1 个公共组件；`AggregatedProductDetail.vue` 与 `OrderDetail.vue` 分别被两个 URL 复用。130 个 `views` 文件由 59 个叶子页面文件、3 个布局容器和 68 个非路由功能单元组成。没有独立 URL 的 Tab、弹窗和组件仍然属于后续统一审计范围。

### 下载安全专项登记

所有页面涉及文件预览、下载或导出时，必须同时遵守 [`download-security-standard.md`](download-security-standard.md)。新增入口必须先补充本表，再实现页面功能。

| 页面/功能 | 文件类型 | 前端统一入口 | 后端接口/方式 | 公开性 | 权限与归属校验 | 生命周期 |
| --- | --- | --- | --- | --- | --- | --- |
| `/DH` 导航文件 | 图片、PDF、Office、文本、压缩包 | 图片统一预览；其他 `unifiedApi.download()` | `/api/public/guide/files/:id` 短时签名 | 导航公开或分类密码保护 | 连接、分类启用状态和签名校验 | 删除/替换导航同步删除 |
| `/rentals` 合同附件 | 合同文件 | `unifiedApi.download()` | `/api/rentals/:id/files/:fileId/download` | 私有 | 登录、租赁记录归属 | 删除合同同步删除 |
| `/backup` 备份文件 | 数据库备份 | 统一下载入口 | 备份受控下载接口 | 私有 | 管理权限和下载令牌 | 过期清理 |
| `/shared` 经验分享附件 | 图片、附件 | 统一媒体/下载入口 | `/api/shared/files/*` | 私有 | 登录、分享记录归属 | 分享删除同步清理 |
| `/repairs` 维修媒体 | 图片、视频 | 统一媒体预览 | `/api/repairs/media/*` | 私有 | 登录、维修记录权限 | 维修记录删除同步清理 |
| `/subsidy` 国补材料 | 图片、附件 | 统一媒体/下载入口 | `/api/subsidy/files/*` | 私有 | 登录、国补记录权限 | 国补记录删除同步清理 |
| `/query`、`/inventory`、`/sales` | 设备图片 | 统一媒体预览 | 设备媒体受控或公开展示接口 | 按业务配置 | 记录权限/设备关联 | 设备删除同步清理 |
| `/price-query`、`/sales-price-display` | 报价截图 | 页面统一导出/Blob 入口 | 前端生成文件 | 不上传服务器 | 当前页面访问权限 | 浏览器临时对象及时释放 |
| `/sales` 对库 | 库存对库 PNG | `createTableImage()`、`saveBlobFile()` | 前端生成文件 | 不上传服务器 | 仅导出当前字段权限允许展示的数据 | 离屏副本、临时下载对象及时释放 |
| `/payments` 货款结算 | 单个、批量打款及批次明细 PNG | `createSettlementImage()` → `createTableImage()`、`saveBlobFile()` | 前端生成文件 | 不上传服务器 | 当前字段权限；图片排除利润、总销售及未打款填写区 | 离屏副本、临时下载对象及时释放 |
| 各后台导出功能 | CSV、JSON、XLSX | `unifiedApi.download()` 或统一导出服务 | 对应导出接口 | 私有 | 模块权限、字段权限和审计 | 响应完成后不落盘 |

### 全量编号接入复核（2026-11-11）

当前编号外观按用户参考图更新为浅绿底、绿字、浅绿细边框和常规字重，全部已接入页面共用 `admin-layout.css`；PC/手机保持公共 20px 标签高度，深色主题使用同入口的深绿配色。首轮浅紫样式记录保留为当时验证快照。

本轮按台账逐项核对，并扫描全部实际源码：130 个页面/功能单元、73 个公共组件及 1 个 App 入口，共 204 个 Vue 模板。补齐前轮漏掉的排名、只读排序、卡片和图片角标编号；同时将已在备份专项登记的两个云盘单元补入第 3 节，修正过期数量。源码静态扫描覆盖全部文件，不代表每个页面均已完成浏览器或真机验收。

| 本轮发现的遗漏位置 | 统一处理 |
| --- | --- |
| `/analytics`：销售产品排名、员工业绩排名、利润页员工业绩排名，以及品牌/型号/门店排行榜卡片 | 排名保留原取值，全部接入公共编号标签 |
| `/system` 报价联系人；`/menu` 菜单列表；`/reminders` 类型管理 | 只读排序接入公共徽章及列宽，排序输入控件保留编辑能力 |
| `/price-list` 在库明细；`/sales` 库存明细与批量设备信息 | 优先列的数字、设备编号接入公共样式，优先星标与业务高亮保留 |
| H5 管理的轮播图和模板分组卡片 | 图片编号和只读排序值统一；角标只保留独立定位 |
| `InventoryResultDialog`、`WholesalePhoneSummarySection`、`StockInPhoneListSection` | PC/手机列表、批量设备和商品编号统一 |
| `DraggableList`、`DraggableRow`、`MenuItem` | 只读排序数字统一，原有拖拽和点击编辑保留，点击编辑补充键盘触发 |
| 品牌、颜色、内存、供应商以及销售旧样式 | 移除无引用的排序徽章和重复编号覆盖，避免后续复用时恢复旧视觉 |

`check:badges` 不再排除“排名/排序”，同时检查表格外的独立编号和旧样式；`check:tables` 持续验证公共列宽注册及公共视觉入口。设备序列号、业务单号、可编辑输入框、图片替代文字及连续说明文字按原语义处理。

本轮验证：220 项前端单测及 10 项编号审计契约测试通过。使用实际源码中的 8 个新增表格列模板、利润页 3 类排行榜列表及真实拖拽组件，完成 375/430/768/1024/1440px × 明暗主题共 10 组本地 Chromium 检查；确认公共颜色、字号、20px 标签高度、6px 圆角、长序号完整显示、公共表格行高及无页面横向溢出，并验证排序标签通过键盘进入编辑、保存后返回标签。未连接真实业务 API，不代表全站整页或安卓/iOS 真机验收。

### 待办事项按钮紧凑规范（2026-11-11）

`/reminders` 的事项标题接入已有 `.table-inline-action.table-action--view`，背景与文字复用公共查看语义的浅青蓝配色，PC/手机按钮高度分别为 28px/32px，标题列复用公共文本测量并完整展示。操作列及含此按钮的普通单元格统一计算上下留白并扣除底边框，避免按钮撑高公共 48px/40px 数据行；移除重复手机端留白声明。`/standards` 字段列提供同一规格的真实点击预览，`check:buttons` 拒绝在表格文字操作中使用多行内容按钮，媒体缩略图保留专用语义。

本次使用真实事项、序号、状态及操作列模板，完成 375/430/768/1024/1440px × 明暗主题 × 普通/长标题共 20 组本地 Chromium 检查，验证数据行 48px/40px、按钮 28px/32px、徽章 20px、长标题完整展示及无页面横向溢出；点击和键盘事件绑定通过。未连接真实业务 API，不代表完整详情接口或安卓/iOS 真机验收。

## 2. 路由页面清单

品牌 `/brands`、型号 `/models`、颜色 `/colors` 和内存 `/memories` 的排序编辑共用 `useReferenceOrdering`：手动修改只提交目标 ID 和实际排序值，拖拽保留已有排序值范围，失败不覆盖切换后的新列表；序号与排序值解耦并按分页连续显示。型号新增/编辑表单统一使用“型号”字段标签。四页新增弹窗的取消、顶部关闭和 Esc 均直接关闭并清空草稿，编辑保留未保存确认；移除页面重复的 `close` 监听，PC/手机共用 `MobileDialog` 关闭请求。契约与回归入口见[检索规范](search-standards.md#基础资料排序编辑)和[弹窗规范](dialog-standards.md)。

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
| `/guide` | `views/guide/GuideManagementView.vue` | 导航站后台管理 | 是 | 已接入 |
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
| `/price-list` | `views/price-list/PriceListView.vue` | 价目表管理（跨页选择、批量采集源／状态／报价显示及规格独立批发规则） | 是 | 已登记 |
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
| `/DH` | `views/guide/GuidePublicView.vue` | 公开导航站 | 否 | 已接入 |
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

### 2.5 布局容器（不计入 62 个叶子路由）

| 挂载路径 | 容器文件 | 职责 |
| --- | --- | --- |
| `/` | `views/system/page/SimpleAdminView.vue` | 后台主布局、侧栏和顶栏 |
| `/H5-admin` | `views/H5-admin/H5-adminView.vue` | H5 商城管理布局 |
| `/m` | `views/H5-mobile/H5-mobileView.vue` | H5 手机端布局 |

## 3. 非路由页面功能单元（68 个）

以下 68 个文件没有独立 URL，但会在功能修改时影响对应父页面，必须纳入同一轮检查。路由清单中已经登记的 59 个唯一叶子 `views` 文件和第 2.5 节的 3 个布局容器不在本节重复列出；一个源文件被多个路由复用时，以路由清单中的多个 URL 为准。

### 3.1 数据分析、数据优化与库存

- `views/analytics/page/CustomerAnalytics.vue`
- `views/analytics/page/EmployeeAnalytics.vue`
- `views/analytics/page/InventoryAnalytics.vue`
- `views/analytics/page/ProfitAnalytics.vue`
- `views/analytics/page/SalesAnalytics.vue`
- `views/analytics/page/TransferAnalytics.vue`
- `views/data-optimization/page/DataCheckTab.vue`
- `views/data-optimization/page/DataImportTab.vue`
- `views/inventory/page/InventoryEditDialog.vue`
- `views/inventory/page/InventorySearchFilters.vue`
- `views/inventory/page/InventoryStatsCards.vue`
- `views/inventory/page/InventoryTable.vue`

### 3.2 权限管理

权限日志 TAB 的公共页头提供导出、清空和刷新。清空沿用 `permissions:delete`、公共危险按钮和二次确认，删除全部权限日志（包含筛选范围外记录），成功后回到第一页重新读取；取消和失败保留现有数据，列表使用公共最新请求仲裁。接口与保留规则见[权限操作日志规范](../permissions/permission-operation-log.md)。

角色字段权限（字段控制）与分配用户角色弹窗复用 `MobileDialog` 默认宽度，未声明宽度或档位，桌面默认 `880px`，手机和平板沿用公共响应式边界；对应的页面 CSS 宽度覆盖已移除。模块字段权限配置保留 `900px` 声明。

角色字段权限弹窗的子页面/分组导航项统一左右边界，名称/数量与敏感级别/隐藏数量分两行显示；长名称按内容增高，保留选择、键盘聚焦及滚动能力。

分配用户角色弹窗的“本次分配”复用 `tf-button--content`：已选项等宽对齐、名称靠左、移除图标靠右，长角色名称自然换行；标题和数量垂直居中，选择与移除仍由原受控状态处理。

页面模块、子页面/分组、角色库和绑定门店均复用 `tf-button--content` 的默认、悬停和选中视觉，通过 `aria-pressed` 表达选择；角色库及门店多选支持键盘切换，保存时禁用。五个列表 TAB 共用表格卡片外壳，模块网格的外框和悬停阴影也读取公共令牌；授权状态由业务徽章表达。

权限弹窗 footer 只保留公共 `.tf-dialog-actions` 按钮组，背景、分隔线、内边距及安全区由公共弹窗外壳处理；字段选择摘要移至正文，移除旧的固定底部高度、绝对定位及分配角色的嵌套 footer。

门店绑定列表“当前门店”和弹窗已绑定门店摘要使用公共小尺寸 `el-tag`，主门店为浅蓝标签并标注“· 主”，其余为浅灰标签；长名称使用公共 `tf-tag--wrap` 完整换行。列表操作按钮简写为“绑定”“管理”，操作列宽度计算同步使用相同文案。

模块管理页的手动添加模块弹窗中，分类、图标选择框与页面三个筛选框统一使用全局表单控件外观，移除旧 `form-control` 和重复外框样式，保留选择框自身的一层边框与公共聚焦态。

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

销售对库模式的内存、数量标签复用全局 `status-badge` 尺寸与交互：内存 64GB 为青色、128GB 为绿色、256GB 为蓝色、512GB 为橙色、1TB 及以上为紫色，小容量与未知规格使用中性色；数量使用浅紫底与紫色文字。颜色统一引用公共语义令牌；TB 和运行内存加存储容量组合规格按存储容量分级。

销售视图工具栏的调货、划拨、对库、图文、表格、保存图片及批量操作统一使用 `el-button size="small"`；按钮高度、字号、内边距和图标随公共小号规格变化，页面仅负责分组布局与横向滚动。

对库图片通过离屏副本按可见文字及徽章自然宽度收紧各列，表头、表体共用列宽，保留全局表格与字段权限。PNG 默认以三倍分辨率生成（高分屏最多四倍，超大数据按画布尺寸和像素预算自适应），直接保存原始画布，不固定拉伸到 2000px 或二次缩图；编码完成前持续保持保存状态，成功、失败均清理副本且不改变页面布局和滚动位置。

货款结算的已选设备操作区使用公共 `el-button size="small"`：“清空选择”使用默认中性样式，“批量打款”使用 `tf-button--finance` 财务语义；页面只保留防挤压布局，移除桌面和手机端私有按钮宽高、内边距、字体、圆角和颜色覆盖，尺寸随公共令牌响应式调整。

货款结算的单个打款、批量打款及批次详情图片与对库共用 `utils/table-image.ts`。单个和批量图片保留供应商、数量、价格摘要及设备明细，整块打款填写区（方式、时间、打款人、备注）及内部利润不进入图片；已打款批次详情保留顶部卡片，只排除总销售、总利润和利润列，其余摘要保留。隐藏列移除后重新计算列宽，摘要按剩余项目排列。图片采用紧凑高清 PNG，成功、失败均不改变页面表单值、权限、尺寸和滚动位置。

库存明细顶部信息卡片的标题与内容居中，供应商、店铺、品牌、成色、库存数量、最长在库分别采用公共蓝、青、青绿、绿、紫、橙色浅底令牌；最长在库固定采用橙色警示文字，成色标签复用公共 `condition-badge`。卡片不再使用整块深色背景或悬浮位移，长名称自然换行，窄屏按三列或两列排列。

- `views/preorders/page/MatchPreorderModal.vue`
- `views/preorders/page/PreorderFormModal.vue`
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

库存页“状态”后新增“商城”操作列，手机/平板双击设备后从详情底部进入相同商品配置弹窗；动作复用库存编辑权限及公共自适应操作列宽。上下架统一在配置弹窗点击保存后生效，库存编辑移除重复入口；新机只读预览模板，二手机维护独立验机及媒体。接口、素材取消边界与测试见[库存商城商品配置](../business/inventory/shop-configuration.md)。

### 3.4 价格、国补与系统

报价管理列表标题区的“批量设置”和“清空选择”通过 `.batch-actions-buttons` 自动使用公共批量操作按钮规格；PC、手机高度、字号、间距和颜色统一由公共按钮与表格入口控制，页面只保留操作区换行和对齐布局。

- `views/backup/CloudBackupSettingsDialog.vue`
- `views/backup/CloudDriveBrowser.vue`

- `views/subsidy/components/SubsidyApplyDialog.vue`
- `views/subsidy/components/SubsidyDetailDialog.vue`
- `views/subsidy/components/SubsidyEditDialog.vue`
- `views/subsidy/components/SubsidyListSection.vue`
- `views/subsidy/components/SubsidyPhotoManageDialog.vue`
- `views/system/page/Returngoods.vue`

系统管理的站点 Logo、编辑站点信息、报价设置和屏幕保护卡片保存按钮使用全局普通按钮尺寸，手机端保留文字，不通过局部内边距或隐藏文字压缩操作。

退库记录的电脑表格与手机记录列表共用 `table-section admin-panel admin-table-panel` 公共列表卡片，背景、边框、圆角、阴影及响应式内边距由 `admin-layout.css` 统一提供。退库记录卡片不另设刷新按钮，统一使用系统页面顶部刷新；当前退库 Tab 通过子组件暴露的 `reload` 失效 `/query/returngoods` 缓存并加载记录，失败保留原记录并向顶部传播错误，由顶部统一提示结果。电脑表格、手机卡片和编辑弹窗覆盖退库原因、类型、处理方式、退款金额及方式/渠道、业务退库时间和操作时间，复用公共支付方式、渠道及文本组件，渠道随方式统一受字段权限控制。创建入口为 `components/query/ReturnStockModal.vue`，退库时间选择器随表单列宽自适应；字段和迁移边界见[退库与交易撤销](../business/inventory/transaction-reversal.md)。
- `views/system/page/AnnouncementManagementCard.vue`
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

`/backup` 的文件大小标签按接口 `size_bytes` 分级：小于 1 MB 为绿色、1 MB 至不足 1 GB 为蓝色、1 GB 及以上为橙色（1024 进制）；缺失或无效大小回退中性色。复用 Element Plus 标签语义类型及公共徽章样式，明暗主题与手机/桌面沿用全局规则；本地备份文件列表契约统一维护为 `types/backup.ts` 的 `BackupFile`。

`/backup` 手动“清理旧备份”入口使用 `backup:delete` 公共指令与页面能力检查，移除少于 5 份就禁用的固定门槛；仅空列表、列表加载或清理中禁用。弹窗可设置保留数量，明确只清理服务器本地文件，成功刷新列表，失败通过公共通知提示并保留输入，提交中避免重复请求。自动清理的 SQL / ZIP 分类保留规则独立，详见[备份管理](../backend/backup-management.md#定时生成与本地保留规则)。

`/backup` 增加云盘设置弹窗 `backup/CloudBackupSettingsDialog.vue`、文件浏览单元 `backup/CloudDriveBrowser.vue`、ZIP/SQL 云盘状态及手动上传入口。云端删除独立显示警告色“文件失效”和“该文件云端已删除，可重新上传！”，实际上传错误仍显示“上传失败”；云端外部恢复经后端按原 ID 和大小核验后，页面轮询自动更新为“已上传”，不重复上传。任务轮询复用 `useLatestRequest`，读取失败保留已有状态，权限撤销和页面卸载取消请求及定时器。支持以名称和 Token 新增或编辑多个云盘账户，储存账户下拉框驱动对应账户的目录预览，保存设置才切换上传目标；管理入口可独立选择浏览账户，凭据不回显。设置弹窗按账户、自动备份和目标目录分组，桌面账户下拉与操作同排，手机纵向；表单/账户编辑采用公共中号/小号档位，浏览保留宽工作区。新增独立的定时生成备份分组（间隔 1–720 小时、SQL/完整 ZIP、北京时间执行状态）和本地自动清理分组（SQL/ZIP 分别保留 1–1000 份，默认各 10 份、默认关闭），清理区域沿用 `backup:delete` 并只提交获权配置，云盘文件保留；新字段手机纵向、桌面双列，复用全局数字输入和下拉，运行状态保留服务端唯一契约。自动备份单独设置标题，当前目录按“当前备份目录：实际盘名/文件夹名称”单行展示，每次打开设置及切换账户按已保存 ID 自动读取云端最新名称，迟到响应不覆盖其他账户或未保存的目录选择；读取失败保留原名称并提示，可继续浏览重选；设置弹窗和回收站移除说明提示，移除底部关闭按钮，保留标题栏关闭，新增账户和文件编辑期间锁定必要操作。选择已保存账户后自动识别云盘，支持目录选择、文件及回收站分页浏览；首次浏览空根目录时检查其他云盘并提示切换，手动选择及刷新不自动换盘，空状态标明当前云盘和目录。独立“云盘管理”入口及目录/回收站浏览复用 `backup:view`；设置、新建文件夹和上传复用 `backup:create`；文件及文件夹重命名、回收站恢复复用 `backup:edit`；删除及回收站彻底删除复用 `backup:delete` 和统一确认框；文件列表按“打开、编辑、删除”显示，编辑用于修改名称；回收站按“删除、恢复”显示，删除确认框明确彻底删除且不可恢复；两处删除复用公共 `table-action--delete` 样式，成功后刷新列表，失败保留列表和提示，目录删除明确包含子项并保护当前备份目录及其父目录。新建/重命名使用公共 `MobileDialog` 小号表单，成功关闭输入框并通过全局通知提示，失败只提示一次并保留输入；操作中禁用导航和弹窗关闭，错误保留输入，同名拒绝覆盖。统一 API 为 `api/backup.ts`，共享契约为 `types/backup.ts`。设置弹窗使用公共 `MobileDialog`、表单、按钮及 Loading，浏览请求采用 `useLatestRequest`，手机和桌面沿用全局响应式规则。开启后由后端递归扫描 backups 内完成的普通文件并自动上传（含新增规则文件，排除内部状态、临时项及符号链接，普通文件确认稳定后入队，云端保留子目录层级），不新增自动压缩或业务上传目录同步；上传不创建公开下载链接，本地删除与云盘保留独立。接口及持久化边界见[备份管理](../backend/backup-management.md#阿里云盘自动上传)。
- 数据、权限与预定：`data-optimization/page/DataCheckTab.vue`、`data-optimization/page/DataImportTab.vue`、`menu/MenuManagementView.vue`、`permissions/page/LogsPage.vue`、`permissions/page/ModuleManagementView.vue`、`permissions/page/RolesPage.vue`、`permissions/page/StoreBindingsPage.vue`、`permissions/page/UserRolesPage.vue`、`preorders/PreordersView.vue`、`preorders/page/MatchPreorderModal.vue`
- 库存、报价与综合查询：`inventory/InventoryView.vue`、`inventory/page/InventoryTable.vue`、`price-list/PriceListView.vue`、`price-list/page/PublicPriceQuery.vue`、`price-list/page/SalesPriceDisplay.vue`、`price-list/page/SyncLogView.vue`、`query/QueryView.vue`、`reminders/ReminderView.vue`、`rentals/RentalsView.vue`、`repairs/RepairsView.vue`
- 工资、销售、分享与国补：`salary/page/SalaryAttendanceListDialog.vue`、`salary/page/SalaryEmployeeSalesDetailDialog.vue`、`salary/page/SalaryEmployeesTab.vue`、`salary/page/SalaryMyRecordsTab.vue`、`salary/page/SalaryPayoutTab.vue`、`salary/page/SalarySalesDetailDialog.vue`、`salary/page/SalaryTemplatesTab.vue`、`sales/page/SalesBatchForm.vue`、`sales/page/SalesInventoryDetailDialog.vue`、`sales/page/SalesSummaryView.vue`、`sales/page/SalesTableView.vue`、`shared/SharedView.vue`、`subsidy/components/SubsidyListSection.vue`
- 供应商付款：`payments/SupplierPhonePaymentsView.vue`

### 4.2 公共组件文件（6）

- `components/ComprehensiveWarnings.vue`
- `components/ErrorManagement/ErrorDashboardSimple.vue`
- `components/MobileTable.vue`
- `components/PaginatedTable.vue`
- `components/query/SalesReceipt.vue`
- `components/stock-in/StockInPhoneListSection.vue`

`components/common/CustomerSearchDropdown.vue` 使用部分公共数据表格令牌保持搜索下拉的视觉一致，但自身不渲染表格，因此归入客户搜索规范，不计入本节表格组件数量。

## 5. 全局功能维度

页面台账不是只检查表格。每次功能修改必须根据任务勾选以下维度，并回看所有适用页面：

| 维度 | 统一入口/规范 | 必查对象 |
| --- | --- | --- |
| 页面结构、标题、Tab | `page-structure-standards.md`、`tab-standards.md` | 所有后台页、H5 管理页、含 Tab 的子页 |
| 表格、行高、字体、操作列 | `admin-table-standards.md`、`npm run check:tables` | 56 个页面承载单元、6 个表格组件 |
| 全局文字与排版 | `typography-standards.md`、`npm run check:typography` | 131 个页面源文件、74 个公共组件、全局样式 |
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

- H5 模板新增/编辑弹窗采用 `90%` 自适应宽度，复用公共桌面最大 `880px` 和响应式规则，已移除旧 `1240px` 声明和平板宽度覆盖；使用公共顶部关闭按钮，与“取消”共用未保存媒体清理流程，保存/上传期间禁止关闭。综合查询“商品详图”保留顶部关闭入口，底部仅保留上传和删除操作。

- `MobileDialog` 宽度统一按显式参数、全局档位、默认 880px 选择，库存入库显式 1240px 优先于默认值，`maxWidth` 独立限制上限，自适应百分比/视口宽度默认受公共 880px 上限约束（含综合查询素材管理）；客户详情及编辑按 `crud-dialog-lg` 使用 800px 档位。公共组件已移除默认内联宽度和重复断点计算，适用所有档位调用方；回归命令及浏览器/真机验证边界见 [对话框规范](dialog-standards.md)。

- 弹窗标题栏统一由 `_dialog.scss` 的 `--tf-dialog-header-height` 定义为 `50px`，PC、平板、手机共用；查询、库存、H5 发布及预定弹窗的旧高度/上下间距覆盖已删除。静态检查、浏览器测量和真机验收分别报告，不把规则接入视为逐页视觉验收完成。
- 页面清单统计：懒加载路由入口 65、叶子路由 62、视图源文件 130、公共组件 73。
- 表格逐页审计已完成：台账范围为 56 个页面承载单元、6 个公共表格组件；当前 56 个页面模板直接渲染表格，库存 `InventoryView.vue` 与 `InventoryTable.vue` 按承载关系共同纳入范围。当前模板实际包含 88 个 Element 表格和 54 个操作列，`npm run check:tables` 已逐文件通过。
- “审计通过”仅表示静态规则通过；文字溢出、触摸滚动、按钮位置、真实权限和云端 API 行为仍需按本台账进行浏览器/云端回归。
- 当前台账不把 `views` 目录下的每个文件都当作独立 URL；新增路由、Tab、弹窗和公共组件必须分别登记，防止重复计数或漏查。
- 按钮专项已完成零容忍迁移：2026-11-10 Vue 源码共扫描 `el-button=1047`（158 个文件）、原生 `<button>=0`；以后新增按钮必须使用 `el-button`，不得新增原生按钮例外。
- 页面按钮默认由公共入口控制 PC 与手机外观；H5 操作、筛选、权限选项、公开报价页头、扫码器和媒体缩略图已移除重复规格，特殊需求先定义公共语义再引用。图片删除/设主图、商家图标操作、登录注册及品牌筛选的模拟按钮迁移为 `el-button`；维修媒体预览和删除拆为独立公共按钮，保留原交互与权限。`check:buttons` 增加任意命名 class、断点、嵌套及行内覆盖检查，相关回归测试由同一命令执行；公共控件继续按已登记的专项规范维护，不新增页面豁免。
- Loading 已按本台账逐文件审计：131 个页面/功能单元、74 个公共组件和 1 个应用入口全部通过 `npm run check:loading`；扫描结果为 `GlobalLoading=1`、`v-tf-loading=48`、`TableLoadingRow=59`、`SectionLoading=41`、`InlineLoading=41`、登记 `v-loading` 例外 0 处。
- Loading 触发边界已收口：页面切换和明确的全局长操作由 `App.vue` 唯一挂载的 `GlobalLoading` 承载；表格刷新由 `v-tf-loading` 锁定表格边界并显示“加载数据中...”；局部状态通过 `useLoadingStore.hasLocalLoading/isGlobalVisible` 互斥仲裁，同一次操作不得同时显示全屏与局部 Loading。
- 徽章专项已按台账扫描全部页面和公共组件：徽章 hover 外包围线与过渡唯一由 `styles/components/_badges.scss` 控制；页面仅保留业务颜色、图标和文字，禁止私有 hover、阴影、位移和重复 `global.css` 状态入口。结果由 `npm run check:badges` 强制校验。
- 统一 API 已补齐默认 Loading：131 个页面及其公共功能单元不再依赖逐页传入 `showLoading: true`；首次数据请求默认进入全局 Loading，只有明确的 `showLoading: false` 请求保持静默。
- 全屏 Loading 例外仅保留 2 个已登记场景：规范页的真实演示，以及数据优化页的清理、批量合并和删除等明确长操作；数据优化页的表格查询仍使用局部 Loading，两类操作不能共用同一次反馈。
- 逐页核对结论已同步至 `global-loading-standard.md`：无专属 Loading 标记的布局、父级和公共功能单元均已注明统一 API 或父子组件承载关系；详情弹窗使用 `SectionLoading`，首屏和表格刷新不再叠加两层反馈。
- 仪表盘预警和待审批组件已接入根区域 `v-tf-loading`；提醒弹窗的后台轮询明确关闭 Loading，避免定时探测覆盖用户当前页面。
- 统计变化时，以路由文件和源文件实际扫描结果为准；文档中的数量和分组必须随代码变更同步更新。

## 8. 维护记录

| 日期 | 变更 | 结果 |
| --- | --- | --- |
| 2026-11-08 | T18 按全新构建 dts 与动态引用双零证据删除三个未接入局部组件，同步字段契约、动效/令牌基线与页面清单；公共组件候选因 dts 仍有声明而保留；所有数量按当前源码重新实测 | 页面源文件 131→128、非路由单元 69→66；公共组件本批未删除，实测 73 个。Vite 构建、完整 `check:standards`（含类型、84 项前端行为测试、严格 ESLint 与相关审计）通过；未执行浏览器/真机验收 |
| 2026-11-06 | 仪表盘公告默认按置顶优先、最新优先展示并支持前后切换；站内公告和 DH 公告支持图片/视频富文本，经验分享、公告编辑和展示统一复用 RichTextEditor/RichContent | 公共组件更新为 74；定向 ESLint、类型、UI、组件采用、权限、响应式、文字、令牌、动效、后端 413 项契约和文档审计通过；未执行浏览器/真机视觉验收，公告表结构迁移未执行 |
| 2026-11-06 | 系统设置站点信息 Tab 增加站内公告管理卡片，与 Logo/站点信息并列；仪表盘及手机端展示已发布公告 | `type-check`、定向 ESLint、权限、Loading、响应式、按钮、弹窗、字段、文字、令牌和文档审计通过；未执行浏览器/真机视觉验收，数据库迁移未执行 |
| 2026-11-04 | 完成剩余 29 个超长 Vue 样式块模块化；外置样式全部保持 `scoped`，并将重复按钮尺寸、表格结构、校验边框、搜索控件高度和 MobileDialog 安全区 padding 收敛到公共契约 | 超长 Vue 样式块从 29 个降至 0；29/29 编译后 CSS AST 等价；`!important` 从 1957 降至 1897，剩余项按 7 类运行时契约逐文件登记，未批准覆盖和非令牌颜色使用点均为 0。`check:release`、生产构建、38 项单测和 Bundle 门禁通过；未执行浏览器截图、真机或云端业务回归 |
| 2026-11-04 | 第四批样式模块化：后台管理壳、H5 商城首页、结算页、聚合商品详情和快速销售弹窗的 5 个超长内嵌样式按职责拆为 15 个局部 CSS/SCSS 模块；11 处跨契约强制覆盖迁移到精确外置文件登记 | 超长 Vue 样式块从 34 个降至 29 个；`!important` 保持 1957，未批准覆盖和非令牌颜色使用点均为 0。独立 Sass、完整 `check:release`、生产构建、38 项单测、严格 ESLint、类型、依赖安全、Bundle 和差异检查通过；未执行浏览器截图、真机或云端商城业务回归 |
| 2026-11-04 | 国补列表、库存结果弹窗、品牌、供应商和销售分析的超长内嵌样式按职责拆为 15 个局部 CSS/SCSS 模块；供应商拖拽状态改用明确级联，移除 3 处强制覆盖；同步迁移设计值、动效、打印和强制覆盖登记 | 超长 Vue 样式块从 39 个降至 34 个，`!important` 从 1960 降至 1957，未批准覆盖和非令牌颜色使用点均为 0；完整 `check:release`、生产构建、38 项单测、严格 ESLint、类型、依赖安全、Bundle 和差异检查通过。未执行浏览器截图、真机或云端业务回归 |
| 2026-11-02 | 重新扫描路由、页面、公共组件、按钮、表格和 Loading 覆盖，补登记销售凭证公共表格组件 | 65 个懒加载路由入口、62 个叶子路由、130 个页面/功能单元、71 个公共组件；56 个表格页面、6 个表格公共组件、92 个 Element 表格和 56 个操作列通过现行审计 |
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
| 2026-10-17 | 收口公共 TAB 最大宽度、隐藏左右箭头和原生横向滚动；修复 `/DH`、`/guide` 分类 Grid 被标签固有宽度撑大的问题 | 公共 TAB、令牌、响应式、样式债务和类型审计通过；`/DH` 使用模拟导航响应在 Chromium 360/390/479/768/1440px 验证双向滑动、切换及键盘可见性；后台仅核对承载布局，未执行真机或云端管理页面验收 |
| 2026-11-01 | 国补照片管理和申请统一接入 `MediaPreviewViewer`，缩略图查看/删除使用公共语义小圆按钮；正文上传工具栏复用 `.tf-dialog-toolbar`，全局 footer 尺寸别名归一并移除默认按钮的 large 覆盖；删除失效私有查看器样式，确认框层级统一高于媒体预览 | 完整 `check:standards`（含类型检查、Lint、按钮、弹窗和底部操作区审计）及文档检查通过；5 个相关 Vue 文件和公共/国补 SCSS 编译通过。未执行浏览器交互或真机视觉验收 |
| 2026-11-01 | 国补编辑销售价格与报价编辑采集价的人民币符号由外置 `prepend` 改为输入框内 `prefix`，复用公共边框和高度；金额前缀规范加入表单审计 | 全局 Vue 扫描未残留纯人民币符号的外置前置块；表单控件、视觉令牌、样式债务和文档检查通过，两个页面模板及脚本编译通过；未执行浏览器视觉验收 |
| 2026-11-01 | 国补新增申请删除普通输入框的私有灰/绿边框、已填写底色和阴影，清理父页面遗留的同类覆盖；统一使用公共控件边框与聚焦圈，并加入防回退审计 | 表单控件、视觉令牌、动效、样式债务、文档和定向 ESLint 检查通过；申请组件及父页面 SCSS 编译通过，未执行浏览器视觉验收 |
| 2026-11-01 | 国补新增申请移除检索结果区和底部重复的“重新搜索”，仅保留底部“搜索”按钮及输入框回车检索 | 组件 ESLint 与模板编译通过；检索重置函数继续用于关闭/重新打开申请时的状态初始化 |
| 2026-11-01 | 国补新增与编辑改用公共默认宽度 `--tf-dialog-width`（680px），移除父页面手机弹窗宽度、标题、间距私有覆盖；新增检索标题/说明间距使用公共 8px 令牌，说明与输入框间距使用公共 16px 令牌 | 弹窗、底部按钮、统一 UI、响应式、视觉令牌、样式债务和类型检查通过；公共及国补组件编译通过。未执行浏览器或真机视觉验收 |
| 2026-11-01 | 综合查询与库存管理手机端行双击统一接入全局 `v-table-double-tap`，直接识别同一行两次轻触，移除两页重复的点击计时 Map；排除滑动、滚动、长按、多指和操作按钮，保留电脑端原生双击 | 17 项触摸事件逻辑模拟、完整 `check:standards`（含类型检查、Lint、表格及运行时模式）和文档检查通过；公共注册、参考页面接入及旧私有逻辑防回退已纳入 `check:tables`。未执行浏览器或 iOS/Android 真机验收 |
| 2026-11-01 | 综合查询快速出库扫码补传所选品牌名称，统一复用 Apple 包装序列号 `S` 字段标识识别；采购入库原有品牌传递保留，所有扫码器使用点显式绑定 `phone` 纳入组件采用率审计 | 12 项品牌切换、序列号及 IMEI 逻辑回归和组件采用率审计通过；未选择品牌、其他品牌及明确 SN 标签不误删首字母，未执行摄像头真机验收 |
| 2026-11-01 | 手机端双击弹窗防穿透：确认双击时取消兼容点击并拦截随后重复的原生双击；公共 `MobileDialog` 遮罩须完成同一次按下/抬起才可关闭，标题、正文、底部开始的操作及拖动不关闭 | 26 项触摸及遮罩事件逻辑回归通过，表格和弹窗防回退审计已补充；无临时测试文件，未执行浏览器或 iOS/Android 真机验收 |
| 2026-11-02 | 综合查询共用手机编辑接口在销售日期变更时按新日期和交易类型重新生成单号；同日保存不换号，日期/类型同时变更只生成一次，历史缺号复用公共序列；修正销售联动更新误用手机 ID 的关联问题 | 16 项专项模拟测试在 `Asia/Shanghai` 与 `UTC` 环境均通过；扩展合同检查 115 项中 113 项通过，现有国补字段可见性、打款操作列两项权限断言失败，未修改对应页面或放宽断言；未连接或修改云端数据库 |
| 2026-11-02 | 单据公共分配改为按日期/类型优先补最小空号，其他已有单据不重排；综合查询编辑/快速出库、销售单台/批量、批发、划拨、租赁买断和缺号回填统一接入事务预检及预留；兼容销售服务修正分配后提前释放连接的问题，日期键复用公共北京时间入口；实际台数继续按记录统计 | 44 项专项模拟检查在 `Asia/Shanghai`、`UTC`、`America/Los_Angeles` 均通过，覆盖补空号、改期、批量及并发预留、提交/回滚、保存点、连接复用和日期边界；扩展合同检查 143 项中 142 项通过，供应商打款操作列存在一项既有权限断言失败，未放宽断言；15 个 JS 文件语法、定向 ESLint、后端安全及文档链接检查通过；未连接或写入云端业务库，未执行真实 MySQL 并发验收 |
| 2026-11-02 | 待办提醒页提取唯一领域类型，清除列表、详情、执行记录、接收人、表单和错误处理中的 26 处显式 `any`；统一 API 响应增加 `summary` 泛型 | 页面显式 `any` 为 0；TypeScript、定向 ESLint 和运行时模式防回退审计通过，页面权限、Loading、响应式与后端接口行为保持不变 |
| 2026-11-02 | 经验分享页删除重复的附件、作者、文章、分类类型，统一迁移到 `types/shared.ts`；富文本编辑器、上传、分类及文章请求清除 23 处显式 `any` | 页面显式 `any` 为 0；TypeScript 与运行时模式防回退审计通过，私有附件鉴权、字段权限、响应式和富文本净化逻辑保持不变 |
| 2026-11-05 | 工资页销售明细和员工销售明细弹窗的顶部统计在手机及 iPad 调整为每行两项，保留桌面布局；数值允许在窄卡片内换行 | 定向检查响应式断点、类型与 ESLint；浏览器视口实测结果以本次任务交付说明为准 |
| 2026-11-05 | 全局 `Pagination` 统一收紧底部间距、将每页条数提示简化为“每页”、移除页码省略号并收窄跳页输入框；所有复用公共组件的页面同步生效 | 类型检查、分页 UI 审计、规范清单/文档检查及前端构建；真实页面视口验收以任务交付说明为准 |
| 2026-11-05 | `/customers` 客户编辑表单使用公共 `CitySelector` 提供省、市、县/区三级联动；县/区与详细地址兼容写入现有 `address` 字段，字段查看/编辑权限继续分别控制，省市县选择器不再复制 Element Plus 外观 | `city-selector.spec.ts`、`region-options.spec.ts` 共 11 项通过；类型检查、表单控件/令牌/响应式审计及定向 ESLint 通过；乡镇/村级未接入，地区源版本和云端客户数据未作线上验收 |
