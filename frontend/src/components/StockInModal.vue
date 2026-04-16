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
    <template v-if="isMobile" #header>
      <div class="stock-in-dialog__header">
        <span class="stock-in-dialog__title">{{ dialogTitle }}</span>
      </div>
    </template>

    <div class="dialog-body">
            <el-form
              ref="formRef"
              :model="stockInForm"
              :rules="formRules"
              label-position="top"
              class="modern-form"
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
                :enable-no-i-m-e-i-mode="enableNoIMEIMode"
                @add="addPhone"
                @batch="showBatchCountDialog = true"
                @clear="clearAllPhones"
              />

              <!-- 备注信息卡片 -->
              <div class="info-card">
                <div class="card-header">
                  <div class="card-icon">
                    <i class="fas fa-comment"></i>
                  </div>
                  <h3 class="card-title">备注信息</h3>
                </div>
                <div class="card-content">
                  <el-form-item label="备注" prop="remarks">
                    <el-input
                      v-model="stockInForm.remarks"
                      type="textarea"
                      :rows="2"
                      placeholder="请输入备注信息"
                      resize="none"
                    />
                  </el-form-item>
                </div>
              </div>
            </el-form>
          </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="operator-info">
          <span>入库员：<strong>{{ stockInForm.operator_name }}</strong></span>
        </div>
        <div class="footer-actions">
          <el-button type="default" @click="handleDialogClose">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ mode === 'create' ? '提交入库' : '更新入库' }}
          </el-button>
        </div>
      </div>
    </template>
  </MobileDialog>

  <!-- 优化的扫码器组件 -->
  <teleport to="body">
    <OptimizedScanner
      v-model:visible="optimizedScannerVisible"
      :scan-type="currentScanType"
      :phone="currentScanningPhone"
      :showROIDisplay="true"
      :enableAndroidOptimization="true"
      :showPerformance="isDevMode"
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
        <div style="margin-top: 8px; color: #909399; font-size: 12px;">
          最多可一次添加 100 条商品
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="default" @click="showBatchCountDialog = false">取消</el-button>
      <el-button type="primary" @click="confirmBatchAdd">确定添加</el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { useAuthStore } from '@/stores/auth'
import OptimizedScanner from './OptimizedScanner.vue'
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
  stock_in_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
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

// 批量添加对话框
const showBatchCountDialog = ref(false)
const batchCount = ref(5)

// 开发模式
const isDevMode = import.meta.env.DEV

// ==================== 表单验证规则 ====================

const formRules = {
  supplier_id: [
    ValidationRules.required('请选择供应商')
  ],
  store_id: [
    ValidationRules.required('请选择入库店铺')
  ],
  stock_in_date: [
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
  return filterByQuery(memories.value, searchQuery, (memory) => (memory.name || memory.capacity || '').toString())
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
  optimizedScannerVisible.value = false
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
  phone.purchase_price = normalized ? parsePriceValue(normalized) : undefined
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
/* ===== Element Plus Dialog 样式说明 ===== */
/* el-dialog 相关的全局样式覆盖已移至组件底部的非 scoped style 块 */
/* 这是因为 Vue 3 的 scoped 样式无法覆盖 Element Plus 的全局 !important 声明 */

/* 自定义头部 */
.stock-in-dialog__header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 64px;
  padding: 12px 56px 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-sizing: border-box;
}

.stock-in-dialog__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.02em;
}

/* Dialog 内容 - 由于全局样式已添加 padding，这里设为 0 */
.dialog-body {
  padding: 28px;
  background: #ffffff;
}

/* Dialog 底部 */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;

  .operator-info {
    font-size: 14px;
    color: #6b7280;
  }

  .footer-actions {
    display: flex;
    gap: 12px;
  }
}

/* ===== 信息卡片样式 ===== */
.info-card {
  background: #f8fafc;
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 24px;
  border: none;
  box-shadow: inset 0 0 0 1px rgba(203, 213, 225, 0.72);
  transition: all 0.24s ease;
}

.info-card:first-child {
  border-top: none;
}

.info-card:hover {
  box-shadow:
    inset 0 0 0 1px rgba(191, 219, 254, 0.9),
    0 10px 24px rgba(99, 102, 241, 0.08);
}

.card-header {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.96) 0%, rgba(241, 245, 249, 0.96) 100%);
  padding: 18px 22px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(203, 213, 225, 0.72);
}

.card-icon {
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex: 0 0 auto;
}

.card-title {
  font-size: 17px;
  font-weight: 700;
  color: #334155;
  margin: 0;
}

.card-content {
  padding: 22px;
}

/* 表单布局 */
.modern-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modern-form :deep(.el-form-item) {
  margin-bottom: 0;
}

/* 移动端优化 */
@media (max-width: 767px) {
  .stock-in-dialog__header {
    min-height: calc(82px + env(safe-area-inset-top));
    padding: calc(18px + env(safe-area-inset-top)) 64px 18px 18px;
  }

  .stock-in-dialog__title {
    font-size: 18px;
    line-height: 1.3;
  }

  .dialog-body {
    padding: 10px 8px 8px;
  }

  .dialog-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;

    .operator-info {
      font-size: 13px;
      text-align: center;
    }

    .footer-actions {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .footer-actions :deep(.el-button) {
      width: 100%;
      min-height: 42px;
      margin: 0;
    }
  }

  .info-card {
    margin-bottom: 12px;
    border-radius: 14px;
  }

  .card-header {
    padding: 14px 14px 12px;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .card-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    font-size: 15px;
  }

  .card-title {
    font-size: 15px;
  }

  .card-content {
    padding: 12px 10px 10px;
  }

  .modern-form {
    gap: 12px;
  }

  .modern-form :deep(.el-form-item__label) {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  .modern-form :deep(.el-input__wrapper),
  .modern-form :deep(.el-select__wrapper),
  .modern-form :deep(.el-date-editor .el-input__wrapper),
  .modern-form :deep(.el-input-number .el-input__wrapper),
  .modern-form :deep(.el-textarea__inner) {
    min-height: 40px;
    border-radius: 12px;
  }
}
</style>

<!-- 非 scoped 样式：StockInModal 特定样式 -->
<!--
  注意：el-dialog 的基础样式已在全局 styles.css 中统一修复
  这里只保留 StockInModal 组件特有的样式覆盖
-->
<style lang="scss">
.stock-in-dialog {
  --dialog-max-width: 1360px;
  --dialog-side-gap: 20px;
}

.stock-in-mobile-popper .el-select-dropdown__item,
.stock-in-mobile-popper .el-picker-panel__shortcut {
  min-height: 40px;
  height: auto !important;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
  padding-top: 10px;
  padding-bottom: 10px;
}

.stock-in-mobile-popper .el-select-dropdown__wrap {
  max-height: min(320px, 55vh);
}

/* StockInModal 使用自定义 header，需要隐藏默认的头部样式 */
.stock-in-dialog .el-dialog__header {
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  padding: 12px 56px 12px 16px !important;
  margin: 0 !important;
  border-bottom: none !important;
  box-sizing: border-box !important;
}

.stock-in-dialog .el-dialog__header .el-dialog__title {
  display: block !important;
  color: #ffffff !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  line-height: 1.35 !important;
}

.stock-in-dialog .el-dialog__body {
  padding: 0 0 24px !important;
  background: #ffffff !important;
}

.stock-in-dialog .el-dialog__footer {
  padding: 18px 24px 24px !important;
  background: #ffffff !important;
  border-top: 1px solid rgba(15, 23, 42, 0.06) !important;
}

/* 调整关闭按钮位置，使其在自定义 header 上可见 */
.stock-in-dialog .el-dialog__headerbtn {
  z-index: 1000 !important;
  top: 13px !important;
  right: 14px !important;
  transform: none !important;
}

/* ==================== 删除按钮样式优化 ==================== */

/* 表格中的删除按钮 - 简洁方形设计 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small {
  width: 24px !important;
  height: 24px !important;
  min-width: 24px !important;
  max-width: 24px !important;
  padding: 0 !important;
  background: #f5f5f5 !important;
  border: 1px solid #e0e0e0 !important;
  box-shadow: none !important;
  --el-button-bg-color: #f5f5f5 !important;
  --el-button-border-color: #e0e0e0 !important;
  --el-button-hover-bg-color: #ffebee !important;
  --el-button-hover-border-color: #ffcdd2 !important;
  transition: all 0.2s ease !important;
  border-radius: 4px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* 删除按钮悬停效果 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:hover {
  background: #ffebee !important;
  border-color: #ffcdd2 !important;
  transform: scale(1.05) !important;
}

/* 删除按钮点击效果 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:active {
  transform: scale(0.95) !important;
}

/* 减号图标样式 */
.stock-in-dialog .delete-row-btn .delete-icon {
  color: #757575 !important;
  font-size: 16px !important;
  font-weight: bold !important;
  line-height: 1 !important;
  display: block !important;
}

/* 悬停时图标颜色 */
.stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:hover .delete-icon {
  color: #f44336 !important;
}

/* 隐藏原有图标 */
.stock-in-dialog .delete-row-btn .el-icon {
  display: none !important;
}

/* 手机卡片头部中的删除按钮 */
.stock-in-dialog .phone-header .el-button--danger {
  padding: 4px 8px !important;
  height: 28px !important;
  font-size: 13px !important;
}

.stock-in-dialog .phone-header .el-button--danger i {
  font-size: 12px !important;
}

/* 移动端样式 */
@media (max-width: 767px) {
  .stock-in-dialog {
    --dialog-side-gap: 6px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 12px);
    --mobile-dialog-body-padding: 0;
    --mobile-dialog-footer-padding: 0;
  }

  .mobile-dialog-sheet-overlay.stock-in-dialog {
    padding: 12px 6px !important;
  }

  .mobile-dialog-sheet-panel.stock-in-dialog .mobile-dialog-sheet-body,
  .mobile-dialog-sheet-panel.stock-in-dialog .mobile-dialog-sheet-footer {
    padding: 0 !important;
  }

  .stock-in-dialog .el-dialog__footer {
    padding: 12px 10px 10px !important;
  }

  .stock-in-mobile-popper.el-popper,
  .stock-in-mobile-popper.el-select__popper,
  .stock-in-mobile-popper.el-picker__popper {
    width: min(380px, calc(100vw - 12px)) !important;
    max-width: calc(100vw - 12px) !important;
  }

  .stock-in-mobile-popper.el-select__popper .el-select-dropdown,
  .stock-in-mobile-popper.el-select__popper .el-scrollbar,
  .stock-in-mobile-popper.el-select__popper .el-select-dropdown__wrap,
  .stock-in-mobile-popper.el-select__popper .el-select-dropdown__list,
  .stock-in-mobile-popper.el-picker__popper .el-picker-panel,
  .stock-in-mobile-popper.el-picker__popper .el-date-picker,
  .stock-in-mobile-popper.el-picker__popper .el-date-picker__header,
  .stock-in-mobile-popper.el-picker__popper .el-picker-panel__content {
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box;
  }

  .stock-in-dialog .delete-row-btn.el-button--danger.el-button--small {
    width: 22px !important;
    height: 22px !important;
    min-width: 22px !important;
    max-width: 22px !important;
  }

  .stock-in-dialog .delete-row-btn .delete-icon {
    font-size: 14px !important;
  }

  .stock-in-dialog .delete-row-btn.el-button--danger.el-button--small:hover .delete-icon {
    color: #f44336 !important;
  }

  .stock-in-dialog .phone-header .el-button--danger {
    padding: 3px 6px !important;
    height: 24px !important;
    font-size: 12px !important;
  }

  .stock-in-dialog .phone-header .el-button--danger i {
    font-size: 11px !important;
  }
}

@media (max-width: 480px) {
  .stock-in-dialog {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
  }

  .mobile-dialog-sheet-overlay.stock-in-dialog {
    padding: 12px 4px !important;
  }

  .stock-in-mobile-popper.el-popper,
  .stock-in-mobile-popper.el-select__popper,
  .stock-in-mobile-popper.el-picker__popper {
    width: calc(100vw - 12px) !important;
    max-width: calc(100vw - 12px) !important;
  }
}

/* 提示文字样式 */
.field-hint {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
  line-height: 1.4;
}
</style>
