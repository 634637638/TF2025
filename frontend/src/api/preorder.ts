/**
 * 预定管理 API
 * 提供预定单的增删改查、匹配、交付等功能
 */
import { unifiedApi } from '@/utils/unified-api'

export const PREORDER_STATUS_LABELS = {
  pending: '待匹配',
  arrived: '已匹配',
  completed: '已交付',
  cancelled: '已取消'
} as const

export enum PreorderStatus {
  PENDING = 'pending',
  MATCHED = 'arrived',
  DELIVERED = 'completed',
  CANCELLED = 'cancelled'
}

export type LegacyPreorderStatus = 'matched' | 'delivered'
export type PreorderStatusFilter = PreorderStatus | LegacyPreorderStatus

export const normalizePreorderStatus = (status?: PreorderStatusFilter | null): PreorderStatus | undefined => {
  if (!status) {
    return undefined
  }

  if (status === 'matched') {
    return PreorderStatus.MATCHED
  }

  if (status === 'delivered') {
    return PreorderStatus.DELIVERED
  }

  return status
}

// 预定单接口定义
export interface Preorder {
  id: number
  preorder_number: string
  customer_id: number
  customer_name?: string
  customer_phone?: string
  store_id?: number
  store_name?: string
  brand_id?: number
  brand_name?: string
  model_id?: number
  model_name?: string
  color_id?: number
  color_name?: string
  memory_id?: number
  memory_size?: string
  is_new?: number // 机况: 1=全新, 0=二手
  phone_model: string
  color?: string
  storage?: string
  expected_arrival?: string
  expected_price?: number
  advance_payment: number
  deposit: number
  actual_model?: string
  imei?: string
  arrival_date?: string
  actual_price?: number
  status: PreorderStatus
  status_text?: string
  remarks?: string
  operator_id?: number
  operator_name?: string
  cancelled_at?: string
  matched_time?: string
  delivered_time?: string
  created_at: string
  updated_at: string
  // 供应商信息（匹配后显示）
  supplier_id?: number
  supplier_name?: string
  // 计算字段
  product_name?: string
  remaining_amount?: number
}

// 创建预定单参数
export interface CreatePreorderParams {
  customer_id: number
  store_id?: number
  brand_id: number
  model_id: number
  color_id: number
  memory_id: number
  is_new?: number // 机况: 1=全新, 0=二手
  expected_price?: number
  advance_payment: number
  notes?: string
  expiry_date?: string
}

// 匹配预定单参数
export interface MatchPreorderParams {
  phone_id?: number
  imei?: string
  actual_model?: string
  arrival_date?: string
  actual_price?: number
}

// 交付预定单参数
export interface DeliverPreorderParams {
  actual_price?: number
  notes?: string
}

// 预定单列表响应
export interface PreordersResponse {
  records: Preorder[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// 预定单统计
export interface PreorderStats {
  total: number
  pending_count: number
  matched_count: number
  delivered_count: number
  cancelled_count: number
  total_deposits: number
  total_sales_value: number
}

/**
 * 获取预定单列表
 */
export async function getPreorders(params?: {
  page?: number
  limit?: number
  status?: PreorderStatusFilter
  customer_id?: number
  search?: string
  startDate?: string
  endDate?: string
}): Promise<PreordersResponse> {
  const normalizedParams = params
    ? {
        ...params,
        status: normalizePreorderStatus(params.status)
      }
    : undefined

  const response = await unifiedApi.get<PreordersResponse>('/preorders', { params: normalizedParams })
  return response.data as PreordersResponse
}

/**
 * 获取预定单统计
 */
export async function getPreorderStats(): Promise<PreorderStats> {
  const response = await unifiedApi.get<PreorderStats>('/preorders/stats')
  return response.data as PreorderStats
}

/**
 * 查找可匹配的预定单
 */
export async function getMatchablePreorders(params: {
  phone_model: string
  color?: string
  storage?: string
}): Promise<Preorder[]> {
  const response = await unifiedApi.get<Preorder[]>('/preorders/matchable', { params })
  return response.data as Preorder[]
}

/**
 * 获取预定单详情
 */
export async function getPreorderDetail(id: number): Promise<Preorder> {
  const response = await unifiedApi.get<Preorder>(`/preorders/${id}`)
  return response.data as Preorder
}

/**
 * 创建预定单
 */
export async function createPreorder(data: CreatePreorderParams): Promise<Preorder> {
  const response = await unifiedApi.post<Preorder>('/preorders', data)
  return response.data as Preorder
}

/**
 * 匹配预定单
 */
export async function matchPreorder(id: number, data: MatchPreorderParams): Promise<Preorder> {
  const response = await unifiedApi.put<Preorder>(`/preorders/${id}/match`, data)
  return response.data as Preorder
}

/**
 * 交付预定单
 */
export async function deliverPreorder(id: number, data: DeliverPreorderParams): Promise<Preorder> {
  const response = await unifiedApi.put<Preorder>(`/preorders/${id}/deliver`, data)
  return response.data as Preorder
}

/**
 * 取消预定单
 */
export async function cancelPreorder(id: number, reason?: string): Promise<Preorder> {
  const response = await unifiedApi.put<Preorder>(`/preorders/${id}/cancel`, { reason })
  return response.data as Preorder
}

/**
 * 更新预定单
 */
export async function updatePreorder(id: number, data: Partial<Preorder>): Promise<Preorder> {
  const response = await unifiedApi.put<Preorder>(`/preorders/${id}`, data)
  return response.data as Preorder
}

/**
 * 删除预定单
 */
export async function deletePreorder(id: number): Promise<void> {
  await unifiedApi.delete(`/preorders/${id}`)
}

/**
 * 恢复已取消的预定单
 */
export async function restorePreorder(id: number): Promise<Preorder> {
  const response = await unifiedApi.put<Preorder>(`/preorders/${id}/restore`)
  return response.data as Preorder
}

// 导出预定服务
export const preorderApi = {
  getPreorders,
  getPreorderStats,
  getMatchablePreorders,
  getPreorderDetail,
  createPreorder,
  matchPreorder,
  deliverPreorder,
  cancelPreorder,
  updatePreorder,
  deletePreorder,
  restorePreorder
}

export default preorderApi
