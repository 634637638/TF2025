# 权限提示系统测试页面

## 测试指令

### v-permission-tip 指令测试

```vue
<template>
  <div class="permission-test">
    <h3>权限提示指令测试</h3>

    <!-- 简单用法 -->
    <el-button
      v-permission-tip="'stores_storesview:view'"
      type="primary"
    >
      查看店铺（简单用法）
    </el-button>

    <!-- 完整用法 -->
    <el-button
      v-permission-tip="{
        permission: 'stores_storesview:create',
        moduleName: '店铺管理',
        action: 'create'
      }"
      type="success"
    >
      新增店铺（完整用法）
    </el-button>

    <!-- 编辑权限 -->
    <el-button
      v-permission-tip="{
        permission: 'stores_storesview:edit',
        moduleName: '店铺管理',
        action: 'edit'
      }"
      type="warning"
    >
      编辑店铺
    </el-button>

    <!-- 删除权限 -->
    <el-button
      v-permission-tip="{
        permission: 'stores_storesview:delete',
        moduleName: '店铺管理',
        action: 'delete'
      }"
      type="danger"
    >
      删除店铺
    </el-button>
  </div>
</template>

<script setup lang="ts">
// 无需导入，指令已在 main.ts 中全局注册
</script>
```

### Composable 函数测试

```vue
<template>
  <div class="permission-composable-test">
    <h3>Composable 函数测试</h3>

    <el-button @click="testViewPermission">
      测试查看权限
    </el-button>

    <el-button @click="testEditPermission">
      测试编辑权限
    </el-button>

    <el-button @click="testDeletePermission">
      测试删除权限
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { usePermissionToast } from '@/utils/permissionToastSimple'

const { showViewDenied, showEditDenied, showDeleteDenied } = usePermissionToast()

const testViewPermission = () => {
  showViewDenied('测试模块', 'test_module:view')
}

const testEditPermission = () => {
  showEditDenied('测试模块', 'test_module:edit')
}

const testDeletePermission = () => {
  showDeleteDenied('测试模块', 'test_module:delete')
}
</script>
```

## 权限检查逻辑

权限检查通过以下逻辑：

1. **从 localStorage 获取用户权限**
   ```javascript
   const userPermissions = JSON.parse(localStorage.getItem('user_permissions') || '[]')
   ```

2. **检查通配符权限**
   - `*` - 所有权限
   - `all:*` - 所有权限

3. **检查直接权限匹配**
   - 完全匹配权限字符串

## 样式效果

### 禁用状态样式

```scss
.permission-restricted {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 消息提示样式

```scss
.permission-notification {
  border-left: 4px solid #f56c6c;
}
```

## 快速开始

1. **在 main.ts 中已全局注册指令**
   ```typescript
   import { setupPermissionTipDirective } from '@/directives/permissionTip'
   setupPermissionTipDirective(app)
   ```

2. **在任何组件中使用**
   ```vue
   <el-button v-permission-tip="'stores_storesview:edit'">
     编辑
   </el-button>
   ```

3. **查看效果**
   - 有权限：按钮正常显示和点击
   - 无权限：按钮变灰，鼠标悬停显示禁用状态，点击显示友好提示

## 调试

如果权限提示不工作，检查：

1. **localStorage 中是否有用户权限**
   ```javascript
   console.log(JSON.parse(localStorage.getItem('user_permissions')))
   ```

2. **权限字符串格式是否正确**
   - 数据库格式：`stores_storesview:edit`
   - 使用下划线而不是连字符

3. **浏览器控制台是否有错误**
   - 检查是否有 JavaScript 错误
   - 检查指令是否正确注册
