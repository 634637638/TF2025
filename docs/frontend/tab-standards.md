# TF2025 全局 TAB 统一规范

## 适用范围

本规范适用于 Vue 3 后台页面中的顶层和内部标签导航。支付方式、单选分段控件、富文本工具栏等业务选择控件不属于页面 TAB，不使用本规范。

## 唯一控制入口

TAB 的尺寸、颜色、圆角、间距、选中态、悬停态和手机布局只允许在以下文件维护：

- `frontend/src/styles/components/_tabs.scss`

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

## 统一表现

- PC 端单行展示，高度、内边距和间距读取 `_tabs.scss` 变量。
- 手机端仍保持单行，通过横向滑动查看超出项目，不允许改为两列或多行。
- 导航容器使用全局浅灰蓝背景，与白色内容卡片形成轻度层次；选中项使用全局主色和轻阴影，未选中项使用中性色，悬停态使用白色背景。
- Element Plus 和按钮型 TAB 使用相同的容器、按钮高度、字号、圆角和响应式规则。
- TAB 内容区统一使用 `tf-tab-content` 和 `tf-tab-panel`，宽度固定为 `100%`、`min-width: 0`，不允许页面自行添加左右内边距。
- 内容块之间仅使用 `--admin-panel-gap`。当 TAB 导航和内容位于 `admin-page-content` 中时，由父容器提供间距，不叠加 TAB 底部外边距。
- 独立后台页面嵌入 TAB 后自动取消第二层页面级内边距，页面只能存在一层 `admin-page` 左右和顶部间距。
- PC 端保留稳定的滚动条占位，切换不同高度的 TAB 时页面宽度不得左右跳动。
- 统计卡片、搜索面板和表格面板的外边缘应处于同一内容宽度；卡片内部间距仍由各自的公共面板规范控制。

## 禁止项

- 页面内重新定义 TAB 高度、字号、颜色、圆角、阴影或内边距。
- 在手机端使用 `flex-wrap` 将 TAB 改为两行或两列。
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

审计会检查所有 Vue 文件，阻止未接入公共导航/内容类、缺少统一内容容器，以及页面级 TAB 视觉和宽度间距覆盖。
