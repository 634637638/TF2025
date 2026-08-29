<template>
  <div class="sales-view-panel">
    <div class="table-responsive">
      <el-table
        :data="loading ? [] : phones"
        border
        stripe
        class="data-table devices-table sales-data-table"
        table-layout="fixed"
        :fit="true"
        row-key="id"
        :row-class-name="getRowClassName"
      >
        <el-table-column
          v-if="batchMode || operationMode"
          width="54"
          align="center"
          class-name="checkbox-column"
        >
          <template #header>
            <el-checkbox
              :model-value="selectAll"
              size="large"
              @change="handleSelectAllChange"
            />
          </template>
          <template #default="{ row: phone }">
            <el-checkbox
              :model-value="isPhoneSelected(phone)"
              size="large"
              @change="emit('toggle-phone', phone)"
            />
          </template>
        </el-table-column>

        <el-table-column
          v-if="canViewField('supplier_name')"
          label="供应商"
          :min-width="getColumnWidth('supplier_name', '供应商', 84)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ phone.supplier_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('store_name')"
          label="店铺"
          :min-width="getColumnWidth('store_name', '店铺', 64)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ phone.store_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('brand')"
          label="品牌"
          :min-width="getColumnWidth('brand', '品牌', 52)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ phone.brand || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('model')"
          label="型号"
          :min-width="getColumnWidth('model', '型号', 74)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ phone.model || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('color')"
          label="颜色"
          :min-width="getColumnWidth('color', '颜色', 52)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ phone.color || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('memory')"
          label="内存"
          :min-width="getColumnWidth('memory', '内存', 60)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ phone.memory || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('serial_number')"
          label="序列号"
          :min-width="getIdentifierWidth('serial_number')"
          align="center"
          class-name="identifier-column serial-imei-column"
        >
          <template #default="{ row: phone }">
            {{ phone.serial_number || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('imei')"
          label="IMEI"
          :min-width="getIdentifierWidth('imei')"
          align="center"
          class-name="identifier-column serial-imei-column"
        >
          <template #default="{ row: phone }">
            <span class="imei">{{ phone.imei || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewPrice"
          label="入库价格"
          :min-width="getColumnWidth('purchase_cost', '入库价格', 84)"
          align="center"
          class-name="price-column"
        >
          <template #default="{ row: phone }">
            <div class="price">
              ¥{{ formatNumber(phone.purchase_cost || 0) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('inventory_operator_name')"
          label="入库员"
          :min-width="getColumnWidth('inventory_operator_name', '入库员', 64)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ phone.inventory_operator_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('condition')"
          label="机况"
          :min-width="getColumnWidth('condition', '机况', 64)"
          align="center"
        >
          <template #default="{ row: phone }">
            <span :class="['condition-badge', phone.is_new ? 'new' : 'used']">
              {{ getNewConditionLabel(phone.is_new) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          :min-width="getColumnWidth('status_label', '状态', 64)"
          align="center"
        >
          <template #default="{ row: phone }">
            <span :class="['status-badge', getSaleStatusClass(phone)]">
              {{ getSaleStatusLabel(phone) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="canViewField('inventory_time')"
          label="入库时间"
          :min-width="getColumnWidth('inventory_time', '入库时间', 88)"
          align="center"
        >
          <template #default="{ row: phone }">
            {{ formatDate(phone.inventory_time) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="showActionColumn"
          label="操作"
          :width="actionColumnWidth"
          align="center"
          class-name="actions-column"
        >
          <template #default="{ row: phone }">
            <div class="action-buttons">
              <el-button
                v-if="canCreate"
                type="success"
                size="small"
                title="销售出库"
                @click.stop="emit('sale', phone)"
              >
                <i class="fas fa-shopping-cart" />
                出库
              </el-button>
              <el-button
                v-if="canEdit"
                type="primary"
                size="small"
                title="编辑设备信息"
                @click.stop="emit('edit', phone)"
              >
                <i class="fas fa-edit" />
                编辑
              </el-button>
              <el-button
                v-if="canDelete"
                type="danger"
                size="small"
                title="删除设备"
                @click.stop="emit('delete', phone)"
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
            text="加载可销售设备..."
          />
          <DataEmptyState
            v-else
            :state="hasActiveFilters ? 'filtered' : 'empty'"
            :description="hasActiveFilters ? '未找到匹配的设备' : '暂无可销售设备'"
          >
            <el-button
              v-if="hasActiveFilters"
              type="primary"
              plain
              size="small"
              @click="emit('reset-filters')"
            >
              清空筛选条件
            </el-button>
          </DataEmptyState>
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import type { Phone } from '@/types'
import { formatNumber } from '@/utils/format'
import { getAdaptiveActionColumnWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import {
  formatSalesDate as formatDate,
  getNewConditionLabel,
  getSaleStatusClass,
  getSaleStatusLabel
} from '../sales-phone-helpers'

type OperationMode = 'wholesale' | 'proxy' | null

const props = defineProps<{
  phones: Phone[]
  selectedPhones: Phone[]
  loading: boolean
  hasActiveFilters: boolean
  batchMode: boolean
  operationMode: OperationMode
  selectAll: boolean
  compact: boolean
  canViewField: (_fieldName: string) => boolean
  canViewPrice: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{
  'update:select-all': [value: boolean]
  'toggle-select-all': []
  'toggle-phone': [phone: Phone]
  sale: [phone: Phone]
  edit: [phone: Phone]
  delete: [phone: Phone]
  'reset-filters': []
}>()

const selectedPhoneIdSet = computed(() => new Set(props.selectedPhones.map(phone => String(phone.id))))
const showActionColumn = computed(() => (
  !props.batchMode
  && !props.operationMode
  && shouldShowActionColumn(
    props.canViewField('actions'),
    [props.canCreate, props.canEdit, props.canDelete]
  )
))
const actionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  props.phones,
  [props.canCreate, props.canEdit, props.canDelete]
))

const isPhoneSelected = (phone: Phone) => selectedPhoneIdSet.value.has(String(phone.id))
const getRowClassName = ({ row }: { row: Phone }) => isPhoneSelected(row) ? 'row-selected' : ''

const getColumnWidth = (field: string, label: string, minWidth: number) => getTextColumnMinWidth(
  [label, ...props.phones.map(phone => {
    if (field === 'condition') return getNewConditionLabel(phone.is_new)
    if (field === 'status_label') return getSaleStatusLabel(phone)
    if (field === 'purchase_cost') return `¥${formatNumber(phone.purchase_cost || 0)}`
    if (field === 'inventory_time') return formatDate(phone.inventory_time)
    return String((phone as unknown as Record<string, unknown>)[field] ?? '-')
  })],
  { minWidth, horizontalPadding: 20, asciiCharacterWidth: 7, wideCharacterWidth: 12 }
)

const getIdentifierWidth = (field: 'serial_number' | 'imei') => {
  const label = field === 'serial_number' ? '序列号' : 'IMEI'
  return getIdentifierColumnMinWidth(
    [label, ...props.phones.map(phone => phone[field])],
    {
      minWidth: props.compact ? 128 : field === 'serial_number' ? 156 : 168,
      horizontalPadding: props.compact ? 20 : 36,
      asciiCharacterWidth: props.compact ? 6.5 : 8,
      wideCharacterWidth: props.compact ? 11 : 13
    }
  )
}

const handleSelectAllChange = (value: boolean | string | number) => {
  emit('update:select-all', Boolean(value))
  emit('toggle-select-all')
}
</script>

<style scoped lang="scss" src="../styles/sales-table-view.scss"></style>
