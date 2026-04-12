# TF2025 TypeScript 规范

## 📋 概述

TF2025 项目全面采用 TypeScript 进行开发，通过强类型约束提升代码质量、减少运行时错误、改善开发体验。本规范定义了项目中 TypeScript 的使用标准，包括类型定义、接口设计、泛型应用和最佳实践。

## 🎯 设计原则

1. **类型安全**：充分利用 TypeScript 的类型系统，避免 `any` 类型
2. **可维护性**：清晰的类型定义，便于代码理解和维护
3. **可扩展性**：设计灵活的类型结构，支持功能扩展
4. **性能优化**：合理的类型设计，避免过度的类型计算
5. **开发体验**：良好的类型提示和自动补全

## 🏗️ 项目类型架构

### 类型组织结构

```
类型定义架构
├── 基础类型 (Base Types)
│   ├── 原始类型扩展
│   ├── 通用工具类型
│   └── 常量定义
├── 业务实体类型 (Entity Types)
│   ├── 用户相关
│   ├── 订单相关
│   └── 业务模型
├── API 类型 (API Types)
│   ├── 请求类型
│   ├── 响应类型
│   └── 分页类型
├── 组件类型 (Component Types)
│   ├── Props 类型
│   ├── Emits 类型
│   └── Slots 类型
└── 状态管理类型 (State Types)
    ├── Store 状态
    ├── Actions 类型
    └── Getters 类型
```

## 📚 类型定义规范

### 1. 基础类型定义

```typescript
// types/base.ts

// 原始类型扩展
export type ID = number | string
export type Timestamp = number
export type DateString = string // YYYY-MM-DD
export type DateTimeString = string // ISO 8601

// 状态枚举
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  DELETED = 'deleted'
}

export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
  CUSTOMER = 'customer'
}

// 通用接口
export interface BaseEntity {
  id: ID
  createdAt: DateTimeString
  updatedAt: DateTimeString
  status: Status
}

export interface AuditableEntity extends BaseEntity {
  createdBy: ID
  updatedBy: ID
  version: number
}

// 工具类型
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
```

### 2. 业务实体类型

```typescript
// types/entities/user.ts
import { BaseEntity, AuditableEntity, ID } from '../base'

// 用户基础信息
export interface User extends BaseEntity {
  username: string
  email: string
  name: string
  phone?: string
  avatar?: string
  role: Role
  department?: string
  lastLoginAt?: DateTimeString
}

// 用户详细信息
export interface UserProfile extends User {
  bio?: string
  address?: Address
  preferences: UserPreferences
  permissions: Permission[]
}

// 用户偏好设置
export interface UserPreferences {
  language: string
  timezone: string
  theme: 'light' | 'dark' | 'auto'
  notifications: NotificationSettings
}

export interface NotificationSettings {
  email: boolean
  sms: boolean
  push: boolean
  types: NotificationType[]
}

// 地址信息
export interface Address {
  street: string
  city: string
  province: string
  postalCode: string
  country: string
}

// 权限信息
export interface Permission {
  id: ID
  name: string
  resource: string
  action: string
  description?: string
}

// 用户相关操作类型
export interface CreateUserData {
  username: string
  email: string
  name: string
  password: string
  role: Role
  department?: string
}

export interface UpdateUserData {
  name?: string
  email?: string
  phone?: string
  avatar?: string
  department?: string
  role?: Role
  status?: Status
}

export interface UserFilters {
  keyword?: string
  role?: Role
  status?: Status
  department?: string
  dateRange?: [DateString, DateString]
}
```

### 3. API 类型定义

```typescript
// types/api.ts
import { ID } from './base'

// 通用响应格式
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  timestamp: string
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
  timestamp: string
}

// 分页响应
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// 分页请求参数
export interface PaginationParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 查询参数
export interface QueryParams extends PaginationParams {
  keyword?: string
  filters?: Record<string, any>
}

// 批量操作参数
export interface BatchOperationParams<T> {
  ids: ID[]
  operation: BatchOperation
  data?: T
}

export enum BatchOperation {
  DELETE = 'delete',
  UPDATE = 'update',
  ARCHIVE = 'archive'
}

// 文件上传
export interface FileUploadResponse {
  url: string
  filename: string
  size: number
  mimeType: string
}
```

### 4. 组件类型定义

```typescript
// types/components.ts
import { ComponentType } from 'vue'
import { ElTable } from 'element-plus'

// 通用 Props 类型
export interface BaseComponentProps {
  id?: string | number
  class?: string
  style?: string | Record<string, any>
}

// 分页组件 Props
export interface PaginationProps extends BaseComponentProps {
  current: number
  pageSize: number
  total: number
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  showTotal?: boolean
  pageSizeOptions?: number[]
}

// 表格组件 Props
export interface TableProps<T = any> extends BaseComponentProps {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  pagination?: PaginationProps
  selection?: T[]
  rowKey?: string | ((row: T) => string)
}

export interface TableColumn<T = any> {
  key: string
  title: string
  dataIndex?: keyof T
  width?: number | string
  fixed?: 'left' | 'right'
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, record: T, index: number) => any
}

// 表单组件 Props
export interface FormProps extends BaseComponentProps {
  model: Record<string, any>
  rules?: FormRules
  labelWidth?: string | number
  labelPosition?: 'left' | 'right' | 'top'
  disabled?: boolean
}

export interface FormRules {
  [key: string]: FormRule[]
}

export interface FormRule {
  required?: boolean
  message?: string
  trigger?: 'blur' | 'change'
  min?: number
  max?: number
  pattern?: RegExp
  validator?: (rule: FormRule, value: any, callback: (error?: string) => void) => void
}
```

## 🔧 高级类型应用

### 1. 泛型应用

```typescript
// 响应式数据包装器
export interface AsyncData<T, E = Error> {
  data: T | null
  loading: boolean
  error: E | null
  execute: () => Promise<void>
  refresh: () => Promise<void>
}

// API 服务基类
export abstract class BaseApiService<T, CreateData, UpdateData> {
  abstract get endpoint(): string

  async getAll(params?: QueryParams): Promise<PaginatedResponse<T[]>> {
    return await unifiedApi.get(this.endpoint, { params })
  }

  async getById(id: ID): Promise<ApiResponse<T>> {
    return await unifiedApi.get(`${this.endpoint}/${id}`)
  }

  async create(data: CreateData): Promise<ApiResponse<T>> {
    return await unifiedApi.post(this.endpoint, data)
  }

  async update(id: ID, data: UpdateData): Promise<ApiResponse<T>> {
    return await unifiedApi.put(`${this.endpoint}/${id}`, data)
  }

  async delete(id: ID): Promise<ApiResponse<void>> {
    return await unifiedApi.delete(`${this.endpoint}/${id}`)
  }
}

// 具体服务实现
export class UserApiService extends BaseApiService<User, CreateUserData, UpdateUserData> {
  endpoint = '/users'

  async search(filters: UserFilters): Promise<PaginatedResponse<User[]>> {
    return await this.getAll({ filters })
  }
}
```

### 2. 条件类型

```typescript
// 根据操作类型返回不同的数据类型
type ApiResponseData<T extends keyof ApiEndpoints> = ApiEndpoints[T] extends {
  response: infer R
}
  ? R
  : never

// API 端点定义
interface ApiEndpoints {
  'GET /users': {
    query: QueryParams
    response: PaginatedResponse<User[]>
  }
  'POST /users': {
    body: CreateUserData
    response: ApiResponse<User>
  }
  'PUT /users/:id': {
    params: { id: ID }
    body: UpdateUserData
    response: ApiResponse<User>
  }
}

// 类型安全的 API 调用
async function callApi<T extends keyof ApiEndpoints>(
  endpoint: T,
  options?: {
    query?: ApiEndpoints[T]['query']
    body?: ApiEndpoints[T]['body']
    params?: Record<string, any>
  }
): Promise<ApiResponseData<T>> {
  // 实现...
}
```

### 3. 工具类型扩展

```typescript
// 深度只读
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

// 选择性必需
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>

// 提取数组元素类型
export type ArrayElement<T> = T extends (infer U)[] ? U : never

// 函数参数类型
export type FuncParams<T> = T extends (...args: infer P) => any ? P : never

// 函数返回类型
export type FuncReturn<T> = T extends (...args: any[]) => infer R ? R : never

// 创建类型守卫
export function isOfType<T>(
  value: unknown,
  predicate: (value: unknown) => value is T
): value is T {
  return predicate(value)
}

// 使用示例
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}
```

## 📝 组件类型最佳实践

### 1. Vue 组件类型定义

```vue
<!-- UserForm.vue -->
<script setup lang="ts">
import { ref, computed, type PropType } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { User, CreateUserData, UpdateUserData } from '@/types/entities/user'

// Props 类型定义
interface Props {
  user?: User  // 编辑模式时传入
  readonly?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  loading: false
})

// Emits 类型定义
interface Emits {
  submit: [data: CreateUserData | UpdateUserData]
  cancel: []
  change: [field: string, value: any]
}

const emit = defineEmits<Emits>()

// 响应式数据类型
const formData = ref<CreateUserData>({
  username: '',
  email: '',
  name: '',
  password: '',
  role: Role.CUSTOMER
})

const formRef = ref<FormInstance>()

// 计算属性类型
const isEditing = computed((): boolean => !!props.user)

const formTitle = computed((): string => {
  return isEditing.value ? '编辑用户' : '新建用户'
})

// 表单验证规则类型
const formRules: ComputedRef<FormRules> = computed(() => ({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为 3-20 个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  password: [
    {
      required: !isEditing.value,
      message: '请输入密码',
      trigger: 'blur'
    },
    {
      min: 6,
      message: '密码至少 6 个字符',
      trigger: 'blur'
    }
  ]
}))

// 方法类型定义
const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return

  try {
    const valid = await formRef.value.validate()
    if (!valid) return

    emit('submit', formData.value)
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

const handleFieldChange = (field: string, value: any): void => {
  emit('change', field, value)
}
</script>
```

### 2. 组合式函数类型

```typescript
// composables/useTable.ts
import { ref, computed, watch, type Ref } from 'vue'
import type { TableProps, TableColumn } from '@/types/components'

export interface UseTableOptions<T> {
  data: Ref<T[]>
  columns: TableColumn<T>[]
  loading?: Ref<boolean>
  pageSize?: number
  rowKey?: string | ((row: T) => string)
}

export interface UseTableReturn<T> {
  tableProps: ComputedRef<TableProps<T>>
  currentPage: Ref<number>
  pageSize: Ref<number>
  paginatedData: ComputedRef<T[]>
  total: ComputedRef<number>
  handlePageChange: (page: number) => void
  handleSizeChange: (size: number) => void
  refresh: () => void
}

export function useTable<T = any>(
  options: UseTableOptions<T>
): UseTableReturn<T> {
  const currentPage = ref(1)
  const pageSize = ref(options.pageSize || 20)

  const total = computed(() => options.data.value.length)

  const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return options.data.value.slice(start, end)
  })

  const tableProps = computed<TableProps<T>>(() => ({
    data: paginatedData.value,
    columns: options.columns,
    loading: options.loading?.value || false,
    rowKey: options.rowKey
  }))

  const handlePageChange = (page: number) => {
    currentPage.value = page
  }

  const handleSizeChange = (size: number) => {
    pageSize.value = size
    currentPage.value = 1
  }

  const refresh = () => {
    currentPage.value = 1
  }

  // 监听数据变化
  watch(
    () => options.data.value.length,
    () => {
      const maxPage = Math.ceil(total.value / pageSize.value)
      if (currentPage.value > maxPage) {
        currentPage.value = maxPage || 1
      }
    }
  )

  return {
    tableProps,
    currentPage,
    pageSize,
    paginatedData,
    total,
    handlePageChange,
    handleSizeChange,
    refresh
  }
}
```

## 🔍 类型检查和验证

### 1. 运行时类型检查

```typescript
// utils/type-guards.ts
import { isObject, isString, isNumber } from './validators'

// 用户类型守卫
export function isUser(obj: unknown): obj is User {
  return (
    isObject(obj) &&
    isNumber(obj.id) &&
    isString(obj.username) &&
    isString(obj.email) &&
    isString(obj.name) &&
    Object.values(Role).includes(obj.role)
  )
}

// API 响应类型守卫
export function isApiResponse<T>(obj: unknown, guard: (data: unknown) => data is T): obj is ApiResponse<T> {
  return (
    isObject(obj) &&
    typeof obj.success === 'boolean' &&
    guard(obj.data) &&
    (obj.message === undefined || isString(obj.message))
  )
}

// 类型安全的 JSON 解析
export function safeJsonParse<T>(json: string, guard: (data: unknown) => data is T): T | null {
  try {
    const data = JSON.parse(json)
    return guard(data) ? data : null
  } catch {
    return null
  }
}
```

### 2. 数据验证器

```typescript
// utils/validators.ts
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isArray<T>(value: unknown, guard?: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false
  if (!guard) return true
  return value.every(guard)
}

export function isEmail(value: unknown): value is string {
  return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isDateString(value: unknown): value is string {
  return isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
```

## 🎯 TypeScript 配置

### 1. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/views/*": ["src/views/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/stores/*": ["src/stores/*"],
      "@/services/*": ["src/services/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.vue"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### 2. 类型声明文件

```typescript
// types/global.d.ts

// 扩展 Vue 类型
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $success: (message: string, options?: NotificationOptions) => void
    $error: (message: string, options?: NotificationOptions) => void
    $warning: (message: string, options?: NotificationOptions) => void
    $info: (message: string, options?: NotificationOptions) => void
    $confirm: (message: string, title?: string, options?: any) => Promise<boolean>
  }
}

// 扩展环境变量类型
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_VERSION: string
  readonly VITE_ENABLE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 扩展窗口对象类型
declare global {
  interface Window {
    __TF2025_CONFIG__?: {
      apiBaseUrl: string
      debug: boolean
    }
    __TF2025_DEBUG__?: {
      showErrors: boolean
      logLevel: 'info' | 'warn' | 'error' | 'debug'
    }
  }
}

export {}
```

## 📋 开发规范检查

### 1. 类型安全检查清单

- [ ] 避免使用 `any` 类型，必要时使用 `unknown`
- [ ] 为所有函数参数和返回值添加类型
- [ ] 使用接口定义对象结构
- [ ] 为可选属性添加 `?` 标记
- [ ] 使用枚举替代魔法字符串
- [ ] 为复杂类型创建类型别名
- [ ] 使用泛型提高代码复用性

### 2. 代码审查要点

- [ ] 类型定义是否合理
- [ ] 是否有类型守卫函数
- [ ] 错误处理是否类型安全
- [ ] 组件 Props 类型是否完整
- [ ] API 响应类型是否正确定义

## 📚 参考资料

- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Vue 3 TypeScript 支持](https://vuejs.org/guide/typescript/overview.html)
- [TypeScript 最佳实践](https://typescript-eslint.io/rules/)
- [Effective TypeScript](https://effectivetypescript.com/)

---

**更新日期**：2025-01-15
**版本**：v1.0.0
**维护者**：TF2025 开发团队