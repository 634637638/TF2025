<template>
  <section
    v-if="canViewAccessoryField('serial_number')"
    class="detail-section"
  >
    <h3>SN序列号明细</h3>
    <el-form
      inline
      @submit.prevent="searchSerials"
    >
      <el-form-item label="SN序列号">
        <el-input
          v-model="keyword"
          clearable
          maxlength="100"
          placeholder="输入或扫描SN序列号"
          @clear="searchSerials"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          class="btn btn-primary"
          native-type="submit"
          :disabled="loading"
        >
          搜索
        </el-button>
        <el-button
          class="btn btn-secondary"
          :disabled="loading"
          @click="loadSerials"
        >
          刷新
        </el-button>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="failed"
      title="SN明细加载失败，请点击刷新重试"
      type="error"
      :closable="false"
    />
    <el-table
      v-table-double-tap="detailTapOptions"
      v-tf-loading="{ active: loading, text: '正在查询SN明细...' }"
      class="data-table"
      :data="rows"
      row-key="id"
      @row-dblclick="detailDoubleClick"
    >
      <el-table-column
        prop="serial_number"
        label="SN序列号"
        min-width="170"
      />
      <el-table-column
        v-if="canViewAccessoryField('status')"
        label="状态"
        min-width="90"
      >
        <template #default="{ row }">
          {{ statusText(row.status) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewAccessoryField('distribution')"
        prop="store_name"
        label="门店"
        min-width="110"
      />
      <el-table-column
        v-if="canViewAccessoryField('batch_no')"
        prop="batch_no"
        label="入库单号"
        min-width="180"
      />
      <el-table-column
        v-if="canViewAccessoryField('supplier_name')"
        prop="supplier_name"
        label="供应商"
        min-width="110"
      />
      <el-table-column
        v-if="canViewAccessoryField('purchase_cost')"
        label="进价"
        min-width="90"
      >
        <template #default="{ row }">
          {{ formatAmount(row.purchase_cost) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewAccessoryField('inventory_time')"
        label="入库时间"
        min-width="160"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.inventory_time, TIME_FORMATS.DATETIME_MINUTE) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewAccessoryField('operator_name')"
        prop="inventory_operator_name"
        label="入库员"
        min-width="100"
      />
      <el-table-column
        prop="sale_no"
        label="销售/赠送单号"
        min-width="180"
      />
      <el-table-column
        v-if="canViewAccessoryField('customer_name')"
        prop="customer_name"
        label="客户姓名"
        min-width="110"
      />
      <el-table-column
        v-if="canViewAccessoryField('customer_phone')"
        prop="customer_phone"
        label="客户手机号"
        min-width="140"
      />
      <el-table-column
        v-if="canViewAccessoryField('operator_name')"
        prop="operator_name"
        label="出库员"
        min-width="100"
      />
      <el-table-column
        v-if="canViewAccessoryField('created_at')"
        label="出库时间"
        min-width="160"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.sale_time, TIME_FORMATS.DATETIME_MINUTE) }}
        </template>
      </el-table-column>
      <template #empty>
        <DataEmptyState
          v-if="!loading"
          description="暂无SN记录"
          size="compact"
        />
      </template>
    </el-table>
    <Pagination
      :current="page"
      :page-size="pageSize"
      :page-sizes="[20, 50, 100]"
      :total="total"
      :disabled="loading"
      @current-change="changePage"
      @size-change="changeSize"
    />
    <RecordDetailDialog
      v-model="detailVisible"
      title="SN记录详情"
      :fields="detailFields"
      :record="detailRow"
      :has-actions="false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { unifiedApi } from '@/utils/unified-api'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TIME_FORMATS } from '@/utils/time'
import { canViewAccessoryField } from './accessory-field-permissions'
import type { AccessorySerialRecord } from '@/types/accessory'
import type { PaginatedResponse } from '@/types'

const props = defineProps<{ accessoryId: number }>()
const rows = ref<AccessorySerialRecord[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)
const failed = ref(false)
const requests = useLatestRequest()
const statusText = (status: AccessorySerialRecord['status']) => status === 'in_stock' ? '在库' : status === 'sold' ? '已销售' : status === 'gifted' ? '已赠送' : '-'
const loadSerials = async () => {
  if (!canViewAccessoryField('serial_number')) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  try {
    const response = await unifiedApi.get<Pick<PaginatedResponse<AccessorySerialRecord>, 'data'> & {
      pagination: Pick<PaginatedResponse['pagination'], 'total'>
    }>(`/accessories/${props.accessoryId}/serials`, {
      params: { search: keyword.value.trim(), page: page.value, page_size: pageSize.value },
      signal: request.signal, showLoading: false, useCache: false
    })
    if (!request.isLatest()) return
    if (!response.data) throw new Error('SN明细响应不完整')
    rows.value = response.data.data
    total.value = response.data.pagination.total
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) failed.value = true
  } finally {
    if (request.isLatest()) loading.value = false
  }
}
const searchSerials = () => { page.value = 1; void loadSerials() }
const changePage = (value: number) => { page.value = value; void loadSerials() }
const changeSize = (value: number) => { pageSize.value = value; searchSerials() }
watch(() => props.accessoryId, () => { rows.value = []; total.value = 0; keyword.value = ''; searchSerials() }, { immediate: true })

const { isMobile } = useMobile()
const { detailRow, detailVisible, doubleTapOptions: detailTapOptions, handleRowDoubleClick: detailDoubleClick } = useMobileTableDetail({
  enabled: () => isMobile.value && canViewAccessoryField('serial_number'), rows: rows, getKey: row => row.id
})
const detailFields = computed<RecordDetailField[]>(() => {
  const row = detailRow.value
  return row ? [
    { key: 'serial_number', label: 'SN序列号', value: row.serial_number, visible: true, wide: true },
    { key: 'status', label: '状态', value: statusText(row.status), visible: canViewAccessoryField('status') },
    { key: 'store_name', label: '门店', value: row.store_name, visible: canViewAccessoryField('distribution') },
    { key: 'batch_no', label: '入库单号', value: row.batch_no, visible: canViewAccessoryField('batch_no'), wide: true },
    { key: 'supplier_name', label: '供应商', value: row.supplier_name, visible: canViewAccessoryField('supplier_name') },
    { key: 'purchase_cost', label: '进价', value: formatAmount(row.purchase_cost), visible: canViewAccessoryField('purchase_cost') },
    { key: 'inventory_time', label: '入库时间', value: formatDateTime(row.inventory_time, TIME_FORMATS.DATETIME_MINUTE), visible: canViewAccessoryField('inventory_time') },
    { key: 'inventory_operator_name', label: '入库员', value: row.inventory_operator_name, visible: canViewAccessoryField('operator_name') },
    { key: 'sale_no', label: '销售/赠送单号', value: row.sale_no, visible: true, wide: true },
    { key: 'customer_name', label: '客户姓名', value: row.customer_name, visible: canViewAccessoryField('customer_name') },
    { key: 'customer_phone', label: '客户手机号', value: row.customer_phone, visible: canViewAccessoryField('customer_phone') },
    { key: 'operator_name', label: '出库员', value: row.operator_name, visible: canViewAccessoryField('operator_name') },
    { key: 'sale_time', label: '出库时间', value: formatDateTime(row.sale_time, TIME_FORMATS.DATETIME_MINUTE), visible: canViewAccessoryField('created_at') }
  ] : []
})
</script>
