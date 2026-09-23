import { computed, nextTick, ref, type Ref } from 'vue'
import { isValidMobilePhone, normalizeAppleId, normalizePersonName } from '@/utils/security'
import { unifiedApi as api } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import { getEffectivePhoneStatus, isPhoneSellable } from '@/constants/phoneStatuses'
import type { Operator, Phone } from '@/types'
import type { BatchSaleFormData, SalesCheckoutFormData, SalesCustomer } from './types'

export interface SalesPreorderInfo {
  preorder_id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  expected_price: string
  advance_payment: string
}

interface AuthUserIdentity {
  username?: string
  name?: string
}

interface UseSalesCheckoutOptions {
  saleForm: SalesCheckoutFormData
  batchSaleForm: BatchSaleFormData
  selectedPhone: Ref<Phone | null>
  selectedPhones: Ref<Phone[]>
  availablePhones: Ref<Phone[]>
  selectedCustomer: Ref<SalesCustomer | null>
  operators: Ref<Operator[]>
  batchMode: Ref<boolean>
  selectAll: Ref<boolean>
  showSaleModal: Ref<boolean>
  showSearchSection: Ref<boolean>
  submitting: Ref<boolean>
  todaySold: Ref<number>
  getTodayDate: () => string
  getCurrentUser: () => AuthUserIdentity | null | undefined
  canSell: () => boolean
  handleNoPermission: (_action: string) => unknown
  normalizeCustomerPhone: (_phone: unknown) => string
  resetCustomerForm: () => void
  loadAvailablePhones: () => unknown
  showError: (_message: string) => unknown
  showSuccess: (_message: string) => unknown
}

export const useSalesCheckout = ({
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
  getCurrentUser,
  canSell,
  handleNoPermission,
  normalizeCustomerPhone,
  resetCustomerForm,
  loadAvailablePhones,
  showError,
  showSuccess
}: UseSalesCheckoutOptions) => {
  const currentPreorderInfo = ref<{ preorder_id: string; advance_payment: number } | null>(null)
  const isPreorderDelivery = computed(() => currentPreorderInfo.value !== null)
  const saleCompleted = ref(false)

  const profit = computed(() => {
    if (!selectedPhone.value || !saleForm.sale_price || parseFloat(saleForm.sale_price) <= 0) {
      return null
    }
    const cost = parseFloat(String(saleForm.purchase_cost || selectedPhone.value.purchase_cost || 0))
    return (parseFloat(saleForm.sale_price) - cost).toFixed(2)
  })

  const isCurrentUser = (operator: Operator) => {
    const currentUser = getCurrentUser()
    if (!currentUser || !operator) return false
    return operator.username === currentUser.username || operator.name === currentUser.name
  }

  const getTotalCost = () => selectedPhones.value.reduce((sum, phone) => (
    sum + parseFloat(String(phone.purchase_cost || 0))
  ), 0)

  const getTotalProfit = computed(() => {
    const price = batchSaleForm.sale_price || saleForm.sale_price
    if (!price) return 0
    const totalRevenue = parseFloat(price) * selectedPhones.value.length
    return (totalRevenue - getTotalCost()).toFixed(2)
  })

  const profitMargin = computed(() => {
    if (!selectedPhone.value || !saleForm.sale_price || parseFloat(saleForm.sale_price) <= 0) {
      return '0.0'
    }
    const cost = parseFloat(String(saleForm.purchase_cost || selectedPhone.value.purchase_cost || 0))
    if (cost === 0) return '0.0'
    return ((parseFloat(saleForm.sale_price) - cost) / cost * 100).toFixed(1)
  })

  const profitClass = computed(() => {
    const profitValue = parseFloat(profit.value || '0')
    if (profitValue > 0) return 'positive'
    if (profitValue < 0) return 'negative'
    return 'zero'
  })

  const resetBatchSaleForm = () => {
    const currentUser = getCurrentUser()
    const matchedOperator = currentUser
      ? operators.value.find(operator => (
        operator.username === currentUser.username || operator.name === currentUser.name
      ))
      : undefined

    Object.assign(batchSaleForm, {
      customer_name: '',
      customer_phone: '',
      apple_id: '',
      sale_price: '',
      store_id: '',
      operator_id: matchedOperator ? String(matchedOperator.id) : '',
      sale_time: getTodayDate(),
      payment_method: '',
      payment_channel: '',
      transaction_no: '',
      remarks: ''
    })
  }

  const resetSaleForm = () => {
    const currentUser = getCurrentUser()
    const matchedOperator = currentUser
      ? operators.value.find(operator => (
        operator.username === currentUser.username || operator.name === currentUser.name
      ))
      : undefined

    Object.assign(saleForm, {
      customer_name: '',
      customer_phone: '',
      customer_apple_id: '',
      sale_price: '',
      purchase_cost: '',
      store_id: '',
      operator_id: matchedOperator ? String(matchedOperator.id) : '',
      sale_time: getTodayDate(),
      payment_method: '',
      payment_channel: '',
      transaction_no: '',
      remarks: ''
    })

    saleCompleted.value = false
    resetCustomerForm()
  }

  const closeSaleModal = () => {
    showSaleModal.value = false
    selectedPhone.value = null
    showSearchSection.value = true
    currentPreorderInfo.value = null
    resetSaleForm()
  }

  const openSaleModal = (phone: Phone) => {
    if (!canSell()) {
      handleNoPermission('sell')
      return false
    }

    if (getEffectivePhoneStatus(phone) === 'reserved') {
      if (!phone.preorder_id || !phone.preorder_customer_id) {
        showError('该设备已被预订，但未找到有效预定信息')
        return false
      }
      return openSaleModalWithPreorder(phone, {
        preorder_id: String(phone.preorder_id),
        customer_id: String(phone.preorder_customer_id),
        customer_name: phone.preorder_customer_name || '',
        customer_phone: phone.preorder_customer_phone || '',
        expected_price: String(phone.preorder_actual_price || phone.preorder_total_price || ''),
        advance_payment: String(phone.preorder_deposit_amount || '')
      })
    }

    showSearchSection.value = false
    selectedPhone.value = phone
    saleForm.sale_price = ''
    saleForm.purchase_cost = String(phone.purchase_cost || 0)
    saleForm.store_id = ''
    saleForm.remarks = phone.remarks || ''
    resetCustomerForm()
    showSaleModal.value = true
    return true
  }

  const openSaleModalWithPreorder = (phone: Phone, preorderInfo: SalesPreorderInfo) => {
    if (!canSell()) {
      handleNoPermission('sell')
      return false
    }

    showSearchSection.value = false
    selectedPhone.value = phone
    saleForm.purchase_cost = String(phone.purchase_cost || 0)
    saleForm.store_id = ''
    saleForm.remarks = phone.remarks || ''
    saleForm.customer_name = normalizePersonName(preorderInfo.customer_name || '', 20)
    saleForm.customer_phone = normalizeCustomerPhone(preorderInfo.customer_phone)
    saleForm.sale_price = preorderInfo.expected_price || ''

    currentPreorderInfo.value = {
      preorder_id: preorderInfo.preorder_id,
      advance_payment: parseFloat(preorderInfo.advance_payment) || 0
    }

    if (preorderInfo.customer_id) {
      selectedCustomer.value = {
        id: parseInt(preorderInfo.customer_id),
        name: normalizePersonName(preorderInfo.customer_name, 20),
        phone: normalizeCustomerPhone(preorderInfo.customer_phone)
      }
    }

    showSaleModal.value = true
    return true
  }

  const toggleBatchMode = () => {
    if (!canSell()) {
      handleNoPermission('sell')
      return
    }

    batchMode.value = !batchMode.value
    if (!batchMode.value) {
      selectedPhones.value = []
      selectAll.value = false
    }
  }

  const togglePhoneSelection = (phone: Phone) => {
    if (getEffectivePhoneStatus(phone) === 'reserved') {
      openSaleModal(phone)
      return
    }
    if (!isPhoneSellable(phone)) {
      showError('当前状态设备不能加入批量销售')
      return
    }
    const index = selectedPhones.value.findIndex(selected => selected.id === phone.id)
    if (index > -1) {
      selectedPhones.value.splice(index, 1)
    } else {
      selectedPhones.value.push(phone)
    }
    selectAll.value = selectedPhones.value.length === availablePhones.value.filter(item => getEffectivePhoneStatus(item) === 'in_stock').length
  }

  const handleSaleAction = (phone: Phone) => {
    if (batchMode.value) {
      togglePhoneSelection(phone)
    } else {
      openSaleModal(phone)
    }
  }

  const toggleSelectAll = async () => {
    selectedPhones.value = selectAll.value
      ? availablePhones.value.filter(phone => getEffectivePhoneStatus(phone) === 'in_stock')
      : []
    await nextTick()
  }

  const clearBatchSelection = () => {
    selectedPhones.value = []
    selectAll.value = false
    resetBatchSaleForm()
  }

  const setDefaultOperator = () => {
    const currentUser = getCurrentUser()
    if (!currentUser || !operators.value.length) return

    const matchedOperator = operators.value.find(operator => (
      operator.username === currentUser.username || operator.name === currentUser.name
    ))
    if (matchedOperator) {
      batchSaleForm.operator_id = String(matchedOperator.id)
      saleForm.operator_id = String(matchedOperator.id)
    }
  }

  const submitBatchSale = async () => {
    if (submitting.value) return

    const normalizedCustomerPhone = normalizeCustomerPhone(batchSaleForm.customer_phone)
    const normalizedCustomerName = normalizePersonName(batchSaleForm.customer_name, 20)
    const normalizedAppleId = normalizeAppleId(batchSaleForm.apple_id)

    if (!normalizedCustomerName) {
      showError('请输入客户姓名')
      return
    }
    if (!normalizedCustomerPhone) {
      showError('请输入客户电话')
      return
    }
    if (!isValidMobilePhone(normalizedCustomerPhone)) {
      showError('请输入有效的手机号码')
      return
    }
    if (!batchSaleForm.sale_price || parseFloat(batchSaleForm.sale_price) <= 0) {
      showError('销售单价必须大于0')
      return
    }
    if (!batchSaleForm.store_id) {
      showError('请选择销售店铺')
      return
    }
    if (!batchSaleForm.operator_id) {
      showError('请选择销售员')
      return
    }
    if (!batchSaleForm.payment_method) {
      showError('请选择支付方式')
      return
    }

    submitting.value = true
    try {
      const operator = operators.value.find(item => String(item.id) === batchSaleForm.operator_id)
      const operatorName = operator?.name || operator?.username || ''
      const selectedCount = selectedPhones.value.length
      const response = await api.post('/sales/phone', {
        phones: selectedPhones.value.map(phone => ({
          phone_id: phone.id,
          sale_price: parseFloat(batchSaleForm.sale_price)
        })),
        customer_info: {
          name: normalizedCustomerName,
          phone: normalizedCustomerPhone,
          apple_id: normalizedAppleId || '',
          address: '',
          remarks: batchSaleForm.remarks
        },
        sale_type: 'batch',
        store_id: batchSaleForm.store_id,
        operator_id: batchSaleForm.operator_id,
        operator_name: operatorName,
        sale_time: batchSaleForm.sale_time || getTodayDate(),
        payment_info: {
          payment_method: batchSaleForm.payment_method,
          payment_channel: batchSaleForm.payment_channel || null,
          transaction_no: batchSaleForm.transaction_no || null,
          payment_amount: parseFloat(batchSaleForm.sale_price) * selectedCount,
          payment_status: 'success',
          payment_time: batchSaleForm.sale_time || getTodayDate()
        },
        remarks: batchSaleForm.remarks
      }, { showError: false })

      if (response.success) {
        const pointsEarned = Number(response.data?.points_earned) || 0
        showSuccess(`批量销售成功！共销售 ${selectedCount} 台设备${pointsEarned > 0 ? `，本单获得 ${pointsEarned} 积分` : ''}`)
        clearBatchSelection()
        await loadAvailablePhones()
        todaySold.value += selectedCount
      } else {
        showError(response.message || '批量销售失败')
      }
    } catch (error) {
      logger.error('批量销售失败:', error)
      showError('批量销售失败，请稍后重试')
    } finally {
      submitting.value = false
    }
  }

  const handleSale = async () => {
    if (submitting.value || !selectedPhone.value) return

    const normalizedCustomerPhone = normalizeCustomerPhone(saleForm.customer_phone)
    const normalizedCustomerName = normalizePersonName(saleForm.customer_name, 20)
    const normalizedAppleId = normalizeAppleId(saleForm.customer_apple_id)

    if (!canSell()) {
      handleNoPermission('sell')
      return
    }
    if (!normalizedCustomerName) {
      showError('请输入客户姓名')
      return
    }
    if (!normalizedCustomerPhone) {
      showError('请输入客户手机号码')
      return
    }
    if (!isValidMobilePhone(normalizedCustomerPhone)) {
      showError('请输入有效的手机号码')
      return
    }
    if (!saleForm.sale_price || parseFloat(saleForm.sale_price) <= 0) {
      showError('销售价格必须大于0')
      return
    }
    if (!saleForm.store_id) {
      showError('请选择销售门店')
      return
    }
    if (!saleForm.operator_id) {
      showError('请选择销售员')
      return
    }
    if (!saleForm.payment_method) {
      showError('请选择支付方式')
      return
    }

    submitting.value = true
    try {
      const operator = operators.value.find(item => String(item.id) === saleForm.operator_id)
      const operatorName = operator?.name || operator?.username || ''
      const batchCount = selectedPhones.value.length
      const saleData = batchMode.value
        ? {
          phones: selectedPhones.value.map(phone => ({
            phone_id: phone.id,
            sale_price: parseFloat(saleForm.sale_price),
            purchase_cost: saleForm.purchase_cost !== undefined && saleForm.purchase_cost !== ''
              ? parseFloat(saleForm.purchase_cost)
              : phone.purchase_cost
          })),
          customer_info: {
            name: normalizedCustomerName,
            phone: normalizedCustomerPhone,
            apple_id: normalizedAppleId || '',
            address: '',
            remarks: saleForm.remarks
          },
          sale_type: 'batch',
          store_id: saleForm.store_id,
          operator_name: operatorName,
          sale_time: saleForm.sale_time || getTodayDate(),
          payment_info: {
            payment_method: saleForm.payment_method,
            payment_channel: saleForm.payment_channel || null,
            transaction_no: saleForm.transaction_no || null,
            payment_amount: parseFloat(saleForm.sale_price) * batchCount,
            payment_status: 'success',
            payment_time: saleForm.sale_time || getTodayDate()
          },
          remarks: saleForm.remarks
        }
        : {
          phone_id: selectedPhone.value.id,
          customer_info: {
            name: normalizedCustomerName,
            phone: normalizedCustomerPhone,
            apple_id: normalizedAppleId || '',
            address: '',
            remarks: saleForm.remarks
          },
          sale_type: 'retail',
          sale_price: parseFloat(saleForm.sale_price),
          purchase_cost: saleForm.purchase_cost !== undefined && saleForm.purchase_cost !== ''
            ? parseFloat(saleForm.purchase_cost)
            : selectedPhone.value.purchase_cost,
          sale_time: saleForm.sale_time || getTodayDate(),
          store_id: saleForm.store_id,
          operator_id: saleForm.operator_id,
          operator_name: operatorName,
          payment_info: {
            payment_method: saleForm.payment_method,
            payment_channel: saleForm.payment_channel || null,
            transaction_no: saleForm.transaction_no || null,
            payment_amount: parseFloat(saleForm.sale_price),
            payment_status: 'success',
            payment_time: saleForm.sale_time || getTodayDate()
          },
          remarks: saleForm.remarks,
          preorder_id: currentPreorderInfo.value?.preorder_id || null,
          advance_payment: currentPreorderInfo.value?.advance_payment || 0
        }

      const response = await api.post('/sales/phone', saleData, { showError: false })
      if (response.success) {
        const pointsEarned = Number(response.data?.points_earned) || 0
        const pointsMessage = pointsEarned > 0 ? `，本单获得 ${pointsEarned} 积分` : ''
        showSuccess(batchMode.value
          ? `批量销售成功！共销售 ${batchCount} 台设备${pointsMessage}`
          : `销售出库成功！${pointsMessage}`)
        saleCompleted.value = true
        closeSaleModal()
        if (batchMode.value) {
          selectedPhones.value = []
          selectAll.value = false
        }
        await loadAvailablePhones()
        todaySold.value += batchMode.value ? batchCount : 1
      } else {
        showError(response.message || '销售出库失败')
      }
    } catch (error) {
      logger.error('销售出库失败:', error)
      showError('销售出库失败，请稍后重试')
    } finally {
      submitting.value = false
    }
  }

  return {
    profit,
    profitMargin,
    profitClass,
    isPreorderDelivery,
    getTotalCost,
    getTotalProfit,
    isCurrentUser,
    openSaleModal,
    openSaleModalWithPreorder,
    closeSaleModal,
    resetSaleForm,
    toggleBatchMode,
    handleSaleAction,
    togglePhoneSelection,
    toggleSelectAll,
    clearBatchSelection,
    setDefaultOperator,
    submitBatchSale,
    handleSale
  }
}
