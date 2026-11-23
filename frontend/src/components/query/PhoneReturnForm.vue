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
    <h3>商品退货门店</h3>
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
        v-for="field in handlingFields"
        :key="field.key"
        :xs="12"
        :sm="8"
      >
        <el-form-item
          :label="field.label"
          required
        >
          <el-select
            v-model="form[field.key]"
            :aria-label="field.label"
          >
            <el-option
              v-for="option in RETURN_STOCK_OPTIONS[field.key]"
              :key="option"
              :value="option"
              :label="option"
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
        已核对被退回的手机及商品
      </el-checkbox>
    </el-form-item>
    <section
      v-if="quote"
      class="return-settlement-card"
      aria-label="退款核对结果"
    >
      <div class="return-settlement-card__heading">
        <div>
          <span class="return-settlement-card__eyebrow">售后结算</span>
          <h4>退款核对结果</h4>
        </div>
        <i
          class="fas fa-receipt"
          aria-hidden="true"
        />
      </div>
      <div class="return-settlement-card__grid">
        <div class="return-settlement-item">
          <span>原订单金额</span>
          <strong>¥{{ formatAmount(quote.base_refund_amount) }}</strong>
        </div>
        <div class="return-settlement-item">
          <span>积分追回</span>
          <strong class="is-expense">¥{{ formatAmount(quote.points_recovery_amount) }}</strong>
        </div>
        <div class="return-settlement-item">
          <span>优惠补退金额</span>
          <strong class="is-income">¥{{ formatAmount(quote.points_compensation_amount) }}</strong>
        </div>
        <div class="return-settlement-item">
          <span>赠品扣款</span>
          <strong class="is-expense">¥{{ formatAmount(quote.gift_charge_amount) }}</strong>
        </div>
        <div class="return-settlement-item">
          <span>账户积分变化</span>
          <strong class="is-points">{{ quote.points_delta }} 积分</strong>
        </div>
      </div>
      <div class="return-settlement-card__result">
        <div
          class="return-settlement-result"
          :class="{ 'is-refund': quote.refund_amount > 0 }"
        >
          <span>本次应退款</span>
          <strong>¥{{ formatAmount(quote.refund_amount) }}</strong>
        </div>
        <div
          class="return-settlement-result"
          :class="{ 'is-collection': quote.collection_amount > 0 }"
        >
          <span>客户补差价</span>
          <strong>¥{{ formatAmount(quote.collection_amount) }}</strong>
        </div>
      </div>
    </section>
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
        {{ quote.collection_amount ? '确认已收取客户补差价' : '确认已按本次应退金额退款' }}
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
      价格核算
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
import { getStores, type ReferenceRecord } from '@/services/reference-options'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useGoodsPermissions } from '@/composables/useGoodsPermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useNotification } from '@/composables/useNotification'
import { canViewQueryGoodsField as visible, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import { createCheckoutKey, isPhoneReturnQuote, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { formatAmount } from '@/utils/format'
import { hasPaymentChannelOptions } from '@/constants/paymentMethods'
import { RETURN_STOCK_OPTIONS } from '@/constants/returnStock'
import type { PhoneReturnAccessoryDraft, PhoneReturnChecklist, PhoneReturnInput, PhoneReturnQuote } from '@/types/sales-checkout'

const props = defineProps<{ checklist: PhoneReturnChecklist; accessories: PhoneReturnAccessoryDraft[] }>()
const emit = defineEmits<{ cancel: []; success: []; busy: [value: boolean] }>()
const { canView, hasPermission } = usePagePermissions('query')
const { canGift } = useGoodsPermissions()
const notifications = useNotification()
const necessary: AccessoryFieldName[] = ['name', 'usage_type', 'distribution', 'total_quantity', 'unit_price', 'total_price', 'serial_number', 'created_at', 'remarks']
const allowed = computed(() => canView.value && hasPermission('return-to-stock') &&
  ['basic_info.sale_price', 'store_info.store_name', 'time_info.sale_time', 'other_info.remarks'].every(field => fieldPermissions.isFieldVisible('query_queryview', field)) &&
  (!props.checklist.accessories.length || hasPermission('goods-view') && necessary.every(visible)))
const requests = useLatestRequest(), quotes = useLatestRequest()
const stores = ref<ReferenceRecord[]>([]), loading = ref(false), failed = ref(false), quoting = ref(false), saving = ref(false), uncertain = ref(false)
const quote = ref<PhoneReturnQuote | null>(null), method = ref(''), channel = ref(''), paymentConfirmed = ref(false)
const handlingFields = [{ key: 'return_type', label: '退货类型' }, { key: 'handle_method', label: '处理方式' }] as const
const form = reactive({ store_id: null as number | null, return_reason: '', return_type: '退货处理', handle_method: '重新入库', reversal_date: '', remarks: '', restock_confirmed: false })
let requestKey = ''
const hasCash = computed(() => Boolean(quote.value && (quote.value.refund_amount || quote.value.collection_amount)))
const ready = computed(() => allowed.value && !loading.value && !failed.value && !saving.value && !quoting.value)
const canQuote = computed(() => ready.value && !uncertain.value)
const canSubmit = computed(() => ready.value && Boolean(quote.value) && (!hasCash.value || Boolean(method.value && paymentConfirmed.value && (!hasPaymentChannelOptions(method.value) || channel.value))))
const invalidate = () => { quotes.cancelLatest(); quote.value = null; quoting.value = false; method.value = channel.value = ''; paymentConfirmed.value = false }
watch(form, invalidate, { deep: true, flush: 'sync' })
watch(() => props.accessories, invalidate, { deep: true, flush: 'sync' })
watch(saving, value => emit('busy', value), { flush: 'sync' })
const input = (): PhoneReturnInput => {
  if (!allowed.value || !form.store_id || !form.return_reason || !form.return_type || !form.handle_method || !form.reversal_date || !form.restock_confirmed) throw new Error('请选择接收门店、原因、退货类型、处理方式和时间，并核验退回实物')
  return { request_key: requestKey, store_id: form.store_id, return_reason: form.return_reason, return_type: form.return_type, handle_method: form.handle_method, reversal_date: form.reversal_date,
    remarks: form.remarks.trim(), restock_confirmed: true, accessories: props.checklist.accessories.map(item => {
      const row = props.accessories.find(draft => draft.item_id === item.item_id)
      if (!row) throw new Error('原单商品退回信息不完整，请刷新重试')
      const quantity = item.serial_numbers?.length ? row.serial_numbers.length : row.quantity
      if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > (item.remaining_quantity || 0)) throw new Error('请核对商品退回数量或SN')
      const missing = item.sale_type === 'gift' && (item.remaining_quantity || 0) - quantity > 0
      if (missing && (item.gift_return_unit_price === null || !canGift.value)) throw new Error('请退回赠品，或由获权人员按原单约定办理扣款')
      return { item_id: item.item_id, quantity, serial_numbers: [...row.serial_numbers].sort(), charge_missing: missing,
        charge_confirmed: missing }
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
    const result = await getStores({ strictScope: true })
    if (!request.isLatest()) return
    if (!Array.isArray(result.data)) throw new Error('门店资料不完整')
    stores.value = result.data
  } catch { if (request.isLatest()) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}
watch([() => props.checklist, allowed], () => {
  requests.cancelLatest(); invalidate(); stores.value = []; failed.value = false; loading.value = false; uncertain.value = false
  requestKey = createCheckoutKey()
  Object.assign(form, { store_id: props.checklist.store_id, return_reason: '', return_type: '退货处理', handle_method: '重新入库', reversal_date: TimeUtil.nowFormatted(TIME_FORMATS.DATETIME),
    remarks: '', restock_confirmed: false })
  if (allowed.value) void loadStores()
}, { immediate: true })
</script>

<style lang="scss" scoped>
.return-settlement-card {
  margin-bottom: var(--tf-space-4);
  padding: var(--tf-space-4);
  border: 1px solid var(--tf-color-slate-200);
  border-radius: var(--tf-radius-control);
  background: var(--tf-color-slate-50);
}

.return-settlement-card__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tf-space-3);
  padding-bottom: var(--tf-space-3);
  border-bottom: 1px solid var(--tf-color-slate-200);

  h4 {
    margin: var(--tf-space-1) 0 0;
    color: var(--tf-color-slate-900);
    font-size: var(--tf-type-scale-16);
  }

  > i {
    color: var(--tf-color-blue-600);
    font-size: var(--tf-type-scale-18);
  }
}

.return-settlement-card__eyebrow {
  color: var(--tf-color-slate-500);
  font-size: var(--tf-type-scale-12);
  font-weight: 600;
}

.return-settlement-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--tf-space-5);
  padding: var(--tf-space-3) 0;
}

.return-settlement-item,
.return-settlement-result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--tf-space-3);
  min-width: 0;
  padding: var(--tf-space-2) 0;

  span {
    color: var(--tf-color-slate-600);
    line-height: 1.4;
  }

  strong {
    flex-shrink: 0;
    color: var(--tf-color-slate-900);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .is-income,
  &.is-refund strong {
    color: var(--tf-color-success-text-strong);
  }

  .is-expense,
  &.is-collection strong {
    color: var(--tf-color-red-600);
  }

  .is-points {
    color: var(--tf-color-blue-600);
  }
}

.return-settlement-card__result {
  padding-top: var(--tf-space-2);
  border-top: 1px solid var(--tf-color-slate-200);
}

.return-settlement-result {
  margin: 0;
  padding: var(--tf-space-3);
  border-radius: var(--tf-radius-control);
  background: var(--color-bg-white);

  span {
    color: var(--tf-color-slate-700);
    font-weight: 700;
  }

  strong {
    font-size: var(--tf-type-scale-18);
  }
}

@media (max-width: 479px) {
  .return-settlement-card {
    padding: var(--tf-space-3);
  }

  .return-settlement-card__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
