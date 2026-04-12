# 友好版权限提示系统

## 概述

这个系统提供了友好的权限不足提示，让用户清楚地知道他们为什么无法执行某些操作。

## 使用方法

### 1. 使用权限指令

#### v-permission-tip 指令

在按钮或操作元素上使用 `v-permission-tip` 指令，当用户没有权限时：
- 元素会显示为禁用状态
- 点击时会显示友好的提示消息

```vue
<template>
  <!-- 简单用法 - 只提供权限字符串 -->
  <button v-permission-tip="'stores_storesview:edit'">
    编辑店铺
  </button>

  <!-- 完整用法 - 提供配置对象 -->
  <button
    v-permission-tip="{
      permission: 'stores_storesview:delete',
      moduleName: '店铺管理',
      action: 'delete'
    }"
  >
    删除店铺
  </button>

  <!-- 快捷用法 - 简写格式 -->
  <button v-permission-tip="{ permission: 'stores_storesview:create', moduleName: '店铺管理', action: 'create' }">
    新增店铺
  </button>
</template>
```

#### v-permission 指令（原有）

有权限时显示元素，无权限时隐藏：

```vue
<template>
  <button v-permission="'stores_storesview:edit'">
    编辑
  </button>
</template>
```

#### v-permission-not 指令（原有）

无权限时显示元素，有权限时隐藏：

```vue
<template>
  <div v-permission-not="'stores_storesview:view'">
    您没有查看权限
  </div>
</template>
```

### 2. 使用 Composable 函数

在 `<script setup>` 中使用权限提示函数：

```vue
<script setup lang="ts">
import { usePermissionToast } from '@/utils/permissionToastSimple'

const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()

// 手动检查权限并显示提示
const handleEdit = () => {
  const hasPermission = checkUserPermission('stores_storesview:edit')

  if (!hasPermission) {
    showEditDenied('店铺管理')
    return
  }

  // 执行编辑操作
  editStore()
}
</script>
```

### 3. 直接导入使用

```vue
<script setup lang="ts">
import { showViewDenied, showEditDenied } from '@/utils/permissionToastSimple'

const handleClick = () => {
  const hasPermission = checkPermission()

  if (!hasPermission) {
    showEditDenied('店铺管理', 'stores_storesview:edit')
    return
  }

  // 继续操作
}
</script>
```

## 权限操作类型

系统支持以下操作类型，每种类型都有对应的友好提示：

| 操作类型 | 说明 | 快捷方法 |
|---------|------|---------|
| `view` | 查看权限 | `showViewDenied()` |
| `create` | 创建权限 | `showCreateDenied()` |
| `edit` | 编辑权限 | `showEditDenied()` |
| `delete` | 删除权限 | `showDeleteDenied()` |
| `export` | 导出权限 | - |
| `import` | 导入权限 | - |

## 样式定制

权限受限的元素会自动添加以下样式：

- 透明度降低（50%）
- 鼠标样式变为 `not-allowed`
- 添加 `permission-restricted` 类

可以通过 CSS 自定义这些样式：

```scss
.permission-restricted {
  // 自定义禁用样式
  position: relative;

  &:hover::after {
    content: '🔒 权限不足';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 12px;
    border-radius: 4px;
    white-space: nowrap;
  }
}
```

## 提示消息样式

权限提示使用 Element Plus 的 Message 和 Notification 组件，默认样式：

- **Message**: 简短的权限提示，3秒后自动消失
- **Notification**: 详细的权限信息（包含权限代码），5秒后消失

## 最佳实践

1. **在按钮上使用指令**：对于常见的增删改查操作，使用 `v-permission-tip` 指令
2. **在复杂逻辑中使用函数**：对于复杂的权限检查逻辑，使用 Composable 函数
3. **提供清晰的模块名称**：让用户知道具体是哪个功能需要权限
4. **一致的操作类型**：使用正确的操作类型（view/create/edit/delete）以获得准确的提示文案

## 示例代码

```vue
<template>
  <div class="store-management">
    <!-- 新增按钮 -->
    <el-button
      type="primary"
      v-permission-tip="{
        permission: 'stores_storesview:create',
        moduleName: '店铺管理',
        action: 'create'
      }"
    >
      新增店铺
    </el-button>

    <!-- 编辑按钮 -->
    <el-button
      v-permission-tip="{
        permission: 'stores_storesview:edit',
        moduleName: '店铺管理',
        action: 'edit'
      }"
    >
      编辑
    </el-button>

    <!-- 删除按钮 -->
    <el-button
      type="danger"
      v-permission-tip="{
        permission: 'stores_storesview:delete',
        moduleName: '店铺管理',
        action: 'delete'
      }"
    >
      删除
    </el-button>

    <!-- 导出按钮 -->
    <el-button
      v-permission-tip="'stores_storesview:export'"
    >
      导出数据
    </el-button>
  </div>
</template>
```

## 注意事项

1. 权限字符串必须与数据库中的权限格式一致
2. `moduleName` 应该提供清晰的中文名称，便于用户理解
3. 指令会自动检查权限，不需要手动调用权限检查函数
4. 对于复杂的权限逻辑，建议使用 Composable 函数而不是指令
