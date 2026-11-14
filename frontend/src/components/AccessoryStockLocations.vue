<template>
  <section
    v-if="canViewAccessoryField('distribution')"
    class="detail-section"
  >
    <h3>店铺库存位置</h3>
    <el-button
      :disabled="loading"
      @click="loadLocations"
    >
      刷新店铺库存
    </el-button>
    <el-alert
      v-if="failed"
      title="店铺库存读取失败，请刷新重试"
      type="error"
      :closable="false"
    />
    <el-table
      v-table-double-tap="detailTapOptions"
      v-tf-loading="{ active: loading, text: '正在查询店铺库存...' }"
      :data="stores"
      class="data-table"
      row-key="store_id"
      @row-dblclick="detailDoubleClick"
    >
      <el-table-column
        prop="store_name"
        label="店铺"
        min-width="140"
      />
      <el-table-column
        v-if="canViewAccessoryField('total_quantity')"
        prop="quantity"
        label="剩余数量"
        min-width="100"
      />
      <el-table-column
        v-if="canViewAccessoryField('total_quantity') && canViewAccessoryField('serial_number')"
        prop="serial_quantity"
        label="SN库存"
        min-width="100"
      />
      <el-table-column
        v-if="canViewAccessoryField('total_quantity')"
        prop="plain_quantity"
        label="普通库存"
        min-width="100"
      />
      <template #empty>
        <DataEmptyState
          v-if="!loading"
          description="暂无可查看的店铺库存"
          size="compact"
        />
      </template>
    </el-table>
    <RecordDetailDialog
      v-model="detailVisible"
      title="店铺库存详情"
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
import { canViewAccessoryField } from './accessory-field-permissions'
import type { AccessoryStoreStock } from '@/types/accessory'
const props = defineProps<{ accessoryId: number }>()
const stores = ref<AccessoryStoreStock[]>([])
const loading = ref(false)
const failed = ref(false)
const requests = useLatestRequest()
const loadLocations = async () => {
  if (!canViewAccessoryField('distribution')) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  try {
    const response = await unifiedApi.get<{ stores: AccessoryStoreStock[] }>(`/accessories/${props.accessoryId}/stock`, { signal: request.signal, showLoading: false, useCache: false })
    if (!request.isLatest()) return
    if (!response.data) throw new Error('店铺库存响应不完整')
    stores.value = response.data.stores
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) failed.value = true
  } finally { if (request.isLatest()) loading.value = false }
}
watch(() => props.accessoryId, () => { stores.value = []; void loadLocations() }, { immediate: true })

const { isMobile } = useMobile()
const { detailRow, detailVisible, doubleTapOptions: detailTapOptions, handleRowDoubleClick: detailDoubleClick } = useMobileTableDetail({
  enabled: () => isMobile.value && canViewAccessoryField('distribution'), rows: stores, getKey: row => row.store_id
})
const detailFields = computed<RecordDetailField[]>(() => {
  const row = detailRow.value
  return row ? [
    { key: 'store_name', label: '店铺', value: row.store_name, visible: true },
    { key: 'quantity', label: '剩余数量', value: row.quantity, visible: canViewAccessoryField('total_quantity') },
    { key: 'serial_quantity', label: 'SN库存', value: row.serial_quantity, visible: canViewAccessoryField('total_quantity') && canViewAccessoryField('serial_number') },
    { key: 'plain_quantity', label: '普通库存', value: row.plain_quantity, visible: canViewAccessoryField('total_quantity') }
  ] : []
})
</script>
