import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import {
  normalizeAppleId,
  normalizePersonName,
  normalizePhoneDigits,
  resolveAppleAccountEmail
} from '@/utils/security'
import type {
  BrandModelOption,
  CustomerOption,
  QuickSaleFormState
} from './types'

export const createDefaultQuickSaleForm = (operatorId: number | null): QuickSaleFormState => ({
  brand_id: '',
  model_id: '',
  color_id: '',
  memory_id: '',
  is_new: '1',
  imei: '',
  serial_number: '',
  supplier_id: null,
  store_id: null,
  purchase_price: null,
  sale_price: null,
  customer_name: '',
  customer_phone: '',
  apple_id: '',
  stock_in_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
  stock_in_operator_id: operatorId,
  sale_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
  sale_operator_id: operatorId,
  payment_method: '',
  payment_channel: '',
  isNoIMEIMode: false,
  remarks: ''
})

export const normalizeQuickSaleCustomerPhone = (phone: unknown) =>
  normalizePhoneDigits(phone)

export const normalizeQuickSaleCustomerOption = (
  customer?: (Partial<CustomerOption> & Record<string, unknown>) | CustomerOption | null
): CustomerOption => ({
  id: Number(customer?.id || 0),
  name: normalizePersonName(customer?.name || '', 20),
  phone: normalizeQuickSaleCustomerPhone(customer?.phone || ''),
  apple_id: normalizeAppleId(customer?.apple_id || ''),
  member_number: String(customer?.member_number || '')
})

export const toggleQuickSaleNoIMEIMode = (options: {
  currentMode: boolean
  serialNumber: string
}) => ({
  nextMode: !options.currentMode,
  nextIMEI: !options.currentMode
    ? (options.serialNumber || '')
    : '',
  message: !options.currentMode
    ? '已启用无IMEI模式，IMEI将支持字母+数字'
    : '已切换回标准IMEI模式，需要输入15位纯数字',
  messageType: !options.currentMode ? 'success' as const : 'info' as const
})

export const formatQuickSaleIMEI = (imei: string, isNoIMEIMode: boolean) => {
  if (isNoIMEIMode) {
    return imei.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 30)
  }

  return imei.replace(/[^\d]/g, '').slice(0, 15)
}

export const formatQuickSaleSerialNumber = (serialNumber: string) =>
  serialNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 18)

export const sanitizeQuickSalePriceInput = (value: string) =>
  String(value || '').replace(/[^\d]/g, '')

export const buildQuickSaleCustomerPayload = (formData: QuickSaleFormState) => {
  const normalizedAppleId = normalizeAppleId(formData.apple_id)

  return {
    name: normalizePersonName(formData.customer_name, 20),
    phone: normalizeQuickSaleCustomerPhone(formData.customer_phone),
    apple_id: normalizedAppleId || null,
    email: resolveAppleAccountEmail(normalizedAppleId),
    gender: null,
    birthday: null,
    id_card: null,
    address: null,
    city: null,
    province: null,
    postal_code: null,
    customer_type: 'individual',
    vip_level: 'normal',
    notes: `通过快速出库创建 - ${TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)}`,
    source: 'quick_sale'
  }
}

export const buildQuickSaleSubmitPayload = (formData: QuickSaleFormState) => {
  const normalizedCustomerPhone = normalizeQuickSaleCustomerPhone(formData.customer_phone)
  const normalizedCustomerName = normalizePersonName(formData.customer_name, 20)
  const normalizedAppleId = normalizeAppleId(formData.apple_id)

  return {
    brand: formData.brand_id,
    model: formData.model_id,
    color: formData.color_id,
    memory: formData.memory_id,
    is_new: parseInt(formData.is_new, 10),
    imei: String(formData.imei),
    serial_number: formData.serial_number,
    supplier_id: formData.supplier_id,
    store_id: formData.store_id,
    purchase_price: formData.purchase_price ?? null,
    sale_price: formData.sale_price ?? null,
    customer_name: normalizedCustomerName || '',
    customer_phone: normalizedCustomerPhone,
    apple_id: normalizedAppleId || '',
    stock_in_date: formData.stock_in_date,
    stock_in_operator_id: formData.stock_in_operator_id,
    sale_date: formData.sale_date,
    operator_id: formData.sale_operator_id,
    payment_method: formData.payment_method || '现金',
    remarks: formData.remarks || ''
  }
}

export const createQuickSaleInitialPatch = (
  initialData: {
    brand_id?: string
    model_id?: string
    color_id?: string
    memory_id?: string
    is_new?: string | number | boolean
    imei?: string
    serial_number?: string
    supplier_id?: number | null
    store_id?: number | null
    purchase_price?: number | null
    sale_price?: number | null
  } | null | undefined
) => {
  if (!initialData) {
    return null
  }

  return {
    brand_id: initialData.brand_id || '',
    color_id: initialData.color_id || '',
    memory_id: initialData.memory_id || '',
    is_new: initialData.is_new === true || initialData.is_new === 1 || initialData.is_new === '1' ? '1' : '0',
    imei: initialData.imei || '',
    serial_number: initialData.serial_number || '',
    supplier_id: initialData.supplier_id ?? null,
    store_id: initialData.store_id ?? null,
    purchase_price: initialData.purchase_price ?? null,
    sale_price: initialData.sale_price ?? null,
    model_id: initialData.model_id || ''
  }
}

export const normalizeQuickSaleModelOptions = (models: BrandModelOption[]): string[] =>
  models
    .filter((model) => model.status === 1)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((model) => model.name)

export const calculateQuickSaleSubsidyRemarks = (salePriceInput: number | string | null | undefined) => {
  const salePrice = parseFloat(String(salePriceInput)) || 0

  if (salePrice <= 0) {
    return {
      blocked: false,
      remarks: ''
    }
  }

  if (salePrice > 6000) {
    return {
      blocked: true,
      remarks: '',
      message: '销售金额超过6000元，无法使用国补刷卡，请重新选择支付方式'
    }
  }

  const discount = Math.min(salePrice * 0.15, 500)
  const roundedDiscount = Math.round(discount * 100) / 100
  const actualPayment = Math.round((salePrice - roundedDiscount) * 100) / 100

  return {
    blocked: false,
    remarks: `刷卡实际支付${actualPayment}元`
  }
}

export const sanitizeQuickSaleRemarks = (remarks: string) =>
  remarks
    .replace(/<[^>]*>/g, '')
    .replace(/["'<>]/g, '')
    .trim()
    .slice(0, 200)

export const shouldSearchQuickSaleCustomer = (query: string) => query.trim().length >= 3

export const buildQuickSaleCustomerSelectionPatch = (customer: CustomerOption) => {
  const normalizedCustomer = normalizeQuickSaleCustomerOption(customer)

  return {
    customer: normalizedCustomer,
    formPatch: {
      customer_phone: normalizedCustomer.phone,
      customer_name: normalizedCustomer.name,
      apple_id: normalizedCustomer.apple_id
    }
  }
}

export const buildQuickSaleCustomerClearedPatch = () => ({
  customer_name: '',
  apple_id: ''
})

export const buildQuickSaleCustomerSearchResetState = () => ({
  options: [] as CustomerOption[],
  foundCustomer: null as CustomerOption | null,
  visible: false,
  loading: false
})

export const buildQuickSaleBrandModels = (models: BrandModelOption[] | null | undefined) =>
  normalizeQuickSaleModelOptions(Array.isArray(models) ? models : [])
