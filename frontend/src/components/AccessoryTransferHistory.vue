<template>
  <section
    v-if="canViewAccessoryField('distribution')"
    class="detail-section"
  >
    <div class="flex items-center justify-between gap-2 mb-3">
      <h3 class="m-0">
        库存划拨记录
      </h3>
      <div class="tf-dialog-toolbar">
        <el-button
          class="tf-button--refresh"
          :loading="loading"
          :disabled="loading"
          @click="load"
        >
          刷新
        </el-button>
      </div>
    </div>
    <el-alert
      v-if="failed"
      type="error"
      title="划拨记录读取失败，请刷新重试"
      :closable="false"
    />
    <el-table
      v-table-double-tap="detailTapOptions"
      v-tf-loading="{ active: loading, text: '正在读取划拨记录...' }"
      :data="rows"
      class="data-table"
      row-key="id"
      @row-dblclick="detailDoubleClick"
    >
      <el-table-column
        label="单号"
        :width="$getNumberColumnWidth(rows.map(row => row.id))"
        align="center"
      >
        <template #default="{ row }">
          <span class="table-number-badge">{{ row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="from_store_name"
        label="来源店"
        :min-width="getTextColumnMinWidth(['来源店', ...rows.map(row => row.from_store_name)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        prop="to_store_name"
        label="接收店"
        :min-width="getTextColumnMinWidth(['接收店', ...rows.map(row => row.to_store_name)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="canViewAccessoryField('total_quantity')"
        prop="quantity"
        label="数量"
        :min-width="getTextColumnMinWidth(['数量', ...rows.map(row => row.quantity)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="canViewAccessoryField('serial_number')"
        label="SN"
        :min-width="getIdentifierColumnMinWidth(['SN', ...rows.map(row => row.serial_numbers?.join('、') || '-')], { minWidth: 0 })"
        class-name="identifier-column"
      >
        <template #default="{ row }">
          {{ row.serial_numbers?.join('、') || '-' }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewAccessoryField('operator_name')"
        prop="operator_name"
        label="操作员"
        :min-width="getTextColumnMinWidth(['操作员', ...rows.map(row => row.operator_name)], { minWidth: 0 })"
        class-name="complete-text-column"
      />
      <el-table-column
        v-if="canViewAccessoryField('created_at')"
        label="时间"
        :min-width="getTextColumnMinWidth(['时间', ...rows.map(row => formatDateTime(row.created_at, TIME_FORMATS.DATETIME_MINUTE))], { minWidth: 0 })"
        class-name="complete-text-column"
      >
        <template #default="{ row }">
          {{ formatDateTime(row.created_at, TIME_FORMATS.DATETIME_MINUTE) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="canViewAccessoryField('remarks')"
        prop="remarks"
        label="备注"
        :min-width="getTextColumnMinWidth(['备注', ...rows.map(row => row.remarks)], { minWidth: 0, maxWidth: 240 })"
        class-name="complete-text-column wrapped-text-column"
      />
      <template #empty>
        <TableLoadingRow
          v-if="loading"
          mode="block"
          text="正在读取划拨记录..."
        />
        <DataEmptyState
          v-else
          description="暂无库存划拨记录"
          size="compact"
        />
      </template>
    </el-table>
    <Pagination
      :current="page"
      :page-size="20"
      :total="total"
      :disabled="loading"
      :show-page-sizes="false"
      @change="changePage"
    />
    <RecordDetailDialog
      v-model="detailVisible"
      title="库存划拨详情"
      :fields="detailFields"
      :record="detailRow"
      :has-actions="false"
    />
  </section>
</template>
<script setup lang="ts">
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { computed, ref, watch } from 'vue'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { unifiedApi } from '@/utils/unified-api'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { formatDateTime } from '@/utils/format'
import { TIME_FORMATS } from '@/utils/time'
import { canViewAccessoryField } from './accessory-field-permissions'
import type { AccessoryTransferRecord } from '@/types/accessory'
const props = defineProps<{ accessoryId: number }>()
const rows = ref<AccessoryTransferRecord[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const failed = ref(false)
const requests = useLatestRequest()
const load = async () => {
  if (!canViewAccessoryField('distribution')) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  try {
    const response = await unifiedApi.get<{ data: AccessoryTransferRecord[]; pagination: { total: number } }>(`/accessories/${props.accessoryId}/transfers`, {
      params: { page: page.value, page_size: 20 }, signal: request.signal, useCache: false, showLoading: false
    })
    if (!request.isLatest()) return
    if (!response.data) throw new Error('划拨响应不完整')
    rows.value = response.data.data
    total.value = response.data.pagination.total
  } catch (error) { if (request.isLatest() && !requests.isCanceledError(error)) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}
const changePage = (value: number) => { page.value = value; void load() }
watch(() => props.accessoryId, () => { page.value = 1; rows.value = []; total.value = 0; void load() }, { immediate: true })

const { isMobile } = useMobile()
const { detailRow, detailVisible, doubleTapOptions: detailTapOptions, handleRowDoubleClick: detailDoubleClick } = useMobileTableDetail({
  enabled: () => isMobile.value && canViewAccessoryField('distribution'), rows: rows, getKey: row => row.id
})
const detailFields = computed<RecordDetailField[]>(() => {
  const row = detailRow.value
  return row ? [
    { key: 'id', label: '单号', value: row.id, visible: true },
    { key: 'from_store_name', label: '来源店', value: row.from_store_name, visible: true },
    { key: 'to_store_name', label: '接收店', value: row.to_store_name, visible: true },
    { key: 'quantity', label: '数量', value: row.quantity, visible: canViewAccessoryField('total_quantity') },
    { key: 'serial_numbers', label: 'SN', value: row.serial_numbers?.join('、'), visible: canViewAccessoryField('serial_number'), wide: true },
    { key: 'operator_name', label: '操作员', value: row.operator_name, visible: canViewAccessoryField('operator_name') },
    { key: 'created_at', label: '时间', value: formatDateTime(row.created_at, TIME_FORMATS.DATETIME_MINUTE), visible: canViewAccessoryField('created_at') },
    { key: 'remarks', label: '备注', value: row.remarks, visible: canViewAccessoryField('remarks'), wide: true }
  ] : []
})
</script>
