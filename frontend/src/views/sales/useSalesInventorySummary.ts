import { computed, ref } from 'vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { sortInventorySummary } from './sales-sort'
import type { InventoryDetailItem, InventorySummaryItem, SalesFilters } from './types'

interface UseSalesInventorySummaryOptions {
  filters: SalesFilters
  canViewField: (_fieldName: string) => boolean
  showSearchKeyword: () => boolean
  isSummaryView: () => boolean
  showError: (_message: string) => void
}

export const useSalesInventorySummary = ({
  filters,
  canViewField,
  showSearchKeyword,
  isSummaryView,
  showError
}: UseSalesInventorySummaryOptions) => {
  const inventorySummary = ref<InventorySummaryItem[]>([])
  const inventorySummaryLoading = ref(false)
  const inventoryDetailModal = ref(false)
  const inventoryDetailData = ref<InventoryDetailItem[]>([])
  const inventoryDetailLoading = ref(false)
  const sortedInventorySummary = computed(() => sortInventorySummary(inventorySummary.value))
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const loadInventorySummary = async () => {
    inventorySummaryLoading.value = true
    try {
      const params: Record<string, string> = {}
      if (canViewField('supplier_name') && filters.supplier_id) params.supplier_id = filters.supplier_id
      if (canViewField('store_name') && filters.store_id) params.store_id = filters.store_id
      if (canViewField('brand') && filters.brand) params.brand = filters.brand
      if (showSearchKeyword() && filters.search) params.model = filters.search
      if (canViewField('model') && filters.model) params.model = filters.model
      if (canViewField('color') && filters.color) params.color = filters.color
      if (canViewField('memory') && filters.memory) params.memory = filters.memory
      if (canViewField('condition') && filters.is_new !== '') params.is_new = filters.is_new
      if (canViewField('inventory_time') && filters.start_date) params.start_date = filters.start_date
      if (canViewField('inventory_time') && filters.end_date) params.end_date = filters.end_date

      const response = await api.get<InventorySummaryItem[]>('/sales/inventory-summary', { params })
      inventorySummary.value = response.success && Array.isArray(response.data)
        ? response.data
        : []
    } catch (error) {
      logger.error('加载库存统计失败:', error)
      showError('加载库存统计失败')
      inventorySummary.value = []
    } finally {
      inventorySummaryLoading.value = false
    }
  }

  const debounceLoadInventorySummary = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      if (isSummaryView()) {
        void loadInventorySummary()
      }
    }, 300)
  }

  const showInventoryDetail = async (item: InventorySummaryItem) => {
    if (!item.brand) {
      logger.error('库存明细缺少必需字段:', { item, missingFields: ['brand'] })
      showError('数据不完整，缺少字段: brand')
      return
    }

    inventoryDetailModal.value = true
    inventoryDetailLoading.value = true
    inventoryDetailData.value = []

    try {
      const params: Record<string, string | number | undefined> = {
        supplier_id: item.supplier_id,
        store_id: item.store_id,
        brand: item.brand,
        model: item.model || '',
        color: item.color || '',
        memory: item.memory || '',
        condition: item.condition || '',
        page_size: 500
      }

      const response = await api.get<InventoryDetailItem[]>('/sales/inventory-detail', { params })
      if (response.success && Array.isArray(response.data)) {
        inventoryDetailData.value = response.data
      }
    } catch (error) {
      logger.error('加载库存明细失败:', error)
      showError('加载库存明细失败')
    } finally {
      inventoryDetailLoading.value = false
    }
  }

  const closeInventoryDetailModal = () => {
    inventoryDetailModal.value = false
    inventoryDetailData.value = []
  }

  const disposeInventorySummary = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  return {
    inventorySummary,
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
  }
}
