# 权限缓存刷新说明

## 问题描述

当您在权限管理页面 (`https://localhost:5176/permissions`) 修改了角色的权限配置后，其他用户（或您自己）在页面上看到的按钮可能还是旧的权限状态。这是因为：

1. **前端权限缓存**: 用户登录时，权限会被加载到浏览器缓存中
2. **指令缓存**: `v-permission` 指令使用缓存的权限数据
3. **实时性问题**: 权限修改后，需要刷新才能生效

## 解决方案

### 方案1: 自动刷新（已实现）

权限管理系统已经实现了自动刷新功能：

1. **修改自己的角色权限**: 当您在权限管理页面修改**当前登录用户所属角色**的权限时，系统会自动调用 `authStore.fetchUserInfo()` 刷新权限

2. **自动触发条件**:
   ```javascript
   // 在 PermissionsView.vue 中，保存权限后会检查：
   if (authStore.user?.role_id === selectedRoleId.value) {
     await authStore.fetchUserInfo() // 自动刷新当前用户权限
   }
   ```

### 方案2: 手动刷新（推荐用于测试）

如果您修改了其他角色的权限，或者想立即查看效果：

1. **重新登录**:
   - 退出登录
   - 重新登录
   - 系统会加载最新的权限

2. **刷新页面**:
   - 按 `Ctrl + R` (Windows) 或 `Cmd + R` (Mac)
   - 或点击浏览器的刷新按钮
   - 页面重新加载时会重新获取权限

### 方案3: 强制刷新权限缓存

在浏览器控制台执行：

```javascript
// 刷新权限并重新加载页面
import { useAuthStore } from '@/stores/auth'
const authStore = useAuthStore()
await authStore.fetchUserInfo()
window.location.reload()
```

或者在任意组件中：

```typescript
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const refreshPermissions = async () => {
  await authStore.fetchUserInfo()
  window.location.reload()
}
```

## 测试步骤

### 测试权限修改是否生效

1. **准备测试账户**:
   - 销售员账户: `3333` / `636363`
   - 管理员账户: `sadmin` / `123456`

2. **修改权限**:
   ```
   1. 使用管理员账户登录
   2. 访问权限管理页面: https://localhost:5176/permissions
   3. 选择"销售员"角色
   4. 取消勾选"subsidy:delete"权限
   5. 点击"保存权限配置"
   ```

3. **验证权限**:
   ```
   方式1 - 使用销售员账户:
   1. 退出登录
   2. 使用销售员账户(3333)登录
   3. 访问国补管理页面
   4. 检查"删除"按钮是否隐藏

   方式2 - 自动刷新(如果修改的是自己的角色):
   1. 保存权限后，系统会自动刷新
   2. 直接查看国补管理页面
   3. 按F12打开控制台，查看权限日志
   ```

## 调试方法

### 查看当前用户权限

在浏览器控制台执行：

```javascript
// 查看所有权限
import { useAuthStore } from '@/stores/auth'
const authStore = useAuthStore()
console.log('当前用户权限:', authStore.userPermissions)

// 检查特定权限
console.log('是否有删除权限:', authStore.hasPermission('subsidy:delete'))
console.log('是否有编辑权限:', authStore.hasPermission('subsidy:edit'))
```

### 验证权限指令

在控制台查看权限指令状态：

```javascript
// 查看所有带权限指令的元素
document.querySelectorAll('[v-permission], [v-cloak]')
```

## 常见问题

### Q1: 修改权限后，页面按钮还是显示/隐藏错误？

**A**: 这是因为浏览器缓存了权限数据。解决方法：
1. 退出登录后重新登录
2. 或者按 `Ctrl + Shift + R` 强制刷新页面（清除缓存）

### Q2: 权限管理页面保存成功，但权限没生效？

**A**: 检查以下几点：
1. 确认修改的是正确的角色
2. 确认当前登录用户属于该角色
3. 尝试退出登录后重新登录

### Q3: 如何实时查看权限变化？

**A**: 在开发环境中，可以在组件中添加权限监听：

```vue
<script setup>
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// 监听权限变化
watch(() => authStore.userPermissions, (newPerms) => {
  console.log('权限已更新:', newPerms)
  // 执行相应的更新操作
}, { deep: true })
</script>
```

## 最佳实践

1. **权限修改后立即测试**:
   - 修改权限后，使用被修改角色的测试账户登录
   - 验证页面按钮和功能是否符合预期

2. **定期清理缓存**:
   - 开发时，定期清除浏览器缓存
   - 或使用隐私/无痕模式测试

3. **使用明确的权限名称**:
   - 权限名称使用 `模块:操作` 格式，如 `subsidy:delete`
   - 避免使用模糊的权限名称

4. **测试所有权限组合**:
   - 测试有权限的情况
   - 测试无权限的情况
   - 测试部分权限的情况

## 技术细节

### 权限加载流程

```
1. 用户登录
   ↓
2. 调用 /auth/user 获取用户信息
   ↓
3. 调用 /permissions/user-permissions 获取权限列表
   ↓
4. 将权限保存到 authStore.permissions
   ↓
5. userPermissions (computed) 自动更新
   ↓
6. v-permission 指令读取最新权限
   ↓
7. 显示/隐藏对应元素
```

### 权限刷新触发时机

1. **用户登录** - 自动加载权限
2. **修改自己的角色权限** - 自动刷新权限
3. **调用 fetchUserInfo()** - 手动刷新权限
4. **页面刷新** - 重新加载权限

## 相关文件

- **权限指令**: `/frontend/src/directives/permissionDirective.ts`
- **权限Store**: `/frontend/src/stores/auth.ts`
- **权限管理页面**: `/frontend/src/views/permissions/PermissionsView.vue`
- **权限Composable**: `/frontend/src/composables/usePermissions.ts`

## 总结

权限系统的缓存机制是为了提高性能，但需要在权限修改后手动刷新。如果您在开发过程中频繁修改权限，建议：

1. 使用无痕模式测试
2. 或者修改代码，在权限修改成功后自动刷新页面
3. 或者在浏览器中安装"自动刷新"扩展

这样可以确保每次看到的都是最新的权限状态。
