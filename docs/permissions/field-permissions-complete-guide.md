# TF2025 字段级权限控制完整指南

## 📖 概述

字段级权限控制允许系统管理员根据用户角色隐藏或保护敏感字段，实现细粒度的数据访问控制。本文档详细说明字段权限的实现原理、配置方法和使用规范。

## 🎯 应用场景

### 典型使用场景

| 场景 | 说明 | 示例 |
|------|------|------|
| **价格保护** | 销售员不能看到采购价、成本价 | 隐藏 `price_info.purchase_price` |
| **客户隐私** | 保护客户敏感信息 | 隐藏 `customer_info.customer_phone`, `customer_info.apple_id` |
| **供应商保密** | 普通员工不能看到供应商信息 | 隐藏 `supplier_info.supplier_name` |
| **跨门店数据隔离** | 限制查看其他门店信息 | 隐藏 `store_info.store_name` |

## 📊 数据库设计

### 核心表结构

#### 1. role_field_permissions (角色字段权限表)

**作用**: 存储角色对特定模块的字段访问权限配置

```sql
CREATE TABLE `role_field_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL COMMENT '角色ID',
  `role_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '角色名称',
  `module_key` varchar(100) NOT NULL COMMENT '模块标识 (如: query_queryview)',
  `field_key` varchar(200) DEFAULT NULL COMMENT '字段标识 (可选)',
  `can_view` tinyint(1) DEFAULT 1 COMMENT '是否可查看',
  `can_edit` tinyint(1) DEFAULT 1 COMMENT '是否可编辑',
  `can_search` tinyint(1) DEFAULT 1 COMMENT '是否可搜索',
  `can_export` tinyint(1) DEFAULT 1 COMMENT '是否可导出',
  `is_hidden` tinyint(1) DEFAULT 0 COMMENT '是否隐藏字段',
  `permission_level` enum('FULL','PARTIAL','READ_ONLY','HIDDEN') DEFAULT 'FULL' COMMENT '权限级别',
  `field_config` json DEFAULT NULL COMMENT '字段权限配置 (JSON格式)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_module` (`role_id`,`module_key`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_module_key` (`module_key`),
  CONSTRAINT `fk_field_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色字段权限配置表';
```

#### 2. 字段配置格式 (field_config)

**JSON 格式说明**:

```json
{
  "hiddenFields": [
    "supplier_info.supplier_name",
    "store_info.store_name",
    "price_info.purchase_price",
    "customer_info.customer_phone"
  ],
  "readonlyFields": [
    "basic_info.imei"
  ],
  "description": "权限配置说明"
}
```

**字段说明**:
- `hiddenFields`: 需要隐藏的字段标识数组
- `readonlyFields`: 只读字段数组 (可选)
- `description`: 配置说明 (可选)

## 🔄 完整实现流程

### 流程图

```
┌─────────────────────────────────────────────────────────────┐
│  1. 管理员配置字段权限                                         │
│     进入权限管理页面 → 选择角色 → 配置字段权限                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  2. 保存到数据库                                               │
│     INSERT/UPDATE role_field_permissions                      │
│     SET field_config = '{"hiddenFields": [...]}'             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  3. 用户登录系统                                               │
│     后端返回用户权限 → 前端保存到 authStore                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  4. 前端加载字段权限                                           │
│     GET /api/permissions/user-field-permissions               │
│     保存到 fieldPermissions composable                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  5. 页面渲染时检查权限                                         │
│     v-if="shouldShowField('field_key')"                      │
│     隐藏的字段不会显示                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  6. 后端数据过滤 (可选)                                        │
│     dataMaskingService.maskDataList()                        │
│     从返回的数据中移除隐藏字段的值                             │
└─────────────────────────────────────────────────────────────┘
```

### 详细实现步骤

#### 步骤 1: 数据库配置

**示例: 为销售员角色配置综合查询的字段权限**

```sql
-- 查询销售员角色的ID
SELECT id, name FROM roles WHERE name LIKE '%销售%';
-- 假设返回: id=2, name='销售员'

-- 配置字段权限 (隐藏供应商和店铺)
INSERT INTO role_field_permissions (
  role_id,
  role_name,
  module_key,
  field_config,
  created_at,
  updated_at
) VALUES (
  2,
  '销售员',
  'query_queryview',
  '{"hiddenFields": ["supplier_info.supplier_name", "store_info.store_name"]}',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE
  field_config = '{"hiddenFields": ["supplier_info.supplier_name", "store_info.store_name"]}',
  updated_at = NOW();
```

#### 步骤 2: 后端 API 实现

**API 端点**: `GET /api/permissions/user-field-permissions`

**实现代码** (`backend/routes/permissionManagement.js`):

```javascript
// 获取用户的字段权限
router.get('/user-field-permissions', unifiedAuth, async (req, res) => {
  const userId = req.user.id;
  const pool = getDatabase();

  try {
    // 1. 获取用户的所有角色
    const [userRoles] = await pool.execute(`
      SELECT DISTINCT ur.role_id, r.name as role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ? AND r.is_active = 1
    `, [userId]);

    if (userRoles.length === 0) {
      return res.json({
        success: true,
        data: { fieldPermissions: {} }
      });
    }

    const roleIds = userRoles.map(r => r.role_id);
    const placeholders = roleIds.map(() => '?').join(',');

    // 2. 获取角色的字段权限配置
    const [fieldPermissions] = await pool.execute(`
      SELECT
        role_id,
        module_key,
        field_config
      FROM role_field_permissions
      WHERE role_id IN (${placeholders})
      ORDER BY module_key
    `, roleIds);

    // 3. 合并所有角色的权限 (取最严格 - hiddenFields 取并集)
    const mergedPermissions = {};

    fieldPermissions.forEach(perm => {
      const { module_key, field_config } = perm;

      if (!mergedPermissions[module_key]) {
        mergedPermissions[module_key] = {
          moduleKey: module_key,
          hiddenFields: new Set(),
          roleSources: []
        };
      }

      if (field_config) {
        try {
          const config = typeof field_config === 'object'
            ? field_config
            : JSON.parse(field_config || '{}');

          if (config.hiddenFields && Array.isArray(config.hiddenFields)) {
            config.hiddenFields.forEach(field => {
              mergedPermissions[module_key].hiddenFields.add(field);
            });
          }

          mergedPermissions[module_key].roleSources.push(perm.role_id);
        } catch (error) {
          console.warn('解析 field_config 失败:', field_config);
        }
      }
    });

    // 4. 转换 Set 为 Array
    const result = {};
    Object.keys(mergedPermissions).forEach(key => {
      result[key] = {
        moduleKey: mergedPermissions[key].moduleKey,
        hiddenFields: Array.from(mergedPermissions[key].hiddenFields),
        roleSources: mergedPermissions[key].roleSources
      };
    });

    res.json({
      success: true,
      data: {
        fieldPermissions: result
      }
    });

  } catch (error) {
    console.error('获取用户字段权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取字段权限失败'
    });
  }
});
```

#### 步骤 3: 前端 Composable 实现

**文件**: `frontend/src/composables/useFieldPermissions.ts`

```typescript
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi as api } from '@/utils/unified-api'

export function useFieldPermissions() {
  const authStore = useAuthStore()
  const loading = ref(false)
  const permissions = ref<Record<string, any>>({})

  /**
   * 获取模块的字段权限
   */
  const getModuleFieldPermissions = (moduleKey: string) => {
    return permissions.value[moduleKey] || { hiddenFields: [] }
  }

  /**
   * 检查字段是否可见
   * @param moduleKey 模块标识 (如: 'query_queryview')
   * @param fieldKey 字段标识 (如: 'supplier_info.supplier_name')
   * @returns boolean true=可见, false=隐藏
   */
  const isFieldVisible = (moduleKey: string, fieldKey: string) => {
    const modulePerms = getModuleFieldPermissions(moduleKey)
    const hiddenFields = modulePerms.hiddenFields || []
    return !hiddenFields.includes(fieldKey)
  }

  /**
   * 获取用户的所有字段权限
   */
  const fetchUserFieldPermissions = async () => {
    if (!authStore.token) {
      return
    }

    loading.value = true
    try {
      const response = await api.get('/permissions/user-field-permissions')

      if (response.success) {
        const rawPermissions = response.data.fieldPermissions || {}
        const processedPermissions: Record<string, any> = {}

        Object.keys(rawPermissions).forEach(key => {
          const modulePerm = rawPermissions[key]
          processedPermissions[key] = {
            hiddenFields: modulePerm.hiddenFields || []
          }
        })

        permissions.value = processedPermissions
      }
    } catch (error) {
      console.error('获取字段权限失败:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 初始化 - 从服务器获取权限
   */
  const init = async () => {
    if (authStore.token) {
      await fetchUserFieldPermissions()
    }
  }

  return {
    loading: computed(() => loading.value),
    permissions: computed(() => permissions.value),
    getModuleFieldPermissions,
    isFieldVisible,
    fetchUserFieldPermissions,
    init
  }
}

// 全局实例
export const fieldPermissions = useFieldPermissions()
```

#### 步骤 4: Vue 页面使用

**文件**: `frontend/src/views/query/QueryView.vue`

```vue
<template>
  <div class="query-view">
    <!-- 表格显示 - 根据字段权限动态显示列 -->
    <table>
      <thead>
        <tr>
          <th>品牌</th>
          <th>型号</th>
          <!-- 使用 v-if 控制列显示 -->
          <th v-if="shouldShowField('supplier_info.supplier_name')">
            供应商
          </th>
          <th v-if="shouldShowField('store_info.store_name')">
            店铺
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in queryData" :key="item.id">
          <td>{{ item.品牌 }}</td>
          <td>{{ item.型号 }}</td>
          <!-- 隐藏字段不会显示 -->
          <td v-if="shouldShowField('supplier_info.supplier_name')">
            {{ item.供应商信息?.supplier_name || '-' }}
          </td>
          <td v-if="shouldShowField('store_info.store_name')">
            {{ item.店铺信息?.store_name || '-' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fieldPermissions } from '@/composables/useFieldPermissions'

// 检查字段是否应该显示
const shouldShowField = (fieldId: string) => {
  return fieldPermissions.isFieldVisible('query_queryview', fieldId)
}

// 页面加载时初始化字段权限
onMounted(async () => {
  await fieldPermissions.init()
})
</script>
```

## 📋 字段标识规范

### 命名格式

**格式**: `{分组}_{类型}.{字段名}`

### 常用字段标识对照表

| 显示名称 | 字段标识 | 数据路径 | 说明 |
|---------|---------|---------|------|
| **基本信息** ||||
| 品牌 | `basic_info.brand` | `item.基本信息?.brand` | 手机品牌 |
| 型号 | `basic_info.model` | `item.基本信息?.model` | 手机型号 |
| 颜色 | `basic_info.color` | `item.基本信息?.color` | 手机颜色 |
| 内存 | `basic_info.memory` | `item.基本信息?.memory` | 手机内存 |
| IMEI | `basic_info.imei` | `item.基本信息?.imei` | 手机IMEI码 |
| 序列号 | `basic_info.serial_number` | `item.基本信息?.serial_number` | 序列号 |
| 是否全新 | `basic_info.is_new` | `item.基本信息?.is_new` | 新旧状态 |
| **价格信息** ||||
| 采购价 | `price_info.purchase_price` | `item.价格信息?.purchase_price` | 采购价格 |
| 销售价 | `price_info.sale_price` | `item.价格信息?.sale_price` | 销售价格 |
| 成本价 | `price_info.cost_price` | `item.价格信息?.cost_price` | 成本价格 |
| 利润 | `price_info.profit` | `item.价格信息?.profit` | 利润 |
| **供应商信息** ||||
| 供应商名称 | `supplier_info.supplier_name` | `item.供应商信息?.supplier_name` | 供应商 |
| 供应商联系方式 | `supplier_info.contact` | `item.供应商信息?.contact` | 联系方式 |
| **客户信息** ||||
| 客户姓名 | `customer_info.customer_name` | `item.客户信息?.customer_name` | 客户 |
| 客户电话 | `customer_info.customer_phone` | `item.客户信息?.customer_phone` | 电话 |
| Apple ID | `customer_info.apple_id` | `item.客户信息?.apple_id` | Apple ID |
| **店铺信息** ||||
| 店铺名称 | `store_info.store_name` | `item.店铺信息?.store_name` | 店铺 |
| 店铺地址 | `store_info.address` | `item.店铺信息?.address` | 地址 |
| **操作员信息** ||||
| 入库操作员 | `operator_info.inventory_operator` | `item.操作员信息?.inventory_operator_name` | 入库员 |
| 销售操作员 | `operator_info.sale_operator` | `item.操作员信息?.sale_operator_name` | 销售员 |
| **时间信息** ||||
| 入库时间 | `time_info.Inventorytime` | `item.时间信息?.Inventorytime` | 入库日期 |
| 销售时间 | `time_info.salestime` | `item.时间信息?.salestime` | 销售日期 |
| **其他信息** ||||
| 备注 | `other_info.remarks` | `item.基本信息?.remarks` | 备注 |
| 操作 | `system_info.operations` | - | 操作列 |

### 添加新字段标识

当需要添加新的字段标识时，遵循以下步骤:

1. **确定字段分组**: 选择合适的分组 (basic_info, price_info, etc.)
2. **创建标识**: 使用 `{分组}_{类型}.{字段名}` 格式
3. **更新配置**: 在需要隐藏的角色的 `field_config` 中添加
4. **前端实现**: 在模板中使用 `shouldShowField()` 检查

**示例**:
```javascript
// 1. 定义新字段标识
const fieldId = 'basic_info.warranty'  // 质保

// 2. 配置隐藏
{
  "hiddenFields": ["basic_info.warranty"]
}

// 3. 前端使用
<td v-if="shouldShowField('basic_info.warranty')">
  {{ item.基本信息?.warranty || '-' }}
</td>
```

## 🎨 管理界面配置

### 通过权限管理页面配置

1. **进入权限管理页面**
   - 导航: `/permissions`
   - 需要 `permissions_permissionsview:view` 权限

2. **选择角色**
   - 从角色列表中选择要配置的角色
   - 例如: "销售员"

3. **选择模块**
   - 从模块列表中选择要配置的模块
   - 例如: "综合查询" (`query_queryview`)

4. **配置隐藏字段**
   - 在字段权限配置区域
   - 勾选需要隐藏的字段
   - 例如: ☑ 供应商、☑ 店铺

5. **保存配置**
   - 点击"保存"按钮
   - 系统自动更新 `role_field_permissions` 表

### API 配置方式

**API 端点**: `POST /api/permissions/set-field-permissions`

**请求格式**:
```json
{
  "roleId": 2,
  "modulePermissions": {
    "query_queryview": {
      "hiddenFields": [
        "supplier_info.supplier_name",
        "store_info.store_name"
      ]
    }
  }
}
```

**响应格式**:
```json
{
  "success": true,
  "message": "字段权限配置成功",
  "data": {
    "updated": 1,
    "moduleKey": "query_queryview"
  }
}
```

## 🔍 调试和验证

### 1. 检查数据库配置

```sql
-- 查看角色的字段权限配置
SELECT
  role_id,
  role_name,
  module_key,
  field_config
FROM role_field_permissions
WHERE role_id = 2  -- 销售员角色
  AND module_key = 'query_queryview';
```

### 2. 检查 API 返回

打开浏览器开发者工具 → Network → 找到 `user-field-permissions` 请求:

```javascript
// 在控制台查看返回的数据
console.log(fieldPermissions.permissions.value)
// 预期输出:
{
  query_queryview: {
    hiddenFields: [
      "supplier_info.supplier_name",
      "store_info.store_name"
    ]
  }
}
```

### 3. 验证前端隐藏效果

```javascript
// 在浏览器控制台测试
import { fieldPermissions } from '@/composables/useFieldPermissions'

// 测试字段可见性
console.log(fieldPermissions.isFieldVisible('query_queryview', 'supplier_info.supplier_name'))
// 输出: false (已隐藏)

console.log(fieldPermissions.isFieldVisible('query_queryview', 'basic_info.brand'))
// 输出: true (可见)
```

### 4. 清除字段权限缓存

如果修改了权限配置但前端没有生效,可能需要清除缓存:

```javascript
// 方法 1: 重新登录
// 登出 → 登录

// 方法 2: 手动刷新权限
import { fieldPermissions } from '@/composables/useFieldPermissions'
await fieldPermissions.init()
```

## 📊 常见配置示例

### 示例 1: 销售员角色配置

**角色**: 销售员 (role_id=2)
**模块**: 综合查询 (query_queryview)

```json
{
  "hiddenFields": [
    "supplier_info.supplier_name",
    "store_info.store_name",
    "price_info.purchase_price",
    "price_info.cost_price"
  ]
}
```

**说明**: 销售员不能看到供应商、店铺、采购价和成本价

### 示例 2: 库管员角色配置

**角色**: 库管员 (role_id=3)
**模块**: 综合查询 (query_queryview)

```json
{
  "hiddenFields": [
    "customer_info.customer_phone",
    "customer_info.apple_id",
    "price_info.sale_price",
    "price_info.profit"
  ]
}
```

**说明**: 库管员不能看到客户隐私信息和销售利润相关字段

### 示例 3: 超级管理员配置

**角色**: 超级管理员 (role_id=9)
**模块**: 综合查询 (query_queryview)

```json
{
  "hiddenFields": []
}
```

**说明**: 超级管理员可以看到所有字段 (空数组 = 无隐藏)

## ⚠️ 注意事项

### 1. 权限合并规则

当一个用户有多个角色时,字段权限合并规则:
- **hiddenFields**: 取所有角色的**并集** (最严格)
- 如果任何一个角色隐藏了某个字段,该字段就被隐藏

**示例**:
```javascript
// 用户同时有"销售员"和"库管员"两个角色

// 销售员配置
{
  "hiddenFields": ["supplier_info.supplier_name"]
}

// 库管员配置
{
  "hiddenFields": ["price_info.sale_price"]
}

// 最终结果 (合并后)
{
  "hiddenFields": [
    "supplier_info.supplier_name",
    "price_info.sale_price"
  ]
}
```

### 2. 前端隐藏 ≠ 后端安全

**重要**: 前端隐藏只是用户体验优化,不是安全措施!

**安全实践**:
```javascript
// ✅ 正确: 前后端都做权限检查
// 1. 前端: 使用 v-if 隐藏字段
<td v-if="shouldShowField('price_info.purchase_price')">
  {{ price }}
</td>

// 2. 后端: 在返回数据前过滤敏感字段
// dataMaskingService.maskDataList(data, userId, moduleKey)
```

### 3. 字段标识必须一致

前端使用的字段标识必须与数据库 `field_config` 中的完全一致:

```javascript
// ✅ 正确: 前后端一致
// 数据库配置
{"hiddenFields": ["supplier_info.supplier_name"]}

// 前端使用
shouldShowField('supplier_info.supplier_name')

// ❌ 错误: 标识不一致
// 数据库配置
{"hiddenFields": ["supplier"]}

// 前端使用
shouldShowField('supplier_info.supplier_name')  // 无法匹配!
```

### 4. 模块标识规范

**模块标识格式**: `{功能}_{视图}`

| 功能 | 视图 | 模块标识 |
|------|-----|---------|
| 综合查询 | queryview | `query_queryview` |
| 销售管理 | salesview | `sales_salesview` |
| 库存管理 | inventoryview | `inventory_inventoryview` |
| 客户管理 | customersview | `customers_customersview` |

## 🔧 故障排查

### 问题 1: 字段没有隐藏

**可能原因**:
1. `field_config` 配置未保存
2. 字段标识不匹配
3. 前端缓存未更新

**解决方法**:
```sql
-- 1. 检查数据库配置
SELECT field_config FROM role_field_permissions
WHERE role_id = 2 AND module_key = 'query_queryview';

-- 2. 确认字段标识正确
-- 前端使用: supplier_info.supplier_name
-- 数据库配置必须是: "supplier_info.supplier_name"

-- 3. 清除浏览器缓存并重新登录
```

### 问题 2: 隐藏了不该隐藏的字段

**可能原因**:
1. 用户有多个角色,权限合并导致
2. 配置了错误的字段标识

**解决方法**:
```javascript
// 1. 检查用户的所有角色
console.log('用户角色:', authStore.user?.roles)

// 2. 检查所有角色的字段权限
console.log('字段权限:', fieldPermissions.permissions.value)

// 3. 修正配置,移除错误的字段标识
```

### 问题 3: API 返回空权限

**可能原因**:
1. 用户没有分配角色
2. 角色没有配置字段权限
3. API 路由配置错误

**解决方法**:
```sql
-- 1. 检查用户角色
SELECT r.* FROM roles r
JOIN user_roles ur ON ur.role_id = r.id
WHERE ur.user_id = ?;

-- 2. 检查角色字段权限配置
SELECT * FROM role_field_permissions
WHERE role_id IN (用户的所有角色ID);

-- 3. 确认 API 路由正常
GET /api/permissions/user-field-permissions
```

## 📚 相关文档

- [权限系统统一指南](./permission-system-guide.md)
- [权限缓存刷新机制](./permission-cache-refresh.md)
- [补助字段权限示例](./subsidy-field-permissions.md)

## 🎓 最佳实践

1. **统一字段标识**: 全局使用统一的字段标识命名规范
2. **最小权限原则**: 默认显示所有字段,只隐藏敏感字段
3. **权限审查**: 定期审查字段权限配置,确保符合业务需求
4. **文档同步**: 修改字段权限后及时更新相关文档
5. **测试验证**: 配置后用不同角色账户测试验证

---

**文档版本**: v1.0
**最后更新**: 2026-01-05
**维护者**: TF2025 开发团队
