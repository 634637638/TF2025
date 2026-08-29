<template>
  <div class="sale-form-section">
    <h4>销售信息</h4>
    <form
      class="sale-form"
      @submit.prevent="emit('submit')"
    >
      <div class="form-grid">
        <div
          v-if="canViewField('customer_phone')"
          class="form-group"
        >
          <label class="form-label required">手机号码</label>
          <div class="customer-search-container">
            <el-input
              v-model="saleForm.customer_phone"
              placeholder="请输入用户手机号"
              maxlength="11"
              clearable
              :readonly="selectedCustomer !== null"
              :class="{ locked: selectedCustomer !== null }"
              @input="emit('customer-search', $event)"
              @focus="showCustomerSearch = true"
            />
            <div
              v-if="showCustomerSearch && (customerSearchResults.length > 0 || customerSearching || (saleForm.customer_phone.length >= 11 && !selectedCustomer && !customerSearching))"
              class="customer-search-results"
            >
              <div
                v-if="customerSearching"
                class="search-loading"
              >
                <InlineLoading
                  text="搜索中..."
                  size="small"
                />
              </div>
              <template v-else>
                <div
                  v-for="customer in customerSearchResults"
                  :key="customer.id"
                  class="customer-item"
                  @click="emit('select-customer', customer)"
                >
                  <div class="customer-info">
                    <div class="customer-headline">
                      <div class="customer-name">
                        {{ customer.name }}
                      </div>
                      <span
                        v-if="customer.member_number"
                        class="member-number"
                      >{{ customer.member_number }}</span>
                    </div>
                    <div class="customer-subline">
                      <span class="customer-phone">{{ customer.phone }}</span>
                      <span class="vip-badge">{{ getVipLabel(customer.vip_level) }}</span>
                    </div>
                  </div>
                </div>
                <div
                  v-if="saleForm.customer_phone.length >= 11 && customerSearchResults.length === 0 && !selectedCustomer"
                  class="create-new-customer"
                  @click="emit('create-customer')"
                >
                  <i class="fas fa-user-plus" />
                  点击创建该用户
                </div>
              </template>
            </div>
          </div>
        </div>
        <div
          v-if="canViewField('customer_name')"
          class="form-group"
        >
          <label class="form-label">客户姓名</label>
          <div class="input-group">
            <el-input
              ref="customerNameInputRef"
              v-model="saleForm.customer_name"
              name="sale-customer-name"
              placeholder=""
              :readonly="!selectedCustomer && !customerCreating ? true : !customerNameEditing"
              :class="{ editable: selectedCustomer || customerCreating }"
              @dblclick="emit('enable-name-edit', $event)"
              @touchend="emit('name-touch-end', $event)"
              @input="emit('name-input', $event)"
              @blur="emit('name-blur')"
              @keyup.enter="emit('save-name')"
            />
            <el-button
              v-if="customerNameEditing"
              class="customer-lock-button"
              type="success"
              plain
              title="当前已解锁，点击保存并锁定"
              @click="emit('save-name')"
            >
              <i class="fas fa-lock-open" />
            </el-button>
            <el-button
              v-if="selectedCustomer !== null && !customerNameEditing"
              class="customer-lock-button"
              type="info"
              plain
              title="当前已锁定，点击清除客户选择"
              @click="emit('clear-customer')"
            >
              <i class="fas fa-lock" />
            </el-button>
          </div>
        </div>
      </div>

      <div class="form-grid">
        <div
          v-if="canViewField('customer_apple_id')"
          class="form-group"
        >
          <label class="form-label">Apple ID</label>
          <el-input
            v-model="saleForm.customer_apple_id"
            placeholder="客户Apple ID（可选）"
            clearable
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
            value-format="YYYY-MM-DD"
            format="YYYY-M-D"
            placeholder="请选择销售时间"
            required
          />
        </div>
      </div>

      <div class="form-grid">
        <div
          v-if="canViewPrice"
          class="form-group"
        >
          <label class="form-label">入库价格</label>
          <el-input
            v-model="saleForm.purchase_cost"
            type="number"
            placeholder="请输入入库价格"
            @input="emit('calculate-profit')"
          />
        </div>
        <div
          v-if="canViewField('sale_price')"
          class="form-group"
        >
          <label class="form-label required">{{ batchMode ? '销售单价' : '销售价格' }}</label>
          <el-input
            v-model="saleForm.sale_price"
            type="number"
            placeholder="请输入销售价格"
            required
            @input="emit('calculate-profit')"
          />
        </div>
      </div>

      <div class="form-grid">
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
            teleported
            popper-class="tf2025-form-popper"
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

      <div class="form-grid">
        <div
          v-if="canViewField('payment_method')"
          class="form-group"
        >
          <label class="form-label required">支付方式</label>
          <el-select
            v-model="saleForm.payment_method"
            placeholder="请选择支付方式"
            class="w-full"
            clearable
            teleported
            popper-class="tf2025-form-popper"
            @change="emit('payment-method-change')"
          >
            <el-option
              label="现金支付"
              value="cash"
            />
            <el-option
              label="移动支付"
              value="mobile"
            />
            <el-option
              label="银行卡"
              value="bank_card"
            />
            <el-option
              label="国补刷卡"
              value="subsidy_card"
            />
          </el-select>
        </div>
        <div
          v-if="canViewField('payment_method') && ['mobile', 'bank_card', 'subsidy_card'].includes(saleForm.payment_method)"
          class="form-group"
        >
          <label class="form-label">支付渠道</label>
          <el-select
            v-model="saleForm.payment_channel"
            placeholder="请选择支付渠道"
            class="w-full"
            clearable
            teleported
            popper-class="tf2025-form-popper"
            @change="emit('payment-channel-change')"
          >
            <template v-if="saleForm.payment_method === 'mobile'">
              <el-option
                label="微信"
                value="wechat"
              />
              <el-option
                label="支付宝"
                value="alipay"
              />
            </template>
            <template v-if="saleForm.payment_method === 'bank_card'">
              <el-option
                label="刷卡消费"
                value="card_consumption"
              />
              <el-option
                label="银行转账"
                value="bank_transfer"
              />
            </template>
            <template v-if="saleForm.payment_method === 'subsidy_card'">
              <el-option
                label="国补刷卡"
                value="subsidy_card"
              />
            </template>
          </el-select>
        </div>
      </div>

      <div
        v-if="canViewField('transaction_no') && (saleForm.payment_method === 'mobile' || saleForm.payment_method === 'transfer')"
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
          type="textarea"
          :rows="3"
          placeholder="销售备注信息"
          resize="none"
        />
      </div>

      <div
        v-if="profit !== null && canViewPrice"
        class="profit-calculator"
      >
        <h5>利润计算</h5>
        <div class="profit-rows">
          <div class="profit-row">
            <span class="profit-label">进价:</span>
            <span class="profit-value">¥{{ formatNumber(saleForm.purchase_cost || selectedPhone?.purchase_cost || 0) }}</span>
          </div>
          <div class="profit-row">
            <span class="profit-label">销售价:</span>
            <span class="profit-value">¥{{ saleForm.sale_price }}</span>
          </div>
          <div
            class="profit-row total"
            :class="profitClass"
          >
            <span class="profit-label">销售利润:</span>
            <span class="profit-value">¥{{ profit }}</span>
          </div>
          <div
            class="profit-row margin"
            :class="profitClass"
          >
            <span class="profit-label">利润率:</span>
            <span class="profit-value">{{ profitMargin }}%</span>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'
import { formatNumber } from '@/utils/format'
import type { Operator, Phone, Store } from '@/types'
import type { SalesCheckoutFormData, SalesCustomer } from '../types'

interface CustomerNameInputInstance {
  input?: HTMLInputElement
  $el?: HTMLElement
}

const props = defineProps<{
  form: SalesCheckoutFormData
  selectedCustomer: SalesCustomer | null
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
  submit: []
}>()

const saleForm = props.form
const customerNameInputRef = ref<CustomerNameInputInstance | null>(null)
const customerNameInput = computed(() => customerNameInputRef.value?.input || null)
const showCustomerSearch = computed({
  get: () => props.showCustomerSearch,
  set: value => emit('update:showCustomerSearch', value)
})

const getVipLabel = (vipLevel?: string) => {
  const labels: Record<string, string> = {
    normal: '普通',
    silver: '银卡',
    gold: '金卡',
    platinum: '白金'
  }
  return labels[vipLevel || 'normal'] || '普通'
}

defineExpose({ input: customerNameInput })
</script>

<style scoped lang="scss" src="../styles/sales-checkout-form.scss"></style>
