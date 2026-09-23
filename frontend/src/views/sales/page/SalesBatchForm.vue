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
        <div class="form-row">
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
            <small
              v-if="selectedCustomer && !customerNameEditing"
              class="form-hint"
            >双击姓名可编辑客户信息</small>
          </div>
          <div
            v-if="canViewField('customer_phone')"
            class="form-group"
          >
            <label class="form-label required">客户电话</label>
            <div class="customer-search-container">
              <input
                v-model="batchSaleForm.customer_phone"
                type="text"
                class="form-control"
                placeholder="请输入用户手机号"
                required
                :readonly="selectedCustomer !== null"
                :class="{ locked: selectedCustomer !== null }"
                title="已选择客户后不可修改，请清除后重新选择"
                @input="emit('phone-input')"
                @focus="showCustomerSearch = true"
                @blur="emit('phone-blur')"
              >
              <CustomerSearchDropdown
                :items="customerSearchResults"
                :loading="customerSearching"
                :visible="showCustomerSearch && !selectedCustomer"
                :keyword="batchSaleForm.customer_phone"
                :min-query-length="11"
                @select="emit('select-customer', $event as BatchCustomer)"
                @create="emit('create-customer')"
              />
            </div>
          </div>
        </div>
        <div class="form-row">
          <div
            v-if="canViewField('customer_apple_id')"
            class="form-group"
          >
            <label class="form-label">Apple ID</label>
            <input
              v-model="batchSaleForm.apple_id"
              type="text"
              class="form-control"
              placeholder="请输入Apple ID（手机号或邮箱）"
              @input="emit('apple-id-input', $event)"
            >
          </div>
        </div>
      </div>

      <div class="form-section">
        <h4>销售信息</h4>
        <div class="form-row">
          <div
            v-if="canViewField('sale_price')"
            class="form-group"
          >
            <label class="form-label required">销售单价</label>
            <input
              v-model.number="batchSaleForm.sale_price"
              type="number"
              class="form-control"
              placeholder="请输入销售单价"
              step="0.01"
              min="0.01"
              required
            >
          </div>
          <div
            v-if="canViewField('store_id')"
            class="form-group"
          >
            <label class="form-label required">销售店铺</label>
            <select
              v-model="batchSaleForm.store_id"
              class="form-control"
              required
            >
              <option value="">
                请选择销售店铺
              </option>
              <option
                v-for="store in stores"
                :key="store.id"
                :value="store.id"
              >
                {{ store.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div
            v-if="canViewField('operator_id')"
            class="form-group"
          >
            <label class="form-label required">销售员</label>
            <select
              v-model="batchSaleForm.operator_id"
              class="form-control"
              required
            >
              <option value="">
                请选择销售员
              </option>
              <option
                v-for="operator in operators"
                :key="operator.id"
                :value="operator.id"
              >
                {{ operator.name || operator.username }}{{ isCurrentUser(operator) ? ' (当前用户)' : '' }}
              </option>
            </select>
          </div>
          <div
            v-if="canViewField('sale_time')"
            class="form-group"
          >
            <label class="form-label required">销售日期</label>
            <input
              v-model="batchSaleForm.sale_time"
              type="date"
              class="form-control"
              required
            >
          </div>
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
            v-if="canViewField('payment_method') && (batchSaleForm.payment_method === 'mobile' || batchSaleForm.payment_method === 'transfer')"
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
          v-if="canViewField('transaction_no') && (batchSaleForm.payment_method === 'mobile' || batchSaleForm.payment_method === 'transfer')"
          class="form-row"
        >
          <div class="form-group">
            <label class="form-label">交易流水号</label>
            <input
              v-model="batchSaleForm.transaction_no"
              type="text"
              class="form-control"
              placeholder="请输入交易流水号（可选）"
            >
          </div>
        </div>
      </div>

      <div
        v-if="batchSaleForm.sale_price && canViewPrice"
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

      <div class="form-actions">
        <el-button
          type="success"
          :disabled="submitting"
          :class="{ 'btn-loading': submitting }"
          @click="emit('submit')"
          @keydown.enter.prevent
        >
          <InlineLoading
            v-if="submitting"
            text="处理中..."
            size="small"
            variant="inherit"
          />
          <template v-else>
            <i class="fas fa-shopping-cart" />
            <span>确认批量销售</span>
          </template>
        </el-button>
        <el-button
          type="info"
          plain
          @click="emit('clear-selection')"
        >
          取消
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
import type { Operator, Store } from '@/types'
import type { BatchCustomer, BatchSaleFormData } from '../types'

const props = defineProps<{
  form: BatchSaleFormData
  selectedCount: number
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
  'phone-input': []
  'phone-blur': []
  'select-customer': [customer: BatchCustomer]
  'create-customer': []
  'apple-id-input': [event: Event]
  submit: []
}>()

const batchSaleForm = props.form
const customerNameInputRef = ref<HTMLInputElement | null>(null)
const showCustomerSearch = computed({
  get: () => props.showCustomerSearch,
  set: value => emit('update:showCustomerSearch', value)
})
const totalRevenue = computed(() => (
  Number.parseFloat(String(batchSaleForm.sale_price || 0)) * props.selectedCount
).toFixed(2))

defineExpose({ input: customerNameInputRef })
</script>

<style scoped lang="scss" src="../styles/sales-batch-form.scss"></style>
