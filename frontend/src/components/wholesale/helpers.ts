import { normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { extractResponseData } from '@/utils/api-response'
import { unifiedApi } from '@/utils/unified-api'
import type { User } from '@/types'
import type { Store, Supplier } from '@/types/system'
import type {
  CollectedPriceItem,
  EditableWholesalePhone,
  TransferSubmitPayload,
  WholesaleCustomerSearchItem,
  WholesaleFormData,
  WholesalePhone
} from './types'

export const createWholesaleFormData = (): WholesaleFormData => ({
  customer_id: null,
  customer_name: '',
  customer_phone: '',
  supplier_id: null,
  store_id: null,
  salesperson_name: '',
  wholesale_price: null,
  payment_method: '',
  payment_channel: '',
  invoice_number: '',
  sale_date: '',
  remarks: ''
})

export const normalizeWholesaleCustomerSearchItem = (
  customer: Partial<WholesaleCustomerSearchItem> | null | undefined
): WholesaleCustomerSearchItem => ({
  id: Number(customer?.id || 0),
  name: normalizePersonName(customer?.name || '', 20),
  phone: normalizePhoneDigits(customer?.phone || '')
})

export const matchCollectedPrice = (
  phone: WholesalePhone,
  collectedPrices: CollectedPriceItem[]
): number | null => {
  if (!collectedPrices.length) {
    return null
  }

  const exactMatch = collectedPrices.find((price) => {
    const brandMatch = !price.brand_name || price.brand_name === phone.brand
    const modelMatch = !price.model_number || price.model_number === phone.model
    const colorMatch = !price.color_name || price.color_name === phone.color
    const memoryMatch = !price.memory || price.memory === phone.memory
    return brandMatch && modelMatch && colorMatch && memoryMatch
  })

  if (exactMatch) {
    return Number(exactMatch.wholesale_price || exactMatch.retail_price || 0)
  }

  const fuzzyMatch = collectedPrices.find((price) => {
    const brandMatch = !price.brand_name || price.brand_name === phone.brand
    const modelMatch = !price.model_number || price.model_number === phone.model
    return brandMatch && modelMatch
  })

  if (fuzzyMatch) {
    return Number(fuzzyMatch.wholesale_price || fuzzyMatch.retail_price || 0)
  }

  return null
}

export const buildEditableWholesalePhones = (
  phones: WholesalePhone[],
  mode: 'wholesale' | 'proxy',
  collectedPrices: CollectedPriceItem[]
): EditableWholesalePhone[] => {
  const isProxyMode = mode === 'proxy'

  return phones.map((phone) => {
    const collectedPrice = isProxyMode ? null : matchCollectedPrice(phone, collectedPrices)
    const baseCost = Number(phone.editCost || phone.purchase_cost || phone.purchase_price || 0)

    return {
      ...phone,
      editCost: isProxyMode ? 0 : baseCost,
      wholesalePrice: isProxyMode ? 0 : (Number(collectedPrice || 0) || Number(phone.wholesalePrice) || baseCost)
    }
  })
}

export const loadWholesaleCollectedPrices = async (): Promise<CollectedPriceItem[]> => {
  const response = await unifiedApi.get('/public/price/all')
  if (!response.success) {
    return []
  }

  return Array.isArray(response.data)
    ? response.data as CollectedPriceItem[]
    : []
}

export const initializeWholesalePhoneState = async (options: {
  phones: WholesalePhone[]
  mode: 'wholesale' | 'proxy'
}): Promise<{
  editablePhones: EditableWholesalePhone[]
  collectedPrices: CollectedPriceItem[]
}> => {
  if (!options.phones.length) {
    return {
      editablePhones: [],
      collectedPrices: []
    }
  }

  const nextCollectedPrices = options.mode === 'wholesale'
    ? await loadWholesaleCollectedPrices()
    : []

  return {
    editablePhones: buildEditableWholesalePhones(options.phones, options.mode, nextCollectedPrices),
    collectedPrices: nextCollectedPrices
  }
}

export const loadWholesaleDialogOptions = async (): Promise<{
  suppliers: Supplier[]
  stores: Store[]
  users: User[]
}> => {
  const [suppliers, stores, users] = await Promise.all([
    loadWholesaleSuppliers(),
    loadWholesaleStores(),
    loadWholesaleUsers()
  ])

  return {
    suppliers,
    stores,
    users
  }
}

export const resolveProxySupplierId = (phones: WholesalePhone[]): number | null => {
  const supplierIds = [...new Set(phones.map((phone) => phone.supplier_id).filter((id): id is number => id != null))]
  return supplierIds.length === 1 ? supplierIds[0] : null
}

export const buildWholesaleOpenFormPatch = (options: {
  mode: 'wholesale' | 'proxy'
  phones: WholesalePhone[]
  operatorName: string
}): Partial<WholesaleFormData> => ({
  supplier_id: options.mode === 'proxy' ? resolveProxySupplierId(options.phones) : null,
  salesperson_name: options.operatorName
})

export const normalizeWholesalePhoneValue = (phone: unknown): string =>
  normalizePhoneDigits(phone)

export const formatWholesalePrice = (price: number): string => {
  const formatted = price.toFixed(2)
  return formatted.endsWith('.00') ? formatted.slice(0, -3) : formatted
}

export const formatWholesaleDate = (date: string | null | undefined): string => {
  if (!date) return '-'

  let parsedDate: Date
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date)

  if (isDateOnly) {
    parsedDate = new Date(`${date}T00:00:00`)
  } else if (date.includes(' ')) {
    parsedDate = new Date(date.replace(' ', 'T'))
  } else {
    parsedDate = new Date(date)
  }

  if (isNaN(parsedDate.getTime())) return '-'

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const resolveWholesaleErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response
    if (typeof response?.data?.message === 'string' && response.data.message) {
      return response.data.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export const buildAutoCreateCustomerPayload = (
  formData: WholesaleFormData,
  mode: 'wholesale' | 'proxy'
) => {
  const normalizedName = normalizePersonName(formData.customer_name, 20) || '客户'
  const normalizedPhone = normalizePhoneDigits(formData.customer_phone)

  return {
    name: normalizedName,
    phone: normalizedPhone,
    customer_type: mode === 'wholesale' ? 'wholesale' : 'allocate',
    vip_level: 'normal'
  }
}

export const shouldShowWholesaleCustomerSearch = (phone: string): boolean =>
  normalizePhoneDigits(phone).length >= 11

export const normalizeWholesaleCustomerInput = (
  value: string,
  selectedCustomer: WholesaleCustomerSearchItem | null
) => {
  const cleanedValue = normalizePhoneDigits(value)
  const shouldClearSelectedCustomer = Boolean(
    selectedCustomer && normalizePhoneDigits(selectedCustomer.phone) !== cleanedValue
  )

  return {
    cleanedValue,
    shouldClearSelectedCustomer,
    shouldShowSearch: Boolean(cleanedValue)
  }
}

export const applyWholesaleCustomerSelection = (
  customer: WholesaleCustomerSearchItem
) => ({
  customer_id: customer.id,
  customer_phone: normalizePhoneDigits(customer.phone),
  customer_name: normalizePersonName(customer.name, 20)
})

export const buildWholesaleCreatedCustomerState = (
  customer: Partial<WholesaleCustomerSearchItem> | null | undefined
) => {
  const normalizedCustomer = normalizeWholesaleCustomerSearchItem(customer)

  return {
    customer: normalizedCustomer,
    formPatch: applyWholesaleCustomerSelection(normalizedCustomer)
  }
}

export const createWholesaleSearchResetState = () => ({
  selectedCustomer: null as WholesaleCustomerSearchItem | null,
  customerSearchResults: [] as WholesaleCustomerSearchItem[],
  showCustomerSearch: false,
  customerSearching: false,
  isSelectingCustomer: false
})

export const validateWholesaleSubmit = (options: {
  mode: 'wholesale' | 'proxy'
  supplierId: number | null
  phones: EditableWholesalePhone[]
  normalizedCustomerPhone: string
  isValidMobilePhone: (phone: string) => boolean
}): string | null => {
  if (options.mode === 'proxy' && !options.supplierId) {
    return '请选择供应商'
  }

  if (options.mode === 'wholesale') {
    const phonesWithoutPrice = options.phones.filter((phone) => !phone.wholesalePrice || phone.wholesalePrice <= 0)
    if (phonesWithoutPrice.length > 0) {
      return `请为所有手机设置批发价格（当前有 ${phonesWithoutPrice.length} 台未设置或价格为0）`
    }
  }

  if (options.mode === 'wholesale' && !options.isValidMobilePhone(options.normalizedCustomerPhone)) {
    return '请输入有效的手机号码'
  }

  if (options.mode === 'proxy' && options.normalizedCustomerPhone && !options.isValidMobilePhone(options.normalizedCustomerPhone)) {
    return '请输入有效的手机号码'
  }

  return null
}

export const searchWholesaleCustomers = async (
  phoneNumber: string
): Promise<WholesaleCustomerSearchItem[]> => {
  const response = await unifiedApi.get(`/sales/customers?search=${encodeURIComponent(phoneNumber)}`)
  if (!response.success) {
    return []
  }

  return extractResponseData<Array<Partial<WholesaleCustomerSearchItem>>>(response)
    .map((item) => normalizeWholesaleCustomerSearchItem(item))
}

export const loadWholesaleSuppliers = async (): Promise<Supplier[]> => {
  const response = await unifiedApi.get('/suppliers', {
    params: { page: 1, limit: 1000, all: true }
  })

  return response.success && Array.isArray(response.data)
    ? response.data as Supplier[]
    : []
}

export const loadWholesaleStores = async (): Promise<Store[]> => {
  const response = await unifiedApi.get('/stores', {
    params: { page: 1, limit: 1000, all: true }
  })

  return response.success && Array.isArray(response.data)
    ? response.data as Store[]
    : []
}

export const loadWholesaleUsers = async (): Promise<User[]> => {
  const response = await unifiedApi.get('/users/operators')
  if (!response.success) {
    return []
  }

  if (Array.isArray(response.data?.users)) {
    return response.data.users as User[]
  }

  return Array.isArray(response.data)
    ? response.data as User[]
    : []
}

interface BuildTransferPayloadOptions {
  mode: 'wholesale' | 'proxy'
  phoneIds: number[]
  phones: EditableWholesalePhone[]
  formData: WholesaleFormData
  selectedCustomer: WholesaleCustomerSearchItem | null
}

export const buildTransferSubmitPayload = (
  options: BuildTransferPayloadOptions
): TransferSubmitPayload => {
  const normalizedCustomerPhone = normalizePhoneDigits(options.formData.customer_phone)
  const normalizedCustomerName = normalizePersonName(options.formData.customer_name, 20)

  const payload: TransferSubmitPayload = {
    phone_ids: options.phoneIds,
    phones: options.phones.map((phone) => ({
      phone_id: phone.id,
      purchase_cost: Number(
        options.mode === 'proxy'
          ? (phone.editCost ?? 0)
          : (phone.editCost ?? phone.purchase_cost ?? phone.purchase_price ?? 0)
      ),
      wholesale_price: Number(phone.wholesalePrice ?? 0)
    })),
    remarks: options.formData.remarks
  }

  if (options.mode === 'wholesale') {
    if (options.selectedCustomer?.id) {
      payload.customer_id = options.selectedCustomer.id
    } else {
      payload.customer_name = normalizedCustomerName
      payload.customer_phone = normalizedCustomerPhone
    }

    payload.store_id = options.formData.store_id
    payload.salesperson_name = options.formData.salesperson_name
    payload.payment_method = options.formData.payment_method
    payload.invoice_number = options.formData.invoice_number
    payload.sale_date = options.formData.sale_date
  } else {
    payload.supplier_id = options.formData.supplier_id

    if (options.selectedCustomer?.id) {
      payload.customer_id = options.selectedCustomer.id
    } else if (normalizedCustomerPhone) {
      payload.customer_name = normalizedCustomerName
      payload.customer_phone = normalizedCustomerPhone
    }

    payload.store_id = options.formData.store_id
    payload.salesperson_name = options.formData.salesperson_name
    payload.sale_date = options.formData.sale_date
  }

  return payload
}
