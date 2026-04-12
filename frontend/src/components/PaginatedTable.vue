<template>
  <div class="tf-paginated-table">
    <!-- 工具栏 -->
    <div v-if="showToolbar" class="tf-paginated-table__toolbar">
      <div class="tf-paginated-table__toolbar-left">
        <slot name="toolbar-left" />
        <div v-if="selected.length > 0" class="tf-paginated-table__selection">
          已选择 {{ selected.length }} 项
          <el-button size="small" @click="clearSelection">
            清空
          </el-button>
        </div>
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
    <div class="tf-paginated-table__table-wrapper">
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
        <!-- 选择列 -->
        <el-table-column
          v-if="selectable"
          type="selection"
          width="55"
          :selectable="selectableFunction"
        />

        <!-- 序号列 -->
        <el-table-column
          v-if="showIndex"
          type="index"
          label="序号"
          width="80"
          :index="getIndex"
        />

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

        <!-- 操作列 -->
        <el-table-column
          v-if="$slots.actions"
          label="操作"
          :width="actionsWidth"
          :fixed="actionsFixed"
        >
          <template #default="scope">
            <slot name="actions" :row="scope.row" :index="scope.$index" />
          </template>
        </el-table-column>

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
    </div>

    <!-- 分页 -->
    <Pagination
      v-if="showPagination"
      v-model:current="currentPage"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="pageSizes"
      :show-total="showTotal"
      :show-range="showRange"
      :show-page-sizes="showPageSizes"
      :show-quick-jumper="showQuickJumper"
      :size="size"
      :disabled="loading"
      @change="handlePaginationChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import Pagination from './Pagination.vue'
import type { TableColumn } from '@/types'

type TableRow = Record<string, unknown>
type SortOrder = 'ascending' | 'descending' | null

interface PaginatedTableColumn extends TableColumn {
  key: string
  formatter?: (value: unknown, row: TableRow) => string
}

interface Props {
  // 数据相关
  data: TableRow[]
  columns: PaginatedTableColumn[]
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
  showPageSizes?: boolean
  showQuickJumper?: boolean

  // 表格样式
  height?: string | number
  maxHeight?: string | number
  stripe?: boolean
  border?: boolean
  size?: 'large' | 'default' | 'small'
  rowKey?: string | ((row: TableRow) => string | number)
  defaultSort?: { prop: string; order: SortOrder }

  // 功能开关
  searchable?: boolean
  selectable?: boolean
  showIndex?: boolean
  showToolbar?: boolean
  selectableFunction?: (row: TableRow, index: number) => boolean

  // 操作列
  actionsWidth?: number | string
  actionsFixed?: boolean | 'left' | 'right'

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
  showPageSizes: true,
  showQuickJumper: true,
  stripe: true,
  border: false,
  size: 'default',
  searchable: false,
  selectable: false,
  showIndex: false,
  showToolbar: true,
  emptyDescription: '暂无数据'
})

interface Emits {
  'update:current': [page: number]
  'update:pageSize': [size: number]
  'refresh': []
  'search': [keyword: string]
  'sort-change': [sort: { prop: string; order: SortOrder }]
  'selection-change': [selection: TableRow[]]
}

const emit = defineEmits<Emits>()

// 响应式数据
const currentPage = ref(props.currentPage)
const pageSize = ref(props.pageSize)
const searchKeyword = ref('')
const selected = ref<TableRow[]>([])
const tableData = computed(() => props.data)

// 计算属性
const getIndex = (index: number) => {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

// 方法
const getColumnValue = (row: TableRow, column: PaginatedTableColumn) => {
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

const handleSortChange = (sort: { prop: string; order: SortOrder }) => {
  emit('sort-change', sort)
}

const handleSelectionChange = (selection: TableRow[]) => {
  selected.value = selection
  emit('selection-change', selection)
}

const clearSelection = () => {
  selected.value = []
}

// 监听器
watch(() => props.currentPage, (newPage) => {
  currentPage.value = newPage
})

watch(() => props.pageSize, (newSize) => {
  pageSize.value = newSize
})

// 暴露方法
defineExpose({
  clearSelection,
  refresh: handleRefresh,
  search: handleSearch
})
</script>

<style lang="scss" scoped>
.tf-paginated-table {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--el-bg-color-page);
    border-radius: 8px;
    border: 1px solid var(--el-border-color-lighter);

    &-left,
    &-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  &__selection {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    border-radius: 4px;
    font-size: 12px;
  }

  &__table-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :deep(.el-table) {
    flex: 1;

    .el-table__body-wrapper {
      flex: 1;
      overflow-y: auto;
    }
  }
}

// 响应式设计
@media (max-width: 767px) {
  .tf-paginated-table {
    &__toolbar {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;

      &-left,
      &-right {
        justify-content: center;
      }
    }
  }
}
</style>
