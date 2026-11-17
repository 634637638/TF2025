<template>
  <MobileDialog
    :model-value="modelValue"
    title="库存盘点"
    dialog-class="crud-dialog-sm"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    :show-default-footer="false"
    destroy-on-close
    @update:model-value="close"
  >
    <el-alert
      title="盘点只调整当前门店的本批次结存，保留原采购、销售记录和历史成本。"
      type="info"
      :closable="false"
    />
    <dl class="tf-record-details">
      <div class="tf-record-details__field tf-record-details__field--wide">
        <dt>商品</dt>
        <dd>{{ accessoryName }}</dd>
      </div>
      <div class="tf-record-details__field">
        <dt>门店</dt>
        <dd>{{ row.store_name || '-' }}</dd>
      </div>
      <div class="tf-record-details__field">
        <dt>当前结存</dt>
        <dd>{{ currentQuantity }}</dd>
      </div>
      <div class="tf-record-details__field tf-record-details__field--wide">
        <dt>批次</dt>
        <dd>{{ row.batch_no || '-' }}</dd>
      </div>
    </dl>
    <el-form
      class="tf-form-layout tf-form-grid"
      label-position="top"
      @submit.prevent="submit"
    >
      <el-form-item
        label="盘点后实际数量"
        required
      >
        <el-input-number
          v-model="countedQuantity"
          :min="0"
          :max="999999"
          :precision="0"
          :controls="false"
          :disabled="saving || Boolean(pending)"
          aria-label="盘点后实际数量"
        />
      </el-form-item>
      <el-form-item
        class="tf-form-field--wide"
        label="盘点原因"
        required
      >
        <el-input
          v-model="reason"
          type="textarea"
          class="tf-textarea"
          :rows="3"
          maxlength="1000"
          show-word-limit
          :disabled="saving || Boolean(pending)"
          placeholder="请填写实物盘点差异原因"
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
          class="tf-button--transfer"
          :loading="saving"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ pending ? '重试原盘点' : '确认盘点' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { adjustAccessoryInventory } from '@/api/accessory-inventory'
import { createCheckoutKey } from '@/utils/sales-checkout'
import { getRequestErrorMessage } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
import type { AccessoryBatchStock, AccessoryInventoryAdjustmentInput } from '@/types/accessory'

const props = defineProps<{ modelValue: boolean; accessoryId: number; accessoryName?: string; row: AccessoryBatchStock }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; success: [] }>()
const notifications = useNotification()
const saving = ref(false)
const countedQuantity = ref(0)
const reason = ref('')
const pending = ref<AccessoryInventoryAdjustmentInput | null>(null)
let requestKey = ''
const currentQuantity = computed(() => Number(props.row.quantity))
const accessoryName = computed(() => props.accessoryName || '商品')
const canSubmit = computed(() => !saving.value && /^event:\d+$/.test(props.row.row_key) && Number.isSafeInteger(countedQuantity.value) && countedQuantity.value >= 0 && countedQuantity.value <= 999999 && reason.value.trim().length > 0)

const reset = () => {
  countedQuantity.value = currentQuantity.value
  reason.value = ''
  pending.value = null
  requestKey = createCheckoutKey()
}
const close = (value: boolean) => { if (!value && !saving.value) emit('update:modelValue', false) }
const submit = async () => {
  if (!canSubmit.value) return
  saving.value = true
  try {
    pending.value ||= { request_key: requestKey, row_key: props.row.row_key, expected_quantity: currentQuantity.value,
      counted_quantity: countedQuantity.value, reason: reason.value.trim() }
    const response = await adjustAccessoryInventory(props.accessoryId, { ...pending.value })
    const receipt = response.data
    if (!response.success || !receipt || receipt.accessory_id !== props.accessoryId ||
      !Number.isSafeInteger(receipt.store_id) || receipt.store_id !== props.row.store_id ||
      !Number.isSafeInteger(receipt.stock_in_id) || receipt.stock_in_id < 1 ||
      !(receipt.adjustment_id === null && receipt.unchanged === true && receipt.delta === 0 ||
        Number.isSafeInteger(receipt.adjustment_id) && Number(receipt.adjustment_id) > 0) ||
      receipt.counted_quantity !== pending.value.counted_quantity ||
      !Number.isSafeInteger(receipt.previous_quantity) || !Number.isSafeInteger(receipt.delta) ||
      receipt.delta !== receipt.counted_quantity - Number(receipt.previous_quantity) ||
      typeof receipt.replayed !== 'boolean') throw new Error('盘点响应不完整，请保留原内容重试核对')
    notifications.success(receipt.replayed ? '已核对原盘点结果' : receipt.unchanged ? '盘点完成，库存数量无差异' : '库存盘点完成')
    emit('success')
    emit('update:modelValue', false)
  } catch (error) {
    notifications.error(getRequestErrorMessage(error, '库存盘点失败，请保留原内容重试'))
  } finally { saving.value = false }
}
watch(() => [props.modelValue, props.row.row_key] as const, ([visible]) => { if (visible) reset() }, { immediate: true })
</script>

