# TF2025 权限系统统一指南

> **文档说明**：说明 TF2025 当前使用的数据库驱动 RBAC 权限模型、核心表结构、权限汇总流程与前后端接入规范。
>
> **最后更新**：2026-03-19
> **版本**：v1.1.1
> **维护者**：TF2025 开发团队

## 目录

1. [总体原则](#总体原则)
2. [核心表结构](#核心表结构)
3. [权限命名规范](#权限命名规范)
4. [权限汇总流程](#权限汇总流程)
5. [前端接入规范](#前端接入规范)
6. [后端接入规范](#后端接入规范)
7. [字段级权限控制](#字段级权限控制)
8. [模块扫描与注册规则](#模块扫描与注册规则)
9. [禁用做法](#禁用做法)
10. [落地检查清单](#落地检查清单)
11. [更新日志](#更新日志)

## 总体原则

TF2025 当前权限系统统一采用数据库驱动 RBAC，设计原则如下：

- 角色是数据，不是代码常量。
- 权限是数据，不靠前端本地角色名推断。
- 扫描模块只负责注册候选模块，不自动给任何角色发权限。
- 用户最终权限由后端根据 `user_roles + role_permissions + role_menu_visibility` 汇总。
- 前端只消费后端返回的权限结果，负责菜单、页面、按钮和字段渲染。
- 后端接口必须做同样的权限校验，前端显示控制不能替代接口鉴权。

## 核心表结构

当前权限体系以数据库结构为准，核心表如下。

### 角色表 `roles`

用于维护自定义角色。

关键字段：

- `id`
- `name`
- `code`
- `description`
- `is_active`

说明：

- `code` 是角色稳定标识，不能依赖中文名称做逻辑判断。
- “管理员”“采购员”“店长”“财务”等都应只是数据库记录。

### 模块表 `modules`

用于维护系统可授权模块。

关键字段：

- `id`
- `key`
- `name`
- `route_path`
- `icon`
- `category`
- `is_active`

说明：

- `key` 是模块稳定标识，也是权限字符串前半段。
- 新页面扫描后，只注册到 `modules`，不自动发放菜单或动作权限。

### 动作字典表 `permission_actions`

用于维护系统支持的动作类型。

典型动作：

- `view`
- `create`
- `edit`
- `delete`
- `export`
- `import`
- `approve`
- `manage`
- `sync`

说明：

- 动作应由数据库统一维护。
- 新增动作前，应确认前后端和管理页都能识别该动作。

### 角色动作权限表 `role_permissions`

用于维护角色对模块动作的授权关系。

关键字段：

- `role_id`
- `module_key`
- `action_code`
- `allowed`

说明：

- 页面权限和按钮权限最终都应落到这张表。
- 一个角色对一个模块可拥有多个动作授权。

### 角色菜单显示表 `role_menu_visibility`

用于维护角色是否可以看到菜单。

关键字段：

- `role_id`
- `module_key`
- `visible`

说明：

- 菜单显示和页面动作权限分开存储。
- 有页面权限不代表一定显示菜单。
- 显示菜单也不代表拥有所有动作。

### 用户角色关联表 `user_roles`

用于维护用户和角色的绑定关系。

关键字段：

- `user_id`
- `role_id`
- `status`
- `expires_at`

说明：

- 一个用户可绑定多个角色。
- 用户最终权限取多个角色的并集。

## 权限命名规范

### 统一格式

当前前后端统一使用以下格式：

```text
module_key:action
```

其中：

- `module_key` 对应 `modules.key`
- `action` 对应 `permission_actions.code`

### 命名示例

```text
sales_salesview:view
sales_salesview:create
inventory_inventoryview:edit
permissions_permissionsview:manage
stores_storesview:menu_view
```

说明：

- 菜单显示建议统一映射为 `module_key:menu_view`。
- 页面是否可进入，一般检查 `module_key:view`。
- 同一个模块可同时存在 `menu_view`、`view`、`create`、`edit`、`delete` 等动作。

### 命名要求

- 不再使用旧的 `module:action` 简写。
- 不再使用 `system:admin`、`sales:read` 这类历史格式。
- 不允许前端本地自造权限名并假设后端会识别。

## 权限汇总流程

### 登录后统一生成

推荐流程如下：

1. 用户登录成功。
2. 后端读取该用户有效的 `user_roles`。
3. 读取这些角色对应的 `role_permissions` 和 `role_menu_visibility`。
4. 对角色权限做并集汇总。
5. 返回给前端统一的访问结果，包括：
   - 可见菜单
   - 可访问页面
   - 可执行动作
   - 可见字段或字段配置结果（如启用字段级权限）

### 菜单与页面的关系

- `菜单显示` 决定左侧导航是否展示。
- `页面权限` 决定是否能真正进入页面。
- `动作权限` 决定按钮、操作列、批量动作是否可用。

### 角色并集规则

- 用户拥有多个角色时，菜单可见性取“可见并集”。
- 页面动作权限取“允许并集”。
- 字段级权限如启用，应由后端给出统一结果，前端只消费。

## 前端接入规范

### 页面级权限

优先使用 `usePagePermissions`：

```ts
import { usePagePermissions } from '@/composables/usePagePermissions'

const { canView, canCreate, canEdit, canDelete } = usePagePermissions('sales')
```

要求：

- 页面不要硬编码角色名。
- 页面不要写 `permissions.some(p => p.includes('admin'))` 这类模糊判断。
- 页面不要把“管理员”当成特殊角色常量写死。

### 通用权限判断

需要显式校验时使用：

```ts
const authStore = useAuthStore()

authStore.hasPermission('sales_salesview:view')
authStore.hasPermission('sales_salesview:create')
authStore.hasRole(['store_manager', 'finance_auditor'])
```

说明：

- `hasRole` 只用于角色展示、角色筛选或需要明确角色身份的业务场景。
- 页面可见性和接口可操作性应优先基于权限判断，而不是角色名判断。

### 模板中的权限控制

```vue
<template>
  <el-button v-permission="'sales_salesview:create'">新建销售</el-button>
  <el-button v-permission="'sales_salesview:export'">导出</el-button>
  <el-empty v-permission-not="'sales_salesview:view'" description="无页面权限" />
</template>
```

### 菜单渲染

- 前端菜单优先根据后端返回的菜单结果渲染。
- 不自行猜测哪些角色应该看到哪些菜单。
- 不因开发环境或本地角色名直接放行菜单。

### 文案要求

- 界面上避免固定写“管理员”“系统管理员”作为默认角色。
- 展示角色时优先显示数据库返回的 `role.name` 或 `role.code`。
- 提示文案建议使用中性表达，例如“当前账号暂无此权限”。

## 后端接入规范

### 统一鉴权

后端路由必须走统一认证和权限校验中间件，避免出现：

- 某些接口按角色名判断
- 某些接口按旧 `role_type` 判断
- 某些接口完全不校验

### 推荐做法

```js
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

router.post(
  '/sales',
  unifiedAuth,
  requirePermission('sales_salesview:create'),
  createSalesRecord
)

router.put(
  '/sales/:id',
  unifiedAuth,
  requirePermission('sales_salesview:edit'),
  updateSalesRecord
)

router.delete(
  '/sales/:id',
  unifiedAuth,
  requirePermission('sales_salesview:delete'),
  deleteSalesRecord
)
```

### 动作和接口的对应关系

- 页面访问接口校验 `view`
- 新增接口校验 `create`
- 编辑接口校验 `edit`
- 删除接口校验 `delete`
- 导出接口校验 `export`
- 审批接口校验 `approve`
- 高风险管理接口校验 `manage`

### 返回前端的数据要求

登录态或权限刷新接口建议返回：

- 用户基础信息
- 角色列表
- 模块菜单可见性结果
- 权限字符串列表
- 字段权限结果或字段配置结果

## 字段级权限控制

字段级权限是页面权限之上的扩展层，不替代基础 RBAC。

### 适用场景

- 采购价、利润、成本价等敏感金额字段
- 客户电话、身份证、Apple ID 等隐私字段
- 只允许部分角色查看或编辑的业务字段

### 设计原则

- 字段权限是数据，不写死在页面里。
- 字段权限应由后端汇总后返回，前端按结果渲染。
- 前端隐藏字段只是体验控制，敏感数据接口仍应在后端过滤。

### 推荐接入方式

前端优先使用现有能力：

- `frontend/src/composables/useFieldPermissions.ts`
- `frontend/src/services/fieldPermissionService.ts`
- `v-field-permission`

示例：

```vue
<el-form-item
  v-field-permission="{
    module: 'sales_salesview',
    field: 'price_info.purchase_price',
    action: 'view'
  }"
  label="采购价"
>
  <span>{{ row.purchase_price }}</span>
</el-form-item>
```

说明：

- `module` 应与模块真实 `module_key` 对齐。
- 字段标识应与后端字段配置保持一致。
- 字段可见、可编辑、可导出等规则，应统一来源于数据库配置结果。

## 模块扫描与注册规则

### 扫描模块的目标

扫描模块的目标是把新页面或新模块注册进 `modules`，用于后续授权。

补充说明：

- `src/views/<module>/page/` 目录下的文件，不会默认全部扫描成模块。
- 只有“真实独立路由页面”才应进入模块扫描。
- 推荐配合阅读：[页面扫描与模块注册规范](./page-module-scan-guide.md)。

### 扫描模块不负责什么

- 不自动给任何角色发菜单权限
- 不按角色名默认分配 `view/create/edit/delete`
- 不因为页面存在就默认让所有人可见

### 推荐管理流程

1. 新增页面或模块。
2. 运行扫描逻辑，把模块注册到 `modules`。
3. 管理员进入权限页。
4. 选择某个角色。
5. 单独配置：
   - 菜单显示
   - 页面查看
   - 新增
   - 编辑
   - 删除
   - 导出
   - 审批
   - 管理
6. 用户绑定一个或多个角色。
7. 登录时由后端汇总最终权限。
8. 前端根据后端结果渲染菜单、页面、按钮、字段。
9. 后端接口做同样校验。

## 禁用做法

以下写法视为旧模型或错误模型，禁止继续新增：

- `req.user.role === 'admin'`
- `includes('超级管理员')`
- `permissions.some(p => p.includes('admin'))`
- `v-permission="'sales:create'"`
- `requirePermission('system:admin')`
- 按中文角色名默认灌权限
- 前端自行根据角色名推导菜单和按钮

## 落地检查清单

新增页面或改造旧页面时，至少检查以下内容：

1. 页面是否已注册到 `modules`。
2. 页面使用的权限字符串是否为 `module_key:action`。
3. 路由守卫是否基于统一权限结果判断。
4. 左侧菜单是否基于菜单可见性结果渲染。
5. 按钮、操作列、批量操作是否接入统一权限判断。
6. 敏感字段是否接入字段级权限控制。
7. 后端新增接口是否接入 `requirePermission(...)`。
8. 是否仍存在按角色名硬编码放行逻辑。
9. 是否仍存在旧格式权限字符串。

## 更新日志

### 2026-03-19 - v1.1.1

- 清理旧版 `module:action` 权限文档残留。
- 删除角色名硬编码、旧迁移映射、旧管理员特权示例。
- 将文档统一收敛为当前数据库驱动 RBAC 模型。

### 2026-03-21 - v1.1.2

- 补充 `page/` 目录页面扫描规则说明。
- 增加独立文档《页面扫描与模块注册规范》。

### 2026-03-19 - v1.1.0

- 明确当前权限系统为数据库驱动 RBAC。
- 补充核心表结构：`roles`、`modules`、`permission_actions`、`role_permissions`、`role_menu_visibility`、`user_roles`。
- 补充菜单显示与页面权限分离原则。
- 补充模块扫描仅注册、不自动发权限的规则。
- 补充前后端统一接入规范与禁用做法。

### 2026-01-05 - v1.0.0

- 初版权限系统使用指南。
