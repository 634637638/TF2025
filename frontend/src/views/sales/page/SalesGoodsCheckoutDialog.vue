<template>
  <!-- 商品收银选购工作台显式宽度为 900px，窄屏收缩由公共弹窗统一处理。 -->
  <MobileDialog
    :model-value="modelValue"
    :title="completed ? '收款成功' : filmCustomerId ? '贴膜收银' : phones.length ? '附加商品' : checkoutStep === 'payment' ? '订单结算' : '商品收银'"
    :width="completed ? '480px' : phones.length ? undefined : filmCustomerId ? '560px' : checkoutStep === 'shopping' ? '900px' : undefined"
    :show-default-footer="false"
    :close-on-click-modal="false"
    :before-close="beforeClose"
    destroy-on-close
    @update:model-value="updateVisible"
  >
    <SectionLoading
      v-if="loading"
      :text="filmCustomerId ? '正在读取收款资料...' : '正在读取销售门店与人员...'"
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
    <el-alert
      v-else-if="phoneContextError"
      type="warning"
      :title="phoneContextError"
      :closable="false"
    />
    <section
      v-else-if="completed"
      class="checkout-success"
      role="status"
    >
      <div class="checkout-success__hero">
        <span
          class="checkout-success__icon"
          aria-hidden="true"
        >
          <el-icon><Check /></el-icon>
        </span>
        <h2>收款成功</h2>
        <p>商品已出库，本单已完成结算</p>
      </div>
      <div class="checkout-success__receipt">
        <div class="checkout-success__line">
          <span class="text-secondary">销售单号</span>
          <strong v-if="canViewAccessoryField('sequence')">{{ completed.order_no }}</strong>
        </div>
        <div
          v-if="canViewAccessoryField('total_price')"
          class="checkout-success__line checkout-success__points"
        >
          <span>消耗积分 {{ completed.points_used }} · 获得积分 {{ completed.points_earned }}</span>
        </div>
        <div
          v-if="canViewAccessoryField('total_price')"
          class="checkout-success__line checkout-success__paid"
        >
          <strong>实际收款</strong>
          <strong>{{ completedPaid === null ? '请查看原单核对' : `¥${formatAmount(completedPaid)}` }}</strong>
        </div>
      </div>
    </section>
    <el-form
      v-else
      class="tf-dialog-form tf-dialog-form--stacked tf-form-layout tf-form-grid"
      label-position="top"
      :disabled="formDisabled"
      @submit.prevent="submit"
    >
      <div
        v-if="phones.length || standalone && checkoutStep === 'payment' && memberContextReady"
        class="form-section mb-4"
      >
        <SectionLoading
          v-if="memberLoading"
          text="正在读取会员资料..."
        />
        <el-alert
          v-if="memberFailed"
          type="warning"
          title="会员资料读取失败"
          :closable="false"
        >
          <el-button
            :disabled="formDisabled"
            @click="loadMemberSummary"
          >
            重试
          </el-button>
        </el-alert>
        <div class="tf-dialog-toolbar">
          <el-tag
            v-if="memberFieldVisible('member_number')"
            class="tf-tag--wrap"
            type="primary"
            effect="light"
            size="large"
          >
            会员号：{{ memberSummary?.member_number || '-' }}
          </el-tag>
          <el-tag
            class="tf-tag--wrap"
            type="success"
            effect="light"
            size="large"
          >
            姓名：{{ form.customer_name }}
          </el-tag>
          <el-tag
            v-if="memberFieldVisible('points')"
            class="tf-tag--wrap"
            type="warning"
            effect="light"
            size="large"
          >
            账户积分：{{ memberSummary?.points ?? '-' }}
          </el-tag>
          <el-tag
            v-if="phones.length && memberFieldVisible('points')"
            class="tf-tag--wrap"
            type="primary"
            effect="light"
            size="large"
          >
            可用积分：{{ memberSummary?.available_points ?? '-' }}
          </el-tag>
          <el-tag
            v-if="memberFieldVisible('balance')"
            class="tf-tag--wrap"
            type="success"
            effect="light"
            size="large"
          >
            余额：¥{{ formatAmount(memberSummary?.balance ?? 0) }}
          </el-tag>
        </div>
      </div>
      <SalesAdditionalGoods
        v-if="phones.length || !filmCustomerId"
        v-show="!standalone || checkoutStep === 'shopping'"
        v-model="goods"
        :store-id="Number(form.store_id) || null"
        :phones="phones"
        :disabled="formDisabled || !modelValue || standalone && checkoutStep !== 'shopping'"
        :standalone="standalone"
        :field-source="effectiveFieldSource"
        @busy="goodsResolving = $event"
      >
        <template
          v-if="standalone"
          #store
        >
          <el-form-item
            label="销售门店"
            required
          >
            <el-select
              v-model="form.store_id"
              filterable
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :value="Number(store.id)"
                :label="store.name"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            label="销售员"
            required
          >
            <el-select
              v-model="form.operator_id"
              filterable
              remote
              :remote-method="searchSellers"
              :disabled="formDisabled || Boolean(filmCustomerId)"
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
        </template>
        <template
          v-if="standalone"
          #checkout
        >
          <el-button
            v-permission="filmCustomerId ? { permission: ['query:view', 'query:film'], mode: 'all' } : { permission: ['accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift'] }"
            type="primary"
            class="checkout-cart-confirm"
            :disabled="formDisabled || goodsResolving || !goods.length || !fieldsAllowed"
            @click="enterCheckout"
          >
            确认结算
          </el-button>
        </template>
      </SalesAdditionalGoods>
      <div
        v-show="!standalone || checkoutStep === 'payment'"
        class="checkout-payment"
      >
        <section
          v-if="filmCustomerId"
          class="film-cashier-summary"
          aria-label="贴膜订单金额"
        >
          <span class="film-cashier-summary__label">应收金额</span>
          <strong class="film-cashier-summary__amount">¥{{ formatAmount(filmOriginalAmount) }}</strong>
          <div class="film-cashier-summary__details">
            <span>积分抵扣 ¥{{ formatAmount(filmPointsDeduction) }}</span>
            <span>优惠 ¥{{ formatAmount(filmManualDiscount) }}</span>
            <strong>实收 ¥{{ formatAmount(filmTenderedAmount) }}</strong>
            <span>找零 ¥{{ formatAmount(filmChange) }}</span>
          </div>
          <el-button
            v-if="filmGiftAllowed"
            class="film-cashier-gift"
            :type="filmGiftSelected ? 'warning' : 'default'"
            plain
            :disabled="formDisabled || !goods.length"
            @click="toggleFilmGift"
          >
            {{ filmGiftSelected ? '改为销售' : '赠送' }}
          </el-button>
        </section>
        <div
          v-if="filmCustomerId && canViewAccessoryField('total_price')"
          class="film-cashier-points"
        >
          <template v-if="memberFieldVisible('points')">
            <span>可用积分：{{ memberSummary?.available_points ?? '-' }}</span>
            <el-button
              v-permission="{ permission: ['query:view', 'query:film'], mode: 'all' }"
              :loading="quoteLoading"
              :disabled="formDisabled || memberLoading || memberFailed || !goods.length || !hasRedemption && !canRedeemPoints"
              @click="applyPoints"
            >
              {{ hasRedemption ? '取消积分抵扣' : '积分抵扣' }}
            </el-button>
          </template>
          <el-form-item
            v-if="!filmGiftSelected"
            label="收款"
            class="film-cashier-entry tf-form-field--inline"
          >
            <AmountInput
              v-model="filmActualAmount"
              :min="0"
              :max="99999999.99"
              placeholder="请输入收款金额"
              aria-label="收款"
            />
          </el-form-item>
          <span
            v-if="!filmGiftSelected"
            class="film-cashier-entry__change"
          >找零：¥{{ formatAmount(filmChange) }}</span>
        </div>
        <section
          v-if="standalone"
          class="checkout-payment__summary"
        >
          <div class="checkout-payment__amount">
            <span class="text-secondary">{{ hasRedemption && !pointsQuote ? '抵扣前金额' : '应收金额' }}</span>
            <strong
              v-if="canViewAccessoryField('total_price')"
              class="checkout-payable"
            >¥{{ formatAmount(payableAmount) }}</strong>
            <span class="text-secondary">{{ goodsCount }} 件商品 · {{ stores.find(store => Number(store.id) === Number(form.store_id))?.name }}</span>
          </div>
          <div class="checkout-payment__lines tf-scrollbar-hidden">
            <div
              v-for="row in goods"
              :key="row.key"
              class="checkout-payment__line"
            >
              <span>{{ row.option?.name }} <el-tag :type="row.sale_type === 'gift' ? 'warning' : 'success'">{{ row.sale_type === 'gift' ? '赠送' : '销售' }}</el-tag></span>
              <span>× {{ row.serial_mode ? row.serial_numbers.length : row.quantity }}</span>
            </div>
          </div>
        </section>
        <el-row
          v-if="!phones.length"
          :gutter="16"
        >
          <el-col
            v-if="!filmCustomerId && canViewAccessoryField('customer_phone')"
            :xs="12"
            :sm="6"
          >
            <el-form-item
              :label="filmCustomerId ? '客户手机号' : '手机号'"
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
                  :allow-create="standalone"
                  :create-min-query-length="11"
                  @select="selectCustomer"
                  @create="createCustomer"
                />
              </div>
            </el-form-item>
          </el-col>
          <el-col
            v-if="!filmCustomerId"
            :xs="12"
            :sm="6"
          >
            <el-form-item
              :label="filmCustomerId ? '客户姓名' : '姓名'"
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
              :label="filmCustomerId ? '销售时间' : '销售日期'"
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
            v-if="!standalone && !filmCustomerId"
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
                :disabled="formDisabled || Boolean(filmCustomerId)"
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
              :label="filmCustomerId ? '收款方式' : '支付方式'"
              required
            >
              <PaymentMethodSelect
                v-model="form.payment_method"
                :disabled="formDisabled || giftOnlyOrder"
                @update:model-value="resetPayment"
              />
            </el-form-item>
          </el-col>
          <el-col
            v-if="!giftOnlyOrder && hasPaymentChannelOptions(form.payment_method)"
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
        </el-row>
        <div v-show="!filmCustomerId">
          <template v-if="filmCustomerId && !phones.length">
            <SalesGoodsLine
              v-for="(row, index) in goods"
              :key="row.key"
              v-model="goods[index]"
              :store-id="Number(form.store_id) || null"
              :phones="phones"
              :disabled="formDisabled"
              :field-source="effectiveFieldSource"
              :film-only="Boolean(filmCustomerId)"
              :film-model-id="filmModelId"
              :film-customer-id="filmCustomerId"
              :film-phone-id="filmPhoneId"
              :allow-gift="!filmCustomerId || filmGiftAllowed"
              @remove="goods.splice(index, 1)"
            />
          </template>
        </div>
        <el-space
          v-if="!filmCustomerId"
          class="mb-4"
          :class="{ 'tf-dialog-toolbar': Boolean(filmCustomerId) }"
          size="small"
          wrap
        >
          <el-button
            v-if="filmCustomerId && canViewAccessoryField('total_price')"
            v-permission="filmCustomerId ? { permission: ['query:view', 'query:film'], mode: 'all' } : { permission: ['accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift'] }"
            :loading="quoteLoading"
            :disabled="saving || nameSaving || uncertain || goodsResolving || !goods.length"
            @click="refreshQuote"
          >
            积分试算
          </el-button>
          <el-tag
            v-if="standalone && memberFieldVisible('points')"
            class="tf-tag--wrap"
            type="primary"
            effect="light"
          >
            可用积分：{{ memberSummary?.available_points ?? '-' }}
          </el-tag>
          <strong v-if="canViewAccessoryField('total_price')">{{ hasRedemption && !pointsQuote ? '整单原价' : '本单实收' }}：¥{{ formatAmount(pointsQuote ? pointsQuote.payable_cents / 100 : totalAmount) }}</strong>
          <el-button
            v-if="(phones.length || standalone) && canViewAccessoryField('total_price') && memberFieldVisible('points')"
            v-permission="filmCustomerId ? { permission: ['query:view', 'query:film'], mode: 'all' } : { permission: ['accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift'] }"
            :loading="quoteLoading"
            :disabled="formDisabled || goodsResolving || !goods.length || memberLoading || memberFailed || !hasRedemption && !canRedeemPoints"
            @click="applyPoints"
          >
            {{ hasRedemption ? '取消抵扣' : '积分抵扣' }}
          </el-button>
        </el-space>
        <el-alert
          v-if="pointsQuote && !filmCustomerId && canViewAccessoryField('total_price')"
          type="info"
          :closable="false"
          class="mb-4"
        >
          <template #title>
            <span
              class="checkout-points-summary"
              role="status"
            >
              <span class="text-primary">可用积分 <strong>{{ pointsQuote.available_points }}</strong></span>
              <span class="checkout-points-summary__separator">·</span>
              <span class="text-warning">本单抵扣 <strong>{{ pointsQuote.points_used }}</strong> 积分（¥{{ formatAmount(pointsQuote.deduction_cents / 100) }}）</span>
              <span class="checkout-points-summary__separator">·</span>
              <span class="text-success">剩余 <strong>{{ pointsQuote.balance_after }}</strong> 积分</span>
              <span
                v-if="!pointsQuote.redemption_ready"
                class="text-muted"
              >（当前未启用积分抵扣）</span>
            </span>
          </template>
        </el-alert>
        <el-alert
          v-else-if="hasRedemption && !filmCustomerId"
          type="warning"
          :title="filmCustomerId ? '请先进行积分试算，核对抵扣后的实收金额。' : '请重新点击积分抵扣，核对抵扣后的实收金额。'"
          :closable="false"
          class="mb-4"
        />
        <el-form-item
          v-if="showRemarks && !phones.length && !filmCustomerId"
          class="tf-form-field--wide"
          label="整单备注"
        >
          <el-input
            v-model="form.remarks"
            type="textarea"
            class="tf-textarea"
            :rows="2"
            :maxlength="1000"
          />
        </el-form-item>
        <div
          v-if="standalone && !giftOnlyOrder && canViewAccessoryField('total_price') && form.payment_method === 'cash'"
          class="checkout-cash-row"
        >
          <el-form-item
            label="现金收取"
            class="tf-form-field--inline checkout-cash-row__tender"
          >
            <AmountInput
              v-model="cashTendered"
              :min="0"
              :max="99999999.99"
              placeholder="不填写则按应收金额收取"
              aria-label="现金收取"
              :disabled="formDisabled || giftOnlyOrder"
            />
          </el-form-item>
          <el-form-item
            label="找零"
            class="tf-form-field--inline checkout-cash-row__change"
          >
            <strong aria-live="polite">{{ cashTendered === null || cashTendered === undefined ? '¥0' : cashChange < 0 ? `还差 ¥${formatAmount(-cashChange)}` : `退还 ¥${formatAmount(cashChange)}` }}</strong>
          </el-form-item>
        </div>
        <el-alert
          v-if="uncertain"
          type="warning"
          title="提交结果尚未确认，请保留原内容重试，或先到综合查询核对单据。"
          :closable="false"
        />
      </div>
    </el-form>
    <CheckoutOrderDialog
      v-if="receiptOpen && receiptSaleId"
      v-model="receiptOpen"
      :sale-id="receiptSaleId"
      source="goods"
      receipt
    />
    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          :disabled="saving || nameSaving"
          @click="requestClose"
        >
          {{ completed ? '完成' : '取消' }}
        </el-button>
        <el-button
          v-if="standalone && checkoutStep === 'payment' && !completed"
          :disabled="formDisabled"
          @click="checkoutStep = 'shopping'"
        >
          返回选购
        </el-button>
        <el-button
          v-if="completed && receiptSaleId && queryPermissions.canView.value"
          v-permission="{ permission: ['query:view', 'query:goods-view'], mode: 'all' }"
          type="primary"
          @click="receiptOpen = true"
        >
          查看 / 打印凭证
        </el-button>
        <el-button
          v-else-if="!completed && (!standalone || checkoutStep === 'payment')"
          v-permission="filmCustomerId ? { permission: ['query:view', 'query:film'], mode: 'all' } : { permission: ['accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift'] }"
          type="primary"
          :loading="saving"
          :disabled="loading || quoteLoading || goodsResolving || failed || !fieldsAllowed || !!phoneContextError || nameEditing || nameSaving || (!phones.length && !goods.length)"
          @click="submit"
        >
          {{ filmCustomerId ? '确认收款' : phones.length ? '确认添加' : '确认收款' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, reactive, ref, watch } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { checkoutSale, getCheckoutCustomerSummary, getFilmCustomerSummary, quoteCheckoutSale } from '@/api/sales-checkout'
import { getStores, searchOperators, type ReferenceRecord } from '@/services/reference-options'
import { createCustomerProfile, searchCustomerOptions, type CustomerOption } from '@/services/customer-options'
import { unifiedApi } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useNotification } from '@/composables/useNotification'
import { useGoodsPermissions } from '@/composables/useGoodsPermissions'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useTouchDoubleTap } from '@/composables/useTouchDoubleTap'
import { isValidCustomerName, isValidMobilePhone, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import { formatAmount } from '@/utils/format'
import { SALE_PAYMENT_METHODS, getPaymentChannelOptions, hasPaymentChannelOptions } from '@/constants/paymentMethods'
import { buildCheckoutInput, checkoutPointsContext, createCheckoutKey, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import { canViewAccessoryField as canViewStockField, canViewQueryGoodsField, ACCESSORY_FIELD_IDS, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import CustomerSearchDropdown, { type CustomerSearchDropdownItem } from '@/components/common/CustomerSearchDropdown.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import SalesGoodsLine from './SalesGoodsLine.vue'
import SalesAdditionalGoods from './SalesAdditionalGoods.vue'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import type { CheckoutAdditionalGoodsDraft, CheckoutCustomerSummary, CheckoutPointsQuote, CheckoutCustomerForm, CheckoutGoodsDraft, CheckoutGoodsOption, CheckoutPhone, CheckoutQuickPhone, SalesCheckoutResult } from '@/types/sales-checkout'
const customerPermissions = usePagePermissions('customers')

const props = withDefaults(defineProps<{ modelValue: boolean; fieldSource?: 'accessories' | 'query'; phones?: CheckoutPhone[]; quickPhone?: CheckoutQuickPhone; defaults?: Partial<CheckoutCustomerForm>; initialSelection?: CheckoutAdditionalGoodsDraft | null; initialFilmProduct?: CheckoutGoodsOption | null; initialCustomer?: Pick<CustomerOption, 'id' | 'name'> & Partial<Pick<CustomerOption, 'phone'>> | null; filmCustomerId?: number; filmPhoneId?: number; filmModelId?: number; filmEligibleForFree?: boolean; phoneFieldsAllowed?: boolean; phoneFieldVisible?: (field: string) => boolean }>(), { fieldSource: undefined, phones: () => [], quickPhone: undefined, defaults: () => ({}), initialSelection: null, initialFilmProduct: null, initialCustomer: null, filmCustomerId: undefined, filmPhoneId: undefined, filmModelId: undefined, filmEligibleForFree: false, phoneFieldsAllowed: true, phoneFieldVisible: () => true })
const effectiveFieldSource = computed(() => props.filmCustomerId ? 'accessories' : props.fieldSource || permissions.source.value)
const canViewAccessoryField = (field: AccessoryFieldName) => effectiveFieldSource.value === 'query' ? canViewQueryGoodsField(field) : canViewStockField(field)
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [draft: CheckoutAdditionalGoodsDraft | null]; success: [result: SalesCheckoutResult]; 'customer-updated': [customer: Pick<CustomerOption, 'id' | 'name' | 'phone'>] }>()
const CheckoutOrderDialog = defineAsyncComponent(() => import('@/components/query/CheckoutOrderDialog.vue'))
const standalone = computed(() => !props.phones.length && !props.filmCustomerId)
const checkoutStep = ref<'shopping' | 'payment'>('shopping')
const completed = ref<SalesCheckoutResult | null>(null)
const completedPaid = computed(() => {
  const result = completed.value
  if (!result) return null
  if (result.paid_amount !== undefined) return result.paid_amount
  if (result.points_used && result.deduction_amount === undefined) return null
  return (Math.round(result.total_amount * 100) - Math.round((result.deduction_amount || 0) * 100)) / 100
})
const receiptOpen = ref(false)
const receiptSaleId = computed(() => {
  const id = completed.value?.items?.find(row => row.type === 'accessory')?.accessory_sale_id
  return Number.isSafeInteger(id) && Number(id) > 0 ? Number(id) : null
})
const cashTendered = ref<number | null | undefined>(null)
const filmActualAmount = ref<number | null>(null)
const filmPointsQuotedAmount = ref<number | null>(null)
const enterCheckout = () => {
  if (!standalone.value || formDisabled.value || goodsResolving.value || !goods.value.length || !fieldsAllowed.value) return
  if (!Number.isSafeInteger(Number(form.operator_id)) || Number(form.operator_id) <= 0) { notices.error('请选择销售员'); return }
  checkoutStep.value = 'payment'
}
const auth = useAuthStore()
const permissions = useGoodsPermissions()
const phonePermissions = usePagePermissions('sales')
const inventoryPermissions = usePagePermissions('inventory')
const queryPermissions = usePagePermissions('query')
const notices = useNotification()
const requests = useLatestRequest(), customerRequests = useLatestRequest(), sellerRequests = useLatestRequest(), quoteRequests = useLatestRequest()
const form = reactive<CheckoutCustomerForm>({ customer_name: '', customer_phone: '', store_id: '', operator_id: '', sale_time: '', payment_method: '', payment_channel: '', transaction_no: '', remarks: '' })
const goods = ref<CheckoutGoodsDraft[]>([])
const stores = ref<ReferenceRecord[]>([]), operators = ref<ReferenceRecord[]>([])
const customers = ref<CustomerSearchDropdownItem[]>([]), selectedCustomer = ref<CustomerOption | null>(null)
const loading = ref(false), failed = ref(false), saving = ref(false), uncertain = ref(false), customerLoading = ref(false), customerCreating = ref(false), sellerLoading = ref(false)
const showCustomerSearch = ref(false), nameEditing = ref(false), nameSaving = ref(false)
const pointsQuote = ref<CheckoutPointsQuote | null>(null), quoteLoading = ref(false)
const goodsResolving = ref(false)
const automaticPoints = ref<Record<string, number>>({})
const memberRequests = useLatestRequest(), memberSummary = ref<CheckoutCustomerSummary | null>(null), memberLoading = ref(false), memberFailed = ref(false)
const canRedeemPoints = computed(() => Number.isSafeInteger(memberSummary.value?.available_points) && Number(memberSummary.value?.available_points) > 0)
const memberFieldVisible = (field: 'member_number' | 'points' | 'balance') => fieldPermissions.isFieldVisible('customers_customersview', `customer.${field}`)
const memberContextReady = computed(() => props.modelValue && fieldsAllowed.value && canAddGoods.value && Number(form.store_id) > 0 &&
  (props.filmCustomerId || props.phones.length > 0 || standalone.value && checkoutStep.value === 'payment') &&
  (props.filmCustomerId || isValidMobilePhone(normalizePhoneDigits(form.customer_phone))))
const loadMemberSummary = async () => {
  if (!memberContextReady.value) return
  const request = memberRequests.nextRequest(); memberSummary.value = null; memberLoading.value = true; memberFailed.value = false
  try {
    const params = { phone: normalizePhoneDigits(form.customer_phone), store_id: Number(form.store_id), context: props.phones.length ? 'phone' as const : 'goods' as const }
    const response = props.filmCustomerId
      ? await getFilmCustomerSummary(props.filmCustomerId, Number(form.store_id), request.signal)
      : effectiveFieldSource.value === 'query'
        ? await getCheckoutCustomerSummary(params, request.signal, 'query')
        : await getCheckoutCustomerSummary(params, request.signal)
    if (!request.isLatest() || !props.modelValue) return
    if (!response.success || !response.data) throw new Error('会员资料不完整')
    memberSummary.value = response.data
  } catch { if (request.isLatest()) memberFailed.value = true }
  finally { if (request.isLatest()) memberLoading.value = false }
}
const formDisabled = computed(() => saving.value || nameSaving.value || quoteLoading.value || uncertain.value)
let quotedInput = ''
const invalidatePointsQuote = () => { quoteRequests.cancelLatest(); pointsQuote.value = null; automaticPoints.value = {}; filmPointsQuotedAmount.value = null; quoteLoading.value = false; quotedInput = '' }
const hasRedemption = computed(() => {
  if (props.filmCustomerId || props.phones.length || standalone.value) return Object.values(automaticPoints.value).some(value => value > 0)
  return goods.value.some(row => Number(row.redeem_points) > 0)
})
let requestKey = ''
const requiredFields: AccessoryFieldName[] = ['name', 'distribution', 'total_quantity', 'unit_price', 'usage_type', 'customer_name', 'created_at', 'operator_name']
const filmAllowed = computed(() => !!props.filmCustomerId && queryPermissions.canView.value && queryPermissions.hasPermission('film'))
const canViewCheckout = computed(() => props.filmCustomerId ? filmAllowed.value : permissions.canView.value)
const fieldsAllowed = computed(() => canViewCheckout.value && props.phoneFieldsAllowed && requiredFields.every(canViewAccessoryField) &&
  (!props.filmCustomerId || canViewAccessoryField('customer_name')) &&
  (!props.filmCustomerId || queryPermissions.canView.value && queryPermissions.hasPermission('film') &&
    !!props.filmPhoneId && !!props.filmModelId && props.initialCustomer?.id === props.filmCustomerId && !props.phones.length && !props.quickPhone && canViewAccessoryField('category') && canViewAccessoryField('total_price')))
const canAddGoods = computed(() => props.filmCustomerId ? filmAllowed.value : permissions.canCreate.value || permissions.hasPermission('gift'))
const showRemarks = computed(() => canViewAccessoryField('remarks') && (!props.phones.length || props.phoneFieldVisible('remarks')))
const phoneContextError = computed(() => {
  if (!props.phones.length) return ''
  const missing: string[] = []
  if (normalizePersonName(form.customer_name, 50).length < 2) missing.push('客户姓名')
  if (!isValidMobilePhone(normalizePhoneDigits(form.customer_phone))) missing.push('客户手机号')
  if (!Number.isSafeInteger(Number(form.store_id)) || Number(form.store_id) <= 0) missing.push('销售门店')
  if (!Number.isSafeInteger(Number(form.operator_id)) || Number(form.operator_id) <= 0) missing.push('销售员')
  if (!form.sale_time || !TimeUtil.isValid(form.sale_time, TIME_FORMATS.DATE)) missing.push('销售日期')
  if (!SALE_PAYMENT_METHODS.some(option => option.value === form.payment_method)) missing.push('支付方式')
  else if (hasPaymentChannelOptions(form.payment_method) && !getPaymentChannelOptions(form.payment_method).some(option => option.value === form.payment_channel)) missing.push('支付渠道')
  return missing.length ? `请关闭此窗口，在手机销售表单完善${missing.join('、')}后再添加商品` : ''
})
const totalAmount = computed(() => props.phones.reduce((sum, phone) => sum + Math.round(phone.sale_price * 100), 0) / 100 + goods.value.reduce((sum, row) => sum + (row.sale_type === 'gift' ? 0 : Math.round(Number(row.unit_price || 0) * 100) * (row.serial_mode ? row.serial_numbers.length : row.quantity)), 0) / 100)
const goodsCount = computed(() => goods.value.reduce((sum, row) => sum + (row.serial_mode ? row.serial_numbers.length : row.quantity || 0), 0))
const payableAmount = computed(() => pointsQuote.value ? pointsQuote.value.payable_cents / 100 : totalAmount.value)
const giftOnlyOrder = computed(() => standalone.value && goods.value.length > 0 && goods.value.every(row => row.sale_type === 'gift' || Number(row.unit_price) === 0))
const cashChange = computed(() => giftOnlyOrder.value ? 0 : (Math.round(Number(cashTendered.value || 0) * 100) - Math.round(payableAmount.value * 100)) / 100)
const filmOriginalAmount = computed(() => props.filmCustomerId ? goods.value.reduce((sum, row) => {
  if (row.sale_type === 'gift') return sum
  const quantity = row.serial_mode ? row.serial_numbers.length : row.quantity
  return sum + Math.round(Number(row.unit_price || 0) * quantity * 100) / 100
}, 0) : 0)
const filmPointsDeduction = computed(() => props.filmCustomerId && pointsQuote.value ? Math.max(0, pointsQuote.value.deduction_cents / 100) : 0)
const filmPayableAmount = computed(() => Math.max(0, Math.round((filmOriginalAmount.value - filmPointsDeduction.value) * 100) / 100))
const filmGiftAllowed = computed(() => Boolean(props.filmCustomerId) && permissions.canGift.value)
const filmGiftSelected = computed(() => Boolean(props.filmCustomerId && goods.value[0]?.sale_type === 'gift'))
const filmTenderedAmount = computed(() => {
  const value = filmActualAmount.value === null || filmActualAmount.value === undefined ? filmPayableAmount.value : Number(filmActualAmount.value)
  return Number.isFinite(value) ? Math.max(0, value) : filmPayableAmount.value
})
const filmActualAmountValue = computed(() => Math.min(filmTenderedAmount.value, filmPayableAmount.value))
const filmChange = computed(() => Math.max(0, Math.round((filmTenderedAmount.value - filmPayableAmount.value) * 100) / 100))
const filmManualDiscount = computed(() => props.filmCustomerId
  ? Math.max(0, Math.round((filmPayableAmount.value - filmTenderedAmount.value) * 100) / 100)
  : 0)
const toggleFilmGift = () => {
  if (!filmGiftAllowed.value || !goods.value.length || formDisabled.value) return
  const selected = filmGiftSelected.value
  goods.value = goods.value.map(row => ({ ...row,
    sale_type: selected ? 'sale' : 'gift',
    unit_price: selected ? row.option?.sale_price === null || row.option?.sale_price === undefined ? null : Number(row.option.sale_price) : 0,
    redeem_points: 0,
    gift_return_unit_price: null }))
  filmActualAmount.value = selected ? goods.value[0]?.unit_price ?? null : 0
  invalidatePointsQuote()
}
const addFilmGoods = () => {
  if (formDisabled.value || !canAddGoods.value) return
  const option = props.initialFilmProduct
  const unitPrice = option?.sale_price === null || option?.sale_price === undefined ? null : Number(option.sale_price)
  goods.value.push({ key: createCheckoutKey(), option, quantity: 1, unit_price: unitPrice,
    sale_type: props.filmCustomerId || permissions.canCreate.value ? 'sale' : 'gift', linked_phone_id: null,
    serial_mode: false, serial_numbers: [], gift_return_unit_price: null })
  filmActualAmount.value = unitPrice === null ? null : unitPrice
}
const clearCustomer = () => { customerRequests.cancelLatest(); selectedCustomer.value = null; form.customer_name = form.customer_phone = ''; form.apple_id = undefined; nameEditing.value = false; customers.value = []; customerLoading.value = false }
const selectCustomer = (customer: CustomerSearchDropdownItem, preserveAppleId = false) => {
  customerRequests.cancelLatest(); customerLoading.value = false
  if (!preserveAppleId) form.apple_id = undefined
  selectedCustomer.value = { ...customer }; form.customer_name = customer.name; form.customer_phone = customer.phone; nameEditing.value = false; showCustomerSearch.value = false
}
const createCustomer = async () => {
  if (!customerPermissions.requirePermission('create')) return
  if (!standalone.value || customerCreating.value || saving.value || uncertain.value) return
  const phone = normalizePhoneDigits(form.customer_phone)
  const name = normalizePersonName(form.customer_name, 50)
  if (!isValidMobilePhone(phone)) { notices.warning('请输入有效的手机号码后再创建客户'); return }
  if (!isValidCustomerName(name, 50)) { notices.warning('客户姓名至少需要2个字符'); return }
  customerCreating.value = true
  customerLoading.value = true
  try {
    const response = await createCustomerProfile({
      name,
      phone,
      apple_id: form.apple_id || null
    })
    if (!response.success || !response.data) throw new Error(response.message || '创建客户失败')
    const created = response.data as Partial<CustomerSearchDropdownItem>
    selectCustomer({
      id: Number(created.id),
      name: String(created.name || name),
      phone: normalizePhoneDigits(created.phone || phone),
      member_number: created.member_number,
      vip_level: created.vip_level
    })
    notices.success(`新客户“${form.customer_name}”创建成功`)
  } catch (error) {
    notices.error(error instanceof Error ? error.message : '创建客户失败')
  } finally {
    customerCreating.value = false
    customerLoading.value = false
  }
}
const nameTap = useTouchDoubleTap(() => { if (customerPermissions.requirePermission('edit') && selectedCustomer.value && !saving.value && !nameSaving.value && !uncertain.value) nameEditing.value = true })
const saveName = async () => {
  if (!nameEditing.value || !selectedCustomer.value || nameSaving.value || saving.value || uncertain.value) return
  if (!customerPermissions.requirePermission('edit')) return
  const name = normalizePersonName(form.customer_name, 50)
  if (!isValidCustomerName(name, 50)) { notices.error('客户姓名至少需要2个字符'); return }
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
  if (props.filmCustomerId) return
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
const load = async ({ preserveSaleDate = false } = {}) => {
  const request = requests.nextRequest(); loading.value = true; failed.value = uncertain.value = false
  checkoutStep.value = 'shopping'; completed.value = null; receiptOpen.value = false; cashTendered.value = null; filmActualAmount.value = null
  clearCustomer(); nameSaving.value = false; customerCreating.value = false; invalidatePointsQuote(); goods.value = []; stores.value = []; operators.value = []
  memberRequests.cancelLatest(); memberSummary.value = null; memberLoading.value = memberFailed.value = false
  const preservedSaleDate = preserveSaleDate && TimeUtil.isValid(form.sale_time, TIME_FORMATS.DATE) ? form.sale_time : ''
  Object.assign(form, { customer_name: '', customer_phone: '', apple_id: undefined, store_id: '', operator_id: props.phones.length ? '' : Number(auth.user?.id) || '', sale_time: props.phones.length ? '' : TimeUtil.nowFormatted(TIME_FORMATS.DATE), payment_method: '', payment_channel: '', transaction_no: '', remarks: '' }, props.defaults)
  if (!props.phones.length && preservedSaleDate) form.sale_time = preservedSaleDate
  const initialCustomerPhone = props.initialCustomer?.phone || ''
  if (!props.phones.length && props.initialCustomer && normalizePhoneDigits(initialCustomerPhone) === normalizePhoneDigits(form.customer_phone)) {
    selectCustomer({ id: props.initialCustomer.id, name: props.initialCustomer.name, phone: initialCustomerPhone }, true)
  }
  form.store_id = Number(form.store_id) || ''; form.operator_id = Number(form.operator_id) || ''
  if (props.filmCustomerId) form.operator_id = Number(auth.user?.id) || ''
  requestKey = createCheckoutKey()
  try {
    if (!canViewCheckout.value || !fieldsAllowed.value) return
    if (props.phones.length) {
      const previous = props.initialSelection
      if (previous && previous.store_id === Number(form.store_id)) {
        goods.value = previous.goods.map(row => ({ ...row, option: row.option ? { ...row.option } : null, serial_numbers: [...row.serial_numbers] }))
        await nextTick()
        if (!request.isLatest()) return
        automaticPoints.value = Object.fromEntries(previous.goods.map(row => [row.key, Number(row.redeem_points) || 0]))
        if (previous.points_quote && checkoutPointsContext(prepareInput()) === previous.points_context) {
          pointsQuote.value = previous.points_quote; quotedInput = JSON.stringify(prepareInput())
        } else automaticPoints.value = {}
      }
      return
    }
    const [storeResponse] = await Promise.all([
      props.filmCustomerId && Number(form.store_id) > 0 ? Promise.resolve({ success: true, data: [] as ReferenceRecord[] }) : getStores({ strictScope: true }),
      props.filmCustomerId ? Promise.resolve() : searchSellers()
    ])
    if (!request.isLatest()) return
    if (!storeResponse.success || !Array.isArray(storeResponse.data)) throw new Error('门店读取失败')
    stores.value = storeResponse.data.filter(row => Number(row.status ?? 1) === 1)
    const current = auth.user
    if (current?.id && !operators.value.some(row => Number(row.id) === Number(current.id))) operators.value.unshift({ id: Number(current.id), name: current.name || current.username || '' })
    if (!form.store_id && stores.value.length === 1) form.store_id = Number(stores.value[0].id)
    if (props.filmCustomerId) addFilmGoods()
  } catch { if (request.isLatest()) failed.value = true }
  finally { if (request.isLatest()) loading.value = false }
}
const prepareInput = ({ filmSettlement = false }: { filmSettlement?: boolean } = {}) => {
  if (phoneContextError.value) throw new Error(phoneContextError.value)
  const checkoutForm = giftOnlyOrder.value
    ? { ...form, payment_method: 'cash', payment_channel: '', transaction_no: '' }
    : form
  const input = buildCheckoutInput(checkoutForm, props.phones, goods.value, requestKey, props.quickPhone, Boolean(props.filmCustomerId))
  if (props.phones.length || standalone.value || props.filmCustomerId) input.accessories.forEach(row => { delete row.redeem_points; if (automaticPoints.value[row.key] > 0) row.redeem_points = automaticPoints.value[row.key] })
  if (props.filmCustomerId) {
    if (!fieldsAllowed.value || form.customer_name !== props.initialCustomer?.name) throw new Error('贴膜客户资料已变化，请重新打开办理')
    if (goods.value.some(row => row.sale_type === 'gift') && !filmGiftAllowed.value) throw new Error('没有贴膜赠送权限')
    if (!props.filmPhoneId) throw new Error('请从当前手机详情重新办理贴膜')
    input.film_service = { customer_id: props.filmCustomerId, phone_id: props.filmPhoneId, mode: 'paid' }
    delete input.payment_info.transaction_no
    if (filmSettlement) {
      if (goods.value.length !== 1 || input.accessories.length !== 1) throw new Error('贴膜商品明细已变化，请重新打开办理')
      const deduction = filmPointsDeduction.value
      const actual = filmActualAmountValue.value
      const gross = Math.min(filmOriginalAmount.value, Math.round((actual + deduction) * 100) / 100)
      const row = input.accessories[0]
      const quantity = row.quantity
      if (!Number.isSafeInteger(quantity) || quantity < 1 || gross < 0) throw new Error('请核对贴膜实收金额')
      if (row.sale_type === 'gift') input.payment_info.payment_amount = row.unit_price = 0
      else {
        row.unit_price = Math.round(gross * 100 / quantity) / 100
        input.payment_info.payment_amount = actual
      }
    }
  }
  if (hasPaymentChannelOptions(checkoutForm.payment_method) && !checkoutForm.payment_channel) throw new Error('请选择支付渠道')
  if (!canViewAccessoryField('serial_number') && goods.value.some(row => row.serial_mode)) throw new Error('无权使用SN字段')
  if (!showRemarks.value) delete input.remarks
  if (standalone.value || props.filmCustomerId || props.phones.length && !props.phoneFieldVisible('transaction_no')) delete input.payment_info.transaction_no
  if (props.phones.length && !props.phoneFieldVisible('customer_apple_id')) delete input.customer_info.apple_id
  return input
}
const refreshQuote = async () => {
  if (props.phones.length || goodsResolving.value || saving.value || nameSaving.value || uncertain.value || !fieldsAllowed.value || !canViewAccessoryField('total_price')) return
  let input
  try { input = prepareInput() }
  catch (error) { notices.error(error instanceof Error ? error.message : '请核对销售明细'); return }
  const request = quoteRequests.nextRequest()
  quoteLoading.value = true; pointsQuote.value = null; quotedInput = ''
  try {
    const response = effectiveFieldSource.value === 'query' ? await quoteCheckoutSale(input, request.signal, false, 'query') : await quoteCheckoutSale(input, request.signal)
    if (!request.isLatest() || !props.modelValue) return
    if (!response.success || !response.data) return
    pointsQuote.value = response.data; quotedInput = JSON.stringify(input)
  } catch { /* 统一API反馈规则或网络错误，不使用旧试算。 */ }
  finally { if (request.isLatest()) quoteLoading.value = false }
}
const applyPoints = async () => {
  if (formDisabled.value || goodsResolving.value || !props.phones.length && !standalone.value && !props.filmCustomerId || !fieldsAllowed.value || !memberFieldVisible('points') || !canViewAccessoryField('total_price') || memberLoading.value || memberFailed.value) return
  if (hasRedemption.value) { invalidatePointsQuote(); return }
  if (!canRedeemPoints.value) return
  let input
  try { input = prepareInput() }
  catch (error) { notices.error(error instanceof Error ? error.message : '请核对商品明细'); return }
  const request = quoteRequests.nextRequest(); quoteLoading.value = true
  try {
    const response = effectiveFieldSource.value === 'query' ? await quoteCheckoutSale(input, request.signal, true, 'query') : await quoteCheckoutSale(input, request.signal, true)
    if (!request.isLatest() || !props.modelValue || !response.success || !response.data) return
    const quote = response.data
    if (!Number.isSafeInteger(quote.points_used) || quote.points_used < 0 ||
      !Number.isSafeInteger(quote.available_points) || quote.available_points < 0 ||
      !Number.isSafeInteger(quote.balance) || quote.balance < quote.available_points ||
      typeof quote.redemption_ready !== 'boolean') {
      notices.error('积分试算资料不完整，请重新抵扣'); return
    }
    if (quote.points_used === 0) {
      const message = !quote.redemption_ready
        ? '当前积分抵扣未启用或来源账尚未就绪，请联系管理员核对积分设置'
        : quote.available_points === 0
          ? quote.balance > 0
            ? `账户积分 ${quote.balance}，本次可抵扣积分为 0；未核对来源的余额暂不能抵扣，请联系管理员核对历史积分`
            : '账户暂无可抵扣积分，本次销售新增积分须结算后才可用于后续订单'
          : '已有可用积分，但当前商品不符合抵扣范围或未达到最低抵扣金额，请核对商品类型及抵扣规则'
      notices.info(message); return
    }
    const allocation = Object.fromEntries(goods.value.map(row => [row.key, quote.lines.find(line => line.key === `goods:${row.key}`)?.points_used ?? 0]))
    if (Object.values(allocation).some(value => !Number.isSafeInteger(value) || value < 0) ||
      Object.values(allocation).reduce((sum, value) => sum + value, 0) !== quote.points_used ||
      !Number.isSafeInteger(quote.payable_cents) || quote.payable_cents < 0 ||
      quote.gross_cents !== Math.round(totalAmount.value * 100) || quote.payable_cents + quote.deduction_cents !== quote.gross_cents) {
      notices.error('积分试算资料不完整，请重新抵扣'); return
    }
    automaticPoints.value = allocation
    pointsQuote.value = quote; filmPointsQuotedAmount.value = props.filmCustomerId ? filmOriginalAmount.value : null; quotedInput = JSON.stringify(prepareInput())
    if (props.filmCustomerId) {
      filmActualAmount.value = Math.min(filmActualAmount.value ?? filmOriginalAmount.value, Math.max(0, filmOriginalAmount.value - quote.deduction_cents / 100))
    }
  } catch { /* 公共API反馈失败，不保留旧抵扣。 */ }
  finally { if (request.isLatest()) quoteLoading.value = false }
}
const submit = async () => {
  if (completed.value || saving.value || quoteLoading.value || loading.value || goodsResolving.value || nameSaving.value || nameEditing.value || !fieldsAllowed.value) return
  if (standalone.value && checkoutStep.value === 'shopping') { enterCheckout(); return }
  const canSellPhone = props.quickPhone ? inventoryPermissions.canSell.value && queryPermissions.canView.value && queryPermissions.canCreate.value : phonePermissions.canSell.value
  if (!canViewCheckout.value || props.phones.length && !canSellPhone) { notices.error('销售权限已变更，请重新打开页面'); return }
  if (props.filmCustomerId && goods.value.some(row => row.sale_type === 'gift') && !filmGiftAllowed.value) { notices.error('没有贴膜赠送权限'); return }
  if (!props.filmCustomerId && goods.value.some(row => !permissions.hasPermission(row.sale_type === 'gift' ? 'gift' : 'create'))) { notices.error('没有对应的商品销售或赠送权限'); return }
  if (props.phones.length && !goods.value.length) { emit('confirm', null); emit('update:modelValue', false); return }
  let input
  try {
    const quoteInput = prepareInput()
    if (hasRedemption.value) {
      if (!canViewAccessoryField('total_price') || !pointsQuote.value || JSON.stringify(quoteInput) !== quotedInput || props.filmCustomerId && filmPointsQuotedAmount.value !== filmOriginalAmount.value) throw new Error(props.filmCustomerId ? '销售内容已变更，请重新进行积分试算' : '销售内容已变更，请重新点击积分抵扣')
    }
    input = props.filmCustomerId ? prepareInput({ filmSettlement: true }) : quoteInput
    if (hasRedemption.value && !props.filmCustomerId) input.payment_info.payment_amount = pointsQuote!.value!.payable_cents / 100
  } catch (error) { notices.error(error instanceof Error ? error.message : '请核对销售明细'); return }
  if (props.phones.length) {
    emit('confirm', {
      goods: goods.value.map(row => ({ ...row, option: row.option ? { ...row.option } : null, serial_numbers: [...row.serial_numbers], redeem_points: automaticPoints.value[row.key] || 0 })),
      store_id: input.store_id, remarks: input.remarks, points_quote: hasRedemption.value ? pointsQuote.value : null, points_context: checkoutPointsContext(input)
    })
    emit('update:modelValue', false)
    return
  }
  if ((standalone.value || props.filmCustomerId) && (giftOnlyOrder.value || form.payment_method === 'cash') && cashTendered.value !== null && cashTendered.value !== undefined &&
    (!Number.isFinite(cashTendered.value) || cashChange.value < 0)) { notices.error('现金收取不足，请核对应收金额'); return }
  saving.value = true
  try {
    const response = effectiveFieldSource.value === 'query' ? await checkoutSale(input, 'query') : await checkoutSale(input)
    if (!response.success || !response.data) { uncertain.value = true; return }
    notices.success(`结算成功：${response.data.order_no}，抵扣${response.data.points_used || 0}积分，累计${response.data.points_earned}积分`)
    uncertain.value = false
    if (standalone.value) completed.value = response.data
    emit('success', response.data)
    if (!standalone.value) emit('update:modelValue', false)
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
watch([form, goods, () => props.phones, () => props.quickPhone, () => props.filmCustomerId, () => props.filmPhoneId, () => props.filmModelId, () => props.filmEligibleForFree], invalidatePointsQuote, { deep: true })
watch(giftOnlyOrder, locked => {
  if (!locked) return
  cashTendered.value = null
  if (form.payment_method !== 'cash') {
    form.payment_method = 'cash'
    resetPayment()
  }
})
watch([memberContextReady, () => normalizePhoneDigits(form.customer_phone), () => form.store_id,
  () => memberFieldVisible('points'), () => memberFieldVisible('member_number'), () => memberFieldVisible('balance')], () => {
  memberRequests.cancelLatest(); memberSummary.value = null; memberLoading.value = memberFailed.value = false
  invalidatePointsQuote()
  if (memberContextReady.value) void loadMemberSummary()
})
watch(() => Object.keys(ACCESSORY_FIELD_IDS).map(key => canViewAccessoryField(key as AccessoryFieldName)), () => {
  requests.cancelLatest(); customerRequests.cancelLatest(); sellerRequests.cancelLatest(); memberRequests.cancelLatest()
  invalidatePointsQuote(); goods.value = []; completed.value = null; receiptOpen.value = false
  if (props.modelValue) void load({ preserveSaleDate: true })
})
watch(() => props.modelValue, visible => {
  if (visible) void load()
  else { receiptOpen.value = false; requests.cancelLatest(); customerRequests.cancelLatest(); sellerRequests.cancelLatest(); memberRequests.cancelLatest(); invalidatePointsQuote() }
}, { immediate: true })
</script>
<style scoped>
.goods-customer-search { position: relative; width: 100%; min-width: 0; }
.checkout-points-summary { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tf-space-2); }
.checkout-points-summary__separator { color: var(--tf-color-border-strong); }
.checkout-cart-confirm { width: 100%; }
.checkout-payment { min-width: 0; }
.checkout-cash-row { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; column-gap: var(--tf-space-3); }
.checkout-cash-row__tender { flex: 0 1 calc(var(--tf-space-8) * 4); max-width: 100%; }
.checkout-cash-row__change { flex: 0 0 auto; }
.checkout-payment__summary { display: grid; gap: var(--tf-space-4); margin-bottom: var(--tf-space-5); padding: var(--tf-space-4); border: 1px solid var(--tf-color-border-cool); border-radius: var(--tf-radius-card); background: var(--tf-color-surface-cool-alt); }
.checkout-payment__amount { display: grid; justify-items: center; gap: var(--tf-space-2); }
.checkout-payable { font-size: var(--tf-font-title); color: var(--el-color-primary); }
.checkout-payment__lines { display: grid; gap: var(--tf-space-2); max-height: 25vh; overflow-y: auto; }
.checkout-payment__line { display: flex; justify-content: space-between; gap: var(--tf-space-3); overflow-wrap: anywhere; }
.checkout-payment__line > span:first-child { min-width: 0; }
.checkout-payment__line > span:last-child { flex-shrink: 0; }
.checkout-success { min-width: 0; }
.checkout-success__hero { display: grid; justify-items: center; gap: var(--tf-space-2); padding: var(--tf-space-2) 0 var(--tf-space-5); text-align: center; }
.checkout-success__icon { display: inline-grid; place-items: center; width: calc(var(--tf-space-8) * 2); height: calc(var(--tf-space-8) * 2); border-radius: var(--tf-radius-full); color: var(--tf-color-white); background: var(--el-color-success); font-size: var(--tf-font-title); }
.checkout-success__hero h2 { margin: 0; color: var(--tf-dialog-body-text); font-size: var(--tf-font-title); line-height: 1.3; }
.checkout-success__hero p { margin: 0; color: var(--tf-color-text-secondary); font-size: var(--tf-font-body); }
.checkout-success__receipt { display: grid; gap: var(--tf-space-3); padding: var(--tf-space-4); border-radius: var(--tf-radius-card); background: var(--tf-color-surface-cool-alt); overflow-wrap: anywhere; }
.checkout-success__line { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--tf-space-3); min-width: 0; }
.checkout-success__line > :last-child { min-width: 0; text-align: right; overflow-wrap: anywhere; }
.checkout-success__points { color: var(--tf-color-text-secondary); }
.checkout-success__points > span { width: 100%; text-align: center; }
.checkout-success__paid { margin-top: var(--tf-space-1); padding-top: var(--tf-space-3); border-top: 1px solid var(--tf-color-border-cool); font-weight: 700; }
.checkout-success__paid > :last-child { color: var(--el-color-primary); font-size: var(--tf-font-title); }
.film-cashier-summary { display: grid; justify-items: center; gap: var(--tf-space-2); margin-bottom: var(--tf-space-5); padding: var(--tf-space-5) var(--tf-space-4); border: 1px solid var(--tf-color-border-cool); border-radius: var(--tf-radius-card); background: var(--tf-color-surface-cool-alt); text-align: center; }
.film-cashier-summary__label { color: var(--tf-color-text-secondary); font-size: var(--tf-font-body); }
.film-cashier-summary__amount { color: var(--el-color-primary); font-size: var(--tf-font-display); line-height: 1.1; }
.film-cashier-points { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tf-space-3); margin-bottom: var(--tf-space-4); }
.film-cashier-entry { flex: 0 1 180px; min-width: 150px; margin: 0; }
.film-cashier-entry .el-input-number { width: 100%; }
.film-cashier-entry__change { flex: 0 0 auto; color: var(--tf-color-text-secondary); white-space: nowrap; }
</style>
