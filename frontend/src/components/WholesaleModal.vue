<template>
  <MobileDialog
    :model-value="visible"
    width="720px"
    dialog-class="wholesale-form-dialog"
    :show-close="true"
    :show-default-footer="false"
    :close-on-click-modal="props.closeOnClickModal !== false"
    @update:modelValue="emit('update:visible', $event)"
    @closed="resetForm"
  >
    <template #header>
      <div class="wholesale-modal-header">
        <div class="header-left">
          <div class="header-text">
            <h3>{{ mode === 'wholesale' ? '调货' : '划拨' }}</h3>
            <p>已选 {{ phoneCount }} 台</p>
          </div>
        </div>
      </div>
    </template>

    <div class="wholesale-modal-body">
          <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
            <WholesalePartySection
              :mode="mode"
              :form-data="formData"
              :stores="stores"
              :users="users"
              :selected-supplier-name="selectedSupplierName"
              :show-customer-search="showCustomerSearch"
              :customer-search-results="customerSearchResults"
              :customer-searching="customerSearching"
              :selected-customer="selectedCustomer"
              :handle-phone-input="handlePhoneInput"
              :handle-phone-focus="handlePhoneFocus"
              :handle-phone-blur="handlePhoneBlur"
              :handle-customer-name-input="handleCustomerNameInput"
              :select-customer="selectCustomer"
              :auto-create-customer="autoCreateCustomer"
              :handle-payment-method-change="handlePaymentMethodChange"
              :handle-payment-channel-change="handlePaymentChannelChange"
            />

            <WholesalePhoneSummarySection
              :mode="mode"
              :phone-count="phoneCount"
              :phones="displayPhones"
              :total-cost="totalCost"
              :total-wholesale-price="totalWholesalePrice"
              :format-price="formatPrice"
              :format-date="formatDate"
              :handle-cost-change="handleCostChange"
            />

            <!-- 通用：备注 -->
            <div class="form-section">
              <h4 class="section-title">
                <i class="fas fa-comment"></i>
                备注信息
              </h4>
              <el-form-item label="备注" prop="remarks">
                <el-input
                  v-model="formData.remarks"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入备注信息"
                  maxlength="200"
                  show-word-limit
                />
              </el-form-item>
            </div>
          </el-form>
    </div>

    <template #footer>
      <div class="wholesale-modal-footer">
        <el-button type="default" @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ submitting ? '处理中...' : '确认' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ValidationRules } from '@/composables'
import { unifiedApi } from '@/utils/unified-api'
import { isValidMobilePhone, normalizePersonName } from '@/utils/security'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import type { Supplier, Store, User } from '@/types'
import type { VisibleProps } from '@/types/component'
import WholesalePartySection from './wholesale/WholesalePartySection.vue'
import WholesalePhoneSummarySection from './wholesale/WholesalePhoneSummarySection.vue'
import {
  buildAutoCreateCustomerPayload,
  buildWholesaleCreatedCustomerState,
  buildWholesaleOpenFormPatch,
  buildTransferSubmitPayload,
  createWholesaleFormData,
  createWholesaleSearchResetState,
  formatWholesaleDate,
  formatWholesalePrice,
  initializeWholesalePhoneState,
  loadWholesaleDialogOptions,
  normalizeWholesaleCustomerInput,
  normalizeWholesalePhoneValue,
  resolveWholesaleErrorMessage,
  searchWholesaleCustomers,
  shouldShowWholesaleCustomerSearch,
  validateWholesaleSubmit
} from './wholesale/helpers'
import type {
  CollectedPriceItem,
  EditableWholesalePhone,
  WholesaleCustomerSearchItem as CustomerSearchItem,
  WholesaleFormData,
  WholesalePhone
} from './wholesale/types'

interface Props extends VisibleProps {
  mode: 'wholesale' | 'proxy'
  phoneIds: number[]
  phones: WholesalePhone[]
  closeOnClickModal?: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success', data: { success_count: number; total_count: number; message: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const customerSearching = ref(false)
const searchTimer = ref<number | null>(null)
const showCustomerSearch = ref(false)
const selectedCustomer = ref<CustomerSearchItem | null>(null)
const customerSearchResults = ref<CustomerSearchItem[]>([])
const customerSearchCache = ref(new Map<string, CustomerSearchItem[]>())
const isSelectingCustomer = ref(false)
const customerSearchRequestId = ref(0)

// 表单数据
const formData = ref<WholesaleFormData>(createWholesaleFormData())

// 表单验证规则 - 划拨模式下客户信息可选，批发模式下必填
const formRules = computed(() => {
  const rules: FormRules = {
    supplier_id: [
      ValidationRules.required('请选择供应商')
    ],
    sale_date: [
      ValidationRules.required('请选择销售时间')
    ]
  }

  // 批发模式下客户信息必填
  if (props.mode === 'wholesale') {
    rules.customer_phone = [
      ValidationRules.required('请输入手机号码'),
      ValidationRules.phone()
    ]
    rules.customer_name = [
      ValidationRules.required('请输入客户姓名')
    ]
  }

  return rules
})

// 供应商列表
const suppliers = ref<Supplier[]>([])
// 门店列表
const stores = ref<Store[]>([])
// 用户列表（销售员）
const users = ref<User[]>([])

// 显示的手机列表（使用原始数据）
const editablePhones = ref<EditableWholesalePhone[]>([])
// 采集价格数据缓存
const collectedPrices = ref<CollectedPriceItem[]>([])

// 获取采集价格数据
const syncEditablePhones = async (phones: WholesalePhone[], mode: 'wholesale' | 'proxy') => {
  if (!phones.length) {
    editablePhones.value = []
    if (!props.visible) {
      collectedPrices.value = []
    }
    return
  }

  try {
    const nextState = await initializeWholesalePhoneState({
      phones,
      mode
    })
    collectedPrices.value = nextState.collectedPrices
    editablePhones.value = nextState.editablePhones
  } catch (error) {
    collectedPrices.value = []
    editablePhones.value = []
    logger.error('初始化调货手机数据失败:', error)
  }
}

// 计算选中的供应商名称
const selectedSupplierName = computed(() => {
  if (!formData.value.supplier_id) return ''
  const supplier = suppliers.value.find(s => s.id === formData.value.supplier_id)
  return supplier ? supplier.name : ''
})

// 监听 props.phones 变化，初始化可编辑数据
watch(() => props.phones, async (newPhones) => {
  await syncEditablePhones(newPhones || [], props.mode)
}, { immediate: true, deep: true })

watch(() => props.mode, async (newMode) => {
  const sourcePhones = props.phones && props.phones.length > 0
    ? props.phones
    : editablePhones.value

  if (sourcePhones.length > 0) {
    await syncEditablePhones(sourcePhones, newMode)
  }
})

const displayPhones = computed(() => editablePhones.value)

const normalizeCustomerPhone = (phone: unknown) => normalizeWholesalePhoneValue(phone)

// 计算属性
const phoneCount = computed(() => props.phoneIds?.length || 0)

const totalCost = computed(() => {
  return displayPhones.value.reduce((sum, phone) => {
    // 划拨模式使用 editCost（已设置为0），批发模式使用 editCost 或原始价格
    return sum + (phone.editCost || 0)
  }, 0)
})

// 计算总批发价
const totalWholesalePrice = computed(() => {
  return displayPhones.value.reduce((sum, phone) => {
    return sum + (phone.wholesalePrice || 0)
  }, 0)
})

// 格式化价格（移除整数的.00后缀）
const formatPrice = (price: number) => formatWholesalePrice(price)

// 格式化日期（修复时区问题）
const formatDate = (date: string | null | undefined) => formatWholesaleDate(date)

// 处理入库价变化
const handleCostChange = () => {
  // 触发计算属性重新计算
}

// 支付方式变化处理
const handlePaymentMethodChange = () => {
  // 清空支付渠道
  formData.value.payment_channel = ''
}

// 支付渠道变化处理（保留，以防需要）
const handlePaymentChannelChange = () => {
  // 可以在这里添加额外的逻辑
}

// 处理手机号聚焦
const handlePhoneFocus = () => {
  if (shouldShowWholesaleCustomerSearch(formData.value.customer_phone)) {
    showCustomerSearch.value = true
  }
}

// 处理手机号失焦
const handlePhoneBlur = () => {
  // 延迟隐藏，以便点击搜索结果
  setTimeout(() => {
    if (!isSelectingCustomer.value) {
      showCustomerSearch.value = false
    }
  }, 200)
}

// 处理手机号输入
const handlePhoneInput = (value: string) => {
  const inputState = normalizeWholesaleCustomerInput(value, selectedCustomer.value)
  const cleanedValue = inputState.cleanedValue
  formData.value.customer_phone = cleanedValue
  customerSearchRequestId.value += 1

  if (inputState.shouldClearSelectedCustomer) {
    selectedCustomer.value = null
    formData.value.customer_id = null
  }

  // 清除之前的定时器
  if (searchTimer.value) {
    clearTimeout(searchTimer.value)
  }

  if (!cleanedValue) {
    customerSearchResults.value = []
    showCustomerSearch.value = false
    customerSearching.value = false
    return
  }

  showCustomerSearch.value = inputState.shouldShowSearch
  searchTimer.value = window.setTimeout(async () => {
    await searchCustomers(cleanedValue)
  }, 300)
}

const handleCustomerNameInput = (value: string) => {
  formData.value.customer_name = normalizePersonName(value, 20)
}

const isActiveCustomerSearch = (phoneNumber: string, requestId: number) =>
  requestId === customerSearchRequestId.value &&
  normalizeCustomerPhone(formData.value.customer_phone) === phoneNumber

// 搜索客户
const searchCustomers = async (phoneNumber: string) => {
  const requestId = customerSearchRequestId.value

  try {
    if (customerSearchCache.value.has(phoneNumber)) {
      if (isActiveCustomerSearch(phoneNumber, requestId)) {
        customerSearchResults.value = customerSearchCache.value.get(phoneNumber) || []
      }
      return
    }

    customerSearching.value = true
    const results = await searchWholesaleCustomers(phoneNumber)
    if (!isActiveCustomerSearch(phoneNumber, requestId)) {
      return
    }

    customerSearchResults.value = results
    customerSearchCache.value.set(phoneNumber, results)
  } catch (error) {
    logger.error('搜索客户失败:', error)
    if (isActiveCustomerSearch(phoneNumber, requestId)) {
      customerSearchResults.value = []
    }
  } finally {
    if (isActiveCustomerSearch(phoneNumber, requestId)) {
      customerSearching.value = false
    }
  }
}

// 选择客户
const selectCustomer = (customer: CustomerSearchItem) => {
  isSelectingCustomer.value = true
  const nextCustomerState = buildWholesaleCreatedCustomerState(customer)
  selectedCustomer.value = nextCustomerState.customer
  Object.assign(formData.value, nextCustomerState.formPatch)
  showCustomerSearch.value = false
  customerSearchResults.value = []

  // 清除表单验证错误
  nextTick(() => {
    formRef.value?.clearValidate('customer_phone')
    formRef.value?.clearValidate('customer_name')
  })

  setTimeout(() => {
    isSelectingCustomer.value = false
  }, 300)
}

// 自动创建新客户
const autoCreateCustomer = async () => {
  const normalizedCustomerPhone = normalizeCustomerPhone(formData.value.customer_phone)
  const normalizedCustomerName = normalizePersonName(formData.value.customer_name, 20)

  if (!normalizedCustomerName) {
    formData.value.customer_name = '客户'
  } else {
    formData.value.customer_name = normalizedCustomerName
  }

  if (!isValidMobilePhone(normalizedCustomerPhone)) {
    ElMessage.error('请输入有效的手机号码')
    return
  }

  try {
    const newCustomerData = buildAutoCreateCustomerPayload(formData.value, props.mode)
    formData.value.customer_name = newCustomerData.name

    const response = await unifiedApi.post('/customers', newCustomerData)

    if (response.success) {
      const nextCustomerState = buildWholesaleCreatedCustomerState(
        response.data as Partial<CustomerSearchItem>
      )
      selectedCustomer.value = nextCustomerState.customer
      Object.assign(formData.value, nextCustomerState.formPatch)
      customerSearchRequestId.value += 1
      customerSearchCache.value.set(normalizedCustomerPhone, [nextCustomerState.customer])
      showCustomerSearch.value = false
      customerSearchResults.value = []
      ElMessage.success('新客户创建成功')
    }
  } catch (error: unknown) {
    logger.error('创建客户失败:', error)
    ElMessage.error(resolveWholesaleErrorMessage(error, '创建客户失败'))
  }
}

const loadDialogOptions = async () => {
  try {
    const options = await loadWholesaleDialogOptions()
    suppliers.value = options.suppliers
    stores.value = options.stores
    users.value = options.users
  } catch (error) {
    logger.error('加载调货弹窗基础数据失败:', error)
  }
}

// 获取当前模式
const mode = computed(() => props.mode)

const applyWholesaleSearchResetState = () => {
  const resetState = createWholesaleSearchResetState()
  selectedCustomer.value = resetState.selectedCustomer
  customerSearchResults.value = resetState.customerSearchResults
  showCustomerSearch.value = resetState.showCustomerSearch
  customerSearching.value = resetState.customerSearching
  isSelectingCustomer.value = resetState.isSelectingCustomer
}

// 重置表单
const resetForm = () => {
  if (searchTimer.value) {
    clearTimeout(searchTimer.value)
    searchTimer.value = null
  }
  formData.value = createWholesaleFormData()
  applyWholesaleSearchResetState()
  customerSearchCache.value.clear()
  customerSearchRequestId.value += 1
  editablePhones.value = []
  collectedPrices.value = []
  formRef.value?.resetFields()
}

// 关闭对话框
const handleClose = () => {
  emit('update:visible', false)
  resetForm()
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    if (props.mode === 'wholesale') {
      try {
        await formRef.value.validate()
      } catch {
        return
      }
    }

    submitting.value = true
    const normalizedCustomerPhone = normalizeCustomerPhone(formData.value.customer_phone)
    const normalizedCustomerName = normalizePersonName(formData.value.customer_name, 20)
    formData.value.customer_name = normalizedCustomerName

    const submitValidationError = validateWholesaleSubmit({
      mode: props.mode,
      supplierId: formData.value.supplier_id,
      phones: editablePhones.value,
      normalizedCustomerPhone,
      isValidMobilePhone
    })
    if (submitValidationError) {
      ElMessage[submitValidationError.includes('批发价格') ? 'warning' : 'error'](submitValidationError)
      return
    }

    const url = props.mode === 'wholesale'
      ? '/transfers/wholesale'
      : '/transfers/proxy'

    const payload = buildTransferSubmitPayload({
      mode: props.mode,
      phoneIds: props.phoneIds,
      phones: editablePhones.value,
      formData: formData.value,
      selectedCustomer: selectedCustomer.value
    })

    const response = await unifiedApi.post(url, payload)

    if (response.success) {
      const successCount = response.data?.success_count || 0
      const totalCount = response.data?.total_count || props.phoneIds.length
      const message = response.message || `${props.mode === 'wholesale' ? '批发' : '划拨'}成功`

      ElMessage.success(message)
      emit('success', {
        success_count: successCount,
        total_count: totalCount,
        message
      })
      handleClose()
    } else {
      ElMessage.error(response.message || '操作失败')
    }
  } catch (error: unknown) {
    logger.error('提交失败:', error)
    ElMessage.error(resolveWholesaleErrorMessage(error, '操作失败，请稍后重试'))
  } finally {
    submitting.value = false
  }
}

// 监听 visible 变化
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await loadDialogOptions()
    Object.assign(formData.value, buildWholesaleOpenFormPatch({
      mode: props.mode,
      phones: props.phones || [],
      operatorName: authStore.user?.name || authStore.user?.username || ''
    }))
  }
})
</script>

<style lang="scss">
.wholesale-form-dialog {
  --dialog-side-gap: 4px;
  --dialog-vertical-gap: 8px;
  --dialog-max-width: calc(100vw - 8px);
  --mobile-dialog-body-padding: 6px 6px 8px;
  --mobile-dialog-footer-padding: 0 6px 6px;
}

.wholesale-form-dialog .el-dialog {
  margin: auto !important;
  width: min(720px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px) !important;
  border-radius: 22px !important;
  overflow: hidden;
  border: 1px solid rgba(124, 58, 237, 0.12);
  box-shadow: 0 28px 72px rgba(15, 23, 42, 0.24);
  background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%);
}

.wholesale-form-dialog .el-dialog__header {
  padding: 0 !important;
  margin-right: 0 !important;
  border-bottom: 0 !important;
}

.wholesale-form-dialog .el-dialog__body,
.wholesale-form-dialog .el-dialog__footer {
  padding: 0 !important;
}

.wholesale-form-dialog.mobile-dialog-sheet-panel {
  border-radius: 24px !important;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24) !important;
}

.wholesale-form-dialog .mobile-dialog-sheet-header {
  min-height: calc(62px + env(safe-area-inset-top));
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px 14px !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

.wholesale-form-dialog .mobile-dialog-sheet-header-content {
  justify-content: flex-start;
}

@media (max-width: 767px) {
  .wholesale-form-dialog .el-dialog {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    border-radius: 18px !important;
  }

  .wholesale-form-dialog .mobile-dialog-sheet-header {
    min-height: calc(56px + env(safe-area-inset-top));
    padding: calc(8px + env(safe-area-inset-top)) 12px 8px 12px !important;
  }
}
</style>

<style lang="scss" scoped>
.wholesale-modal-header {
  width: 100%;
  background: transparent;
  padding: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  min-height: 0;

  .header-left {
    display: flex;
    align-items: center;
    min-width: 0;

    .header-text {
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.2;
      }

      p {
        margin: 2px 0 0 0;
        font-size: 12px;
        line-height: 1.2;
        opacity: 0.82;
      }
    }
  }

}

.wholesale-modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(90vh - 140px);
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f2f5;

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
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
}

.section-title i {
  font-size: 16px;
}

.wholesale-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  background: #fafbfc;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .wholesale-modal-header {
    padding: 0;
    min-height: 0;

    .header-left {
      .header-text {
        h3 {
          font-size: 15px;
        }

        p {
          font-size: 11px;
        }
      }
    }

  }

  .wholesale-modal-body {
    padding: 16px;
    max-height: calc(100vh - 120px);
  }

  .wholesale-modal-footer {
    padding: 12px 16px;
    flex-direction: row-reverse;

    .el-button {
      flex: 1;
      margin: 0 4px;
    }
  }

  // 表单项全宽显示
  .form-section {
    margin-bottom: 20px;
    padding-bottom: 20px;
  }

  // 备注文本框优化
  :deep(.el-textarea__inner) {
    font-size: 14px;
  }
}

/* 超小屏幕适配 */
@media (max-width: 375px) {
  .wholesale-modal-body {
    padding: 12px;
  }

  .section-title {
    font-size: 13px;
  }
}
</style>
