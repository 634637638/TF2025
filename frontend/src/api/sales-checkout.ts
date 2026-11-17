import { unifiedApi } from '@/utils/unified-api'
import type { PaginatedResponse } from '@/types'
import type { CheckoutCustomerSummary, CheckoutGoodsOption, CheckoutPointsQuote, SalesCheckoutInput, SalesCheckoutResult,
  GoodsReturnContext, GoodsReturnInput, GoodsReturnQuote, GoodsReturnResult, PhoneReturnSource,
  PhoneReturnInput, PhoneReturnQuote, PhoneReturnResult, GoodsExchangeContext, GoodsExchangeInput, GoodsExchangeQuote, GoodsExchangeResult, FilmServiceContext } from '@/types/sales-checkout'

export const getCheckoutGoods = (params: { store_id: number; search: string; page: number; page_size: number; film_only?: boolean; film_free_only?: boolean; film_model_id?: number; search_mode?: 'regular' | 'serial'; match_mode?: 'exact'; source?: 'accessories' | 'query' }, signal: AbortSignal) => {
  const { source, ...query } = params
  return unifiedApi.get<Pick<PaginatedResponse<CheckoutGoodsOption>, 'data'> & { pagination: Pick<PaginatedResponse['pagination'], 'total'> }>(source === 'query' ? '/query/goods/sale-options' : '/accessories/sale-options', {
    params: query, signal, useCache: false, showLoading: false, showError: false
  })
}

export const getCheckoutCustomerSummary = (params: { phone: string; store_id: number; context?: 'phone' | 'goods' }, signal: AbortSignal, fieldSource: 'accessories' | 'query' = 'accessories') =>
  unifiedApi.get<CheckoutCustomerSummary>(fieldSource === 'query' ? '/query/goods/checkout/customer-summary' : '/sales/checkout/customer-summary', { params, signal, useCache: false, showLoading: false, showError: false })

export const getFilmCustomerSummary = (customerId: number, storeId: number, signal: AbortSignal) =>
  unifiedApi.get<CheckoutCustomerSummary>(`/query/customers/${customerId}/film-services/customer-summary`, {
    params: { customer_id: customerId, store_id: storeId }, signal, useCache: false, showLoading: false, showError: false
  })

export const checkoutSale = (input: SalesCheckoutInput, fieldSource: 'accessories' | 'query' = 'accessories') => unifiedApi.post<SalesCheckoutResult>(input.film_service ? '/query/film-services/checkout' : fieldSource === 'query' ? '/query/goods/checkout' : '/sales/checkout', input)

export const getFilmProducts = (customerId: number, params: { phone_id: number; store_id: number; search: string; page: number; page_size: number; free_only?: boolean; search_mode?: 'regular' | 'serial' }, signal: AbortSignal) =>
  unifiedApi.get<Pick<PaginatedResponse<CheckoutGoodsOption>, 'data'> & { pagination: Pick<PaginatedResponse['pagination'], 'total'> }>(`/query/customers/${customerId}/film-services/products`, {
    params, signal, useCache: false, showLoading: false, showError: false
  })

export const getFilmServiceContext = (customerId: number, page: number, pageSize: number, signal: AbortSignal, phoneId?: number, saleType?: 'sale' | 'gift') =>
  unifiedApi.get<FilmServiceContext>(`/query/customers/${customerId}/film-services`, {
    params: { page, page_size: pageSize, ...(phoneId ? { phone_id: phoneId } : {}), ...(saleType ? { sale_type: saleType } : {}) }, signal, useCache: false, showLoading: false, showError: false
  })

export const quoteCheckoutSale = (input: SalesCheckoutInput, signal: AbortSignal, autoRedeem = false, fieldSource: 'accessories' | 'query' = 'accessories') =>
  unifiedApi.post<CheckoutPointsQuote>(input.film_service ? '/query/film-services/checkout/quote' : fieldSource === 'query' ? '/query/goods/checkout/quote' : '/sales/checkout/quote', autoRedeem ? { ...input, auto_redeem: true } : input, { signal, showLoading: false })

const goodsReturnPath = (orderId: number, itemId: number) => `/sales/checkout/${orderId}/items/${itemId}/return`
export const getGoodsReturnContext = (orderId: number, itemId: number, signal: AbortSignal) =>
  unifiedApi.get<GoodsReturnContext>(goodsReturnPath(orderId, itemId), { signal, useCache: false, showLoading: false })
export const quoteGoodsReturn = (orderId: number, itemId: number, input: GoodsReturnInput, signal: AbortSignal) =>
  unifiedApi.post<GoodsReturnQuote>(`${goodsReturnPath(orderId, itemId)}/quote`, input, { signal, showLoading: false })
export const submitGoodsReturn = (orderId: number, itemId: number, input: GoodsReturnInput) =>
  unifiedApi.post<GoodsReturnResult>(goodsReturnPath(orderId, itemId), input, { showLoading: false })

const goodsExchangePath = (orderId: number, itemId: number) => `/sales/checkout/${orderId}/items/${itemId}/exchange`
export const getGoodsExchangeContext = (orderId: number, itemId: number, signal: AbortSignal) =>
  unifiedApi.get<GoodsExchangeContext>(goodsExchangePath(orderId, itemId), { signal, useCache: false, showLoading: false })
export const quoteGoodsExchange = (orderId: number, itemId: number, input: GoodsExchangeInput, signal: AbortSignal) =>
  unifiedApi.post<GoodsExchangeQuote>(`${goodsExchangePath(orderId, itemId)}/quote`, input, { signal, showLoading: false })
export const submitGoodsExchange = (orderId: number, itemId: number, input: GoodsExchangeInput) =>
  unifiedApi.post<GoodsExchangeResult>(goodsExchangePath(orderId, itemId), input, { showLoading: false })

export const getPhoneReturnChecklist = (phoneId: number, signal: AbortSignal) =>
  unifiedApi.get<PhoneReturnSource>(`/sales/checkout/phones/${phoneId}/return-checklist`, { signal, useCache: false, showLoading: false })

const phoneReturnPath = (orderId: number, saleId: number) => `/sales/checkout/${orderId}/phones/${saleId}/return`
export const quotePhoneReturn = (orderId: number, saleId: number, input: PhoneReturnInput, signal: AbortSignal) =>
  unifiedApi.post<PhoneReturnQuote>(`${phoneReturnPath(orderId, saleId)}/quote`, input, { signal, showLoading: false })
export const submitPhoneReturn = (orderId: number, saleId: number, input: PhoneReturnInput) =>
  unifiedApi.post<PhoneReturnResult>(phoneReturnPath(orderId, saleId), input, { showLoading: false })
