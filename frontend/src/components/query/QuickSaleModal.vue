<!--
  QuickSaleModal - 快速出库模态框组件（基于 MobileDialog）

  功能描述：
  - 快速创建销售、批发调货或划拨出库记录，跳过入库流程
  - 完整的表单验证
  - 响应式设计，移动端友好

  权限要求：
  - inventory:create

  API接口：
  - POST /inventory/quick-sale - 快速出库API
-->
<template>
  <MobileDialog
    v-model="dialogVisible"
    title="快速出库"
    :force-fullscreen="isMobile"
    :show-default-footer="false"
    :close-on-click-modal="false"
    width="800px"
    dialog-class="quick-sale-dialog"
    @cancel="handleCancel"
  >
    <template #footer>
      <div class="tf-dialog-actions quick-sale-footer">
        <el-button
          type="default"
          :disabled="submitting"
          @click="handleCancel"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          <span v-if="submitting">处理中...</span>
          <template v-else>
            <i class="fas fa-bolt" />
            确认出库
          </template>
        </el-button>
      </div>
    </template>

    <!-- 表单内容 -->
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="quick-sale-form"
    >
      <!-- 设备信息 -->
      <div class="tf-query-modal-section quick-sale-device-section">
        <div class="tf-query-modal-section-title">
          <i class="fas fa-mobile-alt" />
          设备信息
        </div>

        <div class="tf-query-modal-row tf-query-modal-row--4 quick-sale-device-row--product">
          <el-form-item
            label="品牌"
            prop="brand_id"
          >
            <el-select
              v-model="formData.brand_id"
              placeholder="请选择"
              filterable
              @change="handleBrandChange"
            >
              <el-option
                v-for="brand in options.brands"
                :key="brand.id"
                :label="brand.name"
                :value="brand.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="型号"
            prop="model_id"
          >
            <el-select
              v-model="formData.model_id"
              placeholder="请选择"
              filterable
              :disabled="!formData.brand_id"
            >
              <el-option
                v-for="model in filteredModels"
                :key="model.id"
                :label="model.name"
                :value="model.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="颜色"
            prop="color_id"
          >
            <el-select
              v-model="formData.color_id"
              placeholder="请选择"
              filterable
            >
              <el-option
                v-for="color in options.colors"
                :key="color.id"
                :label="color.name"
                :value="color.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="内存"
            prop="memory_id"
          >
            <el-select
              v-model="formData.memory_id"
              placeholder="请选择"
              filterable
            >
              <el-option
                v-for="memory in options.memories"
                :key="memory.id"
                :label="memory.size || memory.name || memory.capacity || memory.storage"
                :value="memory.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <div class="tf-query-modal-row tf-query-modal-row--4 quick-sale-device-row--identifier">
          <el-form-item
            label="序列号"
            prop="serial_number"
          >
            <div class="quick-sale-identifier-field">
              <el-input
                v-model="formData.serial_number"
                class="quick-sale-identifier-input"
                placeholder="请输入序列号"
                maxlength="18"
                clearable
                @input="formatSerialNumber"
              >
                <template #suffix>
                  <el-button
                    v-if="isMobile"
                    link
                    type="primary"
                    title="扫码识别序列号"
                    @click.stop="openScanner('serial')"
                  >
                    <i class="fas fa-qrcode" />
                  </el-button>
                  <i
                    v-else
                    class="fas fa-hashtag serial-icon"
                  />
                </template>
              </el-input>
            </div>
          </el-form-item>

          <el-form-item
            label="IMEI"
            prop="imei"
          >
            <div
              class="quick-sale-identifier-field"
              @dblclick="handleImeiDoubleClick(undefined)"
              @touchend.stop="handleImeiTouchEnd($event, undefined)"
            >
              <el-input
                v-model="formData.imei"
                class="quick-sale-identifier-input"
                :class="{ 'tf-imei-input--no-imei': formData.isNoIMEIMode }"
                :placeholder="formData.isNoIMEIMode ? '' : '请输入15位IMEI号'"
                :maxlength="formData.isNoIMEIMode ? 30 : 15"
                clearable
                @input="formatIMEI"
              >
                <template #suffix>
                  <el-button
                    v-if="isMobile"
                    link
                    type="primary"
                    title="扫码识别 IMEI"
                    @click.stop="openScanner('imei')"
                  >
                    <i class="fas fa-qrcode" />
                  </el-button>
                  <i
                    v-if="!isMobile && !formData.isNoIMEIMode"
                    class="fas fa-barcode imei-icon"
                  />
                </template>
              </el-input>
            </div>
          </el-form-item>

          <el-form-item
            label="成色"
            prop="is_new"
          >
            <el-select
              v-model="formData.is_new"
              placeholder="请选择"
            >
              <el-option
                label="全新"
                value="1"
              />
              <el-option
                label="二手"
                value="0"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="状态"
            prop="status"
          >
            <el-select
              v-model="formData.status"
              placeholder="请选择状态"
              teleported
              popper-class="tf2025-form-popper"
              @change="handleTransactionTypeChange"
            >
              <el-option
                label="已售"
                value="sold"
              />
              <el-option
                label="调货"
                value="peer_transfer"
              />
              <el-option
                label="划拨"
                value="supplier_proxy"
              />
            </el-select>
          </el-form-item>
        </div>

        <div class="tf-query-modal-row tf-query-modal-row--4 quick-sale-device-row--transaction">
          <el-form-item
            label="供应商"
            prop="supplier_id"
          >
            <el-select
              v-model="formData.supplier_id"
              placeholder="请选择供应商"
              filterable
            >
              <el-option
                v-for="supplier in options.suppliers"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            label="店铺"
            prop="store_id"
          >
            <el-select
              v-model="formData.store_id"
              placeholder="请选择店铺"
              filterable
            >
              <el-option
                v-for="store in options.stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            v-if="formData.status !== 'supplier_proxy'"
            label="入库价格"
            prop="purchase_cost"
          >
            <el-input
              :model-value="formatPriceInputValue(formData.purchase_cost)"
              placeholder="请输入入库价格"
              inputmode="numeric"
              clearable
              @input="handlePriceInput('purchase_cost', $event)"
            >
              <template #prefix>
                ¥
              </template>
            </el-input>
          </el-form-item>

          <el-form-item
            v-if="formData.status !== 'supplier_proxy'"
            :label="formData.status === 'peer_transfer' ? '批发价格' : '销售价格'"
            prop="sale_price"
          >
            <el-input
              :model-value="formatPriceInputValue(formData.sale_price)"
              :placeholder="formData.status === 'peer_transfer' ? '请输入批发价格' : '请输入销售价格'"
              inputmode="numeric"
              clearable
              @input="handlePriceInput('sale_price', $event)"
            >
              <template #prefix>
                ¥
              </template>
            </el-input>
          </el-form-item>
        </div>
      </div>

      <!-- 客户信息 -->
      <div class="tf-query-modal-section">
        <div class="tf-query-modal-section-title">
          <i class="fas fa-user" />
          客户信息
        </div>

        <div class="tf-query-modal-row tf-query-modal-row--3">
          <el-form-item
            label="客户手机"
            prop="customer_phone"
          >
            <div
              ref="customerSearchContainerRef"
              class="customer-search-container"
            >
              <el-input
                v-model="formData.customer_phone"
                placeholder="请输入用户手机号"
                clearable
                maxlength="11"
                :readonly="foundCustomer !== null"
                @input="handleCustomerPhoneInput"
                @focus="handleCustomerPhoneFocus"
                @blur="formatCustomerPhone"
                @clear="handleCustomerClear"
              />

              <CustomerSearchDropdown
                :items="customerOptions"
                :loading="customerLookupLoading"
                :visible="showCustomerSearchResults && !foundCustomer"
                :keyword="formData.customer_phone"
                :min-query-length="2"
                :create-min-query-length="11"
                teleport-target="body"
                :floating-style="customerSearchResultsStyle"
                @select="selectCustomer($event as CustomerOption)"
                @create="createNewCustomer"
              />
            </div>
          </el-form-item>

          <el-form-item
            label="客户姓名"
            prop="customer_name"
          >
            <CustomerNameLockInput
              ref="customerNameInputRef"
              v-model="formData.customer_name"
              name="quick-sale-customer-name"
              data-field="customer_name"
              :selected="foundCustomer !== null"
              :editing="customerNameEditing"
              :creating="customerCreating"
              @unlock="enableCustomerNameEdit"
              @touchend="handleCustomerNameTouchEnd"
              @input="formatCustomerName"
              @blur="handleCustomerNameBlur"
              @save="saveCustomerNameEdit"
              @clear="clearSelectedCustomer"
            />
          </el-form-item>

          <el-form-item
            label="Apple ID"
            prop="apple_id"
            class="tf-query-modal-span-2"
          >
            <el-input
              v-model="formData.apple_id"
              placeholder="请输入Apple ID"
              clearable
              data-field="apple_id"
              @input="formatAppleId"
            >
              <template #suffix>
                <i class="fab fa-apple apple-icon" />
              </template>
            </el-input>
          </el-form-item>
        </div>
      </div>

      <!-- 销售信息 -->
      <div class="tf-query-modal-section">
        <div class="tf-query-modal-section-title">
          <i class="fas fa-shopping-cart" />
          {{ formData.status === 'sold' ? '销售信息' : formData.status === 'peer_transfer' ? '批发信息' : '划拨信息' }}
        </div>

        <div class="quick-sale-transaction-meta">
          <div class="tf-query-modal-row tf-query-modal-row--3">
            <el-form-item
              label="入库日期"
              prop="inventory_time"
            >
              <el-date-picker
                v-model="formData.inventory_time"
                type="date"
                placeholder="请选择入库日期"
                :format="TIME_FORMATS.DATE"
                :value-format="TIME_FORMATS.DATE"
                class="full-width"
              />
            </el-form-item>

            <el-form-item
              label="交易日期"
              prop="sale_time"
            >
              <el-date-picker
                v-model="formData.sale_time"
                type="date"
                placeholder="请选择销售日期"
                :format="TIME_FORMATS.DATE"
                :value-format="TIME_FORMATS.DATE"
                class="full-width"
              />
            </el-form-item>

            <el-form-item
              label="入库员"
              prop="purchase_operator_id"
            >
              <el-input
                :value="currentUserName"
                disabled
                placeholder="当前用户"
              >
                <template #suffix>
                  <i class="fas fa-user user-icon" />
                </template>
              </el-input>
            </el-form-item>
          </div>

          <div class="tf-query-modal-row tf-query-modal-row--3">
            <el-form-item
              label="销售员"
              prop="sale_operator_id"
            >
              <el-select
                v-model="formData.sale_operator_id"
                placeholder="请选择销售员"
                filterable
              >
                <el-option
                  v-for="user in options.users"
                  :key="user.id"
                  :label="user.name"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item
              v-if="formData.status === 'sold'"
              label="支付方式"
              prop="payment_method"
            >
              <PaymentMethodSelect
                v-model="formData.payment_method"
                variant="sale"
                placeholder="请选择"
                @change="handlePaymentMethodChange"
              />
            </el-form-item>

            <el-form-item
              v-if="formData.status === 'sold' && ['mobile', 'bank_card', 'subsidy_card'].includes(formData.payment_method)"
              label="支付渠道"
              prop="payment_channel"
            >
              <PaymentChannelSelect
                v-model="formData.payment_channel"
                :payment-method="formData.payment_method"
                placeholder="请选择"
                @change="handlePaymentChannelChange"
              />
            </el-form-item>
          </div>
        </div>

        <el-form-item
          label="备注"
          prop="remarks"
        >
          <el-input
            v-model="formData.remarks"
            class="tf-textarea"
            type="textarea"
            :rows="2"
            placeholder="销售备注信息"
            maxlength="200"
            show-word-limit
            @input="formatRemarks"
          />
        </el-form-item>
      </div>
    </el-form>
  </MobileDialog>

  <teleport to="body">
    <OptimizedScanner
      v-model:visible="optimizedScannerVisible"
      :scan-type="currentScanType"
      :phone="scannerPhone"
      :show-r-o-i-display="true"
      :enable-android-optimization="true"
      @success="handleScanSuccess"
      @manual="handleScanManual"
      @cancel="handleScanCancel"
    />
  </teleport>
</template>

<script setup lang="ts">
import { TIME_FORMATS } from '@/utils/time'
import { ref, reactive, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ValidationRules } from '@/composables'
import { useNotification } from '@/composables/useNotification'
import unifiedApi from '@/utils/unified-api'
import { searchCustomerOptions } from '@/services/customer-options'
import { getModels } from '@/services/reference-options'
import { useAuthStore } from '@/stores/auth'
import MobileDialog from '@/components/MobileDialog.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import { resolveNativeTextInput, type NativeInputInstance } from '@/utils/native-input'
import { useCustomerNamePrompt } from '@/composables/useCustomerNamePrompt'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
import { useMobile } from '@/composables/mobile'
import { useTouchDoubleTap } from '@/composables/useTouchDoubleTap'
import { onMounted, onUnmounted } from 'vue'
import { isValidMobilePhone, normalizeAppleId, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import type { SuccessEmits, UpdateModelValueEmits } from '@/types'
import { logger } from '@/utils/logger'
import {
  buildQuickSaleBrandModels,
  buildQuickSaleCustomerClearedPatch,
  buildQuickSaleCustomerPayload,
  buildQuickSaleCustomerSearchResetState,
  buildQuickSaleCustomerSelectionPatch,
  buildQuickSaleSubmitPayload,
  calculateQuickSaleSubsidyRemarks,
  createDefaultQuickSaleForm,
  createQuickSaleInitialPatch,
  formatQuickSaleIMEI,
  formatQuickSaleSerialNumber,
  normalizeQuickSaleCustomerOption,
  normalizeQuickSaleCustomerPhone,
  sanitizeQuickSaleRemarks,
  sanitizeQuickSalePriceInput,
  shouldSearchQuickSaleCustomer,
  toggleQuickSaleNoIMEIMode
} from './quick-sale/helpers'
import type {
  BrandModelOption,
  QuickSaleCustomerOption as CustomerOption,
  PriceField,
  QuickSaleProps
} from './quick-sale/types'
import { buildStockInScanPromptConfig } from '../stock-in/helpers'

const OptimizedScanner = defineAsyncComponent(() => import('../OptimizedScanner.vue'))

// ==================== 类型定义 ====================

const props = defineProps<QuickSaleProps>()
const emit = defineEmits<UpdateModelValueEmits & SuccessEmits>()

// ==================== Composables ====================

const { isMobile, isIOS } = useMobile()
const authStore = useAuthStore()
const {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  prompt
} = useNotification()

// ==================== 响应式数据 ====================

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const optimizedScannerVisible = ref(false)
const currentScanType = ref<'imei' | 'serial'>('imei')

// 表单数据
const formData = reactive(createDefaultQuickSaleForm(authStore.user?.id || null))

// 传入所选品牌，复用公共扫码器的 Apple 包装序列号前缀识别规则。
const scannerPhone = computed(() => ({
  brand: props.options.brands.find(brand => Number(brand.id) === Number(formData.brand_id))?.name
}))

// 可用型号列表
const filteredModels = ref<BrandModelOption[]>([])

// 客户检索相关
const customerLookupLoading = ref(false)
const customerOptions = ref<CustomerOption[]>([])
const foundCustomer = ref<CustomerOption | null>(null)
const customerNameEditing = ref(false)
const customerCreating = ref(false)
const showCustomerSearchResults = ref(false)
const customerSearchTimeout = ref<ReturnType<typeof window.setTimeout> | null>(null)
const customerSearchRequestId = ref(0)
const customerNameInputRef = ref<NativeInputInstance | null>(null)
const customerNameLastTapAt = ref(0)
const customerSearchContainerRef = ref<HTMLElement | null>(null)
const customerSearchResultsStyle = ref<Record<string, string>>({})
const customerSearchLayoutFrame = ref<number | null>(null)

const normalizeCustomerOption = (
  customer?: CustomerOption | Record<string, unknown> | null
): CustomerOption => normalizeQuickSaleCustomerOption(customer)

const clearCustomerSearchTimeout = () => {
  if (customerSearchTimeout.value) {
    clearTimeout(customerSearchTimeout.value)
    customerSearchTimeout.value = null
  }
}

const clearCustomerSearchLayoutFrame = () => {
  if (customerSearchLayoutFrame.value !== null) {
    cancelAnimationFrame(customerSearchLayoutFrame.value)
    customerSearchLayoutFrame.value = null
  }
}

const updateCustomerSearchResultsLayout = () => {
  if (!showCustomerSearchResults.value) {
    customerSearchResultsStyle.value = {}
    return
  }

  const container = customerSearchContainerRef.value
  if (!container) {
    customerSearchResultsStyle.value = {
      position: 'fixed',
      top: '16px',
      left: '16px',
      width: 'min(460px, calc(100vw - 32px))',
      maxHeight: '300px'
    }
    return
  }

  const rect = container.getBoundingClientRect()
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth
  const viewportTop = window.visualViewport?.offsetTop ?? 0
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const viewportBottom = viewportTop + viewportHeight
  const safeGap = isMobile.value ? 8 : 12
  const availableBelow = viewportBottom - rect.bottom - safeGap
  const availableAbove = rect.top - viewportTop - safeGap
  const shouldOpenUpward = isMobile.value && availableBelow < 180 && availableAbove > availableBelow
  const preferredSpace = shouldOpenUpward ? availableAbove : availableBelow
  const maxHeight = Math.max(Math.min(preferredSpace, 300), 120)
  const width = Math.min(rect.width, viewportWidth - (safeGap * 2))
  const left = Math.min(
    Math.max(rect.left, safeGap),
    Math.max(safeGap, viewportWidth - width - safeGap)
  )

  customerSearchResultsStyle.value = shouldOpenUpward
    ? {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      top: 'auto',
      bottom: `${Math.max(safeGap, Math.round(window.innerHeight - rect.top + 4))}px`,
      maxHeight: `${Math.round(maxHeight)}px`
    }
    : {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      top: `${Math.round(rect.bottom + 4)}px`,
      bottom: 'auto',
      maxHeight: `${Math.round(maxHeight)}px`
    }
}

const scheduleCustomerSearchResultsLayout = () => {
  clearCustomerSearchLayoutFrame()
  customerSearchLayoutFrame.value = window.requestAnimationFrame(() => {
    customerSearchLayoutFrame.value = null
    updateCustomerSearchResultsLayout()
  })
}

const applyCustomerSearchResetState = () => {
  const resetState = buildQuickSaleCustomerSearchResetState()
  customerOptions.value = resetState.options
  foundCustomer.value = resetState.foundCustomer
  customerNameEditing.value = false
  customerCreating.value = false
  showCustomerSearchResults.value = resetState.visible
  customerLookupLoading.value = resetState.loading
  customerSearchResultsStyle.value = {}
}

const resetSubsidyPaymentSelection = (message?: string) => {
  if (message) {
    showError(message)
  }

  formData.payment_method = ''
  formData.payment_channel = ''
  if (formData.remarks.startsWith('刷卡实际支付')) {
    formData.remarks = ''
  }
}

// ==================== 计算属性 ====================

// 当前用户名（用于显示入库员）
const currentUserName = computed(() => {
  return authStore.user?.name || authStore.user?.username || ''
})

// ==================== 表单验证规则 ====================

// IMEI验证规则 - 根据无IMEI模式动态调整
const imeiRules = computed(() => {
  if (formData.isNoIMEIMode) {
    return [ValidationRules.required('请输入IMEI')]
  } else {
    return [
      ValidationRules.required('请输入IMEI'),
      {
        validator: (_rule: unknown, value: string, callback: (_error?: Error) => void) => {
          if (!value || /^\d{15}$/.test(value)) {
            callback()
          } else {
            callback(new Error('IMEI必须是15位数字'))
          }
        },
        trigger: 'blur'
      }
    ]
  }
})

const formRules = computed<FormRules>(() => ({
  brand_id: [
    ValidationRules.required('请选择品牌')
  ],
  model_id: [
    ValidationRules.required('请选择型号')
  ],
  color_id: [
    ValidationRules.required('请选择颜色')
  ],
  memory_id: [
    ValidationRules.required('请选择内存')
  ],
  is_new: [
    ValidationRules.required('请选择成色')
  ],
  imei: imeiRules.value,
  serial_number: [
    ValidationRules.required('请输入序列号')
  ],
  supplier_id: [
    ValidationRules.required('请选择供应商')
  ],
  store_id: [
    ValidationRules.required('请选择店铺')
  ],
  purchase_cost: [
    ValidationRules.positiveNumber('入库价格不能为负数')
  ],
  sale_price: formData.status === 'supplier_proxy'
    ? []
    : [
      ValidationRules.required(formData.status === 'peer_transfer' ? '请输入批发价格' : '请输入销售价格'),
      ValidationRules.positiveNumber('交易价格不能为负数')
    ],
  customer_phone: [
    ValidationRules.phone()
  ],
  inventory_time: [
    ValidationRules.required('请选择入库日期')
  ],
  sale_time: [
    ValidationRules.required('请选择销售日期')
  ],
  sale_operator_id: [
    ValidationRules.required('请选择销售员')
  ],
  payment_method: formData.status === 'sold'
    ? [ValidationRules.required('请选择支付方式')]
    : [],
  payment_channel: formData.status === 'sold' ? [
    {
      validator: (_rule: unknown, value: string, callback: (_error?: Error) => void) => {
        if (formData.status === 'sold' && formData.payment_method !== 'cash' && !value) {
          callback(new Error('请选择支付渠道'))
          return
        }
        callback()
      },
      trigger: 'change'
    }
  ] : []
}))

// ==================== 方法 ====================

// 品牌变化处理
const handleBrandChange = async () => {
  formData.model_id = null
  filteredModels.value = []

  if (!formData.brand_id) return

  try {
    const response = await getModels({ brandId: formData.brand_id })

    if (response.success) {
      filteredModels.value = buildQuickSaleBrandModels(response.data as BrandModelOption[] | null | undefined)
    }
  } catch (err) {
    filteredModels.value = []
  }
}

// ==================== 输入验证函数 ====================

// 格式化手机号 - 只允许数字，最多11位
const formatCustomerPhone = () => {
  // 移除非数字字符
  formData.customer_phone = normalizePhoneDigits(formData.customer_phone)
}

const normalizeCustomerPhone = (phone: unknown) => {
  return normalizeQuickSaleCustomerPhone(phone)
}

// 格式化IMEI - 根据模式决定格式化规则
const formatIMEI = () => {
  formData.imei = formatQuickSaleIMEI(formData.imei, formData.isNoIMEIMode)
}

const formatPriceInputValue = (value: number | null | undefined) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const handlePriceInput = (field: PriceField, value: string) => {
  const sanitized = sanitizeQuickSalePriceInput(value)
  formData[field] = sanitized ? Number(sanitized) : null
}

// 启用无IMEI模式（双击IMEI输入框触发）
const enableNoIMEIMode = () => {
  const toggleResult = toggleQuickSaleNoIMEIMode({
    currentMode: formData.isNoIMEIMode,
    serialNumber: formData.serial_number
  })
  formData.isNoIMEIMode = toggleResult.nextMode
  formData.imei = toggleResult.nextIMEI
  if (toggleResult.messageType === 'success') {
    showSuccess(toggleResult.message)
  } else if (toggleResult.messageType === 'info') {
    showInfo(toggleResult.message)
  } else {
    showError(toggleResult.message)
  }

  // 清除IMEI字段的验证错误，避免显示旧的错误提示
  if (formRef.value) {
    formRef.value.clearValidate('imei')
  }
}

const {
  handleTouchEnd: handleImeiTouchEnd,
  handleDoubleClick: handleImeiDoubleClick
} = useTouchDoubleTap(enableNoIMEIMode)

// 格式化序列号 - 只允许字母和数字，转大写，最多18位
const formatSerialNumber = () => {
  formData.serial_number = formatQuickSaleSerialNumber(formData.serial_number)
}

const openScanner = (scanType: 'imei' | 'serial') => {
  currentScanType.value = scanType
  optimizedScannerVisible.value = true
}

const handleScanSuccess = (result: string) => {
  if (currentScanType.value === 'imei') {
    formData.imei = formatQuickSaleIMEI(result, formData.isNoIMEIMode)
    formRef.value?.clearValidate('imei')
  } else {
    formData.serial_number = formatQuickSaleSerialNumber(result)
    formRef.value?.clearValidate('serial_number')
  }

  optimizedScannerVisible.value = false
}

const handleScanManual = async () => {
  const scanType = currentScanType.value
  const promptConfig = buildStockInScanPromptConfig(
    scanType,
    scanType === 'imei' && formData.isNoIMEIMode
  )

  try {
    const result = await prompt(
      promptConfig.message,
      promptConfig.title,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputType: 'text',
        inputPattern: promptConfig.inputPattern,
        inputErrorMessage: promptConfig.inputErrorMessage,
        inputPlaceholder: promptConfig.inputPlaceholder
      }
    )

    if (result?.value) {
      handleScanSuccess(result.value)
    }
  } catch {
    // 用户取消手动输入时保持快速出库表单不变。
  }
}

const handleScanCancel = () => {
  optimizedScannerVisible.value = false
}

// 支付方式变化处理
const handlePaymentMethodChange = () => {
  // 如果选择了国补刷卡，检查金额是否超过6000
  if (formData.payment_method === 'subsidy_card') {
    const subsidyResult = calculateQuickSaleSubsidyRemarks(formData.sale_price)
    if (subsidyResult.blocked) {
      resetSubsidyPaymentSelection(subsidyResult.message)
      return
    }
    formData.payment_channel = 'subsidy_card'
    if (!formData.remarks.trim() || formData.remarks.startsWith('刷卡实际支付')) {
      formData.remarks = subsidyResult.remarks
    }
  } else {
    // 切换到普通支付方式时，只清理系统自动生成的国补备注。
    formData.payment_channel = ''
    if (formData.remarks.startsWith('刷卡实际支付')) {
      formData.remarks = ''
    }
  }
}

const handleTransactionTypeChange = (value: string) => {
  if (value !== 'sold') {
    formData.payment_method = ''
    formData.payment_channel = ''
    if (formData.remarks.startsWith('刷卡实际支付')) formData.remarks = ''
  }
  if (value === 'supplier_proxy') formData.sale_price = 0
  else if (Number(formData.sale_price) === 0) formData.sale_price = null
}

// 支付渠道变化处理（保留，以防手动选择时使用）
const handlePaymentChannelChange = () => {
  // 如果选择了国补刷卡，自动计算并填写备注
  if (formData.payment_channel === 'subsidy_card') {
    calculateSubsidyRemarks()
  }
}

// 计算国补备注
const calculateSubsidyRemarks = () => {
  const subsidyResult = calculateQuickSaleSubsidyRemarks(formData.sale_price)
  if (subsidyResult.blocked) {
    if (formData.payment_method === 'subsidy_card') {
      resetSubsidyPaymentSelection(subsidyResult.message)
      return
    }
    if (formData.remarks.startsWith('刷卡实际支付')) {
      formData.remarks = ''
    }
    return
  }

  if (!formData.remarks.trim() || formData.remarks.startsWith('刷卡实际支付')) {
    formData.remarks = subsidyResult.remarks
  }
}

// 格式化客户姓名 - 只允许中文、英文、空格，去除特殊字符
const formatCustomerName = () => {
  formData.customer_name = normalizePersonName(formData.customer_name, 20)
}

const resolveNativeCustomerInput = resolveNativeTextInput

const focusCustomerNameInput = (input: HTMLInputElement | null) => {
  if (!input) return

  input.readOnly = false
  input.removeAttribute('readonly')
  input.disabled = false
  input.removeAttribute('disabled')
  input.focus({ preventScroll: true })
  input.click()

  try {
    if (isIOS.value) {
      const length = input.value?.length || 0
      input.setSelectionRange(length, length)
    } else {
      input.select()
    }
  } catch {
    // ignore
  }
}

const { promptCustomerName, promptingCustomerName } = useCustomerNamePrompt()
const customerNameSaving = ref(false)

const enableCustomerNameEdit = (event?: MouseEvent) => {
  if (!foundCustomer.value) return
  customerNameEditing.value = true

  focusCustomerNameInput(resolveNativeCustomerInput(event) || resolveNativeCustomerInput(customerNameInputRef.value))

  requestAnimationFrame(() => {
    focusCustomerNameInput(
      resolveNativeCustomerInput(customerNameInputRef.value) ||
      document.querySelector('input[name="quick-sale-customer-name"]')
    )
  })
}

const handleCustomerNameTouchEnd = async (_event: TouchEvent) => {
  if (!isIOS.value) return

  const now = Date.now()
  const interval = now - customerNameLastTapAt.value
  customerNameLastTapAt.value = now

  if (interval > 0 && interval < 320) {
    if (!foundCustomer.value) return
    const customerId = foundCustomer.value.id
    await promptCustomerName(formData.customer_name, async name => {
      if (!props.modelValue || foundCustomer.value?.id !== customerId) return
      customerNameEditing.value = true
      formData.customer_name = name
      await saveCustomerNameEdit()
    })
  }
}

const handleCustomerNameBlur = () => {
  if (promptingCustomerName.value) return
  if (customerCreating.value && !foundCustomer.value) {
    void createNewCustomer()
    return
  }

  if (customerNameEditing.value && foundCustomer.value) {
    void saveCustomerNameEdit()
  } else {
    customerNameEditing.value = false
  }
}

const saveCustomerNameEdit = async () => {
  if (customerNameSaving.value) return
  if (!foundCustomer.value) {
    customerNameEditing.value = false
    return
  }

  formatCustomerName()

  if (!formData.customer_name) {
    showWarning('客户姓名不能为空')
    return
  }

  if (formData.customer_name === normalizePersonName(foundCustomer.value.name, 20)) {
    customerNameEditing.value = false
    return
  }

  const customer = foundCustomer.value
  const nextName = formData.customer_name
  customerNameSaving.value = true
  try {
    const response = await unifiedApi.put(`/customers/${customer.id}`, {
      name: nextName
    })

    if (!response.success) {
      throw new Error(response.message || '更新客户失败')
    }

    customer.name = nextName
    if (foundCustomer.value?.id !== customer.id || formData.customer_name !== nextName) return
    customerNameEditing.value = false
    showSuccess('客户姓名更新成功')
  } catch (err) {
    logger.error('更新客户失败:', err)
    showError(err instanceof Error ? err.message : '更新客户失败')
  } finally {
    customerNameSaving.value = false
  }
}

// 格式化Apple ID - 支持手机号或邮箱形式
const formatAppleId = () => {
  formData.apple_id = normalizeAppleId(formData.apple_id)
}

// 格式化备注 - 防止XSS，移除HTML标签和特殊字符
const formatRemarks = () => {
  formData.remarks = sanitizeQuickSaleRemarks(formData.remarks)
}

// 处理客户手机号输入（带防抖和格式化）
const handleCustomerPhoneInput = () => {
  formatCustomerPhone()

  const phone = formData.customer_phone.trim()
  customerSearchRequestId.value += 1

  if (foundCustomer.value && normalizeCustomerPhone(foundCustomer.value.phone) !== phone) {
    foundCustomer.value = null
    customerCreating.value = false
  }

  // 清除之前的超时
  clearCustomerSearchTimeout()

  // 如果输入为空，清空搜索结果
  if (!phone) {
    applyCustomerSearchResetState()
    return
  }

  showCustomerSearchResults.value = true
  scheduleCustomerSearchResultsLayout()

  // 延迟搜索（防抖）
  customerSearchTimeout.value = setTimeout(async () => {
    if (shouldSearchQuickSaleCustomer(phone)) {
      await searchCustomers(phone)
    }
  }, 300)
}

const handleCustomerPhoneFocus = () => {
  showCustomerSearchResults.value = true
  scheduleCustomerSearchResultsLayout()
}

const isActiveCustomerSearch = (query: string, requestId: number) =>
  requestId === customerSearchRequestId.value &&
  normalizeCustomerPhone(formData.customer_phone) === query

// 远程搜索客户（模糊搜索，支持手机号和姓名）
const searchCustomers = async (query: string) => {
  if (!shouldSearchQuickSaleCustomer(query)) {
    customerOptions.value = []
    return
  }

  const requestId = customerSearchRequestId.value
  customerLookupLoading.value = true

  try {
    if (!isActiveCustomerSearch(query, requestId)) {
      return
    }

    customerOptions.value = (await searchCustomerOptions(query, 'sales'))
      .map((item) => normalizeCustomerOption(item))
  } catch (err) {
    logger.error('搜索客户失败:', err)
    if (isActiveCustomerSearch(query, requestId)) {
      customerOptions.value = []
    }
  } finally {
    if (isActiveCustomerSearch(query, requestId)) {
      customerLookupLoading.value = false
    }
  }
}

// 选择客户
const selectCustomer = (customer: CustomerOption) => {
  const selectionState = buildQuickSaleCustomerSelectionPatch(customer)
  customerSearchRequestId.value += 1
  Object.assign(formData, selectionState.formPatch)
  foundCustomer.value = selectionState.customer
  customerNameEditing.value = false
  customerCreating.value = false
  showCustomerSearchResults.value = false
  customerOptions.value = []
  customerSearchResultsStyle.value = {}

  // 清除手机号字段的验证错误
  if (formRef.value) {
    formRef.value.clearValidate('customer_phone')
    formRef.value.clearValidate('customer_name')
  }
}

// 创建新客户（后端自动生成会员号）
const createNewCustomer = async () => {
  formatCustomerPhone()
  formatAppleId()

  if (!isValidMobilePhone(formData.customer_phone)) {
    showWarning('请输入有效的手机号码')
    customerLookupLoading.value = false
    return
  }

  if (!customerCreating.value) {
    customerCreating.value = true
    customerNameEditing.value = true
    showCustomerSearchResults.value = false
    requestAnimationFrame(() => {
      focusCustomerNameInput(
        resolveNativeCustomerInput(customerNameInputRef.value) ||
        document.querySelector('input[name="quick-sale-customer-name"]')
      )
    })
    return
  }

  formatCustomerName()

  if (!formData.customer_name) {
    showWarning('请输入客户姓名')
    return
  }

  try {
    customerLookupLoading.value = true

    const response = await unifiedApi.post('/customers', buildQuickSaleCustomerPayload(formData))

    if (!response.success || !response.data) {
      throw new Error(response.message || '创建客户失败')
    }

    const selectionState = buildQuickSaleCustomerSelectionPatch(
      normalizeCustomerOption(response.data)
    )
    customerSearchRequestId.value += 1
    Object.assign(formData, selectionState.formPatch)
    foundCustomer.value = selectionState.customer
    customerCreating.value = false
    customerNameEditing.value = false
    showCustomerSearchResults.value = false
    customerOptions.value = []

    if (formRef.value) {
      formRef.value.clearValidate('customer_phone')
      formRef.value.clearValidate('customer_name')
    }

    showSuccess(`新客户 "${selectionState.customer.name}" 创建成功`)
  } catch (err) {
    logger.error('创建客户失败:', err)
    showError(err instanceof Error ? err.message : '创建客户失败')
  } finally {
    customerLookupLoading.value = false
  }
}

// 清空客户选择
const handleCustomerClear = () => {
  clearCustomerSearchTimeout()
  customerSearchRequestId.value += 1
  Object.assign(formData, buildQuickSaleCustomerClearedPatch())
  applyCustomerSearchResetState()
}

const clearSelectedCustomer = () => {
  handleCustomerClear()
  formData.customer_phone = ''
  customerCreating.value = false
}

// 重置表单
const resetForm = () => {
  clearCustomerSearchTimeout()
  customerSearchRequestId.value += 1
  Object.assign(formData, createDefaultQuickSaleForm(authStore.user?.id || null))
  filteredModels.value = []
  applyCustomerSearchResetState()
  formRef.value?.clearValidate()
}

const applyInitialData = async () => {
  const initialPatch = createQuickSaleInitialPatch(props.initialData)
  if (!initialPatch) return

  Object.assign(formData, initialPatch)

  if (formData.brand_id) {
    await handleBrandChange()
  }

  formData.model_id = initialPatch.model_id
}

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  if (!formRef.value) return

  try {
    formatCustomerPhone()
    formatCustomerName()
    formatAppleId()
    formatRemarks()

    const valid = await formRef.value.validate()
    if (!valid) return

    submitting.value = true
    const response = await unifiedApi.post('/inventory/quick-sale', buildQuickSaleSubmitPayload(formData))

    if (response.success) {
      showSuccess('快速出库成功！')
      emit('success')
      handleCancel()
    } else {
      showError(response.message || '快速出库失败')
    }
  } catch (err: unknown) {
    logger.error('快速出库失败:', err)
    const errorMessage = err instanceof Error
      ? err.message
      : '快速出库失败，请稍后重试'
    showError(errorMessage)
  } finally {
    submitting.value = false
  }
}

// 取消操作
const handleCancel = () => {
  resetForm()
  dialogVisible.value = false
}

// ==================== 监听器 ====================

watch(
  () => props.modelValue,
  async (newVal) => {
    if (newVal) {
      resetForm()
      await applyInitialData()
    }
  }
)

// 监听销售价格变化，当选择国补刷卡时自动更新备注
watch(() => formData.sale_price, () => {
  if (formData.payment_method === 'subsidy_card' || formData.payment_channel === 'subsidy_card') {
    calculateSubsidyRemarks()
  }
})

// 点击外部关闭客户搜索结果
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const searchContainer = target.closest('.customer-search-container')
  const searchResults = target.closest('.customer-search-results, .customer-search-dropdown')

  // 如果点击的是搜索容器内的元素，不关闭
  if (searchContainer || searchResults) {
    return
  }

  // 如果点击的是客户姓名或Apple ID输入框，不关闭
  const targetField = target.getAttribute('data-field')
  if (targetField === 'customer_name' || targetField === 'apple_id') {
    return
  }

  // 检查点击的元素是否是输入框内部的元素
  const parentInput = target.closest('input[data-field="customer_name"], input[data-field="apple_id"]')
  if (parentInput) {
    return
  }

  showCustomerSearchResults.value = false
  customerSearchResultsStyle.value = {}
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('scroll', scheduleCustomerSearchResultsLayout, true)
  window.addEventListener('resize', scheduleCustomerSearchResultsLayout, { passive: true })
  window.visualViewport?.addEventListener('resize', scheduleCustomerSearchResultsLayout)
  window.visualViewport?.addEventListener('scroll', scheduleCustomerSearchResultsLayout)
})

onUnmounted(() => {
  clearCustomerSearchTimeout()
  clearCustomerSearchLayoutFrame()
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('scroll', scheduleCustomerSearchResultsLayout, true)
  window.removeEventListener('resize', scheduleCustomerSearchResultsLayout)
  window.visualViewport?.removeEventListener('resize', scheduleCustomerSearchResultsLayout)
  window.visualViewport?.removeEventListener('scroll', scheduleCustomerSearchResultsLayout)
})

watch(
  () => [showCustomerSearchResults.value, customerOptions.value.length, customerLookupLoading.value],
  async ([visible]) => {
    if (!visible) {
      customerSearchResultsStyle.value = {}
      return
    }

    await nextTick()
    scheduleCustomerSearchResultsLayout()
  }
)
</script>

<style scoped lang="scss" src="./styles/quick-sale-modal/form-and-customer.scss"></style>
<style scoped lang="scss" src="./styles/quick-sale-modal/responsive.scss"></style>
<style scoped lang="scss" src="./styles/quick-sale-modal/feedback.scss"></style>
