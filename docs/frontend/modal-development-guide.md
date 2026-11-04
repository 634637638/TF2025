# 模态框开发迁移导航

> 文档类型：迁移导航
> 唯一权威：[对话框统一规范](dialog-standards.md)

历史边框、手工北京时间计算和页面私有弹窗样式示例已经移除，避免与当前公共实现冲突。新增或修改弹窗统一复用：

- `frontend/src/components/MobileDialog.vue`
- `frontend/src/components/MediaPreviewViewer.vue`
- `frontend/src/styles/components/_dialog.scss`
- `frontend/src/styles/components/_dialog-actions.scss`
- [全局时间工具与日期格式](time-standards.md)

业务页面不得复制弹窗外壳、遮罩关闭逻辑、响应式宽度、footer 布局或手工时区算法。
