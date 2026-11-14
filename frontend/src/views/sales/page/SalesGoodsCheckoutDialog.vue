<template>
  <MobileDialog
    :model-value="modelValue"
    :title="filmCustomerId ? '办理贴膜' : phones.length ? '手机与商品一起结算' : '销售商品'"
    width="960px"
    :show-default-footer="false"
    :close-on-click-modal="false"
    :before-close="beforeClose"
    destroy-on-close
    @update:model-value="updateVisible"
  >
    <SectionLoading
      v-if="loading"
      text="正在读取销售门店与人员..."
    />
    <el-alert
      v-else-if="failed"
      type="error"
      title="销售资料读取失败，请关闭后重试"
      :closable="false"
    />
    <el-alert
      v-else-if="!fieldsAllowed"
      type="warning"
      title="缺少销售必要字段的访问权限，请联系管理员"
      :closable="false"
    />
    <el-form
      v-else
      class="tf-dialog-form tf-dialog-form--stacked tf-form-layout tf-form-grid"
      label-position="top"
      :disabled="formDisabled"
      @submit.prevent="submit"
    >
      <div
        v-if="phones.length"
        class="form-section mb-4"
      >
        <p
          v-for="phone in phones"
          :key="phone.phone_id"
        >
          {{ phone.label }}：¥{{ formatAmount(phone.sale_price) }}
        </p>
      </div>
      <el-row :gutter="16">
        <el-col
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="销售门店"
            required
          >
            <el-select
              v-model="form.store_id"
              filterable
              :disabled="formDisabled || phones.length > 0"
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
            label="销售员"
            required
          >
            <el-select
              v-model="form.operator_id"
              filterable
              remote
              :remote-method="searchSellers"
              :loading="sellerLoading"
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
        <el-col
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="客户手机号"
            required
          >
            <el-input
              v-if="filmCustomerId"
              :model-value="form.customer_phone"
              readonly
            />
            <div
              v-else
              class="goods-customer-search"
            >
              <el-input
                :model-value="form.customer_phone"
                :readonly="Boolean(selectedCustomer)"
                :maxlength="20"
                inputmode="tel"
                @update:model-value="searchCustomer"
                @focus="showCustomerSearch = true"
              />
              <CustomerSearchDropdown
                :items="customers"
                :visible="showCustomerSearch && !selectedCustomer"
                :loading="customerLoading"
                :keyword="form.customer_phone"
                :allow-create="false"
                @select="selectCustomer"
              />
            </div>
          </el-form-item>
        </el-col>
        <el-col
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="客户姓名"
            required
          >
            <el-input
              v-if="filmCustomerId"
              :model-value="form.customer_name"
              readonly
            />
            <CustomerNameLockInput
              v-else
              v-model="form.customer_name"
              :selected="Boolean(selectedCustomer)"
              :editing="nameEditing"
              :creating="!selectedCustomer"
              :locked="saving || uncertain"
              :maxlength="50"
              @unlock="nameTap.handleDoubleClick(undefined)"
              @touchend="nameTap.handleTouchEnd($event, undefined)"
              @save="saveName"
              @blur="saveName"
              @clear="clearCustomer"
            />
          </el-form-item>
        </el-col>
        <el-col
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="销售日期"
            required
          >
            <el-date-picker
              v-model="form.sale_time"
              type="date"
              :value-format="TIME_FORMATS.DATE"
            />
          </el-form-item>
        </el-col>
        <el-col
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="支付方式"
            required
          >
            <PaymentMethodSelect
              v-model="form.payment_method"
              @update:model-value="resetPayment"
            />
          </el-form-item>
        </el-col>
        <el-col
          v-if="hasPaymentChannelOptions(form.payment_method)"
          :xs="12"
          :sm="6"
        >
          <el-form-item
            label="支付渠道"
            required
          >
            <PaymentChannelSelect
              v-model="form.payment_channel"
              :payment-method="form.payment_method"
            />
          </el-form-item>
        </el-col>
        <el-col
          v-if="requiresTransactionNumber(form.payment_method) && (!phones.length || phoneFieldVisible('transaction_no'))"
          :xs="12"
          :sm="6"
        >
          <el-form-item label="交易流水号">
            <el-input
              v-model="form.transaction_no"
              :maxlength="100"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-alert
        v-if="filmCustomerId"
        :type="filmEligibleForFree ? 'info' : 'warning'"
        :title="filmEligibleForFree ? '客户有有效手机购买记录，可办理免费或收费贴膜。' : '客户当前没有免费贴膜资格，可办理收费贴膜。'"
        :closable="false"
        class="mb-4"
      />
      <SalesGoodsLine
        v-for="(row, index) in goods"
        :key="row.key"
        v-model="goods[index]"
        :store-id="Number(form.store_id) || null"
        :phones="phones"
        :disabled="formDisabled"
        :film-only="Boolean(filmCustomerId)"
        :allow-gift="!filmCustomerId || filmEligibleForFree"
        @remove="goods.splice(index, 1)"
      />
      <div class="tf-dialog-toolbar mb-4">
        <el-button
          v-permission="{ permission: ['accessories:create', 'accessories:gift'] }"
          :disabled="formDisabled || !canAddGoods || !form.store_id || goods.length + phones.length >= 1000"
          @click="addGoods"
        >
          添加商品
        </el-button>
        <el-button
          v-if="canViewAccessoryField('total_price')"
          v-permission="{ permission: ['accessories:create', 'accessories:gift'] }"
          :loading="quoteLoading"
          :disabled="saving || nameSaving || uncertain || !goods.length"
          @click="refreshQuote"
        >
          积分试算
        </el-button>
        <strong v-if="canViewAccessoryField('total_price')">{{ hasRedemption && !pointsQuote ? '整单原价' : '整单实收' }}：¥{{ formatAmount(pointsQuote ? pointsQuote.payable_cents / 100 : totalAmount) }}</strong>
      </div>
      <el-alert
        v-if="pointsQuote && canViewAccessoryField('total_price')"
        type="info"
        :closable="false"
        :title="`可用积分 ${pointsQuote.available_points}；本单抵扣 ${pointsQuote.points_used} 积分（¥${formatAmount(pointsQuote.deduction_cents / 100)}），累计 ${pointsQuote.points_awarded} 积分。${pointsQuote.redemption_ready ? '' : '当前未启用积分抵扣。'}`"
        class="mb-4"
      />
      <el-alert
        v-else-if="hasRedemption"
        type="warning"
        title="请先进行积分试算，核对抵扣后的实收金额。"
        :closable="false"
        class="mb-4"
      />
      <el-form-item
        v-if="showRemarks"
        class="tf-form-field--wide"
        label="整单备注 / 收费库存转赠送原因"
      >
        <el-input
          v-model="form.remarks"
          type="textarea"
          class="tf-textarea"
          :rows="2"
          :maxlength="1000"
        />
      </el-form-item>
      <el-alert
        v-if="uncertain"
        type="warning"
        title="提交结果尚未确认，请保留原内容重试，或先到综合查询核对单据。"
        :closable="false"
      />
    </el-form>
    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          :disabled="saving || nameSaving"
          @click="requestClose"
        >
          取消
        </el-button>
        <el-button
          v-permission="{ permission: ['accessories:create', 'accessories:gift'] }"
          type="primary"
          :loading="saving"
          :disabled="loading || quoteLoading || failed || !fieldsAllowed || nameEditing || nameSaving || !goods.length"
          @click="submit"
        >
          {{ filmCustomerId ? '确认办理贴膜' : '确认整单结算' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { checkoutSale, quoteCheckoutSale } from '@/api/sales-checkout'
import { getCachedStores, searchOperators, type ReferenceRecord } from '@/services/reference-options'
import { searchCustomerOptions, type CustomerOption } from '@/services/customer-options'
import { unifiedApi } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useTouchDoubleTap } from '@/composables/useTouchDoubleTap'
import { normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import { formatAmount } from '@/utils/format'
import { hasPaymentChannelOptions, requiresTransactionNumber } from '@/constants/paymentMethods'
import { buildCheckoutInput, createCheckoutKey, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import { canViewAccessoryField, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import CustomerSearchDropdown, { type CustomerSearchDropdownItem } from '@/components/common/CustomerSearchDropdown.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import SalesGoodsLine from './SalesGoodsLine.vue'
import type { CheckoutPointsQuote, CheckoutCustomerForm, CheckoutGoodsDraft, CheckoutPhone, CheckoutQuickPhone, SalesCheckoutResult } from '@/types/sales-checkout'
const props = withDefaults(defineProps<{ modelValue: boolean; phones?: CheckoutPhone[]; quickPhone?: CheckoutQuickPhone; defaults?: Partial<CheckoutCustomerForm>; initialCustomer?: Pick<CustomerOption, 'id' | 'name' | 'phone'> | null; filmCustomerId?: number; filmEligibleForFree?: boolean; phoneFieldsAllowed?: boolean; phoneFieldVisible?: (field: string) => boolean }>(), { phones: () => [], quickPhone: undefined, defaults: () => ({}), initialCustomer: null, filmCustomerId: undefined, filmEligibleForFree: false, phoneFieldsAllowed: true, phoneFieldVisible: () => true })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; success: [result: SalesCheckoutResult]; 'customer-updated': [customer: Pick<CustomerOption, 'id' | 'name' | 'phone'>] }>()
const auth = useAuthStore()
const permissions = usePagePermissions('accessories')
const phonePermissions = usePagePermissions('sales')
const inventoryPermissions = usePagePermissions('inventory')
const queryPermissions = usePagePermissions('query')
const notices = useNotification()
const requests = useLatestRequest(), customerRequests = useLatestRequest(), sellerRequests = useLatestRequest(), quoteRequests = useLatestRequest()
const form = reactive<CheckoutCustomerForm>({ customer_name: '', customer_phone: '', store_id: '', operator_id: '', sale_time: '', payment_method: '', payment_channel: '', transaction_no: '', remarks: '' })
const goods = ref<CheckoutGoodsDraft[]>([])
const stores = ref<ReferenceRecord[]>([]), operators = ref<ReferenceRecord[]>([])
const customers = ref<CustomerSearchDropdownItem[]>([]), selectedCustomer = ref<CustomerOption | null>(null)
const loading = ref(false), failed = ref(false), saving = ref(false), uncertain = ref(false), customerLoading = ref(false), sellerLoading = ref(false)
const showCustomerSearch = ref(false), nameEditing = ref(false), nameSaving = ref(false)
const pointsQuote = ref<CheckoutPointsQuote | null>(null), quoteLoading = ref(false)
const formDisabled = computed(() => saving.value || nameSaving.value || quoteLoading.value || uncertain.value)
let quotedInput = ''
const invalidatePointsQuote = () => { quoteRequests.cancelLatest(); pointsQuote.value = null; quoteLoading.value = false; quotedInput = '' }
const hasRedemption = computed(() => goods.value.some(row => Number(row.redeem_points) > 0))
let requestKey = ''
const requiredFields: AccessoryFieldName[] = ['name', 'distribution', 'total_quantity', 'unit_price', 'usage_type', 'customer_name', 'customer_phone', 'created_at', 'operator_name']
const fieldsAllowed = computed(() => permissions.canView.value && props.phoneFieldsAllowed && requiredFields.every(canViewAccessoryField) &&
  (!props.filmCustomerId || queryPermissions.canView.value && queryPermissions.hasPermission('film') &&
    props.initialCustomer?.id === props.filmCustomerId && !props.phones.length && !props.quickPhone && canViewAccessoryField('category') && canViewAccessoryField('total_price')))
const canAddGoods = computed(() => permissions.canCreate.value || permissions.hasPermission('gift') && (!props.filmCustomerId || props.filmEligibleForFree))
const showRemarks = computed(() => canViewAccessoryField('remarks') && (!props.phones.length || props.phoneFieldVisible('remarks')))
const totalAmount = computed(() => props.phones.reduce((sum, phone) => sum + Math.round(phone.sale_price * 100), 0) / 100 + goods.value.reduce((sum, row) => sum + (row.sale_type === 'gift' ? 0 : Math.round(Number(row.unit_price || 0) * 100) * (row.serial_mode ? row.serial_numbers.length : row.quantity)), 0) / 100)
const addGoods = () => { if (formDisabled.value || !canAddGoods.value) return; goods.value.push({ key: createCheckoutKey(), option: null, quantity: 1, unit_price: null,
  sale_type: props.filmCustomerId && props.filmEligibleForFree && permissions.hasPermission('gift') ? 'gift' : permissions.canCreate.value ? 'sale' : 'gift', linked_phone_id: props.phones.length === 1 ? props.phones[0].phone_id : null,
  serial_mode: false, serial_numbers: [], gift_return_unit_price: null }) }
const clearCustomer = () => { customerRequests.cancelLatest(); selectedCustomer.value = null; form.customer_name = form.customer_phone = ''; form.apple_id = undefined; nameEditing.value = false; customers.value = []; customerLoading.value = false }
const selectCustomer = (customer: CustomerSearchDropdownItem, preserveAppleId = false) => {
  customerRequests.cancelLatest(); customerLoading.value = false
  if (!preserveAppleId) form.apple_id = undefined
  selectedCustomer.value = { ...customer }; form.customer_name = customer.name; form.customer_phone = customer.phone; nameEditing.value = false; showCustomerSearch.value = false
}
const nameTap = useTouchDoubleTap(() => { if (selectedCustomer.value && !saving.value && !nameSaving.value && !uncertain.value) nameEditing.value = true })
const saveName = async () => {
  if (!nameEditing.value || !selectedCustomer.value || nameSaving.value || saving.value || uncertain.value) return
  const name = normalizePersonName(form.customer_name, 50)
  if (name.length < 2) { notices.error('客户姓名至少两个字'); return }
  const customer = selectedCustomer.value
  if (name === customer.name) { nameEditing.value = false; return }
  nameSaving.value = true
  try {
    const response = await unifiedApi.put(`/customers/${customer.id}`, { name })
    if (response.success && customer === selectedCustomer.value) {
      customer.name = form.customer_name = name; nameEditing.value = false
      emit('customer-updated', { id: customer.id, name, phone: customer.phone })
    }
  } catch { /* 公共API反馈错误，保留姓名草稿。 */ }
  finally { nameSaving.value = false }
}
const searchCustomer = async (value: string) => {
  const request = customerRequests.nextRequest()
  form.customer_phone = normalizePhoneDigits(value); showCustomerSearch.value = true; customers.value = []
  if (form.customer_phone.length < 2) { customerLoading.value = false; return }
  customerLoading.value = true
  try {
    const rows = await searchCustomerOptions(form.customer_phone, 'sales')
    if (request.isLatest()) customers.value = rows.map(row => ({ id: row.id, name: row.name, phone: row.phone, member_number: row.member_number || undefined, vip_level: row.vip_level || undefined }))
  } catch { if (request.isLatest()) notices.error('客户检索失败，请重试') }
  finally { if (request.isLatest()) customerLoading.value = false }
}
const searchSellers = async (keyword = '') => {
  const request = sellerRequests.nextRequest(); sellerLoading.value = true
  try {
    const response = await searchOperators({ keyword: keyword.trim() || undefined, page: 1, page_size: 20 })
    if (!request.isLatest()) return
    if (!response.success || !Array.isArray(response.data)) throw new Error('人员读取失败')
    const selected = operators.value.find(row => Number(row.id) === Number(form.operator_id))
    operators.value = response.data
    if (selected && !operators.value.some(row => row.id === selected.id)) operators.value.unshift(selected)
  } catch { if (request.isLatest()) notices.error('销售员读取失败，请重新检索') }
  finally { if (request.isLatest()) sellerLoading.value = false }
}
const resetPayment = () => { form.payment_channel = form.transaction_no = '' }
const load = async () => {
  const request = requests.nextRequest(); loading.value = true; failed.value = uncertain.value = false
  clearCustomer(); nameSaving.value = false; invalidatePointsQuote(); goods.value = []; stores.value = []; operators.value = []
  Object.assign(form, { customer_name: '', customer_phone: '', apple_id: undefined, store_id: '', operator_id: Number(auth.user?.id) || '', sale_time: TimeUtil.format(new Date(), TIME_FORMATS.DATE), payment_method: '', payment_channel: '', transaction_no: '', remarks: '' }, props.defaults)
  if (props.initialCustomer && normalizePhoneDigits(props.initialCustomer.phone) === normalizePhoneDigits(form.customer_phone)) selectCustomer(props.initialCustomer, true)
  form.store_id = Number(form.store_id) || ''; form.operator_id = Number(form.operator_id) || ''
  requestKey = createCheckoutKey()
  try {
    if (!permissions.canView.value || !fieldsAllowed.value) return
    const [storeResponse] = await Promise.all([getCachedStores(true), searchSellers()])
    if (!request.isLatest()) return
    if (!storeResponse.success || !Array.isArray(storeResponse.data)) throw new Error('门店读取失败')
    stores.value = storeResponse.data.filter(row => Number(row.status ?? 1) === 1)
    const current = auth.user
    if (current?.id && !operators.value.some(row => Number(row.id) === Number(current.id))) operators.value.unshift({ id: Number(current.id), name: current.name || current.username || '' })
    if (!form.store_id && stores.value.length === 1) form.store_id = Number(stores.value[0].id)
    addGoods()
  } catch { if (request.isLatest()) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}
const prepareInput = () => {
  const input = buildCheckoutInput(form, props.phones, goods.value, requestKey, props.quickPhone)
  if (props.filmCustomerId) {
    if (!fieldsAllowed.value || form.customer_phone !== props.initialCustomer?.phone || form.customer_name !== props.initialCustomer?.name) throw new Error('贴膜客户资料已变化，请重新打开办理')
    if (!props.filmEligibleForFree && goods.value.some(row => row.sale_type === 'gift')) throw new Error('客户当前没有免费贴膜资格')
    input.film_service = { customer_id: props.filmCustomerId }
  }
  if (hasPaymentChannelOptions(form.payment_method) && !form.payment_channel) throw new Error('请选择支付渠道')
  if (!canViewAccessoryField('serial_number') && goods.value.some(row => row.serial_mode)) throw new Error('无权使用SN字段')
  if (!showRemarks.value) delete input.remarks
  if (props.phones.length && !props.phoneFieldVisible('transaction_no')) delete input.payment_info.transaction_no
  if (props.phones.length && !props.phoneFieldVisible('customer_apple_id')) delete input.customer_info.apple_id
  return input
}
const refreshQuote = async () => {
  if (saving.value || nameSaving.value || uncertain.value || !fieldsAllowed.value || !canViewAccessoryField('total_price')) return
  let input
  try { input = prepareInput() }
  catch (error) { notices.error(error instanceof Error ? error.message : '请核对销售明细'); return }
  const request = quoteRequests.nextRequest()
  quoteLoading.value = true; pointsQuote.value = null; quotedInput = ''
  try {
    const response = await quoteCheckoutSale(input, request.signal)
    if (!request.isLatest() || !props.modelValue) return
    if (!response.success || !response.data) return
    pointsQuote.value = response.data; quotedInput = JSON.stringify(input)
  } catch { /* 统一API反馈规则或网络错误，不使用旧试算。 */ }
  finally { if (request.isLatest()) quoteLoading.value = false }
}
const submit = async () => {
  if (saving.value || quoteLoading.value || loading.value || nameSaving.value || nameEditing.value || !fieldsAllowed.value) return
  const canSellPhone = props.quickPhone ? inventoryPermissions.canSell.value && queryPermissions.canView.value && queryPermissions.canCreate.value : phonePermissions.canSell.value
  if (!permissions.canView.value || props.phones.length && !canSellPhone) { notices.error('销售权限已变更，请重新打开页面'); return }
  if (goods.value.some(row => !permissions.hasPermission(row.sale_type === 'gift' ? 'gift' : 'create'))) { notices.error('没有对应的商品销售或赠送权限'); return }
  let input
  try {
    input = prepareInput()
    if (hasRedemption.value) {
      if (!canViewAccessoryField('total_price') || !pointsQuote.value || JSON.stringify(input) !== quotedInput) throw new Error('销售内容已变更，请重新进行积分试算')
      input.payment_info.payment_amount = pointsQuote.value.payable_cents / 100
    }
  } catch (error) { notices.error(error instanceof Error ? error.message : '请核对销售明细'); return }
  saving.value = true
  try {
    const response = await checkoutSale(input)
    if (!response.success || !response.data) { uncertain.value = true; return }
    notices.success(`结算成功：${response.data.order_no}，抵扣${response.data.points_used || 0}积分，累计${response.data.points_earned}积分`)
    uncertain.value = false; emit('success', response.data); emit('update:modelValue', false)
  } catch (error) {
    if (!uncertain.value && isCheckoutSubmissionRejected(error)) {
      invalidatePointsQuote()
    } else uncertain.value = true
  }
  finally { saving.value = false }
}
const beforeClose = (done: (cancel?: boolean) => void) => {
  if (saving.value || nameSaving.value) return
  done()
}
const requestClose = () => beforeClose(() => emit('update:modelValue', false))
const updateVisible = (value: boolean) => { if (!value && !saving.value && !nameSaving.value) emit('update:modelValue', false) }
watch([form, goods, () => props.phones, () => props.quickPhone, () => props.filmCustomerId, () => props.filmEligibleForFree], invalidatePointsQuote, { deep: true })
watch(() => props.modelValue, visible => {
  if (visible) void load()
  else { requests.cancelLatest(); customerRequests.cancelLatest(); sellerRequests.cancelLatest(); invalidatePointsQuote() }
}, { immediate: true })
</script>
<style scoped>
.goods-customer-search { position: relative; width: 100%; min-width: 0; }
</style>
