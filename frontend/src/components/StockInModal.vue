<!--
  StockInModal - 现代化库存入库模态框组件

  功能描述：
  - 提供手机端友好的库存入库功能
  - 支持扫码识别IMEI和序列号
  - 智能识别苹果和国产品牌的不同格式
  - 实时表单验证和数据联动
  - 现代化UI设计，支持移动端优化

  权限要求：
  - stock-in:view (查看权限)
  - stock-in:create (创建权限)

  API接口：
  - GET /suppliers - 获取供应商列表
  - GET /stores - 获取店铺列表
  - GET /brands - 获取品牌列表
  - GET /models - 获取型号列表
  - POST /stock-in - 提交入库数据
-->
<template>
  <!-- 统一入库弹窗 -->
  <MobileDialog
    v-model="dialogVisible"
    :title="dialogTitle"
    :width="isMobile ? '95%' : '1240px'"
    :force-fullscreen="isMobile"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    dialog-class="stock-in-dialog"
    :show-default-footer="false"
    destroy-on-close
    @close="handleDialogClose"
  >
    <div class="stock-in-workspace">
      <el-form
        ref="formRef"
        :model="stockInForm"
        :rules="formRules"
        label-position="top"
        class="modern-form tf-dialog-form tf-dialog-form--stacked"
      >
        <StockInBasicInfoSection
          :is-mobile="isMobile"
          :form-data="stockInForm"
          :suppliers="getFilteredSuppliers()"
          :stores="getFilteredStores()"
          :handle-supplier-filter="handleSupplierFilter"
          :handle-store-filter="handleStoreFilter"
        />

        <StockInPhoneListSection
          :is-mobile="isMobile"
          :cache-version="cacheVersion"
          :form-data="stockInForm"
          :has-row-error="hasRowError"
          :get-filtered-brands-for-phone="getFilteredBrandsForPhone"
          :get-filtered-models-for-phone="getFilteredModelsForPhone"
          :get-filtered-colors-for-phone="getFilteredColorsForPhone"
          :get-filtered-memories-for-phone="getFilteredMemoriesForPhone"
          :handle-brand-filter="handleBrandFilter"
          :handle-model-filter="handleModelFilter"
          :handle-color-filter="handleColorFilter"
          :handle-memory-filter="handleMemoryFilter"
          :handle-brand-change="handleBrandChange"
          :format-serial-number="formatSerialNumber"
          :format-imei="formatIMEI"
          :format-price-value="formatPriceValue"
          :update-purchase-price="updatePurchasePrice"
          :remove-phone="removePhone"
          :validate-serial-on-blur="validateSerialOnBlur"
          :validate-imei-on-blur="validateIMEIOnBlur"
          :scan-serial-number="scanSerialNumber"
          :scan-imei="scanIMEI"
          :enable-no-imei-mode="enableNoIMEIMode"
          @add="addPhone"
          @batch="showBatchCountDialog = true"
          @clear="clearAllPhones"
        />

        <section class="stock-in-section stock-in-remarks">
          <header class="stock-in-section__header">
            <h3 class="stock-in-section__title">
              备注信息
            </h3>
          </header>
          <div class="stock-in-section__body">
            <el-form-item
              label="备注"
              prop="remarks"
            >
              <el-input
                v-model="stockInForm.remarks"
                type="textarea"
                :rows="2"
                placeholder="请输入备注信息"
                resize="none"
              />
            </el-form-item>
          </div>
        </section>
      </el-form>
    </div>

    <template #footer>
      <div class="tf-dialog-actions">
        <el-button @click="handleDialogClose">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ mode === 'create' ? '提交入库' : '更新入库' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>

  <!-- 优化的扫码器组件 -->
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

  <!-- 批量添加对话框 -->
  <MobileDialog
    v-model="showBatchCountDialog"
    title="批量添加商品"
    width="400px"
    :close-on-click-modal="false"
    dialog-class="stock-in-batch-dialog"
    :show-default-footer="false"
  >
    <el-form @submit.prevent="confirmBatchAdd">
      <el-form-item label="添加数量">
        <el-input-number
          v-model="batchCount"
          :min="1"
          :max="100"
          placeholder="请输入要添加的商品数量"
          style="width: 100%"
        />
        <div class="batch-count-hint">
          最多可一次添加 100 条商品
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="tf-dialog-actions">
        <el-button @click="showBatchCountDialog = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="confirmBatchAdd"
        >
          确定添加
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, defineAsyncComponent } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { useAuthStore } from '@/stores/auth'
const OptimizedScanner = defineAsyncComponent(() => import('./OptimizedScanner.vue'))
import StockInBasicInfoSection from './stock-in/StockInBasicInfoSection.vue'
import StockInPhoneListSection from './stock-in/StockInPhoneListSection.vue'
import {
  applyStockInScanResult,
  buildStockInSubmitPayload,
  buildStockInScanPromptConfig,
  createEmptyStockInPhone,
  createStockInPhoneBatch,
  findStockInBrand,
  filterByQuery,
  formatStockInPriceValue,
  getStockInModelsForPhone,
  initializeStockInFormData,
  loadBrandModels as loadStockInBrandModels,
  loadStockInDropdownData,
  normalizeIMEIInput,
  normalizePriceInput,
  normalizeSerialNumberInput,
  parsePriceValue,
  resolveStockInBrandId,
  toggleNoIMEIModeState,
  validateStockInPhone,
  validateStockInPhones,
  validateIMEI,
  validateSerialNumber
} from './stock-in/helpers'
import { useMobile } from '@/composables/mobile'
import type { Supplier, Store } from '@/types/system'
import type { Brand, Model, Color, MemoryOption as Memory } from '@/types'
import type { ModalProps, UpdateVisibleEmits, SuccessEmits, CancelEmits } from '@/types/component'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import type { StockInFormModel as StockInForm, StockInPhoneItem as PhoneItem } from './stock-in/types'

// ==================== Props & Emits ====================

interface Props extends ModalProps {
  mode?: 'create' | 'edit'
  editId?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  editId: ''
})

type Emits = UpdateVisibleEmits & SuccessEmits & CancelEmits

const emit = defineEmits<Emits>()

// ==================== Composables ====================

const { isMobile } = useMobile()
const authStore = useAuthStore()

// ==================== 响应式数据 ====================

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const dialogTitle = computed(() => {
  return props.mode === 'create' ? '新增入库' : '编辑入库'
})

const formRef = ref<FormInstance>()
const submitting = ref(false)

// 表单数据
const stockInForm = reactive<StockInForm>({
  supplier_id: '',
  store_id: '',
  inventory_time: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
  operator_name: authStore.user?.name || authStore.user?.username || '',
  product_status: '全新',
  remarks: '',
  phones: []
})

// 下拉数据
const suppliers = ref<Supplier[]>([])
const stores = ref<Store[]>([])
const brands = ref<Brand[]>([])
const models = ref<Model[]>([])
const colors = ref<Color[]>([])
const memories = ref<Memory[]>([])

// 品牌型号缓存 - 按品牌ID存储对应的型号列表
const brandModelsCache = ref<Map<number, Model[]>>(new Map())
// 缓存版本号 - 用于强制更新视图
const cacheVersion = ref(0)
// 搜索关键词 - 按手机索引存储搜索关键词
const modelSearchQueries = ref<Map<number, string>>(new Map())
const colorSearchQueries = ref<Map<number, string>>(new Map())
const memorySearchQueries = ref<Map<number, string>>(new Map())
const brandSearchQueries = ref<Map<number, string>>(new Map())
// 入库信息的搜索关键词
const supplierSearchQuery = ref('')
const storeSearchQuery = ref('')

// 扫码器
const optimizedScannerVisible = ref(false)
const currentScanType = ref<'imei' | 'serial'>('imei')
const currentScanningPhone = ref<PhoneItem | null>(null)
const scannerPhone = computed(() => {
  if (!currentScanningPhone.value) {
    return undefined
  }

  const brand = findStockInBrand(brands.value, currentScanningPhone.value.brand)
  return {
    brand: brand?.name
  }
})

// 批量添加对话框
const showBatchCountDialog = ref(false)
const batchCount = ref(5)

// ==================== 表单验证规则 ====================

const formRules = {
  supplier_id: [
    ValidationRules.required('请选择供应商')
  ],
  store_id: [
    ValidationRules.required('请选择入库店铺')
  ],
  inventory_time: [
    ValidationRules.required('请选择入库日期')
  ],
  product_status: [
    ValidationRules.required('请选择商品状态')
  ]
}

// ==================== 方法 ====================

// 初始化数据
const initializeData = async () => {
  try {
    const { formData: nextForm, brandId } = await initializeStockInFormData({
      mode: props.mode,
      editId: props.editId,
      operatorName: authStore.user?.name || authStore.user?.username || ''
    })
    Object.assign(stockInForm, nextForm)

    if (brandId !== null) {
      await loadBrandModels(brandId)
    }
  } catch (error) {
    logger.error('加载编辑数据失败:', error)
    ElMessage.error('加载编辑数据失败')
  }
}

// 加载品牌的型号列表
const loadBrandModels = async (brandId: number) => {
  // 检查缓存
  if (brandModelsCache.value.has(brandId)) {
    cacheVersion.value++
    return
  }

  try {
    const brandModels = await loadStockInBrandModels(brandId)
    brandModelsCache.value.set(brandId, brandModels)
    cacheVersion.value++
  } catch (error) {
    logger.error(`加载品牌 ID ${brandId} 的型号失败:`, error)
  }
}

// 加载下拉数据 - 参考StockInPage的实现
const loadDropdownData = async () => {
  try {
    const dropdownData = await loadStockInDropdownData()
    suppliers.value = dropdownData.suppliers
    stores.value = dropdownData.stores
    brands.value = dropdownData.brands
    models.value = dropdownData.models
    colors.value = dropdownData.colors
    memories.value = dropdownData.memories
  } catch (error) {
    logger.error('加载下拉数据失败:', error)
    ElMessage.error('加载数据失败，请刷新页面重试')
  }
}

// 添加商品
const addPhone = () => {
  stockInForm.phones.push(createEmptyStockInPhone())
}

// 确认批量添加
const confirmBatchAdd = () => {
  const count = batchCount.value
  if (count && count > 0 && count <= 100) {
    stockInForm.phones.push(...createStockInPhoneBatch(count))
    ElMessage.success(`已添加 ${count} 条商品`)
    showBatchCountDialog.value = false
  } else {
    ElMessage.warning('请输入有效的数量（1-100）')
  }
}

// 清空所有商品
const clearAllPhones = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有商品吗？此操作不可恢复。',
      '清空确认',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    stockInForm.phones = []
    addPhone()
    ElMessage.info('已清空所有商品')
  } catch {
    // 用户取消操作
  }
}

// 移除商品
const removePhone = (index: number) => {
  stockInForm.phones.splice(index, 1)
}

// 检查行是否有错误
const hasRowError = (phone: PhoneItem) => {
  return validateStockInPhone(phone) !== null
}

// 品牌改变事件 - 清空型号并动态加载该品牌的型号
const handleBrandChange = async (phone: PhoneItem) => {
  phone.model = ''

  if (!phone.brand) return

  const brandId = resolveStockInBrandId(phone.brand)
  const selectedBrand = findStockInBrand(brands.value, phone.brand)
  if (!selectedBrand) {
    logger.warn(`❌ 未找到品牌 ID: ${phone.brand}`)
    return
  }

  if (brandId !== null) {
    await loadBrandModels(brandId)
  }
}

// 获取指定手机项的过滤后型号列表 - 支持搜索关键词
const getFilteredModelsForPhone = (phoneIndex: number) => {
  const phone = stockInForm.phones[phoneIndex]
  const searchQuery = modelSearchQueries.value.get(phoneIndex) || ''
  const filteredModels = getStockInModelsForPhone({
    phone,
    brands: brands.value,
    models: models.value,
    brandModelsCache: brandModelsCache.value,
    query: searchQuery
  })

  if (phone?.brand && filteredModels.length === 0 && !findStockInBrand(brands.value, phone.brand)) {
    logger.warn(`⚠️ 未找到品牌 ID: "${phone.brand}"`)
  }

  return filteredModels
}

// 获取指定手机项的过滤后颜色列表
const getFilteredColorsForPhone = (phoneIndex: number) => {
  const searchQuery = colorSearchQueries.value.get(phoneIndex) || ''
  return filterByQuery(colors.value, searchQuery, (color) => (color.name || '').toString())
}

// 获取指定手机项的过滤后内存列表
const getFilteredMemoriesForPhone = (phoneIndex: number) => {
  const searchQuery = memorySearchQueries.value.get(phoneIndex) || ''
  return filterByQuery(memories.value, searchQuery, (memory) => (memory.size || memory.name || memory.capacity || '').toString())
}

// 获取过滤后的供应商列表
const getFilteredSuppliers = () => {
  return filterByQuery(suppliers.value, supplierSearchQuery.value, (supplier) => (supplier.name || '').toString())
}

// 获取过滤后的店铺列表
const getFilteredStores = () => {
  return filterByQuery(stores.value, storeSearchQuery.value, (store) => (store.name || '').toString())
}

// filter-method 包装函数
const handleSupplierFilter = (query: string) => {
  supplierSearchQuery.value = query
  return true
}

const handleStoreFilter = (query: string) => {
  storeSearchQuery.value = query
  return true
}

const handleModelFilter = (query: string, index: number) => {
  modelSearchQueries.value.set(index, query)
  return true
}

const handleColorFilter = (query: string, index: number) => {
  colorSearchQueries.value.set(index, query)
  return true
}

const handleMemoryFilter = (query: string, index: number) => {
  memorySearchQueries.value.set(index, query)
  return true
}

const handleBrandFilter = (query: string, index: number) => {
  brandSearchQueries.value.set(index, query)
  return true
}

// 获取指定手机项的过滤后品牌列表
const getFilteredBrandsForPhone = (phoneIndex: number) => {
  const searchQuery = brandSearchQueries.value.get(phoneIndex) || ''
  return filterByQuery(brands.value, searchQuery, (brand) => (brand.name || '').toString())
}

// 启用无IMEI模式（双击IMEI输入框触发）
const enableNoIMEIMode = (phone: PhoneItem) => {
  const toggleResult = toggleNoIMEIModeState(phone)
  ElMessage[toggleResult.messageType](toggleResult.message)
}

// 格式化IMEI - 根据模式决定格式化规则
const formatIMEI = (phone: PhoneItem) => {
  phone.imei = normalizeIMEIInput(phone.imei, phone.isNoIMEIMode)
}

// 验证IMEI - 根据模式决定验证规则
const validateIMEIOnBlur = (phone: PhoneItem) => {
  phone.imeiValid = validateIMEI(phone.imei, phone.serial_number, phone.isNoIMEIMode)
}

// 格式化序列号 - 只允许数字和字母，字母自动大写
const formatSerialNumber = (phone: PhoneItem) => {
  phone.serial_number = normalizeSerialNumberInput(phone.serial_number)
}

// 验证序列号
const validateSerialOnBlur = (phone: PhoneItem) => {
  const serialValid = validateSerialNumber(phone.serial_number)
  phone.serialValid = serialValid

  if (serialValid) {
    phone.serialValid = true
    if (phone.isNoIMEIMode) {
      phone.imei = phone.serial_number
      phone.imeiValid = true
    }
  }
}

// 扫码IMEI
const scanIMEI = (phone: PhoneItem) => {
  currentScanningPhone.value = phone
  currentScanType.value = 'imei'

  // 所有设备都直接使用扫码器
  optimizedScannerVisible.value = true
}

// 扫码序列号
const scanSerialNumber = (phone: PhoneItem) => {
  currentScanningPhone.value = phone
  currentScanType.value = 'serial'

  // 所有设备都直接使用扫码器
  optimizedScannerVisible.value = true
}

// 扫码成功
const handleScanSuccess = (result: string) => {
  if (currentScanningPhone.value) {
    applyStockInScanResult(currentScanningPhone.value, currentScanType.value, result)
  }
  currentScanningPhone.value = null
}

// 扫码手动输入
const handleScanManual = () => {
  if (!currentScanningPhone.value) return

  const isIMEI = currentScanType.value === 'imei'
  const isNoIMEIMode = isIMEI && Boolean(currentScanningPhone.value.isNoIMEIMode)
  const promptConfig = buildStockInScanPromptConfig(currentScanType.value, isNoIMEIMode)

  ElMessageBox.prompt(
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
  ).then(({ value }) => {
    if (value && currentScanningPhone.value) {
      handleScanSuccess(value)
    }
  }).catch(() => {
    // 用户取消了输入
  })
}

// 扫码取消
const handleScanCancel = () => {
  currentScanningPhone.value = null
  optimizedScannerVisible.value = false
}

// 格式化价格显示 - 整数时不显示小数位
const formatPriceValue = (value: number | string | undefined): string => {
  return formatStockInPriceValue(value)
}

const updatePurchasePrice = (phone: PhoneItem, value: string) => {
  const normalized = normalizePriceInput(value)
  phone.purchase_cost = normalized ? parsePriceValue(normalized) : undefined
}

// 关闭对话框
const handleDialogClose = () => {
  optimizedScannerVisible.value = false
  currentScanningPhone.value = null
  currentScanType.value = 'imei'
  supplierSearchQuery.value = ''
  storeSearchQuery.value = ''
  modelSearchQueries.value.clear()
  colorSearchQueries.value.clear()
  memorySearchQueries.value.clear()
  brandSearchQueries.value.clear()
  showBatchCountDialog.value = false
  dialogVisible.value = false
}

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  if (!formRef.value) return

  try {
    // 验证表单
    const valid = await formRef.value.validate()
    if (!valid) return

    const phoneValidationError = validateStockInPhones(props.mode, stockInForm.phones)
    if (phoneValidationError) {
      ElMessage.error(phoneValidationError)
      return
    }

    submitting.value = true

    const submitData = buildStockInSubmitPayload(props.mode, stockInForm)

    // 提交数据
    const apiUrl = props.mode === 'create' ? '/stock-in' : `/stock-in/${props.editId}`
    const method = props.mode === 'create' ? 'post' : 'put'

    await unifiedApi[method](apiUrl, submitData)

    ElMessage.success(props.mode === 'create' ? '入库成功' : '更新成功')
    emit('success')
    handleDialogClose()
  } catch (error) {
    logger.error('提交失败:', error)
    ElMessage.error('提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

// ==================== 监听器 ====================

watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await Promise.all([initializeData(), loadDropdownData()])
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.modern-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modern-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.batch-count-hint {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 767px) {
  .modern-form {
    gap: 12px;
  }
}
</style>

<style lang="scss">
.stock-in-dialog {
  --dialog-max-width: 1240px;
}

.stock-in-dialog .stock-in-section {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.stock-in-dialog .stock-in-section__header {
  min-height: 46px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  box-sizing: border-box;
}

.stock-in-dialog .stock-in-section__title {
  position: relative;
  margin: 0;
  padding-left: 10px;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 24px;
}

.stock-in-dialog .stock-in-section__title::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 3px;
  border-radius: 2px;
  background: var(--el-color-primary);
  content: '';
}

.stock-in-dialog .stock-in-section__body {
  padding: 16px;
}

.stock-in-dialog .field-hint {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.4;
}

@media (max-width: 767px) {
  .stock-in-dialog .stock-in-section__header {
    min-height: 42px;
    padding: 8px 10px;
  }

  .stock-in-dialog .stock-in-section__body {
    padding: 10px;
  }

  .stock-in-dialog .stock-in-section__title {
    font-size: 14px;
  }
}
</style>
