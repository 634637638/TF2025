# 路由权限与导航入口统一规范

> 最后更新：2026-08-24

## 目标

所有入口在跳转前使用同一套路由权限判断，避免出现“提示无权限但顶部标签仍打开”或“页面组件拦截但菜单/标签已进入”的不一致行为。

## 统一入口

前端路由权限集中维护在：

```text
frontend/src/constants/routePermissions.ts
```

核心方法：

```ts
getRoutePermissions(path)
canAccessRoutePath(path, authStore)
```

`canAccessRoutePath` 会先去掉 `?query` 和 `#hash`，再匹配路由权限表，并复用 `PermissionUtils.hasPermission` 做前后端权限码兼容判断。新增导航入口时应调用它，不要在组件内重新拼权限规则。

## 已接入的位置

- 路由守卫：`frontend/src/router/guards.ts`
- 桌面侧边栏：`frontend/src/components/SimpleSidebar.vue`
- 移动端菜单：`frontend/src/composables/useMobileMenu.ts`
- 顶部标签切换：`frontend/src/components/TabsBar.vue`
- 顶部标签自动新增：`frontend/src/views/system/page/SimpleAdminView.vue`
- 快捷入口导航：`frontend/src/views/system/page/SimpleAdminView.vue`

## 页面接入规则

新增受权限控制页面时，需要同时检查三处：

1. 页面根部使用 `PermissionGate`
2. `routePermissions.ts` 增加对应路由权限
3. `routePermissions.ts` 的权限与页面 `PermissionGate` 的 `canView` 逻辑保持一致

如果一个页面允许多个查看权限进入，例如工资管理、考勤管理，可以在 `routePermissions.ts` 中配置多个权限，但必须与页面的 `can-view` computed 逻辑一致。

## 无权限行为

统一行为为：

- 点击菜单或顶部标签时：只弹顶部提示 `您没有访问此页面的权限`，不跳转，不新增标签
- 直接输入受限 URL 时：路由守卫或 `PermissionGate` 兜底提示，并返回 `/dashboard`
- 页面内不展示“访问受限 / 权限代码 / 联系开通”等详细卡片

## 未登录导航行为

- 首次打开站点根地址或直接访问受保护地址时，静默跳转到 `/login`，并通过 `redirect` 参数保留原目标地址。
- 冷启动阶段不弹“需要登录”通知，避免通知早于应用和 Element Plus 样式挂载而出现未样式化内容。
- 路由跳转必须始终执行；跳转冷却只允许限制重复通知，不能通过 `next(false)` 阻止进入登录页。
- 应用已经挂载后，由页面交互触发的未登录访问可以显示一次统一顶部通知。

## 已知对齐项

- `/models` 使用 `models:view`
- `/memories` 使用 `memories:view`
- `/menu` 使用 `menus:view`
- `/backup` 使用 `backup:view`
- `/git-management` 使用 `git-management:view`
- `/salary` 使用 `salary:view`
- `/price-list/sync-logs` 与页面保持一致，使用 `price-list:view`

## 常见权限映射

页面和入口使用 canonical 权限码，数据库权限模块使用完整模块 key。设置权限时需要确认两边能映射到同一含义：

| 页面 | 页面权限 | 数据库模块权限 |
| --- | --- | --- |
| `/price-list` | `price-list:view` | `price_list_pricelistview:view` |
| `/backup` | `backup:view` | `backup_backupview:view` |
| `/git-management` | `git-management:view` | `system_gitmanagement:view` |

操作权限也按同一规则拆分：

| 功能 | 页面权限 | 数据库模块权限 |
| --- | --- | --- |
| 备份创建 | `backup:create` | `backup_backupview:create` |
| 备份删除/清理 | `backup:delete` | `backup_backupview:delete` |
| Git 查看状态/日志 | `git-management:view` | `system_gitmanagement:view` |
| Git 创建备份/分支 | `git-management:create` | `system_gitmanagement:create` |
| Git 提交/拉取/推送/恢复 | `git-management:edit` | `system_gitmanagement:edit` |
| Git 删除分支/隐藏提交 | `git-management:delete` | `system_gitmanagement:delete` |

## 页面动作配置

权限管理页面展示哪些操作开关，由后端模块动作配置决定：

```text
backend/src/config/module-permission-actions.js
```

其中 `MODULE_PERMISSION_TYPES` 应只声明该模块真实存在的功能动作。新增页面功能时，需要同步补充这里的动作配置，再接入前端按钮控制和后端接口校验。

示例：Git 仓库当前只支持：

```js
system_gitmanagement: ['view', 'create', 'edit', 'delete']
```

如果后续新增“导出日志”，才添加：

```js
system_gitmanagement: ['view', 'create', 'edit', 'delete', 'export']
```

页面显示可以继续使用中文“查看 / 新增 / 编辑 / 删除 / 导出”，但数据库和代码中的权限动作必须使用英文 `view/create/edit/delete/export`。不要把中文显示名写入 `role_permissions.permission_type`。

权限修改后，如果当前用户已经登录，需要刷新用户权限缓存，最稳妥的方式是退出后重新登录；后端路由权限变更后，需要重启后端服务。
