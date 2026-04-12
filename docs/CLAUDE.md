# TF2025 项目开发指南

> ⚠️ **重要提醒**：每次修改/创建文件后，必须检查并执行以下规范：
> 1. **删除调试代码**：`console.log`、`console.debug`、`debugger` 必须删除
> 2. **修复发现的问题**：发现其他问题必须一并修复，不能视而不见
> 3. **确保类型统一**：使用 `@/types` 统一类型，删除重复定义
> 4. **清理冗余代码**：删除冗余、重复的语句和代码
> 5. **响应式适配**：确保页面支持移动端

## 项目概述

TF2025 是一个基于 Vue 3 + Node.js 的手机销售管理综合系统，集成了销售、库存、客户、采购、维修、租赁等核心业务模块。系统采用前后端分离架构，使用云端 MySQL 数据库，实现了完整的 RBAC 权限管理体系。

## 核心开发原则

### 1. 语言和沟通
- **所有回复必须使用中文**
- 技术术语使用中文解释，保留英文原名在括号内
- 提供的代码示例需包含中文注释

### 2. 业务理解

#### 2.1 核心业务模块
- **销售管理** (sales): 手机销售、订单处理、收款、售后
- **库存管理** (inventory): 商品入库、出库、盘点、调拨
- **客户管理** (customers): 客户档案、会员体系、消费记录
- **采购管理** (suppliers): 供应商管理、采购订单、进货
- **手机管理** (phones): 型号管理、颜色、内存、配件
- **维修管理** (repairs): 维修单、维修进度、配件更换
- **租赁管理** (rentals): 设备租赁、合同管理、租金结算
- **数据分析** (analytics): 销售报表、数据可视化
- **系统管理** (system): 用户、角色、权限、配置

#### 2.2 业务流程规范
```
销售流程: 客户选型 → 创建订单 → 库存检查 → 确认收款 → 开具票据 → 售后服务
库存流程: 采购申请 → 入库验收 → 库存更新 → 销售出库 → 定期盘点
客户流程: 客户登记 → 会员开通 → 消费累计 → 积分兑换 → 维保记录
```

### 3. 技术架构规范

#### 3.1 前端技术栈
- **框架**: Vue 3.x (Composition API)
- **语言**: TypeScript 4.x
- **构建**: Vite 4.x
- **UI**: Element Plus 2.x
- **状态**: Pinia 2.x
- **路由**: Vue Router 4.x
- **HTTP**: Axios (封装在 unifiedApi)
- **样式**: SCSS + CSS Variables
- **图标**: Element Plus Icons + Font Awesome

#### 3.2 后端技术栈
- **运行时**: Node.js 18+
- **框架**: Express.js
- **数据库**: MySQL 8.0 (云端)
- **缓存**: Redis 6.x
- **认证**: JWT + bcrypt
- **ORM**: Sequelize (如使用)
- **API**: RESTful API

#### 3.3 代码规范

**命名规范:**
```javascript
// 组件：PascalCase
export default defineComponent({
  name: 'SalesOrderList'
})

// 文件：kebab-case
sales-order-list.vue
use-user-management.ts

// 变量/函数：camelCase
const salesOrderData = ref([])
const handleSubmitForm = async () => {}

// 常量：SCREAMING_SNAKE_CASE
const API_BASE_URL = '/api/v1'

// CSS类：BEM
.sales-order__header
.sales-order__item--selected
```

**代码格式:**
- 使用 2 空格缩进
- 字符串优先使用单引号
- 所有语句必须以分号结尾
- 对象和数组最后一项不加逗号
- 函数括号前后加空格

### 4. API 开发规范

#### 4.1 统一 API 调用
```javascript
// ✅ 正确：使用 unifiedApi
import { unifiedApi } from '@/services/unified-api'

const getSalesOrders = async (params) => {
  return await unifiedApi.get('/sales/orders', { params })
}

// ❌ 错误：直接使用 axios
import axios from 'axios'
const getSalesOrders = async (params) => {
  return await axios.get('/api/sales/orders', { params })
}
```

#### 4.2 RESTful 规范
```javascript
// 资源命名使用复数
GET    /api/v1/sales/orders     // 获取订单列表
POST   /api/v1/sales/orders     // 创建订单
GET    /api/v1/sales/orders/:id // 获取订单详情
PUT    /api/v1/sales/orders/:id // 更新订单
DELETE /api/v1/sales/orders/:id // 删除订单

// 批量操作
POST   /api/v1/sales/orders/batch   // 批量创建
PUT    /api/v1/sales/orders/batch   // 批量更新
DELETE /api/v1/sales/orders/batch   // 批量删除
```

#### 4.3 请求响应格式
```javascript
// 成功响应
{
  success: true,
  data: {}, // 或 []
  message: '操作成功',
  pagination: { // 列表接口
    page: 1,
    pageSize: 20,
    total: 100,
    totalPages: 5
  }
}

// 错误响应
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: '参数验证失败',
    details: {
      field: 'customer_id',
      message: '客户ID不能为空'
    }
  }
}
```

### 5. 权限系统使用

#### 5.1 权限命名规范
```javascript
// 格式：module_key:action
'sales_salesview:create'      // 创建销售订单
'sales_salesview:read'        // 查看销售订单
'sales_salesview:update'      // 更新销售订单
'sales_salesview:delete'      // 删除销售订单
'sales_salesview:export'      // 导出销售数据
'inventory_inventoryview:view' // 查看库存
```

**权限格式说明：**
- `module_key`: 模块标识（来自数据库 module_management 表）
- `action`: 操作类型（view, create, edit, delete, export, approve 等）

#### 5.2 权限控制实现
```vue
<!-- 模板中使用指令 -->
<template>
  <el-button
    v-permission="'sales_salesview:create'"
    type="primary"
    @click="handleCreate"
  >
    新建订单
  </el-button>

  <el-table>
    <el-table-column label="操作">
      <template #default="{ row }">
        <el-button
          v-permission="'sales_salesview:edit'"
          size="small"
          @click="handleEdit(row)"
        >
          编辑
        </el-button>
        <el-button
          v-permission="'sales_salesview:delete'"
          size="small"
          type="danger"
          @click="handleDelete(row)"
        >
          删除
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
// 在脚本中使用组合式函数
import { usePermission } from '@/composables/usePermissions'

const { hasPermission, canCreate, canEdit, canDelete } = usePermission()

const handleDelete = async (row) => {
  if (!canDelete('sales')) {
    ElMessage.warning('您没有删除销售订单的权限')
    return
  }
  // 执行删除
}
</script>
```

### 6. 组件开发规范

#### 6.1 组件结构
```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入依赖
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { SalesOrder } from '@/types'

// 2. Props 定义
interface Props {
  orderId?: number
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

// 3. Emits 定义
interface Emits {
  update: [value: SalesOrder]
  delete: [id: number]
}

const emit = defineEmits<Emits>()

// 4. 响应式数据
const formData = ref<SalesOrder>({
  id: 0,
  customer_id: null,
  items: [],
  total_amount: 0
})

// 5. 计算属性
const isEditing = computed(() => !!props.orderId)

// 6. 方法定义
const handleSubmit = async () => {
  // 提交逻辑
}

// 7. 生命周期
onMounted(() => {
  // 初始化逻辑
})
</script>

<style lang="scss" scoped>
// 组件样式
</style>
```

#### 6.2 表单开发规范
```vue
<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="formRules"
    label-width="120px"
  >
    <el-form-item label="客户" prop="customer_id">
      <el-select
        v-model="formData.customer_id"
        placeholder="请选择客户"
        :disabled="readonly"
        clearable
        filterable
      >
        <el-option
          v-for="customer in customerList"
          :key="customer.id"
          :label="customer.name"
          :value="customer.id"
        />
      </el-select>
    </el-form-item>
  </el-form>
</template>

<script setup>
import type { FormInstance, FormRules } from 'element-plus'

const formRef = ref<FormInstance>()

const formRules: FormRules = {
  customer_id: [
    { required: true, message: '请选择客户', trigger: 'change' }
  ],
  order_date: [
    { required: true, message: '请选择订单日期', trigger: 'change' }
  ]
}

const validateForm = async () => {
  if (!formRef.value) return false
  return await formRef.value.validate()
}
</script>
```

### 7. 错误处理和日志

#### 7.1 统一错误处理
```javascript
// API 错误处理
const handleApiError = (error) => {
  console.error('API Error:', error)

  if (error.response) {
    const { status, data } = error.response
    switch (status) {
      case 400:
        ElMessage.error(data.message || '请求参数错误')
        break
      case 401:
        ElMessage.error('登录已过期，请重新登录')
        router.push('/login')
        break
      case 403:
        ElMessage.error('没有操作权限')
        break
      case 500:
        ElMessage.error('服务器内部错误')
        break
      default:
        ElMessage.error('请求失败')
    }
  } else {
    ElMessage.error('网络错误，请检查网络连接')
  }
}
```

#### 7.2 日志规范

**核心原则：统一日志入口，禁止直接使用 console 或底层引擎**

##### 日志分层架构

| 层级 | 后端文件 | 前端文件 | 业务层是否直接使用 |
|------|---------|---------|-------------------|
| 底层引擎 | `logger.js` | `error-logger.ts` | ❌ 否 |
| 统一入口 | `log.js` | `logger.ts` | ✅ 是 |

##### 统一日志入口

```javascript
// ✅ 后端正确：使用 log.js
const log = require('../utils/log');
log.info('用户登录成功');
log.error('数据库连接失败', error);
log.success('订单创建成功');

// ❌ 后端错误：直接使用 logger.js（底层引擎）
const logger = require('../utils/logger');  // 禁止

// ❌ 后端错误：直接使用 console
console.log('debug');  // 禁止
```

```typescript
// ✅ 前端正确：使用 logger.ts
import { logger } from '@/utils/logger';
logger.info('加载完成');
logger.error('请求失败', error);

// ✅ 前端正确：创建组件日志器
const componentLog = logger.createComponentLogger('UserProfile');
componentLog.info('组件挂载');

// ❌ 前端错误：直接使用 console
console.log('debug');  // 禁止
```

##### 日志方法对照表

| 方法 | 后端 `log.js` | 前端 `logger.ts` | 说明 |
|------|---------------|-----------------|------|
| 信息 | `log.info()` | `logger.info()` | 一般日志 |
| 错误 | `log.error()` | `logger.error()` | 错误日志 |
| 警告 | `log.warn()` | `logger.warn()` | 警告日志 |
| 调试 | `log.debug()` | `logger.debug()` | 开发环境调试 |
| 成功 | `log.success()` | - | 带图标成功 |
| 失败 | `log.fail()` | - | 带图标失败 |
| 开始 | `log.start()` | - | 带图标开始 |
| 完成 | `log.done()` | - | 带图标完成 |
| 数据库 | `log.db()` | - | 带标签数据库 |
| API | `log.api()` | - | 带标签API |

##### 允许保留的日志

| 类型 | 用途 | 示例 |
|---|---|---|
| `log.error()` | 捕获真实错误需记录 | `log.error('请求失败:', error)` |
| `log.warn()` | 重要警告需关注 | `log.warn('配置缺失，使用默认值')` |
| `log.info()` | 系统关键运行状态 | `log.info('用户登录成功')` |
| `logger.debug()` | 开发环境调试 | `log.debug('调试信息', data)` |

##### 禁止保留的日志（必须删除）

| 类型 | 原因 | 示例 |
|---|---|---|
| 纯调试输出 | 开发完成后无意义 | `log.info('开始加载...')` |
| API响应打印 | 生产环境泄露数据 | `log.debug('API响应:', response)` |
| 参数打印 | 临时调试用 | `log.debug('参数:', params)` |
| `debugger` | 断点调试代码 | `debugger` |

##### ✅ 使用示例

```javascript
// 后端示例
const log = require('../utils/log');

async function createOrder(data) {
  log.start('创建订单');  // 🚀 创建订单

  try {
    const order = await db.orders.create(data);
    log.success('订单创建成功', { orderId: order.id });  // ✅ 订单创建成功
    return order;
  } catch (error) {
    log.fail('订单创建失败');  // ❌ 订单创建失败
    log.error('异常详情', error);
    throw error;
  }
}
```

```typescript
// 前端示例
import { logger } from '@/utils/logger';

const fetchOrders = async () => {
  logger.info('开始加载订单列表');

  try {
    const data = await api.getOrders();
    logger.info('订单列表加载成功', { count: data.length });
    return data;
  } catch (error) {
    logger.error('订单列表加载失败', error);
    throw error;
  }
};
```

##### ⚠️ 修改文件时必须清除多余日志

**每次修改任何文件时，必须顺手清理该文件中的调试日志，渐进式减少项目中的冗余代码。**

```javascript
// ✅ 正确做法：修改文件时顺手清理
// 修改前：
function saveData(data) {
  log.debug('开始保存:', data);  // ← 调试日志，需删除
  log.info('数据验证中...');     // ← 调试日志，需删除
  try {
    return api.save(data);
  } catch (error) {
    log.error('保存失败', error); // ← 错误日志，保留
    throw error;
  }
}

// 修改后：
function saveData(data) {
  try {
    return api.save(data);
  } catch (error) {
    log.error('保存失败', error);
    throw error;
  }
}
```

**清理原则：**
- 只清理**当前修改的文件**，不动其他文件
- 保留 `log.error()` 和 `log.warn()`
- 删除 `log.debug()`（调试）、`log.info()`（纯调试输出）
- 渐进式清理，不必批量处理

##### ⚠️ 渐进式迁移原则

**每次修改文件时，必须顺手完善该文件中的遗留代码：**

| 类型 | 处理方式 | 示例 |
|------|---------|------|
| 内联样式 | 改用工具类 | `style="width: 100%"` → `class="w-full"` |
| 表单验证 | 改用 `ValidationRules` | 自定义 `FormRules` → `ValidationRules.required()` |
| 调试日志 | 删除或替换 | `console.log(...)` → 删除 |
| 重复代码 | 提取复用 | 相同逻辑提取到 composables |
| 重复类型 | 删除，使用 `@/types` | 组件内定义类型 → 从 `@/types` 导入 |

**渐进式迁移示例：**
```typescript
// 修改前：文件中有遗留的内联样式和自定义验证
const formRules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

// 修改时顺手改进：
import { ValidationRules } from '@/composables'

const validationRules = {
  phone: [ValidationRules.required(), ValidationRules.phone()]
}
```

**关键原则：**
1. **只修改当前正在处理的文件**，不动其他文件
2. **发现其他问题必须一起修复**，不能视而不见
3. **同类问题需要全局排查**，一并处理

##### 日志使用建议

```javascript
// ✅ 后端：使用统一的日志服务
const log = require('../utils/log');

log.info('用户操作', { action: 'create_order', userId: 123 });
log.error('系统错误', error);
log.success('订单创建成功');
```

```typescript
// ✅ 前端：使用统一的日志服务
import { logger } from '@/utils/logger';

logger.info('用户操作', { action: 'create_order', userId: 123 });
logger.error('系统错误', error);

// ✅ 重要信息使用 ElMessage（前端）
ElMessage.warning('登录已过期，请重新登录');

// ✅ 生产环境使用 try-catch 记录错误
try {
  await api.save();
} catch (error) {
  log.error('保存失败', error);
}
```

#### 7.3 调试代码清理规范

**每次修改/新增代码时必须遵循：**

1. **开发完成后** → 移除所有调试日志
2. **测试完成后** → 确认无残留调试代码
3. **提交前检查** → 确保关键文件无调试输出

```bash
# 检查后端调试日志
grep -rn "log.debug\|log.info" backend/src/services/

# 检查前端调试日志
grep -rn "logger.debug\|logger.info" frontend/src/

# 检查 debugger 语句
grep -rn "debugger" backend/src/ frontend/src/
```

##### 批量清理建议

项目积累大量调试代码后，可使用脚本批量清理：

```javascript
// 保留 log.error（错误必需）
// 删除 log.debug（调试）、log.info（纯调试输出）
// 替换方案：使用环境判断或日志服务
```

**注意**：清理时务必确认是调试代码，非业务逻辑错误处理代码。

**相关文档**：[日志系统规范](guides/LOG_SYSTEM_STANDARDS.md)

### 8. 性能优化要求

#### 8.1 列表优化
```vue
<template>
  <!-- 大数据列表使用虚拟滚动 -->
  <el-table-v2
    v-if="useVirtualScroll"
    :columns="columns"
    :data="tableData"
    :width="800"
    :height="600"
    :row-height="50"
  />

  <!-- 普通列表使用分页 -->
  <el-table
    v-else
    :data="tableData"
    v-loading="loading"
  >
  </el-table>

  <el-pagination
    v-model:current-page="pagination.page"
    v-model:page-size="pagination.pageSize"
    :total="pagination.total"
    :page-sizes="[10, 20, 50, 100]"
    layout="total, sizes, prev, pager, next, jumper"
    @size-change="handleSizeChange"
    @current-change="handleCurrentChange"
  />
</template>
```

#### 8.2 组件懒加载
```javascript
// 路由懒加载
const routes = [
  {
    path: '/sales',
    component: () => import('@/views/sales/SalesView.vue')
  }
]

// 组件懒加载
const HeavyComponent = defineAsyncComponent(() =>
  import('@/components/HeavyComponent.vue')
)
```

### 9. 安全要求

#### 9.1 数据验证
```javascript
// 前端验证
const validatePhone = (phone) => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

// 后端验证
app.use(bodyParser.json({ limit: '10mb' }))
app.use(expressValidator())
```

#### 9.2 XSS 防护
```vue
<!-- 使用 v-text 而不是 v-html -->
<p v-text="userInput"></p>

<!-- 必须使用 v-html 时进行过滤 -->
<div v-html="sanitizeHtml(userInput)"></div>
```

### 10. 测试要求

#### 10.1 测试账户
```javascript
// 管理员账户
const adminAccount = {
  username: 'sadmin',
  password: '123456',
  permissions: ['*']
}

// 销售员账户
const salesAccount = {
  username: 'test',
  password: 'test',
  permissions: ['sales_salesview:*', 'inventory_inventoryview:view']
}

// 测试完成后删除测试文件
const testFiles = [
  '/test-data/create-test-orders.js',
  '/debug-scripts/permission-fix.js',
  '/temp/debug.log'
]
```

### 11. 文档管理规范

#### 11.1 文档统一存放

**所有项目文档必须存放在 `docs/` 目录下，禁止在项目根目录或其他位置创建文档。**

#### 11.2 按模块命名规则

| 模块 | 文档目录 | 示例 |
|---|---|---|
| 综合查询 | `docs/query/` | 查询功能相关 |
| 销售管理 | `docs/business/sales/` | 销售相关 |
| 库存管理 | `docs/business/inventory/` | 库存相关 |
| 考勤管理 | `docs/business/leave/` | 考勤相关 |
| 国补管理 | `docs/subsidy/` | 国补相关 |
| 工资管理 | `docs/salary/` | 工资相关 |
| H5商城 | `docs/frontend/` | H5商城相关 |
| 前端组件 | `docs/components/` | 组件开发 |
| 后端服务 | `docs/backend/` | 后端技术 |
| 数据同步 | `docs/sync/` | 同步相关 |
| 支付管理 | `docs/payments/` | 支付相关 |
| 权限系统 | `docs/permissions/` | 权限相关 |

#### 11.3 文件命名规范
- **业务文档**：大写下划线（如 `LEAVE_CALCULATION_RULES.md`）
- **技术文档**：小写连字符（如 `api-standards.md`）
- **索引文件**：统一使用 `INDEX.md`

#### 11.4 创建流程
1. 新增文档 → 放入对应模块目录
2. 更新模块目录的 `INDEX.md`
3. 更新总索引 `docs/00-INDEX.md`

#### 11.5 根目录保留文件
```
docs/
├── 00-INDEX.md           # 文档总索引 ⭐
├── CHANGELOG.md          # 项目变更记录
├── CLAUDE.md             # Claude AI 开发指南
└── TEMPLATE.md           # 文档模板
```

#### 11.6 类型定义统一管理 ⭐

**所有 TypeScript 类型定义必须集中在 `src/types/` 目录，禁止在各页面组件中分散定义。**

##### 类型文件结构
```
src/types/
├── index.ts        # 统一导出入口
├── global.d.ts     # 全局声明、Vue 组件扩展
├── employee.ts     # 员工/角色/薪资/考勤/补贴
├── order.ts        # 订单/预订单/客户/批发
├── repair.ts       # 维修相关
├── system.ts       # 系统/设置/日志/备份/门店/供应商
├── h5.ts           # H5管理/Banner/首页区块
├── analytics.ts    # 数据分析
├── inventory.ts    # 库存管理
├── menu.ts         # 菜单相关
├── component.ts    # 通用组件 Props 类型 ⭐ 新增
└── *.d.ts          # 其他声明文件
```

##### 使用规范
```typescript
// ✅ 正确：从 @/types 导入业务类型
import type { Employee, Role } from '@/types/employee'
import type { SalesOrder, Customer } from '@/types/order'
import type { RepairOrder } from '@/types/repair'

// ✅ 正确：从 @/types 导入组件 Props 类型
import type { SalesAnalyticsProps } from '@/types/component'

// ❌ 错误：在组件中定义重复类型
interface Employee {
  id: number
  name: string
  // ...
}
```

##### 类型命名规范
| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 数据模型 | PascalCase，无后缀 | `Employee`, `SalesOrder` |
| 表单数据 | PascalCase + Form | `EmployeeForm`, `SalesOrderForm` |
| 筛选条件 | PascalCase + Filters | `EmployeeFilters`, `SalesOrderFilters` |
| 列表响应 | PascalCase + ListResponse | `EmployeeListResponse` |
| 枚举类型 | PascalCase 类型别名 | `EmployeeStatus = 0 \| 1 \| 'active'` |
| 组件 Props | PascalCase + Props | `SalesAnalyticsProps`, `FormModalProps` |

##### 页面中类型使用方式

**方式一：直接使用集中类型（推荐）**
```vue
<script setup lang="ts">
import type { Employee } from '@/types/employee'
import type { SalesAnalyticsProps } from '@/types/component'

const employees = ref<Employee[]>([])
const props = defineProps<SalesAnalyticsProps>()
</script>
```

**方式二：类型别名兼容（当字段有差异时）**
```vue
<script setup lang="ts">
import type { Employee } from '@/types/employee'

// 扩展字段使用类型别名
interface ExtendedEmployee extends Employee {
  extra_field?: string
  custom_field: number
}

const employees = ref<ExtendedEmployee[]>([])
</script>
```

##### 新增业务模块类型流程
1. 在 `src/types/` 创建对应的类型文件（如 `order.ts`）
2. 在 `src/types/index.ts` 中添加导出
3. 页面中从 `@/types/` 对应文件导入使用

#### 11.7 提交规范
```javascript
// 提交信息格式
feat: 添加销售订单创建功能
fix: 修复库存计算错误
docs: 更新API文档
style: 代码格式调整
refactor: 重构权限检查逻辑
test: 添加单元测试
chore: 更新依赖包
```

#### 11.8 时间处理规范 ⭐

**所有时间处理必须使用统一的 `TimeUtil` 工具，禁止直接使用 `new Date()`。**

##### 为什么使用 TimeUtil
| 问题 | `new Date()` | `TimeUtil` |
|------|-------------|-----------|
| 时区 | 使用本地/UTC时间 | 统一北京时间 (Asia/Shanghai) |
| 格式化 | 代码分散不统一 | 预定义格式常量 |
| 跨时区 | 可能显示错误时间 | 始终显示正确北京时间 |

##### 使用规范
```typescript
// ✅ 正确：使用 TimeUtil
import { TimeUtil, TIME_FORMATS } from '@/utils/time'

// 获取当前北京时间
const now = TimeUtil.now()
const today = TimeUtil.nowFormatted(TIME_FORMATS.DATE)

// 格式化时间
const formatted = TimeUtil.format(date, TIME_FORMATS.DATETIME)
const dateStr = TimeUtil.format(date, 'YYYY-MM-DD')

// 日期计算
const yesterday = TimeUtil.subtract(now, 1, 'day')
const nextWeek = TimeUtil.add(now, 1, 'week')
const monthStart = TimeUtil.startOf(now, 'month')
const monthEnd = TimeUtil.endOf(now, 'month')

// 在 Vue 组件中使用 composable
import { useTime } from '@/utils/time'
const { format, now, subtract, add } = useTime()

// ❌ 错误：直接使用 new Date()
const today = new Date()                    // 禁止
const dateStr = new Date().toISOString()    // 禁止
const year = new Date().getFullYear()       // 禁止
```

##### 预定义格式常量
```typescript
TIME_FORMATS.DATE           // 'YYYY-MM-DD'
TIME_FORMATS.TIME           // 'HH:mm:ss'
TIME_FORMATS.DATETIME       // 'YYYY-MM-DD HH:mm:ss'
TIME_FORMATS.DISPLAY        // 'YYYY年MM月DD日 HH:mm'
TIME_FORMATS.DISPLAY_DATE   // 'YYYY年MM月DD日'
TIME_FORMATS.MONTH_DAY      // 'MM-DD'
```

##### 常见迁移示例
```typescript
// ❌ 旧代码
const today = new Date().toISOString().split('T')[0]
const year = new Date().getFullYear()
const month = new Date().getMonth() + 1
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

// ✅ 新代码
const today = TimeUtil.nowFormatted(TIME_FORMATS.DATE)
const year = TimeUtil.now().year()
const month = TimeUtil.now().month() + 1
const yesterday = TimeUtil.subtract(TimeUtil.now(), 1, 'day')
```

#### 11.3 版本管理
```javascript
// package.json
{
  "version": "1.0.0",
  "scripts": {
    "dev": "vite --mode development",
    "build": "vite build --mode production",
    "test": "vitest",
    "lint": "eslint src --ext .ts,.vue",
    "lint:fix": "eslint src --ext .ts,.vue --fix"
  }
}
```

### 12. 特殊指令

#### 12.1 禁止事项
- **禁止硬编码**：所有配置项使用环境变量或配置文件
- **禁止重复代码**：提取公共函数和组件
- **禁止循环依赖**：检查 import 依赖关系
- **禁止内联样式**：使用 class 和 SCSS
- **禁止残留调试代码**：`console.log`、`debugger` 必须在开发完成后删除
- **禁止直接操作 DOM**：使用 Vue 的响应式系统
- **禁止提交测试代码**：测试完成后删除所有调试脚本
- **禁止自动执行 git 恢复操作**：以下命令必须人工确认后才能执行
  - `git restore` / `git checkout --` / `git checkout .` - 恢复/丢弃文件修改
  - `git reset --hard` / `git reset --soft` - 重置版本
  - `git clean -f` - 清理未跟踪文件
  - `git checkout HEAD` - 恢复到 HEAD 版本
- **禁止未经验证直接删除**：删除任何代码/导入前必须 100% 确认安全

#### 12.1.1 删除操作安全规范 ⭐

**核心原则：删除前必须验证，确保 100% 安全才能执行。**

删除代码/导入时必须遵循以下流程：

```
发现疑似冗余代码 → 全局搜索使用情况 → 确认无引用 → 才能删除
```

##### 删除前的验证步骤

| 删除类型 | 验证方式 | 验证命令/方法 |
|---------|---------|--------------|
| **导入语句** | 全局搜索是否被使用 | `grep -rn "变量名" --include="*.vue" --include="*.ts"` |
| **变量/函数** | 搜索引用次数 | `grep -rn "函数名" src/` |
| **类型定义** | 检查是否有地方使用该类型 | `grep -rn "TypeName" src/` |
| **组件** | 搜索模板中的使用 | `grep -rn "<组件名" src/` |
| **样式** | 检查 HTML 中是否有该 class | `grep -rn "class-name" src/` |
| **API 接口** | 检查前后端是否都有调用 | 前端搜索 + 后端搜索 |

##### 必须验证的场景

1. **IDE 报错"找不到模块"**
   ```typescript
   // ❌ 错误做法：看到报错直接删除
   import { SomeComponent } from 'ant-design-vue'  // IDE 报错

   // ✅ 正确做法：先验证
   // 1. 全局搜索 SomeComponent 是否被使用
   // 2. 检查 package.json 是否安装了依赖
   // 3. 确认是真正不需要，还是依赖缺失
   ```

2. **IDE 报错"未使用的变量"**
   ```typescript
   // ❌ 错误做法：直接删除
   const unusedVar = 'xxx'  // IDE 提示未使用

   // ✅ 正确做法：验证后删除
   // 1. 搜索整个文件是否使用
   // 2. 搜索关联文件是否使用（如 template）
   // 3. 确认 100% 未使用才删除
   ```

3. **发现重复类型定义**
   ```typescript
   // ❌ 错误做法：直接删除组件内的类型
   interface Employee { ... }  // 组件内定义

   // ✅ 正确做法：验证后处理
   // 1. 对比 @/types 中的类型字段是否一致
   // 2. 如果一致，删除并改用 @/types
   // 3. 如果不一致，考虑扩展或合并
   ```

##### 删除验证清单

在删除任何内容前，必须完成以下检查：

- [ ] **全局搜索**：确认没有其他地方使用
- [ ] **关联检查**：检查相关文件（如 template、style）
- [ ] **依赖确认**：确认不是依赖缺失导致的误报
- [ ] **功能影响**：确认删除不会影响现有功能
- [ ] **备选方案**：如果不确定，保留并添加 TODO 注释

##### 禁止删除的情况

即使看起来"没用"，以下情况不能直接删除：

| 情况 | 原因 |
|------|------|
| 可能被动态调用 | `eval()`、`new Function()` 等 |
| 可能被外部引用 | 组件库、工具函数 |
| 可能是类型扩展 | `declare module` 扩展 |
| 可能是预留接口 | 后续功能需要的接口 |
| IDE 误报 | 依赖未安装但不代表不需要 |

##### 不确定时的处理方式

```typescript
// 如果不确定是否应该删除，保留并添加注释
// TODO: 待确认是否使用，IDE 提示未使用但不确定是否有动态调用
const uncertainVar = 'xxx'
```

#### 12.2 必须事项
- **必须使用 TypeScript**：提供类型定义
- **必须添加错误边界**：捕获组件错误
- **必须添加 loading 状态**：提升用户体验
- **必须做数据校验**：前端后端双重验证
- **必须优化性能**：使用懒加载、虚拟滚动等
- **必须规范创建文档**：新文档放入 `docs/` 对应分类目录
- **必须清理调试代码**：修改/新增功能后移除 `console.log`、`debugger`
- **必须保留错误日志**：`console.error` 用于真实错误记录
- **必须主动修复其他问题**：修改文件时发现其他问题也要一起修复，不能视而不见

#### 12.2.1 发现问题必须主动修复原则 ⭐

**核心原则：明知道有问题，不能放着不管，必须一起修复掉。**

当你修改任何文件时，如果发现以下问题，**必须顺手一起修复**，不能以"不是本次问题"为由忽略：

| 发现的问题 | 处理方式 | 说明 |
|-----------|---------|------|
| 调试日志残留 | 删除 `console.log`、`console.debug` | 即使原来就有也要删 |
| 内联样式 | 改用 class 或 SCSS | 统一样式管理 |
| 重复类型定义 | 删除，使用 `@/types` 统一类型 | 确保类型唯一性 |
| 独立 axios 实例 | 改用 `unifiedApi` | 统一请求管理 |
| 表单验证分散 | 改用 `ValidationRules` | 统一验证规则 |
| 硬编码值 | 提取为常量或配置 | 便于维护 |
| 缺失类型定义 | 添加 `interface` / `type` | TypeScript 强约束 |
| 响应式缺失 | 添加移动端适配 | 所有页面必须支持 |

**示例场景：**

假设你本次任务是修复一个按钮样式问题，但同时发现：
1. 该文件有 `console.log('debug')` 残留
2. 有重复的类型定义
3. 有内联样式

**正确做法：**
```typescript
// ✅ 一并修复所有发现的问题
// 1. 删除 console.log
// 2. 删除重复类型，改用 @/types
// 3. 将内联样式迁移到 class
// 4. 修复按钮样式（本次任务）
```

**错误做法：**
```typescript
// ❌ 只修复本次任务，其他视而不见
// "虽然有 console.log，但不是我这次要修的..."
// "虽然有重复类型，但不是我这次要改的..."
```

**全局排查机制：**

修复类似问题时，必须全局排查一起修复：
- 发现某文件有 `console.log` → 检查所有同类文件
- 发现某组件用错 API 目录 → 检查所有组件
- 发现类型重复 → 删除所有重复定义，只保留 `@/types` 一个

**这不仅是对自己代码负责，也是对整个项目负责。明知有问题不修，问题只会越积越多。**

#### 12.3 代码提交前检查

##### ⚠️ 必查项目（每次提交前必须检查）

**代码规范检查：**
- [ ] API 调用是否放在 `src/api/` 目录？（禁止放 services/）
- [ ] 业务逻辑服务是否放在 `src/services/` 目录？（仅包含真实业务逻辑）
- [ ] 是否使用了独立的 axios 实例？（禁止，必须使用 unifiedApi）
- [ ] 是否消除了重复代码？（不创建功能重复的文件）

**调试代码清理：**
- [ ] 是否删除了所有 `console.log`、`console.debug`？
- [ ] 是否删除了所有 `debugger` 语句？
- [ ] 是否保留了必要的 `console.error`（真实错误记录）？

**功能完整性：**
- [ ] 是否添加了 loading 状态？
- [ ] 是否添加了错误处理？
- [ ] 是否添加了类型定义？
- [ ] 是否响应式适配（移动端）？

**表单验证检查：**
- [ ] 表单验证是否使用 `ValidationRules`（禁止各页面自行定义）？
- [ ] 是否有新增的通用验证规则需要添加到 `useForm`？

**Loading 状态检查：**
- [ ] Loading 状态是否使用 `useLoadingState`（禁止各页面自行定义）？

##### 检查命令

```bash
# 1. 检查调试代码
grep -rn "console\.log" --include="*.vue" --include="*.ts" src/
grep -rn "debugger" --include="*.vue" --include="*.ts" src/

# 2. 检查是否创建了独立的 axios 实例
grep -rn "axios.create" --include="*.ts" src/

# 3. 检查是否使用了统一的表单验证
grep -rn "ValidationRules" --include="*.vue" src/composables/

# 4. 检查未使用的导入
# 5. 检查类型定义完整性
# 6. 运行构建确认无错误
npm run build
```

##### AI 提醒事项

**以下情况必须立即修正：**
1. ❌ 在 `services/` 目录创建只有 API 调用的文件 → 移到 `api/` 目录
2. ❌ 在 `api/` 目录包含业务逻辑、缓存、状态管理 → 移到 `services/` 目录
3. ❌ 创建独立的 axios 实例 → 使用 `unifiedApi`
4. ❌ 新增功能但未清理调试代码 → 删除 `console.log`、`debugger`
5. ❌ 新增页面但未适配移动端 → 添加响应式支持
6. ❌ 表单验证各页面自行定义 → 使用 `ValidationRules` 统一验证规则

## 结语

以上是 TF2025 项目的完整开发指南。请严格遵守这些规范，确保代码质量、系统安全和可维护性。如有疑问，请查阅项目文档或联系技术负责人。

记住：优秀的代码不仅需要实现功能，更要易于理解、易于维护。