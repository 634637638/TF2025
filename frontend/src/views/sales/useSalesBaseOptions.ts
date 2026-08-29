import { ref } from 'vue'
import type { Operator, PhoneBrand, PhoneModel, Store, Supplier } from '@/types'
import { useNotification } from '@/composables/useNotification'
import { DEFAULT_CACHE_TTL, useCachedRequest } from '@/composables/usePageCache'
import { extractResponseData } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import { getOptionLabel, sortOptionsByOrder } from '@/utils/option-sort'
import { unifiedApi as api } from '@/utils/unified-api'
import type {
  SalesBrandRecord,
  SalesColorResponse,
  SalesMemoryResponse,
  SalesNamedOption,
  SalesModelRecord
} from './types'
import { hasSalesOptionName } from './types'

const CACHE_KEYS = {
  stores: '/stores:all',
  suppliers: '/suppliers:all',
  brands: '/brands:all',
  models: '/models:all',
  colors: '/colors:all',
  memories: '/memories:all',
  operators: '/operators:all'
}

export const useSalesBaseOptions = () => {
  const { error: showError } = useNotification()
  const stores = ref<Store[]>([])
  const operators = ref<Operator[]>([])
  const suppliers = ref<Supplier[]>([])
  const brands = ref<Array<Pick<PhoneBrand, 'id' | 'name'> & { sort_order?: number }>>([])
  const brandsFull = ref<PhoneBrand[]>([])
  const models = ref<PhoneModel[]>([])
  const colors = ref<string[]>([])
  const memories = ref<string[]>([])
  const brandModels = ref<PhoneModel[]>([])
  const editBrandModels = ref<string[]>([])

  const loadStores = async () => {
    try {
      const response = await useCachedRequest(
        CACHE_KEYS.stores,
        () => api.get('/stores?all=true'),
        DEFAULT_CACHE_TTL.STATIC
      )
      if (response.success) {
        const storeRecords = Array.isArray(response.data)
          ? response.data
          : (response.data?.data || response.data?.stores || [])
        stores.value = sortOptionsByOrder(storeRecords)
      }
    } catch (error) {
      logger.error('加载门店列表失败:', error)
      stores.value = []
      showError('门店列表加载失败，请刷新后重试')
    }
  }

  const loadOperators = async () => {
    try {
      const response = await useCachedRequest(
        CACHE_KEYS.operators,
        () => api.get('/operators'),
        DEFAULT_CACHE_TTL.STATIC
      )
      if (response.success && response.data) {
        operators.value = sortOptionsByOrder(response.data)
      }
    } catch (error) {
      logger.error('加载操作员列表失败:', error)
      operators.value = []
    }
  }

  const loadBrands = async () => {
    try {
      const response = await useCachedRequest(
        CACHE_KEYS.brands,
        () => api.get('/brands'),
        DEFAULT_CACHE_TTL.STATIC
      )
      if (response.success && response.data) {
        const brandRecords = extractResponseData<SalesBrandRecord[]>(response) || []
        brandsFull.value = brandRecords
        brands.value = sortOptionsByOrder(brandRecords
          .filter(item => item && item.name)
          .map(item => ({
            id: item.id,
            name: item.name,
            sort_order: item.sort_order || 0
          })))
      }
    } catch (error) {
      logger.error('加载品牌数据失败:', error)
      brands.value = []
      brandsFull.value = []
    }
  }

  const loadModels = async () => {
    try {
      const response = await useCachedRequest(
        CACHE_KEYS.models,
        () => api.get('/models'),
        DEFAULT_CACHE_TTL.STATIC
      )
      if (response.success && response.data) {
        const modelRecords = Array.isArray(response.data.models)
          ? response.data.models
          : (Array.isArray(response.data) ? response.data : [])
        models.value = sortOptionsByOrder(modelRecords
          .filter(item => item && item.name)
          .map(item => ({
            id: item.id,
            name: item.name,
            sort_order: item.sort_order || 0
          })))
      }
    } catch (error) {
      logger.error('加载型号数据失败:', error)
      models.value = []
    }
  }

  const loadColors = async () => {
    try {
      const response = await useCachedRequest(
        CACHE_KEYS.colors,
        () => api.get<SalesColorResponse>('/colors'),
        DEFAULT_CACHE_TTL.STATIC
      )
      if (response.success && response.data) {
        const colorRecords = Array.isArray(response.data)
          ? response.data
          : response.data.colors || []
        colors.value = sortOptionsByOrder(colorRecords)
          .filter(hasSalesOptionName)
          .map(item => item.name)
      }
    } catch (error) {
      logger.error('加载颜色数据失败:', error)
      colors.value = []
    }
  }

  const loadMemories = async () => {
    try {
      const response = await useCachedRequest(
        CACHE_KEYS.memories,
        () => api.get<SalesMemoryResponse>('/memories'),
        DEFAULT_CACHE_TTL.STATIC
      )
      if (response.success && response.data) {
        const memoryRecords = extractResponseData<SalesNamedOption[]>(response)
        const memoryLabels = sortOptionsByOrder(
          memoryRecords,
          { labelKeys: ['size', 'capacity', 'name'] }
        )
          .map(item => getOptionLabel(item, ['size', 'capacity', 'name']).trim())
          .filter(Boolean)

        memories.value = [...new Set(memoryLabels)]
      }
    } catch (error) {
      logger.error('加载内存数据失败:', error)
      memories.value = []
    }
  }

  const loadSuppliers = async () => {
    try {
      const response = await useCachedRequest(
        CACHE_KEYS.suppliers,
        () => api.get('/suppliers?page=1&page_size=100'),
        DEFAULT_CACHE_TTL.STATIC
      )
      if (response.success) suppliers.value = sortOptionsByOrder(response.data || [])
    } catch (error) {
      logger.error('加载供应商列表失败:', error)
      suppliers.value = []
    }
  }

  const fetchBrandModels = async (brandName: string | number) => {
    if (!brandName) {
      brandModels.value = []
      return
    }

    try {
      let brandId = brandName
      if (typeof brandName === 'string') {
        const brand = brands.value.find(item => item.name === brandName)
        if (!brand) {
          brandModels.value = []
          return
        }
        brandId = brand.id ?? ''
      }

      const response = await api.get<SalesModelRecord[]>(`/brands/${brandId}/models`)
      brandModels.value = response.success
        ? response.data
          .filter(model => model.status === 1)
          .sort((left, right) => left.sort_order - right.sort_order)
          .map(model => ({ id: model.id, name: model.name } as PhoneModel))
        : []
    } catch (error) {
      logger.error('获取品牌型号失败:', error)
      brandModels.value = []
    }
  }

  const fetchEditBrandModels = async (brandName: string) => {
    if (!brandName) {
      editBrandModels.value = []
      return
    }

    try {
      const normalizedName = String(brandName).trim()
      const brandsResponse = await api.get<SalesBrandRecord[]>('/brands')
      if (!brandsResponse.success) {
        editBrandModels.value = []
        return
      }

      const brand = brandsResponse.data.find(item => {
        const candidate = String(item.name || '').trim()
        return candidate === normalizedName ||
          candidate.toLowerCase() === normalizedName.toLowerCase() ||
          normalizedName.toLowerCase().includes(candidate.toLowerCase()) ||
          candidate.toLowerCase().includes(normalizedName.toLowerCase())
      })
      if (!brand) {
        editBrandModels.value = []
        return
      }

      const modelsResponse = await api.get<SalesModelRecord[]>(`/brands/${brand.id}/models`)
      editBrandModels.value = modelsResponse.success
        ? modelsResponse.data
          .filter(model => model.status === 1)
          .sort((left, right) => left.sort_order - right.sort_order)
          .map(model => model.name)
        : []
    } catch (error) {
      logger.error('编辑弹窗获取品牌型号失败:', error)
      editBrandModels.value = []
    }
  }

  return {
    stores,
    operators,
    suppliers,
    brands,
    brandsFull,
    models,
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
  }
}
