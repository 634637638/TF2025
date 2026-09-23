# TF2025 对话框/编辑框规范

本文件是前端对话框规范的标准索引，完整规则见 [`docs/frontend/dialog-standards.md`](../frontend/dialog-standards.md)。

## 唯一维护入口

- 结构和响应式行为：`frontend/src/components/MobileDialog.vue`
- 弹窗视觉和 PC/iPad/手机令牌：`frontend/src/styles/components/_dialog.scss`
- footer 按钮：`frontend/src/styles/components/_dialog-actions.scss`
- 按钮语义：`frontend/src/styles/components/_buttons.scss`

禁止新增 `BaseModal`、`modal-styles.scss` 或页面自维护的通用弹窗外壳。

## 实施原则

1. 新弹窗优先使用 `MobileDialog`。
2. 原生 `el-dialog` 必须复用全局样式和 `.tf-dialog-actions`。
3. 页面只维护业务内容、表格/图片布局和必要的宽度变体。
4. 标题、圆角、阴影、正文间距、底部按钮和移动端安全区只能在公共入口调整。
5. 图片预览和全屏工作台可以使用明确变体，但不得复制普通弹窗外壳。

## 交付检查

- PC、iPad、手机均不出现溢出或按钮遮挡。
- 正文超高时可滚动，底部操作保持可见。
- 手机按钮同一行展示，并正确处理安全区域。
- 修改弹窗视觉时只改 `_dialog.scss` 或 `_dialog-actions.scss`。
