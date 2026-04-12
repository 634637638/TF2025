/**
 * 通用组件 Props 类型定义
 * 集中管理多个组件共享的 Props 类型
 */

import type { Component } from 'vue'

// ==================== 通用 Props ====================

/**
 * 基础加载状态 Props
 */
export interface LoadingProps {
  loading?: boolean
}

/**
 * 基础日期范围 Props
 */
export interface DateRangeProps {
  startDate?: string
  endDate?: string
}

/**
 * 基础筛选 Props
 */
export interface FilterProps {
  storeId?: string | number
  supplierId?: string | number
  searchTrigger?: number
}

/**
 * 基础日期筛选 Props（分析页面通用）
 */
export interface AnalyticsProps extends LoadingProps, DateRangeProps, FilterProps {
  isActive?: boolean
}

/**
 * 基础可见性 Props
 */
export interface VisibleProps {
  visible: boolean
}

/**
 * 模态框基础 Props
 */
export interface ModalProps extends VisibleProps {}

/**
 * 基础 modelValue 弹窗 Props
 */
export interface ModelValueProps {
  modelValue: boolean
}

/**
 * 字符串 modelValue Props
 */
export interface StringModelValueProps {
  modelValue: string
}

/**
 * 可选字符串 modelValue Props
 */
export interface OptionalStringModelValueProps {
  modelValue?: string
}

/**
 * 模态框更新 Props
 */
export interface ModalUpdateProps {
  'update:visible': (value: boolean) => void
}

/**
 * update:modelValue 事件
 */
export interface UpdateModelValueEmits {
  'update:modelValue': [value: boolean]
}

/**
 * update:modelValue 字符串事件
 */
export interface UpdateStringModelValueEmits {
  'update:modelValue': [value: string]
}

/**
 * update:visible 事件
 */
export interface UpdateVisibleEmits {
  'update:visible': [value: boolean]
}

/**
 * 通用取消事件
 */
export interface CancelEmits {
  cancel: []
}

/**
 * 通用关闭事件
 */
export interface CloseEmits {
  close: []
}

/**
 * 通用确认事件
 */
export interface ConfirmEmits {
  confirm: []
}

/**
 * 通用成功事件
 */
export interface SuccessEmits {
  success: []
}

/**
 * 通用加载状态变化事件
 */
export interface LoadingChangeEmits {
  'loading-change': [loading: boolean]
}

/**
 * 通用重置事件
 */
export interface ResetEmits {
  reset: []
}

/**
 * 通用清空事件
 */
export interface ClearEmits {
  clear: []
}

/**
 * 搜索筛选值更新事件
 */
export interface UpdateFilterValuesEmits {
  'update:filterValues': [value: Record<string, any>]
}

/**
 * 搜索提交事件
 */
export interface SearchSubmitEmits {
  search: [query: string, filters: Record<string, any>]
}

/**
 * 筛选变化事件
 */
export interface FilterChangeEmits {
  'filter-change': [key: string, value: any]
}

/**
 * 模态框成功回调 Props
 */
export interface ModalSuccessProps<T = unknown> {
  onSuccess?: (data?: T) => void
  onCancel?: () => void
}

/**
 * 列表模式 Props
 */
export interface ListModeProps {
  mode?: 'table' | 'card' | 'list'
}

/**
 * 分页 Props
 */
export interface PaginationProps {
  page?: number
  pageSize?: number
  total?: number
}

/**
 * 搜索 Props
 */
export interface SearchProps {
  search?: string
  placeholder?: string
}

// ==================== 分析页面 Props ====================

/**
 * 分析组件 Props（销售、库存、员工、客户、利润等分析页面通用）
 */
export interface AnalyticsComponentProps {
  loading?: boolean
  isActive?: boolean
  startDate?: string
  endDate?: string
  storeId?: string | number
  supplierId?: string | number
  searchTrigger?: number
}

/**
 * 销售分析 Props
 */
export type SalesAnalyticsProps = AnalyticsComponentProps

/**
 * 库存分析 Props
 */
export type InventoryAnalyticsProps = AnalyticsComponentProps

/**
 * 员工分析 Props
 */
export type EmployeeAnalyticsProps = AnalyticsComponentProps

/**
 * 客户分析 Props
 */
export type CustomerAnalyticsProps = AnalyticsComponentProps

/**
 * 利润分析 Props
 */
export type ProfitAnalyticsProps = AnalyticsComponentProps

/**
 * 性能分析 Props
 */
export interface PerformanceAnalyticsProps {
  loading?: boolean
  isActive?: boolean
  dateRange?: [Date, Date]
  storeId?: number
}

/**
 * 流转分析 Props
 */
export type TransferAnalyticsProps = AnalyticsComponentProps

// ==================== 模态框 Props ====================

/**
 * 表单模态框 Props
 */
export interface FormModalProps {
  visible: boolean
  mode: 'create' | 'edit' | 'view'
  data?: Record<string, unknown> | null
}

/**
 * 确认模态框 Props
 */
export interface ConfirmModalProps {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmType?: 'primary' | 'success' | 'warning' | 'danger'
}

/**
 * 页面头部操作按钮
 */
export interface HeaderAction {
  label: string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  icon?: Component
  loading?: boolean | (() => boolean)
  disabled?: boolean | (() => boolean)
  handler: () => void
}

// ==================== 列表 Props ====================

/**
 * 表格列定义
 */
export interface TableColumn {
  key?: string
  prop: string
  label: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right' | boolean
  sortable?: boolean | 'custom'
  showOverflowTooltip?: boolean
  formatter?: (row: Record<string, unknown>, column: TableColumn, cellValue: unknown) => string
}

/**
 * 表格操作定义
 */
export interface TableAction<T = Record<string, unknown>> {
  key: string
  label: string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default'
  size?: 'large' | 'default' | 'small'
  icon?: Component
  disabled?: (row: T) => boolean
  mobileOnly?: boolean
}

/**
 * 表格数据 Props
 */
export interface TableDataProps<T = Record<string, unknown>> {
  data: T[]
  loading?: boolean
  columns?: TableColumn[]
  stripe?: boolean
  border?: boolean
  highlightCurrentRow?: boolean
}

/**
 * 表格行点击 Props
 */
export interface RowClickProps<T = Record<string, unknown>> {
  onRowClick?: (row: T, index: number) => void
}

// ==================== 筛选 Props ====================

/**
 * 高级筛选 Props
 */
export interface AdvancedFilterProps {
  filters: Record<string, unknown>
  onFilterChange: (filters: Record<string, unknown>) => void
  onReset: () => void
}

/**
 * 日期范围选择 Props
 */
export interface DateRangePickerProps {
  modelValue?: [string, string] | [Date, Date]
  startPlaceholder?: string
  endPlaceholder?: string
  format?: string
  valueFormat?: string
}
