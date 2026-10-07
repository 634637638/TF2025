<template>
  <div class="batch-sale-form">
    <div class="form-header">
      <h3>批量销售信息 ({{ selectedCount }}台)</h3>
      <el-button
        type="info"
        plain
        size="small"
        @click="emit('clear-selection')"
      >
        <i class="fas fa-times" />
        清空选择
      </el-button>
    </div>

    <div class="sale-form-grid">
      <div class="form-section">
        <h4>客户信息</h4>
        <div class="form-row customer-fields">
          <div
            v-if="canViewField('customer_name')"
            class="form-group"
          >
            <label class="form-label required">客户姓名</label>
            <CustomerNameLockInput
              ref="customerNameInputRef"
              v-model="batchSaleForm.customer_name"
              name="batch-customer-name"
              :selected="selectedCustomer !== null"
              :editing="customerNameEditing"
              :creating="customerCreating"
              @unlock="emit('enable-name-edit', $event)"
              @touchend="emit('name-touch-end', $event)"
              @input="emit('name-input', $event)"
              @blur="emit('disable-name-edit')"
              @save="emit('save-name')"
              @clear="emit('clear-customer')"
            />
          </div>
          <div
            v-if="canViewField('customer_phone')"
            class="form-group"
          >
            <label class="form-label required">客户电话</label>
            <div class="customer-search-container">
              <el-input
                v-model="batchSaleForm.customer_phone"
                class="batch-customer-phone-input"
                type="tel"
                placeholder="请输入用户手机号"
                required
                :readonly="selectedCustomer !== null"
                :class="{ locked: selectedCustomer !== null }"
                title="已选择客户后不可修改，请清除后重新选择"
                @input="emit('phone-input')"
                @focus="showCustomerSearch = true"
                @blur="emit('phone-blur')"
              />
              <CustomerSearchDropdown
                :items="customerSearchResults"
                :loading="customerSearching"
                :visible="showCustomerSearch && !selectedCustomer"
                :keyword="batchSaleForm.customer_phone"
                :min-query-length="2"
                :create-min-query-length="11"
                @select="emit('select-customer', $event as BatchCustomer)"
                @create="emit('create-customer')"
              />
            </div>
          </div>
          <div
            v-if="canViewField('customer_apple_id')"
            class="form-group"
          >
            <label class="form-label">Apple ID</label>
            <el-input
              v-model="batchSaleForm.apple_id"
              class="batch-apple-id-input"
              placeholder="请输入Apple ID（手机号或邮箱）"
              @input="emit('apple-id-input', $event)"
            />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h4>销售信息</h4>
        <div class="form-row sales-fields">
          <div
            v-if="canViewField('sale_price')"
            class="form-group"
          >
            <label class="form-label">统一销售价</label>
            <div class="unified-price-control">
              <el-input-number
                v-model="unifiedSalePrice"
                class="price-input-number unified-price-input"
                placeholder="输入统一销售价"
                :min="0.01"
                :step="0.01"
                :precision="2"
                :controls="false"
              />
              <el-button
                type="primary"
                plain
                :disabled="!batchSaleForm.sale_price || Number(batchSaleForm.sale_price) <= 0 || batchItems.length === 0"
                @click="emit('apply-unified-sale-price', batchSaleForm.sale_price)"
              >
                应用
              </el-button>
            </div>
          </div>
          <div
            v-if="canViewField('store_id')"
            class="form-group"
          >
            <label class="form-label required">销售店铺</label>
            <el-select
              v-model="batchSaleForm.store_id"
              class="form-control"
              placeholder="请选择销售店铺"
              required
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
              v-model="batchSaleForm.operator_id"
              class="form-control"
              placeholder="请选择销售员"
              required
              filterable
              remote
              reserve-keyword
              :remote-method="(query: string) => emit('operator-search', query)"
              @focus="emit('operator-search', '')"
            >
              <el-option
                v-for="operator in operators"
                :key="operator.id"
                :label="`${operator.name || operator.username}${isCurrentUser(operator) ? ' (当前用户)' : ''}`"
                :value="String(operator.id)"
              />
            </el-select>
          </div>
          <div
            v-if="canViewField('sale_time')"
            class="form-group"
          >
            <label class="form-label required">销售日期</label>
            <el-date-picker
              v-model="batchSaleForm.sale_time"
              type="date"
              class="form-control"
              placeholder="请选择销售日期"
              :format="TIME_FORMATS.DATE"
              :value-format="TIME_FORMATS.DATE"
              :clearable="false"
            />
          </div>
        </div>
      </div>

      <div class="form-section batch-items-section">
        <h4>设备价格明细</h4>
        <div class="batch-items-table-wrap">
          <el-table
            :data="batchItems"
            class="data-table batch-items-table"
            border
            row-key="phone_id"
          >
            <el-table-column
              label="设备"
              min-width="230"
            >
              <template #default="{ row }">
                <strong>{{ [row.brand, row.model, row.color, row.memory].filter(Boolean).join(' ') || '未命名设备' }}</strong>
                <small>{{ row.imei || `设备ID ${row.phone_id}` }}</small>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewPrice && canViewField('purchase_cost')"
              label="入库价格"
              min-width="150"
            >
              <template #default="{ row }">
                <el-input-number
                  :model-value="numberValue(row.purchase_cost)"
                  class="price-input-number"
                  :min="0"
                  :step="0.01"
                  :precision="2"
                  :controls="false"
                  @update:model-value="emit('update-batch-item', { phoneId: row.phone_id, field: 'purchase_cost', value: String($event ?? '') })"
                />
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('sale_price')"
              label="销售价格 *"
              min-width="150"
            >
              <template #default="{ row }">
                <el-input-number
                  :model-value="numberValue(row.sale_price)"
                  class="price-input-number"
                  :min="0.01"
                  :step="0.01"
                  :precision="2"
                  :controls="false"
                  placeholder="请输入"
                  @update:model-value="emit('update-batch-item', { phoneId: row.phone_id, field: 'sale_price', value: String($event ?? '') })"
                />
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewPrice"
              label="单台利润"
              min-width="120"
            >
              <template #default="{ row }">
                <span class="item-profit">¥{{ itemProfit(row) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div class="form-section">
        <h4>支付信息</h4>
        <div class="form-row">
          <div
            v-if="canViewField('payment_method')"
            class="form-group"
          >
            <label class="form-label required">支付方式</label>
            <PaymentMethodSelect
              v-model="batchSaleForm.payment_method"
              variant="batch-sale"
              class="form-control"
              placeholder="请选择支付方式"
              required
            />
          </div>
          <div
            v-if="canViewField('payment_method') && hasPaymentChannelOptions(batchSaleForm.payment_method)"
            class="form-group"
          >
            <label class="form-label">支付渠道</label>
            <PaymentChannelSelect
              v-model="batchSaleForm.payment_channel"
              :payment-method="batchSaleForm.payment_method"
              class="form-control"
              placeholder="请选择支付渠道"
            />
          </div>
        </div>
        <div
          v-if="canViewField('transaction_no') && requiresTransactionNumber(batchSaleForm.payment_method)"
          class="form-row"
        >
          <div class="form-group">
            <label class="form-label">交易流水号</label>
            <el-input
              v-model="batchSaleForm.transaction_no"
              class="batch-transaction-input"
              placeholder="请输入交易流水号（可选）"
            />
          </div>
        </div>
      </div>

      <div
        v-if="batchItems.length > 0 && batchItems.some(item => Number(item.sale_price) > 0) && canViewPrice"
        class="form-section"
      >
        <h4>利润计算</h4>
        <div class="profit-summary">
          <div class="profit-item">
            <span class="label">总成本:</span>
            <span class="value">¥{{ totalCost }}</span>
          </div>
          <div class="profit-item">
            <span class="label">总收入:</span>
            <span class="value">¥{{ totalRevenue }}</span>
          </div>
          <div class="profit-item">
            <span class="label">总利润:</span>
            <span
              class="value"
              :class="Number(totalProfit) >= 0 ? 'positive' : 'negative'"
            >
              ¥{{ totalProfit }}
            </span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { TIME_FORMATS } from '@/utils/time'
import { computed, ref } from 'vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
import { hasPaymentChannelOptions, requiresTransactionNumber } from '@/constants/paymentMethods'
import { formatAmount } from '@/utils/format'
import type { Operator, Store } from '@/types'
import type { BatchCustomer, BatchSaleFormData, BatchSaleItem } from '../types'

const props = defineProps<{
  form: BatchSaleFormData
  selectedCount: number
  batchItems: BatchSaleItem[]
  selectedCustomer: BatchCustomer | null
  customerSearchResults: BatchCustomer[]
  customerSearching: boolean
  showCustomerSearch: boolean
  customerCreating: boolean
  customerNameEditing: boolean
  stores: Store[]
  operators: Operator[]
  submitting: boolean
  canViewField: (_fieldName: string) => boolean
  canViewPrice: boolean
  isCurrentUser: (_operator: Operator) => boolean
  totalCost: number
  totalProfit: string | number
}>()

const emit = defineEmits<{
  'update:showCustomerSearch': [value: boolean]
  'clear-selection': []
  'enable-name-edit': [event: MouseEvent]
  'name-touch-end': [event: TouchEvent]
  'name-input': [value: string]
  'disable-name-edit': []
  'save-name': []
  'clear-customer': []
  'continue-selection': []
  'apply-unified-sale-price': [value: string]
  'update-batch-item': [payload: {
    phoneId: number
    field: 'purchase_cost' | 'sale_price'
    value: string
  }]
  'phone-input': []
  'phone-blur': []
  'select-customer': [customer: BatchCustomer]
  'create-customer': []
  'apple-id-input': [value: string]
  'operator-search': [value: string]
  submit: []
}>()

const batchSaleForm = props.form
const customerNameInputRef = ref<HTMLInputElement | null>(null)
const unifiedSalePrice = computed<number | undefined>({
  get: () => {
    const value = Number(batchSaleForm.sale_price)
    return Number.isFinite(value) && value > 0 ? value : undefined
  },
  set: value => {
    batchSaleForm.sale_price = value === undefined ? '' : String(value)
  }
})

const numberValue = (value: string) => {
  const parsed = Number(value)
  return value !== '' && Number.isFinite(parsed) ? parsed : undefined
}
const showCustomerSearch = computed({
  get: () => props.showCustomerSearch,
  set: value => emit('update:showCustomerSearch', value)
})
const totalRevenue = computed(() => props.batchItems.reduce((sum, item) => (
  sum + (Number.parseFloat(item.sale_price) || 0)
), 0))

const itemProfit = (item: BatchSaleItem) => (
  formatAmount((Number.parseFloat(item.sale_price) || 0) - (Number.parseFloat(item.purchase_cost) || 0))
)

defineExpose({ input: customerNameInputRef })
</script>

<style scoped lang="scss" src="../styles/sales-batch-form.scss"></style>
