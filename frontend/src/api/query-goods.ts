import { unifiedApi } from '@/utils/unified-api'
import type { PaginatedResponse } from '@/types'
import type { CheckoutOrderDetail, CheckoutOrderSource } from '@/types/sales-checkout'
import type { CustomerGoodsRecord, GoodsAftersaleRecord } from '@/types/accessory'

export const getCustomerGoodsHistory = (customerId: number, page: number, pageSize: number, signal: AbortSignal, options: { filmOnly?: boolean } = {}) =>
  unifiedApi.get<Pick<PaginatedResponse<CustomerGoodsRecord>, 'data' | 'pagination'>>(`/query/customers/${customerId}/goods`, {
    params: { page, page_size: pageSize, ...(options.filmOnly ? { film_only: true } : {}) }, signal, useCache: false, showLoading: false, showError: false
  })

export const getGoodsAftersales = (saleId: number, page: number, pageSize: number, signal: AbortSignal) =>
  unifiedApi.get<Pick<PaginatedResponse<GoodsAftersaleRecord>, 'data' | 'pagination'>>(`/query/goods/${saleId}/aftersales`, {
    params: { page, page_size: pageSize }, signal, useCache: false, showLoading: false, showError: false
  })

export const getCheckoutOrder = (source: CheckoutOrderSource, saleId: number, signal: AbortSignal) =>
  unifiedApi.get<CheckoutOrderDetail>(`/query/${source === 'phone' ? 'sales' : 'goods'}/${saleId}/order`, {
    signal, useCache: false, showLoading: false, showError: false
  })
