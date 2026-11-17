# TF2025 前端规范审计接入指南

## 目标

规范文档用于说明正确做法，公共组件和全局样式用于提供正确实现，审计脚本用于阻止页面绕开规范。三者必须同时存在，才能做到“不符合规范就不能通过构建和发布检查”。日常启动不运行全量审计；已修复问题的正式回归检查仍须保留。

页面生命周期也属于审计范围。新增、维护、拆分、合并或迁移路由、页面、Tab、弹窗或公共组件时，必须同步登记[前端页面与功能单元台账](page-audit-inventory.md)，并完成页面动作权限和字段权限的登记、前后端运行时接入及对应契约/行为测试；字段登记、前端三态控制或后端字段脱敏/拒写缺任一项时，页面变更不视为完成。删除、改名、迁移或合并后，必须在同一变更中移除或更新页面、字段、权限映射和文档链接。代码、字段清单、权限能力清单与台账不一致时，页面变更不视为完成。

## 可视化入口

登录后台后访问 `/standards` 打开“规范与审计”。页面按页面与布局、视觉与组件、数据与表格、搜索与表单、反馈与交互、权限与安全、运行时与性能七类独立展示每份规范，提供关键要求、可交互效果预览、正文文件、公共实现入口和可执行审计命令。按钮、弹窗、表格、搜索、表单、Loading、空状态、通知、权限、运行时和页面结构预览都必须有对应的点击、切换、提交、展开或状态反馈，不能只显示静态标签。该页面是查阅和审计管理入口，不替代 `docs/frontend/*.md` 正文；正文、`standards-manifest.json` 和页面台账仍是唯一权威来源。

新增规范必须先编写正文，再登记 manifest、审计命令、公共实现和分类；删除或合并规范时必须同步更新页面分类、索引、manifest 和审计覆盖，禁止只在可视化页面保留孤立条目。

## 当前统一命令

配置按所属端存放：字段契约与后端安全/架构台账位于 `backend/scripts/config/`，前端运行时与公共选项审计配置位于 `frontend/scripts/`。项目根目录不设置 `config/`；移动配置时同步检查器、正式测试、manifest 和文档。架构基线比较必须保留迁移前 Git 版本的读取能力，不能因历史路径变化跳过比较或重建基线。

在项目根目录执行：

```bash
npm run check:standards
```

该命令首先运行规范覆盖审计，再运行 `check:docs`（根 AI 指令链接、文档导航、标记 TS/Vue 示例编译及已登记的规范冲突检查），随后执行时间工具、交互、表单控件、公共组件采用率、类型检查、后端安全、运行时模式、样式债务、字段一致性、Lint、权限、统一 UI 结构、TAB、按钮、表格、加载动画、空状态、数据实时性和支付方式审计。任意一项失败都会返回非零退出码，并阻断依赖该门禁的构建或发布检查。检查器自身修改时另执行根目录 `npm run test:docs`，日常启动不运行这些审计和负例测试。

时间工具审计可单独运行：

```bash
cd frontend
npm run check:time
```

`check:time` 检查业务代码是否重复直接定义日期格式、调用浏览器日期本地化 API，或把日期-only 值误当作 ISO 时间。`Date.now()` 在缓存、性能、手势、限流和请求去重等技术计时场景仍然允许；时间处理边界见[全局时间工具与日期格式规范](./time-standards.md)。

空状态审计可单独运行：

```bash
cd frontend
npm run check:empty-states
```

业务页面和业务组件禁止直接使用 `el-empty`，统一通过 `DataEmptyState` 展示；`PaginatedTable` 和 `MobileTable` 也必须保持接入公共空状态。具体状态边界见 [全局空状态统一规范](./empty-state-standard.md)。

`docs/frontend/standards-manifest.json` 是强制规范清单。每份统一规范必须登记至少一个审计命令和对应公共实现入口；新增名称包含 `standard`、`standards` 或 `unified-page-structure` 的权威文档后，如果没有同步登记审计，`check:coverage` 会直接失败。清单引用的审计命令未加入 `check:standards`、公共实现文件不存在或文档被误删，也会失败。

标杆页的交互完整性由 `check:standards-preview` 审计。按钮、弹窗、表格、搜索、表单、Loading、空状态、通知、权限、运行时和页面结构预览都必须保留真实交互入口；只显示静态示例不视为完成。

`docs/frontend` 是当前唯一权威强制规范目录。`docs/standards`、`docs/components` 和 `docs/guides` 中同名或早期规范属于历史/专题参考；内容冲突时必须以 `docs/frontend` 及清单映射为准，不允许从参考文档复制第二套公共样式或绕开审计。需要把参考规则升级为强制要求时，必须先迁入或合并到 `docs/frontend`，登记公共实现和审计命令后再生效。

统一 UI 结构审计可单独运行：

```bash
cd frontend
npm run check:ui
```

`check:ui` 检查 Dialog 公共正文与 footer 入口、统一搜索根组件、公共分页组件、后台页面根结构和页面私有公共选择器覆盖。页面直接使用 `el-pagination`、覆盖 `.unified-search-panel` / `.tf-pagination` / `.tf-dialog-actions`，或使用 `PageHeader` 却没有 `admin-page` 与 `admin-page-content`，都会失败。

公共组件采用率审计可单独运行：

```bash
cd frontend
npm run check:component-adoption
```

`check:component-adoption` 登记原生 `button` 的公共实现和专用控件例外，并检查 `DataEmptyState`、`UnifiedSearchPanel`、`Pagination`、`MobileDialog` 和加载组件入口存在。后台普通命令按钮、新增列表搜索和新增分页不得绕开对应公共入口。

弹窗采用率审计可单独运行：

```bash
cd frontend
npm run check:dialogs
```

`check:dialogs` 禁止业务直接使用 `el-dialog`，统一采用 `MobileDialog`；同时扫描 Vue/TS/JS 中公共确认调用的静态文案，禁止取消或关闭表单时弹出未保存/未提交确认。动态文案和业务交互仍须正式行为测试，边界见[对话框规范](dialog-standards.md)。

表格审计也可单独运行：

```bash
cd frontend
npm run check:tables
```

`check:tables` 扫描全部 Vue 页面并强制要求：所有 Element 表格接入 `.data-table` / `.admin-data-table`；主列表操作列使用 `.actions-column`、公共动态宽度、公共按钮容器、文字按钮和 `@click.stop`；禁止数字固定宽度、固定右侧列和页面私有 `.actions-column` 样式。弹窗纯图标工具列只能显式使用 `compact-action-column`。审计还会验证公共表格颜色、字体、行高、圆角、内容完整展示、Element 根节点不超过容器、内部唯一横向滚动层、表头同步，以及表头/表体 PC 鼠标拖动入口没有被删除，并禁止页面重定义公共表格变量或通用视觉。

按钮颜色审计也可单独运行：

```bash
cd frontend
npm run check:buttons
```

`check:buttons` 强制所有页面按操作后果声明 `primary`、`success`、`warning`、`danger`、`view`、`manage`、`finance`、`transfer`、`export` 或 `neutral` 语义。实际色值只能由 `styles/components/_buttons.scss` 定义；业务页面和表格、模态框、Tab 等公共布局文件只能读取 `--tf-button-*`，直接颜色、行内颜色和第二套兼容色板都会使审计失败。

日常开发入口直接启动服务，不自动执行全量审计：

```bash
# 根目录一键启动前后端
npm run dev
npm start

# 单独启动前端
cd frontend
npm run dev
npm start

```

`frontend:raw` 和 `frontend/dev:server` 继续供一键启动编排复用。HTTPS 入口也复用日常 `dev`，仍须校验证书，但不运行全量审计。后端的必要配置、运行时资源及单实例安全检查不受影响。

以下入口保留完整门禁：

```bash
# 根目录手动审计
npm run check:standards

# 前端构建及发布前检查
npm --prefix frontend run build
npm --prefix frontend run build:debug
npm --prefix frontend run check:release
```

`check:coverage` 同时运行隔离的 npm 生命周期回归，验证日常启动不触发审计、构建及发布遇到审计失败会被阻断、服务参数和失败退出码正常传递。测试使用服务和审计替身，不占用真实端口或连接业务数据库。不能因为日常启动成功就把构建、类型或生产验收描述为通过。

## 新增一项规范审计

新增例如“模态框统一审计”时，按以下顺序实施：

1. 在 `docs/frontend/` 编写规范，明确适用范围、唯一公共入口、允许项和禁止项。
2. 在公共组件或 `frontend/src/styles/components/` 中实现统一结构和视觉。
3. 将现有页面迁移到公共实现，并删除重复、冗余和冲突的页面级代码。
4. 在 `frontend/scripts/` 新增 `check-*.mjs`，扫描必须使用的公共 class、组件或 API，并检测禁止的页面级覆盖。
5. 在 `frontend/package.json` 增加独立命令，例如：

```json
"check:dialogs": "node scripts/check-dialog-styles.mjs"
```

6. 将新命令追加到 `check:standards`：

```json
"check:standards": "npm run check:tabs && npm run check:buttons && npm run check:dialogs"
```

7. 准备一个合规样例和一个违规样例，确认合规代码退出码为 `0`、违规代码退出码为 `1`，最后执行生产构建。

## 审计脚本设计要求

- 错误必须包含文件路径、行号和具体违规原因。
- 只检查能够明确判定的规则，不能用宽泛关键词误伤业务代码。
- 公共样式文件使用明确允许列表，业务页面不得加入允许列表绕过检查。
- 特殊业务控件必须使用独立语义 class，并在规范中说明为什么不属于公共规则。
- 新增规则不能只检查新页面，必须扫描整个 `frontend/src`。

## 审计边界

静态审计适合检查公共组件接入、禁止的 CSS 覆盖、错误 API 调用和重复实现。它不能可靠判断遮挡、文字溢出、真实触摸滑动和视觉效果；这些仍需要浏览器在手机及 PC 视口下验证。
