# TF2025 分页组件规范

## 📋 概述

TF2025 项目采用统一的分页组件和数据管理模式，确保所有列表页面的一致性、性能优化和用户体验。本规范定义了分页组件的使用标准、数据流管理、性能优化策略和最佳实践。

## 🎯 设计原则

1. **一致性**：所有列表页面使用相同的分页组件和交互模式
2. **性能优化**：支持虚拟滚动、懒加载等优化策略
3. **用户体验**：清晰的分页信息、流畅的交互反馈
4. **灵活性**：支持不同业务场景的分页需求
5. **可访问性**：支持键盘导航和屏幕阅读器

## 🏗️ 分页架构

### 组件结构

```
分页组件架构
├── 核心分页组件 (Pagination)
│   ├── 基础分页器
│   ├── 页面大小选择
│   ├── 快速跳转
│   └── 总数显示
├── 列表组件增强 (Table with Pagination)
│   ├── 数据加载
│   ├── 排序支持
│   ├── 筛选集成
│   └── 虚拟滚动
├── 数据管理 (Data Management)
│   ├── 分页状态
│   ├── 数据缓存
│   ├── 预加载
│   └── 错误处理
└── 分页策略 (Pagination Strategies)
    ├── 客户端分页
    ├── 服务器分页
    └── 混合分页
```

## 📚 组件使用规范

### 1. 基础分页组件

```vue
<!-- components/Pagination.vue -->
<template>
  <div class="tf-pagination">
    <!-- 分页信息 -->
    <div class="tf-pagination__info">
      <span v-if="showTotal" class="tf-pagination__total">
        共 {{ total }} 条记录
      </span>
      <span v-if="showRange" class="tf-pagination__range">
        当前第 {{ startIndex }} - {{ endIndex }} 条
      </span>
    </div>

    <!-- 分页器 -->
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :page-sizes="pageSizes"
      :total="total"
      :layout="layout"
      :background="background"
      :small="small"
      :disabled="disabled"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
      @prev-click="handlePrevClick"
      @next-click="handleNextClick"
    />

    <!-- 快速跳转 -->
    <div v-if="showQuickJumper" class="tf-pagination__jumper">
      <span class="tf-pagination__jumper-text">跳至</span>
      <el-input-number
        v-model="jumpPage"
        :min="1"
        :max="totalPages"
        :controls="false"
        size="small"
        @change="handleJump"
      />
      <span class="tf-pagination__jumper-text">页</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PaginationProps } from '@/types/components'

interface Props extends PaginationProps {
  showTotal?: boolean
  showRange?: boolean
  showQuickJumper?: boolean
  layout?: string
  background?: boolean
  small?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTotal: true,
  showRange: false,
  showQuickJumper: true,
  layout: 'sizes, prev, pager, next, jumper',
  background: true,
  small: false,
  disabled: false
})

interface Emits {
  'update:current': [page: number]
  'update:pageSize': [size: number]
  'change': [page: number, pageSize: number]
}

const emit = defineEmits<Emits>()

// 快速跳转页码
const jumpPage = ref<number>(props.current)

// 计算属性
const totalPages = computed(() => Math.ceil(props.total / props.pageSize))

const startIndex = computed(() => {
  if (props.total === 0) return 0
  return (props.current - 1) * props.pageSize + 1
})

const endIndex = computed(() => {
  const end = props.current * props.pageSize
  return end > props.total ? props.total : end
})

// 事件处理
const handleSizeChange = (size: number) => {
  emit('update:pageSize', size)
  emit('change', props.current, size)
}

const handleCurrentChange = (page: number) => {
  emit('update:current', page)
  emit('change', page, props.pageSize)
}

const handlePrevClick = (page: number) => {
  handleCurrentChange(page)
}

const handleNextClick = (page: number) => {
  handleCurrentChange(page)
}

const handleJump = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    handleCurrentChange(page)
  }
}

// 监听当前页变化，同步跳转输入框
watch(() => props.current, (newPage) => {
  jumpPage.value = newPage
})
</script>

<style lang="scss" scoped>
.tf-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  gap: 16px;
  flex-wrap: wrap;

  &__info {
    display: flex;
    align-items: center;
    gap: 16px;
    color: var(--el-text-color-regular);
    font-size: 14px;
  }

  &__total {
    font-weight: 500;
  }

  &__jumper {
    display: flex;
    align-items: center;
    gap: 8px;

    &-text {
      color: var(--el-text-color-regular);
      font-size: 14px;
    }
  }
}
</style>
```

### 2. 列表分页组合

```vue
<!-- components/PaginatedTable.vue -->
<template>
  <div class="tf-paginated-table">
    <!-- 工具栏 -->
    <div v-if="showToolbar" class="tf-paginated-table__toolbar">
      <div class="tf-paginated-table__toolbar-left">
        <slot name="toolbar-left" />
      </div>
      <div class="tf-paginated-table__toolbar-right">
        <slot name="toolbar-right" />
        <el-input
          v-if="searchable"
          v-model="searchKeyword"
          placeholder="搜索..."
          clearable
          @clear="handleSearchClear"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      v-loading="loading"
      :data="tableData"
      :height="tableHeight"
      :max-height="maxHeight"
      :stripe="stripe"
      :border="border"
      :size="size"
      :row-key="rowKey"
      :default-sort="defaultSort"
      @sort-change="handleSortChange"
      @selection-change="handleSelectionChange"
    >
      <!-- 列定义 -->
      <template v-for="column in columns" :key="column.key">
        <el-table-column
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :fixed="column.fixed"
          :sortable="column.sortable"
          :align="column.align"
          :show-overflow-tooltip="column.showOverflowTooltip"
        >
          <template #default="scope">
            <slot
              :name="`column-${column.key}`"
              :row="scope.row"
              :column="column"
              :index="scope.$index"
            >
              {{ getColumnValue(scope.row, column) }}
            </slot>
          </template>
        </el-table-column>
      </template>

      <!-- 空状态 -->
      <template #empty>
        <el-empty
          :description="emptyDescription"
          :image="emptyImage"
        >
          <slot name="empty">
            <el-button type="primary" @click="handleRefresh">
              刷新数据
            </el-button>
          </slot>
        </el-empty>
      </template>
    </el-table>

    <!-- 分页 -->
    <Pagination
      v-if="showPagination"
      v-model:current="currentPage"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="pageSizes"
      :show-total="showTotal"
      :show-range="showRange"
      :show-quick-jumper="showQuickJumper"
      :disabled="loading"
      @change="handlePaginationChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import Pagination from './Pagination.vue'
import type { TableColumn } from '@/types/components'

interface Props {
  // 数据相关
  data: any[]
  columns: TableColumn[]
  loading?: boolean

  // 分页相关
  paginated?: boolean
  currentPage?: number
  pageSize?: number
  total?: number
  pageSizes?: number[]
  showPagination?: boolean
  showTotal?: boolean
  showRange?: boolean
  showQuickJumper?: boolean

  // 表格样式
  height?: string | number
  maxHeight?: string | number
  stripe?: boolean
  border?: boolean
  size?: 'large' | 'default' | 'small'
  rowKey?: string | ((row: any) => string)
  defaultSort?: { prop: string; order: string }

  // 功能开关
  searchable?: boolean
  showToolbar?: boolean

  // 空状态
  emptyDescription?: string
  emptyImage?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  paginated: true,
  currentPage: 1,
  pageSize: 20,
  total: 0,
  pageSizes: () => [10, 20, 50, 100],
  showPagination: true,
  showTotal: true,
  showRange: false,
  showQuickJumper: true,
  stripe: true,
  border: false,
  size: 'default',
  searchable: false,
  showToolbar: true,
  emptyDescription: '暂无数据'
})

interface Emits {
  'update:current': [page: number]
  'update:pageSize': [size: number]
  'update:loading': [loading: boolean]
  'refresh': []
  'search': [keyword: string]
  'sort-change': [sort: { prop: string; order: string }]
  'selection-change': [selection: any[]]
}

const emit = defineEmits<Emits>()

// 响应式数据
const currentPage = ref(props.currentPage)
const pageSize = ref(props.pageSize)
const searchKeyword = ref('')
const tableData = computed(() => props.data)

// 方法
const getColumnValue = (row: any, column: TableColumn) => {
  const value = column.prop ? row[column.prop] : row
  return column.formatter ? column.formatter(value, row) : value
}

const handlePaginationChange = (page: number, size: number) => {
  currentPage.value = page
  pageSize.value = size
  emit('update:current', page)
  emit('update:pageSize', size)
  emit('refresh')
}

const handleSearch = () => {
  emit('search', searchKeyword.value)
}

const handleSearchClear = () => {
  searchKeyword.value = ''
  emit('search', '')
}

const handleRefresh = () => {
  emit('refresh')
}

const handleSortChange = (sort: { prop: string; order: string }) => {
  emit('sort-change', sort)
}

const handleSelectionChange = (selection: any[]) => {
  emit('selection-change', selection)
}

// 监听器
watch(() => props.currentPage, (newPage) => {
  currentPage.value = newPage
})

watch(() => props.pageSize, (newSize) => {
  pageSize.value = newSize
})
</script>

<style lang="scss" scoped>
.tf-paginated-table {
  &__toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--el-bg-color-page);
    border-radius: 4px;

    &-left,
    &-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }
}
</style>
```

## 🔄 数据管理模式

### 1. 分页状态管理

```typescript
// composables/usePagination.ts
import { ref, computed, reactive } from 'vue'
import type { PaginationParams } from '@/types/api'

export interface UsePaginationOptions {
  defaultPageSize?: number
  pageSizes?: number[]
  totalKey?: string
  dataKey?: string
}

export interface UsePaginationReturn {
  // 状态
  pagination: PaginationState
  paginatedData: any[]

  // 计算属性
  currentPage: any
  pageSize: any
  total: any
  totalPages: any
  hasData: any
  isEmpty: any

  // 方法
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setTotal: (total: number) => void
  reset: () => void
  nextPage: () => void
  prevPage: () => void
  updateData: (data: any[]) => void
}

interface PaginationState {
  current: number
  pageSize: number
  total: number
  data: any[]
}

export function usePagination(
  options: UsePaginationOptions = {}
): UsePaginationReturn {
  const {
    defaultPageSize = 20,
    pageSizes = [10, 20, 50, 100],
    totalKey = 'total',
    dataKey = 'data'
  } = options

  // 分页状态
  const pagination = reactive<PaginationState>({
    current: 1,
    pageSize: defaultPageSize,
    total: 0,
    data: []
  })

  // 计算属性
  const currentPage = computed({
    get: () => pagination.current,
    set: (page: number) => setPage(page)
  })

  const pageSize = computed({
    get: () => pagination.pageSize,
    set: (size: number) => setPageSize(size)
  })

  const total = computed(() => pagination.total)

  const totalPages = computed(() => Math.ceil(pagination.total / pagination.pageSize))

  const paginatedData = computed(() => pagination.data)

  const hasData = computed(() => pagination.total > 0)

  const isEmpty = computed(() => pagination.total === 0)

  // 方法
  const setPage = (page: number) => {
    if (page < 1 || page > totalPages.value) return
    pagination.current = page
  }

  const setPageSize = (size: number) => {
    pagination.pageSize = size
    pagination.current = 1 // 重置到第一页
  }

  const setTotal = (totalCount: number) => {
    pagination.total = totalCount
    // 如果当前页超出范围，重置到最后一页
    if (pagination.current > totalPages.value && totalPages.value > 0) {
      pagination.current = totalPages.value
    }
  }

  const updateData = (data: any[]) => {
    pagination.data = data
  }

  const reset = () => {
    pagination.current = 1
    pagination.pageSize = defaultPageSize
    pagination.total = 0
    pagination.data = []
  }

  const nextPage = () => {
    if (pagination.current < totalPages.value) {
      pagination.current++
    }
  }

  const prevPage = () => {
    if (pagination.current > 1) {
      pagination.current--
    }
  }

  return {
    pagination,
    paginatedData,
    currentPage,
    pageSize,
    total,
    totalPages,
    hasData,
    isEmpty,
    setPage,
    setPageSize,
    setTotal,
    reset,
    nextPage,
    prevPage,
    updateData
  }
}
```

### 2. 服务器分页集成

```typescript
// composables/useServerPagination.ts
import { ref, computed, watch } from 'vue'
import { usePagination } from './usePagination'
import { unifiedApi } from '@/services/unified-api'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useLoading } from '@/composables/useLoading'

export interface UseServerPaginationOptions {
  endpoint: string
  defaultParams?: Record<string, any>
  immediate?: boolean
  debounceTime?: number
}

export function useServerPagination<T = any>(
  options: UseServerPaginationOptions
) {
  const { endpoint, defaultParams = {}, immediate = true, debounceTime = 300 } = options

  const { handleError } = useErrorHandler()
  const { loading, withLoading } = useLoading()

  // 分页状态
  const pagination = usePagination()

  // 查询参数
  const query = ref<Record<string, any>>({ ...defaultParams })

  // 数据
  const data = ref<T[]>([])

  // 计算请求参数
  const requestParams = computed(() => ({
    page: pagination.currentPage.value,
    pageSize: pagination.pageSize.value,
    ...query.value
  }))

  // 加载数据
  const loadData = async () => {
    try {
      const response = await withLoading(async () => {
        return await unifiedApi.get(endpoint, {
          params: requestParams.value
        })
      })

      if (response.success) {
        data.value = response.data
        pagination.setTotal(response.pagination?.total || response.data.length)
      }
    } catch (error) {
      handleError(error, '加载数据失败')
    }
  }

  // 防抖加载
  let debounceTimer: NodeJS.Timeout | null = null
  const debouncedLoadData = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(loadData, debounceTime)
  }

  // 刷新数据
  const refresh = () => {
    return loadData()
  }

  // 搜索
  const search = (keyword: string) => {
    query.value.keyword = keyword
    pagination.setPage(1)
    debouncedLoadData()
  }

  // 排序
  const sort = (sorter: { prop: string; order: string }) => {
    query.value.sortBy = sorter.prop
    query.value.sortOrder = sorter.order === 'ascending' ? 'asc' : 'desc'
    debouncedLoadData()
  }

  // 筛选
  const filter = (filters: Record<string, any>) => {
    Object.assign(query.value, filters)
    pagination.setPage(1)
    debouncedLoadData()
  }

  // 重置
  const reset = () => {
    query.value = { ...defaultParams }
    pagination.reset()
    loadData()
  }

  // 监听分页变化
  watch([() => pagination.currentPage.value, () => pagination.pageSize.value], () => {
    loadData()
  })

  // 初始加载
  if (immediate) {
    loadData()
  }

  return {
    // 状态
    loading: loading.value,
    data,
    pagination,
    query,

    // 方法
    loadData,
    refresh,
    search,
    sort,
    filter,
    reset
  }
}
```

## ⚡ 性能优化策略

### 1. 虚拟滚动实现

```vue
<!-- components/VirtualTable.vue -->
<template>
  <div class="tf-virtual-table" ref="containerRef">
    <!-- 滚动容器 -->
    <div
      class="tf-virtual-table__viewport"
      :style="{ height: viewportHeight + 'px' }"
      @scroll="handleScroll"
    >
      <!-- 总高度占位 -->
      <div
        class="tf-virtual-table__spacer"
        :style="{ height: totalHeight + 'px' }"
      />

      <!-- 可见区域内容 -->
      <div
        class="tf-virtual-table__content"
        :style="contentStyle"
      >
        <table>
          <!-- 表头 -->
          <thead class="tf-virtual-table__header">
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                :style="{ width: column.width + 'px' }"
              >
                {{ column.title }}
              </th>
            </tr>
          </thead>

          <!-- 表格内容 -->
          <tbody>
            <tr
              v-for="(item, index) in visibleData"
              :key="getRowKey(item, index)"
              class="tf-virtual-table__row"
            >
              <td
                v-for="column in columns"
                :key="column.key"
                :style="{ width: column.width + 'px' }"
              >
                <slot
                  :name="`column-${column.key}`"
                  :row="item"
                  :column="column"
                  :index="startIndex + index"
                >
                  {{ getCellValue(item, column) }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 横向滚动条 -->
    <div
      v-if="showHorizontalScrollbar"
      class="tf-virtual-table__horizontal-scroll"
      ref="horizontalScrollRef"
    >
      <div class="tf-virtual-table__horizontal-scroll-content" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { TableColumn } from '@/types/components'

interface Props {
  data: any[]
  columns: TableColumn[]
  itemHeight?: number
  viewportHeight?: number
  bufferSize?: number
  rowKey?: string | ((row: any) => string)
}

const props = withDefaults(defineProps<Props>(), {
  itemHeight: 50,
  viewportHeight: 400,
  bufferSize: 5,
  rowKey: 'id'
})

const containerRef = ref<HTMLElement>()
const horizontalScrollRef = ref<HTMLElement>()
const scrollTop = ref(0)
const scrollLeft = ref(0)

// 计算属性
const totalHeight = computed(() => props.data.length * props.itemHeight)
const visibleCount = computed(() => Math.ceil(props.viewportHeight / props.itemHeight))
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize))
const endIndex = computed(() => Math.min(
  props.data.length,
  startIndex.value + visibleCount.value + props.bufferSize * 2
))

const visibleData = computed(() => {
  return props.data.slice(startIndex.value, endIndex.value)
})

const contentStyle = computed(() => ({
  position: 'absolute',
  top: `${startIndex.value * props.itemHeight}px`,
  left: '0',
  right: '0'
}))

const showHorizontalScrollbar = computed(() => {
  const totalWidth = props.columns.reduce((sum, column) => sum + (column.width || 100), 0)
  return totalWidth > containerRef.value?.clientWidth
})

// 方法
const getRowKey = (row: any, index: number) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row)
  }
  return row[props.rowKey] || index
}

const getCellValue = (row: any, column: TableColumn) => {
  const value = column.dataIndex ? row[column.dataIndex] : row
  return column.render ? column.render(value, row) : value
}

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
  scrollLeft.value = target.scrollLeft

  // 同步横向滚动
  if (horizontalScrollRef.value) {
    horizontalScrollRef.value.scrollLeft = scrollLeft.value
  }
}

// 滚动到指定行
const scrollToRow = (index: number) => {
  if (containerRef.value) {
    const top = index * props.itemHeight
    containerRef.value.scrollTop = top
  }
}

// 滚动到顶部
const scrollToTop = () => {
  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }
}

// 暴露方法
defineExpose({
  scrollToRow,
  scrollToTop
})
</script>

<style lang="scss" scoped>
.tf-virtual-table {
  position: relative;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  overflow: hidden;

  &__viewport {
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
  }

  &__header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-light);
  }

  &__row {
    &:hover {
      background: var(--el-bg-color-page);
    }
  }

  &__horizontal-scroll {
    overflow-x: auto;
    border-top: 1px solid var(--el-border-color-light);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  th {
    background: var(--el-fill-color-light);
    font-weight: 600;
  }
}
</style>
```

### 2. 数据预加载策略

```typescript
// composables/useDataPrefetch.ts
import { ref, computed, watch } from 'vue'

export interface UseDataPrefetchOptions {
  prefetchPages?: number
  prefetchSize?: number
  cacheSize?: number
}

export function useDataPrefetch<T = any>(
  fetchFn: (page: number, pageSize: number) => Promise<T[]>,
  total: number,
  options: UseDataPrefetchOptions = {}
) {
  const {
    prefetchPages = 1,
    prefetchSize = 20,
    cacheSize = 5
  } = options

  // 数据缓存
  const dataCache = ref<Map<number, T[]>>(new Map())
  const prefetchCache = ref<Map<number, T[]>>(new Map())
  const loadingPages = ref<Set<number>>(new Set())

  // 获取缓存数据
  const getCachedData = (page: number) => {
    return dataCache.value.get(page) || prefetchCache.value.get(page)
  }

  // 检查是否已缓存
  const isCached = (page: number) => {
    return dataCache.value.has(page) || prefetchCache.value.has(page)
  }

  // 加载指定页数据
  const loadPage = async (page: number, isPrefetch = false) => {
    if (isCached(page)) return getCachedData(page)

    if (loadingPages.value.has(page)) return

    try {
      loadingPages.value.add(page)

      const data = await fetchFn(page, prefetchSize)

      if (isPrefetch) {
        prefetchCache.value.set(page, data)
      } else {
        dataCache.value.set(page, data)
        // 将预加载的数据移动到主缓存
        const prefetchData = prefetchCache.value.get(page)
        if (prefetchData) {
          prefetchCache.value.delete(page)
        }
      }

      // 清理过多的缓存
      cleanCache()

      return data
    } finally {
      loadingPages.value.delete(page)
    }
  }

  // 预加载
  const prefetchPages = async (currentPage: number) => {
    const prefetchTasks = []

    for (let i = 1; i <= prefetchPages; i++) {
      const nextPage = currentPage + i
      const totalPages = Math.ceil(total / prefetchSize)

      if (nextPage <= totalPages && !isCached(nextPage)) {
        prefetchTasks.push(loadPage(nextPage, true))
      }
    }

    await Promise.all(prefetchTasks)
  }

  // 清理缓存
  const cleanCache = () => {
    if (dataCache.value.size > cacheSize) {
      const entries = Array.from(dataCache.value.entries())
      const toDelete = entries.slice(0, entries.length - cacheSize)
      toDelete.forEach(([key]) => dataCache.value.delete(key))
    }

    if (prefetchCache.value.size > cacheSize) {
      const entries = Array.from(prefetchCache.value.entries())
      const toDelete = entries.slice(0, entries.length - cacheSize)
      toDelete.forEach(([key]) => prefetchCache.value.delete(key))
    }
  }

  // 清除所有缓存
  const clearCache = () => {
    dataCache.value.clear()
    prefetchCache.value.clear()
    loadingPages.value.clear()
  }

  // 计算属性
  const isLoading = computed(() => loadingPages.value.size > 0)

  return {
    dataCache,
    prefetchCache,
    isLoading,
    loadPage,
    prefetchPages,
    isCached,
    clearCache
  }
}
```

## 📋 使用示例

### 1. 基础列表页面

```vue
<!-- views/users/UserList.vue -->
<template>
  <div class="user-list">
    <!-- 页面头部 -->
    <div class="user-list__header">
      <h1>用户管理</h1>
      <el-button type="primary" @click="handleCreate">
        新建用户
      </el-button>
    </div>

    <!-- 分页表格 -->
    <PaginatedTable
      :data="data"
      :columns="columns"
      :loading="loading"
      :paginated="true"
      :current-page="pagination.current"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      searchable
      @refresh="refreshData"
      @search="handleSearch"
      @sort-change="handleSort"
    >
      <!-- 工具栏 -->
      <template #toolbar-left>
        <el-button @click="handleBatchDelete" :disabled="!selectedUsers.length">
          批量删除
        </el-button>
        <el-button @click="handleExport">
          导出数据
        </el-button>
      </template>

      <!-- 操作列 -->
      <template #column-actions="{ row }">
        <el-space>
          <el-button size="small" @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">
            删除
          </el-button>
        </el-space>
      </template>

      <!-- 状态列 -->
      <template #column-status="{ row }">
        <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
          {{ row.status === 'active' ? '启用' : '禁用' }}
        </el-tag>
      </template>
    </PaginatedTable>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useServerPagination } from '@/composables/useServerPagination'
import { useNotification } from '@/composables/useNotification'
import PaginatedTable from '@/components/PaginatedTable.vue'
import type { User } from '@/types/entities/user'

const router = useRouter()
const { success, error, confirm } = useNotification()

// 分页数据
const {
  loading,
  data,
  pagination,
  refresh: refreshData,
  search,
  sort
} = useServerPagination<User>({
  endpoint: '/api/users',
  immediate: true
})

// 表格列定义
const columns = [
  { key: 'id', title: 'ID', prop: 'id', width: 80 },
  { key: 'username', title: '用户名', prop: 'username', sortable: true },
  { key: 'name', title: '姓名', prop: 'name', sortable: true },
  { key: 'email', title: '邮箱', prop: 'email' },
  { key: 'role', title: '角色', prop: 'role', width: 100 },
  {
    key: 'status',
    title: '状态',
    prop: 'status',
    width: 100,
    sortable: true
  },
  { key: 'actions', title: '操作', width: 150 }
]

// 选中的用户
const selectedUsers = ref<User[]>([])

// 事件处理
const handleCreate = () => {
  router.push('/users/create')
}

const handleEdit = (user: User) => {
  router.push(`/users/${user.id}/edit`)
}

const handleDelete = async (user: User) => {
  const confirmed = await confirm(`确定删除用户 "${user.name}" 吗？`)
  if (!confirmed) return

  try {
    await unifiedApi.delete(`/api/users/${user.id}`)
    success('删除成功')
    refreshData()
  } catch (err) {
    error('删除失败')
  }
}

const handleBatchDelete = async () => {
  const confirmed = await confirm(
    `确定删除选中的 ${selectedUsers.value.length} 个用户吗？`
  )
  if (!confirmed) return

  try {
    const ids = selectedUsers.value.map(user => user.id)
    await unifiedApi.delete('/api/users/batch', { data: { ids } })
    success('批量删除成功')
    refreshData()
    selectedUsers.value = []
  } catch (err) {
    error('批量删除失败')
  }
}

const handleSearch = (keyword: string) => {
  search(keyword)
}

const handleSort = (sorter: { prop: string; order: string }) => {
  sort(sorter)
}

const handleExport = async () => {
  try {
    const response = await unifiedApi.get('/api/users/export', {
      responseType: 'blob'
    })

    // 下载文件
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'users.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()

    success('导出成功')
  } catch (err) {
    error('导出失败')
  }
}

// 生命周期
onMounted(() => {
  refreshData()
})
</script>

<style lang="scss" scoped>
.user-list {
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
}
</style>
```

## 📋 最佳实践

### 1. 分页优化建议

- **合理设置页面大小**：根据业务场景选择合适的默认页面大小
- **避免过度分页**：数据量不大时考虑客户端分页
- **缓存策略**：合理使用缓存减少请求次数
- **预加载**：对用户可能访问的数据进行预加载
- **虚拟滚动**：大数据量列表使用虚拟滚动提升性能

### 2. 用户体验优化

- **加载状态**：明确展示数据加载状态
- **空状态处理**：提供友好的空数据提示
- **错误恢复**：提供错误重试机制
- **搜索体验**：支持实时搜索和搜索防抖
- **操作反馈**：及时反馈操作结果

### 3. 性能监控

```typescript
// 分页性能监控
const performanceMonitor = {
  // 记录加载时间
  recordLoadTime: (page: number, duration: number) => {
    logger.info('页面加载时间', { page, duration })
  },

  // 记录渲染性能
  recordRenderTime: (itemCount: number, duration: number) => {
    logger.info('列表渲染时间', { itemCount, duration })
  },

  // 记录缓存命中率
  recordCacheHit: (cacheType: string, hit: boolean) => {
    logger.info('缓存命中', { cacheType, hit })
  }
}
```

## 🔍 故障排除

### 常见问题

1. **分页数据不更新**
   - 检查响应式数据绑定
   - 确认数据更新是否触发视图更新

2. **虚拟滚动位置错误**
   - 检查元素高度计算
   - 确认滚动事件监听

3. **性能问题**
   - 检查是否启用虚拟滚动
   - 优化数据结构和渲染逻辑

### 调试技巧

```typescript
// 开发环境开启分页调试
if (import.meta.env.DEV) {
  window.__TF2025_PAGINATION_DEBUG__ = {
    showPerformance: true,
    logPageChanges: true,
    showCacheStats: true
  }
}
```

## 📚 参考资料

- [Element Plus Pagination 组件](https://element-plus.org/zh-CN/component/pagination.html)
- [Vue 3 虚拟滚动最佳实践](https://vuejs.org/guide/best-practices/performance.html#virtual-scrolling)
- [前端分页性能优化](https://web.dev/virtual-scrolling/)

---

**更新日期**：2025-01-15
**版本**：v1.0.0
**维护者**：TF2025 开发团队