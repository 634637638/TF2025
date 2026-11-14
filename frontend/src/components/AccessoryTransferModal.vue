<template>
  <MobileDialog
    :model-value="modelValue"
    title="库存划拨"
    width="680px"
    :close-on-click-modal="false"
    :show-default-footer="false"
    destroy-on-close
    @update:model-value="close"
  >
    <el-form
      v-tf-loading="{ active: loading, text: '正在查询可划拨库存...' }"
      class="tf-form-layout tf-form-grid"
      label-position="top"
      @submit.prevent="submit"
    >
      <el-alert
        v-if="failed"
        title="库存读取失败，请关闭后重新打开"
        type="error"
        :closable="false"
      />
      <el-form-item
        v-if="canViewAccessoryField('name')"
        label="商品"
      >
        <el-input
          :model-value="accessory.name"
          readonly
        />
      </el-form-item>
      <el-row :gutter="16">
        <el-col
          :xs="12"
          :sm="12"
        >
          <el-form-item label="来源店铺">
            <el-select
              v-model="fromStore"
              filterable
              placeholder="选择来源店铺"
              :disabled="saving"
              @change="changeSource"
            >
              <el-option
                v-for="store in sourceStores"
                :key="store.store_id"
                :value="Number(store.store_id)"
                :label="`${store.store_name}（剩余${store.quantity}）`"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col
          :xs="12"
          :sm="12"
        >
          <el-form-item label="接收店铺">
            <el-select
              v-model="toStore"
              filterable
              placeholder="选择接收店铺"
              :disabled="saving"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :value="Number(store.id)"
                :label="store.name"
                :disabled="Number(store.id) === fromStore"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item
        v-if="canViewAccessoryField('serial_number')"
        label="SN模式"
      >
        <el-switch
          v-model="serialMode"
          :disabled="saving"
          aria-label="划拨SN模式"
          @change="changeSource"
        />
      </el-form-item>
      <el-form-item
        v-if="!serialMode"
        label="划拨数量"
      >
        <el-input-number
          v-model="quantity"
          :min="1"
          :max="Math.max(available, 1)"
          :precision="0"
          :controls="false"
          :disabled="saving"
          aria-label="划拨数量"
        />
      </el-form-item>
      <el-form-item
        v-if="serialMode"
        label="划拨SN"
      >
        <el-select
          v-model="serials"
          multiple
          filterable
          remote
          reserve-keyword
          :remote-method="searchSerials"
          :loading="serialLoading"
          :disabled="!fromStore || saving"
          placeholder="搜索或扫描SN，支持多选"
          @visible-change="handleSerialDropdown"
        >
          <div
            v-infinite-scroll="loadMoreSerials"
            :infinite-scroll-disabled="serialLoading || serialFailed || serialResults.length >= serialTotal"
            :infinite-scroll-immediate="false"
          >
            <el-option
              v-for="serial in serialOptions"
              :key="serial"
              :value="serial"
              :label="serial"
            />
          </div>
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="canViewAccessoryField('remarks')"
        class="tf-form-field--wide"
        label="备注"
      >
        <el-input
          v-model="remarks"
          type="textarea"
          class="tf-textarea"
          :rows="2"
          :maxlength="500"
          :disabled="saving"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          :disabled="saving"
          @click="close(false)"
        >
          取消
        </el-button>
        <el-button
          v-permission="'accessories:transfer'"
          type="primary"
          :loading="saving"
          :disabled="!canSubmit"
          @click="submit"
        >
          确认划拨
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { getAccessoryEntryOptions } from '@/services/reference-options'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useNotification } from '@/composables/useNotification'
import { canViewAccessoryField } from './accessory-field-permissions'
import type { AccessoryRecord, AccessoryStoreStock, AccessorySerialRecord, AccessoryTransferInput, AccessorySettings } from '@/types/accessory'
import type { PaginatedResponse } from '@/types'
const props = defineProps<{ modelValue: boolean; accessory: AccessoryRecord }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; success: [] }>()
const { hasPermission, requirePermission } = usePagePermissions('accessories')
const notifications = useNotification()
const requests = useLatestRequest()
const serialRequests = useLatestRequest()
const fromStore = ref<number | null>(null)
const toStore = ref<number | null>(null)
const quantity = ref(1)
const remarks = ref('')
const serialMode = ref(false)
const serials = ref<string[]>([])
const serialResults = ref<string[]>([])
const serialOptions = computed(() => [...new Set([...serials.value, ...serialResults.value])])
const serialPage = ref(0)
const serialTotal = ref(0)
const serialKeyword = ref('')
const serialPageSize = 20
const serialFailed = ref(false)
const stores = ref<AccessorySettings['stores']>([])
const sourceStores = ref<AccessoryStoreStock[]>([])
const loading = ref(false)
const failed = ref(false)
const saving = ref(false)
const serialLoading = ref(false)
let requestKey = ''
const sourceStock = computed(() => sourceStores.value.find(store => Number(store.store_id) === fromStore.value))
const available = computed(() => Number((serialMode.value ? sourceStock.value?.serial_quantity : sourceStock.value?.plain_quantity) ?? 0))
const transferQuantity = computed(() => serialMode.value ? serials.value.length : quantity.value)
const canSubmit = computed(() => hasPermission('transfer') && !loading.value && !failed.value && !saving.value && !serialLoading.value &&
  ['name', 'distribution', 'total_quantity'].every(field => canViewAccessoryField(field as 'name' | 'distribution' | 'total_quantity')) &&
  fromStore.value && toStore.value && fromStore.value !== toStore.value && Number.isSafeInteger(transferQuantity.value) && transferQuantity.value > 0 && transferQuantity.value <= available.value &&
  (!serialMode.value || (canViewAccessoryField('serial_number') && serials.value.length > 0)))
const loadSerials = async (append = false) => {
  if (!props.modelValue || !hasPermission('transfer') || !canViewAccessoryField('serial_number') || !serialMode.value || !fromStore.value) return
  const request = serialRequests.nextRequest()
  const page = append ? serialPage.value + 1 : 1
  serialLoading.value = true
  serialFailed.value = false
  try {
    const response = await unifiedApi.get<Pick<PaginatedResponse<AccessorySerialRecord>, 'data'> & {
      pagination: Pick<PaginatedResponse['pagination'], 'total'>
    }>(`/accessories/${props.accessory.id}/serials`, {
      params: { search: serialKeyword.value, store_id: fromStore.value, stock_only: true, page, page_size: serialPageSize },
      signal: request.signal, useCache: false, showLoading: false, showError: false
    })
    if (!request.isLatest()) return
    const data = response.data
    if (!data || !Array.isArray(data.data) || !Number.isSafeInteger(data.pagination?.total) || data.pagination.total < 0) throw new Error('SN分页响应不完整')
    const rows = data.data.map(row => row.serial_number)
    serialResults.value = append ? [...new Set([...serialResults.value, ...rows])] : rows
    serialPage.value = page
    serialTotal.value = data.pagination.total
  } catch (error) {
    if (request.isLatest() && !serialRequests.isCanceledError(error)) {
      serialFailed.value = true
      notifications.error('SN读取失败，请重新搜索或重新打开下拉列表')
    }
  } finally { if (request.isLatest()) serialLoading.value = false }
}
const resetSerialSearch = () => {
  serialRequests.cancelLatest()
  serialLoading.value = false
  serialResults.value = []
  serialPage.value = 0
  serialTotal.value = 0
  serialKeyword.value = ''
  serialFailed.value = false
}
const searchSerials = async (search = '') => {
  resetSerialSearch()
  serialKeyword.value = search.trim()
  await loadSerials()
}
const loadMoreSerials = async () => {
  if (serialLoading.value || serialFailed.value || serialResults.value.length >= serialTotal.value) return
  await loadSerials(true)
}
const handleSerialDropdown = (opened: boolean) => {
  if (!opened || serialLoading.value) return
  if (serialFailed.value) void loadSerials(serialPage.value > 0)
  else if (!serialPage.value) void searchSerials()
}
const changeSource = () => { serials.value = []; void searchSerials() }
const load = async () => {
  const request = requests.nextRequest()
  loading.value = true
  serialMode.value = Number(props.accessory.serial_tracking) === 1
  failed.value = false
  sourceStores.value = []
  stores.value = []
  fromStore.value = toStore.value = null
  quantity.value = 1
  serials.value = []
  remarks.value = ''
  requestKey = [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('')
  try {
    if (!['name', 'distribution', 'total_quantity'].every(field => canViewAccessoryField(field as 'name' | 'distribution' | 'total_quantity'))) throw new Error('必要字段不可见')
    const [stock, options] = await Promise.all([
      unifiedApi.get<{ stores: AccessoryStoreStock[] }>(`/accessories/${props.accessory.id}/stock`, { params: { include_variants: false }, signal: request.signal, useCache: false, showLoading: false }),
      getAccessoryEntryOptions()
    ])
    if (!request.isLatest()) return
    if (!stock.data || !options.data) throw new Error('库存响应不完整')
    stores.value = options.data.stores.filter(store => store.id !== undefined && Number(store.status ?? 1) === 1).map(store => ({ id: Number(store.id), name: store.name || '', status: store.status }))
    sourceStores.value = stock.data.stores.filter(store => Number(store.quantity) > 0 && stores.value.some(option => Number(option.id) === Number(store.store_id)))
    if (sourceStores.value.length === 1) { fromStore.value = Number(sourceStores.value[0].store_id); await searchSerials() }
  } catch (error) { if (request.isLatest() && !requests.isCanceledError(error)) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}
const close = (value: boolean) => { if (!value && !saving.value) emit('update:modelValue', false) }
const submit = async () => {
  if (!requirePermission('transfer') || !canSubmit.value || !fromStore.value || !toStore.value) return
  const data: AccessoryTransferInput = { accessory_id: props.accessory.id, from_store_id: fromStore.value, to_store_id: toStore.value,
    quantity: transferQuantity.value, request_key: requestKey }
  if (serialMode.value) data.serial_numbers = [...serials.value]
  if (canViewAccessoryField('remarks')) data.remarks = remarks.value
  saving.value = true
  try {
    const response = await unifiedApi.post('/accessories/transfer', data)
    if (response.success === false) throw new Error('划拨失败')
    notifications.success('划拨成功，来源店已减库，接收店已加库')
    emit('success')
    emit('update:modelValue', false)
  } catch { /* 公共API展示错误；保留草稿与请求标识供失败重试。 */ }
  finally { saving.value = false }
}
watch(() => [props.modelValue, props.accessory.id] as const, ([visible]) => {
  resetSerialSearch()
  if (visible && hasPermission('transfer')) void load()
  else { requests.cancelLatest(); loading.value = false; sourceStores.value = []; serials.value = [] }
}, { immediate: true })
</script>
