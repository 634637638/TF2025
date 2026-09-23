import { nextTick, ref, type Ref } from 'vue'
import { extractResponseData } from '@/utils/api-response'
import {
  isValidMobilePhone,
  normalizeAppleId,
  normalizePersonName,
  normalizePhoneDigits,
  resolveAppleAccountEmail
} from '@/utils/security'
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import type {
  BatchCustomer,
  BatchSaleFormData,
  SalesCheckoutFormData,
  SalesCustomer
} from './types'

interface CustomerNameInputExpose {
  input?: HTMLInputElement | null
}

interface UseSalesCustomersOptions {
  saleForm: SalesCheckoutFormData
  batchSaleForm: BatchSaleFormData
  saleCustomerNameInputRef: Ref<CustomerNameInputExpose | null>
  batchCustomerNameInputRef: Ref<CustomerNameInputExpose | null>
  isIOS: () => boolean
  showError: (_message: string) => unknown
  showWarning: (_message: string) => unknown
  showSuccess: (_message: string) => unknown
}

type InputValue = string | Event | { target?: EventTarget | null } | null | undefined

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const candidate = error as { response?: { data?: { message?: unknown } } }
  return typeof candidate?.response?.data?.message === 'string'
    ? candidate.response.data.message
    : fallback
}

const readInputValue = (valueOrEvent: InputValue) => {
  if (typeof valueOrEvent === 'string') {
    return valueOrEvent
  }

  const target = valueOrEvent?.target
  return target instanceof HTMLInputElement ? target.value : ''
}

const buildCustomerPayload = (name: string, phone: string, appleId: string) => ({
  name,
  phone,
  apple_id: appleId || null,
  email: resolveAppleAccountEmail(appleId),
  gender: null,
  birthday: null,
  id_card: null,
  address: null,
  city: null,
  province: null,
  postal_code: null,
  customer_type: 'individual',
  vip_level: 'normal',
  notes: '通过销售系统创建',
  tags: null,
  blacklist: 0,
  credit_rating: 'good',
  preferred_contact: 'phone',
  source: 'sales'
})

export const useSalesCustomers = ({
  saleForm,
  batchSaleForm,
  saleCustomerNameInputRef,
  batchCustomerNameInputRef,
  isIOS,
  showError,
  showWarning,
  showSuccess
}: UseSalesCustomersOptions) => {
  const customerEditSubmitting = ref(false)
  const customerNameEditing = ref(false)
  const batchCustomerNameEditing = ref(false)
  const customerCreating = ref(false)
  const batchCustomerCreating = ref(false)
  const customerNameLastTapAt = ref(0)
  const batchCustomerNameLastTapAt = ref(0)

  const customerSearchResults = ref<SalesCustomer[]>([])
  const selectedCustomer = ref<SalesCustomer | null>(null)
  const showCustomerSearch = ref(false)
  const customerSearching = ref(false)

  const batchCustomerSearchResults = ref<BatchCustomer[]>([])
  const selectedBatchCustomer = ref<BatchCustomer | null>(null)
  const showBatchCustomerSearch = ref(false)
  const batchCustomerSearching = ref(false)
  const lastBatchSearchPhone = ref('')

  let customerSearchTimeout: ReturnType<typeof setTimeout> | null = null
  let batchCustomerSearchTimeout: ReturnType<typeof setTimeout> | null = null
  let batchCustomerBlurTimeout: ReturnType<typeof setTimeout> | null = null

  const normalizeCustomerPhone = (phone: unknown) => normalizePhoneDigits(phone)

  const handleCustomerNameInput = (valueOrEvent: InputValue) => {
    saleForm.customer_name = normalizePersonName(readInputValue(valueOrEvent), 20)
  }

  const handleCustomerAppleIdInput = (valueOrEvent: InputValue) => {
    saleForm.customer_apple_id = normalizeAppleId(readInputValue(valueOrEvent))
  }

  const handleBatchCustomerNameInput = (valueOrEvent: InputValue) => {
    batchSaleForm.customer_name = normalizePersonName(readInputValue(valueOrEvent), 20)
  }

  const handleBatchCustomerAppleIdInput = (valueOrEvent: InputValue) => {
    batchSaleForm.apple_id = normalizeAppleId(readInputValue(valueOrEvent))
  }

  const searchCustomers = async (phoneNumber: string) => {
    try {
      customerSearching.value = true
      const response = await api.get(`/sales/customers?search=${encodeURIComponent(phoneNumber)}`)

      customerSearchResults.value = response.success
        ? extractResponseData<SalesCustomer[]>(response)
        : []
    } catch (error) {
      logger.error('搜索客户失败:', error)
      customerSearchResults.value = []
    } finally {
      customerSearching.value = false
    }
  }

  const handleCustomerSearch = (valueOrEvent: InputValue) => {
    const cleanedValue = normalizeCustomerPhone(readInputValue(valueOrEvent))
    saleForm.customer_phone = cleanedValue

    if (selectedCustomer.value && normalizeCustomerPhone(selectedCustomer.value.phone) !== cleanedValue) {
      selectedCustomer.value = null
      customerCreating.value = false
    }

    if (customerSearchTimeout) {
      clearTimeout(customerSearchTimeout)
      customerSearchTimeout = null
    }

    if (!cleanedValue) {
      customerSearchResults.value = []
      return
    }

    customerSearchTimeout = setTimeout(() => {
      void searchCustomers(cleanedValue)
    }, 300)
  }

  const resolveNativeCustomerInput = (source: unknown): HTMLInputElement | null => {
    if (!source) {
      return null
    }

    if (source instanceof HTMLInputElement) {
      return source
    }

    if (source instanceof HTMLElement) {
      const nestedInput = source.querySelector('input, textarea')
      return nestedInput instanceof HTMLInputElement ? nestedInput : null
    }

    const candidate = source as {
      target?: EventTarget | null
      input?: HTMLInputElement | null
      $el?: HTMLElement
    }

    if (candidate.target instanceof HTMLInputElement) {
      return candidate.target
    }

    if (candidate.target instanceof HTMLElement) {
      const nestedInput = candidate.target.querySelector('input, textarea')
      if (nestedInput instanceof HTMLInputElement) {
        return nestedInput
      }
    }

    if (candidate.input instanceof HTMLInputElement) {
      return candidate.input
    }

    const nestedInput = candidate.$el?.querySelector('input')
    return nestedInput instanceof HTMLInputElement ? nestedInput : null
  }

  const focusCustomerNameInput = (input: HTMLInputElement | null) => {
    if (!input) {
      return
    }

    input.readOnly = false
    input.removeAttribute('readonly')
    input.disabled = false
    input.removeAttribute('disabled')
    input.focus({ preventScroll: true })
    input.click()

    const textLength = input.value?.length || 0
    try {
      if (isIOS()) {
        input.setSelectionRange(textLength, textLength)
      } else {
        input.select()
      }
    } catch {
      // Some embedded browsers do not support selection ranges on every input type.
    }
  }

  const promptCustomerNameForIOS = async (
    currentName: string,
    onConfirm: (_nextName: string) => Promise<void> | void
  ) => {
    const promptedName = window.prompt('请输入客户姓名', currentName)
    if (promptedName === null) {
      return
    }

    const normalizedName = normalizePersonName(promptedName, 20)
    if (!normalizedName) {
      showWarning('客户姓名不能为空')
      return
    }

    await onConfirm(normalizedName)
  }

  const unlockCustomerNameFromTouch = (
    source: EventTarget | null | undefined,
    unlockEditing: () => void,
    fallbackName: string
  ) => {
    const touchedInput = resolveNativeCustomerInput(source)
    const fallbackInput = resolveNativeCustomerInput(document.querySelector(`input[name="${fallbackName}"]`))

    unlockEditing()
    const targetInput = touchedInput || fallbackInput
    if (!targetInput) {
      return
    }

    targetInput.readOnly = false
    targetInput.removeAttribute('readonly')
    targetInput.disabled = false
    targetInput.removeAttribute('disabled')
    targetInput.focus()
    targetInput.click()

    try {
      const textLength = targetInput.value?.length || 0
      targetInput.setSelectionRange(textLength, textLength)
    } catch {
      // Some embedded browsers do not support selection ranges on every input type.
    }
  }

  const handleTouchBasedCustomerUnlock = (
    event: TouchEvent,
    lastTapRef: Ref<number>,
    unlock: () => void,
    fallbackName: string,
    iosPromptHandler?: () => Promise<void> | void
  ) => {
    if (!isIOS()) {
      return
    }

    const now = Date.now()
    const interval = now - lastTapRef.value
    lastTapRef.value = now

    if (interval > 0 && interval < 320) {
      if (iosPromptHandler) {
        void iosPromptHandler()
        return
      }
      unlockCustomerNameFromTouch(event.target, unlock, fallbackName)
    }
  }

  const enableCustomerNameEdit = (event?: MouseEvent) => {
    if (!selectedCustomer.value) return
    customerNameEditing.value = true

    focusCustomerNameInput(
      resolveNativeCustomerInput(event) || resolveNativeCustomerInput(saleCustomerNameInputRef.value)
    )

    nextTick(() => {
      focusCustomerNameInput(
        resolveNativeCustomerInput(saleCustomerNameInputRef.value) ||
        document.querySelector('input[name="sale-customer-name"]')
      )
    })
  }

  const saveCustomerNameEdit = async () => {
    if (!selectedCustomer.value || !saleForm.customer_name.trim()) {
      showError('客户姓名不能为空')
      return
    }

    const normalizedCustomerName = normalizePersonName(saleForm.customer_name, 20)
    if (!normalizedCustomerName) {
      showError('客户姓名不能为空')
      return
    }

    if (normalizedCustomerName === normalizePersonName(selectedCustomer.value.name, 20)) {
      saleForm.customer_name = normalizedCustomerName
      customerNameEditing.value = false
      return
    }

    customerEditSubmitting.value = true
    try {
      const response = await api.put(`/customers/${selectedCustomer.value.id}`, {
        name: normalizedCustomerName
      })

      if (response.success) {
        selectedCustomer.value.name = normalizedCustomerName
        saleForm.customer_name = normalizedCustomerName
        showSuccess('客户姓名更新成功')
      } else {
        showError(response.message || '更新失败')
      }
    } catch (error: unknown) {
      logger.error('更新客户失败:', error)
      showError(getApiErrorMessage(error, '更新客户失败'))
    } finally {
      customerEditSubmitting.value = false
      customerNameEditing.value = false
    }
  }

  const handleCustomerNameTouchEnd = (event: TouchEvent) => {
    handleTouchBasedCustomerUnlock(
      event,
      customerNameLastTapAt,
      () => enableCustomerNameEdit(),
      'sale-customer-name',
      () => {
        if (!selectedCustomer.value) return
        return promptCustomerNameForIOS(saleForm.customer_name, async nextName => {
          saleForm.customer_name = nextName
          await saveCustomerNameEdit()
        })
      }
    )
  }

  const createNewCustomer = async () => {
    const normalizedCustomerPhone = normalizeCustomerPhone(saleForm.customer_phone)
    const normalizedCustomerName = normalizePersonName(saleForm.customer_name, 20)
    const normalizedAppleId = normalizeAppleId(saleForm.customer_apple_id)

    if (!isValidMobilePhone(normalizedCustomerPhone)) {
      showError('请输入有效的手机号码')
      customerSearching.value = false
      return
    }

    if (!customerCreating.value) {
      customerCreating.value = true
      customerNameEditing.value = true
      showCustomerSearch.value = false
      nextTick(() => {
        focusCustomerNameInput(
          resolveNativeCustomerInput(saleCustomerNameInputRef.value) ||
          document.querySelector('input[name="sale-customer-name"]')
        )
      })
      return
    }

    if (!normalizedCustomerName) {
      showError('请输入客户姓名')
      return
    }

    customerSearching.value = true
    try {
      const response = await api.post(
        '/customers',
        buildCustomerPayload(normalizedCustomerName, normalizedCustomerPhone, normalizedAppleId),
        { showError: false }
      )

      if (response.success && response.data) {
        const newCustomer = response.data as SalesCustomer
        selectedCustomer.value = newCustomer
        saleForm.customer_phone = normalizeCustomerPhone(newCustomer.phone)
        saleForm.customer_name = normalizePersonName(newCustomer.name, 20)
        saleForm.customer_apple_id = normalizeAppleId(newCustomer.apple_id || '')
        customerCreating.value = false
        customerNameEditing.value = false
        showCustomerSearch.value = false
        customerSearchResults.value = []
        showSuccess(`新客户 "${saleForm.customer_name}" 创建成功`)
        return
      }

      showError(response.message || '创建客户失败')
    } catch (error: unknown) {
      logger.error('创建客户失败:', error)
      showError(getApiErrorMessage(error, '创建客户失败'))
    } finally {
      customerSearching.value = false
    }
  }

  const handleCustomerNameBlur = () => {
    if (customerCreating.value && !selectedCustomer.value) {
      void createNewCustomer()
      return
    }

    if (customerNameEditing.value && selectedCustomer.value) {
      void saveCustomerNameEdit()
    } else {
      customerNameEditing.value = false
    }
  }

  const selectCustomer = (customer: SalesCustomer) => {
    selectedCustomer.value = customer
    saleForm.customer_phone = normalizeCustomerPhone(customer.phone)
    saleForm.customer_name = normalizePersonName(customer.name, 20)
    saleForm.customer_apple_id = normalizeAppleId(customer.apple_id || '')
    customerNameEditing.value = false
    customerCreating.value = false
    showCustomerSearch.value = false
    customerSearchResults.value = []
  }

  const clearSelectedCustomer = () => {
    selectedCustomer.value = null
    saleForm.customer_phone = ''
    saleForm.customer_name = ''
    saleForm.customer_apple_id = ''
    customerNameEditing.value = false
    customerCreating.value = false
  }

  const resetCustomerForm = () => {
    selectedCustomer.value = null
    saleForm.customer_name = ''
    saleForm.customer_phone = ''
    saleForm.customer_apple_id = ''
    showCustomerSearch.value = false
    customerSearchResults.value = []
  }

  const searchBatchCustomers = async (phone: string) => {
    if (!phone) {
      batchCustomerSearchResults.value = []
      batchCustomerSearching.value = false
      return
    }

    try {
      const response = await api.get(`/sales/customers?search=${encodeURIComponent(phone)}`)
      batchCustomerSearchResults.value = response.success
        ? extractResponseData<BatchCustomer[]>(response)
        : []
    } catch (error) {
      logger.error('批量搜索客户失败:', error)
      batchCustomerSearchResults.value = []
    } finally {
      batchCustomerSearching.value = false
    }
  }

  const handleBatchCustomerPhoneInput = () => {
    const cleanedValue = normalizeCustomerPhone(batchSaleForm.customer_phone)
    batchSaleForm.customer_phone = cleanedValue

    if (
      selectedBatchCustomer.value &&
      normalizeCustomerPhone(selectedBatchCustomer.value.phone) !== cleanedValue
    ) {
      selectedBatchCustomer.value = null
      batchCustomerCreating.value = false
    }

    if (batchCustomerSearchTimeout) {
      clearTimeout(batchCustomerSearchTimeout)
      batchCustomerSearchTimeout = null
    }

    if (!cleanedValue) {
      batchCustomerSearchResults.value = []
      showBatchCustomerSearch.value = false
      lastBatchSearchPhone.value = ''
      return
    }

    if (cleanedValue === lastBatchSearchPhone.value) {
      return
    }
    lastBatchSearchPhone.value = cleanedValue
    batchCustomerSearching.value = true
    showBatchCustomerSearch.value = true
    batchCustomerSearchTimeout = setTimeout(() => {
      void searchBatchCustomers(cleanedValue)
    }, 200)
  }

  const handleBatchCustomerBlur = () => {
    if (batchCustomerBlurTimeout) {
      clearTimeout(batchCustomerBlurTimeout)
    }
    batchCustomerBlurTimeout = setTimeout(() => {
      showBatchCustomerSearch.value = false
    }, 200)
  }

  const enableBatchCustomerNameEdit = (event?: MouseEvent) => {
    if (!selectedBatchCustomer.value) return
    batchCustomerNameEditing.value = true

    focusCustomerNameInput(
      resolveNativeCustomerInput(event) || resolveNativeCustomerInput(batchCustomerNameInputRef.value)
    )

    nextTick(() => {
      focusCustomerNameInput(
        resolveNativeCustomerInput(batchCustomerNameInputRef.value) ||
        document.querySelector('input[name="batch-customer-name"]')
      )
    })
  }

  const saveBatchCustomerNameEdit = async () => {
    if (!selectedBatchCustomer.value || !batchSaleForm.customer_name.trim()) {
      showError('客户姓名不能为空')
      return
    }

    const normalizedCustomerName = normalizePersonName(batchSaleForm.customer_name, 20)
    if (!normalizedCustomerName) {
      showError('客户姓名不能为空')
      return
    }

    if (normalizedCustomerName === normalizePersonName(selectedBatchCustomer.value.name, 20)) {
      batchSaleForm.customer_name = normalizedCustomerName
      batchCustomerNameEditing.value = false
      return
    }

    customerEditSubmitting.value = true
    try {
      const response = await api.put(`/customers/${selectedBatchCustomer.value.id}`, {
        name: normalizedCustomerName
      })

      if (response.success) {
        selectedBatchCustomer.value.name = normalizedCustomerName
        batchSaleForm.customer_name = normalizedCustomerName
        showSuccess('客户姓名更新成功')
      } else {
        showError(response.message || '更新失败')
      }
    } catch (error: unknown) {
      logger.error('更新客户失败:', error)
      showError(getApiErrorMessage(error, '更新客户失败'))
    } finally {
      customerEditSubmitting.value = false
      batchCustomerNameEditing.value = false
    }
  }

  const handleBatchCustomerNameTouchEnd = (event: TouchEvent) => {
    handleTouchBasedCustomerUnlock(
      event,
      batchCustomerNameLastTapAt,
      () => enableBatchCustomerNameEdit(),
      'batch-customer-name',
      () => {
        if (!selectedBatchCustomer.value) return
        return promptCustomerNameForIOS(batchSaleForm.customer_name, async nextName => {
          batchSaleForm.customer_name = nextName
          await saveBatchCustomerNameEdit()
        })
      }
    )
  }

  const createNewBatchCustomer = async () => {
    const normalizedCustomerPhone = normalizeCustomerPhone(batchSaleForm.customer_phone)
    const normalizedCustomerName = normalizePersonName(batchSaleForm.customer_name, 20)
    const normalizedAppleId = normalizeAppleId(batchSaleForm.apple_id)

    if (!isValidMobilePhone(normalizedCustomerPhone)) {
      showError('请输入有效的手机号码')
      batchCustomerSearching.value = false
      return
    }

    if (!batchCustomerCreating.value) {
      batchCustomerCreating.value = true
      batchCustomerNameEditing.value = true
      showBatchCustomerSearch.value = false
      nextTick(() => {
        focusCustomerNameInput(
          resolveNativeCustomerInput(batchCustomerNameInputRef.value) ||
          document.querySelector('input[name="batch-customer-name"]')
        )
      })
      return
    }

    if (!normalizedCustomerName) {
      showError('请输入客户姓名')
      return
    }

    batchCustomerSearching.value = true
    try {
      const response = await api.post(
        '/customers',
        buildCustomerPayload(normalizedCustomerName, normalizedCustomerPhone, normalizedAppleId),
        { showError: false }
      )

      if (response.success && response.data) {
        const newCustomer = response.data as BatchCustomer
        selectedBatchCustomer.value = newCustomer
        batchSaleForm.customer_phone = normalizeCustomerPhone(newCustomer.phone)
        batchSaleForm.customer_name = normalizePersonName(newCustomer.name, 20)
        batchSaleForm.apple_id = normalizeAppleId(newCustomer.apple_id || '')
        batchCustomerCreating.value = false
        batchCustomerNameEditing.value = false
        showBatchCustomerSearch.value = false
        batchCustomerSearchResults.value = []
        showSuccess(`新客户 "${batchSaleForm.customer_name}" 创建成功`)
        return
      }

      showError(response.message || '创建客户失败')
    } catch (error: unknown) {
      logger.error('创建客户失败:', error)
      showError(getApiErrorMessage(error, '创建客户失败'))
    } finally {
      batchCustomerSearching.value = false
    }
  }

  const disableBatchCustomerNameEdit = () => {
    if (batchCustomerCreating.value && !selectedBatchCustomer.value) {
      void createNewBatchCustomer()
      return
    }

    if (batchCustomerNameEditing.value && selectedBatchCustomer.value) {
      void saveBatchCustomerNameEdit()
    } else {
      batchCustomerNameEditing.value = false
    }
  }

  const selectBatchCustomer = (customer: BatchCustomer) => {
    selectedBatchCustomer.value = customer
    batchSaleForm.customer_name = normalizePersonName(customer.name, 20)
    batchSaleForm.customer_phone = normalizeCustomerPhone(customer.phone)
    batchSaleForm.apple_id = normalizeAppleId(customer.apple_id || '')
    batchCustomerNameEditing.value = false
    batchCustomerCreating.value = false
    showBatchCustomerSearch.value = false
  }

  const clearSelectedBatchCustomer = () => {
    selectedBatchCustomer.value = null
    batchSaleForm.customer_name = ''
    batchSaleForm.customer_phone = ''
    batchSaleForm.apple_id = ''
    batchCustomerNameEditing.value = false
    batchCustomerCreating.value = false
  }

  const disposeSalesCustomers = () => {
    if (customerSearchTimeout) clearTimeout(customerSearchTimeout)
    if (batchCustomerSearchTimeout) clearTimeout(batchCustomerSearchTimeout)
    if (batchCustomerBlurTimeout) clearTimeout(batchCustomerBlurTimeout)
    customerSearchTimeout = null
    batchCustomerSearchTimeout = null
    batchCustomerBlurTimeout = null
  }

  return {
    customerEditSubmitting,
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
  }
}
