import { unifiedApi } from '@/utils/unified-api'
import type { AccessoryPurchaseReturnContext, AccessoryPurchaseReturnQuote, AccessoryPurchaseReturnQuoteInput } from '@/types/accessory'

export const getAccessoryPurchaseReturnContext = (purchaseId: number, page: number, pageSize: number, signal: AbortSignal, serials?: { page: number; search: string }) =>
  unifiedApi.get<AccessoryPurchaseReturnContext>(`/supplier-payments/accessory-purchases/${purchaseId}/return-context`, {
    params: { page, page_size: pageSize, ...(serials ? { serial_page: serials.page, serial_search: serials.search } : {}) },
    signal, useCache: false, showLoading: false, showError: false
  })

export const quoteAccessoryPurchaseReturn = (purchaseId: number, input: AccessoryPurchaseReturnQuoteInput, signal: AbortSignal) =>
  unifiedApi.post<AccessoryPurchaseReturnQuote>(`/supplier-payments/accessory-purchases/${purchaseId}/return/quote`, input, {
    signal, useCache: false, showLoading: false, showError: false, cacheInvalidationScope: false
  })
