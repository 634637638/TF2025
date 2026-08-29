<template>
  <div class="inventory-view admin-page">
    <PermissionGate
      :can-view="canView"
      module-name="库存管理"
      permission-code="inventory:view"
    >
      <PageHeader
        icon="fas fa-warehouse"
        title="库存管理"
      >
        <template #actions>
          <el-button
            v-if="canCreate"
            type="primary"
            @click="handleStartStockIn"
          >
            <i class="fas fa-plus" />
            <span>入库</span>
          </el-button>
          <ImportExportActions
            :can-export="canExport"
            :export-loading="exporting"
            :export-disabled="loadingStore.isLoading || exporting"
            export-icon-class="fas fa-download"
            @export="exportInventory"
          />
          <el-button
            type="info"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <InlineLoading
              v-if="refreshing"
              text="刷新中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-sync-alt" />
              <span>刷新</span>
            </template>
          </el-button>
        </template>
      </PageHeader>

      <div class="content admin-page-content">
        <InventoryStatsCards
          :loading="loadingStore.isLoading"
          :stats="statCards"
          :visible="showStatsCards"
        />
        <InventorySearchFilters
          v-model:expanded="searchExpanded"
          :brand-models="brandModels"
          :brands="brands"
          :can-view-field="canViewField"
          :colors="colors"
          :filters="filters"
          :loading="isLoading"
          :memories="memories"
          :model-count="models.length"
          :operators="operators"
          :stores="stores"
          :suppliers="suppliers"
          @brand-change="handleBrandChange"
          @filter-change="loadInventory"
          @reset="resetFilters"
          @search="loadInventory"
          @search-input="debounceLoadInventory"
        />

        <InventoryTable
          :can-create="canCreate"
          :can-delete="canDelete"
          :can-edit="canEdit"
          :columns="tableColumns"
          :format-date="formatDate"
          :format-number="formatNumber"
          :get-column-class="getInventoryColumnClass"
          :get-column-min-width="getInventoryColumnMinWidth"
          :get-column-width="getInventoryColumnWidth"
          :get-condition-class="getConditionClass"
          :get-condition-text="getConditionText"
          :get-sale-status-class="getSaleStatusClass"
          :get-sale-status-label="getSaleStatusLabel"
          :inventory="inventory"
          :loading="isLoading"
          :pagination="pagination"
          @delete="deleteItem"
          @edit="editItem"
          @pagination-change="handlePaginationChange"
          @quick-sale="quickSaleItem"
          @row-tap="handleInventoryRowTap"
          @view="viewDetails"
        />

        <InventoryDetailModal
          v-if="showDetailsModal"
          v-model="showDetailsModal"
          :item="selectedItem"
          :can-create="canCreate"
          :can-edit="canEdit"
          :can-delete="canDelete"
          @close="handleCloseDetails"
          @edit="handleEditFromModal"
          @delete="handleDeleteFromModal"
          @quick-sale="handleQuickSaleFromModal"
        />
      </div>
    </PermissionGate>
  </div>

  
  <!-- 入库弹窗组件 -->
  <StockInModal
    v-if="showStockInModal"
    v-model:visible="showStockInModal"
    mode="create"
    @success="handleStockInSuccess"
    @cancel="handleStockInCancel"
  />

  <!-- Toast 通知组件 -->
  <Toast />

  <InventoryEditDialog
    v-model="showEditModal"
    :brand-models="editBrandModels"
    :brands="brands"
    :can-edit-field="canEditField"
    :can-view-field="canViewField"
    :colors="colors"
    :edit-form="editForm"
    :memories="memories"
    :model-search-loading="modelSearchLoading"
    :no-imei-mode="editIsNoIMEIMode"
    :phone-status-options="PHONE_STATUS_OPTIONS"
    :remote-search-model="remoteSearchModel"
    :stores="stores"
    :submitting="submitting"
    :suppliers="suppliers"
    @brand-change="onEditBrandChange"
    @close="closeEditModal"
    @format-imei="formatEditIMEI"
    @open-config="showPublishToH5Modal = true"
    @publish-change="handleQuickPublishChange"
    @submit="submitEdit"
    @toggle-no-imei="toggleEditNoIMEIMode"
  />

  <!-- 上架商品到H5商城模态框 -->
  <PublishToH5Modal
    v-if="showPublishToH5Modal"
    v-model="showPublishToH5Modal"
    :phone-id="selectedPhoneForEdit?.id || null"
    :is-new="selectedPhoneForEdit ? isNewInventoryValue(selectedPhoneForEdit.is_new) : undefined"
    @success="handlePublishSuccess"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, onUnmounted, onActivated, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMobileDetection } from '@/composables/mobile'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { normalizePermissionList } from '@/utils/permissionList'
import { getAdaptiveActionColumnWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { toCanonicalPhoneUpdatePayload } from '@/utils/phone-update-payload'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import { useLoadingStore } from '@/stores/loading'
import Toast from '../../components/Toast.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { PageHeader, PermissionGate } from '@/components/base'
import InventoryStatsCards from './page/InventoryStatsCards.vue'
import InventoryTable from './page/InventoryTable.vue'
import InventorySearchFilters from './page/InventorySearchFilters.vue'
import InventoryEditDialog from './page/InventoryEditDialog.vue'
import { useInventoryBaseOptions } from './useInventoryBaseOptions'
import { useInventoryData } from './useInventoryData'
import { PHONE_STATUS_OPTIONS, getPhoneStatusClass, getPhoneStatusLabel, normalizePhoneStatus } from '@/constants/phoneStatuses'
import type { InventoryItem } from '@/types'

const InventoryDetailModal = defineAsyncComponent(() => import('@/components/InventoryDetailModal.vue'))
const StockInModal = defineAsyncComponent(() => import('@/components/StockInModal.vue'))
const PublishToH5Modal = defineAsyncComponent(() => import('@/components/PublishToH5Modal.vue'))

interface Stats {
  total: number
  inStock: number
  sold: number
  totalValue: number
}

const router = useRouter()
const route = useRoute()
const mobileDetection = useMobileDetection()
const { success, error, warning } = useNotification()
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  handleNoPermission
} = usePagePermissions('inventory')
const { refreshing, refresh } = useRefreshData()
const authStore = useAuthStore()
const loadingStore = useLoadingStore()
const { init: initFieldPermissions } = fieldPermissions
const { exportFile, buildDateFilename } = useImportExport()
const exporting = ref(false)
const initialTableLoading = ref(true)

// 搜索相关状态
const searchExpanded = ref(false) // 搜索区域展开状态（移动端默认折叠）
const showAdvancedSearch = ref(false)
const showDesktopSearch = ref(false) // 桌面端搜索区域显示状态，默认折叠
const simpleSearchQuery = ref('') // 简化搜索框的查询内容

// 实时搜索防抖
let searchDebounceTimer: any = null

// 触摸事件相关状态（用于移动端双击检测）
const touchTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())
const lastTapTime = ref<Map<string, number>>(new Map())

// 窗口宽度响应式
const windowWidth = ref(window.innerWidth)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

// Element Plus 表格在移动端不会可靠触发 dblclick，使用两次 row-click 模拟双击。
const handleInventoryRowTap = (item: InventoryItem, _column: unknown, event: MouseEvent) => {
  if (windowWidth.value > 1024) return

  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, select, textarea, .action-buttons')) return

  const rowKey = String(item.id ?? item.imei ?? item.serial_number)
  const now = Date.now()
  const lastTime = lastTapTime.value.get(rowKey) || 0
  const timeDiff = now - lastTime

  // 清除之前的定时器
  const existingTimer = touchTimers.value.get(rowKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
    touchTimers.value.delete(rowKey)
  }

  // 手机端点击事件可能略有延迟，400ms 内点击同一行视为双击。
  if (timeDiff <= 400 && timeDiff > 0) {
    viewDetails(item)
    lastTapTime.value.delete(rowKey)
  } else {
    // 单击：等待可能的双击
    const timer = setTimeout(() => {
      lastTapTime.value.delete(rowKey)
      touchTimers.value.delete(rowKey)
    }, 400)
    touchTimers.value.set(rowKey, timer)
  }

  lastTapTime.value.set(rowKey, now)
}

const inventoryFieldMap: Record<string, string> = {
  stats_total_phones: 'stats.total_phones',
  stats_new_phones: 'stats.new_phones',
  stats_used_phones: 'stats.used_phones',
  stats_inventory_value: 'stats.inventory_value',
  supplier_name: 'supplier_info.supplier_name',
  store_name: 'store_info.store_name',
  brand: 'basic.brand',
  model: 'basic.model',
  color: 'basic.color',
  memory: 'basic.memory',
  serial_number: 'basic.serial_number',
  imei: 'basic.imei',
  purchase_cost: 'price_info.purchase_cost',
  inventory_operator_name: 'operator_info.inventory_operator_name',
  is_new: 'basic.is_new',
  status: 'basic.status',
  inventory_time: 'time_info.inventory_time',
  purchase_number: 'purchase_info.purchase_number',
  remarks: 'other_info.remarks',
  actions: 'system_info.operations'
}

const getInventoryFieldKey = (fieldName: string) => {
  return inventoryFieldMap[fieldName] || fieldName
}

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('inventory_inventoryview', getInventoryFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('inventory_inventoryview', getInventoryFieldKey(fieldName))
}

// 根据屏幕宽度动态配置表格列
const tableColumns = computed(() => {
  const width = windowWidth.value

  // 定义所有列
  const allColumns = [
    { key: 'supplier_name', label: '供应商' },
    { key: 'store_name', label: '店铺' },
    { key: 'brand', label: '品牌' },
    { key: 'model', label: '型号' },
    { key: 'color', label: '颜色' },
    { key: 'memory', label: '内存' },
    { key: 'serial_number', label: '序列号' },
    { key: 'imei', label: 'IMEI' },
    { key: 'purchase_cost', label: '入库价格' },
    { key: 'inventory_operator_name', label: '入库员' },
    { key: 'is_new', label: '机况' },
    { key: 'is_preordered', label: '状态' },
    { key: 'inventory_time', label: '入库时间' },
    { key: 'actions', label: '操作' }
  ]

  // 根据屏幕宽度过滤字段
  let mobileColumns: string[] = []

  if (width <= 480) {
    // 小屏手机保留核心字段；操作统一放到双击详情弹窗底部。
    mobileColumns = ['model', 'color', 'memory', 'serial_number']
  } else if (width <= 768) {
    mobileColumns = ['brand', 'model', 'color', 'memory', 'serial_number', 'imei', 'is_new']
  } else if (width <= 1024) {
    mobileColumns = ['brand', 'model', 'color', 'memory', 'serial_number', 'imei', 'purchase_cost', 'is_new', 'inventory_time']
  }

  const visibleColumns = allColumns.filter(column => {
    if (column.key === 'actions') {
      return shouldShowActionColumn(
        canViewField('actions'),
        [canCreate.value, canEdit.value, canDelete.value]
      )
    }

    return canViewField(column.key)
  })

  if (width <= 1024) {
    return visibleColumns.filter(column => mobileColumns.includes(column.key))
  }

  return visibleColumns
})

// 响应式数据 - 强制初始化为空状态
const inventory = ref<InventoryItem[]>([])

const inventoryColumnWidths: Record<string, number> = {
  supplier_name: 100,
  store_name: 80,
  brand: 68,
  model: 88,
  color: 44,
  memory: 52,
  serial_number: 156,
  imei: 168,
  purchase_cost: 92,
  inventory_operator_name: 82,
  is_new: 64,
  is_preordered: 72,
  inventory_time: 108
}

const getInventoryColumnValue = (columnKey: string, item: InventoryItem) => {
  switch (columnKey) {
  case 'supplier_name': return item.supplier_name || '-'
  case 'store_name': return item.store_name || '-'
  case 'brand': return item.brand_name || item.brand || '-'
  case 'model': return item.model_name || item.model || '-'
  case 'color': return item.color_name || item.color || '-'
  case 'memory': return item.memory_name || item.memory || '-'
  case 'serial_number': return item.serial_number || '-'
  case 'imei': return item.imei || '-'
  case 'purchase_cost': return `¥${formatNumber(item.purchase_cost || 0)}`
  case 'inventory_operator_name': return item.inventory_operator_name || item.operator_name || '-'
  case 'is_new': return getConditionText(item.is_new ?? 0)
  case 'is_preordered': return getSaleStatusLabel(item)
  case 'inventory_time': return formatDate(item.inventory_time || item.created_at)
  default: return '-'
  }
}

const getInventoryColumnMinWidth = (column: { key: string; label: string }) => {
  const useCompactMobileWidth = windowWidth.value <= 768

  if (useCompactMobileWidth && column.key === 'model') {
    return getTextColumnMinWidth(
      ['型号', ...inventory.value.map(item => item.model_name || item.model)],
      {
        minWidth: inventoryColumnWidths.model,
        horizontalPadding: 18,
        asciiCharacterWidth: 6.5,
        wideCharacterWidth: 11
      }
    )
  }

  if (useCompactMobileWidth && column.key === 'color') {
    return getTextColumnMinWidth(
      ['颜色', ...inventory.value.map(item => item.color_name || item.color)],
      {
        minWidth: inventoryColumnWidths.color,
        horizontalPadding: 16,
        asciiCharacterWidth: 6.5,
        wideCharacterWidth: 11
      }
    )
  }

  if (useCompactMobileWidth && column.key === 'memory') {
    return getTextColumnMinWidth(
      ['内存', ...inventory.value.map(item => item.memory_name || item.memory)],
      {
        minWidth: inventoryColumnWidths.memory,
        horizontalPadding: 16,
        asciiCharacterWidth: 6.5,
        wideCharacterWidth: 11
      }
    )
  }

  if (column.key === 'serial_number') {
    return getIdentifierColumnMinWidth(
      ['序列号', ...inventory.value.map(item => item.serial_number)],
      {
        minWidth: useCompactMobileWidth ? 128 : inventoryColumnWidths.serial_number,
        horizontalPadding: useCompactMobileWidth ? 20 : 40,
        asciiCharacterWidth: useCompactMobileWidth ? 6.5 : 8,
        wideCharacterWidth: useCompactMobileWidth ? 11 : 13
      }
    )
  }

  if (column.key === 'imei') {
    return getIdentifierColumnMinWidth(
      ['IMEI', ...inventory.value.map(item => item.imei)],
      {
        minWidth: useCompactMobileWidth ? 128 : inventoryColumnWidths.imei,
        horizontalPadding: useCompactMobileWidth ? 20 : 40,
        asciiCharacterWidth: useCompactMobileWidth ? 6.5 : 8,
        wideCharacterWidth: useCompactMobileWidth ? 11 : 13
      }
    )
  }

  return getTextColumnMinWidth(
    [column.label, ...inventory.value.map(item => getInventoryColumnValue(column.key, item))],
    {
      minWidth: inventoryColumnWidths[column.key] || 72,
      horizontalPadding: useCompactMobileWidth ? 16 : 20,
      asciiCharacterWidth: useCompactMobileWidth ? 6.5 : 8,
      wideCharacterWidth: useCompactMobileWidth ? 11 : 13
    }
  )
}

const inventoryActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  inventory.value,
  [
    true,
    item => canCreate.value && item.status === 'in_stock',
    item => canEdit.value && item.status === 'in_stock',
    item => canDelete.value && item.status === 'in_stock'
  ]
))

const getInventoryColumnWidth = (column: { key: string }) => (
  column.key === 'actions' ? inventoryActionColumnWidth.value : undefined
)

const getInventoryColumnClass = (column: { key: string }) => {
  if (column.key === 'serial_number' || column.key === 'imei') {
    return 'identifier-column serial-imei-column'
  }
  if (column.key === 'purchase_cost') return 'price-column'
  if (column.key === 'actions') return 'actions-column'
  return ''
}



const selectedItem = ref<InventoryItem | null>(null)
const showDetailsModal = ref(false)

// 入库弹窗状态
const showStockInModal = ref(false)

// 编辑弹窗相关
const showEditModal = ref(false)
const selectedPhoneForEdit = ref<any>(null)
const submitting = ref(false)
const editForm = reactive({
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
  supplier_id: null,
  store_id: null,
  condition: '',
  status: 'in_stock',
  inventory_time: null,
  remarks: '',
  is_published: 1,  // H5上架状态，1=上架，0=下架
  // 图片上传相关
  imageHover: false
})

// 编辑模式的无IMEI状态
const editIsNoIMEIMode = ref(false)

// 编辑弹窗专用的品牌型号数据
const editBrandModels = ref<string[]>([])
const modelSearchLoading = ref(false)

// 上架商品模态框
const showPublishToH5Modal = ref(false)

const AUTO_OPEN_SALE_PHONE_STORAGE_KEY = 'tf2025:auto-open-sale-phone'

const isNewInventoryValue = (value: unknown): boolean => {
  return value === true || value === 1 || value === '1'
}

// 远程搜索型号方法
const remoteSearchModel = async (query: string) => {
  if (!query || query.trim() === '') {
    // 如果搜索为空，加载该品牌的默认型号列表
    if (editForm.brand) {
      await fetchEditBrandModels(editForm.brand)
    }
    return
  }


  try {
    modelSearchLoading.value = true

    // 构建搜索参数
    const params = new URLSearchParams()
    params.append('name', query.trim())
    params.append('status', '1')
    params.append('page_size', '50')

    // 如果选择了品牌，添加品牌过滤
    if (editForm.brand) {
      const brand = brands.value.find((b: any) => b.name === editForm.brand)
      if (brand) {
        params.append('brand_id', String(brand.id))
      }
    }

    const response = await api.get(`/models?${params.toString()}`)
    if (response.success) {
      const modelsData = extractResponseData<any[]>(response)

      editBrandModels.value = modelsData
        .filter((m: any) => m && m.name)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m: any) => String(m.name || '').trim())

    } else {
      editBrandModels.value = []
    }
  } catch (err) {
    logger.error('搜索型号失败:', err)
    editBrandModels.value = []
  } finally {
    modelSearchLoading.value = false
  }
}

const suppliers = ref<any[]>([])
const stores = ref<any[]>([])
const operators = ref<any[]>([])
const brands = ref<Array<{id: number, name: string}>>([])
const models = ref<Array<{id: number, name: string}>>([])
const colors = ref<string[]>([])
const memories = ref<string[]>([])
const brandModels = ref<Array<{id: number, name: string}>>([])  // 存储当前品牌对应的型号列表

// 加载状态
const isLoading = computed(() => initialTableLoading.value || loadingStore.isLoading)

const normalizedInventoryPermissions = computed<string[]>(() => {
  return normalizePermissionList(authStore.permissions)
})

// 统计数据
const stats = reactive<Stats>({
  total: 0,
  inStock: 0,
  sold: 0,
  totalValue: 0
})
const statsAvailable = ref(false)

const showStatsCards = computed(() => (
  canViewField('stats_total_phones') ||
  canViewField('stats_new_phones') ||
  canViewField('stats_used_phones') ||
  canViewField('stats_inventory_value')
))

// 统计卡片配置
const statCards = computed(() => ([
  {
    key: 'total',
    permission: 'stats_total_phones',
    label: '手机总数',
    value: statsAvailable.value ? stats.total : '暂无数据',
    icon: 'fas fa-mobile-alt',
    iconClass: ''
  },
  {
    key: 'inStock',
    permission: 'stats_new_phones',
    label: '全新机数量',
    value: statsAvailable.value ? stats.inStock : '暂无数据',
    icon: 'fas fa-box',
    iconClass: 'in-stock'
  },
  {
    key: 'sold',
    permission: 'stats_used_phones',
    label: '二手机数量',
    value: statsAvailable.value ? stats.sold : '暂无数据',
    icon: 'fas fa-check-circle',
    iconClass: 'sold'
  },
  {
    key: 'totalValue',
    permission: 'stats_inventory_value',
    label: '库存总值',
    value: statsAvailable.value ? `¥${formatNumber(stats.totalValue)}` : '暂无数据',
    icon: 'fas fa-dollar-sign',
    iconClass: ''
  }
]).filter(stat => canViewField(stat.permission)))

// 筛选条件 - 与销售页面保持一致的顺序
const filters = reactive({
  brand: '',
  model: '',
  color: '',
  memory: '',
  store_id: '',
  supplier_id: '',
  operator_id: '',
  is_new: '',
  status: '',        // 库存状态
  phone_condition: '', // 手机成色
  date_range: '',
  date_start: '', // 移动端开始日期
  date_end: '',   // 移动端结束日期
  search: ''
})

// CustomSearch 组件的筛选条件配置 - 与销售页面保持一致的顺序
const searchFilters = computed(() => {
  // 按照要求的顺序配置筛选条件：品牌、型号、颜色、内存、供应商、店铺、入库员、 成色、入库日期
  return [
    {
      key: 'brand',
      label: '品牌',
      type: 'editable-select',
      placeholder: '请输入或选择品牌',
      editableOptions: () => brands.value,
      showOptions: true, // 默认显示选项
      highlightedIndex: -1,
      onOptionsChange: async (filter, value) => {
        // 品牌变化时，获取对应的型号列表
        await fetchBrandModels(value)
      }
    },
    {
      key: 'model',
      label: '型号',
      type: 'editable-select',
      placeholder: '请输入或选择型号',
      editableOptions: () => brandModels.value,
      showOptions: true, // 默认显示选项
      highlightedIndex: -1
    },
    {
      key: 'color',
      label: '颜色',
      type: 'editable-select',
      placeholder: '请输入或选择颜色',
      editableOptions: () => colors.value.length > 0 ? colors.value : [],
      showOptions: true, // 默认显示选项
      highlightedIndex: -1
    },
    {
      key: 'memory',
      label: '内存',
      type: 'editable-select',
      placeholder: '请输入或选择内存',
      editableOptions: () => memories.value.length > 0 ? memories.value : [],
      showOptions: true, // 默认显示选项
      highlightedIndex: -1
    },
    {
      key: 'supplier_id',
      label: '供应商',
      type: 'select',
      placeholder: '选择供应商',
      options: suppliers.value.map(supplier => ({
        label: supplier.name,
        value: supplier.id
      }))
    },
    {
      key: 'store_id',
      label: '店铺',
      type: 'select',
      placeholder: '选择店铺',
      options: stores.value.map(store => ({
        label: store.name,
        value: store.id
      }))
    },
    {
      key: 'operator_id',
      label: '入库员',
      type: 'select',
      placeholder: '选择入库员',
      options: operators.value.map(operator => ({
        label: operator.name || operator.username,
        value: operator.id
      }))
    },
    {
      key: 'is_new',
      label: '成色',
      type: 'select',
      placeholder: '选择成色',
      options: [
        { label: '全新', value: true },
        { label: '二手', value: false }
      ]
    },
    {
      key: 'date_range',
      label: '入库日期',
      type: 'daterange',
      placeholder: '选择日期范围'
    }
  ]
})

// ==================== 数据排序辅助函数 ====================

// 品牌排序权重（苹果优先）
const getBrandOrderWeight = (brand: string): number => {
  if (!brand) return 999
  const brandLower = brand.toLowerCase().trim()

  // 苹果品牌优先（包含 Apple、iPhone、iPad 等关键词）
  if (brandLower.includes('apple') || brandLower.includes('iphone') || brandLower.includes('ipad')) {
    return 0
  }

  // 其他品牌按字母顺序
  return 1
}

// 从型号名称中提取系列号（如 iPhone 14 Pro -> 14）
const extractSeriesNumber = (model: string): number => {
  if (!model) return 0
  const match = model.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

// 内存排序权重（转换为统一的数字进行比较）
const getMemoryOrderWeight = (memory: string): number => {
  if (!memory) return 999
  const size = memory.toUpperCase().replace(/[^0-9A-Z]/g, '')

  if (size.includes('TB')) {
    const tb = parseInt(size) || 0
    return tb * 1000
  } else if (size.includes('GB') || size.includes('G')) {
    const gb = parseInt(size) || 0
    return gb
  }

  const num = parseInt(size) || 0
  return num
}

// 对库存数据进行排序
const _sortInventoryData = (data: InventoryItem[]): InventoryItem[] => {
  if (!data || data.length === 0) return []

  const sorted = [...data]

  return sorted.sort((a, b) => {
    const brandA = a.brand_name || a.brand || ''
    const brandB = b.brand_name || b.brand || ''
    const modelA = a.model_name || a.model || ''
    const modelB = b.model_name || b.model || ''
    const memoryA = a.memory || ''
    const memoryB = b.memory || ''
    const colorA = a.color_name || a.color || ''
    const colorB = b.color_name || b.color || ''
    const conditionA = a.is_new === 1 ? '全新' : '二手'
    const conditionB = b.is_new === 1 ? '全新' : '二手'

    // 1. 优先按品牌排序（苹果优先）
    const brandWeightA = getBrandOrderWeight(brandA)
    const brandWeightB = getBrandOrderWeight(brandB)
    if (brandWeightA !== brandWeightB) {
      return brandWeightA - brandWeightB
    }

    // 2. 品牌相同，按机况排序（全新在前，二手在后）
    if (conditionA !== conditionB) {
      return conditionA === '全新' ? -1 : 1
    }

    // 3. 机况相同，按型号系列号从小到大排序
    const seriesA = extractSeriesNumber(modelA)
    const seriesB = extractSeriesNumber(modelB)
    if (seriesA !== seriesB) {
      return seriesA - seriesB
    }

    // 4. 系列号相同，按型号名称排序
    if (modelA !== modelB) {
      return (modelA || '').localeCompare(modelB || '', 'zh-CN')
    }

    // 5. 型号相同，按内存从小到大排序
    const memoryWeightA = getMemoryOrderWeight(memoryA)
    const memoryWeightB = getMemoryOrderWeight(memoryB)
    if (memoryWeightA !== memoryWeightB) {
      return memoryWeightA - memoryWeightB
    }

    // 6. 内存相同，按颜色排序
    if (colorA !== colorB) {
      return (colorA || '').localeCompare(colorB || '', 'zh-CN')
    }

    return 0
  })
}

// 分页
const pagination = reactive({
  page: 1,
  size: 100,
  total: 0
})
let basicDataWarmupTimer: ReturnType<typeof setTimeout> | null = null

// 重置筛选
const resetFilters = () => {

  // 重置筛选条件
  Object.assign(filters, {
    supplier_id: '',
    brand: '',
    model: '',
    color: '',
    memory: '',
    store_id: '',
    status: '',
    date_range: '',
    date_start: '',
    date_end: '',
    search: ''
  })

  // 重置CustomSearch的筛选条件
  Object.assign(searchFilters, {
    supplier_id: '',
    brand: '',
    model: '',
    color: '',
    memory: '',
    store_id: '',
    status: '',
    date_range: '',
    search: ''
  })

  // 恢复型号列表为所有型号（而不是清空）
  brandModels.value = [...models.value]

  pagination.page = 1
  loadInventoryData()

}

// 刷新数据
// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await Promise.all([
      loadInventoryData({}, { showLoadingState: false }),
      fetchBasicData()
    ])
  })
  success('数据刷新成功')
}

const { fetchBasicData, fetchBrandModels, handleBrandChange } = useInventoryBaseOptions({
  refs: {
    suppliers,
    stores,
    operators,
    brands,
    models,
    colors,
    memories,
    brandModels
  },
  filters,
  inventory,
  onLoadInventory: () => loadInventoryData(),
  onStoreLoadError: message => error(message)
})

const {
  debounceLoadInventory,
  loadInventory,
  loadInventoryData
} = useInventoryData({
  inventory,
  filters,
  pagination,
  stats,
  statsAvailable,
  loadingStore,
  onError: message => error(message)
})

// 分页处理
const handlePaginationChange = (pag: { page: number; pageSize: number }) => {
  pagination.page = pag.page
  pagination.size = pag.pageSize
  loadInventoryData()
}

// 查看详情
const viewDetails = (item: InventoryItem) => {
  // 安全检查：确保不是误调用
  if (!item || !item.id) {
    return
  }
  selectedItem.value = item
  showDetailsModal.value = true
}

const toDateInputValue = (dateString?: string | null) => {
  if (!dateString) return null

  const rawValue = String(dateString).trim()
  if (!rawValue) return null

  const directMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) {
    return directMatch[1]
  }

  const normalizedValue = rawValue.replace(' ', 'T')
  const normalizedMatch = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/)
  if (normalizedMatch) {
    return normalizedMatch[1]
  }

  const parsedDate = new Date(rawValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 编辑项目 - 统一使用 watch 填充数据
const editItem = async (item: InventoryItem) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 维修中和租赁中的设备由对应业务模块维护；全局管理员可应急修正。
  if (item.status !== 'in_stock' && !authStore.isAdmin) {
    error('只有在库状态的商品才能编辑')
    return
  }

  // 列表可能来自缓存或旧接口，打开编辑时读取最新规范字段（各类 *_id、IMEI 等）。
  let editItemData: InventoryItem = item
  try {
    const response = await api.get(`/inventory/${item.id}`, {
      useCache: false,
      showError: false
    })
    if (response.success) {
      const detail = extractResponseData<InventoryItem>(response)
      if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        editItemData = { ...item, ...detail }
      }
    }
  } catch (detailError) {
    logger.warn('读取库存详情失败，使用列表数据打开编辑:', detailError)
  }

  // 设置选中的设备并打开弹窗（数据填充通过 watch 自动完成）
  selectedPhoneForEdit.value = editItemData
  showEditModal.value = true
}

// 上架商品成功回调
const handlePublishSuccess = () => {
  ElMessage.success('商品已上架到H5商城')
}

// 从详情模态框触发编辑
const handleEditFromModal = () => {
  if (selectedItem.value) {
    // 关闭详情模态框
    showDetailsModal.value = false
    // 延迟一点再打开编辑模态框，确保动画流畅
    setTimeout(() => {
      editItem(selectedItem.value!)
    }, 100)
  }
}

// 从详情模态框触发删除
const handleDeleteFromModal = () => {
  if (selectedItem.value) {
    // 关闭详情模态框
    showDetailsModal.value = false
    // 延迟一点再执行删除
    setTimeout(() => {
      deleteItem(selectedItem.value!)
    }, 100)
  }
}

// 移动端详情弹窗底部的出库操作。
const handleQuickSaleFromModal = () => {
  if (selectedItem.value) {
    showDetailsModal.value = false
    setTimeout(() => {
      quickSaleItem(selectedItem.value!)
    }, 100)
  }
}

// 监听编辑弹窗打开，填充表单数据（与销售页面保持一致）
watch(showEditModal, async (newVal) => {
  if (newVal && selectedPhoneForEdit.value) {
    const phone = selectedPhoneForEdit.value as any

    // 打印原始数据用于调试

    // 获取入库员姓名
    const _operatorName = phone.inventory_operator_name ||
                         phone.purchase_operator_name ||
                         phone.operator_name ||
                         phone.created_by_name ||
                         authStore.user?.name ||
                         '当前用户'

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
      purchase_cost: phone.purchase_cost === null || phone.purchase_cost === undefined
        ? null
        : Math.round(Number(phone.purchase_cost)),
      supplier_id: phone.supplier_id || null,
      store_id: phone.store_id || null,
      condition: isNewInventoryValue(phone.is_new) ? '全新' : '二手',
      status: normalizePhoneStatus(phone.status) || 'in_stock',
      inventory_time: toDateInputValue(phone.inventory_time),
      remarks: phone.remarks || '',
      is_published: phone.is_published ?? 1  // H5上架状态，默认1（上架）
    })

    // 加载 H5_product 的 is_published 状态
    await loadPhonePublishStatus(phone.id)

    // 检测是否为无IMEI模式
    editIsNoIMEIMode.value = detectEditNoIMEIMode(editForm.imei, editForm.serial_number)

    // 如果选择了品牌，加载对应的型号列表
    if (editForm.brand) {
      await fetchEditBrandModels(editForm.brand)
    }
  }
})

// 检测编辑模式是否为无IMEI模式
const detectEditNoIMEIMode = (imei: string | undefined, serialNumber: string | undefined): boolean => {
  if (!imei) return false

  // 1. IMEI包含字母 → 无IMEI模式
  if (/[a-zA-Z]/.test(imei)) {
    return true
  }

  // 2. IMEI与序列号相同且长度不是15位 → 无IMEI模式
  if (imei === serialNumber && imei.length !== 15) {
    return true
  }

  // 3. IMEI长度不是15位 → 无IMEI模式
  if (imei.length !== 15) {
    return true
  }

  return false
}

// 切换编辑模式的无IMEI状态
const toggleEditNoIMEIMode = () => {
  editIsNoIMEIMode.value = !editIsNoIMEIMode.value

  if (editIsNoIMEIMode.value) {
    // 启用无IMEI模式：如果有序列号，自动填充IMEI
    if (editForm.serial_number) {
      editForm.imei = editForm.serial_number
    }
    ElMessage.success('已启用无IMEI模式，IMEI将支持字母+数字')
  } else {
    // 切换回标准模式：清空IMEI，重新输入15位纯数字
    editForm.imei = ''
    ElMessage.info('已切换回标准IMEI模式，需要输入15位纯数字')
  }
}

// 格式化编辑模式的IMEI
const formatEditIMEI = () => {
  if (editForm.imei) {
    if (editIsNoIMEIMode.value) {
      // 无IMEI模式：允许数字和字母，字母转大写
      editForm.imei = editForm.imei
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 30)
    } else {
      // 标准模式：只允许数字
      editForm.imei = editForm.imei.replace(/\D/g, '').slice(0, 15)
    }
  }
}

// 编辑弹窗的品牌变更处理
const onEditBrandChange = async () => {
  editForm.model = ''
  if (editForm.brand) {
    await fetchEditBrandModels(editForm.brand)
  } else {
    editBrandModels.value = []
  }
}

// 获取编辑弹窗品牌对应的型号列表
const fetchEditBrandModels = async (brandName: string) => {
  if (!brandName) {
    editBrandModels.value = []
    return
  }

  const brandNameStr = String(brandName || '').trim()

  if (!brandNameStr) {
    editBrandModels.value = []
    return
  }

  try {
    // 先找到品牌ID
    const brand = brands.value.find((b: any) => b.name === brandNameStr)
    if (!brand) {
      editBrandModels.value = []
      return
    }

    // 使用品牌ID获取型号列表
    const response = await api.get(`/models?brand_id=${brand.id}&status=1`)
    if (response.success) {
      const modelsData = extractResponseData<any[]>(response)

      editBrandModels.value = modelsData
        .filter((m: any) => m && m.name)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m: any) => String(m.name || '').trim())

    } else {
      editBrandModels.value = []
    }
  } catch (err) {
    logger.error('获取型号列表失败:', err)
    editBrandModels.value = []
  }
}

// 提交编辑
const submitEdit = async () => {
  if (submitting.value) return
  try {
    submitting.value = true

    // 验证必填字段
    // 如果没有IMEI但有序列号，则自动将IMEI设置为序列号（适用于无IMEI的设备如iPad、手表等）
    if (!editForm.imei && editForm.serial_number) {
      editForm.imei = editForm.serial_number
    }

    // 对于手机设备（品牌包含iPhone、小米、华为等），IMEI必须是15位
    // 对于非手机设备（AirPods、iPad等），IMEI可以不是15位
    const isPhoneDevice = /^(iPhone|华为|小米|红米|OPPO|vivo|三星|荣耀|realme|一加|魅族|诺基亚|索尼|LG|摩托罗拉)/i.test(editForm.brand || '')
    if (isPhoneDevice && editForm.imei && editForm.imei.length < 15) {
      error('请输入完整的15位IMEI号')
      return
    }

    // 构建更新数据
    const updateData = {
      ...toCanonicalPhoneUpdatePayload({
        brand_id: editForm.brand_id,
        model_id: editForm.model_id,
        color_id: editForm.color_id,
        memory_id: editForm.memory_id,
        brand: editForm.brand,
        model: editForm.model,
        color: editForm.color,
        memory: editForm.memory,
        serial_number: editForm.serial_number,
        imei: editForm.imei,
        purchase_cost: editForm.purchase_cost,
        supplier_id: editForm.supplier_id,
        store_id: editForm.store_id,
        condition: editForm.condition,
        status: editForm.status || 'in_stock',
        inventory_time: editForm.inventory_time,
        remarks: editForm.remarks
      })
    }


    // 发送更新请求
    const response = await api.put(`/phones/${selectedPhoneForEdit.value.id}`, updateData, { showError: false })

    if (response.success) {
      success('更新成功')
      closeEditModal()
      await refreshInventory()
    } else {
      error(response.message || '更新失败')
    }
  } catch (err: any) {
    logger.error('更新失败:', err)
    const backendMessage = err?.response?.data?.message
    error(typeof backendMessage === 'string' && backendMessage.trim()
      ? backendMessage
      : (err.message || '更新失败，请重试'))
  } finally {
    submitting.value = false
  }
}

// 关闭编辑弹窗
const closeEditModal = () => {
  showEditModal.value = false
  selectedPhoneForEdit.value = null
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
    condition: '',
    status: 'in_stock',
    inventory_time: null,
    remarks: '',
    is_published: 1
  })
}

// 加载商品的上架状态
const loadPhonePublishStatus = async (phoneId: number) => {
  try {
    const response = await api.get(`/phones/${phoneId}/h5-product`)
    if (response.success && response.data) {
      editForm.is_published = response.data.is_published ?? 1
    }
  } catch (error) {
    logger.error('加载上架状态失败:', error)
    // 保持默认值1（上架）
  }
}

// 快速切换上架状态（全新机和二手商品通用）
const handleQuickPublishChange = async (value: number) => {
  if (!selectedPhoneForEdit.value) return

  try {
    // 更新 H5_product 表
    await api.put(`/phones/${selectedPhoneForEdit.value.id}/h5-product`, {
      is_published: value
    })
    const statusText = value === 1 ? '上架' : '下架'
    ElMessage.success(`已${statusText}`)
  } catch (error: any) {
    logger.error('更新上架状态失败:', error)
    ElMessage.error(error.message || '操作失败')
    // 恢复开关状态
    editForm.is_published = editForm.is_published === 1 ? 0 : 1
  }
}

// 关闭详情弹窗
const handleCloseDetails = () => {
  showDetailsModal.value = false
  selectedItem.value = null
}

// 开始入库 - 统一使用弹窗
const handleStartStockIn = () => {
  showStockInModal.value = true
}

const clearStockInRouteFlag = () => {
  if (route.query.openStockIn !== 'true') return

  const query = { ...route.query }
  delete query.openStockIn
  void router.replace({ path: route.path, query })
}

// 综合查询可通过 URL 参数打开入库弹窗。库存页使用 KeepAlive 缓存时，
// 组件不会重新挂载，因此同时在路由变化和重新激活时处理该参数。
const openStockInFromRoute = () => {
  if (String(route.query.openStockIn || '') !== 'true' || !canCreate.value) return
  showStockInModal.value = true
}

watch(
  () => route.query.openStockIn,
  () => openStockInFromRoute()
)

// 入库成功回调
const handleStockInSuccess = () => {
  showStockInModal.value = false
  clearStockInRouteFlag()
  // 刷新库存数据
  refreshInventory()
  success('入库成功！')
}

// 刷新库存数据（用于入库成功后刷新）
const refreshInventory = async () => {
  await loadInventoryData()
}

// 入库取消回调
const handleStockInCancel = () => {
  showStockInModal.value = false
  clearStockInRouteFlag()
}

const quickSaleItem = (item: InventoryItem) => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  if (item.status !== 'in_stock') {
    warning('只有在库商品才能出库')
    return
  }

  window.sessionStorage.setItem(AUTO_OPEN_SALE_PHONE_STORAGE_KEY, JSON.stringify({
    phoneId: String(item.id),
    createdAt: Date.now()
  }))
  logger.info('库存出库跳转销售页:', { phoneId: String(item.id), status: item.status })

  router.push({
    path: '/sales',
    query: {
      sale_phone_id: String(item.id),
      auto_open_sale: '1'
    }
  })
}

// 工具方法
const _getStatusClass = (status: string) => {
  return getPhoneStatusClass(status)
}

const _getStatusText = (status: string) => {
  return getPhoneStatusLabel(status)
}

// 销售状态（综合判断）
const getSaleStatusClass = (item: InventoryItem) => {
  if (item.is_preordered) return 'reserved'
  if (item.status === 'repair') return 'repair'
  if (item.status === 'rented') return 'rented'
  if (item.status === 'sold') return 'sold'
  if (item.status === 'reserved') return 'reserved'
  if (item.status === 'lost') return 'lost'
  return 'in-stock' // 可售
}

const getSaleStatusLabel = (item: InventoryItem) => {
  if (item.is_preordered) return '已预订'
  if (item.status === 'repair') return '维修'
  if (item.status === 'rented') return '租赁'
  if (item.status === 'sold') return '已售'
  if (item.status === 'reserved') return '预定'
  if (item.status === 'lost') return '丢失'
  return '可售'
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '-'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    const matched = String(dateString).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (matched) {
      return `${matched[1]}-${Number(matched[2])}-${Number(matched[3])}`
    }
    return '-'
  }

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

const formatNumber = (num?: number) => {
  return num?.toLocaleString('zh-CN') || '0'
}

const getInventoryDisplayName = (item: InventoryItem) => {
  const parts = [
    canViewField('brand') ? (item.brand || item.brand_name) : '',
    canViewField('model') ? (item.model || item.model_name) : '',
    canViewField('color') ? (item.color || item.color_name) : '',
    canViewField('memory') ? (item.memory || item.memory_name) : ''
  ].filter(Boolean)

  return parts.length ? parts.join(' ') : `商品 #${item.id}`
}

// 获取成色状态的样式类
const getConditionClass = (isNew: boolean | number | string) => {
  // 处理可能的值：boolean(0/1), string('0'/'1'), number(0/1)
  const isNewValue = Number(isNew)
  return isNewValue === 1 ? 'condition-new' : 'condition-used'
}

// 获取成色状态的文本
const getConditionText = (isNew: boolean | number | string) => {
  // 处理可能的值：boolean(0/1), string('0'/'1'), number(0/1)
  const isNewValue = Number(isNew)
  return isNewValue === 1 ? '全新' : '二手'
}



// 删除商品
const deleteItem = async (item: InventoryItem) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const identityParts = [getInventoryDisplayName(item)]

    if (canViewField('imei') && item.imei) {
      identityParts.push(`IMEI: ${item.imei}`)
    } else if (canViewField('serial_number') && item.serial_number) {
      identityParts.push(`序列号: ${item.serial_number}`)
    }

    await ElMessageBox.confirm(
      `确定要删除商品“${identityParts.join('，')}”吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loadingStore.setLoading(true)

    const response = await api.delete(`/inventory/${item.id}`, { showError: false })

    if (response.success) {
      success('商品删除成功')

      // 删除当前页最后一条时回到上一页，避免留在空白页。
      if (inventory.value.length === 1 && pagination.page > 1) {
        pagination.page -= 1
      }

      // 删除后必须绕过 GET 短缓存，否则可能重新显示已删除的旧数据。
      await loadInventoryData({}, { showLoadingState: false, useCache: false })
    } else {
      error(response.message || '删除失败')
    }
  } catch (caughtError: any) {
    if (caughtError !== 'cancel') {
      logger.error('❌ 删除商品失败:', caughtError)

      // 权限相关错误处理
      if (caughtError.response?.status === 403) {
        error('权限不足，无法删除商品')
      } else if (caughtError.response?.status === 401) {
        error('登录已过期，请重新登录')
      } else {
        error(caughtError.response?.data?.message || '删除失败')
      }
    }
  } finally {
    loadingStore.setLoading(false)
  }
}

// 导出库存数据
const exportInventory = async () => {
  await exportFile({
    url: '/inventory/export',
    filename: buildDateFilename('库存数据', 'xlsx'),
    allowed: canExport,
    loading: exporting,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '库存数据导出成功',
    errorMessage: '导出失败',
    onError: (error) => {
      logger.error('导出失败:', error)
      ElMessage.error('导出失败')
    }
  })
}


// GlobalSearch 事件处理方法（增强版 - 智能识别搜索内容）
const _handleGlobalSearch = async (query: string, filterValues: Record<string, any>) => {

  // 清空当前页码，从第1页开始显示结果
  pagination.page = 1

  // 智能分析搜索查询并自动填充筛选条件
  const intelligentFilters = await analyzeSearchQuery(query)

  // 合并筛选条件：用户选择的 + 智能识别的
  Object.assign(filters, filterValues, intelligentFilters)


  // 构建API参数 - 包含所有筛选条件
  const apiParams: any = {
    page: pagination.page,
    page_size: pagination.size
  }

  // 添加品牌筛选
  if (filters.brand && filters.brand.trim()) {
    apiParams.brand = filters.brand.trim()
  }

  // 添加型号筛选
  if (filters.model && filters.model.trim()) {
    apiParams.model = filters.model.trim()
  }

  // 添加颜色筛选
  if (filters.color && filters.color.trim()) {
    apiParams.color = filters.color.trim()
  }

  // 添加内存筛选
  if (filters.memory && filters.memory.trim()) {
    apiParams.memory = filters.memory.trim()
  }

  // 添加店铺筛选
  if (filters.store_id) {
    apiParams.store_id = filters.store_id
  }

  // 添加状态筛选
  if (filters.phone_condition) {
    apiParams.status = filters.phone_condition
  }

  // 如果还有未识别的通用搜索查询，也添加到API参数
  const remainingQuery = getRemainingSearchQuery(query, filters)
  if (remainingQuery && remainingQuery.trim()) {
    apiParams.search = remainingQuery.trim()
  }


  // 执行API调用
  await loadInventoryData(apiParams)
}

// 智能分析搜索查询的函数
const analyzeSearchQuery = async (query: string) => {
  const detectedFilters: Record<string, any> = {}

  if (!query || !query.trim()) {
    return detectedFilters
  }


  // 品牌别名映射表
  const brandAliases: Record<string, string> = {
    '苹果': 'Apple',
    '苹果公司': 'Apple',
    'iphone': 'Apple',
    '华为': 'Huawei',
    '荣耀': 'Honor',
    '小米': 'Xiaomi',
    '米': 'Xiaomi',
    '红米': 'Redmi',
    'oppo': 'OPPO',
    'vivo': 'vivo',
    '步步高': 'vivo',
    '三星': 'Samsung',
    '萨姆': 'Samsung',
    'oneplus': 'OnePlus',
    '一加': 'OnePlus',
    'plus': 'OnePlus',
    '魅族': 'Meizu',
    '美图': 'Meitu',
    '锤子': 'Smartisan',
    '坚果': 'Smartisan',
    '摩托罗拉': 'Motorola',
    ' moto': 'Motorola',
    '联想': 'Lenovo',
    'zuk': 'Lenovo',
    '中兴': 'ZTE',
    '努比亚': 'Nubia',
    '酷派': 'Coolpad',
    '乐视': 'LeEco',
    '360': 'Qiku',
    '奇酷': 'Qiku',
    '谷歌': 'Google',
    'pixel': 'Google',
    'htc': 'HTC',
    'lg': 'LG',
    '索尼': 'Sony',
    '索爱': 'Sony',
    '诺基亚': 'Nokia',
    '微软': 'Microsoft',
    'lumia': 'Microsoft'
  }

  // 颜色别名映射表
  const colorAliases: Record<string, string> = {
    '红': '红色',
    '红红': '红色',
    '蓝': '蓝色',
    '蓝蓝': '蓝色',
    '黑': '黑色',
    '黑黑': '黑色',
    '白': '白色',
    '白白': '白色',
    '金': '金色',
    '黄金': '金色',
    '银': '银色',
    '银色': '银色',
    '灰': '灰色',
    '灰色': '灰色',
    '粉': '粉色',
    '粉红': '粉色',
    '玫瑰金': '粉色',
    '紫': '紫色',
    '绿': '绿色',
    '青': '青色',
    '橙': '橙色',
    '黄': '黄色',
    '棕': '棕色',
    '咖啡色': '棕色',
    '透明': '透明色'
  }

  // 内存规格映射表
  const memoryAliases: Record<string, string> = {
    '128': '128GB',
    '256': '256GB',
    '512': '512GB',
    '1t': '1TB',
    '1tb': '1TB',
    '1000': '1TB',
    '1024': '1TB',
    '2t': '2TB',
    '2tb': '2TB',
    '2000': '2TB',
    '2048': '2TB',
    '64': '64GB',
    '32': '32GB',
    '16': '16GB',
    '8': '8GB',
    '4': '4GB'
  }

  // 分词处理 - 支持中英文混合，按空格和常见分隔符分割
  const searchTerms = query.toLowerCase()
    .split(/[\s，,、]+/)
    .filter(term => term.trim())
    .map(term => term.trim())


  // 逐个分析搜索词
  for (const term of searchTerms) {
    // 检测品牌
    if (!detectedFilters.brand) {
      // 首先检查别名映射
      const mappedBrand = brandAliases[term]
      let matchedBrand = null

      if (mappedBrand) {
        matchedBrand = brands.value.find(brand =>
          (typeof brand === 'string' ? brand : brand.name).toLowerCase() === mappedBrand.toLowerCase()
        )
      } else {
        // 直接匹配品牌列表
        matchedBrand = brands.value.find(brand => {
          const brandName = typeof brand === 'string' ? brand : brand.name
          return brandName.toLowerCase() === term ||
            brandName.toLowerCase().includes(term) ||
            term.includes(brandName.toLowerCase()) ||
            brandName.toLowerCase().replace(/\s+/g, '') === term ||
            term.replace(/\s+/g, '') === brandName.toLowerCase()
        })
      }

      if (matchedBrand) {
        detectedFilters.brand = matchedBrand

        // 如果识别到品牌，提前加载对应型号
        await fetchBrandModels(matchedBrand)
        continue
      }
    }

    // 检测颜色
    if (!detectedFilters.color) {
      // 首先检查别名映射
      const mappedColor = colorAliases[term]
      let matchedColor = null

      if (mappedColor) {
        matchedColor = colors.value.find(color =>
          color.toLowerCase() === mappedColor.toLowerCase()
        )
      } else {
        // 直接匹配颜色列表
        matchedColor = colors.value.find(color =>
          color.toLowerCase() === term ||
          color.toLowerCase().includes(term) ||
          term.includes(color.toLowerCase())
        )
      }

      if (matchedColor) {
        detectedFilters.color = matchedColor
        continue
      }
    }

    // 检测内存
    if (!detectedFilters.memory) {
      // 首先检查别名映射
      const mappedMemory = memoryAliases[term]
      let matchedMemory = null

      if (mappedMemory) {
        matchedMemory = memories.value.find(memory =>
          memory.toLowerCase() === mappedMemory.toLowerCase()
        )
      } else {
        // 直接匹配内存列表，支持多种格式
        matchedMemory = memories.value.find(memory =>
          memory.toLowerCase() === term ||
          memory.toLowerCase().includes(term) ||
          term.includes(memory.toLowerCase()) ||
          (term.includes('gb') && memory.toLowerCase().includes('gb')) ||
          (term.includes('tb') && memory.toLowerCase().includes('tb')) ||
          (memory.includes('GB') && term === memory.replace('GB', '')) ||
          (memory.includes('TB') && term === memory.replace('TB', ''))
        )
      }

      if (matchedMemory) {
        detectedFilters.memory = matchedMemory
        continue
      }
    }

    // 检测型号（在品牌型号列表或全局型号列表中查找）
    if (!detectedFilters.model) {
      const allModels = [...brandModels.value, ...models.value]
      const matchedModel = allModels.find(model => {
        const modelName = typeof model === 'string' ? model : model.name
        return modelName.toLowerCase() === term ||
          modelName.toLowerCase().includes(term) ||
          term.includes(modelName.toLowerCase()) ||
          modelName.toLowerCase().replace(/\s+/g, '') === term ||
          term.replace(/\s+/g, '') === modelName.toLowerCase() ||
          // 支持常见的型号格式变体
          modelName.toLowerCase().replace(/[-\s]/g, '') === term.replace(/[-\s]/g, '') ||
          term.replace(/[-\s]/g, '') === modelName.toLowerCase().replace(/[-\s]/g, '')
      })

      if (matchedModel) {
        detectedFilters.model = matchedModel
        continue
      }
    }
  }

  return detectedFilters
}

// 获取剩余的未识别搜索查询
const getRemainingSearchQuery = (query: string, filters: Record<string, any>) => {
  if (!query || !query.trim()) {
    return ''
  }

  let remainingQuery = query

  // 品牌别名反向映射（用于从识别的品牌找到可能的搜索词）
  const brandReverseAliases: Record<string, string[]> = {
    'Apple': ['苹果', '苹果公司', 'iphone'],
    'Huawei': ['华为'],
    'Honor': ['荣耀'],
    'Xiaomi': ['小米', '米', '红米'],
    'OPPO': ['oppo'],
    'vivo': ['vivo', '步步高'],
    'Samsung': ['三星', '萨姆'],
    'OnePlus': ['oneplus', '一加', 'plus'],
    'Meizu': ['魅族'],
    'Meitu': ['美图'],
    'Smartisan': ['锤子', '坚果'],
    'Motorola': ['摩托罗拉', 'moto'],
    'Lenovo': ['联想', 'zuk'],
    'ZTE': ['中兴'],
    'Nubia': ['努比亚'],
    'Coolpad': ['酷派'],
    'LeEco': ['乐视'],
    'Qiku': ['360', '奇酷'],
    'Google': ['谷歌', 'pixel'],
    'HTC': ['htc'],
    'LG': ['lg'],
    'Sony': ['索尼', '索爱'],
    'Nokia': ['诺基亚'],
    'Microsoft': ['微软', 'lumia']
  }

  // 颜色别名反向映射
  const colorReverseAliases: Record<string, string[]> = {
    '红色': ['红', '红红'],
    '蓝色': ['蓝', '蓝蓝'],
    '黑色': ['黑', '黑黑'],
    '白色': ['白', '白白'],
    '金色': ['金', '黄金'],
    '银色': ['银', '银色'],
    '灰色': ['灰', '灰色'],
    '粉色': ['粉', '粉红', '玫瑰金'],
    '紫色': ['紫'],
    '绿色': ['绿'],
    '青色': ['青'],
    '橙色': ['橙'],
    '黄色': ['黄'],
    '棕色': ['棕', '咖啡色'],
    '透明色': ['透明']
  }

  // 内存别名反向映射
  const memoryReverseAliases: Record<string, string[]> = {
    '128GB': ['128'],
    '256GB': ['256'],
    '512GB': ['512'],
    '1TB': ['1t', '1tb', '1000', '1024'],
    '2TB': ['2t', '2tb', '2000', '2048'],
    '64GB': ['64'],
    '32GB': ['32'],
    '16GB': ['16'],
    '8GB': ['8'],
    '4GB': ['4']
  }

  // 移除已识别的筛选条件（包括别名）
  if (filters.brand) {
    const brandTerms = [filters.brand.toLowerCase()]
    if (brandReverseAliases[filters.brand]) {
      brandTerms.push(...brandReverseAliases[filters.brand])
    }

    for (const term of brandTerms) {
      remainingQuery = remainingQuery.replace(new RegExp(term, 'gi'), '').trim()
    }
  }

  if (filters.model) {
    remainingQuery = remainingQuery.replace(new RegExp(filters.model, 'gi'), '').trim()
  }

  if (filters.color) {
    const colorTerms = [filters.color.toLowerCase()]
    if (colorReverseAliases[filters.color]) {
      colorTerms.push(...colorReverseAliases[filters.color])
    }

    for (const term of colorTerms) {
      remainingQuery = remainingQuery.replace(new RegExp(term, 'gi'), '').trim()
    }
  }

  if (filters.memory) {
    const memoryTerms = [filters.memory.toLowerCase()]
    if (memoryReverseAliases[filters.memory]) {
      memoryTerms.push(...memoryReverseAliases[filters.memory])
    }

    for (const term of memoryTerms) {
      remainingQuery = remainingQuery.replace(new RegExp(term, 'gi'), '').trim()
    }
  }

  // 清理多余的分隔符和空格
  remainingQuery = remainingQuery
    .replace(/[\s，,、]+/g, ' ')
    .trim()

  return remainingQuery
}

// 切换高级搜索显示状态
const _toggleAdvancedSearch = () => {
  // 如果在桌面端，切换桌面端搜索状态
  if (!mobileDetection.isMobile) {
    showDesktopSearch.value = !showDesktopSearch.value
  } else {
    // 移动端切换移动端搜索状态
    showAdvancedSearch.value = !showAdvancedSearch.value
  }
}

const handleGlobalReset = () => {
  // 重置所有筛选条件
  Object.keys(filters).forEach(key => {
    filters[key] = ''
  })

  // 清空品牌型号联动数据
  brandModels.value = []

  // 重置分页并重新加载数据
  pagination.page = 1
  loadInventoryData()
}

// 实时搜索输入处理方法（带防抖）
const _handleSimpleSearchInput = () => {
  // 清除之前的防抖定时器
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  // 设置新的防抖定时器（500ms后执行搜索）
  searchDebounceTimer = setTimeout(async () => {
    await handleSimpleSearch()
  }, 500)
}

// 简化搜索处理方法
const handleSimpleSearch = async () => {
  if (!simpleSearchQuery.value || !simpleSearchQuery.value.trim()) {
    // 如果搜索框为空，重置搜索
    clearSimpleSearch()
    return
  }


  // 清空当前页码，从第1页开始显示结果
  pagination.page = 1

  // 使用智能分析来识别搜索内容
  const intelligentFilters = await analyzeSearchQuery(simpleSearchQuery.value)

  // 如果有识别到的筛选条件，使用筛选搜索；否则使用通用搜索
  if (Object.keys(intelligentFilters).length > 0) {

    // 清空其他筛选条件，只使用智能识别的
    Object.keys(filters).forEach(key => {
      filters[key] = intelligentFilters[key] || ''
    })

    // 构建API参数
    const apiParams: any = {
      page: pagination.page,
      page_size: pagination.size
    }

    // 添加识别的筛选条件
    Object.keys(intelligentFilters).forEach(key => {
      if (intelligentFilters[key]) {
        apiParams[key] = intelligentFilters[key]
      }
    })

    // 获取剩余的未识别搜索查询
    const remainingQuery = getRemainingSearchQuery(simpleSearchQuery.value, intelligentFilters)
    if (remainingQuery && remainingQuery.trim()) {
      apiParams.search = remainingQuery.trim()
    }

    await loadInventoryData(apiParams)
  } else {

    // 通用搜索
    const apiParams = {
      page: pagination.page,
      page_size: pagination.size,
      search: simpleSearchQuery.value.trim()
    }

    await loadInventoryData(apiParams)
  }
}

// 清空简化搜索
const clearSimpleSearch = () => {
  simpleSearchQuery.value = ''

  // 重置所有筛选条件并重新加载数据
  handleGlobalReset()
}

const _handleFilterChange = (key: string, value: any) => {

  // 更新对应的筛选值
  if (key === 'batch') {
    // 批量更新
    Object.assign(filters, value)
  } else {
    filters[key] = value
  }

  // 处理品牌型号联动
  if (key === 'brand' || key === 'brand-changed') {
    const brandValue = key === 'brand-changed' ? value : (value.brand || value)
    filters.model = ''

    // 获取该品牌对应的型号列表
    if (brandValue) {
      fetchBrandModels(brandValue)
    } else {
      brandModels.value = []
    }
  }


  // 如果是移动端，不自动触发搜索，让用户手动点击应用筛选
  if (!mobileDetection.isMobile) {
    // 重置分页并重新加载数据以应用筛选条件
    pagination.page = 1
    loadInventoryData()
  } else {
  }
}

// 移动端筛选方法
const _resetMobileFilters = () => {

  // 重置所有筛选条件
  Object.assign(filters, {
    brand: '',
    model: '',
    color: '',
    memory: '',
    supplier_id: '',
    store_id: '',
    operator_id: '',
    is_new: '',
    date_range: '',
    date_start: '',
    date_end: '',
    search: ''
  })

  // 清空品牌型号联动数据
  brandModels.value = []

  // 重新加载数据
  pagination.page = 1
  loadInventoryData()

  // 关闭高级搜索
  showAdvancedSearch.value = false
}

const _applyMobileFilters = () => {

  // 重置分页并重新加载数据
  pagination.page = 1
  loadInventoryData()

  // 关闭高级搜索
  showAdvancedSearch.value = false
}

const _handleDateRangeChange = () => {
  // 日期变化后自动触发搜索
  pagination.page = 1
  loadInventoryData()
}

const _handleQuickSearch = () => {

  if (!filters.search || !filters.search.trim()) {
    // 如果搜索框为空，重置搜索
    resetFilters()
    return
  }

  // 重置分页
  pagination.page = 1

  // 直接使用搜索词，后端会进行智能识别
  const searchQuery = filters.search.trim()

  // 构建API参数
  const apiParams = {
    page: pagination.page,
    page_size: pagination.size,
    search: searchQuery
  }

  // 添加筛选条件（除了搜索外的其他筛选）
  Object.keys(filters).forEach(key => {
    if (filters[key] && key !== 'search') {
      // 直接传递 date_start 和 date_end，不合并为 date_range
      apiParams[key] = filters[key]
    }
  })

  loadInventoryData(apiParams)
}



// 生命周期
// 确保权限数据已加载
const ensurePermissionsLoaded = async (): Promise<void> => {
  // 如果已有权限数据，直接返回
  if (authStore.user && normalizedInventoryPermissions.value.length > 0) {
    return
  }

  // 可以在这里添加权限加载逻辑
}

onMounted(async () => {
  // 首先确保权限数据已加载
  try {
    await ensurePermissionsLoaded()
  } catch (error) {
    logger.error('初始化权限加载失败:', error)
  }

  // 检查是否有页面访问权限
  if (!canView.value) {
    initialTableLoading.value = false
    return
  }

  // 优先加载库存数据，让用户快速看到列表
  // 基础数据并行加载，不阻塞页面显示
  const initialInventoryLoad = Promise.allSettled([
    loadInventoryData(),
    initFieldPermissions()
  ])

  // 在后台延后加载基础数据，避免和首屏列表抢占请求
  initialInventoryLoad.finally(() => {
    initialTableLoading.value = false
    basicDataWarmupTimer = setTimeout(() => {
      fetchBasicData().then(() => {
        // 初始化型号列表为所有型号
        brandModels.value = [...models.value]
      }).catch(error => {
        logger.error('❌ 基础数据加载失败:', error)
      })
    }, 800)
  })

  // 检查 URL 参数，如果有 openStockIn=true 则自动打开入库模态框
  openStockInFromRoute()

  // 添加窗口大小监听
  window.addEventListener('resize', updateWindowWidth)
})

onActivated(() => {
  openStockInFromRoute()
})

// 清理监听器
onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)

  // 清理所有触摸定时器
  touchTimers.value.forEach(timer => clearTimeout(timer))
  touchTimers.value.clear()
  lastTapTime.value.clear()

  if (basicDataWarmupTimer) {
    clearTimeout(basicDataWarmupTimer)
  }
})

// 添加缺失的方法
const _getConditionTagType = (isNew: number | undefined) => {
  return isNew === 1 ? 'success' : 'warning'
}

const _handleSelect = (item: InventoryItem) => {
  // 安全检查：确保不是误调用
  if (!item || !item.id) {
    return
  }
  selectedItem.value = item
  showDetailsModal.value = true
}
</script>

<style>
.inventory-edit-content {
  padding: 0;
}

.inventory-edit-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.inventory-edit-form-shell {
  background: var(--tf-color-surface-muted);
  border-radius: 12px;
  padding: 20px;
}

.inventory-edit-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

/* 序列号和IMEI行容器 */
.inventory-edit-serial-imei-row {
  grid-column: span 3;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.inventory-edit-price-field {
  grid-column: span 1;
}

.inventory-edit-remarks-field {
  grid-column: span 3;
}

.inventory-edit-price-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inventory-edit-price-input {
  flex: 0 0 132px;
  width: 132px !important;
}

.inventory-edit-publish-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inventory-edit-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 10px;
  padding-top: 2px;
}

.inventory-edit-footer.has-config {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.inventory-edit-footer :deep(.el-button) {
  width: 100%;
  min-height: 46px;
  height: 46px;
  border-radius: 14px;
  font-size: 15px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.inventory-edit-footer :deep(.el-button > span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
}

.inventory-edit-dialog .el-select,
.inventory-edit-dialog .el-date-editor.el-input,
.inventory-edit-dialog .el-date-editor.el-input__wrapper,
.inventory-edit-dialog .el-input-number {
  width: 100% !important;
}

.inventory-edit-dialog .el-select__wrapper,
.inventory-edit-dialog .el-input__wrapper,
.inventory-edit-dialog .el-textarea__inner,
.inventory-edit-dialog .el-input-number .el-input__wrapper {
  min-height: 42px;
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--color-border) inset;
}

.inventory-edit-dialog .el-select__wrapper.is-focused,
.inventory-edit-dialog .el-input__wrapper.is-focus,
.inventory-edit-dialog .el-input-number .el-input__wrapper.is-focus {
  box-shadow: 0 0 0 1px var(--tf-color-violet-600) inset;
}

/* 隐藏入库时间日期选择器的图标 */
.inventory-edit-dialog .el-input__prefix,
.inventory-edit-dialog .el-input__suffix,
.inventory-edit-form-grid .el-date-picker .el-input__prefix,
.inventory-edit-form-grid .el-date-picker .el-input__suffix {
  display: none !important;
}

.inventory-edit-dialog .el-input__prefix-inner,
.inventory-edit-dialog .el-input__suffix-inner {
  display: none !important;
}

.inventory-edit-dialog {
  --dialog-side-gap: 4px;
  --dialog-vertical-gap: 24px;
  --dialog-max-width: calc(100vw - 8px);
  --mobile-dialog-body-padding: 8px 4px 8px;
  --mobile-dialog-footer-padding: 0 4px 4px;
}

.inventory-edit-dialog .el-dialog,
.inventory-detail-dialog .el-dialog {
  margin: auto !important;
  max-width: calc(100vw - 32px) !important;
  overflow: hidden;
}

.inventory-edit-dialog .el-dialog {
  width: min(900px, calc(100vw - 32px)) !important;
  border-radius: 24px !important;
}

.inventory-detail-dialog .el-dialog {
  width: min(800px, calc(100vw - 32px)) !important;
  border-radius: 20px !important;
}

.inventory-edit-dialog .el-dialog__body {
  padding: 28px !important;
  background: var(--color-bg-white) !important;
}

.inventory-edit-dialog .el-dialog__footer {
  padding: 18px 28px 28px !important;
  background: var(--color-bg-white) !important;
  border-top: 1px solid rgba(15, 23, 42, 0.06) !important;
}

.inventory-detail-dialog .el-dialog__body,
.inventory-detail-dialog .el-dialog__footer {
  padding: 0 !important;
  background: var(--color-bg-white) !important;
}

@media (max-width: 768px) {
  .inventory-edit-dialog .el-dialog,
  .inventory-detail-dialog .el-dialog {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    border-radius: 18px !important;
  }

  .mobile-dialog-sheet-overlay.inventory-edit-dialog {
    padding: 8px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-header {
    min-height: calc(66px + env(safe-area-inset-top)) !important;
    padding: calc(10px + env(safe-area-inset-top)) 52px 10px 16px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-title {
    font-size: 16px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-close {
    top: calc(10px + env(safe-area-inset-top)) !important;
    right: 14px !important;
    transform: none !important;
  }

  .inventory-edit-dialog .el-dialog__body {
    padding: 8px 4px !important;
  }

  .inventory-edit-dialog .el-dialog__footer {
    padding: 0 4px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-body {
    padding: 8px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-footer {
    padding: 0 4px 4px !important;
  }

  .inventory-edit-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .inventory-edit-form-shell {
    padding: 12px 10px;
    border-radius: 12px;
  }

  .inventory-edit-form-grid {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 0.92fr) minmax(118px, 1.16fr);
    gap: 10px;
  }

  .inventory-edit-serial-imei-row {
    grid-column: span 3;
  }

  .inventory-edit-price-field {
    grid-column: span 1;
  }

  .inventory-edit-remarks-field {
    grid-column: span 3;
  }

  .inventory-edit-price-input {
    flex: 0 0 82px;
    width: 82px !important;
  }

  .inventory-edit-price-row {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .inventory-edit-publish-actions {
    flex: 0 0 auto;
    min-width: fit-content;
    flex-shrink: 0;
    justify-content: flex-start;
  }

  .inventory-edit-footer {
    gap: 8px;
  }

  .inventory-edit-footer .el-button {
    width: 100%;
    min-width: 0;
    padding-inline: 10px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .inventory-edit-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .inventory-edit-form-shell {
    padding: 10px 8px;
  }

  .inventory-edit-form-grid {
    grid-template-columns: minmax(0, 0.88fr) minmax(0, 0.88fr) minmax(112px, 1.24fr);
  }

  .inventory-edit-price-input {
    flex: 0 0 74px;
    width: 74px !important;
  }
}

@media (max-width: 480px) {
  .inventory-edit-dialog {
    --dialog-vertical-gap: 24px;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-header {
    min-height: calc(62px + env(safe-area-inset-top)) !important;
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-close {
    top: calc(8px + env(safe-area-inset-top)) !important;
    right: 14px !important;
  }

  /* 手机端：保持3列布局，但序列号和IMEI占据2列 */
  .inventory-edit-form-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  /* 序列号和IMEI行占据3列，内部分成两个字段 */
  .inventory-edit-serial-imei-row {
    grid-column: span 3;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .inventory-edit-price-field {
    grid-column: span 1;
  }

  .inventory-edit-remarks-field {
    grid-column: span 3;
  }
}

@media (max-width: 390px) and (min-height: 800px) {
  .inventory-detail-dialog .el-dialog {
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
  }
}
</style>

<style scoped>
.inventory-view {
  padding: 24px;
  background: var(--admin-page-bg);
  min-height: 100vh;
}

/* 模态框头部 */
.inventory-modal-header {
  background: var(--tf-button-primary-bg);
  color: var(--tf-button-primary-color);
  padding: 0;
}

.modal-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.modal-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.modal-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: white;
}

.modal-subtitle {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 400;
}

.modal-close-btn {
  background: var(--tf-button-overlay-bg);
  border: none;
  color: var(--tf-button-on-color);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
}

.modal-close-btn:hover {
  background: var(--tf-button-overlay-hover-bg);
  transform: scale(1.1);
}

/* 模态框内容 */
.inventory-modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.details-container {
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 详情卡片 */
.detail-card {
  background: var(--admin-table-panel-bg);
  border-radius: var(--admin-panel-radius);
  border: 1px solid var(--admin-table-panel-border);
  overflow: hidden;
  transition: all 0.2s ease;
}

.detail-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.card-header {
  background: var(--admin-stat-card-bg);
  padding: 16px 20px;
  border-bottom: 1px solid var(--admin-table-panel-border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-icon {
  width: 36px;
  height: 36px;
  background: var(--tf-button-primary-bg);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tf-button-primary-color);
  font-size: 14px;
}

.card-icon.price-icon {
  background: var(--tf-button-success-bg);
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--admin-section-title-color);
}

.card-content {
  padding: 20px;
}

/* 信息表格 */
.info-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--admin-data-table-bg);
  border: 1px solid var(--admin-data-table-container-border);
}

.table-row {
  display: flex;
  border-bottom: 1px solid var(--admin-data-table-cell-border);
}

.table-row:last-child {
  border-bottom: none;
}

.table-row.full-width-row {
  background: var(--admin-table-panel-bg);
}

.table-cell {
  flex: 1;
  padding: 12px 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
  min-height: 48px;
}

.label-cell {
  font-weight: 600;
  color: var(--admin-data-table-cell-color);
  background: var(--admin-table-panel-bg);
  border-right: 1px solid var(--admin-data-table-cell-border);
  min-width: 120px;
  max-width: 120px;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.value-cell {
  color: var(--admin-data-table-cell-color);
  font-weight: 500;
  background: var(--admin-data-table-bg);
  word-break: break-word;
}

.value-cell.price-cell {
  color: var(--tf-button-success-soft-color);
  font-weight: 700;
  font-size: 16px;
}

.full-width-row .label-cell {
  background: var(--tf-button-neutral-hover-bg);
}

.full-width-row .value-cell {
  background: var(--admin-table-panel-bg);
}

/* 保留原来的网格样式作为备用 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--admin-record-count-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 14px;
  color: var(--admin-data-table-cell-color);
  font-weight: 500;
}

/* 价格显示 */
.price-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--admin-data-table-bg);
  border-radius: 8px;
  border: 1px solid var(--admin-data-table-container-border);
}

.price-label {
  font-size: 14px;
  color: var(--admin-record-count-color);
  font-weight: 500;
}

.price-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--tf-button-success-soft-color);
}

/* 备注卡片 */
.remarks-card .card-content {
  padding: 16px 20px;
}

.remarks-text {
  background: var(--admin-data-table-bg);
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid var(--tf-button-primary-border);
  font-size: 14px;
  line-height: 1.6;
  color: var(--admin-data-table-cell-color);
  font-style: italic;
}

/* 模态框底部 */
.inventory-modal-footer {
  background: var(--admin-table-panel-bg);
  border-top: 1px solid var(--admin-table-panel-border);
  padding: 20px 32px;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-header-content {
    padding: 20px 24px;
  }

  .modal-title {
    font-size: 20px;
  }

  .modal-icon {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .details-container {
    padding: 20px 24px;
    gap: 16px;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  /* 移动端表格样式 */
  .info-table {
    border-radius: 6px;
  }

  .table-row {
    flex-direction: column;
    border-bottom: none;
    background: var(--admin-data-table-bg);
    margin-bottom: 8px;
    border-radius: 6px;
    border: 1px solid var(--admin-data-table-container-border);
  }

  .table-row:last-child {
    margin-bottom: 0;
  }

  .table-row.full-width-row {
    background: var(--admin-data-table-bg);
  }

  .table-cell {
    padding: 10px 12px;
    min-height: auto;
    border-bottom: 1px solid var(--admin-data-table-cell-border);
  }

  .table-cell:last-child {
    border-bottom: none;
  }

  .label-cell {
    background: var(--admin-table-panel-bg);
    border-right: none;
    min-width: auto;
    max-width: none;
    font-size: 11px;
  }

  .value-cell {
    background: var(--admin-data-table-bg);
  }

  .full-width-row .label-cell,
  .full-width-row .value-cell {
    background: var(--admin-data-table-bg);
  }

  .card-header {
    padding: 14px 16px;
  }

  .card-content {
    padding: 16px;
  }

  .inventory-modal-footer {
    padding: 16px 24px;
  }

  .footer-actions {
    flex-direction: row;
    gap: 8px;
  }

}

.user-info-section {
  margin-right: 16px;
}

.stat-icon.in-stock {
  background: var(--tf-button-success-bg);
}

.stat-icon.sold {
  background: var(--tf-button-danger-bg);
}

/* 为每个统计卡片设置不同的图标颜色和顶部边框 */
.stat-card:nth-child(1) {
  --card-accent: var(--tf-button-primary-bg);
}

.stat-card:nth-child(1) .stat-icon {
  background: var(--tf-button-primary-bg);
}

.stat-card:nth-child(2) {
  --card-accent: var(--tf-button-success-bg);
}

.stat-card:nth-child(2) .stat-icon {
  background: var(--tf-button-success-bg);
}

.stat-card:nth-child(3) {
  --card-accent: var(--tf-button-warning-bg);
}

.stat-card:nth-child(3) .stat-icon {
  background: var(--tf-button-warning-bg);
}

.stat-card:nth-child(4) {
  --card-accent: var(--tf-button-transfer-bg);
}

.stat-card:nth-child(4) .stat-icon {
  background: var(--tf-button-transfer-bg);
}

/* 基础表单组样式 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--admin-record-count-color);
  font-size: 14px;
  z-index: 1;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--tf-button-neutral-border);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: var(--tf-button-neutral-hover-bg);
}

.form-control:focus {
  outline: none;
  border-color: var(--tf-button-primary-border);
  background: var(--tf-button-neutral-bg);
  box-shadow: 0 0 0 3px var(--tf-button-primary-soft-bg);
}

.form-actions {
  display: flex;
  gap: 12px;
  grid-column: 1 / -1;
}

.imei {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: inherit;
  font-weight: 600;
  color: var(--admin-data-table-cell-color);
  letter-spacing: 0;
  background: transparent;
  padding: 0;
  border: 0;
  border-radius: 0;
  display: inline;
  min-width: 0;
  text-align: center;
}

.imei:hover {
  background: transparent;
  transform: none;
}

/* 成色状态样式 */
.condition-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.condition-new {
  background-color: var(--tf-button-success-soft-bg);
  color: var(--tf-button-success-soft-color);
  border: 1px solid var(--tf-button-success-soft-border);
}

.condition-used {
  background-color: var(--tf-button-warning-soft-bg);
  color: var(--tf-button-warning-soft-color);
  border: 1px solid var(--tf-button-warning-soft-border);
}

/* 状态样式 - 参考综合查询页面 */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.status-badge.in-stock {
  background: var(--tf-status-sale-available-bg);
  color: var(--tf-status-sale-available-color);
  border-color: var(--tf-status-sale-available-border);
}

.status-badge.sold {
  background: var(--tf-status-sold-bg);
  color: var(--tf-status-sold-color);
  border-color: var(--tf-status-sold-border);
}

.status-badge.reserved {
  background: var(--tf-status-reserved-bg);
  color: var(--tf-status-reserved-color);
  border-color: var(--tf-status-reserved-border);
}

.status-badge.repair {
  background: var(--tf-status-repair-bg);
  color: var(--tf-status-repair-color);
  border-color: var(--tf-status-repair-border);
}

.status-badge.rented {
  background: var(--tf-status-rented-bg);
  color: var(--tf-status-rented-color);
  border-color: var(--tf-status-rented-border);
}

.status-badge.lost {
  background: var(--tf-status-lost-bg);
  color: var(--tf-status-lost-color);
  border-color: var(--tf-status-lost-border);
}

/* 价格样式 */
.price {
  font-weight: 600;
  color: var(--admin-data-table-cell-color);
}

.price.positive {
  color: var(--tf-button-success-soft-color);
}

.price.negative {
  color: var(--tf-button-danger-soft-color);
}

/* ===== 权限加载中样式 ===== */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: var(--admin-table-panel-bg);
  border-radius: var(--admin-panel-radius);
  margin: 20px 0;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--tf-button-disabled-bg);
  border-top: 4px solid var(--tf-button-primary-bg);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 权限禁用样式 */
.permission-disabled {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--tf-button-disabled-bg);
  border: 1px solid var(--tf-button-disabled-border);
  border-radius: 6px;
  color: var(--tf-button-disabled-color);
  cursor: not-allowed;
  font-size: 14px;
}

.permission-disabled:hover {
  background: var(--tf-button-neutral-hover-bg);
  border-color: var(--tf-button-neutral-border);
}

/* 空状态样式 */
.empty-state {
  text-align: center;
  color: var(--admin-record-count-color);
  padding: 60px 20px;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
}

/* 分页样式 */
.pagination-wrapper {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 6px 0;
}

.text-center {
  text-align: center;
}

.py-8 {
  padding: 32px 0;
}

.dialog-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* 可编辑下拉框样式 */
.editable-select {
  position: relative;
  width: 100%;
}

.editable-select .form-control {
  padding-right: 60px;
}

.clear-icon {
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--tf-color-muted);
  cursor: pointer;
  font-size: 12px;
  z-index: 2;
}

.clear-icon:hover {
  color: var(--danger-color);
}

.dropdown-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--tf-color-muted);
  cursor: pointer;
  font-size: 12px;
  z-index: 2;
}

.dropdown-icon:hover {
  color: var(--tf-color-gray-bootstrap-700);
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--tf-color-border-subtle);
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  list-style: none;
  margin: 0;
  padding: 0;
}

.dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--tf-color-surface-muted);
  font-size: 14px;
  color: var(--tf-color-gray-bootstrap-700);
  transition: all 0.2s ease;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover,
.dropdown-item.highlighted {
  background: var(--tf-color-indigo-brand);
  color: white;
}

.dropdown-item.new-item {
  background: var(--tf-color-surface-muted);
  color: var(--tf-color-indigo-brand);
  font-weight: 500;
}

.dropdown-item.new-item:hover {
  background: var(--tf-color-blue-pale);
}

.dropdown-item i {
  margin-right: 6px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .inventory-view {
    padding: 4px 0;
  }

  .header-content {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .header-left {
    flex: 1;
    min-width: 120px;
  }

  .form-actions {
    flex-direction: column;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .loading-container {
    margin: 10px;
    min-height: 50vh;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    margin-bottom: 16px;
  }
}

/* ===== 移动端卡片样式 ===== */
.mobile-cards-container {
  padding: 0;
}

.mobile-empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--admin-record-count-color);

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-text {
    margin: 0;
    font-size: 16px;
  }
}

.inventory-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.inventory-card {
  background: var(--admin-data-table-bg);
  border-radius: 12px;
  box-shadow: var(--admin-stat-card-shadow);
  border: 1px solid var(--admin-table-panel-border);
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--admin-stat-card-hover-shadow);
  }

  .card-header {
    background: var(--admin-table-panel-bg);
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--admin-table-panel-border);

    .phone-info {
      flex: 1;

      .brand-model {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .brand {
          font-weight: 700;
          font-size: 16px;
          color: var(--tf-button-primary-soft-color);
        }

        .model {
          font-weight: 600;
          font-size: 14px;
          color: var(--admin-data-table-cell-color);
        }
      }
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }
  }

  .card-content {
    padding: 16px;

    .info-row {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      align-items: flex-start;

      &:last-child {
        margin-bottom: 0;
      }

      .info-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;

        &.full-width {
          flex: 1 1 100%;
        }

        .info-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--admin-record-count-color);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: var(--admin-data-table-cell-color);
          word-break: break-all;

          &.price {
            color: var(--tf-button-success-soft-color);
            font-weight: 600;
            font-size: 16px;
          }

          &.serial-number,
          &.imei {
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
            font-size: 12px;
            background: var(--admin-table-panel-bg);
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--admin-table-panel-border);
          }
        }
      }
    }
  }
}

/* 卡片进入动画 */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 移动端卡片动画 */
.inventory-card {
  animation: slideInUp 0.5s ease-out;

  &:nth-child(2) {
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    animation-delay: 0.2s;
  }

  &:nth-child(4) {
    animation-delay: 0.3s;
  }

  &:nth-child(5) {
    animation-delay: 0.4s;
  }
}

</style>
/* ===== 手机端卡片网格布局 ===== */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  /* 仅在移动端确保占据全宽 */
  .grid-container {
    width: 100vw;
    margin-left: calc(-50vw + 50%);
    margin-right: calc(-50vw + 50%);
    padding-left: 16px;
    padding-right: 16px;
    box-sizing: border-box;
  }
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .grid-container {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
    padding-left: 12px;
    padding-right: 12px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .grid-container {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    padding-left: 8px;
    padding-right: 8px;
  }
}

.device-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  border-color: #28a745;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-card {
    padding: 12px;
    gap: 8px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .device-card {
    padding: 10px;
    gap: 6px;
    border-radius: 8px;
  }
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.device-header .device-brand {
  font-weight: 600;
  font-size: 16px;
  color: #2c3e50;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-header .device-model {
  font-weight: 500;
  font-size: 14px;
  color: #6c757d;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-header .device-brand {
    font-size: 14px;
  }

  .device-header .device-model {
    font-size: 12px;
  }
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.device-info .info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.device-info .info-row .label {
  color: #6c757d;
  font-weight: 500;
  min-width: 60px;
  flex-shrink: 0;
}

.device-info .info-row .value {
  color: #495057;
  font-weight: 500;
  text-align: right;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-info .info-row .value.price {
  color: #28a745;
  font-weight: 600;
}

.device-info .info-row .value.remark {
  font-size: 12px;
  color: #6c757d;
  text-align: left;
  line-height: 1.4;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-info .info-row {
    font-size: 12px;
  }

  .device-info .info-row .label {
    min-width: 50px;
    font-size: 11px;
  }

  .device-info .info-row .value {
    font-size: 11px;
  }

  .device-info .info-row .value.remark {
    font-size: 10px;
  }
}

.device-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  margin-top: auto;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-actions {
    gap: 6px;
    padding-top: 6px;
  }
}

.mobile-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.mobile-empty-state .empty-icon {
  font-size: 48px;
  color: #6c757d;
  margin-bottom: 16px;
}

.mobile-empty-state .empty-text {
  font-size: 16px;
  color: #6c757d;
  margin: 0;
}

/* 桌面端分页样式优化 */
.pagination-wrapper {
  padding: 20px 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 6px 0;
  margin-top: 8px;
}

/* iPhone SE (390x844) 适配 - 最低适配尺寸 */
@media (max-width: 390px) and (min-height: 800px) {
  .modal-header-content {
    padding: 12px 16px;
    background: var(--tf-button-primary-bg);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .modal-title-group {
    padding-right: 45px;
  }

  .modal-title {
    font-size: 18px;
    line-height: 1.3;
  }

  .modal-subtitle {
    font-size: 12px;
    margin-top: 2px;
  }

  .modal-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    top: 50%;
    transform: translateY(-50%);
  }

  .details-container {
    padding: 12px 16px;
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .detail-card {
    margin-bottom: 16px;
    border-radius: 8px;
  }

  .card-header {
    padding: 10px 12px;
  }

  .card-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .card-title {
    font-size: 14px;
  }

  .card-content {
    padding: 12px;
  }

  .info-table {
    font-size: 13px;
  }

  .table-cell {
    padding: 8px 12px;
    min-height: 36px;
    font-size: 13px;
  }

  .table-cell.label-cell {
    font-size: 11px;
    min-width: 80px;
    max-width: 80px;
  }

  .inventory-modal-footer {
    padding: 12px 16px;
    position: sticky;
    bottom: 0;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
  }

  .footer-actions {
    gap: 10px;
  }

}

/* 编辑弹窗样式已使用内联样式，此处保留旧样式以备后用 */

/* ===== 移动端适配 ===== */

/* 小屏手机优化 (≤480px) */
@media (max-width: 480px) {
  .inventory-view {
    padding: 4px 0;
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }

  body,
  html {
    overflow-x: hidden;
    width: 100%;
  }

  /* 分页 */
  .pagination-wrapper {
    flex-wrap: wrap;
    justify-content: center;
  }

  .pagination button,
  .pagination select {
    font-size: 12px;
    padding: 6px 10px;
  }

  /* 移动端数据行可点击样式 */
  .data-row {
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .data-row:active {
    background-color: #f0f0f0;
  }

  .inventory-modal-header {
    padding: 16px;
  }

  .modal-title {
    font-size: 18px;
  }

  .modal-subtitle {
    font-size: 14px;
  }

  .inventory-modal-body {
    padding: 16px;
    max-height: calc(90vh - 140px);
    overflow-y: auto;
  }

  .detail-card {
    margin-bottom: 12px;
  }

  .card-header {
    padding: 12px;
  }

  .card-content {
    padding: 12px;
  }

  .info-table {
    font-size: 13px;
  }

  .table-cell {
    padding: 8px 6px;
    font-size: 12px;
  }

  .table-cell.label-cell {
    font-size: 11px;
    min-width: 70px;
    max-width: 70px;
  }

  .footer-actions {
    flex-direction: column;
    gap: 8px;
  }

}

/* 第二个480px断点 - 全局滚动和触摸优化 */
@media (max-width: 480px) {
  * {
    -webkit-overflow-scrolling: touch !important;
  }

  body {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    position: fixed !important;
    touch-action: pan-y pinch-zoom !important;
  }

  html {
    overflow-x: hidden !important;
    width: 100% !important;
    position: fixed !important;
  }

  #app {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
    height: 100vh !important;
    position: relative !important;
  }

  .inventory-view {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    position: relative !important;
  }

  /* 按钮文字显示控制 */
  .btn-text-desktop {
    display: none !important;
  }

  .btn-text-mobile {
    display: inline !important;
  }
}

/* 超小屏幕优化（375px及以下 - iPhone SE） */
@media (max-width: 375px) {
  .inventory-view {
    padding: 4px 0;
  }

  .header-actions .el-button span {
    font-size: 9px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
    flex-shrink: 0;
  }

  /* 分页组件优化 */
  .pagination-wrapper {
    padding: 10px;
  }
}

/* ===== 商品详情模态框移动端优化 ===== */
@media (max-width: 767px) {
  .modal-header-content {
    padding: 14px 16px;
    position: sticky;
    top: 0;
    background: var(--tf-button-primary-bg);
    z-index: 10;
    border-radius: 16px 16px 0 0;
  }

  .modal-title-group {
    gap: 10px;
  }

  .modal-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .modal-title {
    font-size: 16px;
  }

  .modal-subtitle {
    font-size: 12px;
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .inventory-modal-body {
    padding: 0;
    max-height: calc(90vh - 120px);
  }

  .details-container {
    padding: 14px 16px;
    gap: 14px;
  }

  /* 详情卡片优化 */
  .detail-card {
    border-radius: 10px;
    overflow: hidden;
  }

  .card-header {
    padding: 12px 14px;
  }

  .card-icon {
    width: 28px;
    height: 28px;
    font-size: 13px;
  }

  .card-title {
    font-size: 14px;
  }

  .card-content {
    padding: 12px;
  }

  /* 信息表格优化 */
  .info-table {
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .table-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    background: transparent;
    border: none;
    margin-bottom: 0;
  }

  .table-row:last-child {
    margin-bottom: 0;
  }

  .table-row.full-width-row {
    flex-wrap: nowrap;
  }

  /* 每个label-cell和value-cell组合成一个字段单元 */
  .table-cell {
    width: 50%;
    padding: 10px;
    min-height: auto;
    box-sizing: border-box;
  }

  /* 重新组织:每两个单元格组成一个完整字段 */
  .table-cell.label-cell {
    width: 35%;
    padding-right: 4px;
    text-align: left;
    font-weight: 600;
    color: #64748b;
    font-size: 11px;
    display: flex;
    align-items: center;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    border-left: 1px solid #e2e8f0;
  }

  .table-cell.value-cell {
    width: 15%;
    padding-left: 4px;
    text-align: left;
    font-weight: 500;
    color: #1e293b;
    font-size: 11px;
    word-break: break-word;
    display: flex;
    align-items: center;
    background: white;
    border-top: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
  }

  /* 调整边框,让每两个字段形成一行 */
  .table-cell:nth-child(4n+1),
  .table-cell:nth-child(4n+2) {
    border-bottom: 1px solid #e2e8f0;
  }

  .table-cell:nth-child(4n+2),
  .table-cell:nth-child(4n+4) {
    border-right: none;
  }

  /* 全宽行的特殊处理 */
  .table-row.full-width-row .table-cell {
    width: 50%;
  }

  .table-row.full-width-row .table-cell:first-child {
    border-left: 1px solid #e2e8f0;
  }

  .table-row.full-width-row .table-cell:last-child {
    border-right: none;
    background: white;
  }

  /* 机况徽章 */
  .condition-badge {
    font-size: 11px;
    padding: 3px 8px;
  }

  /* 价格单元格 */
  .price-cell {
    font-size: 14px;
  }

  /* 备注卡片 */
  .remarks-card .remarks-text {
    font-size: 13px;
    line-height: 1.5;
  }

  /* 底部操作栏 */
  .inventory-modal-footer {
    padding: 12px 16px;
    position: sticky;
    bottom: 0;
    background: white;
    border-top: 1px solid #e2e8f0;
    z-index: 10;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .modal-header-content {
    padding: 12px 14px;
  }

  .modal-title {
    font-size: 15px;
  }

  .modal-subtitle {
    font-size: 11px;
  }

  .modal-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .details-container {
    padding: 12px 14px;
    gap: 12px;
  }

  .card-header {
    padding: 10px 12px;
  }

  .card-icon {
    width: 26px;
    height: 26px;
    font-size: 12px;
  }

  .card-title {
    font-size: 13px;
  }

  .card-content {
    padding: 10px;
  }

  /* 超小屏幕改为单列显示 */
  .table-cell {
    width: 100%;
    border-right: none;
    padding: 8px 10px;
    min-height: 40px;
  }

  .table-cell.label-cell {
    font-size: 10px;
    min-width: 45px;
  }

  .table-cell.value-cell {
    font-size: 11px;
  }

  .condition-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  .price-cell {
    font-size: 13px;
  }

}
