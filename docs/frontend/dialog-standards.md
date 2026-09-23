# TF2025 对话框统一规范

## 统一入口

所有后台弹窗共用以下入口，PC、iPad 和手机通过同一套 CSS 令牌与媒体查询维护：

| 文件 | 职责 |
| --- | --- |
| `frontend/src/components/MobileDialog.vue` | 弹窗结构、关闭行为、响应式模式、默认 footer |
| `frontend/src/styles/components/_dialog.scss` | 遮罩、宽度、圆角、标题栏、关闭按钮、正文间距、移动端边界 |
| `frontend/src/styles/components/_dialog-actions.scss` | 取消/确认按钮的排列、尺寸、间距和移动端等宽布局 |
| `frontend/src/styles/components/_buttons.scss` | 按钮颜色、语义和普通按钮视觉 |

以上样式由 `frontend/src/main.ts` 全局加载。页面不得再维护第二套弹窗外壳样式。

## 组件选择

- 新增业务弹窗优先使用 `MobileDialog`。
- 需要 Element Plus 原生插槽或已有服务逻辑时可以使用 `el-dialog`，但必须复用全局样式。
- 不新增自定义 `modal-overlay`、`modal-content`、`BaseModal` 或新的弹窗主题。
- 图片预览、富文本、表格工作台等复杂内容可以使用业务 class，但只允许调整内容布局或宽度变体。

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

- PC 端按钮靠右、按内容宽度排列。
- 手机端按钮保持一行并等宽收缩，取消在左、确认在右。
- 不在页面中给 footer 按钮重复设置高度、宽度、圆角或间距。
- 取消使用中性语义，保存/确认使用 `primary`，删除使用 `danger`，完成使用 `success`。
- 业务 footer 容器可以保留自己的 class，但应同时使用 `.tf-dialog-actions`。

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
