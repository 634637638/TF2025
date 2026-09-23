<!--
  QuickSaleModal - 快速出库模态框组件（基于 MobileDialog）

  功能描述：
  - 快速创建销售出库记录，跳过入库流程
  - 完整的表单验证
  - 响应式设计，移动端友好
  - 自动计算利润和利润率

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
      <div class="quick-sale-footer">
        <div class="footer-actions">
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
      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-mobile-alt" />
          设备信息
        </div>

        <div class="form-row form-row-5">
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
        </div>

        <div class="form-row">
          <el-form-item
            label="序列号"
            prop="serial_number"
          >
            <el-input
              v-model="formData.serial_number"
              placeholder="请输入序列号"
              maxlength="18"
              clearable
              @input="formatSerialNumber"
            >
              <template #suffix>
                <i class="fas fa-hashtag serial-icon" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item
            label="IMEI"
            prop="imei"
          >
            <div
              style="cursor: pointer; width: 100%;"
              @dblclick="handleImeiDoubleClick"
              @touchend.stop="handleImeiTouchEnd"
            >
              <el-input
                v-model="formData.imei"
                :placeholder="formData.isNoIMEIMode ? '已启用无IMEI模式' : '请输入15位IMEI号'"
                :maxlength="formData.isNoIMEIMode ? 30 : 15"
                clearable
                @input="formatIMEI"
              >
                <template #suffix>
                  <i class="fas fa-barcode imei-icon" />
                </template>
              </el-input>
            </div>
          </el-form-item>
        </div>

        <div class="form-row form-row-4">
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
            label="销售价格"
            prop="sale_price"
          >
            <el-input
              :model-value="formatPriceInputValue(formData.sale_price)"
              placeholder="请输入销售价格"
              inputmode="numeric"
              clearable
              @input="handlePriceInput('sale_price', $event)"
            >
              <template #prefix>
                ¥
              </template>
            </el-input>
            <div
              v-if="showProfit"
              class="profit-hint"
            >
              利润: <span class="profit-value">¥{{ profit }}</span>
            </div>
          </el-form-item>
        </div>
      </div>

      <!-- 客户信息 -->
      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-user" />
          客户信息
        </div>

        <div class="form-row form-row-3 customer-form-row">
          <el-form-item
            label="客户手机"
            prop="customer_phone"
            class="customer-phone-item"
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
                :min-query-length="11"
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
            class="customer-name-item"
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
            <div class="input-hint">
              只允许中文和英文
            </div>
          </el-form-item>

          <el-form-item
            label="Apple ID"
            prop="apple_id"
            class="customer-apple-item"
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
            <div class="input-hint">
              支持手机号或邮箱
            </div>
          </el-form-item>
        </div>
      </div>

      <!-- 销售信息 -->
      <div class="form-section">
        <div class="section-title">
          <i class="fas fa-shopping-cart" />
          销售信息
        </div>

        <div class="form-row form-row-3">
          <el-form-item
            label="入库日期"
            prop="inventory_time"
          >
            <el-date-picker
              v-model="formData.inventory_time"
              type="date"
              placeholder="请选择入库日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 140px"
            />
          </el-form-item>

          <el-form-item
            label="销售日期"
            prop="sale_time"
          >
            <el-date-picker
              v-model="formData.sale_time"
              type="date"
              placeholder="请选择销售日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              style="width: 140px"
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

        <div class="form-row form-row-3">
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
            v-if="formData.payment_method === 'mobile' || formData.payment_method === 'bank_card' || formData.payment_method === 'subsidy_card'"
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

        <el-form-item
          label="备注"
          prop="remarks"
        >
          <el-input
            v-model="formData.remarks"
            type="textarea"
            :rows="2"
            placeholder="销售备注信息"
            maxlength="200"
            show-word-limit
            @input="formatRemarks"
          />
          <div class="input-hint">
            不允许特殊字符和HTML标签
          </div>
        </el-form-item>
      </div>
    </el-form>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ValidationRules } from '@/composables'
import { useNotification } from '@/composables/useNotification'
import unifiedApi from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useAuthStore } from '@/stores/auth'
import MobileDialog from '@/components/MobileDialog.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
import { useMobile } from '@/composables/mobile'
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
  CustomerOption,
  PriceField,
  QuickSaleProps
} from './quick-sale/types'

// ==================== 类型定义 ====================

const props = defineProps<QuickSaleProps>()
const emit = defineEmits<UpdateModelValueEmits & SuccessEmits>()

// ==================== Composables ====================

const { isMobile, isIOS } = useMobile()
const authStore = useAuthStore()
const { success: showSuccess, error: showError, warning: showWarning, info: showInfo } = useNotification()

// ==================== 响应式数据 ====================

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const formRef = ref<FormInstance>()
const submitting = ref(false)

// 表单数据
const formData = reactive(createDefaultQuickSaleForm(authStore.user?.id || null))

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
const customerNameInputRef = ref<any>(null)
const customerNameLastTapAt = ref(0)
const customerSearchContainerRef = ref<HTMLElement | null>(null)
const customerSearchResultsStyle = ref<Record<string, string>>({})
const customerSearchLayoutFrame = ref<number | null>(null)

const normalizeCustomerOption = (
  customer?: Partial<CustomerOption> & Record<string, unknown> | null
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
  formData.remarks = ''
}

// ==================== 计算属性 ====================

const profit = computed(() => {
  if (!formData.purchase_cost || !formData.sale_price) return 0
  return formData.sale_price - formData.purchase_cost
})

const showProfit = computed(() => {
  return (formData.purchase_cost || 0) > 0 && (formData.sale_price || 0) > 0
})

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
  sale_price: [
    ValidationRules.positiveNumber('销售价格不能为负数')
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
  payment_method: [
    ValidationRules.required('请选择支付方式')
  ],
  payment_channel: [
    {
      validator: (_rule: unknown, value: string, callback: (_error?: Error) => void) => {
        if (formData.payment_method !== 'cash' && !value) {
          callback(new Error('请选择支付渠道'))
          return
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}))

// ==================== 方法 ====================

// 品牌变化处理
const handleBrandChange = async () => {
  formData.model_id = null
  filteredModels.value = []

  if (!formData.brand_id) return

  try {
    const apiUrl = `/brands/${formData.brand_id}/models`
    const response = await unifiedApi.get(apiUrl)

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

// 移动端不可靠地产生 dblclick，用同一输入区域的两次触摸模拟双击。
let lastImeiTouchAt = 0
let suppressNativeImeiDoubleClickUntil = 0

const handleImeiTouchEnd = (event: TouchEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, .el-button, .el-input__clear, .el-input__suffix')) {
    lastImeiTouchAt = 0
    return
  }

  const now = Date.now()
  if (now - lastImeiTouchAt <= 400) {
    lastImeiTouchAt = 0
    suppressNativeImeiDoubleClickUntil = now + 500
    enableNoIMEIMode()
    return
  }

  lastImeiTouchAt = now
}

const handleImeiDoubleClick = () => {
  if (Date.now() < suppressNativeImeiDoubleClickUntil) return
  enableNoIMEIMode()
}

// 格式化序列号 - 只允许字母和数字，转大写，最多18位
const formatSerialNumber = () => {
  formData.serial_number = formatQuickSaleSerialNumber(formData.serial_number)
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
    formData.remarks = subsidyResult.remarks
  } else {
    // 清空支付渠道和备注
    formData.payment_channel = ''
    formData.remarks = ''
  }
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
    formData.remarks = ''
    return
  }

  formData.remarks = subsidyResult.remarks
}

// 格式化客户姓名 - 只允许中文、英文、空格，去除特殊字符
const formatCustomerName = () => {
  formData.customer_name = normalizePersonName(formData.customer_name, 20)
}

const resolveNativeCustomerInput = (source: any): HTMLInputElement | null => {
  if (!source) return null
  if (source instanceof HTMLInputElement) return source
  if (source instanceof HTMLElement && typeof source.querySelector === 'function') {
    const nestedInput = source.querySelector('input, textarea')
    if (nestedInput instanceof HTMLInputElement) return nestedInput
  }
  if (source?.target instanceof HTMLInputElement) return source.target
  if (source?.target instanceof HTMLElement && typeof source.target.querySelector === 'function') {
    const nestedInput = source.target.querySelector('input, textarea')
    if (nestedInput instanceof HTMLInputElement) return nestedInput
  }
  if (source?.input instanceof HTMLInputElement) return source.input
  if (source?.$el && typeof source.$el.querySelector === 'function') {
    return source.$el.querySelector('input')
  }
  return null
}

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

const _promptCustomerNameForIOS = async (currentName: string) => {
  const promptedName = window.prompt('请输入客户姓名', currentName)
  if (promptedName === null) return null

  const normalizedName = normalizePersonName(promptedName, 20)
  if (!normalizedName) {
    showWarning('客户姓名不能为空')
    return null
  }

  return normalizedName
}

const _unlockCustomerNameFromTouch = (source: EventTarget | null | undefined) => {
  const touchedInput = resolveNativeCustomerInput(source)
  const fallbackInput = resolveNativeCustomerInput(
    document.querySelector('input[name="quick-sale-customer-name"]')
  )

  customerNameEditing.value = true

  const targetInput = touchedInput || fallbackInput
  if (!targetInput) return

  targetInput.readOnly = false
  targetInput.removeAttribute('readonly')
  targetInput.disabled = false
  targetInput.removeAttribute('disabled')
  targetInput.focus()
  targetInput.click()

  try {
    const length = targetInput.value?.length || 0
    targetInput.setSelectionRange(length, length)
  } catch {
    // ignore
  }
}

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

const handleCustomerNameTouchEnd = (_event: TouchEvent) => {
  if (!isIOS.value) return

  const now = Date.now()
  const interval = now - customerNameLastTapAt.value
  customerNameLastTapAt.value = now

  if (interval > 0 && interval < 320) {
    if (!foundCustomer.value) return
    const promptedName = window.prompt('请输入客户姓名', formData.customer_name)
    if (promptedName === null) return
    const normalizedName = normalizePersonName(promptedName, 20)
    if (!normalizedName) {
      showWarning('客户姓名不能为空')
      return
    }
    formData.customer_name = normalizedName
    void saveCustomerNameEdit()
  }
}

const handleCustomerNameBlur = () => {
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

  try {
    const response = await unifiedApi.put(`/customers/${foundCustomer.value.id}`, {
      name: formData.customer_name
    })

    if (!response.success) {
      throw new Error(response.message || '更新客户失败')
    }

    foundCustomer.value.name = formData.customer_name
    showSuccess('客户姓名更新成功')
  } catch (err) {
    logger.error('更新客户失败:', err)
    showError(err instanceof Error ? err.message : '更新客户失败')
  } finally {
    customerNameEditing.value = false
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
    // 始终使用模糊搜索接口（支持手机号和姓名的部分匹配）
    const response = await unifiedApi.get(`/sales/customers?search=${encodeURIComponent(query)}`)

    if (!isActiveCustomerSearch(query, requestId)) {
      return
    }

    if (response.success) {
      customerOptions.value = extractResponseData<Array<Partial<CustomerOption> & Record<string, unknown>>>(response)
        .map((item) => normalizeCustomerOption(item))
    } else {
      customerOptions.value = []
    }
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

<style lang="scss" scoped>
.quick-sale-form {
  padding: 0;

  :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    border-radius: 6px;
  }

  // 输入框图标
  .imei-icon,
  .serial-icon,
  .phone-icon,
  .idcard-icon {
    color: var(--color-info);
    font-size: 14px;
  }

  // 点击外部关闭下拉菜单
  :deep(.el-form-item__content) {
    position: relative;
  }
}

:global(.quick-sale-dialog) {
  --dialog-side-gap: 4px;
  --dialog-vertical-gap: 12px;
  --dialog-max-width: min(800px, calc(100vw - 8px));
  --mobile-dialog-body-padding: 8px 6px 8px;
  --mobile-dialog-footer-padding: 0 6px 6px;
}

:global(.quick-sale-dialog.mobile-dialog-sheet-panel) {
  border-radius: 24px !important;
  max-height: calc(100dvh - 24px) !important;
}

:global(.quick-sale-dialog .mobile-dialog-sheet-header) {
  min-height: calc(82px + env(safe-area-inset-top));
  padding: calc(18px + env(safe-area-inset-top)) 64px 18px 18px;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--tf-color-gray-200);

  &:last-of-type {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-primary);

  i {
    color: var(--color-primary);
    font-size: 16px;
  }
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  &.form-row-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  &.form-row-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  &.form-row-5 {
    grid-template-columns: repeat(5, 1fr);
  }
}

// 序列号和IMEI输入框样式 - 确保占满可用空间
.form-row {
  :deep(.el-form-item__content) {
    width: 100%;
  }

  :deep(.el-input) {
    width: 100%;
  }

  :deep(.el-input__wrapper) {
    width: 100%;
  }
}

.profit-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-info);

  .profit-value {
    color: var(--color-success);
    font-weight: 600;
  }
}

// 客户检索相关样式
.customer-search-container {
  position: relative;
}

.customer-search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid var(--tf-color-gray-300-alt);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  min-width: 0;

  .search-loading {
    padding: 16px 20px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    i {
      margin-right: 0;
    }
  }

  .customer-item {
    padding: 16px 20px;
    cursor: pointer;
    border-bottom: 1px solid var(--tf-color-gray-200-alt);
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--tf-color-surface-muted);
    }

    &:last-child {
      border-bottom: none;
    }

    .customer-info {
      display: flex;
      flex-direction: column;
      gap: 7px;

      .customer-headline {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: nowrap;
        min-width: 0;
      }

      .customer-subline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
      }

      .customer-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--tf-color-neutral-800);
        line-height: 1.2;
        min-width: 0;
        flex: 0 1 auto;
        white-space: nowrap;
      }

      .customer-phone {
        font-size: 12px;
        color: var(--tf-color-slate-600);
        line-height: 1.2;
        min-width: 0;
        white-space: nowrap;
      }

      .member-number {
        padding: 2px 8px;
        background: linear-gradient(135deg, var(--tf-color-surface-blue-soft) 0%, var(--tf-color-blue-tailwind-100) 100%);
        color: var(--tf-color-blue-700);
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
        flex: 0 0 auto;
      }

      .vip-badge {
        background: linear-gradient(135deg, var(--tf-color-rose-400) 0%, var(--tf-color-amber-500) 100%);
        color: white;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
        flex-shrink: 0;
        justify-self: end;
        box-shadow: 0 6px 14px rgba(245, 158, 11, 0.18);
      }
    }
  }

  .create-new-customer {
    padding: 16px 20px;
    background: var(--tf-color-surface-muted);
    cursor: pointer;
    transition: background-color 0.2s;
    color: var(--success-color);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;

    &:hover {
      background: var(--tf-color-border-muted);
    }

    i {
      margin-right: 0;
    }
  }
}

.customer-search-results--floating {
  position: fixed;
  right: auto;
  z-index: 3100;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 768px) {
  .customer-form-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .customer-phone-item,
  .customer-name-item {
    grid-column: span 1;
    min-width: 0;
  }

  .customer-apple-item {
    grid-column: 1 / -1;
  }

  .customer-search-results {
    max-height: 250px;
  }

  .customer-search-results .search-loading {
    padding: 16px 20px;
    font-size: 14px;
    gap: 8px;
  }

  .customer-search-results .customer-item {
    padding: 9px 10px;
  }

  .customer-search-results .customer-info {
    gap: 5px;
  }

  .customer-search-results .customer-headline,
  .customer-search-results .customer-subline {
    gap: 4px;
  }

  .customer-search-results .customer-name {
    font-size: 12px;
  }

  .customer-search-results .member-number {
    font-size: 8px;
    line-height: 1.1;
    padding: 1px 5px;
    white-space: nowrap;
  }

  .customer-search-results .customer-phone {
    font-size: 11px;
  }

  .customer-search-results .vip-badge {
    font-size: 8px;
    padding: 1px 5px;
    line-height: 1.1;
    white-space: nowrap;
    box-shadow: none;
  }

  .customer-search-results .create-new-customer {
    padding: 10px 12px;
    font-size: 12px;
    gap: 6px;
  }
}

@media (max-width: 430px) {
  .customer-search-results {
    max-height: 240px;
  }

  .customer-search-results .customer-item {
    padding: 7px 9px;
  }

  .customer-search-results .customer-headline {
    gap: 3px;
  }

  .customer-search-results .customer-subline {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3px;
  }

  .customer-search-results .customer-name,
  .customer-search-results .customer-phone {
    overflow: visible;
    text-overflow: clip;
  }

  .customer-search-results .customer-phone {
    font-size: 8.5px;
    white-space: nowrap;
    word-break: keep-all;
    letter-spacing: -0.02em;
  }

  .customer-search-results .customer-name {
    font-size: 10.5px;
    line-height: 1.1;
  }

  .customer-search-results .member-number,
  .customer-search-results .vip-badge {
    font-size: 6px;
    padding: 0 3px;
    line-height: 1;
    max-width: 100%;
  }
}

@media (max-width: 414px) {
  .customer-search-results .customer-item {
    padding: 7px 8px;
  }

  .customer-search-results .customer-name {
    font-size: 10px;
  }

  .customer-search-results .customer-phone {
    font-size: 8px;
    letter-spacing: -0.025em;
  }

  .customer-search-results .member-number,
  .customer-search-results .vip-badge {
    font-size: 5px;
    padding: 0 2px;
    transform: scale(0.92);
    transform-origin: right center;
  }
}

@media (max-width: 390px) {
  .customer-search-results .customer-item {
    padding: 6px 8px;
  }

  .customer-search-results .customer-headline,
  .customer-search-results .customer-subline {
    gap: 2px;
  }

  .customer-search-results .customer-name {
    font-size: 9px;
  }

  .customer-search-results .customer-phone {
    font-size: 7.5px;
    letter-spacing: -0.03em;
  }

  .customer-search-results .member-number,
  .customer-search-results .vip-badge {
    font-size: 4.5px;
    padding: 0 1px;
    transform: scale(0.88);
    transform-origin: right center;
  }
}

@media (max-width: 375px) {
  .customer-search-results {
    max-height: 220px;
  }

  .customer-search-results .customer-item {
    padding: 6px 7px;
  }

  .customer-search-results .customer-info {
    gap: 3px;
  }

  .customer-search-results .customer-headline,
  .customer-search-results .customer-subline {
    gap: 2px;
  }

  .customer-search-results .customer-name {
    font-size: 7px;
    line-height: 1;
  }

  .customer-search-results .customer-phone {
    font-size: 6.5px;
    line-height: 1.05;
    letter-spacing: -0.04em;
  }

  .customer-search-results .member-number,
  .customer-search-results .vip-badge {
    font-size: 3.5px;
    padding: 0 1px;
    line-height: 0.9;
    border-radius: 999px;
    transform: scale(0.82);
    transform-origin: right center;
  }
}

@media (max-width: 360px) {
  .customer-search-results .customer-headline {
    flex-wrap: nowrap;
  }

  .customer-search-results .customer-subline {
    grid-template-columns: minmax(0, 1fr);
    justify-items: start;
  }

  .customer-search-results .member-number,
  .customer-search-results .vip-badge {
    justify-self: start;
    max-width: 100%;
  }
}

.lookup-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-primary);

  i {
    font-size: 12px;
  }
}

.found-customer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-success);
  background: var(--tf-color-blue-50);
  padding: 4px 8px;
  border-radius: 4px;

  i {
    font-size: 13px;
  }
}

.readonly-hint {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-info);
}

// 输入提示
.input-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-info);
  line-height: 1.4;
}

// 底部自定义
.quick-sale-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;

}

// 移动端适配
@media (max-width: 767px) {
  .quick-sale-form {
    :deep(.el-form-item) {
      margin-bottom: 8px;
    }

    :deep(.el-form-item__label) {
      font-size: 13px;
      margin-bottom: 4px;
    }
  }

  .form-section {
    margin-bottom: 12px;
    padding: 10px 8px 8px;
    border: 1px solid var(--tf-color-surface-cool);
    border-radius: 14px;
    background: linear-gradient(180deg, var(--color-bg-white) 0%, var(--tf-color-surface-cool-alt) 100%);

    &:last-of-type {
      margin-bottom: 0;
      padding-bottom: 8px;
    }
  }

  .form-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;

    &.form-row-3,
    &.form-row-5 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .form-row.form-row-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .section-title {
    font-size: 14px;
    margin-bottom: 12px;
    padding-bottom: 6px;
  }

  .quick-sale-footer {
    flex-direction: row;
    width: 100%;
    gap: 6px;

  }

}

// 小屏幕适配（iPhone SE）
@media (max-width: 390px) {
  :global(.quick-sale-dialog) {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 6px 4px 6px;
    --mobile-dialog-footer-padding: 0 4px 4px;
  }

  .quick-sale-form {
    :deep(.el-form-item) {
      margin-bottom: 12px;
    }
  }

  .form-row {
    gap: 8px;
  }

  .section-title {
    font-size: 13px;
  }

  .profit-hint {
    font-size: 11px;
  }
}
</style>
