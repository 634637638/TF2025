<template>
  <div class="sale-form-section">
    <h4>销售信息</h4>
    <el-form
      class="sale-form tf-form-layout"
      :disabled="disabled"
      @submit.prevent="emit('submit')"
    >
      <div class="tf-form-row">
        <div
          v-if="canViewField('customer_phone')"
          class="form-group"
        >
          <label class="form-label required">手机号码</label>
          <div class="customer-search-container">
            <el-input
              v-model="saleForm.customer_phone"
              placeholder="请输入用户手机号"
              :clearable="!preorderDelivery && (!selectedCustomer || customerPermissions.canEdit.value)"
              :readonly="selectedCustomer !== null || preorderDelivery"
              :class="{ locked: selectedCustomer !== null || preorderDelivery }"
              @input="emit('customer-search', $event)"
              @focus="showCustomerSearch = true"
            />
            <CustomerSearchDropdown
              :items="customerSearchResults"
              :loading="customerSearching"
              :visible="!preorderDelivery && showCustomerSearch && !selectedCustomer"
              :keyword="saleForm.customer_phone"
              :min-query-length="2"
              :create-min-query-length="11"
              @select="emit('select-customer', $event as SalesCustomer)"
              @create="emit('create-customer')"
            />
          </div>
        </div>
        <div
          v-if="canViewField('customer_name')"
          class="form-group"
        >
          <label class="form-label">客户姓名</label>
          <CustomerNameLockInput
            ref="customerNameInputRef"
            v-model="saleForm.customer_name"
            name="sale-customer-name"
            :selected="selectedCustomer !== null"
            :editing="customerNameEditing"
            :creating="customerCreating"
            :locked="preorderDelivery"
            :clearable="!preorderDelivery && (!selectedCustomer || customerPermissions.canEdit.value)"
            @unlock="emit('enable-name-edit', $event)"
            @touchend="emit('name-touch-end', $event)"
            @input="emit('name-input', $event)"
            @blur="emit('name-blur')"
            @save="emit('save-name')"
            @clear="emit('clear-customer')"
          />
        </div>
      </div>

      <div class="tf-form-row">
        <div
          v-if="canViewField('customer_apple_id')"
          class="form-group tf-form-field--wide"
        >
          <label class="form-label">Apple ID</label>
          <el-input
            v-model="saleForm.customer_apple_id"
            placeholder="客户Apple ID（可选）"
            :clearable="!preorderDelivery && (!selectedCustomer || customerPermissions.canEdit.value)"
            :readonly="preorderDelivery || (!!selectedCustomer && !customerPermissions.canEdit.value)"
            :class="{ locked: preorderDelivery }"
            @input="emit('apple-id-input', $event)"
          />
        </div>
        <div
          v-if="canViewField('sale_time')"
          class="form-group"
        >
          <label class="form-label required">销售时间</label>
          <el-date-picker
            v-model="saleForm.sale_time"
            type="date"
            class="sale-date-picker"
            popper-class="tf2025-form-popper"
            :value-format="TIME_FORMATS.DATE"
            :format="TIME_FORMATS.DATE_UNPADDED"
            placeholder="请选择销售时间"
            required
          />
        </div>
      </div>

      <div class="tf-form-row">
        <div
          v-if="canViewPrice"
          class="form-group"
        >
          <label class="form-label">入库价格</label>
          <AmountInput
            :model-value="numberPrice(saleForm.purchase_cost)"
            class="price-input"
            :min="0"
            placeholder="请输入入库价格"
            @update:model-value="updatePrice('purchase_cost', $event)"
          />
        </div>
        <div
          v-if="canViewField('sale_price')"
          class="form-group"
        >
          <label class="form-label required">{{ batchMode ? '销售单价' : '销售价格' }}</label>
          <AmountInput
            :model-value="numberPrice(saleForm.sale_price)"
            class="price-input"
            :min="0"
            placeholder="请输入销售价格"
            required
            @update:model-value="updatePrice('sale_price', $event)"
          />
        </div>
      </div>

      <div class="tf-form-row">
        <div
          v-if="canViewField('store_id')"
          class="form-group"
        >
          <label class="form-label required">销售门店</label>
          <el-select
            v-model="saleForm.store_id"
            placeholder="请选择门店"
            class="w-full"
            clearable
            filterable
            remote
            reserve-keyword
            :remote-method="(query: string) => emit('operator-search', query)"
            teleported
            popper-class="tf2025-form-popper"
            @focus="emit('operator-search', '')"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="store.name"
              :value="String(store.id)"
            />
          </el-select>
        </div>
        <div
          v-if="canViewField('operator_id')"
          class="form-group"
        >
          <label class="form-label required">销售员</label>
          <el-select
            v-model="saleForm.operator_id"
            placeholder="请选择销售员"
            class="w-full"
            clearable
            teleported
            popper-class="tf2025-form-popper"
          >
            <el-option
              v-for="operator in operators"
              :key="operator.id"
              :label="`${operator.name || operator.username}${isCurrentUser(operator) ? ' (当前用户)' : ''}`"
              :value="String(operator.id)"
            />
          </el-select>
        </div>
      </div>

      <div class="tf-form-row">
        <div
          v-if="canViewField('payment_method')"
          class="form-group"
        >
          <label class="form-label required">支付方式</label>
          <PaymentMethodSelect
            v-model="saleForm.payment_method"
            variant="sale"
            placeholder="请选择支付方式"
            class="w-full"
            clearable
            teleported
            popper-class="tf2025-form-popper"
            @change="emit('payment-method-change')"
          />
        </div>
        <div
          v-if="canViewField('payment_method') && hasPaymentChannelOptions(saleForm.payment_method)"
          class="form-group"
        >
          <label class="form-label">支付渠道</label>
          <PaymentChannelSelect
            v-model="saleForm.payment_channel"
            :payment-method="saleForm.payment_method"
            placeholder="请选择支付渠道"
            class="w-full"
            clearable
            teleported
            popper-class="tf2025-form-popper"
            @change="emit('payment-channel-change')"
          />
        </div>
      </div>

      <div
        v-if="canViewField('transaction_no') && requiresTransactionNumber(saleForm.payment_method)"
        class="form-group"
      >
        <label class="form-label">交易流水号</label>
        <el-input
          v-model="saleForm.transaction_no"
          placeholder="请输入交易流水号（可选）"
          clearable
        />
        <small class="form-hint">用于记录支付平台的交易流水号</small>
      </div>

      <div
        v-if="canViewField('remarks')"
        class="form-group"
      >
        <label class="form-label">备注</label>
        <el-input
          v-model="saleForm.remarks"
          class="tf-textarea"
          type="textarea"
          :rows="2"
          placeholder="销售备注信息"
        />
      </div>

      <SalesProfitSummary
        v-if="profitLines.length && canViewPrice"
        :lines="profitLines"
      />
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { usePagePermissions } from '@/composables/usePagePermissions'
import { TIME_FORMATS } from '@/utils/time'
import { computed, ref } from 'vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
import { hasPaymentChannelOptions, requiresTransactionNumber } from '@/constants/paymentMethods'
import SalesProfitSummary from './SalesProfitSummary.vue'
import type { CheckoutGoodsDraft } from '@/types/sales-checkout'
import type { Operator, Phone, Store } from '@/types'
import type { SalesCheckoutFormData, SalesCustomer, SalesProfitLine } from '../types'

interface CustomerNameInputInstance {
  input?: HTMLInputElement
  $el?: HTMLElement
}

const customerPermissions = usePagePermissions('customers')

const props = defineProps<{
  disabled?: boolean
  form: SalesCheckoutFormData
  selectedCustomer: SalesCustomer | null
  preorderDelivery: boolean
  customerSearchResults: SalesCustomer[]
  customerSearching: boolean
  showCustomerSearch: boolean
  customerCreating: boolean
  customerNameEditing: boolean
  stores: Store[]
  operators: Operator[]
  selectedPhone: Phone | null
  batchMode: boolean
  profit: string | null
  profitMargin: string
  profitClass: string
  additionalGoods?: CheckoutGoodsDraft[]
  canViewField: (_fieldName: string) => boolean
  canViewPrice: boolean
  isCurrentUser: (_operator: Operator) => boolean
}>()

const emit = defineEmits<{
  'update:showCustomerSearch': [value: boolean]
  'customer-search': [value: string]
  'select-customer': [customer: SalesCustomer]
  'create-customer': []
  'enable-name-edit': [event: MouseEvent]
  'name-touch-end': [event: TouchEvent]
  'name-input': [value: string]
  'name-blur': []
  'save-name': []
  'clear-customer': []
  'apple-id-input': [value: string]
  'calculate-profit': []
  'payment-method-change': []
  'payment-channel-change': []
  'operator-search': [value: string]
  submit: []
}>()

const saleForm = props.form
const numberPrice = (value: string) => value === '' ? undefined : Number(value)
const updatePrice = (field: 'purchase_cost' | 'sale_price', value: number | null | undefined) => {
  saleForm[field] = String(value ?? '')
  emit('calculate-profit')
}
const profitLines = computed<SalesProfitLine[]>(() => {
  const lines: SalesProfitLine[] = []
  const salePrice = Number(saleForm.sale_price)
  if (props.selectedPhone && Number.isFinite(salePrice) && salePrice > 0) {
    const rawCost = saleForm.purchase_cost === '' ? props.selectedPhone.purchase_cost : Number(saleForm.purchase_cost)
    lines.push({ key: `phone:${props.selectedPhone.id}`, type: 'phone', name: [props.selectedPhone.brand, props.selectedPhone.model, props.selectedPhone.memory].filter(Boolean).join(' · ') || `设备 #${props.selectedPhone.id}`, quantity: 1,
      purchase_cost: Number.isFinite(Number(rawCost)) ? Number(rawCost) : null, sale_price: salePrice })
  }
  for (const row of props.additionalGoods || []) {
    if (!row.option) continue
    const rawCost = row.option.purchase_cost
    lines.push({ key: `goods:${row.key}`, type: 'goods', name: [row.option.name, row.option.product_model, ...row.serial_numbers].filter(Boolean).join(' · '), quantity: row.quantity,
      purchase_cost: rawCost === null || rawCost === undefined || !Number.isFinite(Number(rawCost)) ? null : Number(rawCost),
      sale_price: row.sale_type === 'gift' ? 0 : Number(row.unit_price || 0), sale_type: row.sale_type })
  }
  return lines
})
const customerNameInputRef = ref<CustomerNameInputInstance | null>(null)
const customerNameInput = computed(() => customerNameInputRef.value?.input || null)
const showCustomerSearch = computed({
  get: () => props.showCustomerSearch,
  set: value => emit('update:showCustomerSearch', value)
})

defineExpose({ input: customerNameInput })
</script>

<style scoped lang="scss" src="../styles/sales-checkout-form.scss"></style>
