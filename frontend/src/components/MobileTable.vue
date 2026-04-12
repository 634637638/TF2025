<template>
  <div ref="containerRef" class="mobile-table">
    <!-- 桌面端表格 -->
    <div v-if="!isMobile" class="mobile-table__desktop">
      <el-table
        ref="desktopTableRef"
        :data="data"
        v-loading="loading"
        :stripe="stripe"
        :border="border"
        :size="size"
        @selection-change="handleSelectionChange"
      >
        <!-- 动态生成列 -->
        <el-table-column
          v-for="column in columns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :sortable="column.sortable"
          :align="column.align || 'left'"
          :show-overflow-tooltip="column.showOverflowTooltip !== false"
        >
          <template #default="{ row }" v-if="column.slot">
            <slot :name="column.slot" :row="row" />
          </template>
        </el-table-column>

        <!-- 操作列 -->
        <el-table-column
          v-if="actions && actions.length > 0"
          label="操作"
          :width="actionWidth || 150"
          fixed="right"
          align="center"
        >
          <template #default="{ row, $index }">
            <div class="mobile-table__actions">
              <el-button
                v-for="action in actions"
                :key="action.key"
                :type="action.type || 'primary'"
                :size="action.size || 'small'"
                :icon="action.icon"
                :disabled="action.disabled ? action.disabled(row) : false"
                @click="handleAction(action, row, $index)"
              >
                {{ action.label }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 移动端卡片式表格 -->
    <div v-else class="mobile-table__mobile">
      <div v-loading="loading" class="mobile-table__card-list">
        <div
          v-for="(row, index) in data"
          :key="getRowKey(row, index)"
          class="mobile-table__card"
          :class="{ 'is-selected': selectedRows.includes(row) }"
          :data-row-key="String(getRowKey(row, index))"
          @click="handleCardClick(row)"
        >
          <!-- 卡片头部 -->
          <div v-if="showCardHeader" class="mobile-table__card-header">
            <slot name="card-header" :row="row">
              <h4 class="mobile-table__card-title">{{ getCardTitle(row) }}</h4>
              <div class="mobile-table__card-subtitle">{{ getCardSubtitle(row) }}</div>
            </slot>
          </div>

          <!-- 卡片内容 -->
          <div class="mobile-table__card-body">
            <div
              v-for="column in getMobileColumns()"
              :key="column.prop"
              class="mobile-table__card-field"
              v-show="!column.mobileHidden"
            >
              <div class="mobile-table__field-label">{{ column.label }}</div>
              <div class="mobile-table__field-value">
                <slot v-if="column.slot" :name="column.slot" :row="row" />
                <span v-else>{{ formatFieldValue(row[column.prop], row, column) }}</span>
              </div>
            </div>
          </div>

          <!-- 卡片底部操作 -->
          <div v-if="actions && actions.length > 0" class="mobile-table__card-actions">
            <el-button
              v-for="action in getMobileActions()"
              :key="action.key"
              :type="action.type || 'primary'"
              :size="action.size || 'small'"
              :icon="action.icon"
              :disabled="action.disabled ? action.disabled(row) : false"
              @click.stop="handleAction(action, row, index)"
              class="mobile-table__mobile-action-btn"
            >
              {{ action.label }}
            </el-button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && (!data || data.length === 0)" class="mobile-table__empty">
        <slot name="empty">
          <el-empty
            :image="emptyImage"
            :description="emptyDescription"
            :image-size="emptyImageSize"
          />
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import type { TableAction, TableColumn } from '@/types/component'
import { useMobile } from '@/composables/useMobile'

type TableRow = Record<string, unknown>
type RowKey = string | number

interface MobileTableColumn extends TableColumn {
  showOverflowTooltip?: boolean
  slot?: string
  mobileHidden?: boolean
  mobileFormatter?: (value: unknown, row: TableRow) => string
}

interface MobileTableAction extends TableAction<TableRow> {
  icon?: Component
  mobileOnly?: boolean
}

interface Props {
  data: TableRow[]
  columns: MobileTableColumn[]
  loading?: boolean
  stripe?: boolean
  border?: boolean
  size?: 'large' | 'default' | 'small'
  actions?: MobileTableAction[]
  actionWidth?: string | number
  rowKey?: string | ((row: TableRow) => RowKey)
  showCardHeader?: boolean
  emptyDescription?: string
  emptyImage?: string
  emptyImageSize?: number
  titleField?: string
  subtitleField?: string
  mobilePriorityColumns?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  stripe: true,
  border: false,
  size: 'default',
  actions: () => [],
  showCardHeader: true,
  emptyDescription: '暂无数据',
  emptyImageSize: 120,
  titleField: 'id',
  subtitleField: '',
  mobilePriorityColumns: () => ['id', 'name', 'title', 'status', 'created_at']
})

interface Emits {
  selectionChange: [selection: TableRow[]]
  action: [action: MobileTableAction, row: TableRow, index: number]
  rowClick: [row: TableRow]
}

const emit = defineEmits<Emits>()

// 使用移动端检测
const { isMobile } = useMobile()
const containerRef = ref<HTMLElement | null>(null)
const desktopTableRef = ref<{ setCurrentRow?: (row?: TableRow) => void } | null>(null)

// 选中的行
const selectedRows = ref<TableRow[]>([])

// 获取行的唯一标识
const getRowKey = (row: TableRow, index: number): RowKey => {
  if (props.rowKey) {
    if (typeof props.rowKey === 'function') {
      return props.rowKey(row)
    }

    const keyValue = row[props.rowKey]
    if (typeof keyValue === 'string' || typeof keyValue === 'number') {
      return keyValue
    }
  }
  return index
}

// 获取卡片标题
const getCardTitle = (row: TableRow) => {
  if (props.titleField) {
    const titleValue = row[props.titleField]
    if (titleValue !== undefined && titleValue !== null && titleValue !== '') {
      return String(titleValue)
    }
  }
  return `记录 #${getRowKey(row, 0)}`
}

// 获取卡片副标题
const getCardSubtitle = (row: TableRow) => {
  if (props.subtitleField) {
    const subtitleValue = row[props.subtitleField]
    if (subtitleValue !== undefined && subtitleValue !== null && subtitleValue !== '') {
      return String(subtitleValue)
    }
  }
  return ''
}

// 获取移动端显示的列
const getMobileColumns = () => {
  // 在移动端优先显示重要的列，最多显示5个
  const priorityColumns = props.mobilePriorityColumns
  return props.columns
    .filter(col => !col.mobileHidden)
    .sort((a, b) => {
      const aIndex = priorityColumns.indexOf(a.prop)
      const bIndex = priorityColumns.indexOf(b.prop)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return 0
    })
    .slice(0, 5)
}

// 获取移动端显示的操作
const getMobileActions = () => {
  // 在移动端只显示最多3个主要操作
  return props.actions
    .filter(action => !action.mobileOnly)
    .slice(0, 3)
}

// 格式化字段值
const formatFieldValue = (value: unknown, row: TableRow, column: MobileTableColumn) => {
  if (column.mobileFormatter) {
    return column.mobileFormatter(value, row)
  }

  if (column.formatter) {
    return column.formatter(row, column, value)
  }

  if (value === null || value === undefined) {
    return '-'
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

// 处理选择变化
const handleSelectionChange = (selection: TableRow[]) => {
  selectedRows.value = selection
  emit('selectionChange', selection)
}

// 处理卡片点击
const handleCardClick = (row: TableRow) => {
  emit('rowClick', row)
}

// 处理操作按钮点击
const handleAction = (action: MobileTableAction, row: TableRow, index: number) => {
  emit('action', action, row, index)
}

const clearSelection = () => {
  selectedRows.value = []
  emit('selectionChange', [])
}

const scrollToRow = (rowKey: RowKey) => {
  const rowKeyValue = String(rowKey)

  if (isMobile.value) {
    const rowElement = containerRef.value?.querySelector<HTMLElement>(`[data-row-key="${rowKeyValue}"]`)
    rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const targetRow = props.data.find((row, index) => String(getRowKey(row, index)) === rowKeyValue)
  if (targetRow) {
    desktopTableRef.value?.setCurrentRow?.(targetRow)
  }
}

defineExpose({
  selectedRows,
  clearSelection,
  scrollToRow
})
</script>

<style lang="scss" scoped>
.mobile-table {
  width: 100%;
}

.mobile-table__desktop {
  width: 100%;
}

.mobile-table__actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.mobile-table__mobile {
  width: 100%;
}

.mobile-table__card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-table__card {
  background: white;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);

  &:hover {
    border-color: var(--el-color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.mobile-table__card-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.mobile-table__card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mobile-table__card-subtitle {
  margin-top: 4px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.mobile-table__card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-table__card-field {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.mobile-table__field-label {
  min-width: 80px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.mobile-table__field-value {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.mobile-table__card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  justify-content: flex-end;
}

.mobile-table__mobile-action-btn {
  flex: 1;
  min-width: 80px;
}

.mobile-table__empty {
  padding: 40px 20px;
  text-align: center;
}

/* 移动端优化 */
@media (max-width: 767px) {
  .mobile-table__card {
    padding: 12px;
  }

  .mobile-table__field-label {
    min-width: 70px;
    font-size: 13px;
  }

  .mobile-table__field-value {
    font-size: 13px;
  }

  .mobile-table__mobile-action-btn {
    font-size: 13px;
    padding: 6px 12px;
  }
}

/* 超小屏优化 */
@media (max-width: 479px) {
  .mobile-table__card-actions {
    flex-wrap: wrap;
  }

  .mobile-table__mobile-action-btn {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    padding: 6px 8px;
  }
}
</style>
