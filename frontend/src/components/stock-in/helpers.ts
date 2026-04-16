import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import { extractResponseData } from '@/utils/api-response'
import { unifiedApi } from '@/utils/unified-api'
import type { Brand, Color, MemoryOption, Model } from '@/types'
import type { Store, Supplier } from '@/types/system'
import type { StockInFormModel, StockInPhoneItem } from './types'

export type StockInScanType = 'imei' | 'serial'

interface StockInCreateDefaultsOptions {
  operatorName: string
}

interface StockInEditPhoneOptions {
  brand?: number | string
  model?: number | string
  color?: number | string
  memory?: number | string
  serial_number?: string
  imei?: string
  purchase_price?: number
}

interface StockInEditResponse {
  id?: string | number
  supplier_id?: string | number
  store_id?: string | number
  Inventorytime?: string | null
  operator_name?: string
  phone_condition?: string
  note?: string
  brand_id?: number | string | null
  model_id?: number | string | null
  color_id?: number | string | null
  memory_id?: number | string | null
  serial_number?: string | null
  imei?: string | null
  unit_cost?: number | null
}

interface InitializeStockInFormOptions {
  mode: 'create' | 'edit'
  editId?: string | number
  operatorName: string
}

interface InitializedStockInFormResult {
  formData: StockInFormModel
  brandId: number | null
}

export const createEmptyStockInPhone = (): StockInPhoneItem => ({
  brand: '',
  model: '',
  color: '',
  memory: '',
  serial_number: '',
  imei: '',
  purchase_price: undefined,
  is_published: 1,
  imeiValid: undefined,
  serialValid: undefined,
  isNoIMEIMode: false
})

export const resolveStockInBrandId = (
  brandValue: number | string | undefined
): number | null => {
  if (brandValue === undefined || brandValue === null || brandValue === '') {
    return null
  }

  const parsed = typeof brandValue === 'number' ? brandValue : parseInt(brandValue, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const findStockInBrand = (
  brands: Brand[],
  brandValue: number | string | undefined
): Brand | null => {
  const brandId = resolveStockInBrandId(brandValue)
  if (brandId === null) {
    return null
  }

  return brands.find((brand) => brand.id === brandId) || null
}

export const createStockInPhoneBatch = (count: number): StockInPhoneItem[] =>
  Array.from({ length: count }, () => createEmptyStockInPhone())

export const createCreateModeStockInForm = (
  options: StockInCreateDefaultsOptions
): StockInFormModel => ({
  id: '',
  supplier_id: '',
  store_id: '',
  stock_in_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
  operator_name: options.operatorName,
  product_status: '全新',
  remarks: '',
  phones: [createEmptyStockInPhone()]
})

export const createEditModePhoneItem = (
  phone: StockInEditPhoneOptions,
  isNoIMEIMode: boolean
): StockInPhoneItem => ({
  brand: phone.brand,
  model: phone.model,
  color: phone.color,
  memory: phone.memory,
  serial_number: phone.serial_number || '',
  imei: phone.imei || '',
  purchase_price: phone.purchase_price,
  imeiValid: undefined,
  serialValid: undefined,
  isNoIMEIMode
})

const parseOptionalNumericId = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = typeof value === 'number' ? value : parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const mapStockInEditResponseToForm = (
  data: StockInEditResponse,
  operatorName: string
): InitializedStockInFormResult => {
  const brandId = parseOptionalNumericId(data.brand_id)
  const formData: StockInFormModel = {
    id: data.id ? String(data.id) : '',
    supplier_id: data.supplier_id ? String(data.supplier_id) : '',
    store_id: data.store_id || '',
    stock_in_date: data.Inventorytime
      ? TimeUtil.format(data.Inventorytime, TIME_FORMATS.DATE)
      : TimeUtil.nowFormatted(TIME_FORMATS.DATE),
    operator_name: data.operator_name || operatorName,
    product_status: data.phone_condition || '全新',
    remarks: data.note || '',
    phones: [
      createEditModePhoneItem(
        {
          brand: data.brand_id || '',
          model: data.model_id || '',
          color: data.color_id || '',
          memory: data.memory_id || '',
          serial_number: data.serial_number || '',
          imei: data.imei || '',
          purchase_price: data.unit_cost || undefined
        },
        detectNoIMEIMode(data.imei || undefined, data.serial_number || undefined)
      )
    ]
  }

  return {
    formData,
    brandId
  }
}

export const initializeStockInFormData = async (
  options: InitializeStockInFormOptions
): Promise<InitializedStockInFormResult> => {
  if (options.mode !== 'edit' || !options.editId) {
    return {
      formData: createCreateModeStockInForm({
        operatorName: options.operatorName
      }),
      brandId: null
    }
  }

  const response = await unifiedApi.get(`/stock-in/${options.editId}`)
  if (!response.success || !response.data) {
    throw new Error('加载编辑数据失败')
  }

  return mapStockInEditResponseToForm(response.data as StockInEditResponse, options.operatorName)
}

export const detectNoIMEIMode = (
  imei: string | undefined,
  serialNumber: string | undefined
): boolean => {
  if (!imei) return false

  if (/[a-zA-Z]/.test(imei)) {
    return true
  }

  if (imei === serialNumber && imei.length !== 15) {
    return true
  }

  return imei.length !== 15
}

export const normalizeIMEIInput = (
  imei: string | undefined,
  isNoIMEIMode: boolean | undefined
): string => {
  if (!imei) return ''

  if (isNoIMEIMode) {
    return imei
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 30)
  }

  return imei.replace(/\D/g, '').slice(0, 15)
}

export const validateIMEI = (
  imei: string | undefined,
  serialNumber: string | undefined,
  isNoIMEIMode: boolean | undefined
): boolean | undefined => {
  if (!imei) {
    return undefined
  }

  if (isNoIMEIMode) {
    return imei === serialNumber && imei.length >= 4
  }

  return imei.length === 15 && /^\d{15}$/.test(imei)
}

export const normalizeSerialNumberInput = (serialNumber: string | undefined): string => {
  if (!serialNumber) return ''

  return serialNumber
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 30)
}

export const validateSerialNumber = (
  serialNumber: string | undefined
): boolean | undefined => {
  if (!serialNumber) {
    return undefined
  }

  return /^[A-Za-z0-9]{4,30}$/.test(serialNumber)
}

export const toggleNoIMEIModeState = (
  phone: StockInPhoneItem
): { message: string; messageType: 'success' | 'info' } => {
  phone.isNoIMEIMode = !phone.isNoIMEIMode

  if (phone.isNoIMEIMode) {
    if (phone.serial_number) {
      phone.imei = phone.serial_number
      phone.imeiValid = true
    } else {
      phone.imei = ''
      phone.imeiValid = undefined
    }

    return {
      message: '已启用无IMEI模式，IMEI将支持字母+数字',
      messageType: 'success'
    }
  }

  phone.imei = ''
  phone.imeiValid = undefined
  return {
    message: '已切换回标准IMEI模式，需要输入15位纯数字',
    messageType: 'info'
  }
}

export const applyStockInScanResult = (
  phone: StockInPhoneItem,
  scanType: StockInScanType,
  result: string
) => {
  if (scanType === 'imei') {
    phone.imei = normalizeIMEIInput(result, phone.isNoIMEIMode)
    phone.imeiValid = validateIMEI(phone.imei, phone.serial_number, phone.isNoIMEIMode)
    return
  }

  phone.serial_number = normalizeSerialNumberInput(result)
  phone.serialValid = validateSerialNumber(phone.serial_number)

  if (phone.serialValid && phone.isNoIMEIMode) {
    phone.imei = phone.serial_number
    phone.imeiValid = true
  }
}

export const buildStockInScanPromptConfig = (
  scanType: StockInScanType,
  isNoIMEIMode: boolean
) => ({
  message: scanType === 'imei'
    ? (isNoIMEIMode ? '请输入IMEI号（无IMEI模式支持字母+数字）' : '请输入IMEI号（15位数字）')
    : '请输入序列号',
  title: scanType === 'imei' ? 'IMEI手动输入' : '序列号手动输入',
  inputPattern: scanType === 'imei'
    ? (isNoIMEIMode ? /^[A-Za-z0-9]{4,30}$/ : /^\d{15}$/)
    : /^[A-Za-z0-9]{4,30}$/,
  inputErrorMessage: scanType === 'imei'
    ? (isNoIMEIMode ? '请输入4-30位字母或数字' : '请输入15位数字的IMEI号')
    : '请输入有效的序列号',
  inputPlaceholder: scanType === 'imei'
    ? (isNoIMEIMode ? '请输入字母或数字IMEI' : '例如：356738110412345')
    : '请输入设备序列号'
})

export const parsePriceValue = (value: string | undefined): number => {
  if (!value) return 0
  const parsed = parseFloat(value)
  return isNaN(parsed) ? 0 : parsed
}

export const normalizePriceInput = (value: string): string =>
  value.replace(/[^\d.]/g, '')

export const formatStockInPriceValue = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') return ''

  const numericValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numericValue)) return ''

  return Number.isInteger(numericValue)
    ? numericValue.toString()
    : numericValue.toFixed(2).replace(/\.?0+$/, '')
}

export const buildStockInSubmitPayload = (
  mode: 'create' | 'edit',
  formData: StockInFormModel
) => {
  if (mode === 'create') {
    return {
      supplier_id: formData.supplier_id,
      store_id: formData.store_id,
      stock_in_date: formData.stock_in_date,
      operator_name: formData.operator_name,
      condition: formData.product_status === '全新' ? '全新' : '二手',
      products: formData.phones.map((phone) => ({
        brand_id: phone.brand,
        model_id: phone.model,
        color_id: phone.color,
        memory_id: phone.memory,
        imei: phone.imei,
        serial_number: phone.serial_number,
        purchase_price: phone.purchase_price,
        is_published: phone.is_published ?? 1
      })),
      notes: formData.remarks
    }
  }

  const phone = formData.phones[0]

  return {
    brand_id: phone.brand,
    model_id: phone.model,
    color_id: phone.color,
    memory_id: phone.memory,
    imei: phone.imei,
    serial_number: phone.serial_number,
    purchase_cost: phone.purchase_price,
    store_id: formData.store_id,
    supplier_id: formData.supplier_id,
    is_new: formData.product_status,
    remarks: formData.remarks
  }
}

export const validateStockInPhone = (phone: StockInPhoneItem): string | null => {
  if (!phone.brand || !phone.model || !phone.color || !phone.memory) {
    return '请完善商品信息'
  }

  const imeiValid = validateIMEI(phone.imei, phone.serial_number, phone.isNoIMEIMode)
  if (!phone.imei || imeiValid !== true) {
    return '请输入有效的IMEI号'
  }

  const serialValid = validateSerialNumber(phone.serial_number)
  if (!phone.serial_number || serialValid !== true) {
    return '请输入有效的序列号'
  }

  if (!phone.purchase_price || phone.purchase_price <= 0) {
    return '请输入有效的入库价格'
  }

  return null
}

export const validateStockInPhones = (
  mode: 'create' | 'edit',
  phones: StockInPhoneItem[]
): string | null => {
  if (mode === 'edit') {
    const phone = phones[0]
    return phone ? validateStockInPhone(phone) : '请完善商品信息'
  }

  for (const phone of phones) {
    const error = validateStockInPhone(phone)
    if (error) {
      return error
    }
  }

  return null
}

const sortBySortOrder = <T extends { sort_order?: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

export interface StockInDropdownData {
  suppliers: Supplier[]
  stores: Store[]
  brands: Brand[]
  models: Model[]
  colors: Color[]
  memories: MemoryOption[]
}

export const loadStockInDropdownData = async (): Promise<StockInDropdownData> => {
  const results = await Promise.all([
    unifiedApi.get('/suppliers?limit=10000'),
    unifiedApi.get('/stores?all=true'),
    unifiedApi.get('/brands?status=1&limit=100'),
    unifiedApi.get('/models?status=1&limit=100'),
    unifiedApi.get('/colors?limit=100'),
    unifiedApi.get('/memories?limit=100')
  ])

  const [suppliersRes, storesRes, brandsRes, modelsRes, colorsRes, memoriesRes] = results

  const suppliers = suppliersRes.success
    ? sortBySortOrder((suppliersRes.data || []) as Supplier[])
    : []

  const storesSource = Array.isArray(storesRes.data)
    ? storesRes.data
    : (storesRes.data?.stores || storesRes.data?.data || [])
  const stores = storesRes.success
    ? sortBySortOrder(storesSource as Store[])
    : []

  const brands = brandsRes.success
    ? sortBySortOrder(extractResponseData<Array<{ id: number; name: string; sort_order?: number }>>(brandsRes))
      .map((brand) => ({
        id: brand.id,
        name: brand.name
      }))
    : []

  const models = modelsRes.success
    ? sortBySortOrder(extractResponseData<Array<{ id: number; name: string; brand_id?: number; sort_order?: number }>>(modelsRes))
      .map((model) => ({
        id: model.id,
        name: model.name,
        brand_id: model.brand_id
      }))
    : []

  const colors = colorsRes.success
    ? sortBySortOrder(extractResponseData<Array<{ id: number; name: string; sort_order?: number }>>(colorsRes))
      .map((color) => ({
        id: color.id,
        name: color.name
      }))
    : []

  const memories = memoriesRes.success
    ? sortBySortOrder(extractResponseData<Array<{ id: number; name?: string; capacity?: string; sort_order?: number }>>(memoriesRes))
      .map((memory) => ({
        id: memory.id,
        name: memory.name || memory.capacity,
        capacity: memory.capacity
      }))
    : []

  return {
    suppliers,
    stores,
    brands,
    models,
    colors,
    memories
  }
}

export const loadBrandModels = async (brandId: number): Promise<Model[]> => {
  const response = await unifiedApi.get(`/brands/${brandId}/models`)
  if (!response.success || !response.data) {
    return []
  }

  const modelList = Array.isArray(response.data) ? response.data : []
  return sortBySortOrder(
    modelList
      .filter((item): item is { id: number; name: string; brand_id?: number; sort_order?: number } => Boolean(item && item.name))
      .map((item) => ({
        id: item.id,
        name: item.name,
        brand_id: item.brand_id,
        sort_order: item.sort_order
      }))
  ).map((item) => ({
    id: item.id,
    name: item.name,
    brand_id: item.brand_id
  }))
}

export const filterByQuery = <T>(
  items: T[],
  query: string,
  getText: (item: T) => string
): T[] => {
  if (!query || !query.trim()) {
    return items
  }

  const normalizedQuery = query.toLowerCase().trim()
  return items.filter((item) => getText(item).toLowerCase().includes(normalizedQuery))
}

export const filterModelOptions = (
  models: Model[],
  query: string
): Model[] => {
  if (!query || !query.trim()) {
    return models
  }

  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '')
  return models.filter((model) => {
    const modelName = (model.name || '').toString()
    if (modelName.toLowerCase().includes(normalizedQuery)) {
      return true
    }

    const normalizedName = modelName.toLowerCase().replace(/\s+/g, '')
    if (normalizedName.includes(normalizedQuery)) {
      return true
    }

    const cleanedName = normalizedName.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    const cleanedQuery = normalizedQuery.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    return cleanedName.includes(cleanedQuery)
  })
}

export const getStockInModelsForPhone = (options: {
  phone: StockInPhoneItem | undefined
  brands: Brand[]
  models: Model[]
  brandModelsCache: Map<number, Model[]>
  query: string
}): Model[] => {
  const selectedBrand = findStockInBrand(options.brands, options.phone?.brand)
  if (!selectedBrand) {
    return []
  }

  const modelList = options.brandModelsCache.has(selectedBrand.id)
    ? (options.brandModelsCache.get(selectedBrand.id) || [])
    : options.models.filter((model) => model.brand_id === selectedBrand.id)

  return filterModelOptions(modelList, options.query)
}
