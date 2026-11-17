import { unifiedApi } from '@/utils/unified-api'
import type { AccessoryBatchStock, AccessoryStockCorrectionOption, AccessoryStockCorrectionContext, AccessoryStockCorrectionInput, AccessoryStockInReceipt, AccessoryInventoryAdjustmentInput, AccessoryInventoryAdjustmentResult } from '@/types/accessory'
import type { PaginatedResponse } from '@/types'

export const getAccessoryBatchStock = (accessoryId: number, page: number, pageSize: number, signal: AbortSignal, includeZero = false) =>
  unifiedApi.get<Pick<PaginatedResponse<AccessoryBatchStock>, 'data' | 'pagination'>>(`/accessories/${accessoryId}/batches`, {
    params: { page, page_size: pageSize, ...(includeZero ? { include_zero: true } : {}) }, signal, useCache: false, showLoading: false, showError: false
  })

export const getAccessoryStockCorrectionOptions = (accessoryId: number, page: number, signal: AbortSignal) =>
  unifiedApi.get<Pick<PaginatedResponse<AccessoryStockCorrectionOption>, 'data' | 'pagination'>>(`/accessories/${accessoryId}/stock-in-options`, {
    params: { page, page_size: 20 }, signal, useCache: false, showLoading: false, showError: false
  })

export const getAccessoryStockCorrectionContext = (purchaseId: number, signal: AbortSignal) =>
  unifiedApi.get<AccessoryStockCorrectionContext>(`/accessories/stock-in/${purchaseId}/edit`, {
    signal, useCache: false, showLoading: false, showError: false
  })

export const correctAccessoryStockIn = (purchaseId: number, input: AccessoryStockCorrectionInput) =>
  unifiedApi.post<AccessoryStockInReceipt>(`/accessories/stock-in/${purchaseId}/corrections`, input, {
    showError: false, loadingText: '正在保存商品库存更正...'
  })

export const adjustAccessoryInventory = (accessoryId: number, input: AccessoryInventoryAdjustmentInput) =>
  unifiedApi.post<AccessoryInventoryAdjustmentResult>(`/accessories/${accessoryId}/inventory-adjustments`, input, {
    showError: false, loadingText: '正在保存库存盘点...'
  })
