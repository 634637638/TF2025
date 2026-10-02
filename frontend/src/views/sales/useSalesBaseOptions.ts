import { ref } from 'vue'
import type { Operator, PhoneBrand, PhoneModel, Store, Supplier } from '@/types'
import { useNotification } from '@/composables/useNotification'
import { extractResponseData } from '@/utils/api-response'
import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import { getOptionLabel, sortOptionsByOrder } from '@/utils/option-sort'
import type {
  SalesBrandRecord,
  SalesNamedOption,
  SalesModelRecord
} from './types'
import { hasSalesOptionName } from './types'
import {
  getCachedBrands,
  getCachedColors,
  getCachedMemories,
  getModels,
  searchOperators,
  getCachedStores,
  getCachedSuppliers
} from '@/services/reference-options'

export const useSalesBaseOptions = () => {
  const { error: showError } = useNotification()
  const authStore = useAuthStore()
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

  const normalizeOperators = (records: Array<Record<string, unknown>>) => sortOptionsByOrder(records.map(item => ({
    id: Number(item.id || 0),
    username: String(item.username || ''),
    name: String(item.name || item.username || ''),
    status: Number(item.status || 1)
  })))

  const loadStores = async () => {
    try {
      const response = await getCachedStores()
      if (response.success) {
        const storeRecords = Array.isArray(response.data)
          ? response.data.map(item => ({
            id: Number(item.id || 0),
            name: String(item.name || ''),
            code: String(item.code || item.name || ''),
            status: Number(item.status || 1)
          }))
          : []
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
      const response = await searchOperators({ page: 1, page_size: 20 })
      if (response.success && response.data) {
        const records = Array.isArray(response.data) ? [...response.data] : []
        const currentUser = authStore.user
        if (currentUser?.id && !records.some(item => Number(item.id) === Number(currentUser.id))) {
          records.unshift({ id: currentUser.id, name: currentUser.name, username: currentUser.username, status: 1 })
        }
        operators.value = normalizeOperators(records)
      }
    } catch (error) {
      logger.error('加载操作员列表失败:', error)
      operators.value = []
    }
  }

  const searchOperatorsRemote = async (keyword = '') => {
    try {
      const response = await searchOperators({ keyword: keyword.trim() || undefined, page: 1, page_size: 20 })
      operators.value = response.success && Array.isArray(response.data)
        ? normalizeOperators(response.data)
        : []
    } catch (error) {
      logger.error('远程搜索销售员失败:', error)
      operators.value = []
    }
  }

  const loadBrands = async () => {
    try {
      const response = await getCachedBrands()
      if (response.success && response.data) {
        const brandRecords = extractResponseData<SalesBrandRecord[]>(response) || []
        brandsFull.value = brandRecords
        brands.value = sortOptionsByOrder(brandRecords
          .filter(item => item && item.name)
          .map(item => ({
            id: Number(item.id || 0),
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
      const response = await getModels()
      if (response.success && response.data) {
        const modelRecords = Array.isArray(response.data) ? response.data : []
        models.value = sortOptionsByOrder(modelRecords
          .filter(item => item && item.name)
          .map(item => ({
            id: Number(item.id || 0),
            name: item.name,
            brand_id: Number(item.brand_id || 0),
            status: Number(item.status || 1),
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
      const response = await getCachedColors()
      if (response.success && response.data) {
        const colorRecords = Array.isArray(response.data)
          ? response.data
          : []
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
      const response = await getCachedMemories()
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
      const response = await getCachedSuppliers()
      if (response.success) {
        const supplierRecords = Array.isArray(response.data)
          ? response.data.map(item => ({
            id: Number(item.id || 0),
            name: String(item.name || ''),
            status: Number(item.status || 1)
          }))
          : []
        suppliers.value = sortOptionsByOrder(supplierRecords)
      }
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

      const response = await getModels({ brandId })
      const modelRecords = response.success
        ? extractResponseData<SalesModelRecord[]>(response)
        : []
      brandModels.value = sortOptionsByOrder((Array.isArray(modelRecords) ? modelRecords : [])
        .filter(model => model && model.status === 1 && model.name))
        .map(model => ({ id: model.id, name: model.name } as PhoneModel))
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
      const brandsResponse = await getCachedBrands()
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

      const modelsResponse = await getModels({ brandId: brand.id })
      // 品牌型号接口使用统一响应格式，兼容 data 直接数组和包装数组两种历史返回。
      const modelRecords = modelsResponse.success
        ? extractResponseData<SalesModelRecord[]>(modelsResponse)
        : []
      editBrandModels.value = sortOptionsByOrder((Array.isArray(modelRecords) ? modelRecords : [])
        .filter(model => model && model.status === 1 && model.name))
        .map(model => String(model.name).trim())
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
    searchOperatorsRemote,
    loadBrands,
    loadModels,
    loadColors,
    loadMemories,
    loadSuppliers,
    fetchBrandModels,
    fetchEditBrandModels
  }
}
