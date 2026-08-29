import type { Ref } from 'vue'
import { DEFAULT_CACHE_TTL, useCachedRequest } from '@/composables/usePageCache'
import { extractResponseData } from '@/utils/api-response'
import { getOptionLabel, sortOptionsByOrder } from '@/utils/option-sort'
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import type { InventoryItem } from '@/types'

type NamedOption = { id: number; name?: string; username?: string; sort_order?: number }
type ModelOption = { id: number; name: string; sort_order?: number }

interface InventoryFilters {
  brand: string
  model: string
}

interface InventoryBaseOptionRefs {
  suppliers: Ref<NamedOption[]>
  stores: Ref<NamedOption[]>
  operators: Ref<NamedOption[]>
  brands: Ref<Array<{ id: number; name: string; sort_order?: number }>>
  models: Ref<ModelOption[]>
  colors: Ref<string[]>
  memories: Ref<string[]>
  brandModels: Ref<ModelOption[]>
}

interface UseInventoryBaseOptionsOptions {
  refs: InventoryBaseOptionRefs
  filters: InventoryFilters
  inventory: Ref<InventoryItem[]>
  onLoadInventory: () => void | Promise<void>
  onStoreLoadError?: (message: string) => void
}

const CACHE_KEYS = {
  stores: '/stores:all',
  suppliers: '/suppliers:all',
  brands: '/brands:all',
  models: '/models:all',
  colors: '/colors:all',
  memories: '/memories:all',
  operators: '/operators:all'
}

export const useInventoryBaseOptions = ({
  refs,
  filters,
  inventory,
  onLoadInventory,
  onStoreLoadError
}: UseInventoryBaseOptionsOptions) => {
  const {
    suppliers,
    stores,
    operators,
    brands,
    models,
    colors,
    memories,
    brandModels
  } = refs

  const loadStores = async () => {
    try {
      const response = await useCachedRequest(CACHE_KEYS.stores, () =>
        api.get('/stores?all=true'), DEFAULT_CACHE_TTL.STATIC)
      if (response.success) {
        const storesArray = Array.isArray(response.data)
          ? response.data
          : (response.data?.stores || response.data?.data || [])
        stores.value = sortOptionsByOrder(storesArray)
      }
    } catch (error) {
      logger.error('加载门店列表失败:', error)
      stores.value = []
      onStoreLoadError?.('门店列表加载失败，请刷新后重试')
    }
  }

  const loadSuppliers = async () => {
    try {
      const response = await useCachedRequest(CACHE_KEYS.suppliers, () =>
        api.get('/suppliers?page=1&page_size=1000'), DEFAULT_CACHE_TTL.STATIC)
      if (response.success) {
        const suppliersArray = response.data?.data || response.data || []
        suppliers.value = sortOptionsByOrder(suppliersArray)
      }
    } catch (error) {
      logger.error('加载供应商列表失败:', error)
      suppliers.value = []
    }
  }

  const loadBrands = async () => {
    try {
      const response = await useCachedRequest(CACHE_KEYS.brands, () =>
        api.get('/brands'), DEFAULT_CACHE_TTL.STATIC)
      if (response.success && response.data) {
        const brandList = Array.isArray(response.data)
          ? response.data
          : response.data?.data || response.data?.brands || []
        brands.value = sortOptionsByOrder(brandList
          .filter((item: NamedOption) => item?.name)
          .map((item: NamedOption) => ({
            id: item.id,
            name: item.name as string,
            sort_order: item.sort_order || 0
          })))
      } else {
        brands.value = []
      }
    } catch (error) {
      logger.error('加载品牌数据失败:', error)
      brands.value = []
    }
  }

  const loadModels = async () => {
    try {
      const response = await useCachedRequest(CACHE_KEYS.models, () =>
        api.get('/models'), DEFAULT_CACHE_TTL.STATIC)
      if (response.success && response.data) {
        const modelList = Array.isArray(response.data)
          ? response.data
          : response.data?.data || response.data?.models || []
        models.value = sortOptionsByOrder(modelList
          .filter((item: ModelOption) => item?.name)
          .map((item: ModelOption) => ({
            id: item.id,
            name: item.name,
            sort_order: item.sort_order || 0
          })))
      } else {
        models.value = []
      }
    } catch (error) {
      logger.error('加载型号数据失败:', error)
      models.value = []
    }
  }

  const handleBrandChange = async () => {
    const selectedBrandName = filters.brand
    if (!selectedBrandName) {
      brandModels.value = models.value
    } else {
      const selectedBrand = brands.value.find(brand => brand.name === selectedBrandName)
      if (!selectedBrand) {
        brandModels.value = []
        filters.model = ''
        await onLoadInventory()
        return
      }

      try {
        const response = await api.get(`/brands/${selectedBrand.id}/models`)
        if (response.success && response.data) {
          const modelList = Array.isArray(response.data) ? response.data : []
          brandModels.value = sortOptionsByOrder(modelList
            .filter((item: ModelOption) => item?.name)
            .map((item: ModelOption) => ({
              id: item.id,
              name: item.name,
              sort_order: item.sort_order
            })))
        } else {
          brandModels.value = []
        }
      } catch (error) {
        logger.error(`获取品牌 "${selectedBrandName}" 的型号失败:`, error)
        brandModels.value = []
      }
    }

    filters.model = ''
    await onLoadInventory()
  }

  const fetchBrandModels = async (brandName: string) => {
    if (!brandName) {
      brandModels.value = []
      return
    }

    try {
      const brandModelSet = new Set(
        inventory.value
          .filter(item => item.brand === brandName)
          .map(item => item.model)
          .filter(Boolean)
      )
      brandModels.value = sortOptionsByOrder(
        Array.from(brandModelSet).map(name => ({ id: 0, name }))
      )
    } catch (error) {
      logger.error('获取品牌型号失败:', error)
      brandModels.value = []
    }
  }

  const loadOperators = async () => {
    try {
      const response = await useCachedRequest(CACHE_KEYS.operators, () =>
        api.get('/operators'), DEFAULT_CACHE_TTL.STATIC)
      if (response.success && response.data) {
        operators.value = sortOptionsByOrder(response.data)
      }
    } catch (error) {
      logger.error('加载操作员列表失败:', error)
      operators.value = []
    }
  }

  const loadColors = async () => {
    try {
      const response = await useCachedRequest(CACHE_KEYS.colors, () =>
        api.get('/colors'), DEFAULT_CACHE_TTL.STATIC)
      if (response.success && response.data) {
        const colorList = Array.isArray(response.data)
          ? response.data
          : response.data.colors || []
        colors.value = sortOptionsByOrder(colorList)
          .map(item => getOptionLabel(item, ['name']).trim())
          .filter(Boolean)
      } else {
        colors.value = []
      }
    } catch (error) {
      logger.error('加载颜色数据失败:', error)
      colors.value = []
    }
  }

  const loadMemories = async () => {
    try {
      const response = await useCachedRequest(CACHE_KEYS.memories, () =>
        api.get('/memories', { params: { page_size: 10000 } }), DEFAULT_CACHE_TTL.STATIC)
      if (response.success && response.data) {
        const memoryList = extractResponseData<unknown[]>(response)
        const memoryLabels = sortOptionsByOrder(memoryList, { labelKeys: ['size', 'capacity', 'name'] })
          .map(item => getOptionLabel(item, ['size', 'capacity', 'name']).trim())
          .filter(Boolean)
        memories.value = [...new Set(memoryLabels)]
      } else {
        memories.value = []
      }
    } catch (error) {
      logger.error('加载内存数据失败:', error)
      memories.value = []
    }
  }

  const fetchBasicData = async () => {
    await Promise.all([
      loadStores(),
      loadSuppliers(),
      loadOperators(),
      loadBrands(),
      loadModels(),
      loadColors(),
      loadMemories()
    ])
  }

  return {
    fetchBasicData,
    fetchBrandModels,
    handleBrandChange
  }
}
