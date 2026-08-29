<template>
  <MobileDialog
    v-model="visible"
    title="库存明细"
    width="50%"
    :close-on-click-modal="false"
    dialog-class="inventory-detail-modal"
    :show-default-footer="false"
    @close="emit('close')"
  >
    <SectionLoading
      v-if="loading"
      text="加载中..."
    />
    <div
      v-else
      class="inventory-detail-content"
    >
      <div class="detail-summary-cards">
        <div
          v-if="canViewField('supplier_name')"
          class="summary-card highlight"
        >
          <div class="card-label">
            供应商
          </div>
          <div class="card-value">
            {{ firstItem?.supplier_name || '-' }}
          </div>
        </div>
        <div
          v-if="canViewField('store_name')"
          class="summary-card highlight"
        >
          <div class="card-label">
            店铺
          </div>
          <div class="card-value">
            {{ firstItem?.store_name || '-' }}
          </div>
        </div>
        <div
          v-if="canViewField('brand')"
          class="summary-card highlight"
        >
          <div class="card-label">
            品牌
          </div>
          <div class="card-value">
            {{ firstItem?.brand || '-' }}
          </div>
        </div>
        <div
          v-if="canViewField('condition')"
          class="summary-card highlight"
        >
          <div class="card-label">
            机况
          </div>
          <div class="card-value">
            <span :class="['badge', firstItem?.is_new ? 'badge-new' : 'badge-used']">
              {{ firstItem?.is_new ? '全新' : '二手' }}
            </span>
          </div>
        </div>
        <div class="summary-card highlight">
          <div class="card-label">
            库存数量
          </div>
          <div class="card-value">
            {{ items.length }} 台
          </div>
        </div>
        <div
          class="summary-card"
          :class="getLongestInventoryClass(longestItem?.inventory_days || 0)"
        >
          <div class="card-label">
            最长在库
          </div>
          <div class="card-value">
            {{ longestItem ? getInventoryDaysText(longestItem.inventory_days || 0) : '-' }}
          </div>
        </div>
      </div>

      <div class="detail-table-wrapper">
        <div class="detail-header">
          <h4>设备列表</h4>
          <span class="record-count">共 {{ items.length }} 条记录</span>
        </div>
        <div class="table-responsive inventory-detail-table-container">
          <el-table
            :data="items"
            border
            stripe
            class="data-table devices-table detail-table"
            table-layout="fixed"
            :fit="true"
            row-key="id"
            :row-class-name="getRowClassName"
          >
            <el-table-column
              label="优先"
              min-width="64"
              align="center"
              class-name="priority-column"
            >
              <template #default="{ row: phone }">
                <span
                  v-if="phone.id === longestItem?.id"
                  class="priority-badge"
                  title="最长在库"
                  aria-label="最长在库"
                >
                  <i class="fas fa-star" />
                </span>
                <span
                  v-else
                  class="priority-rank"
                >
                  {{ items.indexOf(phone) + 1 }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('imei')"
              label="IMEI"
              :min-width="getIdentifierWidth('imei')"
              align="center"
              class-name="identifier-column serial-imei-column imei-cell"
            >
              <template #default="{ row: phone }">
                {{ phone.imei || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('serial_number')"
              label="序列号"
              :min-width="getIdentifierWidth('serial_number')"
              align="center"
              class-name="identifier-column serial-imei-column sn-cell"
            >
              <template #default="{ row: phone }">
                {{ phone.serial_number || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('model')"
              label="型号"
              :min-width="modelColumnWidth"
              align="center"
            >
              <template #default="{ row: phone }">
                {{ phone.model || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('color')"
              label="颜色"
              min-width="56"
              align="center"
            >
              <template #default="{ row: phone }">
                {{ phone.color || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('memory')"
              label="内存"
              min-width="68"
              align="center"
            >
              <template #default="{ row: phone }">
                {{ phone.memory || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewPrice"
              label="入库价格"
              :min-width="priceColumnWidth"
              align="center"
              class-name="price-column"
            >
              <template #default="{ row: phone }">
                ¥{{ formatInventoryPrice(phone.purchase_cost) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('inventory_time')"
              label="入库时间"
              min-width="108"
              align="center"
            >
              <template #default="{ row: phone }">
                {{ phone.inventory_time ? formatInventoryDate(phone.inventory_time) : '-' }}
              </template>
            </el-table-column>
            <el-table-column
              label="在库"
              min-width="76"
              align="center"
            >
              <template #default="{ row: phone }">
                <span :class="['days-badge', getInventoryDaysClass(phone.inventory_days || 0)]">
                  {{ getInventoryDaysText(phone.inventory_days || 0) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import { getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import {
  formatInventoryDate,
  formatInventoryPrice,
  getInventoryDaysClass,
  getInventoryDaysText,
  getLongestInventoryClass
} from '../inventory-formatters'
import type { InventoryDetailItem } from '../types'

const props = defineProps<{
  modelValue: boolean
  items: InventoryDetailItem[]
  loading: boolean
  canViewField: (_fieldName: string) => boolean
  canViewPrice: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})
const firstItem = computed(() => props.items[0])
const longestItem = computed(() => props.items[0] || null)
const modelColumnWidth = computed(() => getTextColumnMinWidth(
  ['型号', ...props.items.map(phone => phone.model)],
  { minWidth: 104, horizontalPadding: 20, asciiCharacterWidth: 7, wideCharacterWidth: 12 }
))
const priceColumnWidth = computed(() => getTextColumnMinWidth(
  ['入库价格', ...props.items.map(phone => `¥${formatInventoryPrice(phone.purchase_cost)}`)],
  { minWidth: 84, horizontalPadding: 16, asciiCharacterWidth: 7, wideCharacterWidth: 12 }
))

const getIdentifierWidth = (field: 'serial_number' | 'imei') => {
  const label = field === 'serial_number' ? '序列号' : 'IMEI'
  return getIdentifierColumnMinWidth(
    [label, ...props.items.map(phone => phone[field])],
    {
      minWidth: field === 'serial_number' ? 104 : 136,
      horizontalPadding: 20,
      asciiCharacterWidth: 7,
      wideCharacterWidth: 12
    }
  )
}

const getRowClassName = ({ row }: { row: InventoryDetailItem }) => (
  row.id === longestItem.value?.id ? 'priority-row' : ''
)
</script>

<style lang="scss" src="../styles/sales-inventory-detail-dialog.scss"></style>
