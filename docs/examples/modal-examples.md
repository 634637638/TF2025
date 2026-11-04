# 对话框示例导航

> 文档类型：迁移导航
> 唯一权威：[对话框统一规范](../frontend/dialog-standards.md)

本文不维护独立弹窗实现。当前结构、响应式宽度、正文间距、footer、关闭行为和时间处理统一参考：

- [对话框统一规范](../frontend/dialog-standards.md)
- [公共组件采用规范](../frontend/component-adoption-standard.md)
- `frontend/src/components/MobileDialog.vue`
- `frontend/src/components/MediaPreviewViewer.vue`
- [全局时间工具与日期格式](../frontend/time-standards.md)

真实业务示例应从已经通过 `check:dialogs`、`check:dialog-actions` 和 `check:responsive` 的当前页面中选择，禁止复制历史私有弹窗外壳或手工时间格式化代码。
