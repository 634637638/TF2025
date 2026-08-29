# PermissionsView 拆分进度

更新时间：2026-08-28

## 权限边界

`PermissionsView.vue` 继续作为 `/permissions` 路由根页面，根访问由 `permissions:view` 控制。角色、用户角色、门店绑定、模块管理、日志和页面权限 TAB 的查看权限仍由父页面和既有页面组件控制；抽出的组件不创建路由，也不新增权限模块。

## 当前进度

| 区块 | 状态 | 位置 | 说明 |
| --- | --- | --- | --- |
| 角色编辑弹窗 | 已完成 | `page/RoleFormDialog.vue` | 角色名称、编码和描述表单已抽离；角色初始化、校验、保存 API 和创建/编辑权限仍由父页面控制 |
| 角色分配用户摘要 | 已完成 | `page/UserRoleAssignmentSummary.vue` | 用户信息和角色数量摘要已抽离 |
| 角色分配选择区 | 已完成 | `page/UserRoleAssignmentBody.vue` | 搜索、角色卡片和已选角色预览已抽离，选中 ID 仍由父页面持有 |
| 角色分配弹窗 | 已完成 | `page/UserRoleAssignmentDialog.vue` | 弹窗编排与底部操作已抽离；初始化、保存 API 和权限边界仍由父页面控制 |
| 门店绑定弹窗 | 已完成 | `page/StoreBindingDialog.vue` | 用户摘要、门店多选和按钮状态已抽离；绑定校验、保存 API 和权限边界仍由父页面控制 |
| 字段权限弹窗 | 已完成 | `page/ModuleFieldPermissionDialog.vue` | 模块字段选择和分组全选已抽离；字段读取、保存 API 和模块权限边界仍由父页面控制 |
| 角色字段权限弹窗 | 已完成 | `page/RoleFieldPermissionDialog.vue` | 模块、分组和字段可见性界面已抽离；角色字段读取、保存 API 和权限边界仍由父页面控制 |
| 页面权限矩阵 | 已完成 | `page/RolePermissionsPage.vue` | 页面权限矩阵、菜单显示和角色选择界面已抽离；权限读取、保存 API 和角色权限边界仍由父页面上下文控制 |

## 验证记录

- 权限页面及抽出的弹窗严格 ESLint：`0 error / 0 warning`。
- TypeScript 类型检查通过。
- 字段、权限、统一 UI、按钮、加载、TAB 和样式债务审计通过。
- 主文件由 `6,684` 行降至 `2,642` 行；样式已迁移至 `styles/permissions-view.css`，保持原有全局弹窗覆盖。
