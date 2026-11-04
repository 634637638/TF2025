# 通知系统迁移导航

> 文档类型：迁移导航
> 唯一权威：[通知统一规范](notification-standards.md)

本文件不再维护通知 API、注册方式或代码示例，避免与权威规范和当前公共实现漂移。新增或修改通知时，统一使用：

- `frontend/src/composables/useNotification.ts`
- `frontend/src/services/notification-simple.ts`
- `frontend/src/plugins/notification.ts`
- [通知统一规范](notification-standards.md)

禁止直接使用 `ElMessage`、复制旧通知 composable 或创建第二套消息队列、防抖和历史记录实现。错误日志与用户提示的职责边界见[全局错误处理规范](../guides/error-handling-standards.md)。
