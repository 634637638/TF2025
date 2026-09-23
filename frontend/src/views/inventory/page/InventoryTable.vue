<template>
  <div class="table-section admin-panel admin-table-panel">
    <div class="section-title">
      <i class="fas fa-list" />
      库存列表
      <span class="record-count">共 {{ pagination.total }} 条记录</span>
    </div>

    <div class="table-responsive">
      <el-table
        :data="loading ? [] : inventory"
        border
        stripe
        class="data-table devices-table inventory-table"
        table-layout="fixed"
        :fit="true"
        row-key="id"
        @row-click="handleRowClick"
      >
        <el-table-column
          v-for="column in columns"
          :key="column.key"
          :label="column.label"
          :min-width="getColumnMinWidth(column)"
          :width="getColumnWidth(column)"
          align="center"
          :class-name="getColumnClass(column)"
        >
          <template #default="{ row: item }">
            <span v-if="column.key === 'supplier_name'">{{ item.supplier_name || '-' }}</span>
            <span v-else-if="column.key === 'store_name'">{{ item.store_name || '-' }}</span>
            <span v-else-if="column.key === 'brand'">{{ item.brand_name || item.brand || '-' }}</span>
            <span v-else-if="column.key === 'model'">{{ item.model_name || item.model || '-' }}</span>
            <span v-else-if="column.key === 'color'">{{ item.color_name || item.color || '-' }}</span>
            <span v-else-if="column.key === 'memory'">{{ item.memory_name || item.memory || '-' }}</span>
            <span
              v-else-if="column.key === 'serial_number'"
              class="serial-number"
            >{{ item.serial_number || '-' }}</span>
            <span v-else-if="column.key === 'imei'"><span class="imei">{{ item.imei || '-' }}</span></span>
            <span
              v-else-if="column.key === 'purchase_cost'"
              class="price"
            >¥{{ formatNumber(item.purchase_cost || 0) }}</span>
            <span v-else-if="column.key === 'inventory_operator_name'">{{ item.inventory_operator_name || item.operator_name || '-' }}</span>
            <span v-else-if="column.key === 'is_new'">
              <span
                class="condition-badge"
                :class="getConditionClass(item.is_new ?? 0)"
              >{{ getConditionText(item.is_new ?? 0) }}</span>
            </span>
            <span v-else-if="column.key === 'is_preordered'">
              <span :class="['status-badge', getSaleStatusClass(item)]">{{ getSaleStatusLabel(item) }}</span>
            </span>
            <span v-else-if="column.key === 'inventory_time'">{{ formatDate(item.inventory_time) }}</span>
            <div
              v-else-if="column.key === 'actions'"
              class="action-buttons"
            >
              <el-button
                type="primary"
                size="small"
                title="查看详情"
                @click.stop="emit('view', item)"
              >
                <i class="fas fa-eye" />
                查看
              </el-button>
              <el-button
                v-if="canSell && isPhoneSaleActionAvailable(item)"
                type="warning"
                size="small"
                title="商品出库"
                @click.stop="emit('quick-sale', item)"
              >
                <i class="fas fa-shopping-cart" />
                出库
              </el-button>
              <el-button
                v-if="canEdit && isPhoneSaleActionAvailable(item)"
                type="success"
                size="small"
                title="编辑"
                @click.stop="emit('edit', item)"
              >
                <i class="fas fa-edit" />
                编辑
              </el-button>
              <el-button
                v-if="canDelete && isPhoneSaleActionAvailable(item)"
                type="danger"
                size="small"
                title="删除"
                @click.stop="emit('delete', item)"
              >
                <i class="fas fa-trash" />
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <TableLoadingRow
            v-if="loading"
            mode="block"
            text="加载库存列表..."
          />
          <DataEmptyState
            v-else
            description="暂无库存数据"
          />
        </template>
      </el-table>
    </div>

    <div class="pagination-wrapper">
      <Pagination
        v-model:current="pagination.page"
        v-model:page-size="pagination.size"
        :total="Number(pagination.total)"
        :page-sizes="[20, 50, 100, 200]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        :disabled="loading"
        @change="(page: number, pageSize: number) => emit('pagination-change', { page, pageSize })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import type { InventoryItem } from '@/types'
import { isPhoneSaleActionAvailable } from '@/constants/phoneStatuses'

interface InventoryColumn {
  key: string
  label: string
}

interface InventoryPagination {
  page: number
  size: number
  total: number
}

const props = defineProps<{
  canSell: boolean
  canDelete: boolean
  canEdit: boolean
  columns: InventoryColumn[]
  formatDate: (_value?: string) => string
  formatNumber: (_value: number) => string
  getColumnClass: (_column: InventoryColumn) => string
  getColumnMinWidth: (_column: InventoryColumn) => number
  getColumnWidth: (_column: InventoryColumn) => number | undefined
  getConditionClass: (_value: number | boolean | string) => string
  getConditionText: (_value: number | boolean | string) => string
  getSaleStatusClass: (_item: InventoryItem) => string
  getSaleStatusLabel: (_item: InventoryItem) => string
  inventory: InventoryItem[]
  loading: boolean
  pagination: InventoryPagination
}>()

const emit = defineEmits<{
  delete: [item: InventoryItem]
  edit: [item: InventoryItem]
  'pagination-change': [pagination: { page: number; pageSize: number }]
  'quick-sale': [item: InventoryItem]
  'row-tap': [item: InventoryItem, column: unknown, event: MouseEvent]
  view: [item: InventoryItem]
}>()

const handleRowClick = (item: InventoryItem, column: unknown, event: MouseEvent) => {
  emit('row-tap', item, column, event)
}

const {
  canSell,
  canDelete,
  canEdit,
  columns,
  formatDate,
  formatNumber,
  getColumnClass,
  getColumnMinWidth,
  getColumnWidth,
  getConditionClass,
  getConditionText,
  getSaleStatusClass,
  getSaleStatusLabel,
  inventory,
  loading,
  pagination
} = toRefs(props)
</script>
