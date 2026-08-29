# 字段权限控制使用指南

本文档介绍如何在TF2025前端项目中使用字段权限控制功能。

## 概述

字段权限控制允许您根据用户角色精确控制页面中每个字段的显示、编辑和导出权限。

## 字段列与动作列统一规则

- 普通数据列只由字段权限控制：字段开启时展示，字段关闭时不渲染，也不能继续参与筛选、计算、导出或提交。
- 承载动作的字段列使用“字段可见 OR 对应动作权限”的规则。动作必须放在语义对应的列内，不能全部塞入通用操作列。
- `审批` 放在审批/提交字段列，`到账` 放在到账字段列，`上传` 放在图片字段列；这些列关闭字段展示但用户拥有对应动作权限时，仍展示该列和已授权按钮。
- 字段权限页中的“分组”只用于组织字段，不代表独立页面权限；例如国补“提交时间”和“到账时间”仍分别受字段展示权限控制。
- `system_info.operations` 等通用操作列只承载编辑、删除等没有独立业务字段的动作，并使用“操作字段可见 OR 任一列内动作权限”的规则。
- 字段关闭且用户没有该列任何动作权限时，整列隐藏。
- 每个按钮只判断自己的页面动作权限，禁止再与字段权限使用 `AND` 绑定；点击处理函数和后端接口必须校验同一个动作。
- 桌面表格、移动卡片和展开操作区必须复用同一个可见性结果，不能出现终端之间权限表现不同。
- 字段控制必须覆盖统计卡片、筛选、表格、移动卡片、表单、详情、打印、导出和页面计算；不能只给表格列加 `v-if`。
- 表单提交必须从规范 payload 中按可见字段白名单重新构造，隐藏字段不得因默认值、编辑回填或计算字段再次进入请求。
- 后端必须按同一个 `module_key` 脱敏响应、限制搜索列并拒绝隐藏字段写入；前端 `v-if` 不是数据权限边界。

统一使用共享函数：

```ts
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'

const showOperationColumn = computed(() => shouldShowActionColumn(
  canViewField('actions'),
  [canEdit.value, canDelete.value]
))

const showApprovalColumn = computed(() => shouldShowActionColumn(
  canViewField('apply_time'),
  [canApprove.value]
))
```

判断矩阵：

| 字段 | 该列动作权限 | 字段列 | 按钮 |
| --- | --- | --- | --- |
| 开启 | 有 | 展示 | 在对应字段列展示已授权动作 |
| 关闭 | 有 | 展示 | 在对应字段列展示已授权动作 |
| 开启 | 无 | 展示 | 无动作按钮 |
| 关闭 | 无 | 隐藏 | 不展示 |

## 整站覆盖范围

后台业务模块的统计卡片、筛选项、表格列、移动卡片、详情、编辑表单、导出字段和字段参与的计算均必须调用字段权限判断。当前覆盖审计命令为：

```bash
cd frontend
npm run check:field-permissions
```

审计范围包含库存、销售、查询、客户、供应商、门店、员工、考勤、工资、国补、预定、维修、租赁、配件、付款、基础资料、统计分析、数据优化、营销、系统工具和 H5 管理子页面。权限管理内部的角色、用户、门店绑定和权限日志列表也按 `roles.*`、`users.*`、`store_bindings.*`、`logs.*` 字段控制。

H5 客户端的商品浏览、登录、注册、购物车和订单页面属于公开客户流程，不读取后台员工字段权限；它们由公开接口的数据白名单和客户身份范围控制。布局壳、加载页、404 页和只负责转发父组件权限的拆分组件不单独创建重复权限模块。

字段权限登记以 `frontend/src/config/moduleFields.js` 为准，接口/物理字段契约以 `config/field-contracts.json` 为准。新增页面字段必须同时补登记、页面判断和契约测试，不能只在表格列上临时增加 `v-if`。

## 三种使用方式

### 1. 指令方式（推荐）

最简单直接的方式，使用 `v-field-permission` 指令：

```vue
<template>
  <!-- 基础用法：控制字段可见性 -->
  <el-form-item
    v-field-permission="{ moduleKey: 'inventory_stockinpage', fieldName: 'purchase_cost' }"
    label="采购价格"
  >
    <el-input v-model="form.purchase_cost" />
  </el-form-item>

  <!-- 控制编辑权限 -->
  <el-input
    v-field-permission="{
      moduleKey: 'inventory_stockinpage',
      fieldName: 'purchase_cost',
      action: 'edit'
    }"
    v-model="form.purchase_cost"
  />

  <!-- 控制导出权限 -->
  <el-button
    v-field-permission="{
      moduleKey: 'inventory_stockinpage',
      fieldName: 'purchase_cost',
      action: 'export'
    }"
    @click="exportData"
  >
    导出数据
  </el-button>

  <!-- 使用禁用模式而不是隐藏 -->
  <el-input
    v-field-permission.disabled="{
      moduleKey: 'inventory_stockinpage',
      fieldName: 'purchase_cost',
      action: 'edit'
    }"
    v-model="form.purchase_cost"
  />
</template>
```

### 2. 组件包装方式

使用 `FieldPermissionWrapper` 组件包装需要权限控制的内容：

```vue
<template>
  <FieldPermissionWrapper
    module-key="inventory_stockinpage"
    field-name="purchase_cost"
    action="edit"
  >
    <el-form-item label="采购价格">
      <el-input v-model="form.purchase_cost" />
    </el-form-item>
  </FieldPermissionWrapper>

  <!-- 使用自定义占位符 -->
  <FieldPermissionWrapper
    module-key="inventory_stockinpage"
    field-name="purchase_cost"
  >
    <template #default>
      <el-input v-model="form.purchase_cost" />
    </template>
    <template #placeholder>
      <el-alert type="info" show-icon>
        <template #title>权限不足</template>
        您没有查看采购价格的权限
      </el-alert>
    </template>
  </FieldPermissionWrapper>
</template>

<script setup>
import FieldPermissionWrapper from '@/components/Permission/FieldPermissionWrapper.vue'
</script>
```

### 3. 组合式API方式

使用 `useFieldPermission` 组合式函数进行更灵活的控制：

```vue
<template>
  <div>
    <!-- 根据权限动态渲染 -->
    <el-form-item v-if="purchaseCostPermission.hasPermission.value" label="采购价格">
      <el-input v-model="form.purchase_cost" />
    </el-form-item>

    <!-- 显示权限状态 -->
    <el-tag v-if="purchaseCostPermission.loading.value" type="info">
      检查权限中...
    </el-tag>

    <!-- 批量权限检查 -->
    <template v-for="field in fields" :key="field.name">
      <el-form-item
        v-if="permissions.hasFieldPermission(field.name, 'view')"
        :label="field.label"
      >
        <el-input
          v-model="form[field.name]"
          :disabled="!permissions.hasFieldPermission(field.name, 'edit')"
        />
      </el-form-item>
    </template>
  </div>
</template>

<script setup>
import { useFieldPermission, useBatchFieldPermissions } from '@/composables/usePermission'

// 单个字段权限检查
const purchaseCostPermission = useFieldPermission({
  moduleKey: 'inventory_stockinpage',
  fieldName: 'purchase_cost',
  action: 'view'
})

// 批量字段权限检查
const fields = [
  { name: 'purchase_cost', label: '采购价格' },
  { name: 'sale_price', label: '销售价格' },
  { name: 'profit', label: '利润' }
]

const permissions = useBatchFieldPermissions(
  'inventory_stockinpage',
  fields.map(f => f.name)
)
</script>
```

## 参数说明

### v-field-permission 指令参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| moduleKey | string | 是 | 模块标识，对应后端配置中的键 |
| fieldName | string | 是 | 字段名称 |
| action | 'view' \| 'edit' \| 'export' | 否 | 权限类型，默认为 'view' |
| roleId | number | 否 | 角色ID，默认使用当前用户角色 |

### 修饰符

| 修饰符 | 说明 |
|--------|------|
| .disabled | 禁用元素而不是隐藏元素 |

## 模块标识参考

常用模块标识列表：

| 模块标识 | 模块名称 | 说明 |
|----------|----------|------|
| inventory_stockinpage | 采购入库 | 采购入库页面 |
| sales_phonesaleview | 销售开单 | 销售开单页面 |
| brands_brandsview | 品牌管理 | 品牌管理页面 |
| models_modelsview | 型号管理 | 型号管理页面 |
| colors_colorsview | 颜色管理 | 颜色管理页面 |
| memories_memoriesview | 内存管理 | 内存管理页面 |
| suppliers_suppliersview | 供应商管理 | 供应商管理页面 |
| customers_customersview | 客户管理 | 客户管理页面 |
| stores_storesview | 店铺管理 | 店铺管理页面 |
| employees_employeesview | 员工管理 | 员工管理页面 |

## 权限级别说明

权限级别从高到低：

1. **FULL** - 完全权限（可查看、可编辑、可导出）
2. **READ_ONLY** - 只读权限（可查看、可导出）
3. **LIMITED** - 受限权限（仅可查看部分信息）

## 敏感度级别

字段敏感度：

- **PUBLIC** - 公开信息（所有角色可见）
- **INTERNAL** - 内部信息（内部员工可见）
- **SENSITIVE** - 敏感信息（仅经理及以上可见）
- **CONFIDENTIAL** - 机密信息（仅超级管理员可见）

## 最佳实践

### 1. 在页面加载时预加载权限

```vue
<script setup>
import { onMounted } from 'vue'
import { preloadModulePermissions } from '@/directives/permission'

onMounted(async () => {
  // 预加载当前页面的所有字段权限
  await preloadModulePermissions('inventory_stockinpage')
})
</script>
```

### 2. 批量权限检查优化

对于有多个字段的页面，使用批量权限检查可以提高性能：

```javascript
import { useBatchFieldPermissions } from '@/composables/usePermission'

const { permissions, hasFieldPermission } = useBatchFieldPermissions(
  'inventory_stockinpage',
  ['purchase_cost', 'sale_price', 'profit', 'supplier_id']
)
```

### 3. 权限缓存管理

系统会自动缓存权限检查结果，但在某些情况下可能需要手动清除缓存：

```javascript
import { clearFieldPermissionCache } from '@/directives/permission'

// 用户切换角色后清除缓存
clearFieldPermissionCache()
```

### 4. 错误处理

```vue
<template>
  <FieldPermissionWrapper
    module-key="inventory_stockinpage"
    field-name="purchase_cost"
    @permission-error="handlePermissionError"
  >
    <el-input v-model="form.purchase_cost" />
  </FieldPermissionWrapper>
</template>

<script setup>
const handlePermissionError = (error) => {
  console.error('权限检查失败:', error)
  ElMessage.error('权限验证失败，请刷新页面重试')
}
</script>
```

## 常见问题

### Q: 为什么字段被隐藏了？

A: 可能的原因：
1. 用户的角色没有该字段的查看权限
2. 字段被标记为隐藏（is_hidden）
3. 字段的敏感度级别超出用户角色范围

### Q: 如何调试权限问题？

A: 可以在浏览器控制台查看权限相关的日志：

```javascript
// 查看当前用户角色
console.log('用户角色:', authStore.user?.role)

// 查看权限缓存
console.log('权限缓存:', permissionCache)
```

### Q: 权限检查的性能如何？

A: 系统使用了以下优化措施：
1. 权限结果缓存
2. 批量权限检查API
3. 懒加载权限检查
4. 预加载机制

## 示例代码

查看 `src/examples/permission-examples.vue` 获取更多示例代码。
