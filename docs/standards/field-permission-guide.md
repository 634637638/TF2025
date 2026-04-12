# 字段权限控制使用指南

本文档介绍如何在TF2025前端项目中使用字段权限控制功能。

## 概述

字段权限控制允许您根据用户角色精确控制页面中每个字段的显示、编辑和导出权限。

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