# TF2025 前端规范审计接入指南

## 目标

规范文档用于说明正确做法，公共组件和全局样式用于提供正确实现，审计脚本用于阻止页面绕开规范。三者必须同时存在，才能做到“不符合规范就不能启动或构建”。

## 当前统一命令

在项目根目录执行：

```bash
npm run check:standards
```

该命令首先运行规范覆盖审计，再依次运行统一 UI 结构、TAB、按钮、表格、加载动画和数据实时性审计。任意一项失败都会返回非零退出码，并停止后续启动或构建。

`docs/frontend/standards-manifest.json` 是强制规范清单。每份统一规范必须登记至少一个审计命令和对应公共实现入口；新增名称包含 `standard`、`standards` 或 `unified-page-structure` 的权威文档后，如果没有同步登记审计，`check:coverage` 会直接失败。清单引用的审计命令未加入 `check:standards`、公共实现文件不存在或文档被误删，也会失败。

`docs/frontend` 是当前唯一权威强制规范目录。`docs/standards`、`docs/components` 和 `docs/guides` 中同名或早期规范属于历史/专题参考；内容冲突时必须以 `docs/frontend` 及清单映射为准，不允许从参考文档复制第二套公共样式或绕开审计。需要把参考规则升级为强制要求时，必须先迁入或合并到 `docs/frontend`，登记公共实现和审计命令后再生效。

统一 UI 结构审计可单独运行：

```bash
cd frontend
npm run check:ui
```

`check:ui` 检查 Dialog 公共正文与 footer 入口、统一搜索根组件、公共分页组件、后台页面根结构和页面私有公共选择器覆盖。页面直接使用 `el-pagination`、覆盖 `.unified-search-panel` / `.tf-pagination` / `.tf-dialog-actions`，或使用 `PageHeader` 却没有 `admin-page` 与 `admin-page-content`，都会失败。

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

以下入口已自动执行审计：

```bash
# 根目录一键启动前后端
npm run dev
npm start

# 单独启动前端
cd frontend
npm run dev
npm start

# 前端构建
npm run build
npm run build:debug
```

`frontend:raw` 和 `frontend/dev:server` 是一键启动内部使用的无重复审计入口，不作为日常开发命令。

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
