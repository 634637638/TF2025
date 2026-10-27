# TF2025 全局 TAB 统一规范

## 适用范围

本规范适用于 Vue 3 后台页面中的顶层和内部标签导航。支付方式、单选分段控件、富文本工具栏等业务选择控件不属于页面 TAB，不使用本规范。

## 唯一控制入口

TAB 的尺寸、颜色、圆角、间距、选中态、悬停态和手机布局只允许在以下文件维护：

- `frontend/src/styles/components/_tabs.scss`

横向滚动行为统一由 `frontend/src/utils/page-tab-scroll.ts` 实现，`main.ts` 在挂载后初始化一次。页面不得重复注册滚轮事件或另建 TAB 位移逻辑。

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

密集型分类导航使用公共修饰类：

```vue
<el-tabs v-model="activeCategory" class="tf-page-tabs tf-page-tabs--compact">
  <el-tab-pane label="分类" name="category" class="tf-tab-panel" />
</el-tabs>
```

`tf-page-tabs--compact` 适用于 `/DH` 和 `/guide` 的分类导航，也可供其他确实需要紧凑展示的 TAB 复用。业务页面不得复制这个类的样式，也不得自行覆盖其 CSS 变量；页面私有的 `mode-tabs`、`lexicon-tabs` 等类只能负责布局位置，不得控制 TAB 的高度、字号、内边距、颜色、圆角或阴影。

## 统一表现

- PC 端单行展示，高度、内边距和间距读取 `_tabs.scss` 变量。
- 所有页面 TAB 默认复用表格操作小按钮规格：PC 高度为 `--tf-button-height-small`（当前 `28px`），手机端随公共小按钮令牌自适应（当前约 `30~32px`）；字号和水平内边距同步读取对应公共令牌。页面不得恢复更大的默认 TAB。
- 手机端仍保持单行，通过横向滑动查看超出项目，不允许改为两列或多行。
- TAB 外层和导航头必须使用 `min-width: 0`、`max-width: 100%` 和 `border-box`，最大宽度取父容器可用宽度。承载 TAB 的 Flex/Grid 布局也必须允许收缩，Grid 轨道使用 `minmax(0, 1fr)` 或为对应子项设置 `min-width: 0`，禁止由标签内容的固有宽度撑大卡片。
- 超出宽度时只在 TAB 栏内部横向滚动，隐藏滚动条及左右切换箭头，并移除箭头占位；手机使用原生触摸滑动，PC 使用触控板或滚轮。公共样式禁止框架的内联 `transform` 与原生 `scrollLeft` 叠加；公共滚动工具负责选中项、键盘切换和窗口缩放后的可见性，不能通过裁切内容冒充滚动。
- 导航容器使用全局浅灰蓝背景，与白色内容卡片形成轻度层次；每个未选中项必须使用浅色背景、独立细边框和轻阴影，避免多个 TAB 视觉粘连。
- 选中项使用全局主色实底、同色边框和强调阴影；悬停项使用白色背景并加深边框，三种状态必须能被快速区分。
- Element Plus 和按钮型 TAB 使用相同的容器、按钮高度、字号、圆角和响应式规则。
- 密集型分类导航可以在统一 `tf-page-tabs` 上增加公共修饰类 `tf-page-tabs--compact`，其高度、字号和内边距全部复用 `--tf-button-height-small`、`--tf-button-padding-x-small` 与 `--tf-button-font-size-small`；该修饰类只用于 `/DH` 等分类导航，不得在页面内重新定义尺寸变量。
- 页头标签栏（`TabsBar.vue`）使用 `.tf-topbar-tabs` 和 `.tf-topbar-tab` 变体，共享本文件的未选中、悬停和选中令牌；尺寸复用公共操作按钮的小规格，PC 高度为 `--tf-button-height-small`（当前 `28px`），手机端跟随小按钮令牌自适应（当前 `30~32px`），内边距和字号也复用对应小按钮令牌。选中项使用主色实底，不再通过页面私有底部线条单独表达。标签关闭图标仍保留在标签内部，不能另建一套颜色规则。
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

审计会检查所有 Vue 文件，阻止未接入公共导航/内容类、缺少统一内容容器，以及页面级 TAB 视觉和宽度间距覆盖；同时校验公共宽度约束、隐藏箭头、单一原生滚动位移和统一行为初始化。视觉验收须从 `360px` 开始，滑动到末尾并切换标签后再滑回首项，确认卡片宽度不变、首尾标签均可访问。
