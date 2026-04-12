# TF2025 项目开发指南

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
- `module_key`: 模块标识（来自数据库 module_management 表，如 `sales_salesview`）
- `action`: 操作类型（view, create, edit, delete, export 等）

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
```javascript
// 开发环境输出调试信息
if (import.meta.env.DEV) {
  console.log('Debug Info:', debugData)
}

// 生产环境禁止 console.log
// 使用统一的日志服务
import { logger } from '@/utils/logger'

logger.info('用户操作', { action: 'create_order', userId: 123 })
logger.error('系统错误', error)
```

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

### 11. 项目维护规范

#### 11.1 提交规范
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

#### 11.2 版本管理
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
- **禁止生产环境 console.log**
- **禁止直接操作 DOM**：使用 Vue 的响应式系统

#### 12.2 必须事项
- **必须使用 TypeScript**：提供类型定义
- **必须添加错误边界**：捕获组件错误
- **必须添加 loading 状态**：提升用户体验
- **必须做数据校验**：前端后端双重验证
- **必须优化性能**：使用懒加载、虚拟滚动等
- **必须编写文档**：复杂逻辑需要说明

## 结语

以上是 TF2025 项目的完整开发指南。请严格遵守这些规范，确保代码质量、系统安全和可维护性。如有疑问，请查阅项目文档或联系技术负责人。

记住：优秀的代码不仅需要实现功能，更要易于理解、易于维护。