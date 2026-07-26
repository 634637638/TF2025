# TF2025 全局按钮统一规范

## 目标和适用范围

本规范适用于 Vue 3 前端的页面工具栏、搜索区、表格和卡片操作、手机展开操作、模态框底部、确认提示框及旧版原生 `button.btn`。业务页面只决定按钮是否显示、按钮文字、图标和点击行为，不再自行决定普通命令按钮的颜色、尺寸、圆角或悬停效果。

富文本工具栏、颜色色板、关闭图标、拖动手柄等专用工具控件可以使用独立样式，但必须使用明确的专用 class，不能覆盖 `.el-button`、`.btn` 或已有语义 class。

## 唯一控制入口

| 文件 | 职责 |
|---|---|
| `frontend/src/styles/components/_buttons.scss` | 普通按钮尺寸、状态、语义颜色、页头、搜索区、分段 Tab、颜色选择器 |
| `frontend/src/styles/components/_table.scss` | 表格、列表卡片、手机展开区的紧凑操作按钮 |
| `frontend/src/styles/components/_dialog-actions.scss` | 模态框底部和 MessageBox 按钮布局 |
| `frontend/src/styles/admin-layout.css` | 表格操作按钮的颜色、尺寸变量 |

上述文件由全局入口加载。业务组件不得再次 `@use` 一套按钮主题，也不得在 `<style scoped>` 中复制按钮样式。

## 普通命令按钮

PC 默认值：

- 高度 `36px`；
- 小按钮 `28px`，大按钮 `44px`；
- 字号 `14px`，小按钮 `13px`；
- 水平内边距 `16px`，圆角 `6px`；
- 宽度按文字内容自适应，不设置统一固定宽度。

手机端 `768px` 及以下：

- 普通按钮高度在 `34px` 至 `36px` 范围内随可用屏宽自适应；
- 小按钮高度在 `30px` 至 `32px` 范围内自适应；
- 横向内边距随屏宽在规定范围内自动收缩，字号使用移动端统一值，避免窄屏按钮挤压、移位或溢出；
- 普通页面按钮宽度按内容自适应，搜索区等公共容器可让输入区自动占用按钮之外的剩余空间；
- 模态框底部按钮仍按可用空间等分并保持一行，其触控高度由模态框公共规则单独保证；
- 页面不得另设按钮高度、字体或固定宽度。

顶部页头操作区和公共检索区使用独立的紧凑工具栏规格：PC 高度 `34px`；手机端高度在 `28px` 至 `30px` 间自适应，水平内边距在 `5px` 至 `7px` 间自适应。公共检索输入框、下拉框、日期框及搜索/重置按钮统一使用 `--tf-search-control-height`，控件外层、wrapper 和 inner 必须同高，关键词输入区占用剩余宽度。手机页头恰好有四个操作时，按钮共同收缩并等分操作区，确保四个都完整可见；操作更多时以横向浏览作为兜底，溢出内容必须从左侧可见，不得用固定大按钮挤压或遮挡相邻内容。该规则由 `_buttons.scss`、`PageHeader.vue` 和 `UnifiedSearchPanel.vue` 公共组件共同实现，业务页面不得覆盖。

主应用最顶部栏使用 `.tf-button--topbar` 规格：PC 高度 `40px`，手机端跟随普通按钮的 `34px` 至 `36px` 自适应高度。顶部用户信息卡等相邻控件必须使用同一个 `--tf-topbar-control-height` 变量，确保与锁屏、退出登录等按钮等高。顶部按钮容器使用专用名称（当前为 `.topbar-buttons`），不得使用保留给表格操作区的 `.action-buttons`，否则会被全局表格规则压缩为紧凑按钮。

推荐 Element Plus，并使用语义类型或公共 class：

| 功能 | Element 类型/公共 class | 语义 |
|---|---|---|
| 新增、保存、确认 | `type="primary"`、`tf-button--save` | 主操作蓝色 |
| 完成、启用、通过 | `type="success"`、`tf-button--complete` | 成功绿色 |
| 停用、拒绝、撤销 | `type="warning"`、`tf-button--warning` | 警示琥珀色 |
| 删除、移除 | `type="danger"`、`tf-button--delete` | 危险红色 |
| 查看 | `type="info"`、`tf-button--view` | 信息青色 |
| 权限、配置、管理 | `tf-button--manage` | 管理靛蓝色 |
| 打款、付款、结算 | `tf-button--finance` | 财务青绿色 |
| 入库、出库、调货 | `tf-button--transfer` | 库存紫色 |
| 导出、下载、同步 | `tf-button--export` | 工具蓝色 |
| 取消、关闭、重置 | 默认按钮、`tf-button--neutral` | 中性白灰色 |

旧页面的 `.btn-primary`、`.btn-success`、`.btn-warning`、`.btn-danger`、`.btn-info`、`.btn-secondary` 及 outline 变体由全局兼容，但新增代码不得为这些 class 再写颜色。

## 表格和卡片操作

表格和列表卡片的操作容器统一使用 `.action-buttons`。该类名专用于紧凑数据操作，不得用于应用顶部栏、页面工具栏或普通表单。手机行展开可以使用 `.mobile-row-actions` 或 `.mobile-inline-actions`。按钮优先使用以下显式语义：

```vue
<div class="action-buttons">
  <el-button class="table-action table-action--view" @click.stop="view(row)">查看</el-button>
  <el-button class="table-action table-action--edit" @click.stop="edit(row)">编辑</el-button>
  <el-button class="table-action table-action--delete" @click.stop="remove(row)">删除</el-button>
</div>
```

表格操作按钮 PC 默认高度 `28px`，手机默认高度 `32px`。完整语义 class 包括 `view`、`edit`、`delete`、`pin`、`success`、`neutral`、`manage`、`finance`、`transfer`、`export`、`warning`。语义变量和列宽规则见《后台卡片与表格统一规范》。

卡片底部需要把多个操作始终放在同一行时，容器使用 `.card-actions.tf-actions--fit-row`。公共规则会根据实际按钮数量等分可用宽度、压缩水平内边距并禁止换行；业务页面不得再为按钮设置固定宽度或局部尺寸。

主列表操作必须显示中文文字；仅模态框紧凑工具列和公认图标工具允许只显示图标，且必须有 `title` 或 tooltip。

## 模态框和确认框

Element Plus 模态框 footer 内使用 `.tf-dialog-actions`：

```vue
<template #footer>
  <div class="tf-dialog-actions">
    <el-button @click="visible = false">取消</el-button>
    <el-button type="primary" @click="save">保存</el-button>
  </div>
</template>
```

PC 端按钮按内容自适应并靠右，单个按钮最小宽度 `80px`、高度 `40px`。手机端所有按钮保持一行并等分可用空间，允许收缩到 `min-width: 0`，不得改成上下排列。

删除、停用、完成等 MessageBox 必须通过 `frontend/src/utils/message-box.ts` 的统一增强调用，语义 class 为 `message-box-danger`、`message-box-warning`、`message-box-success` 或 `message-box-primary`。禁止页面传入颜色 class。

## 禁止项

业务页面和业务组件禁止：

- 重写 `.el-button--primary/success/warning/danger/info` 的背景、边框或文字色；
- 重写 `.btn-primary/.btn-delete/.btn-edit/.btn-view` 等语义颜色；
- 在公共操作区内设置按钮 `height`、`width`、`min-width`、`padding`、`font-size`、`border-radius`、背景或阴影；
- 在模态框 footer 中将按钮改为 `flex-direction: column` 或手机端上下排列；
- 用超长固定宽度替代内容自适应；
- 复制旧页面按钮 CSS 到新页面。

业务页面允许控制按钮容器的位置、业务所需的换行策略和权限显隐。若确需新增整站语义，先在全局变量和全局样式中增加，再供所有页面使用。

## 自动审计

提交或打包前执行：

```bash
cd frontend
npm run check:buttons
npm run build
```

`check:buttons` 会扫描所有 Vue、SCSS 和 CSS，阻止页面级语义颜色、旧版普通按钮视觉及公共操作区尺寸覆盖。确属专用工具控件时应使用专用 class，而不是绕过或删除检查。
