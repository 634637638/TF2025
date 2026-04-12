/**
 * 价目表 API 接口
 */
import { unifiedApi } from '@/utils/unified-api'
import type { RequestConfig } from '@/utils/unified-api'

/**
 * 获取在库手机列表（价目表用）- 参考销售管理的逻辑
 * 直接从 phones 表获取 status='in_stock' 的商品
 */
export function getStockPhones(params?: any) {
  return unifiedApi.get('/sales/phones/available', { params })
}

/**
 * 获取价格列表（管理端）
 */
export function getPriceList(params?: any) {
  return unifiedApi.get('/price-list', { params })
}

/**
 * 根据ID获取价格历史
 */
export function getPriceHistory(id: number, params?: any, config?: RequestConfig) {
  return unifiedApi.get(`/price-list/${id}/history`, { params, ...config })
}

/**
 * 删除单条价格历史记录
 */
export function deletePriceHistory(priceListId: number, historyId: number) {
  return unifiedApi.delete(`/price-list/${priceListId}/history/${historyId}`)
}

/**
 * 批量删除价格历史记录
 */
export function batchDeletePriceHistory(priceListId: number, historyIds: number[]) {
  return unifiedApi.post(`/price-list/${priceListId}/history/batch-delete`, { historyIds })
}

/**
 * 清空价格历史记录
 */
export function clearPriceHistory(priceListId: number) {
  return unifiedApi.delete(`/price-list/${priceListId}/history`)
}

/**
 * 清空全部价格历史记录
 */
export function clearAllPriceHistory() {
  return unifiedApi.delete('/price-list/history/all')
}

/**
 * 创建/更新价格记录
 */
export function upsertPriceItem(data: any) {
  return unifiedApi.post('/price-list', data)
}

/**
 * 删除价格记录
 */
export function deletePriceItem(id: number) {
  return unifiedApi.delete(`/price-list/${id}`)
}

/**
 * 获取所有同步配置列表
 */
export function getAllSyncConfigs() {
  return unifiedApi.get('/price-list/sync/configs')
}

/**
 * 创建新的同步配置
 */
export function createSyncConfig(data: any) {
  return unifiedApi.post('/price-list/sync/configs', data)
}

/**
 * 设置默认同步配置
 */
export function setDefaultSyncConfig(configId: number) {
  return unifiedApi.put(`/price-list/sync/config/${configId}/default`)
}

/**
 * 获取指定ID的同步配置详情（包含密码）
 */
export function getSyncConfigById(configId: number) {
  return unifiedApi.get(`/price-list/sync/config/${configId}`)
}

/**
 * 删除同步配置
 */
export function deleteSyncConfig(configId: number) {
  return unifiedApi.delete(`/price-list/sync/config/${configId}`)
}

/**
 * 更新指定ID的同步配置
 */
export function updateSyncConfigById(configId: number, data: any) {
  return unifiedApi.put(`/price-list/sync/config/${configId}`, data)
}

/**
 * 获取同步配置
 * @param hidePassword 是否隐藏密码（默认true）
 */
export function getSyncConfig(hidePassword: boolean = true) {
  return unifiedApi.get('/price-list/sync/config', { params: { hidePassword } })
}

/**
 * 更新同步配置
 */
export function updateSyncConfig(data: any) {
  return unifiedApi.put('/price-list/sync/config', data)
}

/**
 * 手动触发同步
 */
export function triggerSync() {
  return unifiedApi.post('/price-list/sync/trigger')
}

/**
 * 获取同步日志
 */
export function getSyncLogs(params?: any) {
  return unifiedApi.get('/price-list/sync/logs', { params })
}

/**
 * 删除同步日志
 */
export function deleteSyncLog(id: number) {
  return unifiedApi.delete(`/price-list/sync/logs/${id}`)
}

/**
 * 清空同步日志
 */
export function clearSyncLogs() {
  return unifiedApi.delete('/price-list/sync/logs')
}

// ==================== 公开接口（无需登录）====================

/**
 * 获取所有价格（公开，批发报价用，只显示采集的商品）
 */
export function getAllPrices() {
  return unifiedApi.get('/public/price/all')
}

/**
 * 获取所有销售价格（公开，销售报价用，显示所有有价格的商品）
 */
export function getAllSalesPrices() {
  return unifiedApi.get('/public/price/sales/all')
}

/**
 * 搜索销售价格（公开，不限采集状态）
 */
export function searchSalesPrices(keyword: string) {
  return unifiedApi.get(`/public/price/sales/search/${encodeURIComponent(keyword)}`)
}

/**
 * 获取所有品牌列表（公开）
 */
export function getPublicBrands() {
  return unifiedApi.get('/public/price/brands')
}

/**
 * 搜索价格（公开，批发报价用，只显示采集的商品）
 */
export function searchPrices(keyword: string) {
  return unifiedApi.get(`/public/price/search/${encodeURIComponent(keyword)}`)
}

/**
 * 根据品牌获取价格（公开）
 */
export function getPricesByBrand(brand: string) {
  return unifiedApi.get(`/public/price/brand/${encodeURIComponent(brand)}`)
}

// ==================== 加价配置接口 ====================

/**
 * 加价配置接口
 */
export interface PriceMarkupConfig {
  mode: 'fixed' | 'percentage'
  lowFixed: number
  highFixed: number
  lowPercent: number
  highPercent: number
  threshold: number
  enabled: boolean
}

/**
 * 获取加价配置
 */
export function getMarkupConfig() {
  return unifiedApi.get<PriceMarkupConfig>('/system-settings/price-markup-config')
}

/**
 * 保存加价配置
 */
export function saveMarkupConfig(config: PriceMarkupConfig) {
  return unifiedApi.post('/system-settings/price-markup-config', config)
}

/**
 * 一键清零所有采集价格
 */
export function clearPrices() {
  return unifiedApi.post('/price-list/clear-prices')
}
