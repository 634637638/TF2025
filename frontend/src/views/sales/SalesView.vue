<template>
  <div class="sales-view admin-page safe-area-top">
    <PermissionGate
      :can-view="canView"
      module-name="销售管理"
      permission-code="sales:view"
    >
      <SalesPageHeader
        :batch-mode="batchMode"
        :selected-count="selectedPhones.length"
        :can-create="canCreate"
        :can-export="canExport"
        :export-loading="exportingAvailablePhones"
        :refreshing="refreshing"
        @toggle-batch-mode="toggleBatchMode"
        @export="exportAvailablePhones"
        @refresh="handleRefresh"
      />

      <div class="content admin-page-content">
        <!-- 统计卡片 -->
        <SalesStatsCards
          v-if="showStatsCards"
          :available-inventory="pagination.total || 0"
          :today-sold="todaySold"
          :new-inventory-value="newInventoryValue"
          :used-inventory-value="usedInventoryValue"
          :show-available-inventory="canViewSaleField('stats_available_inventory')"
          :show-today-sales="canViewSaleField('stats_today_sales')"
          :show-new-inventory-value="canViewPrice && canViewSaleField('stats_inventory_value')"
          :show-used-inventory-value="canViewPrice && canViewSaleField('stats_avg_profit_margin')"
        />

        <SalesSearchFilters
          v-model:expanded="searchExpanded"
          :loading="loading"
          :filters="filters"
          :show-keyword="showSalesSearchKeyword"
          :stores="stores"
          :suppliers="suppliers"
          :operators="operators"
          :brands="brands"
          :brand-models="brandModels"
          :colors="colors"
          :memories="memories"
          :can-view-field="canViewSaleField"
          @search="loadAvailablePhones"
          @reset="resetFilters"
          @debounced-search="debounceLoadAvailablePhones"
          @brand-change="handleBrandChange"
        />

        <!-- 数据表格区域 -->
        <div class="table-section admin-panel admin-table-panel">
          <div class="section-title">
            <i class="fas fa-list" />
            可销售设备列表
            <span class="record-count">共 {{ pagination.total || 0 }} 条记录</span>
          </div>

          <SalesViewControls
            :view-mode="viewMode"
            :operation-mode="operationMode"
            :selected-count="selectedPhones.length"
            :summary-count="sortedInventorySummary.length"
            :saving-inventory-summary="savingInventorySummary"
            :inventory-summary-loading="inventorySummaryLoading"
            :can-wholesale-permission="canWholesalePermission"
            :can-proxy-transfer-permission="canProxyTransferPermission"
            :can-wholesale="canWholesale"
            :can-proxy="canProxy"
            @wholesale="handleWholesale"
            @proxy="handleProxyTransfer"
            @save-summary="saveInventorySummaryAsImage"
            @set-view-mode="viewMode = $event"
            @open-wholesale="openWholesaleModal"
          />

          <SalesBatchForm
            v-if="batchMode && selectedPhones.length > 0"
            ref="batchCustomerNameInputRef"
            v-model:show-customer-search="showBatchCustomerSearch"
            :form="batchSaleForm"
            :selected-count="selectedPhones.length"
            :selected-customer="selectedBatchCustomer"
            :customer-search-results="batchCustomerSearchResults"
            :customer-searching="batchCustomerSearching"
            :customer-creating="batchCustomerCreating"
            :customer-name-editing="batchCustomerNameEditing"
            :stores="stores"
            :operators="operators"
            :submitting="submitting"
            :can-view-field="canViewSaleField"
            :can-view-price="canViewPrice"
            :is-current-user="isCurrentUser"
            :total-cost="getTotalCost()"
            :total-profit="getTotalProfit"
            @clear-selection="clearBatchSelection"
            @enable-name-edit="enableBatchCustomerNameEdit"
            @name-touch-end="handleBatchCustomerNameTouchEnd"
            @name-input="handleBatchCustomerNameInput"
            @disable-name-edit="disableBatchCustomerNameEdit"
            @save-name="saveBatchCustomerNameEdit"
            @clear-customer="clearSelectedBatchCustomer"
            @phone-input="handleBatchCustomerPhoneInput"
            @phone-blur="handleBatchCustomerBlur"
            @select-customer="selectBatchCustomer"
            @create-customer="createNewBatchCustomer"
            @apple-id-input="handleBatchCustomerAppleIdInput"
            @submit="debouncedSubmitBatchSale"
          />

          <SalesGridView
            v-if="viewMode === 'grid'"
            :phones="sortedForGridView"
            :loading="loading"
            :has-active-filters="hasActiveFilters"
            :can-view-field="canViewSaleField"
            :can-view-price="canViewPrice"
            :can-create="canCreate"
            :can-edit="canEdit"
            :can-delete="canDelete"
            :get-phone-image-src="getPhoneImageSrc"
            :format-number="formatNumber"
            :format-date="formatDate"
            @sale="openSaleModal"
            @edit="editPhone"
            @delete="deletePhone"
            @reset-filters="resetFilters"
          />
        </div>

        <SalesSummaryView
          v-if="viewMode === 'summary'"
          ref="inventorySummaryTableRef"
          :items="sortedInventorySummary"
          :loading="inventorySummaryLoading"
          :can-view-field="canViewSaleField"
          @show-detail="showInventoryDetail"
        />

        <SalesTableView
          v-if="viewMode === 'table'"
          :phones="sortedAvailablePhones"
          :selected-phones="selectedPhones"
          :loading="loading"
          :has-active-filters="hasActiveFilters"
          :batch-mode="batchMode"
          :operation-mode="operationMode"
          :select-all="selectAll"
          :compact="isMobile || isTablet"
          :can-view-field="canViewSaleField"
          :can-view-price="canViewPrice"
          :can-create="canCreate"
          :can-edit="canEdit"
          :can-delete="canDelete"
          @update:select-all="selectAll = $event"
          @toggle-select-all="toggleSelectAll"
          @toggle-phone="togglePhoneSelection"
          @sale="handleSaleAction"
          @edit="editPhone"
          @delete="deletePhone"
          @reset-filters="resetFilters"
        />

        <!-- 分页组件 -->
        <Pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="pagination.total"
          :page-sizes="[100, 200, 500, 1000]"
          :show-total="true"
          :show-range="true"
          :show-page-sizes="true"
          :show-quick-jumper="true"
          :disabled="loading"
          @change="handlePaginationChange"
        />
      </div>
    </PermissionGate>

    <!-- 销售模态框 -->
    <MobileDialog
      v-model="showSaleModal"
      :title="batchMode ? `批量销售出库 (${selectedPhones.length}台)` : '销售出库'"
      width="1000px"
      dialog-class="sales-sale-dialog"
      :show-default-footer="false"
      :close-on-click-modal="false"
    >
      <div
        class="modal-body"
        @click="showCustomerSearch = false"
      >
        <div
          class="sale-layout"
          @click.stop
        >
          <SalesDeviceInfoPanel
            :batch-mode="batchMode"
            :selected-phones="selectedPhones"
            :selected-phone="selectedPhone"
            :is-mobile="isMobile"
            :can-view-field="canViewSaleField"
            :can-view-price="canViewPrice"
            :total-cost="getTotalCost()"
            :total-profit="getTotalProfit"
          />

          <SalesCheckoutForm
            ref="saleCustomerNameInputRef"
            v-model:show-customer-search="showCustomerSearch"
            :form="saleForm"
            :selected-customer="selectedCustomer"
            :customer-search-results="customerSearchResults"
            :customer-searching="customerSearching"
            :customer-creating="customerCreating"
            :customer-name-editing="customerNameEditing"
            :stores="stores"
            :operators="operators"
            :selected-phone="selectedPhone"
            :batch-mode="batchMode"
            :profit="profit"
            :profit-margin="profitMargin"
            :profit-class="profitClass"
            :can-view-field="canViewSaleField"
            :can-view-price="canViewPrice"
            :is-current-user="isCurrentUser"
            @customer-search="handleCustomerSearch"
            @select-customer="selectCustomer"
            @create-customer="createNewCustomer"
            @enable-name-edit="enableCustomerNameEdit"
            @name-touch-end="handleCustomerNameTouchEnd"
            @name-input="handleCustomerNameInput"
            @name-blur="handleCustomerNameBlur"
            @save-name="saveCustomerNameEdit"
            @clear-customer="clearSelectedCustomer"
            @apple-id-input="handleCustomerAppleIdInput"
            @calculate-profit="calculateProfit"
            @payment-method-change="handlePaymentMethodChange"
            @payment-channel-change="handlePaymentChannelChange"
            @submit="debouncedSubmitSale"
          />
        </div>
      </div>
      <template #footer>
        <div class="sale-dialog-footer">
          <el-button
            type="info"
            plain
            @click="closeSaleModal"
          >
            取消
          </el-button>
          <el-button
            type="success"
            :disabled="submitting"
            :class="{ 'btn-loading': submitting }"
            @click="handleSale"
            @keydown.enter.prevent
          >
            <InlineLoading
              v-if="submitting"
              size="small"
            />
            {{ submitting ? '处理中...' : '确认出库' }}
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <SalesInventoryDetailDialog
      v-model="inventoryDetailModal"
      :items="inventoryDetailData"
      :loading="inventoryDetailLoading"
      :can-view-field="canViewSaleField"
      :can-view-price="canViewPrice"
      @close="closeInventoryDetailModal"
    />

    <SalesEditPhoneDialog
      v-model="showEditModal"
      :form="editForm"
      :suppliers="suppliers"
      :stores="stores"
      :brands="brands"
      :edit-brand-models="editBrandModels"
      :colors="colors"
      :memories="memories"
      :is-no-imei-mode="editIsNoIMEIMode"
      :can-view-field="canViewSaleField"
      :can-edit-field="canEditSaleField"
      :can-view-price="canViewPrice"
      :submitting="submitting"
      @brand-change="onEditBrandChange"
      @serial-number-input="handleSerialNumberInput"
      @imei-input="handleImeiInput"
      @toggle-no-imei="toggleEditNoIMEIMode"
      @cancel="closeEditModal"
      @submit="submitEdit"
    />

    <!-- 批发/划拨对话框 -->
    <WholesaleModal
      v-if="showWholesaleModal"
      v-model:visible="showWholesaleModal"
      :mode="wholesaleMode"
      :phone-ids="selectedPhones.map(p => p.id)"
      :phones="selectedPhones"
      :close-on-click-modal="false"
      @success="handleTransferSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePermissionPreload } from '@/composables/usePermissionPreload'
import { useMobile, useMobileForm } from '@/composables/mobile'
import { usePagination } from '@/composables/index'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import InlineLoading from '@/components/InlineLoading.vue'
import Pagination from '../../components/Pagination.vue'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { useLoadingState } from '@/composables'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import SalesStatsCards from './page/SalesStatsCards.vue'
import SalesPageHeader from './page/SalesPageHeader.vue'
import SalesSearchFilters from './page/SalesSearchFilters.vue'
import SalesViewControls from './page/SalesViewControls.vue'
import SalesGridView from './page/SalesGridView.vue'
import SalesTableView from './page/SalesTableView.vue'
import SalesSummaryView from './page/SalesSummaryView.vue'
import SalesInventoryDetailDialog from './page/SalesInventoryDetailDialog.vue'
import SalesEditPhoneDialog from './page/SalesEditPhoneDialog.vue'
import SalesDeviceInfoPanel from './page/SalesDeviceInfoPanel.vue'
import SalesCheckoutForm from './page/SalesCheckoutForm.vue'
import SalesBatchForm from './page/SalesBatchForm.vue'
import { ElMessageBox } from 'element-plus'
import { PermissionGate } from '@/components/base'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import { storage } from '@/services/storage'
import { loadHtml2Canvas } from '@/utils/html2canvas'
import { toCanonicalPhoneUpdatePayload } from '@/utils/phone-update-payload'
import { resolvePhoneReferenceIds } from '@/utils/phone-reference-ids'
import { sortAvailableSalesPhones } from './sales-sort'
import { isCurrentMobileViewport } from '@/utils/device-detection'
import { useSalesBaseOptions } from './useSalesBaseOptions'
import { useSalesCheckout } from './useSalesCheckout'
import { useSalesCustomers } from './useSalesCustomers'
import { useSalesInventorySummary } from './useSalesInventorySummary'
import { getSalesFieldKey } from './sales-field-permissions'
import {
  detectEditNoImeiMode as detectEditNoIMEIMode,
  findPhoneByRouteId,
  formatSalesDate as formatDate,
  getPhoneImageSrc,
  normalizeSalesPhone
} from './sales-phone-helpers'

// 导入格式化工具函数
import { formatNumber } from '@/utils/format'

const WholesaleModal = defineAsyncComponent(() => import('@/components/WholesaleModal.vue'))

// 导入类型定义
import type { Phone } from '@/types'
import type {
  BatchSaleFormData,
  SalesCheckoutFormData,
  SalesEditForm
} from './types'

// 使用 stores 和 composables
const router = useRouter()
const route = useRoute()
const { error: showError, warning: showWarning, success: showSuccess, info: showInfo } = useNotification()
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  handleNoPermission
} = usePagePermissions('sales')
const { refreshing, refresh } = useRefreshData()
const { exportFile, saveBlobFile, buildDateFilename } = useImportExport()
const authStore = useAuthStore()
const { init: initFieldPermissions } = fieldPermissions
const canViewSaleField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('sales_salesview', getSalesFieldKey(fieldName))
}
const canEditSaleField = (fieldName: string) => {
  if (!canViewSaleField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('sales_salesview', getSalesFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewSaleField('stats_available_inventory') ||
  canViewSaleField('stats_today_sales') ||
  (canViewPrice.value && canViewSaleField('stats_inventory_value')) ||
  (canViewPrice.value && canViewSaleField('stats_avg_profit_margin'))
))

const handleSalesPermissionsUpdated = async () => {

  try {
    await preloadPermissions()
    await authStore.fetchUserInfo()
  } catch (refreshError) {
    logger.error('销售页面权限刷新失败:', refreshError)
  }

  if (!canView.value) {
    availablePhones.value = []
    return
  }

  await initFieldPermissions(true)
  loadAvailablePhones(false, true, false)
}

const isSalesMobileLayout = () => {
  return isCurrentMobileViewport()
}

const syncSalesViewMode = () => {
  viewMode.value = isSalesMobileLayout() ? 'grid' : 'table'
}

const getTodayDate = () => TimeUtil.nowFormatted(TIME_FORMATS.DATE)

// 检查用户是否可以查看成本相关价格字段
const canViewPrice = computed(() => {
  const priceFields = ['purchase_cost']
  if (priceFields.some(fieldName => !canViewSaleField(fieldName))) {
    return false
  }

  const hasEditPermission = authStore.hasPermission('sales:edit')
  const hasViewPermission = authStore.hasPermission('sales:view')
  const hasQueryPermission = authStore.hasPermission('query:view')
  const hasPermissionAdminAccess = authStore.isAdmin

  return hasEditPermission || hasViewPermission || hasQueryPermission || hasPermissionAdminAccess
})

// 使用权限预加载Hook
const { preloadPermissions } = usePermissionPreload()

// 控制搜索筛选区域的显示
const showSearchSection = ref(true)

const { isMobile, isTablet, isIOS } = useMobile()
useMobileForm()

// 响应式数据
const { loading } = useLoadingState()
const submitting = ref(false)

// 搜索相关状态
const searchExpanded = ref(false) // 搜索区域展开状态（移动端默认折叠）

// 防抖函数，避免快速重复点击
const debounceSubmit = (fn, delay = 500) => {
  let timeoutId = null
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// 全局键盘事件处理，防止提交过程中的Enter键重复提交
const handleGlobalKeydown = (event) => {
  // 如果正在提交，阻止Enter键触发表单提交
  if (submitting.value && event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    return false
  }
}
// 根据设备类型设置默认显示模式：桌面端显示列表，移动端显示图文
const viewMode = ref<'grid' | 'table' | 'summary'>('table') // 默认列表模式

const showSaleModal = ref(false)
const selectedPhone = ref<Phone | null>(null)

// 编辑弹窗相关
const showEditModal = ref(false)
const selectedPhoneForEdit = ref<Phone | null>(null)

// 批发/划拨对话框相关
const showWholesaleModal = ref(false)
const wholesaleMode = ref<'wholesale' | 'proxy'>('wholesale')
const operationMode = ref<'wholesale' | 'proxy' | null>(null) // 操作模式

const saleCustomerNameInputRef = ref<{ input?: HTMLInputElement | null } | null>(null)
const batchCustomerNameInputRef = ref<{ input?: HTMLInputElement | null } | null>(null)

// 批发/划拨权限检查
const canWholesale = computed(() => {
  return selectedPhones.value.length > 0 &&
    selectedPhones.value.every((p: Phone) => p.status === 'in_stock')
})

const canProxy = computed(() => {
  return selectedPhones.value.length > 0 &&
    selectedPhones.value.every((p: Phone) => p.status === 'in_stock')
})

const canWholesalePermission = computed(() => authStore.hasPermission('sales:wholesale'))
const canProxyTransferPermission = computed(() => authStore.hasPermission('sales:proxy-transfer'))

// 处理调货
const handleWholesale = () => {
  if (!canWholesalePermission.value) {
    handleNoPermission('wholesale')
    return
  }

  // 如果已经在批发模式，则取消
  if (operationMode.value === 'wholesale') {
    operationMode.value = null
  } else {
    // 切换到批发模式，并自动切换到表格视图
    operationMode.value = 'wholesale'
    viewMode.value = 'table' // 自动切换到表格视图
  }
}

// 处理划拨
const handleProxyTransfer = () => {
  if (!canProxyTransferPermission.value) {
    handleNoPermission('proxy-transfer')
    return
  }

  // 如果已经在划拨模式，则取消
  if (operationMode.value === 'proxy') {
    operationMode.value = null
  } else {
    // 切换到划拨模式，并自动切换到表格视图
    operationMode.value = 'proxy'
    viewMode.value = 'table' // 自动切换到表格视图
  }
}

// 打开批发/划拨对话框
const openWholesaleModal = () => {
  wholesaleMode.value = operationMode.value || 'wholesale'

  if (wholesaleMode.value === 'wholesale' && !canWholesalePermission.value) {
    handleNoPermission('wholesale')
    return
  }

  if (wholesaleMode.value === 'proxy' && !canProxyTransferPermission.value) {
    handleNoPermission('proxy-transfer')
    return
  }

  if (wholesaleMode.value === 'wholesale' && !canWholesale.value) {
    showWarning('请先选择可调货的在库手机')
    return
  }

  if (wholesaleMode.value === 'proxy' && !canProxy.value) {
    showWarning('请先选择可划拨的在库手机')
    return
  }

  // 划拨模式：验证供应商一致性
  if (wholesaleMode.value === 'proxy') {
    const suppliers = [...new Set(selectedPhones.value.map(p => p.supplier_id).filter(id => id !== null && id !== undefined))]

    if (suppliers.length > 1) {
      showError('相同供应商商品才能划拨')
      return
    }

    if (suppliers.length === 0) {
      showError('选中的商品没有供应商信息')
      return
    }
  }

  showWholesaleModal.value = true
}

// 批发/划拨成功回调
const handleTransferSuccess = (data?: { success_count: number; total_count: number; message: string }) => {
  operationMode.value = null
  clearBatchSelection()
  loadAvailablePhones()

  // 如果没有传递数据，显示默认消息
  if (!data) {
    showSuccess('操作成功')
  } else {
    // 显示详细的成功信息
    const { success_count, total_count, message } = data
    if (success_count === total_count) {
      showSuccess(`${message}，共 ${success_count} 台`)
    } else {
      showWarning(`${message} ${success_count}/${total_count} 台`)
    }
  }
}

const editForm = reactive<SalesEditForm>({
  brand_id: null as number | null,
  model_id: null as number | null,
  color_id: null as number | null,
  memory_id: null as number | null,
  brand: '',
  model: '',
  color: '',
  memory: '',
  serial_number: '',
  imei: '',
  purchase_cost: null,
  sale_price: null,
  supplier_id: null,
  store_id: null,
  operator_id: '',
  operator_name: '',
  condition: '',
  status: '',
  inventory_time: null,
  remarks: ''
})

// 编辑模式的无IMEI状态
const editIsNoIMEIMode = ref(false)

// 批量选择相关
const batchMode = ref(false)
const selectedPhones = ref<Phone[]>([])
const handledRouteSalePhoneId = ref<string>('')
const selectAll = ref(false)

// 批量销售表单数据
const batchSaleForm = reactive<BatchSaleFormData>({
  customer_name: '',
  customer_phone: '',
  apple_id: '',
  sale_price: '',
  store_id: '',
  operator_id: '',
  sale_time: getTodayDate(),
  payment_method: '',
  payment_channel: '',
  transaction_no: '',
  remarks: ''
})

// 数据列表
const availablePhones = ref<Phone[]>([])
const {
  stores,
  operators,
  suppliers,
  brands,
  colors,
  memories,
  brandModels,
  editBrandModels,
  loadStores,
  loadOperators,
  loadBrands,
  loadModels,
  loadColors,
  loadMemories,
  loadSuppliers,
  fetchBrandModels,
  fetchEditBrandModels
} = useSalesBaseOptions()

// 库存统计表截图引用和状态
const inventorySummaryTableRef = ref<{ getCaptureElement: () => HTMLElement | null } | null>(null)
const savingInventorySummary = ref(false)

// 排序逻辑集中在纯函数中，网格和表格共享同一套顺序。
const sortedForGridView = computed(() => sortAvailableSalesPhones(availablePhones.value))
const sortedAvailablePhones = computed(() => sortAvailableSalesPhones(availablePhones.value))

// 统计数据
const todaySold = ref(0)
const newInventoryValue = ref('0') // 全新库存金额
const usedInventoryValue = ref('0') // 二手库存金额
const exportingAvailablePhones = ref(false)
// 防止销售/刷新期间旧请求晚返回后覆盖最新列表。
let availablePhonesRequestVersion = 0

// 筛选条件
const filters = reactive({
  brand: '',
  model: '',
  color: '',
  memory: '',
  store_id: '',
  supplier_id: '',
  operator_id: '',
  is_new: '',
  date_range: '',
  start_date: '',
  end_date: '',
  search: ''
})

const showSalesSearchKeyword = computed(() => {
  return ['brand', 'model', 'color', 'memory', 'serial_number', 'imei', 'customer_name', 'customer_phone'].some(fieldName => canViewSaleField(fieldName))
})

const {
  inventorySummaryLoading,
  sortedInventorySummary,
  inventoryDetailModal,
  inventoryDetailData,
  inventoryDetailLoading,
  loadInventorySummary,
  debounceLoadInventorySummary,
  showInventoryDetail,
  closeInventoryDetailModal,
  disposeInventorySummary
} = useSalesInventorySummary({
  filters,
  canViewField: canViewSaleField,
  showSearchKeyword: () => showSalesSearchKeyword.value,
  isSummaryView: () => viewMode.value === 'summary',
  showError
})

// 分页信息
const {
  page,
  page_size,
  total,
  setTotal,
  setPageSize,
  goToPage
} = usePagination({ page_size: 100 })

// 创建 reactive 分页对象供模板使用（自动解包 ref）
const pagination = reactive({ page, page_size, total, setTotal, setPageSize, goToPage })

// 销售表单
const saleForm = reactive<SalesCheckoutFormData>({
  customer_name: '',
  customer_phone: '',
  customer_apple_id: '',
  sale_price: '',
  purchase_cost: '', // 可编辑的入库价格
  store_id: '',
  operator_id: '',
  sale_time: getTodayDate(),
  payment_method: '',
  payment_channel: '',
  transaction_no: '',
  remarks: ''
})

const {
  customerNameEditing,
  batchCustomerNameEditing,
  customerCreating,
  batchCustomerCreating,
  customerSearchResults,
  selectedCustomer,
  showCustomerSearch,
  customerSearching,
  batchCustomerSearchResults,
  selectedBatchCustomer,
  showBatchCustomerSearch,
  batchCustomerSearching,
  normalizeCustomerPhone,
  handleCustomerNameInput,
  handleCustomerAppleIdInput,
  handleBatchCustomerNameInput,
  handleBatchCustomerAppleIdInput,
  handleCustomerSearch,
  enableCustomerNameEdit,
  handleCustomerNameTouchEnd,
  handleCustomerNameBlur,
  saveCustomerNameEdit,
  selectCustomer,
  clearSelectedCustomer,
  createNewCustomer,
  resetCustomerForm,
  handleBatchCustomerPhoneInput,
  handleBatchCustomerBlur,
  enableBatchCustomerNameEdit,
  handleBatchCustomerNameTouchEnd,
  disableBatchCustomerNameEdit,
  saveBatchCustomerNameEdit,
  selectBatchCustomer,
  clearSelectedBatchCustomer,
  createNewBatchCustomer,
  disposeSalesCustomers
} = useSalesCustomers({
  saleForm,
  batchSaleForm,
  saleCustomerNameInputRef,
  batchCustomerNameInputRef,
  isIOS: () => isIOS.value,
  showError,
  showWarning,
  showSuccess
})

const {
  profit,
  profitMargin,
  profitClass,
  getTotalCost,
  getTotalProfit,
  isCurrentUser,
  openSaleModal,
  openSaleModalWithPreorder,
  closeSaleModal,
  toggleBatchMode,
  handleSaleAction,
  togglePhoneSelection,
  toggleSelectAll,
  clearBatchSelection,
  setDefaultOperator,
  submitBatchSale,
  handleSale
} = useSalesCheckout({
  saleForm,
  batchSaleForm,
  selectedPhone,
  selectedPhones,
  availablePhones,
  selectedCustomer,
  operators,
  batchMode,
  selectAll,
  showSaleModal,
  showSearchSection,
  submitting,
  todaySold,
  getTodayDate,
  getCurrentUser: () => authStore.user,
  canCreate: () => canCreate.value,
  handleNoPermission,
  normalizeCustomerPhone,
  resetCustomerForm,
  loadAvailablePhones: () => loadAvailablePhones(true, false, true),
  showError,
  showSuccess
})

// 判断是否有活跃的筛选条件
const hasActiveFilters = computed(() => {
  return !!(
    (showSalesSearchKeyword.value && filters.search) ||
    (canViewSaleField('brand') && filters.brand) ||
    (canViewSaleField('model') && filters.model) ||
    (canViewSaleField('color') && filters.color) ||
    (canViewSaleField('memory') && filters.memory) ||
    (canViewSaleField('supplier_name') && filters.supplier_id) ||
    (canViewSaleField('store_name') && filters.store_id) ||
    (canViewSaleField('inventory_operator_name') && filters.operator_id) ||
    (canViewSaleField('condition') && filters.is_new !== '') ||
    (canViewSaleField('inventory_time') && filters.date_range)
  )
})

let salesBaseDataWarmupTimer: ReturnType<typeof setTimeout> | null = null

// localStorage 相关
const STORAGE_KEY = 'sales_search_filters'

// 从 localStorage 加载筛选条件
const loadFiltersFromStorage = () => {
  try {
    const userId = authStore.user?.id || 'anonymous'
    const key = `${STORAGE_KEY}_${userId}`
    const data = storage.get<any>(key, 'local')

    if (data) {
      // 只加载7天内的数据
      const savedAt = new Date(data.saved_at)
      const now = TimeUtil.now().toDate()
      const daysDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff <= 7) {
        filters.brand = canViewSaleField('brand') ? (data.brand || '') : ''
        filters.model = canViewSaleField('model') ? (data.model || '') : ''
        filters.color = canViewSaleField('color') ? (data.color || '') : ''
        filters.memory = canViewSaleField('memory') ? (data.memory || '') : ''
        filters.is_new = canViewSaleField('condition') ? (data.is_new !== undefined ? data.is_new : '') : ''
        filters.supplier_id = canViewSaleField('supplier_name') ? (data.supplier_id || '') : ''
        filters.store_id = canViewSaleField('store_name') ? (data.store_id || '') : ''
        filters.operator_id = canViewSaleField('inventory_operator_name') ? (data.operator_id || '') : ''
      }
    }
  } catch (error) {
    logger.error('加载筛选条件失败:', error)
  }
}


// 防抖加载可销售手机列表（用于搜索输入框）
let loadPhonesDebounceTimer: any = null
const debounceLoadAvailablePhones = () => {
  if (loadPhonesDebounceTimer) {
    clearTimeout(loadPhonesDebounceTimer)
  }
  loadPhonesDebounceTimer = setTimeout(() => {
    loadAvailablePhones(false, true, false)
  }, 500) // 500ms 防抖延迟
}

// 加载统计数据（今日出库、平均利润率等）
const loadSalesStats = async () => {
  try {
    // 构建查询参数（与筛选条件一致）
    const params: any = {}
    if (canViewSaleField('supplier_name') && filters.supplier_id) params.supplier_id = filters.supplier_id
    if (canViewSaleField('store_name') && filters.store_id) params.store_id = filters.store_id
    if (canViewSaleField('brand') && filters.brand) params.brand = filters.brand
    if (canViewSaleField('model') && filters.model) params.model = filters.model
    if (canViewSaleField('color') && filters.color) params.color = filters.color
    if (canViewSaleField('memory') && filters.memory) params.memory = filters.memory

    const response = await api.get('/sales/phones/available/stats', { params })
    if (response.success && response.data) {
      todaySold.value = response.data.today_sold || 0
    }
  } catch (error) {
    logger.error('加载统计数据失败:', error)
    // 失败时保持默认值
    todaySold.value = 0
  }
}

const buildAvailablePhoneParams = (includePagination = true) => {
  const params: Record<string, any> = {}

  if (includePagination) {
    params.page = pagination.page || 1
    params.page_size = pagination.page_size || 100
  }

  const routePhoneId = String(route.query.sale_phone_id || '').trim()
  if (routePhoneId) {
    params.phone_id = routePhoneId
    return params
  }

  if (canViewSaleField('supplier_name') && filters.supplier_id) params.supplier_id = filters.supplier_id
  if (canViewSaleField('brand') && filters.brand) params.brand = filters.brand
  if (canViewSaleField('model') && filters.model) params.model = filters.model
  if (canViewSaleField('color') && filters.color) params.color = filters.color
  if (canViewSaleField('memory') && filters.memory) params.memory = filters.memory
  if (canViewSaleField('store_name') && filters.store_id) params.store_id = filters.store_id
  if (canViewSaleField('inventory_operator_name') && filters.operator_id) params.operator_id = filters.operator_id
  if (canViewSaleField('condition') && filters.is_new !== '') params.is_new = filters.is_new
  if (canViewSaleField('inventory_time') && filters.start_date) params.start_date = filters.start_date
  if (canViewSaleField('inventory_time') && filters.end_date) params.end_date = filters.end_date
  if (showSalesSearchKeyword.value && filters.search) params.search = filters.search

  return params
}

const AUTO_OPEN_SALE_PHONE_STORAGE_KEY = 'tf2025:auto-open-sale-phone'
const AUTO_OPEN_SALE_TASK_TTL = 60 * 1000

const readStoredAutoOpenSalePhoneId = () => {
  try {
    const rawTask = window.sessionStorage.getItem(AUTO_OPEN_SALE_PHONE_STORAGE_KEY)
    if (!rawTask) return ''

    const task = JSON.parse(rawTask) as { phoneId?: unknown; createdAt?: unknown }
    const phoneId = String(task.phoneId || '').trim()
    const createdAt = Number(task.createdAt || 0)

    if (!phoneId || !createdAt || Date.now() - createdAt > AUTO_OPEN_SALE_TASK_TTL) {
      window.sessionStorage.removeItem(AUTO_OPEN_SALE_PHONE_STORAGE_KEY)
      return ''
    }

    logger.info('读取库存出库自动打开任务:', { phoneId })
    return phoneId
  } catch (error) {
    logger.warn('读取库存出库自动打开任务失败，已清理:', error)
    window.sessionStorage.removeItem(AUTO_OPEN_SALE_PHONE_STORAGE_KEY)
    return ''
  }
}

const clearStoredAutoOpenSalePhoneId = () => {
  window.sessionStorage.removeItem(AUTO_OPEN_SALE_PHONE_STORAGE_KEY)
}

const getRouteAutoOpenSalePhoneId = () => {
  const autoOpenSale = String(route.query.auto_open_sale || '') === '1'
  const routePhoneId = String(route.query.sale_phone_id || '').trim()
  return autoOpenSale && routePhoneId ? routePhoneId : readStoredAutoOpenSalePhoneId()
}

const clearRouteAutoOpenSaleQuery = () => {
  clearStoredAutoOpenSalePhoneId()

  const nextQuery = { ...route.query }
  delete nextQuery.sale_phone_id
  delete nextQuery.auto_open_sale

  const queryParams = new URLSearchParams()
  Object.entries(nextQuery).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item !== null && item !== undefined) queryParams.append(key, String(item))
      })
    } else if (value !== null && value !== undefined) {
      queryParams.set(key, String(value))
    }
  })

  const queryString = queryParams.toString()
  const cleanUrl = `${route.path}${queryString ? `?${queryString}` : ''}${route.hash || ''}`
  window.history.replaceState(window.history.state, '', cleanUrl)
}

const handleRouteAutoOpenSale = async (records: Phone[] = []) => {
  const routePhoneId = getRouteAutoOpenSalePhoneId()
  if (!routePhoneId || handledRouteSalePhoneId.value === routePhoneId) {
    logger.debug('跳过自动打开销售弹窗:', {
      routePhoneId,
      handledRouteSalePhoneId: handledRouteSalePhoneId.value
    })
    return false
  }

  logger.info('开始自动打开销售出库弹窗:', {
    phoneId: routePhoneId,
    currentRecords: records.length
  })

  let matchedPhone = findPhoneByRouteId(records, routePhoneId)

  if (!matchedPhone) {
    try {
      logger.info('当前列表未找到目标商品，按ID重新请求:', { phoneId: routePhoneId })
      const response = await api.get('/sales/phones/available', {
        params: {
          page: 1,
          page_size: 1,
          phone_id: routePhoneId
        },
        useCache: false
      })

      if (response.success) {
        const responseData = extractResponseData<any>(response)
        const routeRecords = (Array.isArray(responseData) ? responseData : (responseData.records || [])).map(normalizeSalesPhone)
        matchedPhone = findPhoneByRouteId(routeRecords, routePhoneId)
        logger.info('自动出库商品ID请求完成:', {
          phoneId: routePhoneId,
          returnedCount: routeRecords.length,
          matched: Boolean(matchedPhone)
        })

        if (matchedPhone) {
          availablePhones.value = routeRecords
          setTotal(Number(response.pagination?.total) || routeRecords.length || 0)
        }
      }
    } catch (error) {
      logger.error('自动打开出库商品失败:', error)
    }
  }

  if (matchedPhone) {
    await nextTick()
    const opened = openSaleModal(matchedPhone)
    if (opened) {
      logger.info('自动打开销售出库弹窗成功:', { phoneId: routePhoneId })
      handledRouteSalePhoneId.value = routePhoneId
      await clearRouteAutoOpenSaleQuery()
      return true
    }

    logger.warn('自动打开销售出库弹窗被权限或状态拦截:', { phoneId: routePhoneId })
    return false
  }

  handledRouteSalePhoneId.value = routePhoneId
  showWarning('未找到可出库商品，可能已售出或不在库')
  await clearRouteAutoOpenSaleQuery()
  return false
}

const exportAvailablePhones = async () => {
  await exportFile({
    url: '/sales/phones/available/export',
    filename: buildDateFilename('销售管理', 'xlsx'),
    params: buildAvailablePhoneParams(false),
    allowed: canExport,
    loading: exportingAvailablePhones,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '销售数据导出成功'
  })
}

// 保存库存统计表为图片
const saveInventorySummaryAsImage = async () => {
  if (!inventorySummaryTableRef.value) {
    showError('库存统计表未加载')
    return
  }

  if (sortedInventorySummary.value.length === 0) {
    showError('暂无库存数据可保存')
    return
  }

  let restoreCaptureStyles: (() => void) | null = null

  try {
    savingInventorySummary.value = true

    // 等待DOM更新完成
    await nextTick()

    const element = inventorySummaryTableRef.value?.getCaptureElement()
    if (!element) {
      showError('无法找到库存统计表元素')
      return
    }

    const tables = Array.from(element.querySelectorAll<HTMLTableElement>('table'))
    const elementTable = element.querySelector<HTMLElement>('.el-table')
    if (tables.length === 0 || !elementTable) {
      showError('无法找到库存统计表内容')
      return
    }

    // Element Plus 使用独立的表头和内容表格，截图时需要同步调整并恢复。
    const originalWidth = element.style.width
    const originalElementTableWidth = elementTable.style.width
    const originalTables = tables.map(table => ({
      element: table,
      width: table.style.width,
      tableLayout: table.style.tableLayout,
      borderSpacing: table.style.borderSpacing
    }))

    // 保存所有单元格的原始样式
    const cells = element.querySelectorAll('td, th')
    const originalCells: Array<{
      element: HTMLElement
      padding: string
      fontSize: string
      height: string
      lineHeight: string
    }> = []

    cells.forEach(cell => {
      const htmlCell = cell as HTMLElement
      originalCells.push({
        element: htmlCell,
        padding: htmlCell.style.padding,
        fontSize: htmlCell.style.fontSize,
        height: htmlCell.style.height,
        lineHeight: htmlCell.style.lineHeight
      })
    })

    // 保存行样式
    const rows = element.querySelectorAll('tr')
    const originalRows: Array<{
      element: HTMLElement
      height: string
      display: string
    }> = []

    rows.forEach(row => {
      const htmlRow = row as HTMLElement
      originalRows.push({
        element: htmlRow,
        height: htmlRow.style.height,
        display: htmlRow.style.display
      })
    })

    restoreCaptureStyles = () => {
      element.style.width = originalWidth
      elementTable.style.width = originalElementTableWidth

      originalTables.forEach(item => {
        item.element.style.width = item.width
        item.element.style.tableLayout = item.tableLayout
        item.element.style.borderSpacing = item.borderSpacing
      })

      originalCells.forEach(item => {
        item.element.style.padding = item.padding
        item.element.style.fontSize = item.fontSize
        item.element.style.height = item.height
        item.element.style.lineHeight = item.lineHeight
      })

      originalRows.forEach(item => {
        item.element.style.height = item.height
        item.element.style.display = item.display
      })
    }

    // 临时设置截图容器宽度，表头和内容表格保持相同布局。
    element.style.width = '2000px'
    elementTable.style.width = '100%'
    tables.forEach(table => {
      table.style.width = '100%'
      table.style.tableLayout = 'fixed'
      table.style.borderSpacing = '0'
    })

    // 设置紧凑的单元格样式
    cells.forEach(cell => {
      const htmlCell = cell as HTMLElement
      htmlCell.style.padding = '8px 12px'
      htmlCell.style.fontSize = '18px'
      htmlCell.style.height = '40px'
      htmlCell.style.lineHeight = '1.4'
    })

    // 设置行样式
    rows.forEach(row => {
      const htmlRow = row as HTMLElement
      htmlRow.style.height = '40px'
      htmlRow.style.display = 'table-row'
    })

    // 等待布局更新
    await nextTick()

    const html2canvas = await loadHtml2Canvas()

    // 生成高清图片（使用scale: 2提高清晰度）
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true
    })

    // 缩放到目标尺寸（2000px宽度）
    const targetWidth = 2000
    const scaleRatio = targetWidth / canvas.width
    const newHeight = Math.round(canvas.height * scaleRatio)

    const resizedCanvas = document.createElement('canvas')
    resizedCanvas.width = targetWidth
    resizedCanvas.height = newHeight
    const ctx = resizedCanvas.getContext('2d')

    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetWidth, newHeight)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(canvas, 0, 0, targetWidth, newHeight)
    }

    restoreCaptureStyles()
    restoreCaptureStyles = null

    // 转换为图片并下载
    const finalCanvas = resizedCanvas || canvas
    finalCanvas.toBlob((blob) => {
      if (!blob) {
        showError('生成图片失败')
        return
      }

      // 生成文件名（包含时间戳）
      const filename = buildDateFilename('库存对库', 'png', 'YYYYMMDD')
      saveBlobFile(blob, { filename, mimeType: 'image/png' })

      showSuccess(`库存统计表已保存为图片 (${finalCanvas.width}x${finalCanvas.height})`)
    }, 'image/png')

  } catch (err) {
    logger.error('保存库存统计表失败:', err)
    showError('保存库存统计表失败')
  } finally {
    restoreCaptureStyles?.()
    savingInventorySummary.value = false
  }
}

// 加载可销售手机列表
const loadAvailablePhones = async (_bustCache = false, silentError = false, showLoadingState = true) => {

  // 权限检查：验证用户是否有查看销售页面的权限
  if (!canView.value) {
    if (!silentError) {
      showError('您没有访问此页面的权限')
    }
    return
  }

  const requestVersion = ++availablePhonesRequestVersion
  const requestedPage = pagination.page

  if (showLoadingState) {
    loading.value = true
  }
  try {
    const params: any = buildAvailablePhoneParams(true)

    const response = await api.get('/sales/phones/available', {
      params,
      // 销售、删除和手动刷新后必须读取数据库最新库存。
      useCache: !_bustCache && !getRouteAutoOpenSalePhoneId()
    })

    // 旧请求不能覆盖更新后的列表和加载状态。
    if (requestVersion !== availablePhonesRequestVersion) return

    if (response.success) {
      const responseData = extractResponseData<any>(response)
      const records = (Array.isArray(responseData) ? responseData : (responseData.records || [])).map(normalizeSalesPhone)
      const responseTotal = Number(response.pagination?.total) || records.length || 0

      availablePhones.value = records
      setTotal(responseTotal)

      // 当前页在销售后可能已经超过最后一页，回到有效页并重新读取。
      if (records.length === 0 && responseTotal > 0 && requestedPage !== pagination.page) {
        await loadAvailablePhones(true, silentError, showLoadingState)
        return
      }

      // 从后端获取全新和二手库存金额统计
      const stats = (response as any)?.stats || {}
      const newValue = parseFloat(String(stats.new_value || 0))
      const usedValue = parseFloat(String(stats.used_value || 0))

      newInventoryValue.value = String(Math.round(newValue))
      usedInventoryValue.value = String(Math.round(usedValue))

      // 统计数据不阻塞主列表渲染
      void loadSalesStats()

      // 处理从预定页面跳转过来的交付请求（通过IMEI查找设备）
      const routeImei = String(route.query.imei || '').trim()
      const routePreorderId = String(route.query.preorder_id || '').trim()
      if (routeImei && routePreorderId && handledRouteSalePhoneId.value !== routeImei) {
        const matchedPhone = records.find((phone: Phone) => String(phone.imei) === routeImei)
        if (matchedPhone) {
          handledRouteSalePhoneId.value = routeImei
          await nextTick()
          // 打开销售模态框并预填预定信息
          openSaleModalWithPreorder(matchedPhone, {
            preorder_id: routePreorderId,
            customer_id: String(route.query.customer_id || ''),
            customer_name: String(route.query.customer_name || ''),
            customer_phone: String(route.query.customer_phone || ''),
            expected_price: String(route.query.expected_price || ''),
            advance_payment: String(route.query.advance_payment || '')
          })
          // 清理URL参数
          const nextQuery = { ...route.query }
          delete nextQuery.imei
          delete nextQuery.preorder_id
          delete nextQuery.customer_id
          delete nextQuery.customer_name
          delete nextQuery.customer_phone
          delete nextQuery.expected_price
          delete nextQuery.advance_payment
          router.replace({ path: route.path, query: nextQuery })
        }
      }
      // 处理原有的通过phone_id打开销售的方式
      else {
        await handleRouteAutoOpenSale(records)
      }
    } else {
      showError(response.message || '加载数据失败')
      availablePhones.value = []
      setTotal(0)
    }
  } catch (error) {
    if (requestVersion !== availablePhonesRequestVersion) return
    logger.error('加载手机列表失败:', error)
    if (!silentError) {
      showError('加载数据失败')
    }
    availablePhones.value = []
    setTotal(0)
  } finally {
    if (showLoadingState && requestVersion === availablePhonesRequestVersion) {
      loading.value = false
    }
  }
}

// 品牌变化处理
const handleBrandChange = async () => {
  // 清空型号筛选
  filters.model = ''

  // 如果有选择品牌，获取对应的型号列表
  if (filters.brand) {
    await fetchBrandModels(filters.brand)
  } else {
    brandModels.value = []
  }

  // 重新加载数据
  loadAvailablePhones()
}

// 编辑弹窗的品牌变更处理
const onEditBrandChange = async () => {
  // 清空型号选择
  editForm.model = ''
  editForm.brand_id = null
  editForm.model_id = null

  if (editForm.brand) {
    const selectedBrand = brands.value.find(brand => (
      String(brand.name).trim().toLocaleLowerCase() === String(editForm.brand).trim().toLocaleLowerCase()
    ))
    editForm.brand_id = selectedBrand?.id ?? null
    await fetchEditBrandModels(editForm.brand)
  } else {
    editBrandModels.value = []
  }
}


// 计算利润
const calculateProfit = () => {
  // 利润会通过计算属性自动计算
  // 如果当前是国补刷卡模式，自动更新备注
  if (saleForm.payment_method === 'subsidy_card' || saleForm.payment_channel === 'subsidy_card') {
    calculateSubsidyRemarks()
  }
}


// 防抖包装的提交函数
const debouncedSubmitSale = debounceSubmit(handleSale, 500)
const debouncedSubmitBatchSale = debounceSubmit(submitBatchSale, 500)

// 编辑手机信息
const editPhone = async (phone: any) => {

  // 权限检查：验证用户是否有编辑权限
  if (!canEdit.value) {
    showError('您没有编辑权限')
    return
  }

  if (['repair', 'rented'].includes(phone.status) && !authStore.isAdmin) {
    showError(phone.status === 'rented' ? '租赁中的设备仅管理员可编辑' : '维修中的设备仅管理员可编辑')
    return
  }

  // 列表接口可能来自旧缓存或旧后端版本，打开编辑时重新读取详情以取得规范 ID 字段。
  let editRecord = phone
  try {
    const detailResponse = await api.get(`/phones/${phone.id}`, {
      showError: false,
      useCache: false
    })
    if (detailResponse.success) {
      const detail = extractResponseData<any>(detailResponse)
      if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        editRecord = { ...phone, ...detail }
      }
    }
  } catch (error) {
    logger.warn('读取手机详情失败，使用列表数据打开编辑:', error)
  }

  // 所有设备统一使用弹窗编辑
  selectedPhoneForEdit.value = editRecord
  showEditModal.value = true
}

// 提交编辑
const submitEdit = async () => {
  if (submitting.value) return
  try {
    // 验证必填字段
    // 对于手机设备（品牌包含iPhone、华为、小米等），IMEI必须是15位
    // 对于非手机设备（AirPods、iPad等），IMEI可以不是15位
    const isPhoneDevice = /^(iPhone|华为|小米|红米|OPPO|vivo|三星|荣耀|realme|一加|魅族|诺基亚|索尼|LG|摩托罗拉)/i.test(editForm.brand || '')
    if (isPhoneDevice && editForm.imei !== editForm.serial_number && (!editForm.imei || editForm.imei.length < 15)) {
      showError('请输入完整的15位IMEI号')
      return
    }

    let referenceIds
    try {
      referenceIds = await resolvePhoneReferenceIds({
        brand_id: editForm.brand_id,
        model_id: editForm.model_id,
        color_id: editForm.color_id,
        memory_id: editForm.memory_id,
        brand: editForm.brand,
        model: editForm.model,
        color: editForm.color,
        memory: editForm.memory
      }, selectedPhoneForEdit.value || {})
    } catch (referenceError) {
      showError(referenceError instanceof Error ? referenceError.message : '品牌、型号、颜色和内存必须选择有效数据')
      return
    }

    // 构建更新数据，包含所有可编辑字段（不包括销售价格）
    const updateData = {
      ...toCanonicalPhoneUpdatePayload({
        ...referenceIds,
        serial_number: editForm.serial_number,
        imei: editForm.imei,
        purchase_cost: editForm.purchase_cost,
        sale_price: editForm.sale_price,
        supplier_id: editForm.supplier_id,
        store_id: editForm.store_id,
        condition: editForm.condition,
        inventory_time: editForm.inventory_time,
        remarks: editForm.remarks
      })
    }

    // 移除空值（但保留必要的字段）
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === null || updateData[key] === '' || updateData[key] === undefined) {
        delete updateData[key]
      }
    })


    // 发送更新请求
    const response = await api.put(`/phones/${selectedPhoneForEdit.value.id}`, updateData, { showError: false })

    if (response.success) {
      showSuccess('更新成功')
      showEditModal.value = false
      await loadAvailablePhones(true) // 编辑后绕过缓存，读取最新型号和规格
    } else {
      showError(response.message || '更新失败')
    }
  } catch (error) {
    logger.error('更新失败:', error)
    // 统一 API 会将非 2xx 响应以 AxiosError 抛出，优先展示后端的可读校验原因。
    const errorRecord = error as {
      response?: { data?: { message?: unknown } }
      message?: unknown
    }
    const backendMessage = errorRecord.response?.data?.message
    showError(typeof backendMessage === 'string' && backendMessage.trim()
      ? backendMessage
      : '更新失败，请重试')
  }
}

// 关闭编辑弹窗
const closeEditModal = () => {
  showEditModal.value = false
  selectedPhoneForEdit.value = null
  // 清空编辑弹窗的品牌型号数据
  editBrandModels.value = []
  // 重置表单数据
  Object.assign(editForm, {
    brand_id: null,
    model_id: null,
    color_id: null,
    memory_id: null,
    brand: '',
    model: '',
    color: '',
    memory: '',
    serial_number: '',
    imei: '',
    purchase_cost: null,
    supplier_id: null,
    store_id: null,
    operator_id: '',
    operator_name: '',
    condition: '',
    status: '',
    inventory_time: null,
    remarks: ''
  })
}

// IMEI输入验证 - 根据模式决定格式化规则
const handleImeiInput = (value: string) => {
  if (editIsNoIMEIMode.value) {
    // 无IMEI模式：允许数字和字母，字母转大写
    editForm.imei = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 30)
  } else {
    // 标准模式：只允许数字
    editForm.imei = value.replace(/[^\d]/g, '').slice(0, 15)
  }
}

// 切换编辑模式的无IMEI状态
const toggleEditNoIMEIMode = () => {
  editIsNoIMEIMode.value = !editIsNoIMEIMode.value

  if (editIsNoIMEIMode.value) {
    // 启用无IMEI模式：如果有序列号，自动填充IMEI
    if (editForm.serial_number) {
      editForm.imei = editForm.serial_number
    }
    showSuccess('已启用无IMEI模式，IMEI将支持字母+数字')
  } else {
    // 切换回标准模式：清空IMEI，重新输入15位纯数字
    editForm.imei = ''
    showInfo('已切换回标准IMEI模式，需要输入15位纯数字')
  }
}

// 序列号输入验证 - 只允许字母和数字
const handleSerialNumberInput = (value: string) => {
  editForm.serial_number = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 18)
}

// 支付方式变化处理
const handlePaymentMethodChange = () => {
  // 如果选择了国补刷卡，检查金额是否超过6000
  if (saleForm.payment_method === 'subsidy_card') {
    const salePrice = parseFloat(saleForm.sale_price) || 0
    if (salePrice > 6000) {
      showError('销售金额超过6000元，无法使用国补刷卡，请重新选择支付方式')
      saleForm.payment_method = ''
      saleForm.payment_channel = ''
      saleForm.remarks = ''
      return
    }
    saleForm.payment_channel = 'subsidy_card'
    // 立即计算备注
    calculateSubsidyRemarks()
  } else {
    // 清空支付渠道和备注
    saleForm.payment_channel = ''
    saleForm.remarks = ''
  }
}

// 支付渠道变化处理（保留，以防手动选择时使用）
const handlePaymentChannelChange = () => {
  // 如果选择了国补刷卡，自动计算并填写备注
  if (saleForm.payment_channel === 'subsidy_card') {
    calculateSubsidyRemarks()
  }
}

// 计算国补备注
const calculateSubsidyRemarks = () => {
  const salePrice = parseFloat(saleForm.sale_price) || 0
  if (salePrice <= 0) return

  // 只有6000元以内才能参加国补
  if (salePrice > 6000) {
    // 清空国补刷卡选择
    if (saleForm.payment_method === 'subsidy_card') {
      showError('销售金额超过6000元，无法使用国补刷卡，请重新选择支付方式')
      saleForm.payment_method = ''
      saleForm.payment_channel = ''
    }
    // 只有原备注是国补备注时才清空
    if (saleForm.remarks && saleForm.remarks.startsWith('刷卡实际支付')) {
      saleForm.remarks = ''
    }
    return
  }

  // 计算优惠金额：15%，最高优惠500元
  const discount = Math.min(salePrice * 0.15, 500)
  // 保留两位小数
  const roundedDiscount = Math.round(discount * 100) / 100
  // 计算实际支付金额
  const actualPayment = Math.round((salePrice - roundedDiscount) * 100) / 100

  // 设置备注：只有当备注为空时才自动填充国补信息
  // 如果备注已有数据，则不替换（保留原备注）
  if (!saleForm.remarks || saleForm.remarks.trim() === '') {
    saleForm.remarks = `刷卡实际支付${actualPayment}元`
  }
}

// 监听视图模式变化，切换到库存表模式时加载数据
watch(viewMode, async (newMode) => {
  if (newMode === 'summary') {
    await loadInventorySummary()
  }
})

// 监听筛选条件变化，在库存表模式下重新加载数据（使用防抖优化）
watch(
  () => [filters.supplier_id, filters.store_id, filters.brand, filters.model, filters.color, filters.memory, filters.is_new, filters.start_date, filters.end_date, filters.search],
  () => {
    // 使用防抖，避免频繁API调用
    debounceLoadInventorySummary()
  }
)

// 监听编辑弹窗打开，填充表单数据
watch(showEditModal, async (newVal) => {
  if (newVal && selectedPhoneForEdit.value) {
    const phone = selectedPhoneForEdit.value

    const operatorName = phone.inventory_operator_name || ''

    // 填充表单数据
    Object.assign(editForm, {
      brand_id: phone.brand_id ?? null,
      model_id: phone.model_id ?? null,
      color_id: phone.color_id ?? null,
      memory_id: phone.memory_id ?? null,
      brand: phone.brand || '',
      model: phone.model || '',
      color: phone.color || '',
      memory: phone.memory || '',
      serial_number: phone.serial_number || '',
      imei: phone.imei || '',
      purchase_cost: phone.purchase_cost === null || phone.purchase_cost === undefined ? null : Math.round(Number(phone.purchase_cost)),
      sale_price: phone.sale_price === null || phone.sale_price === undefined ? null : Number(phone.sale_price),
      supplier_id: phone.supplier_id || null,
      store_id: phone.store_id || null,
      operator_id: phone.inventory_operator_id === null || phone.inventory_operator_id === undefined ? '' : String(phone.inventory_operator_id),
      operator_name: operatorName,
      condition: phone.condition || '',
      status: phone.status || '',
      inventory_time: phone.inventory_time
        ? new Date(phone.inventory_time).toISOString().slice(0, 10)
        : null,
      remarks: phone.remarks || ''
    })

    // 检测是否为无IMEI模式
    editIsNoIMEIMode.value = detectEditNoIMEIMode(editForm.imei, editForm.serial_number)

    // 如果选择了品牌，加载对应的型号列表
    if (editForm.brand) {
      await fetchEditBrandModels(editForm.brand)
    }
  }
})

// 删除手机记录
const deletePhone = async (phone: any) => {
  // 权限检查：验证用户是否有删除权限
  if (!canDelete.value) {
    showError('您没有删除权限')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除这台手机吗？\n\n品牌型号：${phone.brand} ${phone.model}\nIMEI：${phone.imei || '无'}\n\n此操作不可恢复！`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-unified'
      }
    )
  } catch {
    return
  }

  try {
    const response = await api.delete(`/phones/${phone.id}`, { showError: false })

    if (response.success) {
      showSuccess('删除成功')
      await loadAvailablePhones()
    } else {
      showError(response.message || '删除失败')
    }
  } catch (error) {
    logger.error('删除失败:', error)
    showError('删除失败')
  }
}

// 重置筛选
const resetFilters = () => {
  Object.assign(filters, {
    supplier_id: '',
    brand: '',
    model: '',
    color: '',
    memory: '',
    store_id: '',
    operator_id: '',
    is_new: '',
    date_range: '',
    start_date: '',
    end_date: '',
    search: ''
  })
  loadAvailablePhones()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await Promise.all([
      loadAvailablePhones(true, true, false),
      loadStores(),
      loadOperators(),
      loadSuppliers(),
      loadBrands(),
      loadModels(),
      loadColors(),
      loadMemories()
    ])
    setDefaultOperator()
  })
  showSuccess('数据刷新成功', { duration: 2000 })
}

// 新的统一分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  goToPage(page)
  setPageSize(pageSize)
  loadAvailablePhones()
}

// 页面挂载
onMounted(async () => {
  window.addEventListener('tf2025:permissions:updated', handleSalesPermissionsUpdated)
  window.addEventListener('resize', syncSalesViewMode, { passive: true })

  // 检测是否为移动设备并调整显示模式
  syncSalesViewMode()

  try {
    // 使用统一的权限预加载系统
    await preloadPermissions()
  } catch (error) {
    logger.error('❌ 权限数据预加载失败:', error)
    showError('权限加载失败，请刷新页面重试')
  }

  // 权限检查：验证用户是否有销售页面访问权限
  if (!canView.value) {
    showError('您没有访问此页面的权限')
    // 可以选择重定向到无权限页面或首页
    return
  }

  // 开发环境：等待认证状态完全初始化，避免并发API调用导致的401重定向
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  // 初始化统一字段权限（用户→角色→字段权限）
  await initFieldPermissions()

  // 先恢复本地筛选，避免首屏加载后又因恢复筛选再打一轮请求
  loadFiltersFromStorage()

  // 首屏需要展示内容区加载，避免只看到全局加载而表格区域无反馈。
  const initialPhoneLoad = loadAvailablePhones(false, true, true)

  // 在后台延后加载基础数据，避免首屏和商品列表抢占请求
  initialPhoneLoad.finally(() => {
    if (getRouteAutoOpenSalePhoneId()) {
      window.setTimeout(() => {
        void handleRouteAutoOpenSale(availablePhones.value)
      }, 100)
    }

    salesBaseDataWarmupTimer = setTimeout(() => {
      Promise.all([
        loadStores(),
        loadOperators(),
        loadSuppliers(),
        loadBrands(),
        loadModels(),
        loadColors(),
        loadMemories()
      ]).then(() => {
        setDefaultOperator()
      }).catch(error => {
        logger.error('❌ 基础数据加载失败:', error)
      })
    }, 800)
  })

  // 添加全局键盘事件监听器
  document.addEventListener('keydown', handleGlobalKeydown)
})

watch(
  () => [route.query.sale_phone_id, route.query.auto_open_sale, route.query.imei, route.query.preorder_id],
  ([phoneId, autoOpen, imei, preorderId]) => {
    // 处理从预定页面跳转过来的交付请求（通过IMEI查找）
    if (String(imei || '').trim() && String(preorderId || '').trim()) {
      handledRouteSalePhoneId.value = ''
      pagination.page = 1
      loadAvailablePhones(false, true, false)
    }
    // 处理原有的通过phone_id打开销售的方式
    else if (String(autoOpen || '') === '1' && String(phoneId || '').trim()) {
      handledRouteSalePhoneId.value = ''
      pagination.page = 1
      loadAvailablePhones(false, true, false)
    }
  }
)

// 页面卸载时清理事件监听器和定时器
onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', syncSalesViewMode)
  window.removeEventListener('tf2025:permissions:updated', handleSalesPermissionsUpdated)
  // 清理防抖定时器
  disposeSalesCustomers()
  disposeInventorySummary()
  if (loadPhonesDebounceTimer) clearTimeout(loadPhonesDebounceTimer)
  if (salesBaseDataWarmupTimer) clearTimeout(salesBaseDataWarmupTimer)
})
</script>

<style scoped lang="scss" src="./styles/sales-view-base.scss"></style>

<!-- 非 scoped 样式：销售弹窗布局覆盖 -->
<style lang="scss" src="./styles/sales-view-dialogs.scss"></style>
