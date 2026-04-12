# TF2025 CRUD 逻辑规范

## 📋 概述

TF2025 项目采用标准化的 CRUD（Create、Read、Update、Delete）操作模式，确保所有业务模块的数据操作逻辑一致、可维护和安全。本规范定义了 CRUD 操作的通用模式、数据验证、错误处理、权限控制和最佳实践。

## 🎯 设计原则

1. **一致性**：所有模块采用相同的 CRUD 操作模式
2. **安全性**：严格的权限控制和数据验证
3. **用户体验**：友好的操作反馈和错误提示
4. **性能优化**：批量操作和缓存策略
5. **可扩展性**：支持复杂的业务逻辑扩展

## 🏗️ CRUD 架构设计

### 架构层次

```
CRUD 操作架构
├── 表现层 (Presentation Layer)
│   ├── CRUD 表单组件
│   ├── 列表/详情组件
│   └── 用户交互处理
├── 业务逻辑层 (Business Logic Layer)
│   ├── CRUD 操作服务
│   ├── 数据验证器
│   └── 权限控制器
├── 数据访问层 (Data Access Layer)
│   ├── API 调用封装
│   ├── 数据转换器
│   └── 错误处理器
└── 状态管理层 (State Management Layer)
    ├── Pinia Store
    ├── 缓存管理
    └── 同步机制
```

## 📚 CRUD 核心组件

### 1. CRUD 服务基类

```typescript
// services/base/CrudService.ts
import { unifiedApi } from '@/services/unified-api'
import { useNotification } from '@/composables/useNotification'
import { useErrorHandler } from '@/composables/useErrorHandler'
import type { ApiResponse, PaginatedResponse, QueryParams } from '@/types/api'

export interface CrudEntity {
  id: number | string
  createdAt: string
  updatedAt: string
}

export interface CrudFilters extends Record<string, any> {
  keyword?: string
  status?: string
  dateRange?: [string, string]
}

export abstract class CrudService<T extends CrudEntity, CreateData, UpdateData> {
  protected abstract endpoint: string
  protected abstract resourceName: string

  protected notification = useNotification()
  protected errorHandler = useErrorHandler()

  // 读取操作
  async getAll(params?: QueryParams & { filters?: CrudFilters }): Promise<PaginatedResponse<T[]>> {
    try {
      const response = await unifiedApi.get(this.endpoint, { params })
      return response
    } catch (error) {
      this.errorHandler.handleApiError(error, `获取${this.resourceName}列表失败`)
      throw error
    }
  }

  async getById(id: number | string): Promise<T> {
    try {
      const response = await unifiedApi.get(`${this.endpoint}/${id}`)
      if (response.success) {
        return response.data
      }
      throw new Error(response.message || '获取数据失败')
    } catch (error) {
      this.errorHandler.handleApiError(error, `获取${this.resourceName}详情失败`)
      throw error
    }
  }

  // 创建操作
  async create(data: CreateData): Promise<T> {
    const closeLoading = this.notification.loading(`正在创建${this.resourceName}...`)

    try {
      const response = await unifiedApi.post(this.endpoint, data)

      if (response.success) {
        this.notification.success(`${this.resourceName}创建成功`)
        return response.data
      }
      throw new Error(response.message || '创建失败')
    } catch (error) {
      this.errorHandler.handleApiError(error, `${this.resourceName}创建失败`)
      throw error
    } finally {
      closeLoading()
    }
  }

  // 更新操作
  async update(id: number | string, data: UpdateData): Promise<T> {
    const closeLoading = this.notification.loading(`正在更新${this.resourceName}...`)

    try {
      const response = await unifiedApi.put(`${this.endpoint}/${id}`, data)

      if (response.success) {
        this.notification.success(`${this.resourceName}更新成功`)
        return response.data
      }
      throw new Error(response.message || '更新失败')
    } catch (error) {
      this.errorHandler.handleApiError(error, `${this.resourceName}更新失败`)
      throw error
    } finally {
      closeLoading()
    }
  }

  // 删除操作
  async delete(id: number | string): Promise<void> {
    try {
      const confirmed = await this.notification.confirm(
        `确定要删除这个${this.resourceName}吗？`,
        '删除确认',
        { type: 'warning' }
      )

      if (!confirmed) {
        return
      }

      const response = await unifiedApi.delete(`${this.endpoint}/${id}`)

      if (response.success) {
        this.notification.success(`${this.resourceName}删除成功`)
      } else {
        throw new Error(response.message || '删除失败')
      }
    } catch (error) {
      if (error !== 'cancel') {
        this.errorHandler.handleApiError(error, `${this.resourceName}删除失败`)
        throw error
      }
    }
  }

  // 批量操作
  async batchCreate(dataList: CreateData[]): Promise<T[]> {
    const closeLoading = this.notification.loading(`正在批量创建${this.resourceName}...`)

    try {
      const response = await unifiedApi.post(`${this.endpoint}/batch`, { items: dataList })

      if (response.success) {
        this.notification.success(`批量创建${this.resourceName}成功`)
        return response.data
      }
      throw new Error(response.message || '批量创建失败')
    } catch (error) {
      this.errorHandler.handleApiError(error, `批量创建${this.resourceName}失败`)
      throw error
    } finally {
      closeLoading()
    }
  }

  async batchUpdate(updates: Array<{ id: number | string; data: UpdateData }>): Promise<T[]> {
    const closeLoading = this.notification.loading(`正在批量更新${this.resourceName}...`)

    try {
      const response = await unifiedApi.put(`${this.endpoint}/batch`, { updates })

      if (response.success) {
        this.notification.success(`批量更新${this.resourceName}成功`)
        return response.data
      }
      throw new Error(response.message || '批量更新失败')
    } catch (error) {
      this.errorHandler.handleApiError(error, `批量更新${this.resourceName}失败`)
      throw error
    } finally {
      closeLoading()
    }
  }

  async batchDelete(ids: (number | string)[]): Promise<void> {
    try {
      const confirmed = await this.notification.confirm(
        `确定要删除选中的 ${ids.length} 个${this.resourceName}吗？`,
        '批量删除确认',
        { type: 'warning' }
      )

      if (!confirmed) {
        return
      }

      const response = await unifiedApi.delete(`${this.endpoint}/batch`, { data: { ids } })

      if (response.success) {
        this.notification.success(`批量删除${this.resourceName}成功`)
      } else {
        throw new Error(response.message || '批量删除失败')
      }
    } catch (error) {
      if (error !== 'cancel') {
        this.errorHandler.handleApiError(error, `批量删除${this.resourceName}失败`)
        throw error
      }
    }
  }

  // 状态更新
  async updateStatus(id: number | string, status: string): Promise<T> {
    try {
      const response = await unifiedApi.patch(`${this.endpoint}/${id}/status`, { status })

      if (response.success) {
        this.notification.success(`${this.resourceName}状态更新成功`)
        return response.data
      }
      throw new Error(response.message || '状态更新失败')
    } catch (error) {
      this.errorHandler.handleApiError(error, `${this.resourceName}状态更新失败`)
      throw error
    }
  }
}
```

### 2. CRUD Hook

```typescript
// composables/useCrud.ts
import { ref, computed } from 'vue'
import { useNotification } from '@/composables/useNotification'
import { useErrorHandler } from '@/composables/useErrorHandler'
import type { CrudEntity, CrudFilters } from '@/services/base/CrudService'
import type { QueryParams } from '@/types/api'

export interface UseCrudOptions {
  service: any
  defaultFilters?: CrudFilters
  pageSize?: number
  autoLoad?: boolean
}

export interface UseCrudReturn<T extends CrudEntity> {
  // 状态
  loading: boolean
  data: T[]
  total: number
  current: number
  pageSize: number
  selectedData: T[]
  filters: CrudFilters

  // 计算属性
  hasData: boolean
  isEmpty: boolean
  hasSelection: boolean
  selectedCount: number

  // 方法
  loadData: (params?: QueryParams) => Promise<void>
  refresh: () => Promise<void>
  create: (data: any) => Promise<T | null>
  update: (id: number | string, data: any) => Promise<T | null>
  delete: (id: number | string) => Promise<void>
  batchDelete: (ids: (number | string)[]) => Promise<void>
  selectData: (data: T[]) => void
  selectAll: () => void
  clearSelection: () => void
  setFilters: (filters: CrudFilters) => void
  resetFilters: () => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

export function useCrud<T extends CrudEntity>(
  options: UseCrudOptions
): UseCrudReturn<T> {
  const { service, defaultFilters = {}, pageSize = 20, autoLoad = true } = options

  const notification = useNotification()
  const errorHandler = useErrorHandler()

  // 状态
  const loading = ref(false)
  const data = ref<T[]>([])
  const total = ref(0)
  const current = ref(1)
  const pageSizeRef = ref(pageSize)
  const selectedData = ref<T[]>([])
  const filters = ref<CrudFilters>({ ...defaultFilters })

  // 计算属性
  const hasData = computed(() => total.value > 0)
  const isEmpty = computed(() => total.value === 0)
  const hasSelection = computed(() => selectedData.value.length > 0)
  const selectedCount = computed(() => selectedData.value.length)

  // 加载数据
  const loadData = async (params?: QueryParams) => {
    loading.value = true

    try {
      const response = await service.getAll({
        page: current.value,
        pageSize: pageSizeRef.value,
        filters: filters.value,
        ...params
      })

      if (response.success) {
        data.value = response.data
        total.value = response.pagination?.total || 0
        current.value = response.pagination?.page || 1
      }
    } catch (error) {
      errorHandler.handleApiError(error, '加载数据失败')
    } finally {
      loading.value = false
    }
  }

  // 刷新数据
  const refresh = async () => {
    await loadData()
  }

  // 创建数据
  const create = async (createData: any): Promise<T | null> => {
    try {
      const result = await service.create(createData)
      await refresh()
      return result
    } catch (error) {
      return null
    }
  }

  // 更新数据
  const update = async (id: number | string, updateData: any): Promise<T | null> => {
    try {
      const result = await service.update(id, updateData)
      await refresh()
      return result
    } catch (error) {
      return null
    }
  }

  // 删除数据
  const remove = async (id: number | string): Promise<void> => {
    try {
      await service.delete(id)
      await refresh()
    } catch (error) {
      // 错误已在服务中处理
    }
  }

  // 批量删除
  const batchDelete = async (ids: (number | string)[]): Promise<void> => {
    try {
      await service.batchDelete(ids)
      await refresh()
      clearSelection()
    } catch (error) {
      // 错误已在服务中处理
    }
  }

  // 选择管理
  const selectData = (selection: T[]) => {
    selectedData.value = selection
  }

  const selectAll = () => {
    selectedData.value = [...data.value]
  }

  const clearSelection = () => {
    selectedData.value = []
  }

  // 过滤器管理
  const setFilters = (newFilters: CrudFilters) => {
    filters.value = { ...newFilters }
    current.value = 1
    loadData()
  }

  const resetFilters = () => {
    filters.value = { ...defaultFilters }
    current.value = 1
    loadData()
  }

  // 分页管理
  const setPage = (page: number) => {
    current.value = page
    loadData()
  }

  const setPageSize = (size: number) => {
    pageSizeRef.value = size
    current.value = 1
    loadData()
  }

  // 初始加载
  if (autoLoad) {
    loadData()
  }

  return {
    // 状态
    loading: loading.value,
    data,
    total,
    current,
    pageSize: pageSizeRef.value,
    selectedData,
    filters,

    // 计算属性
    hasData,
    isEmpty,
    hasSelection,
    selectedCount,

    // 方法
    loadData,
    refresh,
    create,
    update,
    delete: remove,
    batchDelete,
    selectData,
    selectAll,
    clearSelection,
    setFilters,
    resetFilters,
    setPage,
    setPageSize
  }
}
```

## 📝 表单处理规范

### 1. 表单验证

```typescript
// utils/validation.ts
export interface ValidationRule {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  message?: string
  validator?: (value: any) => boolean | string
}

export interface ValidationRules {
  [key: string]: ValidationRule[]
}

// 通用验证规则
export const commonRules = {
  required: (message: string): ValidationRule => ({
    required: true,
    message,
    trigger: 'blur'
  }),

  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: '请输入正确的邮箱地址',
    trigger: 'blur'
  },

  phone: {
    pattern: /^1[3-9]\d{9}$/,
    message: '请输入正确的手机号码',
    trigger: 'blur'
  },

  password: {
    min: 6,
    message: '密码至少6个字符',
    trigger: 'blur'
  },

  confirmPassword: (passwordField: string) => ({
    validator: (value: any, form: any) => {
      if (value !== form[passwordField]) {
        return '两次输入的密码不一致'
      }
      return true
    },
    trigger: 'blur'
  }),

  url: {
    pattern: /^https?:\/\/.+/,
    message: '请输入正确的URL地址',
    trigger: 'blur'
  },

  number: {
    pattern: /^\d+$/,
    message: '请输入数字',
    trigger: 'blur'
  },

  positiveNumber: {
    validator: (value: any) => {
      const num = Number(value)
      if (isNaN(num) || num <= 0) {
        return '请输入正数'
      }
      return true
    },
    trigger: 'blur'
  }
}

// 生成验证规则
export function generateRules(fields: Record<string, ValidationRule[]>): ValidationRules {
  return Object.entries(fields).reduce((rules, [key, fieldRules]) => {
    rules[key] = fieldRules.map(rule => ({
      ...rule,
      trigger: rule.trigger || 'blur'
    }))
    return rules
  }, {} as ValidationRules)
}
```

### 2. 表单 Hook

```typescript
// composables/useForm.ts
import { ref, reactive, computed } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useNotification } from '@/composables/useNotification'
import type { ValidationRules } from '@/utils/validation'

export interface UseFormOptions<T> {
  initialValues?: Partial<T>
  rules?: ValidationRules
  validateOnChange?: boolean
  resetOnSubmit?: boolean
}

export interface UseFormReturn<T> {
  formRef: any
  formData: T
  formRules: ComputedRef<FormRules>
  loading: boolean
  isValid: boolean
  errors: Record<string, string>

  // 方法
  validate: () => Promise<boolean>
  validateField: (field: keyof T) => Promise<boolean>
  resetFields: () => void
  resetValidation: () => void
  setFieldValue: (field: keyof T, value: any) => void
  setFieldsValue: (values: Partial<T>) => void
  getFieldValue: (field: keyof T) => any
  submit: (callback: (data: T) => Promise<any>) => Promise<any>
}

export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T> = {}
): UseFormReturn<T> {
  const {
    initialValues = {},
    rules = {},
    validateOnChange = false,
    resetOnSubmit = false
  } = options

  const notification = useNotification()

  // 响应式数据
  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const isValid = ref(false)
  const errors = reactive<Record<string, string>>({})

  // 表单数据
  const formData = reactive<T>({ ...initialValues } as T)

  // 表单规则
  const formRules = computed<FormRules>(() => {
    return Object.entries(rules).reduce((result, [field, fieldRules]) => {
      result[field] = fieldRules.map(rule => ({
        required: rule.required,
        message: rule.message,
        trigger: rule.trigger || 'blur',
        min: rule.min,
        max: rule.max,
        pattern: rule.pattern,
        validator: rule.validator ? (rule: any, value: any, callback: any) => {
          const result = rule.validator(value, formData)
          if (result === true) {
            callback()
          } else {
            callback(result)
          }
        } : undefined
      }))
      return result
    }, {} as FormRules)
  })

  // 验证整个表单
  const validate = async (): Promise<boolean> => {
    if (!formRef.value) return false

    try {
      const valid = await formRef.value.validate()
      isValid.value = valid
      return valid
    } catch (error) {
      isValid.value = false
      return false
    }
  }

  // 验证单个字段
  const validateField = async (field: keyof T): Promise<boolean> => {
    if (!formRef.value) return false

    try {
      await formRef.value.validateField(field as string)
      delete errors[field as string]
      return true
    } catch (error) {
      errors[field as string] = error as string
      return false
    }
  }

  // 重置表单字段
  const resetFields = () => {
    if (formRef.value) {
      formRef.value.resetFields()
    }
    Object.assign(formData, initialValues)
    Object.keys(errors).forEach(key => delete errors[key])
    isValid.value = false
  }

  // 清除验证状态
  const resetValidation = () => {
    if (formRef.value) {
      formRef.value.clearValidate()
    }
    Object.keys(errors).forEach(key => delete errors[key])
    isValid.value = false
  }

  // 设置字段值
  const setFieldValue = (field: keyof T, value: any) => {
    formData[field] = value
    if (validateOnChange) {
      validateField(field)
    }
  }

  // 设置多个字段值
  const setFieldsValue = (values: Partial<T>) => {
    Object.assign(formData, values)
    if (validateOnChange) {
      Object.keys(values).forEach(field => {
        validateField(field as keyof T)
      })
    }
  }

  // 获取字段值
  const getFieldValue = (field: keyof T) => {
    return formData[field]
  }

  // 提交表单
  const submit = async (callback: (data: T) => Promise<any>) => {
    const valid = await validate()
    if (!valid) {
      notification.warning('请检查表单填写是否正确')
      return null
    }

    loading.value = true

    try {
      const result = await callback({ ...formData })

      if (resetOnSubmit) {
        resetFields()
      }

      return result
    } catch (error) {
      console.error('表单提交失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    formRef,
    formData,
    formRules,
    loading: loading.value,
    isValid: isValid.value,
    errors,
    validate,
    validateField,
    resetFields,
    resetValidation,
    setFieldValue,
    setFieldsValue,
    getFieldValue,
    submit
  }
}
```

## 📋 CRUD 组件示例

### 1. 列表页面组件

```vue
<!-- components/CrudList.vue -->
<template>
  <div class="crud-list">
    <!-- 搜索栏 -->
    <div class="crud-list__search">
      <el-form :model="searchForm" inline>
        <el-form-item v-for="field in searchableFields" :key="field.key" :label="field.label">
          <el-input
            v-if="field.type === 'input'"
            v-model="searchForm[field.key]"
            :placeholder="`搜索${field.label}`"
            clearable
            @keyup.enter="handleSearch"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="searchForm[field.key]"
            :placeholder="`选择${field.label}`"
            clearable
          >
            <el-option
              v-for="option in field.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-date-picker
            v-else-if="field.type === 'daterange'"
            v-model="searchForm[field.key]"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-space>
            <el-button type="primary" @click="handleSearch">搜索</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-space>
        </el-form-item>
      </el-form>
    </div>

    <!-- 工具栏 -->
    <div class="crud-list__toolbar">
      <div class="crud-list__toolbar-left">
        <el-space>
          <el-button
            v-if="permissions.create"
            type="primary"
            :icon="Plus"
            @click="handleCreate"
          >
            新建
          </el-button>
          <el-button
            v-if="permissions.batchDelete"
            :disabled="!hasSelection"
            :icon="Delete"
            @click="handleBatchDelete"
          >
            批量删除 ({{ selectedCount }})
          </el-button>
          <slot name="toolbar-left" />
        </el-space>
      </div>
      <div class="crud-list__toolbar-right">
        <el-space>
          <el-button :icon="Refresh" @click="refresh">刷新</el-button>
          <el-dropdown @command="handleExport">
            <el-button :icon="Download">
              导出
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
                <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <slot name="toolbar-right" />
        </el-space>
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      v-loading="loading"
      :data="data"
      @selection-change="handleSelectionChange"
    >
      <!-- 选择列 -->
      <el-table-column
        v-if="permissions.batchDelete"
        type="selection"
        width="55"
      />

      <!-- 数据列 -->
      <el-table-column
        v-for="column in columns"
        :key="column.key"
        :prop="column.key"
        :label="column.title"
        :width="column.width"
        :sortable="column.sortable"
        :align="column.align"
      >
        <template #default="{ row, column: col, $index }">
          <slot
            :name="`column-${col.property}`"
            :row="row"
            :column="col"
            :index="$index"
          >
            {{ getColumnValue(row, col.property) }}
          </slot>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column
        v-if="hasActions"
        label="操作"
        :width="actionColumnWidth"
        fixed="right"
      >
        <template #default="{ row, $index }">
          <el-space>
            <el-button
              v-if="permissions.read"
              size="small"
              @click="handleView(row)"
            >
              查看
            </el-button>
            <el-button
              v-if="permissions.update"
              size="small"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="permissions.delete"
              size="small"
              type="danger"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
            <slot name="actions" :row="row" :index="$index" />
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-if="total > 0"
      v-model:current-page="current"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus,
  Delete,
  Refresh,
  Download,
  ArrowDown
} from '@element-plus/icons-vue'
import { useCrud } from '@/composables/useCrud'
import type { CrudEntity } from '@/services/base/CrudService'

interface Props {
  service: any
  columns: Array<{
    key: string
    title: string
    width?: number | string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    formatter?: (value: any, row: any) => string
  }>
  searchableFields?: Array<{
    key: string
    label: string
    type: 'input' | 'select' | 'daterange'
    options?: Array<{ label: string; value: any }>
  }>
  permissions?: {
    create?: boolean
    read?: boolean
    update?: boolean
    delete?: boolean
    batchDelete?: boolean
  }
  actionColumnWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  searchableFields: () => [],
  permissions: () => ({
    create: true,
    read: true,
    update: true,
    delete: true,
    batchDelete: true
  }),
  actionColumnWidth: 200
})

interface Emits {
  create: []
  view: [row: CrudEntity]
  edit: [row: CrudEntity]
  delete: [row: CrudEntity]
}

const emit = defineEmits<Emits>()

const router = useRouter()

// 使用 CRUD hook
const {
  loading,
  data,
  total,
  current,
  pageSize,
  selectedData,
  hasSelection,
  selectedCount,
  loadData,
  refresh,
  create,
  update,
  delete: remove,
  batchDelete,
  selectData,
  setPage,
  setPageSize
} = useCrud({ service: props.service })

// 搜索表单
const searchForm = ref<Record<string, any>>({})
const hasActions = computed(() => {
  return props.permissions.read || props.permissions.update || props.permissions.delete
})

// 方法
const getColumnValue = (row: any, prop: string) => {
  const column = props.columns.find(col => col.key === prop)
  if (column?.formatter) {
    return column.formatter(row[prop], row)
  }
  return row[prop]
}

const handleSearch = () => {
  const filters = Object.fromEntries(
    Object.entries(searchForm.value).filter(([_, value]) => {
      return value !== null && value !== undefined && value !== ''
    })
  )
  loadData({ filters })
}

const handleReset = () => {
  searchForm.value = {}
  loadData()
}

const handleCreate = () => {
  emit('create')
}

const handleView = (row: CrudEntity) => {
  emit('view', row)
}

const handleEdit = (row: CrudEntity) => {
  emit('edit', row)
}

const handleDelete = async (row: CrudEntity) => {
  try {
    await remove(row.id)
  } catch (error) {
    // 错误已在服务中处理
  }
}

const handleBatchDelete = async () => {
  const ids = selectedData.value.map(item => item.id)
  try {
    await batchDelete(ids)
  } catch (error) {
    // 错误已在服务中处理
  }
}

const handleSelectionChange = (selection: CrudEntity[]) => {
  selectData(selection)
}

const handleSizeChange = (size: number) => {
  setPageSize(size)
}

const handleCurrentChange = (page: number) => {
  setPage(page)
}

const handleExport = async (format: string) => {
  try {
    // 实现导出逻辑
    console.log('Export format:', format)
  } catch (error) {
    console.error('Export failed:', error)
  }
}

// 初始化搜索字段
props.searchableFields.forEach(field => {
  searchForm.value[field.key] = null
})

// 生命周期
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.crud-list {
  &__search {
    margin-bottom: 16px;
    padding: 16px;
    background: var(--el-bg-color-page);
    border-radius: 4px;
  }

  &__toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .el-pagination {
    margin-top: 16px;
    justify-content: center;
  }
}
</style>
```

### 2. 表单页面组件

```vue
<!-- components/CrudForm.vue -->
<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="formRules"
    :label-width="labelWidth"
    :disabled="loading"
  >
    <el-row :gutter="24">
      <el-col
        v-for="field in formFields"
        :key="field.key"
        :span="field.span || 24"
      >
        <el-form-item :label="field.label" :prop="field.key">
          <!-- 输入框 -->
          <el-input
            v-if="field.type === 'input'"
            v-model="formData[field.key]"
            :placeholder="field.placeholder || `请输入${field.label}`"
            :disabled="field.disabled"
            :readonly="field.readonly"
            :maxlength="field.maxlength"
            :show-word-limit="field.showWordLimit"
            :type="field.inputType"
          />

          <!-- 文本域 -->
          <el-input
            v-else-if="field.type === 'textarea'"
            v-model="formData[field.key]"
            type="textarea"
            :rows="field.rows || 4"
            :placeholder="field.placeholder || `请输入${field.label}`"
            :disabled="field.disabled"
            :readonly="field.readonly"
            :maxlength="field.maxlength"
            :show-word-limit="field.showWordLimit"
          />

          <!-- 数字输入框 -->
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="formData[field.key]"
            :min="field.min"
            :max="field.max"
            :step="field.step || 1"
            :precision="field.precision"
            :disabled="field.disabled"
            style="width: 100%"
          />

          <!-- 选择器 -->
          <el-select
            v-else-if="field.type === 'select'"
            v-model="formData[field.key]"
            :placeholder="field.placeholder || `请选择${field.label}`"
            :disabled="field.disabled"
            :multiple="field.multiple"
            :filterable="field.filterable"
            :clearable="field.clearable !== false"
            style="width: 100%"
          >
            <el-option
              v-for="option in field.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
              :disabled="option.disabled"
            />
          </el-select>

          <!-- 单选框组 -->
          <el-radio-group
            v-else-if="field.type === 'radio'"
            v-model="formData[field.key]"
            :disabled="field.disabled"
          >
            <el-radio
              v-for="option in field.options"
              :key="option.value"
              :label="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </el-radio>
          </el-radio-group>

          <!-- 复选框组 -->
          <el-checkbox-group
            v-else-if="field.type === 'checkbox'"
            v-model="formData[field.key]"
            :disabled="field.disabled"
          >
            <el-checkbox
              v-for="option in field.options"
              :key="option.value"
              :label="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </el-checkbox>
          </el-checkbox-group>

          <!-- 日期选择器 -->
          <el-date-picker
            v-else-if="field.type === 'date'"
            v-model="formData[field.key]"
            type="date"
            :placeholder="field.placeholder || `选择${field.label}`"
            :disabled="field.disabled"
            :clearable="field.clearable !== false"
            style="width: 100%"
          />

          <!-- 日期时间选择器 -->
          <el-date-picker
            v-else-if="field.type === 'datetime'"
            v-model="formData[field.key]"
            type="datetime"
            :placeholder="field.placeholder || `选择${field.label}`"
            :disabled="field.disabled"
            :clearable="field.clearable !== false"
            style="width: 100%"
          />

          <!-- 文件上传 -->
          <el-upload
            v-else-if="field.type === 'upload'"
            :action="field.uploadUrl"
            :headers="field.uploadHeaders"
            :data="field.uploadData"
            :disabled="field.disabled"
            :limit="field.limit"
            :file-list="formData[field.key]"
            :on-success="(response, file) => handleUploadSuccess(field.key, response, file)"
            :on-remove="(file) => handleUploadRemove(field.key, file)"
            :before-upload="(file) => handleBeforeUpload(field, file)"
          >
            <el-button type="primary">点击上传</el-button>
            <template #tip>
              <div class="el-upload__tip">
                {{ field.tip }}
              </div>
            </template>
          </el-upload>

          <!-- 自定义字段 -->
          <slot
            v-else-if="field.type === 'custom'"
            :name="`field-${field.key}`"
            :field="field"
            :value="formData[field.key]"
            :onChange="(value) => handleFieldValueChange(field.key, value)"
          />

          <!-- 默认输入框 -->
          <el-input
            v-else
            v-model="formData[field.key]"
            :placeholder="field.placeholder || `请输入${field.label}`"
            :disabled="field.disabled"
          />
        </el-form-item>
      </el-col>
    </el-row>

    <!-- 表单操作 -->
    <div class="crud-form__actions">
      <el-space>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ submitText }}
        </el-button>
        <el-button @click="handleCancel">
          取消
        </el-button>
        <el-button v-if="showReset" @click="handleReset">
          重置
        </el-button>
        <slot name="actions" />
      </el-space>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useForm } from '@/composables/useForm'
import { useNotification } from '@/composables/useNotification'

interface FormField {
  key: string
  label: string
  type: 'input' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'date' | 'datetime' | 'upload' | 'custom'
  span?: number
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  options?: Array<{ label: string; value: any; disabled?: boolean }>
  min?: number
  max?: number
  step?: number
  precision?: number
  maxlength?: number
  showWordLimit?: boolean
  inputType?: 'text' | 'password' | 'email' | 'url'
  multiple?: boolean
  filterable?: boolean
  clearable?: boolean
  rows?: number
  uploadUrl?: string
  uploadHeaders?: Record<string, any>
  uploadData?: Record<string, any>
  limit?: number
  tip?: string
  rules?: any[]
}

interface Props {
  modelValue: Record<string, any>
  fields: FormField[]
  rules?: Record<string, any[]>
  labelWidth?: string | number
  submitText?: string
  submitting?: boolean
  showReset?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  labelWidth: '120px',
  submitText: '提交',
  submitting: false,
  showReset: true
})

interface Emits {
  'update:modelValue': [value: Record<string, any>]
  submit: [data: Record<string, any>]
  cancel: []
  reset: []
  fieldChange: [field: string, value: any]
}

const emit = defineEmits<Emits>()

const notification = useNotification()

// 使用表单 hook
const {
  formRef,
  formData,
  formRules,
  loading,
  validate,
  resetFields
} = useForm({
  initialValues: props.modelValue,
  rules: props.rules
})

// 监听 modelValue 变化
watch(() => props.modelValue, (newValue) => {
  Object.assign(formData, newValue)
}, { deep: true })

// 监听 formData 变化
watch(formData, (newValue) => {
  emit('update:modelValue', { ...newValue })
}, { deep: true })

// 生成表单规则
const generateFieldRules = () => {
  const rules: Record<string, any[]> = {}

  props.fields.forEach(field => {
    if (field.rules) {
      rules[field.key] = field.rules
    } else if (field.required) {
      rules[field.key] = [
        { required: true, message: `请输入${field.label}`, trigger: 'blur' }
      ]
    }
  })

  return rules
}

formRules.value = generateFieldRules()

// 方法
const handleFieldValueChange = (field: string, value: any) => {
  formData[field] = value
  emit('fieldChange', field, value)
}

const handleUploadSuccess = (field: string, response: any, file: any) => {
  if (response.success) {
    formData[field] = response.data
    notification.success('上传成功')
  } else {
    notification.error(response.message || '上传失败')
  }
}

const handleUploadRemove = (field: string, file: any) => {
  const index = formData[field].findIndex((item: any) => item.uid === file.uid)
  if (index > -1) {
    formData[field].splice(index, 1)
  }
}

const handleBeforeUpload = (field: FormField, file: File) => {
  const isValidType = field.accept ? field.accept.includes(file.type) : true
  const isValidSize = field.maxSize ? file.size / 1024 / 1024 < field.maxSize : true

  if (!isValidType) {
    notification.error('文件格式不正确')
    return false
  }

  if (!isValidSize) {
    notification.error(`文件大小不能超过 ${field.maxSize}MB`)
    return false
  }

  return true
}

const handleSubmit = async () => {
  const valid = await validate()
  if (!valid) {
    notification.warning('请检查表单填写是否正确')
    return
  }

  emit('submit', { ...formData })
}

const handleCancel = () => {
  emit('cancel')
}

const handleReset = () => {
  resetFields()
  emit('reset')
}
</script>

<style lang="scss" scoped>
.crud-form {
  &__actions {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--el-border-color-light);
    text-align: center;
  }
}
</style>
```

## 📋 最佳实践

### 1. 数据验证策略

- **前端验证**：实时验证，提供即时反馈
- **后端验证**：服务端验证，确保数据安全性
- **统一错误提示**：友好的错误信息展示
- **字段级验证**：支持字段级别验证规则

### 2. 批量操作优化

- **分批处理**：大量数据分批处理，避免超时
- **进度反馈**：提供操作进度和结果统计
- **错误处理**：部分失败时的回滚和补偿机制
- **性能监控**：监控批量操作的性能指标

### 3. 权限控制

- **操作权限**：根据用户角色控制操作按钮
- **数据权限**：限制用户可访问的数据范围
- **字段权限**：控制表单字段的读写权限
- **API权限**：后端接口权限验证

### 4. 缓存策略

- **列表缓存**：缓存列表数据，减少重复请求
- **详情缓存**：缓存常用数据的详情
- **表单缓存**：保存用户未提交的表单数据
- **失效策略**：合理的缓存失效和更新机制

## 🔍 故障排除

### 常见问题

1. **表单验证不生效**
   - 检查 rules 配置是否正确
   - 确认 field.prop 与 data 字段对应
   - 验证 trigger 设置是否合适

2. **数据更新后视图不刷新**
   - 检查响应式数据绑定
   - 确认数据更新方式
   - 验证计算属性依赖

3. **批量操作失败**
   - 检查请求参数格式
   - 确认服务端接口限制
   - 验证网络连接状态

### 调试技巧

```typescript
// 开发环境 CRUD 调试
if (import.meta.env.DEV) {
  window.__TF2025_CRUD_DEBUG__ = {
    showApiCalls: true,
    showFormValidation: true,
    showDataChanges: true,
    logErrors: true
  }
}
```

## 📚 参考资料

- [Element Plus 表单组件](https://element-plus.org/zh-CN/component/form.html)
- [Vue 3 表单处理](https://vuejs.org/guide/essentials/forms.html)
- [数据验证最佳实践](https://www.npmjs.com/package/async-validator)

---

**更新日期**：2025-01-15
**版本**：v1.0.0
**维护者**：TF2025 开发团队