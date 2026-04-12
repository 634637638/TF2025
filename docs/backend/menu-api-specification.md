# 统一菜单API规范

## 概述

已将所有菜单获取逻辑统一到 `unifiedMenu.service.js`，确保手机端和PC端使用相同的数据源和权限过滤逻辑。

## 统一服务

**文件位置**: `/backend/src/services/unifiedMenu.service.js`

**主要功能**:
- `getUserMenus(req)` - 获取用户菜单（树形结构）
- `getFlatUserMenus(req)` - 获取用户菜单（扁平结构）

## API路由

当前用户菜单入口已统一收口到权限路由：

### 1. `/api/permissions/user-menu`
- **用途**: 获取用户菜单（兼容旧格式）
- **方法**: GET
- **认证**: 需要 JWT Token
- **响应格式**:
```json
{
  "success": true,
  "data": {
    "menuPermissions": [...]
  }
}
```

### 2. `/api/menus/*`
- **用途**: 菜单管理后台 CRUD
- **说明**: 仅用于菜单维护，不再承担“按当前登录用户返回可见菜单”的职责

## 权限过滤逻辑

统一菜单服务使用以下逻辑过滤菜单：

1. **管理员角色**: 显示所有菜单
   - 条件: `role_type = 'system' AND hierarchy_level >= 90`

2. **普通用户**: 根据权限显示菜单
   - 查询条件:
     - `permission_type = 'menu_view'`
     - `menu_visible = 1`
     - 通过 `module_id` 关联菜单

3. **无模块菜单**: 对所有用户可见
   - 条件: `module_id IS NULL AND module_key IS NULL`

## 前端调用建议

### 推荐使用统一的API

```javascript
import { unifiedApi } from '@/utils/unified-api';

const getUserMenus = async () => {
  const response = await unifiedApi.get('/permissions/user-menu');
  if (response.success) {
    return response.data?.menuPermissions || [];
  }
  return [];
};
```

### 兼容性

当前推荐且实际使用的接口只有：
- `/api/permissions/user-menu`

历史兼容入口已废弃，不建议继续保留或新增依赖。

## 更新记录

- **2025-01-06**: 创建统一菜单服务
  - 整合了 `menuPermissionFilter.js` 的权限过滤逻辑
  - 整合了 `simple.menu.service.js` 的菜单构建逻辑
  - 整合了 `menu.service.compatible.js` 的数据库查询逻辑
  - 所有路由统一使用 `unifiedMenu.service.js`

## 注意事项

1. **权限配置**: 新增菜单时，需要：
   - 在 `menus` 表中创建菜单记录，设置 `module_id`
   - 在 `modules` 表中创建模块记录
   - 在 `role_permissions` 表中为角色分配 `menu_view` 权限

2. **module_id 匹配**: 确保：
   - `menus.module_id` = `modules.id`
   - `role_permissions.module_id` = `modules.id`

3. **缓存**: 前端应自行处理菜单缓存，后端不提供缓存机制
