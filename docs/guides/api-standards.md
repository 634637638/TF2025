# TF2025 API 调用规范

> **文档说明**：定义 TF2025 项目的 API 调用规范，包括 unifiedApi 使用、RESTful 接口设计、错误处理和 TypeScript 类型定义
>
> **最后更新**：2026-04-09
> **版本**：v1.1.0
> **维护者**：TF2025 开发团队

## 概述

TF2025 项目采用统一的 API 调用规范，通过 `unifiedApi` 服务封装所有 HTTP 请求。该规范确保了 API 调用的一致性、错误处理的统一性、请求响应的标准化，并提供了完整的 TypeScript 类型支持和拦截器机制。

## 📁 目录结构规范

### `src/api/` vs `src/services/` 职责划分

为避免功能重复和架构混乱，明确规定两个目录的职责：

| 目录 | 职责 | 文件类型 |
|------|------|----------|
| **`src/api/`** | **API 封装层** - 纯 HTTP 请求调用后端接口 | `*.ts` |
| **`src/services/`** | **业务服务层** - 业务逻辑、缓存、状态管理、复杂计算 | `*.ts` |

#### `src/api/` 目录（API 封装层）

**职责**：封装所有 HTTP 请求，直接调用后端 RESTful 接口

**特征**：
- 纯函数或类方法，直接 `return unifiedApi.get/post/put/delete(...)`
- 不包含业务逻辑判断
- 不包含数据缓存逻辑
- 不包含状态管理

**示例**：
```typescript
// ✅ 正确：纯 API 封装
// src/api/analytics.ts
export class AnalyticsApi {
  async getSalesAnalytics(params?: { startDate?: string }) {
    return await unifiedApi.get('/analytics/sales', { params })
  }
}

// ✅ 正确：返回数据处理（轻量）
// src/api/data-optimization.ts
export const dataCheckApi = {
  checkBrands: () => unifiedApi.get('/data-check/check/brands'),
  mergeDuplicates: (data) => unifiedApi.post('/data-check/merge', data)
}
```

**文件列表**：
```
src/api/
├── analytics.ts           # 数据分析 API
├── attendance.ts          # 考勤 API
├── auth.ts               # 认证 API
├── base-data.ts          # 基础数据 API（品牌、型号、颜色等）
├── data-optimization.ts   # 数据检查/导入 API
├── home-sections.ts      # 首页配置 API
├── phone-stock-warnings.ts
├── preorder.ts           # 预购 API
├── price-list.ts         # 价格表 API
├── salary-template.ts
├── salary.ts             # 工资 API
├── shop-public.ts        # H5 商城公开 API（用户端）
├── shop.ts               # H5 商城 API（员工端）
├── system-settings.ts
└── user.ts               # 用户管理 API
```

#### `src/services/` 目录（业务服务层）

**职责**：包含真实业务逻辑的服务

**特征**：
- 包含业务判断和计算
- 包含数据缓存和同步逻辑
- 包含状态管理
- 包含权限相关的复杂处理
- 包含通知、提示等 UI 相关逻辑

**保留文件**：
```
src/services/
├── permissions.ts              # 动态权限服务：权限获取、缓存、同步、监听
├── fieldPermissionService.ts   # 字段权限：敏感数据格式化、可见性控制
└── notification-simple.ts      # 通知服务：消息、对话框、Loading 状态
```

#### ❌ 禁止的做法

```typescript
// ❌ 错误：API 文件中包含业务逻辑
// src/api/bad-example.ts
export const badApi = {
  async getData() {
    const cached = this.cache.get('key')  // ← 禁止
    if (this.shouldRefresh()) {           // ← 禁止
      return this.processData(raw)        // ← 禁止
    }
    return unifiedApi.get('/data')
  }
}

// ❌ 错误：服务文件中直接调用 API 无任何业务处理
// src/services/bad-example.ts
export const badService = {
  async getData() {
    return unifiedApi.get('/data')  // ← 这种应该放 api/ 目录
  }
}
```

#### 迁移历史

- **2026-04-09**：整合 `services/analytics.ts` → `api/analytics.ts`
- **2026-04-09**：整合 `services/data-optimization.service.ts` → `api/data-optimization.ts`
- **2026-04-09**：重构 `api/shop-public.ts`，移除独立 axios 实例，复用 `unifiedApi`

---

## 🎨 CSS 工具类规范

### 目录结构

所有全局工具类统一存放在 `src/styles/utilities.scss`

### 使用规范

**✅ 优先使用工具类替换内联样式：**
```vue
<!-- ❌ 错误：内联样式 -->
<div style="color: #f56c6c; font-weight: 600; margin-left: 8px;">文字</div>

<!-- ✅ 正确：工具类 -->
<div class="text-danger font-semibold ml-2">文字</div>
```

**✅ 动态样式使用 `:style` 绑定：**
```vue
<!-- 动态宽度（必须使用 :style） -->
<div :style="{ width: progress + '%' }">进度</div>
```

### 常用工具类速查

| 类别 | 工具类 | 说明 |
|------|--------|------|
| **宽度** | `.w-full` | 100% 宽度 |
| | `.w-60` ~ `.w-200` | 固定像素宽度 |
| | `.w-28` ~ `.w-60` | rem 单位宽度 |
| **间距** | `.m-1` ~ `.m-4` / `.p-1` ~ `.p-4` | 4px-16px 外/内边距 |
| | `.mt-1` ~ `.mt-4` | 上边距 |
| | `.mb-1` ~ `.mb-4` | 下边距 |
| | `.ml-1` ~ `.ml-4` | 左边距 |
| | `.mr-1` ~ `.mr-4` | 右边距 |
| **文字** | `.text-xs` `.text-sm` `.text-base` | 字体大小 |
| | `.font-semibold` `.font-bold` | 字重 |
| | `.text-danger` `.text-success` | 功能色 |
| | `.text-secondary` `.text-regular` | 灰色系文字 |
| **Flex** | `.flex` `.flex-1` | Flex 布局 |
| | `.items-center` `.justify-center` | 对齐方式 |
| | `.gap-1` ~ `.gap-6` | 间距 |
| **定位** | `.relative` `.absolute` `.fixed` | 定位 |
| **按钮** | `.btn-sm` `.btn-md` `.btn-lg` | 按钮尺寸 |
| | `.btn-danger` | 危险按钮样式 |
| **渐变** | `.bg-gradient-brand` | 渐变背景 |

### 按钮样式

```vue
<!-- 小按钮 -->
<el-button class="btn-sm">按钮</el-button>

<!-- 危险按钮（红色） -->
<el-button class="btn-sm btn-danger">删除</el-button>
```

### 颜色类

```vue
<!-- 文字颜色 -->
<span class="text-danger">危险/红色</span>
<span class="text-success">成功/绿色</span>
<span class="text-warning">警告/橙色</span>
<span class="text-blue">蓝色</span>
<span class="text-secondary">次要文字</span>

<!-- 背景色 -->
<div class="bg-orange">橙色背景</div>
<div class="bg-green">绿色背景</div>
```

### 新增工具类流程

1. 在 `src/styles/utilities.scss` 中添加新样式
2. 按类别分组（宽度、间距、文字、Flex 等）
3. 添加中文注释说明
4. 避免与现有样式重复

### 禁止的做法

```vue
<!-- ❌ 禁止：复杂内联样式 -->
<div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: linear-gradient(...)">
  内容
</div>

<!-- ✅ 正确：使用工具类 -->
<div class="flex items-center gap-3 p-4 bg-gradient-brand">
  内容
</div>

<!-- ❌ 禁止：创建新的全局样式文件 -->
<!-- 应统一添加到 utilities.scss -->
```

---

## 🎯 设计原则

1. **统一性**：所有 API 调用使用相同的接口和格式
2. **类型安全**：完整的 TypeScript 类型定义
3. **错误处理**：统一的错误处理和用户反馈
4. **可维护性**：清晰的接口定义和文档
5. **性能优化**：请求缓存、防抖、节流等优化策略

## 🏗️ 架构设计

### 核心组件

```
API 调用架构
├── 统一 API 服务 (unifiedApi)
│   ├── 基础 HTTP 客户端 (Axios)
│   ├── 请求拦截器 (Request Interceptors)
│   ├── 响应拦截器 (Response Interceptors)
│   └── 错误处理 (Error Handlers)
├── API 服务层 (API Services)
│   ├── 用户服务 (UserApiService)
│   ├── 订单服务 (OrderApiService)
│   └── 业务服务 (Business Services)
└── 类型定义 (Type Definitions)
    ├── 请求类型 (Request Types)
    ├── 响应类型 (Response Types)
    └── 实体类型 (Entity Types)
```

## 📚 使用规范

### 1. 基础导入

```typescript
// ✅ 唯一正确的导入方式
import { unifiedApi } from '@/utils/unified-api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'

// ❌ 禁止直接使用 axios
import axios from 'axios' // 禁止

// ✅ 导入通知服务（推荐）
import { useNotification } from '@/composables/useNotification'
```

### 2. RESTful API 调用

#### 2.1 标准资源操作

```typescript
// 获取资源列表
const getUsers = async (params?: QueryParams): Promise<PaginatedResponse<User[]>> => {
  return await unifiedApi.get('/users', { params })
}

// 获取单个资源
const getUser = async (id: number): Promise<ApiResponse<User>> => {
  return await unifiedApi.get(`/users/${id}`)
}

// 创建资源
const createUser = async (userData: CreateUserData): Promise<ApiResponse<User>> => {
  return await unifiedApi.post('/users', userData)
}

// 更新资源
const updateUser = async (
  id: number,
  userData: UpdateUserData
): Promise<ApiResponse<User>> => {
  return await unifiedApi.put(`/users/${id}`, userData)
}

// 删除资源
const deleteUser = async (id: number): Promise<ApiResponse<void>> => {
  return await unifiedApi.delete(`/users/${id}`)
}
```

#### 2.2 批量操作

```typescript
// 批量创建
const batchCreateUsers = async (
  usersData: CreateUserData[]
): Promise<ApiResponse<User[]>> => {
  return await unifiedApi.post('/users/batch', { users: usersData })
}

// 批量更新
const batchUpdateUsers = async (
  updates: Array<{ id: number; data: UpdateUserData }>
): Promise<ApiResponse<User[]>> => {
  return await unifiedApi.put('/users/batch', { updates })
}

// 批量删除
const batchDeleteUsers = async (ids: number[]): Promise<ApiResponse<void>> => {
  return await unifiedApi.delete('/users/batch', { data: { ids } })
}
```

### 3. 查询参数规范

#### 3.1 分页查询

```typescript
interface PaginationParams {
  page?: number        // 页码，从 1 开始
  pageSize?: number    // 每页大小，默认 20
  sortBy?: string      // 排序字段
  sortOrder?: 'asc' | 'desc' // 排序方向
}

const getUsers = async (params: PaginationParams & UserFilters) => {
  return await unifiedApi.get('/users', {
    params: {
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      sortBy: params.sortBy || 'createdAt',
      sortOrder: params.sortOrder || 'desc',
      ...params.filters
    }
  })
}
```

#### 3.2 过滤和搜索

```typescript
interface UserFilters {
  status?: 'active' | 'inactive'
  role?: string
  keyword?: string
  dateRange?: [Date, Date]
}

const searchUsers = async (filters: UserFilters) => {
  return await unifiedApi.get('/users/search', {
    params: {
      ...filters,
      // 日期范围转换为字符串
      startDate: filters.dateRange?.[0]?.toISOString(),
      endDate: filters.dateRange?.[1]?.toISOString()
    }
  })
}
```

### 4. 请求体规范

#### 4.1 创建数据

```typescript
interface CreateUserData {
  name: string
  email: string
  password: string
  roleId: number
  profile?: {
    avatar?: string
    bio?: string
    phone?: string
  }
}

const createUser = async (userData: CreateUserData) => {
  // 自动类型验证
  return await unifiedApi.post('/users', userData)
}
```

#### 4.2 更新数据

```typescript
interface UpdateUserData {
  name?: string
  email?: string
  profile?: Partial<UserProfile>
}

const updateUser = async (id: number, userData: UpdateUserData) => {
  // 使用 PATCH 部分更新
  return await unifiedApi.patch(`/users/${id}`, userData)
}
```

### 5. 文件上传

#### 5.1 单文件上传

```typescript
const uploadAvatar = async (userId: number, file: File): Promise<ApiResponse<{ url: string }>> => {
  const formData = new FormData()
  formData.append('avatar', file)
  formData.append('userId', userId.toString())

  return await unifiedApi.post('/users/upload-avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
```

#### 5.2 多文件上传

```typescript
const uploadDocuments = async (files: File[]): Promise<ApiResponse<string[]>> => {
  const formData = new FormData()
  files.forEach((file, index) => {
    formData.append(`files[${index}]`, file)
  })

  return await unifiedApi.post('/documents/batch-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      const progress = Math.round(
        (progressEvent.loaded * 100) / (progressEvent.total || 1)
      )
      console.log(`上传进度：${progress}%`)
    }
  })
}
```

## 🔄 响应处理

### 1. 响应格式规范

#### 1.1 单个资源响应

```typescript
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  timestamp: string
}
```

#### 1.2 列表响应

```typescript
interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  message?: string
  timestamp: string
}
```

#### 1.3 错误响应

```typescript
interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, any>
    stack?: string // 仅开发环境
  }
  timestamp: string
}
```

### 2. 响应处理示例

```typescript
// 处理列表响应
const loadUsers = async () => {
  try {
    const response = await getUsers({ page: 1, pageSize: 20 })

    if (response.success) {
      users.value = response.data
      pagination.value = response.pagination
    }
  } catch (error) {
    handleApiError(error)
  }
}

// 处理创建响应
const handleCreateUser = async (userData: CreateUserData) => {
  const closeLoading = loading('创建用户中...')

  try {
    const response = await createUser(userData)

    if (response.success) {
      success('用户创建成功')
      await loadUsers() // 刷新列表
      return response.data
    }
  } catch (error) {
    handleApiError(error, '用户创建失败')
    throw error
  } finally {
    closeLoading()
  }
}
```

## ⚡ 请求优化

### 1. 请求缓存

```typescript
// 使用查询缓存
const getCachedUsers = async (params: QueryParams) => {
  return await unifiedApi.get('/users', {
    params,
    // 缓存 5 分钟
    cache: {
      ttl: 5 * 60 * 1000,
      key: `users:${JSON.stringify(params)}`
    }
  })
}

// 清除缓存
const clearUsersCache = () => {
  unifiedApi.clearCache('/users/*')
}
```

### 2. 请求防抖

```typescript
import { debounce } from 'lodash-es'

const debouncedSearch = debounce(async (keyword: string) => {
  const response = await searchUsers({ keyword })
  searchResults.value = response.data
}, 300)

// 在输入框中使用
const handleSearchInput = (event: Event) => {
  const keyword = (event.target as HTMLInputElement).value
  debouncedSearch(keyword)
}
```

### 3. 请求取消

```typescript
// 使用 AbortController 取消请求
const loadUsersWithCancel = async (params: QueryParams) => {
  const controller = new AbortController()

  // 设置超时取消
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, 10000)

  try {
    const response = await unifiedApi.get('/users', {
      params,
      signal: controller.signal
    })
    return response
  } catch (error) {
    if (error.name === 'AbortError') {
      warning('请求超时，请重试')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
```

## 🔐 安全规范

### 1. 认证处理

```typescript
// 统一认证处理在拦截器中自动完成
// 开发者无需手动添加认证头

// 刷新 Token 处理
unifiedApi.setupAuthRefresh(async (refreshToken) => {
  const response = await authApi.refreshToken(refreshToken)
  return response.data.token
})
```

### 2. 权限检查

```typescript
// API 级别的权限检查
const deleteSensitiveData = async (id: number) => {
  // 检查权限
  if (!hasPermission('data:delete')) {
    throw new Error('权限不足')
  }

  return await unifiedApi.delete(`/sensitive-data/${id}`)
}
```

### 3. 数据验证

```typescript
// 请求前验证
const createOrder = async (orderData: CreateOrderData) => {
  // 前端验证
  if (!orderValidate(orderData)) {
    throw new Error('订单数据验证失败')
  }

  return await unifiedApi.post('/orders', orderData)
}

// 响应后验证
const loadOrders = async () => {
  const response = await unifiedApi.get('/orders')

  // 验证响应数据
  if (!isValidOrdersResponse(response)) {
    throw new Error('响应数据格式错误')
  }

  return response
}
```

## 🧪 测试规范

### 1. Mock API

```typescript
// 使用 MSW 模拟 API
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        data: [{ id: 1, name: 'Test User' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
      })
    )
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 2. 单元测试

```typescript
import { unifiedApi } from '@/services/unified-api'

describe('API 调用', () => {
  it('应该正确处理成功响应', async () => {
    const response = await unifiedApi.get('/test/success')
    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
  })

  it('应该正确处理错误响应', async () => {
    await expect(unifiedApi.get('/test/error')).rejects.toThrow()
  })
})
```

## 📝 最佳实践

### 1. API 服务封装

```typescript
// 创建专门的 API 服务类
class UserApiService {
  private static instance: UserApiService

  static getInstance(): UserApiService {
    if (!UserApiService.instance) {
      UserApiService.instance = new UserApiService()
    }
    return UserApiService.instance
  }

  async getUsers(params?: QueryParams): Promise<PaginatedResponse<User[]>> {
    return await unifiedApi.get('/users', { params })
  }

  async createUser(userData: CreateUserData): Promise<ApiResponse<User>> {
    return await unifiedApi.post('/users', userData)
  }

  async updateUser(id: number, userData: UpdateUserData): Promise<ApiResponse<User>> {
    return await unifiedApi.put(`/users/${id}`, userData)
  }

  async deleteUser(id: number): Promise<ApiResponse<void>> {
    return await unifiedApi.delete(`/users/${id}`)
  }
}

// 导出单例
export const userApi = UserApiService.getInstance()
```

### 2. 错误处理模式

```typescript
// 导入统一通知服务
import { useNotification } from '@/composables/useNotification'

const { success, error, warning, info, loading, confirm, handleApiError } = useNotification()

// 统一的错误处理函数
const handleApiCall = async <T>(
  apiCall: () => Promise<ApiResponse<T>>,
  successMessage?: string,
  errorMessage?: string
): Promise<T | null> => {
  try {
    const response = await apiCall()

    if (response.success && successMessage) {
      success(successMessage)
    }

    return response.data
  } catch (error) {
    handleApiError(error, errorMessage)
    return null
  }
}

// 使用示例
const handleCreateUser = async (userData: CreateUserData) => {
  const closeLoading = loading('创建用户中...')

  try {
    const result = await handleApiCall(
      () => userApi.createUser(userData),
      '用户创建成功',
      '用户创建失败'
    )
    return result
  } finally {
    closeLoading()
  }
}

// 确认操作示例
const handleDeleteUser = async (userId: number) => {
  const confirmed = await confirm(
    '确认删除用户吗？',
    '删除后将无法恢复，请谨慎操作。',
    {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    }
  )

  if (confirmed) {
    await handleApiCall(
      () => userApi.deleteUser(userId),
      '用户删除成功',
      '用户删除失败'
    )
  }
}
```

### 3. 状态管理模式

```typescript
// 结合 Pinia 状态管理
import { defineStore } from 'pinia'

export const useUserStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const loading = ref(false)
  const pagination = ref<PaginationInfo>()

  const loadUsers = async (params?: QueryParams) => {
    loading.value = true

    try {
      const response = await userApi.getUsers(params)

      if (response.success) {
        users.value = response.data
        pagination.value = response.pagination
      }
    } catch (error) {
      handleApiError(error)
    } finally {
      loading.value = false
    }
  }

  return {
    users,
    loading,
    pagination,
    loadUsers
  }
})
```

## 🔍 故障排除

### 常见问题

1. **CORS 错误**
   - 检查服务器 CORS 配置
   - 确认 API 基础 URL 正确

2. **认证失败**
   - 检查 Token 是否有效
   - 确认刷新 Token 逻辑

3. **请求超时**
   - 检查网络连接
   - 调整超时配置

4. **类型错误**
   - 确保类型定义正确
   - 更新 API 类型声明

### 调试技巧

```typescript
// 开启请求日志
if (import.meta.env.DEV) {
  unifiedApi.setConfig({
    debug: true,
    logLevel: 'debug'
  })
}

// 查看请求详情
unifiedApi.interceptors.request.use((config) => {
  console.log('请求详情：', {
    url: config.url,
    method: config.method,
    params: config.params,
    data: config.data
  })
  return config
})
```

## 📝 表单验证规范

### 统一使用 useForm

TF2025 项目统一使用 `useForm` composable 进行表单验证，禁止各页面自行定义验证规则。

**导入方式：**
```typescript
import { useForm, ValidationRules } from '@/composables'
```

**标准目录：**
- `composables/forms/useForm.ts` - 表单验证核心实现
- `composables/index.ts` - 统一导出入口

### 常用验证规则速查

| 规则 | 说明 | 示例 |
|------|------|------|
| `ValidationRules.required()` | 必填 | 姓名、联系方式等 |
| `ValidationRules.phone()` | 手机号 | 中国大陆手机号 |
| `ValidationRules.email()` | 邮箱 | 邮箱地址 |
| `ValidationRules.idCard()` | 身份证 | 15/18位身份证号 |
| `ValidationRules.minLength(n)` | 最小长度 | 密码至少6位 |
| `ValidationRules.maxLength(n)` | 最大长度 | 昵称最多20字符 |
| `ValidationRules.number()` | 数字 | 纯数字 |
| `ValidationRules.positiveInteger()` | 正整数 | 数量、库存 |
| `ValidationRules.positiveNumber()` | 正数 | 价格、金额 |
| `ValidationRules.range(min, max)` | 范围 | 0-100的数值 |
| `ValidationRules.pattern(regex)` | 正则 | 自定义格式 |
| `ValidationRules.url()` | URL | 网页链接 |
| `ValidationRules.enum(values)` | 枚举 | 固定选项值 |
| `ValidationRules.chineseName()` | 中文姓名 | 2-20个汉字 |
| `ValidationRules.bankCard()` | 银行卡号 | 16-19位数字 |
| `ValidationRules.wechat()` | 微信号 | 6-20位字母数字 |
| `ValidationRules.qq()` | QQ号 | 5-11位数字 |
| `ValidationRules.nonEmptyArray()` | 非空数组 | 至少选择一项 |
| `ValidationRules.date()` | 日期 | 有效日期格式 |
| `ValidationRules.confirmPassword('password')` | 确认密码 | 两次密码一致 |

### 使用示例

**基本用法：**
```typescript
import { useForm, ValidationRules } from '@/composables'
import type { FormInstance } from 'element-plus'

const formRef = ref<FormInstance>()

const { form, validate, reset, setFieldValue } = useForm({
  initialValues: {
    name: '',
    phone: '',
    email: ''
  },
  validationRules: {
    name: [
      ValidationRules.required('请输入姓名'),
      ValidationRules.chineseName('请输入正确的中文姓名')
    ],
    phone: [
      ValidationRules.required('请输入手机号'),
      ValidationRules.phone()
    ],
    email: [
      ValidationRules.email('请输入正确的邮箱')
    ]
  },
  validateTrigger: 'blur'  // 失去焦点时验证
})

const handleSubmit = async () => {
  const valid = await validate()
  if (valid) {
    // 提交表单数据
    await saveData(form.values)
  }
}
```

**表单绑定（Element Plus）：**
```vue
<template>
  <el-form
    ref="formRef"
    :model="form.values"
    :rules="computedRules"
    label-width="80px"
  >
    <el-form-item label="姓名" prop="name">
      <el-input
        v-model="form.values.name"
        placeholder="请输入姓名"
      />
    </el-form-item>
    <el-form-item label="手机号" prop="phone">
      <el-input
        v-model="form.values.phone"
        placeholder="请输入手机号"
      />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useForm, ValidationRules } from '@/composables'
import type { FormRules } from 'element-plus'

const { form, validate } = useForm({
  initialValues: { name: '', phone: '' },
  validationRules: {
    name: [ValidationRules.required('请输入姓名')],
    phone: [ValidationRules.required('请输入手机号'), ValidationRules.phone()]
  }
})

// 转换为 Element Plus 格式
const computedRules = computed<FormRules>(() => ({
  name: form.errors.name ? [{ required: true, message: form.errors.name, trigger: 'blur' }] : [],
  phone: form.errors.phone ? [{ required: true, message: form.errors.phone, trigger: 'blur' }] : []
}))

const handleSubmit = async () => {
  await validate()
}
</script>
```

**密码确认：**
```typescript
const { form } = useForm({
  initialValues: { password: '', confirmPassword: '' },
  validationRules: {
    password: [
      ValidationRules.required('请输入密码'),
      ValidationRules.minLength(6, '密码至少6位')
    ],
    confirmPassword: [
      ValidationRules.required('请确认密码'),
      ValidationRules.confirmPassword('password', '两次输入的密码不一致')
    ]
  }
})
```

**日期范围验证：**
```typescript
const { form } = useForm({
  initialValues: { startDate: '', endDate: '' },
  validationRules: {
    startDate: [ValidationRules.required('请选择开始日期')],
    endDate: [
      ValidationRules.required('请选择结束日期'),
      ValidationRules.dateRange('startDate', '结束日期不能早于开始日期')
    ]
  }
})
```

### 配置选项

```typescript
interface UseFormOptions<T extends Record<string, any>> {
  /** 初始值 */
  initialValues: T
  /** 验证规则 */
  validationRules?: Partial<Record<keyof T, ValidationRule[]>>
  /** 提交函数 */
  onSubmit?: (values: T) => Promise<void>
  /** 重置函数 */
  onReset?: () => void
  /** 验证触发方式：change | blur | submit | all */
  validateTrigger?: 'change' | 'blur' | 'submit' | 'all'
  /** 是否立即验证 */
  immediate?: boolean
  /** 防抖延迟(ms) */
  debounce?: number
}
```

### 返回值

```typescript
interface UseFormReturn<T extends Record<string, any>> {
  /** 表单状态 */
  form: FormState<T>
  /** 设置单个字段值 */
  setFieldValue: (field: keyof T, value: any) => void
  /** 设置多个字段值 */
  setFieldsValue: (values: Partial<T>) => void
  /** 获取字段值 */
  getFieldValue: (field: keyof T) => any
  /** 重置表单 */
  reset: () => void
  /** 验证单个字段 */
  validateField: (field: keyof T) => Promise<boolean>
  /** 验证整个表单 */
  validate: () => Promise<boolean>
  /** 提交表单 */
  submit: () => Promise<void>
  /** 清除字段错误 */
  clearFieldError: (field: keyof T) => void
  /** 清除所有错误 */
  clearErrors: () => void
  /** 设置字段错误 */
  setFieldError: (field: keyof T, error: string) => void
}
```

### ❌ 禁止的做法

```typescript
// ❌ 错误：各页面自行定义验证规则
const formRules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误', trigger: 'blur' }
  ]
}

// ✅ 正确：使用统一的 ValidationRules
const { form } = useForm({
  initialValues: { phone: '' },
  validationRules: {
    phone: [ValidationRules.required(), ValidationRules.phone()]
  }
})

// ❌ 错误：在 services/ 创建重复的验证工具
// src/services/validation.ts
export const validatePhone = (phone: string) => { ... }

// ✅ 正确：使用统一的 ValidationRules.phone()
```

### 迁移指南

已有页面可逐步迁移到统一规范：

1. 将页面中的 `formRules: FormRules` 替换为 `useForm` + `ValidationRules`
2. 将 `el-form :rules` 绑定改为使用 `form.errors`
3. 删除页面内自定义的验证函数

---

## ⚡ Loading 状态规范

### 统一使用 useLoadingState

TF2025 项目统一使用 `useLoadingState` composable 管理 loading 状态，禁止各页面自行定义。

**导入方式：**
```typescript
import { useLoadingState } from '@/composables'
```

### 使用示例

**基本用法：**
```typescript
import { useLoadingState } from '@/composables'

// ✅ 正确：使用统一的 loading
const { loading, start, stop, wrap } = useLoadingState()

// 方式1：手动控制
loading.value = true
try {
  await fetchData()
} finally {
  loading.value = false
}

// 方式2：使用 wrap 自动处理
await wrap(async () => {
  await fetchData()
})
```

**多个 loading 状态：**
```typescript
// ✅ 正确：使用别名
const { loading } = useLoadingState()
const { loading: loadingMore } = useLoadingState()
const { loading: exporting } = useLoadingState()
```

**在 Vue 模板中使用：**
```vue
<template>
  <!-- 直接使用 loading.value -->
  <div v-loading="loading.value">
    ...
  </div>

  <!-- 或使用 Element Plus 的 loading 指令 -->
  <el-button :loading="loading.value">
    提交
  </el-button>
</template>
```

### ❌ 禁止的做法

```typescript
// ❌ 错误：各页面自行定义 loading
const loading = ref(false)

// ❌ 错误：创建独立的 loading 工具
// src/utils/my-loading.ts
export const createLoading = () => ref(false)

// ✅ 正确：使用统一的 useLoadingState
import { useLoadingState } from '@/composables'
const { loading } = useLoadingState()
```

### API 参考

```typescript
function useLoadingState(initial?: boolean): {
  // 响应式 loading 状态
  loading: Ref<boolean>
  isLoading: Ref<boolean>  // loading 的别名

  // 手动控制
  start: () => void       // loading.value = true
  stop: () => void        // loading.value = false

  // 自动包装
  wrap: <T>(fn: () => Promise<T>) => Promise<T>  // 自动处理 loading
}
```

---

## 📚 参考资料

- [Axios 官方文档](https://axios-http.com/)
- [RESTful API 设计指南](https://restfulapi.net/)
- [HTTP 状态码规范](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [TypeScript 类型体操](https://www.typescriptlang.org/)

---

**更新日期**：2026-04-09
**版本**：v1.3.0
**维护者**：TF2025 开发团队
**变更记录**：
- v1.3.0：新增 Loading 状态规范，统一使用 `useLoadingState`
- v1.2.0：新增表单验证规范，统一使用 `useForm` + `ValidationRules`
- v1.1.0：新增 `src/api/` vs `src/services/` 目录结构规范，消除功能重复