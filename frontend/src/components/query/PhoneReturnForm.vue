<template>
  <el-alert
    v-if="!allowed"
    type="warning"
    title="缺少手机或关联商品售后必要权限，请联系管理员"
    :closable="false"
  />
  <SectionLoading
    v-else-if="loading"
    text="正在读取接收门店..."
  />
  <DataEmptyState
    v-else-if="failed"
    state="error"
    title="接收门店读取失败"
    action-text="重试"
    @action="loadStores"
  />
  <el-form
    v-else
    class="tf-dialog-form tf-dialog-form--stacked tf-form-layout tf-form-grid"
    label-position="top"
    :disabled="saving || uncertain"
    @submit.prevent="submit"
  >
    <h3>手机及关联商品退货</h3>
    <p>原单 {{ checklist.order_no }}。收费配件可保留或退回；未退赠品按原单约定扣款，后续退回按实际扣款退款。</p>
    <el-row :gutter="16">
      <el-col
        :xs="12"
        :sm="8"
      >
        <el-form-item
          label="接收门店"
          required
        >
          <el-select
            v-model="form.store_id"
            filterable
            aria-label="接收门店"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :value="Number(store.id)"
              :label="store.name"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col
        :xs="12"
        :sm="8"
      >
        <el-form-item
          label="退货原因"
          required
        >
          <el-select
            v-model="form.return_reason"
            aria-label="退货原因"
          >
            <el-option
              v-for="reason in RETURN_STOCK_OPTIONS.return_reason"
              :key="reason"
              :value="reason"
              :label="reason"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col
        :xs="24"
        :sm="8"
      >
        <el-form-item
          label="退货时间"
          required
        >
          <el-date-picker
            v-model="form.reversal_date"
            type="datetime"
            :value-format="TIME_FORMATS.DATETIME"
            aria-label="退货时间"
          />
        </el-form-item>
      </el-col>
    </el-row>
    <section
      v-for="(item, index) in checklist.accessories"
      :key="item.item_id"
    >
      <h4>{{ item.name || '-' }}（{{ item.sale_type === 'gift' ? '赠品' : '收费配件' }}）</h4>
      <p>原数量 {{ item.quantity }}，已退 {{ item.returned_quantity }}，剩余 {{ item.remaining_quantity }}。</p>
      <el-form-item
        v-if="item.available_serial_numbers?.length"
        label="本次退回SN"
      >
        <el-select
          v-model="form.accessories[index].serial_numbers"
          multiple
          filterable
          :aria-label="`${item.name}退回SN`"
        >
          <el-option
            v-for="sn in item.available_serial_numbers"
            :key="sn"
            :value="sn"
            :label="sn"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        v-else
        label="本次退回数量（0表示保留）"
      >
        <el-input-number
          v-model="form.accessories[index].quantity"
          :min="0"
          :max="item.remaining_quantity || 0"
          :precision="0"
          :controls="false"
          :aria-label="`${item.name}退回数量`"
        />
      </el-form-item>
      <template v-if="missingGift(index)">
        <el-alert
          v-if="item.gift_return_unit_price === null"
          type="warning"
          title="原单未约定赠品未退金额，请退回赠品后办理，不能按当前价格补算。"
          :closable="false"
        />
        <el-form-item v-else>
          <el-checkbox
            v-if="canGift"
            v-model="form.accessories[index].charge_confirmed"
          >
            确认 {{ missingGift(index) }} 件赠品未退，按原单约定扣款 ¥{{ formatAmount(missingGift(index) * (item.gift_return_unit_price || 0)) }}
          </el-checkbox>
          <el-alert
            v-else
            type="warning"
            title="没有赠品未退扣款确认权限，请退回赠品或由获权人员办理。"
            :closable="false"
          />
        </el-form-item>
      </template>
    </section>
    <el-form-item
      class="tf-form-field--wide"
      label="备注"
    >
      <el-input
        v-model="form.remarks"
        type="textarea"
        class="tf-textarea"
        :rows="2"
        :maxlength="200"
      />
    </el-form-item>
    <el-form-item class="tf-form-field--wide">
      <el-checkbox v-model="form.restock_confirmed">
        已核验手机及本次退回商品实物，可重新入库
      </el-checkbox>
    </el-form-item>
    <RecordDescriptions
      v-if="quote"
      :column="isMobile ? 1 : 2"
      border
      class="mb-4"
    >
      <el-descriptions-item label="原实付及已扣赠品应退">
        ¥{{ formatAmount(quote.base_refund_amount) }}
      </el-descriptions-item>
      <el-descriptions-item label="已用积分优惠追回">
        ¥{{ formatAmount(quote.points_recovery_amount) }}
      </el-descriptions-item>
      <el-descriptions-item label="已追回优惠补退">
        ¥{{ formatAmount(quote.points_compensation_amount) }}
      </el-descriptions-item>
      <el-descriptions-item label="未退赠品扣款">
        ¥{{ formatAmount(quote.gift_charge_amount) }}
      </el-descriptions-item>
      <el-descriptions-item label="账户积分变化">
        {{ quote.points_delta }}
      </el-descriptions-item>
      <el-descriptions-item label="本次应退款">
        ¥{{ formatAmount(quote.refund_amount) }}
      </el-descriptions-item>
      <el-descriptions-item label="客户需补差价">
        ¥{{ formatAmount(quote.collection_amount) }}
      </el-descriptions-item>
    </RecordDescriptions>
    <el-row
      v-if="quote && hasCash"
      :gutter="16"
    >
      <el-col
        :xs="12"
        :sm="12"
      >
        <el-form-item
          :label="quote.collection_amount ? '补款方式' : '退款方式'"
          required
        >
          <PaymentMethodSelect
            v-model="method"
            :variant="quote.collection_amount ? 'sale' : 'refund'"
            :placeholder="quote.collection_amount ? '请选择补款方式' : '请选择退款方式'"
            @update:model-value="channel = ''"
          />
        </el-form-item>
      </el-col>
      <el-col
        v-if="hasPaymentChannelOptions(method)"
        :xs="12"
        :sm="12"
      >
        <el-form-item
          label="支付渠道"
          required
        >
          <PaymentChannelSelect
            v-model="channel"
            :payment-method="method"
            placeholder="请选择支付渠道"
          />
        </el-form-item>
      </el-col>
    </el-row>
    <el-form-item
      v-if="quote && hasCash"
      class="tf-form-field--wide"
    >
      <el-checkbox v-model="paymentConfirmed">
        {{ quote.collection_amount ? '确认已收取客户需补差价' : '确认已按本次应退金额退款' }}
      </el-checkbox>
    </el-form-item>
    <el-alert
      v-if="uncertain"
      type="warning"
      title="提交结果未确认，请保留原内容和请求重试，避免重复办理。"
      :closable="false"
    />
  </el-form>
  <div class="tf-dialog-actions">
    <el-button
      :disabled="saving"
      @click="emit('cancel')"
    >
      取消
    </el-button>
    <el-button
      v-if="allowed"
      v-permission="'query:return-to-stock'"
      type="primary"
      :loading="quoting"
      :disabled="!canQuote"
      @click="calculate"
    >
      核对退款
    </el-button>
    <el-button
      v-if="allowed"
      v-permission="'query:return-to-stock'"
      type="danger"
      :loading="saving"
      :disabled="!canSubmit"
      @click="submit"
    >
      确认退货
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { quotePhoneReturn, submitPhoneReturn } from '@/api/sales-checkout'
import { getCachedStores, type ReferenceRecord } from '@/services/reference-options'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useNotification } from '@/composables/useNotification'
import { useMobile } from '@/composables/mobile'
import { canViewAccessoryField as visible, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import { createCheckoutKey, isPhoneReturnQuote, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { formatAmount } from '@/utils/format'
import { hasPaymentChannelOptions } from '@/constants/paymentMethods'
import { RETURN_STOCK_OPTIONS } from '@/constants/returnStock'
import type { PhoneReturnChecklist, PhoneReturnInput, PhoneReturnQuote } from '@/types/sales-checkout'

const props = defineProps<{ checklist: PhoneReturnChecklist }>()
const emit = defineEmits<{ cancel: []; success: []; busy: [value: boolean] }>()
const { canView, hasPermission } = usePagePermissions('query')
const { canView: canGoods, hasPermission: goodsPermission } = usePagePermissions('accessories')
const { isMobile } = useMobile(), notifications = useNotification()
const necessary: AccessoryFieldName[] = ['name', 'usage_type', 'distribution', 'total_quantity', 'unit_price', 'total_price', 'serial_number', 'created_at', 'remarks']
const allowed = computed(() => canView.value && hasPermission('return-to-stock') &&
  ['basic_info.sale_price', 'store_info.store_name', 'time_info.sale_time', 'other_info.remarks'].every(field => fieldPermissions.isFieldVisible('query_queryview', field)) &&
  (!props.checklist.accessories.length || canGoods.value && necessary.every(visible)))
const canGift = computed(() => goodsPermission('gift'))
const requests = useLatestRequest(), quotes = useLatestRequest()
const stores = ref<ReferenceRecord[]>([]), loading = ref(false), failed = ref(false), quoting = ref(false), saving = ref(false), uncertain = ref(false)
const quote = ref<PhoneReturnQuote | null>(null), method = ref(''), channel = ref(''), paymentConfirmed = ref(false)
const form = reactive({ store_id: null as number | null, return_reason: '', reversal_date: '', remarks: '', restock_confirmed: false,
  accessories: [] as Array<{ item_id: number; quantity: number; serial_numbers: string[]; charge_confirmed: boolean }> })
let requestKey = ''
const hasCash = computed(() => Boolean(quote.value && (quote.value.refund_amount || quote.value.collection_amount)))
const ready = computed(() => allowed.value && !loading.value && !failed.value && !saving.value && !quoting.value)
const canQuote = computed(() => ready.value && !uncertain.value)
const canSubmit = computed(() => ready.value && Boolean(quote.value) && (!hasCash.value || Boolean(method.value && paymentConfirmed.value && (!hasPaymentChannelOptions(method.value) || channel.value))))
const missingGift = (index: number) => {
  const item = props.checklist.accessories[index], row = form.accessories[index]
  return item.sale_type === 'gift' ? Math.max(0, (item.remaining_quantity || 0) - (item.serial_numbers?.length ? row.serial_numbers.length : row.quantity)) : 0
}
const invalidate = () => { quotes.cancelLatest(); quote.value = null; quoting.value = false; method.value = channel.value = ''; paymentConfirmed.value = false }
watch(form, invalidate, { deep: true, flush: 'sync' })
watch(saving, value => emit('busy', value), { flush: 'sync' })
const input = (): PhoneReturnInput => {
  if (!allowed.value || !form.store_id || !form.return_reason || !form.reversal_date || !form.restock_confirmed) throw new Error('请选择接收门店、原因和时间，并核验退回实物')
  return { request_key: requestKey, store_id: form.store_id, return_reason: form.return_reason, reversal_date: form.reversal_date,
    remarks: form.remarks.trim(), restock_confirmed: true, accessories: props.checklist.accessories.map((item, index) => {
      const row = form.accessories[index], quantity = item.serial_numbers?.length ? row.serial_numbers.length : row.quantity
      if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > (item.remaining_quantity || 0)) throw new Error('请核对商品退回数量或SN')
      const missing = Boolean(missingGift(index))
      if (missing && (item.gift_return_unit_price === null || !row.charge_confirmed || !canGift.value)) throw new Error('请退回赠品，或由获权人员核对原单约定并确认扣款')
      return { item_id: item.item_id, quantity, serial_numbers: [...row.serial_numbers].sort(), charge_missing: missing,
        charge_confirmed: missing && row.charge_confirmed }
    }) }
}
const calculate = async () => {
  if (!canQuote.value) return
  let payload: PhoneReturnInput
  try { payload = input() } catch (error) { notifications.warning(error instanceof Error ? error.message : '请核对退货资料'); return }
  invalidate(); const request = quotes.nextRequest(); quoting.value = true
  try {
    const response = await quotePhoneReturn(props.checklist.order_id, props.checklist.phone.sale_id, payload, request.signal)
    if (!request.isLatest()) return
    if (!response.success || !isPhoneReturnQuote(response.data, props.checklist, payload)) { notifications.warning('售后核对结果不完整，请重新核对'); return }
    quote.value = response.data
  } catch { /* 统一API提示业务错误。 */ }
  finally { if (request.isLatest()) quoting.value = false }
}
const submit = async () => {
  if (!canSubmit.value || !quote.value) return
  let payload: PhoneReturnInput
  try { payload = input() } catch (error) { notifications.warning(error instanceof Error ? error.message : '请核对退货资料'); return }
  payload.settlement = { refund_amount: quote.value.refund_amount, collection_amount: quote.value.collection_amount,
    method: hasCash.value ? method.value : null, channel: hasCash.value && hasPaymentChannelOptions(method.value) ? channel.value : null,
    confirmed: hasCash.value ? paymentConfirmed.value : true }
  saving.value = true
  try {
    const response = await submitPhoneReturn(props.checklist.order_id, props.checklist.phone.sale_id, payload)
    if (!response.success || !isPhoneReturnQuote(response.data, props.checklist, payload) || !Number.isSafeInteger(response.data.aftersale_id) || response.data.aftersale_id < 1) { uncertain.value = true; return }
    notifications.success('手机及关联商品退货已记录'); emit('success')
  } catch (error) {
    if (!uncertain.value && isCheckoutSubmissionRejected(error)) {
      invalidate()
    } else uncertain.value = true
  }
  finally { saving.value = false }
}
const loadStores = async () => {
  if (!allowed.value) return
  const request = requests.nextRequest(); loading.value = true; failed.value = false
  try {
    const result = await getCachedStores(true)
    if (!request.isLatest()) return
    if (!Array.isArray(result.data)) throw new Error('门店资料不完整')
    stores.value = result.data
  } catch { if (request.isLatest()) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}
watch([() => props.checklist, allowed], () => {
  requests.cancelLatest(); invalidate(); stores.value = []; failed.value = false; loading.value = false; uncertain.value = false
  requestKey = createCheckoutKey()
  Object.assign(form, { store_id: props.checklist.store_id, return_reason: '', reversal_date: TimeUtil.nowFormatted(TIME_FORMATS.DATETIME),
    remarks: '', restock_confirmed: false, accessories: props.checklist.accessories.map(item => ({ item_id: item.item_id,
      quantity: item.sale_type === 'gift' ? item.remaining_quantity || 0 : 0,
      serial_numbers: item.sale_type === 'gift' ? [...item.available_serial_numbers || []] : [], charge_confirmed: false })) })
  if (allowed.value) void loadStores()
}, { immediate: true })
</script>
