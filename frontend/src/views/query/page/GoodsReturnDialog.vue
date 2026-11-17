<template>
  <MobileDialog
    :model-value="modelValue"
    :title="isExchange ? '商品换货' : '商品退货'"
    dialog-class="crud-dialog-lg"
    :show-default-footer="false"
    :close-on-click-modal="false"
    :before-close="beforeClose"
    destroy-on-close
    @update:model-value="close"
  >
    <SectionLoading
      v-if="loading"
      text="正在核对原单可退商品..."
    />
    <el-alert
      v-else-if="failed"
      type="error"
      :title="`${actionName}资料读取失败，请关闭后重试`"
      :closable="false"
    />
    <el-alert
      v-else-if="!canOperate"
      type="warning"
      :title="`缺少${actionName}必要权限，请联系管理员`"
      :closable="false"
    />
    <el-form
      v-else-if="context"
      class="tf-dialog-form tf-dialog-form--stacked tf-form-layout tf-form-grid"
      label-position="top"
      :disabled="saving || uncertain"
      @submit.prevent="submit"
    >
      <RecordDescriptions
        :column="3"
        border
        class="mb-4"
      >
        <el-descriptions-item label="商品">
          {{ context.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="原单数量">
          {{ context.quantity }}
        </el-descriptions-item>
        <el-descriptions-item label="剩余可退">
          {{ context.remaining_quantity }}
        </el-descriptions-item>
      </RecordDescriptions>
      <el-row :gutter="16">
        <el-col
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="退回门店"
            required
          >
            <el-select
              v-model="form.store_id"
              filterable
              aria-label="退回门店"
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
          :sm="6"
        >
          <el-form-item
            label="退货数量"
            required
          >
            <el-input-number
              v-if="!context.serial_tracking"
              v-model="form.quantity"
              :min="1"
              :max="Math.max(1, context.remaining_quantity)"
              :precision="0"
              :controls="false"
              aria-label="退货数量"
            />
            <el-input
              v-else
              :model-value="form.serial_numbers.length"
              readonly
              aria-label="SN退货数量"
            />
          </el-form-item>
        </el-col>
        <el-col
          :xs="12"
          :sm="6"
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
          :xs="12"
          :sm="6"
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
      <el-row
        v-if="isExchange"
        :gutter="16"
      >
        <el-col
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="新商品销售员"
            required
          >
            <el-select
              v-model="form.operator_id"
              filterable
              remote
              :remote-method="searchSellers"
              :loading="sellerLoading"
              aria-label="新商品销售员"
            >
              <el-option
                v-for="operator in operators"
                :key="operator.id"
                :value="Number(operator.id)"
                :label="String(operator.name || operator.username || '')"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item
        v-if="context.serial_tracking"
        label="本次退回SN"
        required
      >
        <el-select
          v-model="form.serial_numbers"
          multiple
          filterable
          placeholder="检索并选择实际退回的原单SN"
          aria-label="本次退回SN"
        >
          <el-option
            v-for="sn in context.serial_numbers"
            :key="sn"
            :value="sn"
            :label="sn"
          />
        </el-select>
      </el-form-item>
      <template v-if="isExchange">
        <el-alert
          v-if="exchangeContext?.gift_charge_settled"
          type="info"
          title="该赠品已结清未退扣款，本次按原实际扣款抵付；换入商品按收费商品办理。"
          :closable="false"
          class="mb-4"
        />
        <h3>换入商品</h3>
        <SalesGoodsLine
          v-model="replacement"
          :store-id="form.store_id"
          :phones="[]"
          :disabled="saving || uncertain"
          field-source="query"
          :exchange-quantity="returnQuantity"
        />
      </template>
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
          已核验退回实物，可重新入库
        </el-checkbox>
      </el-form-item>
      <el-alert
        v-if="!context.remaining_quantity"
        type="info"
        title="原单商品已全部退回"
        :closable="false"
      />
      <RecordDescriptions
        v-if="quote"
        :column="2"
        border
        class="mb-4"
      >
        <el-descriptions-item label="原实付应退">
          ¥{{ formatAmount(quote.base_refund_amount) }}
        </el-descriptions-item>
        <el-descriptions-item label="已用积分优惠追回">
          ¥{{ formatAmount(quote.points_recovery_amount) }}
        </el-descriptions-item>
        <el-descriptions-item label="已追回优惠补退">
          ¥{{ formatAmount(quote.points_compensation_amount) }}
        </el-descriptions-item>
        <el-descriptions-item label="积分余额变化">
          {{ quote.points_delta }}
        </el-descriptions-item>
        <template v-if="exchangeQuote">
          <el-descriptions-item label="新件净应付">
            ¥{{ formatAmount(exchangeQuote.replacement_amount) }}
          </el-descriptions-item>
          <el-descriptions-item label="原件抵付新件">
            ¥{{ formatAmount(Math.max(0, exchangeQuote.replacement_amount - exchangeQuote.collection_amount)) }}
          </el-descriptions-item>
          <el-descriptions-item label="新件抵扣积分">
            {{ exchangeQuote.points_used }}
          </el-descriptions-item>
          <el-descriptions-item label="新件累计积分">
            {{ exchangeQuote.points_earned }}
          </el-descriptions-item>
          <el-descriptions-item label="新件分配实收">
            ¥{{ formatAmount(exchangeQuote.replacement_paid_amount) }}
          </el-descriptions-item>
          <el-descriptions-item label="原单另需补款">
            ¥{{ formatAmount(exchangeQuote.original_collection_amount) }}
          </el-descriptions-item>
        </template>
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
        title="提交结果未确认，请保留原内容重试，避免重复办理。"
        :closable="false"
      />
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
          v-permission="actionPermission"
          type="primary"
          :loading="quoting"
          :disabled="!canQuote"
          @click="calculate"
        >
          {{ isExchange ? '核对换货差价' : '核对退款' }}
        </el-button>
        <el-button
          v-permission="actionPermission"
          type="danger"
          :loading="saving"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ isExchange ? '确认换货' : '确认退货' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { getGoodsReturnContext, quoteGoodsReturn, submitGoodsReturn, getGoodsExchangeContext, quoteGoodsExchange, submitGoodsExchange } from '@/api/sales-checkout'
import { getStores, searchOperators, type ReferenceRecord } from '@/services/reference-options'
import { useGoodsPermissions } from '@/composables/useGoodsPermissions'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useNotification } from '@/composables/useNotification'
import { canViewQueryGoodsField as visible, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import { createCheckoutKey, isCheckoutSubmissionRejected, buildCheckoutGoods, isGoodsReturnContext, isGoodsReturnQuote, isGoodsExchangeContext, isGoodsExchangeQuote, isGoodsExchangeResult } from '@/utils/sales-checkout'
import SalesGoodsLine from '@/views/sales/page/SalesGoodsLine.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { formatAmount } from '@/utils/format'
import { hasPaymentChannelOptions } from '@/constants/paymentMethods'
import { RETURN_STOCK_OPTIONS } from '@/constants/returnStock'
import type { AccessorySaleRecord } from '@/types/accessory'
import type { GoodsReturnContext, GoodsReturnInput, GoodsReturnQuote, GoodsExchangeInput, GoodsExchangeQuote, CheckoutGoodsDraft } from '@/types/sales-checkout'

const props = withDefaults(defineProps<{ modelValue: boolean; sale: AccessorySaleRecord; mode?: 'return' | 'exchange' }>(), { mode: 'return' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; success: [] }>()
const { canView, hasPermission } = usePagePermissions('query')
const { hasPermission: hasGoodsPermission } = useGoodsPermissions()
const notifications = useNotification()
const isExchange = computed(() => props.mode === 'exchange'), actionName = computed(() => isExchange.value ? '换货' : '退货')
const actionPermission = computed(() => isExchange.value ? 'query:exchange' : 'query:return-to-stock')
const necessary: AccessoryFieldName[] = ['name', 'usage_type', 'distribution', 'total_quantity', 'unit_price', 'total_price', 'serial_number', 'created_at', 'remarks']
const allowed = computed(() => canView.value && hasPermission('goods-view') && hasPermission(isExchange.value ? 'exchange' : 'return-to-stock') && necessary.every(visible) &&
  (!isExchange.value || visible('operator_name')))
const loading = ref(false), failed = ref(false), quoting = ref(false), saving = ref(false), uncertain = ref(false)
const requests = useLatestRequest(), quotes = useLatestRequest(), sellers = useLatestRequest()
const stores = ref<ReferenceRecord[]>([]), operators = ref<ReferenceRecord[]>([]), sellerLoading = ref(false)
const context = ref<GoodsReturnContext | null>(null), quote = ref<GoodsReturnQuote | GoodsExchangeQuote | null>(null)
const exchangeContext = computed(() => isGoodsExchangeContext(context.value, Number(props.sale.order_id), Number(props.sale.order_item_id)) ? context.value : null)
const canOperate = computed(() => allowed.value && (!isExchange.value || Boolean(exchangeContext.value &&
  hasGoodsPermission(exchangeContext.value.replacement_sale_type === 'gift' ? 'gift' : 'create'))))
const form = reactive({ store_id: null as number | null, operator_id: null as number | null, quantity: 1, serial_numbers: [] as string[], return_reason: '', reversal_date: '', remarks: '', restock_confirmed: false })
const emptyReplacement = (): CheckoutGoodsDraft => ({ key: 'replacement', option: null, quantity: 1, unit_price: null, sale_type: 'sale', linked_phone_id: null,
  serial_mode: false, serial_numbers: [], redeem_points: 0, gift_return_unit_price: null })
const replacement = ref<CheckoutGoodsDraft>(emptyReplacement())
const returnQuantity = computed(() => context.value?.serial_tracking ? form.serial_numbers.length : form.quantity)
const exchangeQuote = computed(() => quote.value && 'replacement_amount' in quote.value ? quote.value : null)
const method = ref(''), channel = ref(''), paymentConfirmed = ref(false)
let requestKey = ''
const hasCash = computed(() => Boolean(quote.value && (quote.value.refund_amount || quote.value.collection_amount)))
const ready = computed(() => canOperate.value && !loading.value && !failed.value && !saving.value && !quoting.value && Boolean(context.value?.remaining_quantity))
const canQuote = computed(() => ready.value && !uncertain.value)
const canSubmit = computed(() => ready.value && Boolean(quote.value) && (!hasCash.value || Boolean(method.value && paymentConfirmed.value && (!hasPaymentChannelOptions(method.value) || channel.value))))

const invalidateQuote = () => { quotes.cancelLatest(); quote.value = null; quoting.value = false; method.value = channel.value = ''; paymentConfirmed.value = false }
watch(form, invalidateQuote, { deep: true, flush: 'sync' })
watch(replacement, invalidateQuote, { deep: true, flush: 'sync' })
watch(canOperate, value => { if (!value) invalidateQuote() })
const beforeClose = (done: (cancel?: boolean) => void) => { if (!saving.value) done() }
const close = (value: boolean) => { if (!value && !saving.value) emit('update:modelValue', false) }

const input = (): GoodsReturnInput | GoodsExchangeInput => {
  if (!canOperate.value) throw new Error(`无权办理商品${actionName.value}`)
  if (!context.value || !form.store_id || !form.return_reason || !form.reversal_date || !form.restock_confirmed) throw new Error('请选择退回门店、原因和时间，并核验退回实物')
  const quantity = context.value.serial_tracking ? form.serial_numbers.length : form.quantity
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > context.value.remaining_quantity) throw new Error('请填写有效退货数量或选择退回SN')
  const common: GoodsReturnInput = { request_key: requestKey, store_id: form.store_id, quantity, serial_numbers: [...form.serial_numbers].sort(),
    return_reason: form.return_reason, reversal_date: form.reversal_date, remarks: form.remarks.trim(), restock_confirmed: true }
  if (!isExchange.value) return common
  if (!Number.isSafeInteger(form.operator_id) || !form.operator_id) throw new Error('请选择新商品销售员')
  const [goods] = buildCheckoutGoods([replacement.value])
  if (goods.quantity !== quantity || goods.sale_type !== exchangeContext.value?.replacement_sale_type) throw new Error('换入件数须与本次退回数量一致，用途须与原单核对结果一致')
  return { ...common, operator_id: form.operator_id, replacement: { accessory_id: goods.accessory_id, unit_price: goods.unit_price,
    ...(goods.serial_numbers?.length ? { serial_numbers: goods.serial_numbers } : {}), ...(goods.redeem_points ? { redeem_points: goods.redeem_points } : {}) } }
}
const calculate = async () => {
  if (!canQuote.value) return
  let payload: GoodsReturnInput | GoodsExchangeInput
  try { payload = input() } catch (error) { notifications.warning(error instanceof Error ? error.message : '请核对退货资料'); return }
  invalidateQuote()
  const request = quotes.nextRequest(); quoting.value = true
  try {
    const response = 'replacement' in payload
      ? await quoteGoodsExchange(Number(props.sale.order_id), Number(props.sale.order_item_id), payload, request.signal)
      : await quoteGoodsReturn(Number(props.sale.order_id), Number(props.sale.order_item_id), payload, request.signal)
    if (!request.isLatest()) return
    if (!response.success || !response.data || !context.value || !('replacement' in payload
      ? isGoodsExchangeQuote(response.data, context.value, payload) : isGoodsReturnQuote(response.data, context.value, payload))) {
      notifications.warning('退款核对结果不完整或与当前商品不符，请重新核对')
      return
    }
    quote.value = response.data
  } catch { /* 统一API负责业务错误提示，保留录入。 */ }
  finally { if (request.isLatest()) quoting.value = false }
}
const submit = async () => {
  if (!canSubmit.value || !quote.value) return
  let payload: GoodsReturnInput | GoodsExchangeInput
  try { payload = input() } catch (error) { notifications.warning(error instanceof Error ? error.message : '请核对退货资料'); return }
  payload.settlement = { refund_amount: quote.value.refund_amount, collection_amount: quote.value.collection_amount,
    method: hasCash.value ? method.value : null, channel: hasCash.value && hasPaymentChannelOptions(method.value) ? channel.value : null,
    confirmed: hasCash.value ? paymentConfirmed.value : true }
  saving.value = true
  try {
    const response = 'replacement' in payload
      ? await submitGoodsExchange(Number(props.sale.order_id), Number(props.sale.order_item_id), payload)
      : await submitGoodsReturn(Number(props.sale.order_id), Number(props.sale.order_item_id), payload)
    if (!response.success || !response.data || !context.value || !('replacement' in payload
      ? isGoodsExchangeResult(response.data, context.value, payload) : isGoodsReturnQuote(response.data, context.value, payload)) ||
      !Number.isSafeInteger(response.data.aftersale_id) || response.data.aftersale_id < 1) { uncertain.value = true; return }
    notifications.success(`商品${actionName.value}已记录`); emit('success'); emit('update:modelValue', false)
  } catch (error) {
    if (!uncertain.value && isCheckoutSubmissionRejected(error)) {
      invalidateQuote()
    } else uncertain.value = true
  }
  finally { saving.value = false }
}

const searchSellers = async (keyword = '') => {
  const request = sellers.nextRequest(); sellerLoading.value = true
  try {
    const response = await searchOperators({ keyword: keyword.trim() || undefined, page: 1, page_size: 20 })
    if (!request.isLatest()) return
    if (!response.success || !Array.isArray(response.data)) throw new Error('人员读取失败')
    const selected = operators.value.find(row => Number(row.id) === form.operator_id)
    operators.value = response.data
    if (selected && !operators.value.some(row => Number(row.id) === Number(selected.id))) operators.value.unshift(selected)
  } catch { if (request.isLatest()) notifications.warning('销售员读取失败，请重新检索') }
  finally { if (request.isLatest()) sellerLoading.value = false }
}

watch([() => props.modelValue, () => props.sale.id, () => props.mode, allowed], async ([open]) => {
  requests.cancelLatest(); sellers.cancelLatest(); invalidateQuote()
  context.value = null; stores.value = []; failed.value = false; loading.value = false; uncertain.value = false
  operators.value = []; sellerLoading.value = false; replacement.value = emptyReplacement()
  if (!open || !allowed.value) return
  requestKey = createCheckoutKey()
  Object.assign(form, { store_id: Number(props.sale.store_id) || null, operator_id: null, quantity: 1, serial_numbers: [], return_reason: '',
    reversal_date: TimeUtil.format(new Date(), TIME_FORMATS.DATETIME), remarks: '', restock_confirmed: false })
  const request = requests.nextRequest(); loading.value = true
  try {
    const getContext = isExchange.value ? getGoodsExchangeContext : getGoodsReturnContext
    const results = await Promise.allSettled([getContext(Number(props.sale.order_id), Number(props.sale.order_item_id), request.signal), getStores({ strictScope: true })])
    if (!request.isLatest()) return
    const [record, options] = results
    if (record.status !== 'fulfilled' || options.status !== 'fulfilled' || !record.value.success ||
      !isGoodsReturnContext(record.value.data, Number(props.sale.order_id), Number(props.sale.order_item_id)) || !Array.isArray(options.value.data)) throw new Error('退货资料不完整')
    if (isExchange.value && !isGoodsExchangeContext(record.value.data, Number(props.sale.order_id), Number(props.sale.order_item_id))) throw new Error('换货用途资料不完整')
    context.value = record.value.data; stores.value = options.value.data
    const type = exchangeContext.value?.replacement_sale_type || record.value.data.sale_type
    replacement.value = { ...emptyReplacement(), sale_type: type, unit_price: type === 'gift' ? 0 : null }
    if (isExchange.value) void searchSellers()
  } catch { if (request.isLatest()) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}, { immediate: true })
</script>
