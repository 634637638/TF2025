# TF2025 全局 TAB 统一规范

## 适用范围

本规范适用于 Vue 3 后台页面中的顶层和内部标签导航。支付方式、单选分段控件、富文本工具栏等业务选择控件不属于页面 TAB，不使用页面 TAB 的容器和导航行为。

## 唯一控制入口

TAB 的尺寸、颜色、圆角、间距、选中态、悬停态和手机布局只允许在以下文件维护：

- `frontend/src/styles/components/_tabs.scss`

横向滚动行为统一由 `frontend/src/utils/page-tab-scroll.ts` 实现，`main.ts` 在挂载后通过已有业务路由初始化入口按需加载，首次进入非登录页面时统一初始化一次。页面不得重复注册滚轮事件或另建 TAB 位移逻辑。

该文件由 `frontend/src/styles.scss` 全局加载。业务页面不得定义 `.tab-navigation`、`.tf-page-tabs`、`.tf-tab-content`、`.tf-tab-panel`、`.el-tabs__header`、`.el-tabs__content`、`.el-tabs__item`、`.el-tabs__nav*` 或 `.el-tabs__active-bar` 的视觉样式。

## 使用方式

Element Plus TAB：

```vue
<el-tabs v-model="activeTab" class="tf-page-tabs">
  <el-tab-pane label="列表" name="list" class="tf-tab-panel" />
  <el-tab-pane label="设置" name="settings" class="tf-tab-panel" />
</el-tabs>
```

按钮型 TAB：

```vue
<div class="tab-navigation tf-page-tabs">
  <el-button :type="activeTab === 'list' ? 'primary' : 'default'">列表</el-button>
  <el-button :type="activeTab === 'settings' ? 'primary' : 'default'">设置</el-button>
</div>
<div class="tf-tab-content">
  <div v-if="activeTab === 'list'" class="tf-tab-panel">...</div>
  <div v-else class="tf-tab-panel">...</div>
</div>
```

页面只负责 TAB 名称、图标、权限显隐、当前值和切换逻辑。

## 状态选择器的共享视觉

业务互斥选择仍使用原生语义控件（`el-radio-group`），但必须接入全局 `.tf-state-selector`；不能伪装成页面导航，也不使用 `.tf-page-tabs`。按钮式选项使用 `el-radio-button`，普通表单单选仍可使用 `el-radio`，两者都由同一个入口统一布局、字号、选中主色和禁用态；按钮式选项额外读取同一组 `--tf-tabs-*` / `--tf-tab-*` 令牌。不再使用裸 `el-radio-group`、`el-segmented` 或页面私有分段皮肤。该样式只规范外观，不改变单选值、权限或业务行为；页面不得另写按钮样式。

```vue
<el-radio-group v-model="state" class="tf-state-selector" aria-label="字段状态">
  <el-radio-button value="hidden">隐藏</el-radio-button>
  <el-radio-button value="readonly">只读</el-radio-button>
  <el-radio-button value="editable">编辑</el-radio-button>
</el-radio-group>
```

`/DH` 和 `/guide` 的分类导航使用 `tf-page-tabs`。公开页 `/DH` 同时使用公共 `tf-page-tabs--transparent`，将导航外层设为透明并移除外层边框和阴影。单个标签继续使用公共状态样式。页面私有的 `mode-tabs`、`lexicon-tabs` 等类仅用于布局定位。

工具栏和列表标题旁的 TAB 可使用 `tf-page-tabs--inline`。该公共修饰类取消页面级底部间距。按钮型 TAB 按内容收宽，使用透明容器，外层省去边框和阴影，各按钮继续使用公共尺寸、边框及选中态。列表标题、页签和记录数在空间不足时可以换行，页签自身保持单行。

## 统一表现

- PC 端单行展示，高度、内边距和间距读取 `_tabs.scss` 变量。
- 页面 TAB 在 PC 和平板使用公共小按钮规格。手机端（不超过 767px）与[紧凑按钮](button-standards.md#普通命令按钮)共用尺寸令牌，按钮高度 28px、左右内边距各 6px、字号 12px、按钮间距 4px，页签栏内边距为 2px。按钮宽度随内容变化。
- 手机端仍保持单行，通过横向滑动查看超出项目，不允许改为两列或多行。
- TAB 外层和导航头必须使用 `min-width: 0`、`max-width: 100%` 和 `border-box`，最大宽度取父容器可用宽度。承载 TAB 的 Flex/Grid 布局也必须允许收缩，Grid 轨道使用 `minmax(0, 1fr)` 或为对应子项设置 `min-width: 0`，禁止由标签内容的固有宽度撑大卡片。
- Element Plus、按钮型 TAB 和桌面页头标签在栏内原生横向滚动，统一隐藏底部滚动条、左右切换箭头及箭头占位。手机保留横向触摸与从 TAB 区开始的纵向滑动，PC 支持触控板和滚轮。横滑到首尾时取消边缘回弹，页面底部也取消文档回弹。
- 同时承载业务动作和视图切换的工具栏通过 `tf-compact-toolbar` 共用横向滚动样式及滚轮处理。按钮尺寸由[紧凑按钮](button-standards.md#普通命令按钮)统一提供。
- 公共样式禁止框架的内联 `transform` 与原生 `scrollLeft` 叠加。Element Plus 和桌面页头的选中项在切换和栏宽变化后自动进入可视范围，避免滚动整个页面。
- 普通导航容器使用全局浅灰蓝背景。未选中项使用浅色背景、独立细边框和轻阴影。
- 选中项使用全局主色实底、同色边框和强调阴影；悬停项使用白色背景并加深边框，三种状态必须能被快速区分。
- Element Plus 和按钮型 TAB 共用默认容器样式、按钮高度、字号、圆角和响应式规则。
- 后台桌面页头标签栏（`TabsBar.vue`）使用 `.tf-topbar-tabs` 和 `.tf-topbar-tab`，共用页面 TAB 的高度、水平内边距、字号和状态令牌。选中项使用主色实底，关闭图标保留在标签内。
- TAB 内容区统一使用 `tf-tab-content` 和 `tf-tab-panel`，宽度固定为 `100%`、`min-width: 0`，不允许页面自行添加左右内边距。
- 内容块之间仅使用 `--admin-panel-gap`。当 TAB 导航和内容位于 `admin-page-content` 中时，由父容器提供间距，不叠加 TAB 底部外边距。
- 独立后台页面嵌入 TAB 后自动取消第二层页面级内边距，页面只能存在一层 `admin-page` 左右和顶部间距。
- PC 端保留稳定的滚动条占位，切换不同高度的 TAB 时页面宽度不得左右跳动。
- 统计卡片、搜索面板和表格面板的外边缘应处于同一内容宽度；卡片内部间距仍由各自的公共面板规范控制。

## 禁止项

- 页面内重新定义 TAB 高度、字号、颜色、圆角、阴影或内边距。
- 在手机端使用 `flex-wrap` 将 TAB 改为两行或两列。
- 恢复 TAB 左右箭头、可见滚动条或箭头占位，或用卡片根节点 `overflow: hidden` 掩盖宽度溢出。
- 为某个页面复制一套 `.el-tabs__item` 或 `.tab-navigation .el-button` 样式。
- 页面内定义 `.tf-tab-content`、`.tf-tab-panel` 或 `.el-tabs__content` 的宽度、边距和内边距。
- 在 TAB 中嵌套第二层带页面内边距的 `admin-page`，造成卡片、搜索和表格逐级缩进。
- 使用页面私有渐变、胶囊圆角或吸顶效果覆盖全局 TAB。
- 新增未接入 `.tf-page-tabs` 的 `el-tabs` 或 `.tab-navigation`，或未接入 `.tf-tab-panel` 的 `el-tab-pane`。

## 自动审计

修改或新增 TAB 后执行：

```bash
cd frontend
npm run check:tabs
```

审计扫描 Vue 模板、内联样式及独立 CSS/SCSS。Element Plus 标签、带 `role="tablist"` 的标签栏和混合操作工具栏须接入公共类。页面通过公共类使用滚动规则，禁止为标签栏另写滚动条、回弹、滚轮事件和尺寸样式。审计校验公共入口保留横滑、隐藏滚动条及箭头、关闭横向边缘和文档底部回弹，并在同一命令运行正反例。隔离浏览器回归使用 `npm --prefix frontend run test:topbar:browser`，按[视觉回归清单](visual-regression-checklist.md#全局-tab-滚动)检查首尾、正文滚动及页面底部。

公共入口导入检查使用 TypeScript AST，允许真实静态或动态导入，不把注释、字符串或纯类型引用计作运行时接入。正反例回归为 `frontend/scripts/runtime-module-import.test.mjs`，随 `check:tables` 执行。
