import { unifiedApi } from '@/utils/unified-api'
import type { PhoneReceiptAccessory } from '@/types/sales-receipt'

export const getPhoneReceiptAccessories = (saleId: number, signal: AbortSignal) =>
  unifiedApi.get<PhoneReceiptAccessory[]>(`/query/sales/${saleId}/accessories`, {
    signal, useCache: false, showLoading: false, showError: false
  })
