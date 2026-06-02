# PermissionGate 与无权限页面规范

> 最后更新：2026-05-31

## 当前规范

项目已不再使用 `PermissionDenied` / `PermissionAccessNotice` 这类页面内无权限卡片。

统一行为：

- 无权限点击菜单或顶部标签：顶部提示 `您没有访问此页面的权限`
- 不进入受限页面路径
- 不新增顶部标签
- 直接访问受限 URL 时，由路由守卫或 `PermissionGate` 兜底返回 `/dashboard`
- 页面内不展示“访问受限 / 权限代码 / 联系开通”等详细说明

## 页面写法

页面根部统一使用 `PermissionGate`：

```vue
<template>
  <PermissionGate
    :can-view="canView"
    module-name="型号管理"
    permission-code="models:view"
  >
    <PageHeader title="型号管理" />
    <div class="admin-page-content">
      页面内容
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { PageHeader, PermissionGate } from '@/components/base'
import { usePagePermissions } from '@/composables/usePagePermissions'

const { canView } = usePagePermissions('models')
</script>
```

## 路由权限必须同步

新增页面时，还需要在以下文件维护路由权限：

```text
frontend/src/constants/routePermissions.ts
```

示例：

```ts
'/models': ['models:view']
```

`routePermissions.ts` 的权限必须和页面 `PermissionGate` 的 `can-view` 逻辑一致。否则会出现菜单/标签判断允许，但页面自己又跳回首页的不一致。

## 多权限页面

如果一个页面允许多个查看权限进入，路由表可以配置多个权限，但必须与页面 computed 保持一致。

示例：工资管理页使用页面入口权限进入：

```ts
'/salary': ['salary:view']
```

页面内使用同样的入口逻辑：

```ts
const canAccessSalaryPage = computed(() => canViewSalaryPage.value)
```

## 导航入口

不要在组件里手写权限判断。所有菜单、标签、快捷入口跳转前统一使用：

```ts
import { canAccessRoutePath } from '@/constants/routePermissions'

if (!canAccessRoutePath(targetPath, authStore)) {
  ElMessage.warning('您没有访问此页面的权限')
  return
}
```

目前已接入：

- `frontend/src/router/guards.ts`
- `frontend/src/components/SimpleSidebar.vue`
- `frontend/src/composables/useMobileMenu.ts`
- `frontend/src/components/TabsBar.vue`
- `frontend/src/views/system/page/SimpleAdminView.vue`

## 维护检查

修改权限相关页面后，至少检查：

```bash
grep -R -n "PermissionDenied\\|PermissionAccessNotice" frontend/src
grep -R -n "访问受限\\|权限代码：\\|需要权限：" frontend/src
```

这两个扫描不应命中页面内旧提示。
