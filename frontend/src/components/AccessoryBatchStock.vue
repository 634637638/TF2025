<template>
  <section
    v-if="allowed"
    class="detail-section"
  >
    <div class="flex items-center justify-between gap-2 mb-3">
      <h3 class="m-0">
        当前批次库存
      </h3>
      <div class="tf-dialog-toolbar">
        <el-checkbox
          v-if="canAdjust"
          v-model="includeZero"
          :disabled="loading"
          @change="changePage(1)"
        >
          含零库存批次
        </el-checkbox>
        <el-button
          v-permission="'accessories:view'"
          class="tf-button--refresh"
          :disabled="loading"
          @click="load"
        >
          刷新
        </el-button>
      </div>
    </div>
    <DataEmptyState
      v-if="failed"
      state="error"
      title="批次库存读取失败"
      :description="failureMessage"
      size="compact"
      action-text="重试"
      @action="load"
    />
    <el-table
      v-else
      v-table-double-tap="detailTapOptions"
      v-tf-loading="{ active: loading, text: '正在核对当前批次库存...' }"
      :data="rows"
      row-key="row_key"
      class="data-table"
      @row-dblclick="detailDoubleClick"
    >
      <el-table-column
        v-if="visible('sequence')"
        label="序号"
        :width="$getNumberColumnWidth(rows.map((_row, index) => number(index)))"
        align="center"
      >
        <template #default="{ $index }">
          <span class="table-number-badge">{{ number($index) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="store_name"
        label="当前门店"
        :min-width="getTextColumnMinWidth(['当前门店', ...rows.map(row => row.store_name)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="visible('brand_name')"
        prop="brand_name"
        label="实际品牌"
        :min-width="getTextColumnMinWidth(['实际品牌', ...rows.map(row => row.brand_name)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="visible('product_model')"
        prop="product_model"
        label="配件型号"
        :min-width="getTextColumnMinWidth(['配件型号', ...rows.map(row => row.product_model)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        label="剩余数量"
        prop="quantity"
        :min-width="getTextColumnMinWidth(['剩余数量', ...rows.map(row => row.quantity)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="visible('batch_no')"
        label="原采购批次"
        :min-width="getIdentifierColumnMinWidth(['原采购批次', ...rows.map(row => row.batch_no ?? '-')], { minWidth: 0 })"
        class-name="identifier-column"
      >
        <template #default="{ row }">
          {{ row.batch_no ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column
        label="来源核对"
        :min-width="getTextColumnMinWidth(['来源核对', ...rows.map(row => sourceText(row))], { minWidth: 0 })"
        class-name="complete-text-column"
      >
        <template #default="{ row }">
          {{ sourceText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visible('supplier_name')"
        prop="supplier_name"
        label="原供应商"
        :min-width="getTextColumnMinWidth(['原供应商', ...rows.map(row => row.supplier_name)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="visible('purchase_cost')"
        label="原采购单价"
        :min-width="getTextColumnMinWidth(['原采购单价', ...rows.map(row => costText(row))], { minWidth: 0 })"
        class-name="complete-text-column"
      >
        <template #default="{ row }">
          {{ costText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visible('usage_type')"
        label="库存用途"
        :min-width="getTextColumnMinWidth(['库存用途', ...rows.map(row => usageText(row))], { minWidth: 0 })"
        class-name="complete-text-column"
      >
        <template #default="{ row }">
          {{ usageText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visible('serial_tracking')"
        label="管理方式"
        :min-width="getTextColumnMinWidth(['管理方式', ...rows.map(row => trackingText(row))], { minWidth: 0 })"
        class-name="complete-text-column"
      >
        <template #default="{ row }">
          {{ trackingText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visible('inventory_time')"
        label="原入库时间"
        :min-width="getTextColumnMinWidth(['原入库时间', ...rows.map(row => dateText(row))], { minWidth: 0 })"
        class-name="complete-text-column"
      >
        <template #default="{ row }">
          {{ dateText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visible('operator_name')"
        prop="inventory_operator_name"
        label="原入库员"
        :min-width="getTextColumnMinWidth(['原入库员', ...rows.map(row => row.inventory_operator_name)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="canAdjust && !isMobile"
        label="操作"
        :width="actionColumnWidth"
        class-name="actions-column"
      >
        <template #default="{ row }">
          <div class="action-buttons">
            <el-button
              v-if="row.serial_tracking === 0 && row.source_status === 'purchase'"
              v-permission="'accessories:edit'"
              class="table-action table-action--transfer"
              :aria-label="`盘点${row.batch_no || '当前批次'}`"
              @click.stop="openAdjustment(row)"
            >
              盘点
            </el-button>
            <span v-else>-</span>
          </div>
        </template>
      </el-table-column>
      <template #empty>
        <DataEmptyState
          v-if="!loading"
          description="暂无剩余批次库存"
          size="compact"
        />
      </template>
    </el-table>
    <Pagination
      v-if="!failed"
      :current="page"
      :page-size="pageSize"
      :total="total"
      :disabled="loading"
      :show-page-sizes="false"
      @change="changePage"
    />
    <RecordDetailDialog
      v-model="detailVisible"
      title="当前批次库存详情"
      :record="detailRow"
      :fields="detailFields"
      :has-actions="canAdjust && detailRow?.serial_tracking === 0 && detailRow?.source_status === 'purchase'"
    >
      <template #actions="{ row }">
        <el-button
          v-if="row && row.serial_tracking === 0 && row.source_status === 'purchase'"
          v-permission="'accessories:edit'"
          class="tf-button--transfer"
          @click.stop="openAdjustment(row)"
        >
          盘点
        </el-button>
      </template>
    </RecordDetailDialog>
    <AccessoryInventoryAdjustmentModal
      v-if="canAdjust && adjustmentVisible && adjustmentRow"
      v-model="adjustmentVisible"
      :accessory-id="adjustmentRow.accessory_id"
      :accessory-name="accessoryName"
      :row="adjustmentRow"
      @success="handleAdjusted"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getAccessoryBatchStock } from '@/api/accessory-inventory'
import AccessoryInventoryAdjustmentModal from '@/components/AccessoryInventoryAdjustmentModal.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { getAdaptiveActionColumnWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import { canViewAccessoryField as visible, ACCESSORY_FIELD_IDS } from './accessory-field-permissions'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TIME_FORMATS } from '@/utils/time'
import { isMoneyInput } from '@/utils/security'
import { getRequestErrorMessage } from '@/utils/api-response'
import type { AccessoryBatchStock } from '@/types/accessory'
import type { RecordDetailField } from '@/types/component'

const props = defineProps<{ accessoryId: number; accessoryName?: string }>()
const emit = defineEmits<{ success: [] }>()
const { canView, canEdit } = usePagePermissions('accessories')
const canAdjust = computed(() => canEdit.value && ['name', 'distribution', 'total_quantity', 'purchase_cost',
  'batch_no', 'serial_tracking', 'usage_type', 'remarks', 'operations'].every(key => visible(key as keyof typeof ACCESSORY_FIELD_IDS)))
const accessoryName = computed(() => props.accessoryName || '商品')
const adjustmentVisible = ref(false)
const adjustmentRow = ref<AccessoryBatchStock | null>(null)
const actionColumnWidth = computed(() => getAdaptiveActionColumnWidth(rows.value, [{
  label: '盘点',
  visible: row => canEdit.value && visible('operations') && row.serial_tracking === 0 && row.source_status === 'purchase'
}]))
const openAdjustment = (row: AccessoryBatchStock) => {
  if (!canAdjust.value) return
  detailVisible.value = false
  adjustmentRow.value = row
  adjustmentVisible.value = true
}
const allowed = computed(() => canView.value && visible('distribution') && visible('total_quantity'))
const rows = ref<AccessoryBatchStock[]>([])
const includeZero = ref(false)
const page = ref(1), pageSize = 20, total = ref(0)
const loading = ref(false), failed = ref(false)
const failureMessage = ref('')
const requests = useLatestRequest()
const number = (index: number) => (page.value - 1) * pageSize + index + 1
const sourceText = (row: AccessoryBatchStock) => row.source_status === 'purchase' ? '已关联采购' : row.source_status === 'legacy' ? '历史来源待核对' : '未接续流水，来源待核对'
const usageText = (row: AccessoryBatchStock) => row.usage_type === 'sale' ? '收费' : row.usage_type === 'gift' ? '赠送' : row.usage_type === 'unclassified' ? '历史用途待核对' : '-'
const trackingText = (row: AccessoryBatchStock) => row.serial_tracking === 1 ? 'SN逐件' : row.serial_tracking === 0 ? '普通数量' : '待核对'
const costText = (row: AccessoryBatchStock) => row.purchase_cost === null ? '待核对' : `¥${formatAmount(row.purchase_cost)}`
const dateText = (row: AccessoryBatchStock) => row.inventory_time ? formatDateTime(row.inventory_time, TIME_FORMATS.DATETIME_MINUTE) : '-'
const load = async () => {
  if (!allowed.value || !Number.isSafeInteger(props.accessoryId) || props.accessoryId < 1) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  failureMessage.value = ''
  try {
    const response = includeZero.value
      ? await getAccessoryBatchStock(props.accessoryId, page.value, pageSize, request.signal, true)
      : await getAccessoryBatchStock(props.accessoryId, page.value, pageSize, request.signal)
    if (!request.isLatest()) return
    const result = response.data
    if (!response.success || !result || !Array.isArray(result.data) || !result.pagination ||
      result.pagination.page !== page.value || result.pagination.page_size !== pageSize ||
      !Number.isSafeInteger(result.pagination.total) || result.pagination.total < 0 ||
      result.data.length > pageSize || new Set(result.data.map(row => row?.row_key)).size !== result.data.length ||
      result.data.some(row => !row || typeof row.row_key !== 'string' || !row.row_key ||
        !Number.isSafeInteger(row.accessory_id) || row.accessory_id < 1 || !Number.isSafeInteger(row.store_id) || row.store_id < 1 ||
        !['number', 'string'].includes(typeof row.quantity) || !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < (includeZero.value ? 0 : 1) ||
        !['purchase', 'legacy', 'untracked'].includes(row.source_status) ||
        ![null, 'sale', 'gift', 'unclassified'].includes(row.usage_type) || ![null, 0, 1].includes(row.serial_tracking) ||
        (row.purchase_cost !== null && (!isMoneyInput(row.purchase_cost) || Number(row.purchase_cost) < 0)) ||
        [row.store_name, row.brand_name, row.product_model, row.batch_no, row.supplier_name, row.inventory_time, row.inventory_operator_name]
          .some(value => value !== null && typeof value !== 'string'))) throw new Error('批次库存响应不完整')
    const lastPage = Math.max(1, Math.ceil(result.pagination.total / pageSize))
    if (page.value > lastPage) { page.value = lastPage; await load(); return }
    if (result.data.length !== Math.min(pageSize, result.pagination.total - (page.value - 1) * pageSize)) throw new Error('批次库存分页不完整')
    rows.value = result.data
    total.value = result.pagination.total
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) {
      rows.value = []; total.value = 0; failed.value = true
      failureMessage.value = getRequestErrorMessage(error, '批次库存暂时读取失败，请稍后重试')
    }
  } finally { if (request.isLatest()) loading.value = false }
}
const changePage = (value: number) => { page.value = value; void load() }
const handleAdjusted = () => {
  emit('success')
  void load()
}
// 字段授权变化后重新读取，不能继续使用撤权前已下载的明细。
watch(() => [props.accessoryId, allowed.value, canEdit.value, ...Object.keys(ACCESSORY_FIELD_IDS).map(key => visible(key as keyof typeof ACCESSORY_FIELD_IDS))], () => {
  adjustmentVisible.value = false; adjustmentRow.value = null
  requests.cancelLatest(); rows.value = []; total.value = 0; page.value = 1; loading.value = false; failed.value = false; failureMessage.value = ''
  if (allowed.value) void load()
}, { immediate: true })

const { isMobile } = useMobile()
const { detailRow, detailVisible, doubleTapOptions: detailTapOptions, handleRowDoubleClick: detailDoubleClick } = useMobileTableDetail({
  enabled: () => isMobile.value && allowed.value, rows, getKey: row => row.row_key
})
const detailFields = computed<RecordDetailField[]>(() => {
  const row = detailRow.value
  return row ? [
    { key: 'store_name', label: '当前门店', value: row.store_name, visible: true },
    { key: 'brand_name', label: '实际品牌', value: row.brand_name, visible: visible('brand_name') },
    { key: 'product_model', label: '配件型号', value: row.product_model, visible: visible('product_model') },
    { key: 'quantity', label: '剩余数量', value: row.quantity, visible: true },
    { key: 'batch_no', label: '原采购批次', value: row.batch_no, visible: visible('batch_no'), wide: true },
    { key: 'source_status', label: '来源核对', value: sourceText(row), visible: true, wide: true },
    { key: 'supplier_name', label: '原供应商', value: row.supplier_name, visible: visible('supplier_name') },
    { key: 'purchase_cost', label: '原采购单价', value: costText(row), visible: visible('purchase_cost') },
    { key: 'usage_type', label: '库存用途', value: usageText(row), visible: visible('usage_type') },
    { key: 'serial_tracking', label: '管理方式', value: trackingText(row), visible: visible('serial_tracking') },
    { key: 'inventory_time', label: '原入库时间', value: dateText(row), visible: visible('inventory_time') },
    { key: 'inventory_operator_name', label: '原入库员', value: row.inventory_operator_name, visible: visible('operator_name') }
  ] : []
})
</script>
