<template>
  <div class="sales-view-panel">
    <TableLoadingRow
      v-if="loading"
      mode="block"
      text="加载中..."
    />
    <DataEmptyState
      v-else-if="items.length === 0"
      title="暂无库存数据"
      description="调整筛选条件或添加新的库存设备"
    />
    <div
      v-else
      class="table-responsive"
    >
      <div
        ref="captureElementRef"
        class="inventory-summary-capture"
      >
        <el-table
          :data="items"
          border
          stripe
          class="data-table devices-table summary-table"
          table-layout="fixed"
          :fit="true"
          row-class-name="inventory-row"
          @row-dblclick="emit('show-detail', $event)"
        >
          <el-table-column
            v-if="canViewField('supplier_name')"
            label="供应商"
            :min-width="getColumnWidth('supplier_name', '供应商', 84)"
            align="center"
          >
            <template #default="{ row }">
              {{ row.supplier_name || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('store_name')"
            label="店铺"
            :min-width="getColumnWidth('store_name', '店铺', 64)"
            align="center"
          >
            <template #default="{ row }">
              {{ row.store_name || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('brand')"
            label="品牌"
            :min-width="getColumnWidth('brand', '品牌', 52)"
            align="center"
          >
            <template #default="{ row }">
              {{ row.brand || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('model')"
            label="型号"
            :min-width="getColumnWidth('model', '型号', 74)"
            align="center"
          >
            <template #default="{ row }">
              {{ row.model || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('color')"
            label="颜色"
            :min-width="getColumnWidth('color', '颜色', 52)"
            align="center"
          >
            <template #default="{ row }">
              {{ row.color || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('memory')"
            label="内存"
            :min-width="getColumnWidth('memory', '内存', 60)"
            align="center"
          >
            <template #default="{ row }">
              <span :class="['memory-badge', getMemoryBadgeClass(row.memory)]">
                {{ row.memory || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('condition')"
            label="机况"
            :min-width="getColumnWidth('condition', '机况', 64)"
            align="center"
          >
            <template #default="{ row }">
              <span :class="['badge', row.condition === '全新' ? 'badge-new' : 'badge-used']">
                {{ row.condition || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            label="数量"
            :min-width="getColumnWidth('quantity', '数量', 64)"
            align="center"
          >
            <template #default="{ row }">
              <span class="quantity-badge">{{ row.quantity ?? 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('inventory_time')"
            label="在库时间"
            :min-width="getColumnWidth('inventory_days', '在库时间', 84)"
            align="center"
          >
            <template #default="{ row }">
              <span
                :class="['days-badge', getInventoryDaysClass(getInventoryDays(row.earliest_date))]"
                :title="getInventoryDaysTitle(row)"
              >
                {{ getInventoryDaysText(getInventoryDays(row.earliest_date)) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { getTextColumnMinWidth } from '@/utils/table-layout'
import {
  getInventoryDays,
  getInventoryDaysClass,
  getInventoryDaysText,
  getMemoryBadgeClass
} from '../inventory-formatters'
import type { InventorySummaryItem } from '../types'

const props = defineProps<{
  items: InventorySummaryItem[]
  loading: boolean
  canViewField: (_fieldName: string) => boolean
}>()

const emit = defineEmits<{
  'show-detail': [item: InventorySummaryItem]
}>()

const captureElementRef = ref<HTMLElement | null>(null)

const getCaptureElement = () => captureElementRef.value

const getColumnWidth = (
  field: keyof InventorySummaryItem | 'inventory_days',
  label: string,
  minWidth: number
) => getTextColumnMinWidth(
  [label, ...props.items.map(row => {
    if (field === 'inventory_days') {
      return getInventoryDaysText(getInventoryDays(row.earliest_date))
    }
    return row[field] ?? '-'
  })],
  { minWidth, horizontalPadding: 20, asciiCharacterWidth: 7, wideCharacterWidth: 12 }
)

const getInventoryDaysTitle = (row: InventorySummaryItem) => {
  const earliestDays = getInventoryDays(row.earliest_date)
  const latestDays = getInventoryDays(row.latest_date)
  return `入库时间范围: ${row.earliest_date} ~ ${row.latest_date}\n最早入库: ${row.earliest_date} (${getInventoryDaysText(earliestDays)})\n最新入库: ${row.latest_date} (${getInventoryDaysText(latestDays)})`
}

defineExpose({ getCaptureElement })
</script>

<style scoped lang="scss" src="../styles/sales-summary-view.scss"></style>
