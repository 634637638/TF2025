# 数据库模块映射表

> 本文档详细说明了项目中所有模块与云端数据库表的对应关系

## 📊 数据库环境

- **数据库类型**: MySQL 8.0+
- **部署方式**: 云端数据库
- **配置文件**: [backend/.env.production](../../backend/.env.production)
- **连接配置**: [backend/src/config/db.js](../../backend/src/config/db.js)

---

## 🗂️ 完整模块与数据表映射

### 核心业务模块

| 模块名称 | 模块标识 | 数据表 | 功能说明 |
|---------|---------|--------|---------|
| 仪表板 | DASHBOARD | `dashboards` | 系统概览、统计数据展示、销售趋势、库存预警 |
| 库存管理 | INVENTORY | `inventory` | 库存查询、库存记录管理、库存出入库操作 |
| 销售管理 | SALES | `sales`, `sales_phones` | 手机销售记录、销售统计、销售查询 |
| 客户管理 | CUSTOMERS | `customers` | 客户信息管理、客户查询、客户统计分析 |
| 采购入库 | STOCK_IN | `stock_in` | 采购入库操作、入库记录管理 |
| 预定管理 | PREORDERS | `preorders` | 手机预定管理、预定匹配流程 |
| 考勤管理 | ATTENDANCE | `attendance`, `leave_records` | 员工考勤记录、请假管理 |

### 商品基础数据模块

| 模块名称 | 模块标识 | 数据表 | 功能说明 |
|---------|---------|--------|---------|
| 品牌管理 | BRANDS | `brands` | 品牌信息管理、品牌列表展示 |
| 型号管理 | MODELS | `models` | 手机型号管理、型号与品牌关联 |
| 颜色管理 | COLORS | `colors` | 颜色选项管理、颜色列表展示 |
| 内存管理 | MEMORIES | `memories` | 内存规格管理、内存选项配置 |
| 配件管理 | ACCESSORIES | `accessories` | 配件库存管理、配件销售记录 |
| 手机管理 | PHONES | `phones` | 手机库存管理、手机信息维护 |

### 组织架构模块

| 模块名称 | 模块标识 | 数据表 | 功能说明 |
|---------|---------|--------|---------|
| 员工管理 | EMPLOYEES | `employees` | 员工信息管理、员工权限分配 |
| 店铺管理 | STORES | `stores` | 店铺信息管理、店铺配置设置 |
| 用户管理 | USERS | `users` | 系统用户管理、用户权限设置 |
| 操作员分配 | OPERATORS | `operators` | 操作员分配、操作员管理 |

### 供应商与财务模块

| 模块名称 | 模块标识 | 数据表 | 功能说明 |
|---------|---------|--------|---------|
| 供应商管理 | SUPPLIERS | `suppliers` | 供应商信息管理、供应商采购记录 |
| 供应商付款 | SUPPLIER_PAYMENTS | `supplier_payments` | 供应商付款管理、付款审批流程 |
| 工资记录 | SALARY_RECORDS | `salary_records` | 工资记录管理、工资计算 |
| 补贴管理 | SUBSIDY | `subsidy_records` | 员工补贴记录、补贴统计 |

### 权限与系统模块

| 模块名称 | 模块标识 | 数据表 | 功能说明 |
|---------|---------|--------|---------|
| 权限管理 | PERMISSIONS | `permissions`, `roles`, `role_permissions` | 权限配置、角色管理、权限分配 |
| 模块管理 | MODULE_MANAGEMENT | `modules`, `menu_modules` | 系统模块配置、模块权限设置 |
| 菜单管理 | MENU | `menus`, `menu_modules` | 菜单配置、菜单权限管理 |
| 系统设置 | SYSTEM | `settings`, `system_settings` | 系统参数配置、系统全局设置 |
| 权限日志 | PERMISSION_LOGS | `permission_operation_logs` | 权限操作日志、审计追踪 |

### 高级功能模块

| 模块名称 | 模块标识 | 数据表 | 功能说明 |
|---------|---------|--------|---------|
| 综合查询 | QUERY | 多表联合查询 | 数据综合查询、报表生成 |
| 数据分析 | ANALYTICS | 多表统计分析 | 业务数据分析、趋势分析 |
| 调货管理 | TRANSFERS | `transfers` | 店铺间调货管理、调货记录 |
| 数据优化 | DATA_OPTIMIZATION | `import_history`, `data_migration` | 数据导入、数据同步、数据优化 |
| 维修管理 | REPAIRS | `repairs` | 维修记录管理、维修进度跟踪 |
| 租赁管理 | RENTALS | `rentals` | 设备租赁管理、租赁合同 |

---

## 🔗 主要表关联关系

### phones（手机主表）关联关系

```
phones
├── brand_id          → brands.id          (品牌)
├── model_id          → models.id          (型号)
├── color_id          → colors.id          (颜色)
├── memory_id         → memories.id        (内存)
├── supplier_id       → suppliers.id       (供应商)
├── store_id          → stores.id          (店铺)
├── preorder_id       → preorders.id       (预定记录)
└── operator_id       → users.id           (操作员)
```

### sales（销售表）关联关系

```
sales / sales_phones
├── customer_id       → customers.id       (客户)
├── phone_id          → phones.id          (手机)
├── store_id          → stores.id          (店铺)
└── operator_id       → users.id           (操作员)
```

### preorders（预定表）关联关系

```
preorders
├── customer_id       → customers.id       (客户)
├── brand_id          → brands.id          (品牌)
├── model_id          → models.id          (型号)
├── color_id          → colors.id          (颜色)
├── memory_id         → memories.id        (内存)
├── matched_phone_id  → phones.id          (匹配的手机)
├── store_id          → stores.id          (店铺)
└── operator_id       → users.id           (操作员)
```

### users（用户表）关联关系

```
users
├── store_id          → stores.id          (所属店铺)
├── role_id           → roles.id           (角色)
└── employee_id       → employees.id       (员工信息)
```

### accessories（配件表）关联关系

```
accessories
├── brand_id          → brands.id          (品牌)
├── supplier_id       → suppliers.id       (供应商)
└── store_id          → stores.id          (店铺)
```

### transfers（调货表）关联关系

```
transfers
├── phone_id          → phones.id          (手机)
├── from_store_id     → stores.id          (调出店铺)
├── to_store_id       → stores.id          (调入店铺)
└── operator_id       → users.id           (操作员)
```

---

## 🔄 核心业务流程

### 1. 采购流程
```
suppliers (供应商)
    ↓
phones (手机入库)
    ↓
inventory (库存记录)
```

### 2. 销售流程
```
customers (客户)
    ↓
preorders (预定) → phones (匹配库存)
    ↓
sales / sales_phones (销售记录)
    ↓
inventory (库存扣减)
```

### 3. 调货流程
```
phones (查询库存)
    ↓
transfers (创建调货单)
    ↓
stores (店铺库存变更)
```

### 4. 预定流程
```
customers (客户需求)
    ↓
preorders (创建预定)
    ↓
phones (匹配手机库存)
    ↓
sales (转为销售)
```

---

## 📋 表字段权限配置

部分模块支持字段级别的权限控制，详见：

- [字段权限完整指南](../permissions/field-permissions-complete-guide.md)
- [补贴字段权限](../permissions/subsidy-field-permissions.md)

### 支持字段权限的模块

| 模块 | 表名 | 配置方式 |
|-----|------|---------|
| 补贴管理 | `subsidy_records` | 字段权限表 |
| 预定管理 | `preorders` | 字段权限表 |
| 工资管理 | `salary_records` | 字段权限表 |

---

## 🗄️ 数据库迁移文件

数据库迁移文件位于 [backend/database/migrations/](../../backend/database/migrations/) 目录：

| 迁移文件 | 说明 |
|---------|------|
| `create_preorders_table.sql` | 创建预定表 |
| `alter_preorders_table.sql` | 修���预定表结构 |
| `create_csrf_tokens_table.sql` | 创建CSRF令牌表 |
| `create_permission_operation_logs.sql` | 创建权限操作日志表 |
| `add_brands_updated_at.sql` | 添加品牌更新时间字段 |
| `add_customers_table_comments.sql` | 添加客户表注释 |
| `optimize_subsidy_query.sql` | 优化补贴查询 |

---

## 🔧 数据库操作脚本

数据库操作脚本位于 [backend/scripts/](../../backend/scripts/) 目录：

### 表结构检查脚本
- `check-table-structure.js` - 检查表结构
- `check-preorders-table.js` - 检查预定表结构
- `check-preorders-fields.js` - 检查预定表字段

### 权限检查脚本
- `check-permission-tables.js` - 检查权限表
- `check-all-permissions.js` - 检查所有权限
- `check-preorder-permissions.js` - 检查预定权限
- `check-stock-in-permissions.js` - 检查入库权限

### 迁移脚本
- `migrate-preorders-table.js` - 迁移预定表
- `run-migration-csrf-tokens.js` - 执行CSRF令牌表迁移
- `run-migration-permission-logs.js` - 执行权限日志表迁移

---

## 📝 开发注意事项

### 1. 云数据库连接
```javascript
// backend/src/config/db.js
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
}
```

### 2. 新增表时需注意
- 创建对应的迁移文件
- 更新本文档的映射表
- 添加必要的索引和外键约束
- 考虑字段权限需求

### 3. 修改表结构时
- 先创建迁移脚本
- 在测试环境验证
- 备份生产数据
- 执行迁移后更新文档

### 4. 权限配置
- 新模块需在 `modules` 表注册
- 在 `menus` 表添加菜单项
- 在 `permissions` 表添加权限定义
- 在 `role_permissions` 表分配角色权限

---

## 🔗 相关文档

- [权限系统完整指南](../permissions/permission-system-guide.md)
- [API 标准](../guides/api-standards.md)
- [云端部署指南](../deployment/CLOUD_DEPLOYMENT_GUIDE.md)
- [后端性能优化](../deployment/PERFORMANCE_OPTIMIZATION.md)

---

**最后更新**: 2026-01-27
