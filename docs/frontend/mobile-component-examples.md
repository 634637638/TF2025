# 移动端组件迁移导航

> 文档类型：迁移导航
> 唯一权威：[移动端开发标准](../guides/mobile-development-standards.md)及[前端规范索引](INDEX.md)

旧页面模板和复制式代码示例已经移除，避免重复 API、直接 `console`、浏览器本地时间格式化和过期组件参数被继续复制。开发移动端页面时，应从当前源码和对应专项规范选择公共实现：

- 页面结构与响应式：[页面结构规范](page-structure-standards.md)、[响应式断点规范](responsive-breakpoint-standard.md)
- 弹窗：[对话框统一规范](dialog-standards.md)和 `frontend/src/components/MobileDialog.vue`
- 表格与列表：[后台卡片与表格规范](admin-table-standards.md)
- 搜索、分页和空状态：[搜索规范](search-standards.md)、[分页规范](pagination-standards.md)、[空状态规范](empty-state-standard.md)
- Loading、通知和错误：[全局 Loading](global-loading-standard.md)、[通知规范](notification-standards.md)、[错误处理规范](../guides/error-handling-standards.md)
- 时间：[全局时间工具与日期格式](time-standards.md)

需要示例时优先查看已经通过当前审计的真实页面和公共组件，不在文档中维护第二套可复制页面模板。
