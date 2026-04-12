# PermissionDenied 组件使用指南

## 概述

`PermissionDenied` 是一个统一的权限不足提示组件，用于在用户没有相应权限时显示友好的提示页面。

## 组件位置

```
frontend/src/components/PermissionDenied.vue
```

## 使用方法

### 1. 在页面中导入组件

```vue
<script setup lang="ts">
import PermissionDenied from '@/components/PermissionDenied.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>
```

### 2. 在模板中使用

```vue
<template>
  <div class="your-page">
    <!-- 有权限时显示内容 -->
    <template v-if="authStore.hasPermission('module:action')">
      <!-- 页面内容 -->
      <div class="page-content">
        <!-- 你的页面内容 -->
      </div>
    </template>

    <!-- 无权限时显示提示 -->
    <PermissionDenied v-else />
  </div>
</template>
```

## 完整示例

### 示例1：数据优化页面

```vue
<template>
  <div class="data-optimization-view">
    <template v-if="authStore.hasPermission('data_optimization:view')">
      <div class="page-header">
        <h1>数据优化</h1>
      </div>
      <!-- 页面内容 -->
    </template>

    <PermissionDenied v-else />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import PermissionDenied from '@/components/PermissionDenied.vue'

const authStore = useAuthStore()
</script>
```

### 示例2：销售管理页面

```vue
<template>
  <div class="sales-view">
    <template v-if="authStore.hasPermission('sales_salesview:view')">
      <!-- 销售管理内容 -->
    </template>

    <PermissionDenied v-else />
  </div>
</template>
```

### 示例3：多权限检查

```vue
<template>
  <div class="admin-view">
    <template v-if="canViewAdmin">
      <!-- 管理员内容 -->
    </template>

    <PermissionDenied v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import PermissionDenied from '@/components/PermissionDenied.vue'

const authStore = useAuthStore()

const canViewAdmin = computed(() =>
  authStore.hasPermission('system_systemview:view') ||
  authStore.hasPermission('users_usersview:view')
)
</script>
```

## 权限命名规范

权限名称格式：`module_key:action`

### 常用权限列表

| 模块 | 权限 | 说明 |
|------|------|------|
| system | system_systemview:view | 查看系统管理 |
| users | users_usersview:view | 查看用户列表 |
| users | users_usersview:create | 创建用户 |
| users | users_usersview:edit | 编辑用户 |
| users | users_usersview:delete | 删除用户 |
| roles | roles_rolesview:view | 查看角色列表 |
| roles | roles_rolesview:edit | 编辑角色 |
| sales | sales_salesview:view | 查看销售数据 |
| sales | sales_salesview:create | 创建销售订单 |
| inventory | inventory_inventoryview:view | 查看库存 |
| inventory | inventory_inventoryview:edit | 编辑库存 |
| data_optimization | data_optimization:view | 查看数据优化 |
| data_optimization | data_optimization:create | 创建导入任务 |
| query | query_queryview:view | 查看综合查询 |

## 组件特性

1. **自动返回**：点击"返回上一页"按钮会自动返回，如果无法返回则跳转到首页
2. **友好提示**：显示清晰的图标和说明文字
3. **解决方案**：提供可能的解决方案列表
4. **响应式设计**：在不同设备上都能良好显示

## 样式自定义

组件样式已内置在组件中，无需额外配置。如需自定义样式，可以：

1. 修改 `PermissionDenied.vue` 中的 `<style>` 部分
2. 或者通过 CSS 变量覆盖样式

## 注意事项

1. **权限检查时机**：在页面加载时立即检查权限
2. **路由守卫**：建议在路由守卫中也添加权限检查
3. **后端验证**：前端权限检查只是UI层面的，后端必须再次验证权限
4. **权限缓存**：权限信息会缓存在 authStore 中，登出时会清除

## 迁移指南

如果页面已有自定义的权限提示，可以替换为统一组件：

### 替换前

```vue
<template>
  <div v-if="hasPermission">
    <div class="content">页面内容</div>
  </div>
  <div v-else class="error">
    <h3>没有权限</h3>
    <p>请联系管理员</p>
    <button @click="goBack">返回</button>
  </div>
</template>
```

### 替换后

```vue
<template>
  <template v-if="hasPermission">
    <div class="content">页面内容</div>
  </template>
  <PermissionDenied v-else />
</template>

<script setup lang="ts">
import PermissionDenied from '@/components/PermissionDenied.vue'
</script>
```

## 相关文件

- 组件：`frontend/src/components/PermissionDenied.vue`
- 权限Store：`frontend/src/stores/auth.ts`
- 权限配置：`backend/permission_config.js`
