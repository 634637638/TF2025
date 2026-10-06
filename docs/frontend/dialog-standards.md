# TF2025 对话框统一规范

## 统一入口

所有后台弹窗共用以下入口，PC、iPad 和手机通过同一套 CSS 令牌与媒体查询维护：

| 文件 | 职责 |
| --- | --- |
| `frontend/src/components/MobileDialog.vue` | 弹窗结构、关闭行为、响应式模式、默认 footer |
| `frontend/src/styles/components/_dialog.scss` | 遮罩、宽度、圆角、标题栏、关闭按钮、正文间距、确认框内容宽度、移动端边界 |
| `frontend/src/styles/components/_dialog-actions.scss` | 取消/确认按钮的排列、尺寸、间距和移动端居中等分布局 |
| `frontend/src/styles/components/_buttons.scss` | 按钮颜色、语义和普通按钮视觉 |

关闭按钮统一使用 `MobileDialog` 的 `tf-button--dialog-close` 语义。该语义同时覆盖 Element Plus 的 `--el-button-*` 变量和 SVG 图标尺寸；公共弹窗样式还按 `.mobile-dialog-sheet-close` 结构类提供兜底，禁止浏览器默认按钮外观在手机端泄漏。PC 与手机端都必须保持半透明标题栏背景、白色关闭图标和圆形触控区域；业务页面不得重新设置关闭按钮背景、颜色、宽高或 SVG 尺寸。

`MobileDialog` 在手机和平板使用 sheet 布局，在桌面使用 Element Plus Dialog。宽度按断点收敛：手机（`<=767px`）使用接近满宽的弹窗；平板（`768-1024px`）宽度上限为视口的 `80%`，并继续受页面 `width`/`maxWidth` 参数约束；桌面（`>=1025px`）按页面声明宽度并受全局最大宽度约束。最终规则统一采用 `min(页面声明宽度, 可用视口宽度)`，与库存管理弹窗的自适应行为一致。不要在业务页面用 `!important` 再覆盖这些断点规则。

### 宽度行为

`width` 只声明业务弹窗的期望宽度，`maxWidth` 用于声明更严格的上限；两者都不是固定像素锁定。全局实现会根据当前视口自动取较小值：

| 视口 | 统一行为 |
| --- | --- |
| 桌面 `>=1025px` | `min(width, 可用视口宽度)`，同时受 `maxWidth` 限制 |
| 平板 `768-1024px` | 最大为视口 `80%`，同时受页面宽度上限限制 |
| 手机 `<=767px` | 使用接近满宽的 sheet，并保留统一左右安全间距 |

标准写法：

```vue
<MobileDialog
  v-model="visible"
  title="编辑设备"
  width="900px"
  max-width="960px"
  dialog-class="device-edit-dialog"
>
  <!-- 内容区由业务组件负责，弹窗宽度由全局入口负责 -->
</MobileDialog>
```

业务页面不得再写 `width: min(..., 100vw)`、`width: calc(100vw - ...)` 或按断点重复覆盖 `.el-dialog` / `.mobile-dialog-sheet-panel`。需要更宽的表格或媒体工作台时，只声明 `width`/`maxWidth` 或使用已登记的工作台例外；不要复制库存页面的局部宽度 CSS。

`/query` 页面及 `QueryDetailDialog.vue` 中的所有业务弹窗必须使用 `MobileDialog`；媒体工作台也不再以直接 `el-dialog` 作为响应式例外。`check:dialogs` 会持续检查这两个入口。

`QuickSaleModal.vue` 属于 `/query` 的标准业务弹窗。其 `dialog-class` 只能用于标识业务内容布局；不得在页面内覆盖标题栏高度、标题栏内边距、圆角、弹窗外壳最大高度、正文间距或 footer 间距。需要调整弹窗宽度时使用 `width`/`maxWidth` 属性，统一外壳视觉始终由 `MobileDialog` 和本文件规定的全局样式控制。

以上样式由 `frontend/src/main.ts` 全局加载。页面不得再维护第二套弹窗外壳样式。

## 组件选择

- 新增业务弹窗优先使用 `MobileDialog`。
- 需要 Element Plus 原生插槽或已有服务逻辑时可以使用 `el-dialog`，但必须复用全局样式。
- 不新增自定义 `modal-overlay`、`modal-content`、`BaseModal` 或新的弹窗主题。
- 图片预览、富文本、表格工作台等复杂内容可以使用业务 class，但只允许调整内容布局或宽度变体。

当前直接 `el-dialog` 例外由 `frontend/scripts/check-dialog-adoption.mjs` 登记并审计。例外只覆盖全局提醒宿主、媒体/照片预览工作台、备份清理、待办、经验分享和国补照片管理；普通新增业务弹窗不得直接复制这些例外。

## 统一视觉令牌

令牌集中在 `_dialog.scss` 的 `:root` 中。常用令牌包括：

```scss
--tf-dialog-radius
--tf-dialog-shadow
--tf-dialog-header-bg
--tf-dialog-header-padding-y
--tf-dialog-title-size
--tf-dialog-close-size
--tf-dialog-body-padding-inline
--tf-dialog-body-padding-block
--tf-dialog-footer-padding-inline
--tf-dialog-footer-gap
```

默认值适用于 PC；`768px` 以下切换到移动端宽度、间距和安全区；`480px` 以下进一步收紧标题、正文和 footer。修改全局弹窗视觉时只改 `_dialog.scss`，不要在页面中复制具体像素值。

### 弹窗文字字号

弹窗文字统一读取 `frontend/src/styles/_variables.scss` 的语义文字令牌：

| 文字类型 | PC | 手机 | 超窄屏（不超过 375px） |
| --- | ---: | ---: | ---: |
| 标题 | 16px | 16px | 15px |
| 正文和提示 | 14px | 15px | 14px |
| 表单标签 | 14px | 14px | 13px |
| 操作按钮 | 14px | 14px | 13px |

标题使用 `--tf-font-dialog-title`，正文使用 `--tf-font-body`，标签使用 `--tf-font-label`，按钮使用 `--tf-button-font-size`。`MobileDialog`、Element Plus Dialog 和 MessageBox 必须遵循同一组令牌；业务页面不得单独设置弹窗标题、提示正文或表单标签字号。业务提示可以调整换行、最大高度和行高，但不得复制字号值。

MessageBox 的默认宽度由 `--tf-dialog-message-width` 统一控制，当前为 `560px`，用于减少删除确认、清空确认等长内容的无必要换行。手机端仍通过视口可用宽度自动收缩，页面不得单独给某一个删除确认框设置宽度。

历史页面使用的 `--dialog-*` 变量仍保留为兼容别名，新增代码应使用 `--tf-dialog-*` 变量。`crud-dialog-sm/md/lg` 只改变弹窗宽度，不改变标题、圆角和底部按钮。

## 标准结构

```vue
<MobileDialog
  v-model="visible"
  title="编辑资料"
  dialog-class="customer-form-dialog"
  @confirm="save"
>
  <el-form class="tf-dialog-form tf-dialog-form--stacked" :model="form">
    <el-form-item label="名称">
      <el-input v-model="form.name" />
    </el-form-item>
  </el-form>
</MobileDialog>
```

使用原生 `el-dialog` 时，footer 使用统一 class：

```vue
<template #footer>
  <div class="tf-dialog-actions">
    <el-button @click="visible = false">取消</el-button>
    <el-button type="primary" @click="save">保存</el-button>
  </div>
</template>
```

## 表单和正文

- 普通横向表单使用 `.tf-dialog-form`。
- 标签置顶的编辑器使用 `.tf-dialog-form--stacked`。
- 默认正文间距由 `_dialog.scss` 控制，页面不重复设置 `.el-dialog__body` 的 padding。
- 图片、表格或富文本确实需要贴边时使用 `.tf-dialog-body-flush`，只用于该业务变体。
- 内容超高时正文滚动，不能隐藏滚动导致按钮不可操作。
- 内容超宽时只在内容内部横向滚动，不能撑宽弹窗。

## Footer 按钮

- 按钮公共尺寸：PC 高度为 `40px`、最小宽度 `80px`、水平内边距 `16px`、按钮间距 `10px`；手机和平板（`<=1024px`）高度仍为 `40px`，按钮在可用宽度内等分，间距为 `8px`、水平内边距 `10px`，不设置固定宽度。
- 所有业务 footer 容器必须使用 `.tf-dialog-actions`（可与业务语义 class 并列）。
- PC 端按钮靠右、按内容宽度排列；按钮使用统一最小宽度、统一高度和统一间距。
- 手机和平板按钮保持一行并在 footer 可用宽度内居中等分，取消在左、确认/保存/提交在右；按钮组占满可用宽度，所有按钮等宽，左右留白必须对称。按钮间距和底部安全区由全局令牌控制。
- 三个及以上按钮仍使用同一行居中等分布局；不在页面中改成独立 grid 或分别设置左右宽度。
- 不在页面中给 footer 按钮重复设置高度、宽度、圆角或间距。
- 取消使用中性语义，保存/确认使用 `primary`，删除使用 `danger`，完成使用 `success`。
- 业务 footer 容器可以保留自己的 class，但应同时使用 `.tf-dialog-actions`。

`MobileDialog` 会自动为未显式包裹的 footer 插槽增加 `.mobile-dialog-footer`，因此历史页面中直接放置
`<el-button>` 仍会获得同一套按钮高度、宽度、间距和移动端居中等分规则；新代码仍必须显式使用
`.tf-dialog-actions`，便于审计和维护。原生 `el-dialog` 的直接 footer 按钮也由 `_dialog-actions.scss` 统一覆盖；新代码仍应显式包裹，便于审计和维护。

业务 footer 只允许维护摘要、提示和弹窗宽度等业务布局。禁止在页面样式中重新声明 footer 的 `grid`、
手机端 `flex-direction: column`、按钮 `width/min-width/max-width/height/min-height/padding`。这些规则由
`_dialog-actions.scss` 唯一维护，`npm run check:dialog-actions` 会在启动和构建前拦截重复实现。

## 页面覆盖边界

允许：宽度变体、内容区网格/表格/图片布局、明确的全屏或无 padding 工作台变体。

禁止：页面重新定义 `.el-dialog__header`、`.el-dialog__body`、`.el-dialog__footer` 的公共视觉；直接写弹窗主题颜色、统一圆角和通用阴影；新增旧式 `.modal-overlay` 或重复的 `modal-styles.scss`；通过提高页面 z-index 解决弹窗层级问题。

## 检查清单

- [ ] 使用 `MobileDialog` 或复用全局 `el-dialog` 样式
- [ ] PC、iPad、手机宽度均不溢出
- [ ] 标题、关闭按钮、正文和 footer 使用公共令牌
- [ ] footer 使用 `.tf-dialog-actions`
- [ ] 手机端按钮保持一行且避开安全区
- [ ] 正文可滚动，footer 始终可操作
- [ ] 页面没有重复的弹窗外壳样式
- [ ] 运行 `npm run type-check`、`npm run check:ui` 和 `npm run build`
- [ ] 运行 `npm run check:dialogs`，确认直接 `el-dialog` 属于已登记的工作台例外
- [ ] 运行 `npm run check:dialog-actions`，确认没有 footer 的 grid、纵向排列或固定按钮尺寸覆盖
- [ ] 检查没有页面级 `width: calc(100vw - ...)` 或 `width: min(..., 100vw)` 覆盖全局宽度
