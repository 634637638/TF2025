# 权限系统文档索引

> **文档说明**：本目录包含 TF2025 项目的权限管理、字段权限、权限缓存与权限组件相关文档。
>
> **最后更新**：2026-08-24
> **版本**：v1.2.0
> **维护者**：TF2025 开发团队

## 核心文档

- [权限系统完整指南](permission-system-guide.md) - 数据库驱动 RBAC、权限汇总与接入规范
- [页面扫描与模块注册规范](page-module-scan-guide.md) - 新增页面、`page/` 目录与模块扫描规则
- [页面权限能力统一规范](../frontend/permission-capability-standards.md) - 模块真实能力清单、前后端接入和强制审计
- [字段权限完整指南](field-permissions-complete-guide.md) - 字段级别权限控制
- [权限操作日志规范](permission-operation-log.md) - 日志写入、详情、分页和长期保留规则

## 权限缓存

- [权限缓存刷新](permission-cache-refresh.md) - 权限缓存机制说明

## 权限组件

- [权限拒绝组件](permission-denied-component.md) - 无权限时的 UI 组件
- [路由权限与导航入口统一规范](route-permission-navigation.md) - 菜单、标签、路由守卫的统一无权限行为

## 当前权限模型

- 角色是数据库数据，不是代码常量。
- 权限是数据库数据，不靠前端角色名推断。
- 用户最终权限由后端统一汇总，不由前端拼规则。
- 菜单显示与页面动作权限分离存储。
- 模块可配置的动作由 `backend/src/config/module-permission-capabilities.json` 唯一声明，数据库历史数据不能新增动作。

## 权限命名规范

```typescript
// 页面权限格式：module_viewname:action
'sales_salesview:view'
'sales_salesview:create'
'sales_salesview:sell' // 销售出库
'inventory_inventoryview:edit'
'inventory_inventoryview:sell' // 库存出库
'permissions_permissionsview:manage'

// 菜单权限格式
'stores_storesview:menu_view'
```

## 使用示例

### Vue 模板中使用
```vue
<el-button v-permission="'sales_salesview:create'">新建订单</el-button>
```

### 组合式函数中使用
```typescript
import { usePermissions } from '@/composables/usePermissions'

const { checkUserPermission } = usePermissions()
if (checkUserPermission('sales_salesview:create')) {
  // 执行操作
}
```

## 相关文档

- [开发指南](../guides/)
- [业务文档](../business/)

## 最近更新

### 2026-08-24

- 新增页面权限能力统一规范和强制审计。
- 未登记模块只允许 `view`，取消通用 CRUD 自动生成。
- `manage`、`sync` 和业务状态动作必须对应真实页面功能及后端接口。

### 2026-07-26

- 新增权限操作日志规范，明确后端唯一写入、服务端分页、详情字段和长期保留策略。

### 2026-03-19

- 索引已同步到数据库驱动 RBAC 版本。
- 权限命名示例已从旧 `module:action` 更新为当前 `module_viewname:action`。
- 权限系统完整指南已补充核心表结构、权限汇总流程与模块扫描规则。
- 已清理旧 `sales:create` 示例，索引与当前权限格式保持一致。
