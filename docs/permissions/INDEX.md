# 权限文档索引

权限动作的唯一能力清单为 `backend/src/config/module-permission-capabilities.json`。前端按权限控制导航和交互，后端必须在受保护 API 上独立认证并授权；本地存储中的权限数据不是安全边界。

## 核心说明

- [权限系统指南](permission-system-guide.md) - 数据模型、权限获取与页面接入。
- [页面权限能力规范](../frontend/permission-capability-standards.md) - 模块动作定义及 `check:permissions` 审计。
- [页面扫描与模块注册](page-module-scan-guide.md) - 页面、路由与模块注册。
- [字段权限指南](../frontend/field-permission-guide.md) - 前后端字段数据访问控制。
- [路由权限与导航](route-permission-navigation.md) - 菜单、路由守卫与页面访问。
- [权限缓存刷新](permission-cache-refresh.md) - 前端权限刷新机制。
- [权限操作日志](permission-operation-log.md) - 权限操作日志接口和数据要求。
- [无权限组件](permission-denied-component.md) - 页面无权限状态展示。

## 安全边界

- 浏览器可见的权限、角色、菜单和路由信息只用于界面渲染，不能当作秘密。
- 修改浏览器存储可能改变本地界面，但不得改变后端授权结果。
- 访问令牌是凭证，不应复制、截图或提交到工单、文档和聊天记录。
- 每个业务 API 都必须根据已验证身份和服务端权限拒绝未授权请求；前端指令或路由守卫不能代替服务端校验。

新页面和接口完成后运行：

```bash
cd frontend
npm run check:permissions
npm run check:backend-security
```
