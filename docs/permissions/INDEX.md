# 权限文档索引

权限动作的唯一能力清单为 `backend/src/config/module-permission-capabilities.json`。前端按权限控制导航和交互，后端必须在受保护 API 上独立认证并授权；本地存储中的权限数据不是安全边界。

## 核心说明

- [权限系统指南](permission-system-guide.md) - 数据模型、权限获取与页面接入。
- [页面权限能力规范](../frontend/permission-capability-standards.md) - 模块动作、母子页面归属与独立鉴权的权威规则及 `check:permissions` 审计。
- [页面扫描与模块注册](page-module-scan-guide.md) - 页面、路由与模块注册。
- [字段权限指南](../frontend/field-permission-guide.md) - 前后端字段数据访问控制。
- [路由权限与导航](route-permission-navigation.md) - 菜单、路由守卫与页面访问。
- [权限缓存刷新](permission-cache-refresh.md) - 前端核验失败拒绝授权、门店绑定原子修改、业务选项及私有照片的当前范围核验。
- [权限操作日志](permission-operation-log.md) - 权限操作日志接口和数据要求。
- [无权限组件](permission-denied-component.md) - 页面无权限状态展示。

导航站管理模块使用 `guide_guidemanagementview`；能力清单和后端权限映射分别以 `backend/src/config/module-permission-capabilities.json`、`permission-mapping.js` 为唯一来源。

备份模块 `backup_backupview` 使用 `view/create/edit/delete`；定时生成规则沿用 `backup:create`，设置本地自动清理规则额外要求 `backup:delete`；云盘浏览、新建、重命名、回收站恢复（edit）及删除/彻底删除（delete）的逐接口边界和模块同步说明见[备份管理](../backend/backup-management.md#阿里云盘自动上传)。

商品模式使用综合查询 `goods-view/goods-sell/goods-gift` 分别控制查询、销售及赠送；退货/换货沿用本页原动作，均不开放商品管理页面。

贴膜采用综合查询 `view/film` 独立授权，候选与提交不要求开放商品管理页面；具体接口和门店/字段边界见[手机详情办理与记录](../backend/accessory-entry.md#手机详情办理与记录)。单模块 `manage` 不提升为系统管理员，完整权限管理授权要求见[页面权限能力规范](../frontend/permission-capability-standards.md)。

业务中检索/选择客户不授予档案写入；新建客户和修改已有客户分别用 `customers:create/edit`，无需为了开单授予客户管理查看。公共控件、销售事务及专用业务接口的完整边界见[客户操作权限](../frontend/customer-search-standard.md#客户操作权限)。

母页面、本人/团队数据、管理动作及跨模块依赖的完整处置矩阵见[三层权限边界](../frontend/permission-capability-standards.md#页面数据范围与动作三层边界)；中文名称与能力同源，不另维护名称表。

旧 `/users` 角色写入与员工入口共用角色授权保护；非进行中租赁合同增加独立“历史合同更正”动作。发布与拒绝场景见[三层权限边界](../frontend/permission-capability-standards.md#页面数据范围与动作三层边界)。

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
