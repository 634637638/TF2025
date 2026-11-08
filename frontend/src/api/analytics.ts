/**
 * 数据分析 API 服务
 * 提供已有后端路由支持的销售、库存、客户和员工分析契约
 */

import { unifiedApi } from '@/utils/unified-api'
import type {
  AnalyticsApiResponse,
  AnalyticsListResponse,
  SalesAnalytics,
  InventoryAnalytics,
  CustomerAnalytics,
  SalesForecastResponse,
  CustomerDetail,
  CustomerSegment,
  InventoryLowStockItem,
  InventoryRecentSoldItem,
  InventoryTurnoverPoint,
  InventoryValue,
  RealTimeData
} from '@/types/analytics'

type AnalyticsRecord = Record<string, unknown>

interface EmployeeAnalyticsApiData {
  totalCount?: number
  activeCount?: number
  totalSalary?: number
  baseSalaryTotal?: number
  commissionTotal?: number
  overtimePayTotal?: number
  deductionTotal?: number
  avgAttendance?: number
  storeCount?: number
  newCount?: number
  usedCount?: number
  avgSales?: number
  totalTrend?: string
  totalChange?: number
  salaryTrend?: string
  salaryChange?: number
}

interface AttendanceSummaryApiData {
  summary?: {
    totalRecords?: number
    employeeCount?: number
    pendingCount?: number
    approvedCount?: number
    abnormalCount?: number
    leaveCount?: number
    overtimeCount?: number
  }
  records?: AnalyticsRecord[]
}

interface SalaryTrendApiData {
  months?: string[]
  salaries?: number[]
}

export class AnalyticsApi {
  private static instance: AnalyticsApi

  public static getInstance(): AnalyticsApi {
    if (!AnalyticsApi.instance) {
      AnalyticsApi.instance = new AnalyticsApi()
    }
    return AnalyticsApi.instance
  }

  // 销售分析
  async getSalesAnalytics(params?: {
    start_date?: string
    end_date?: string
    store_id?: number
    product_id?: number
  }): Promise<AnalyticsApiResponse<SalesAnalytics>> {
    return await unifiedApi.get('/analytics/sales', { params })
  }

  async getSalesTrends(params?: {
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    start_date?: string
    end_date?: string
    store_id?: number
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/sales/trends', { params })
  }

  async getSalesForecast(params?: {
    period: 'week' | 'month' | 'quarter'
    store_id?: number | string
    page_size?: number
  }): Promise<AnalyticsApiResponse<SalesForecastResponse>> {
    return await unifiedApi.get('/analytics/sales-forecast', { params })
  }

  // 库存分析
  async getInventoryAnalytics(params?: {
    store_id?: number
    supplier_id?: number
  }): Promise<AnalyticsApiResponse<InventoryAnalytics>> {
    return await unifiedApi.get('/analytics/inventory', { params })
  }

  async getLowStockItems(params?: {
    store_id?: number
    supplier_id?: number
    page_size?: number
  }): Promise<AnalyticsApiResponse<InventoryLowStockItem[]>> {
    return await unifiedApi.get('/analytics/inventory/low-stock', { params })
  }

  async getInventoryTurnover(params?: {
    period?: '30d' | '90d' | '180d'
    store_id?: number
    supplier_id?: number
  }): Promise<AnalyticsApiResponse<InventoryTurnoverPoint[]>> {
    return await unifiedApi.get('/analytics/inventory/turnover', { params })
  }

  async getInventoryValue(params?: {
    store_id?: number
  }): Promise<AnalyticsApiResponse<InventoryValue>> {
    return await unifiedApi.get('/analytics/inventory/value', { params })
  }

  async getInventorySupplierStats(params?: {
    store_id?: number
    supplier_id?: number
  }): Promise<AnalyticsApiResponse<{ supplier_count: number }>> {
    return await unifiedApi.get('/analytics/inventory/supplier-stats', { params })
  }

  async getRecentSoldInventory(params?: {
    store_id?: number
    supplier_id?: number
    page_size?: number
  }): Promise<AnalyticsApiResponse<InventoryRecentSoldItem[]>> {
    return await unifiedApi.get('/analytics/inventory/recent-sold', { params })
  }

  // 客户分析
  async getCustomerAnalytics(params?: {
    start_date?: string
    end_date?: string
    store_id?: number
    segment?: string
    period?: '30d' | '7d' | '90d'
  }): Promise<AnalyticsApiResponse<CustomerAnalytics>> {
    return await unifiedApi.get('/analytics/customers', { params })
  }

  async getCustomerSegments(params?: {
    type?: 'rfm' | 'value' | 'behavior'
    store_id?: number
  }): Promise<AnalyticsApiResponse<CustomerSegment[]>> {
    return await unifiedApi.get('/analytics/customers/segments', { params })
  }

  async getCustomerRetention(params?: {
    period?: 'monthly' | 'quarterly' | 'yearly',
    cohort?: 'monthly' | 'quarterly' | 'yearly'
    store_id?: number
  }): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/customers/retention', { params })
  }

  async getCustomerGrowth(params?: {
    period: '7d' | '30d' | '90d'
    store_id?: number
  }): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/customers/growth', { params })
  }

  async getHighValueCustomers(params?: {
    page?: number
    page_size?: number
    search_term?: string
    start_date?: string
    end_date?: string
    store_id?: number
  }): Promise<AnalyticsListResponse<CustomerDetail>> {
    return await unifiedApi.get('/analytics/customers/high-value', { params })
  }

  async getCustomerDetail(customerId: number, params?: {
    store_id?: number
  }): Promise<AnalyticsApiResponse<{
    trends: Array<{ period: string; amount: number }>
    preferences: Array<{ name: string; value: number }>
  }>> {
    return await unifiedApi.get(`/analytics/customers/${customerId}/detail`, { params })
  }

  async getCustomerActivity(params?: {
    store_id?: number
  }): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/customers/activity', { params })
  }

  // 实时数据
  async getRealTimeData(): Promise<AnalyticsApiResponse<RealTimeData>> {
    return await unifiedApi.get('/analytics/realtime')
  }

  // 员工分析
  async getEmployeeAnalytics(params?: {
    start_date?: string
    end_date?: string
    store_id?: number | string
  }): Promise<AnalyticsApiResponse<EmployeeAnalyticsApiData>> {
    return await unifiedApi.get('/analytics/employees/detail', { params })
  }

  async getEmployeePerformance(params?: {
    metric?: string
    page_size?: number
    store_id?: number | string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/employees/performance', { params })
  }

  async getEmployeeRoles(params?: {
    store_id?: number | string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/employees/roles', { params })
  }

  async getEmployeeSalaryTrend(params?: {
    months?: number
    store_id?: number | string
  }): Promise<AnalyticsApiResponse<SalaryTrendApiData>> {
    return await unifiedApi.get('/analytics/employees/salary-trend', { params })
  }

  async getEmployeeAttendance(params?: {
    store_id?: number | string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/employees/attendance', { params })
  }

  async getAttendanceSummary(params?: {
    start_date?: string
    end_date?: string
    store_id?: number | string
  }): Promise<AnalyticsApiResponse<AttendanceSummaryApiData>> {
    return await unifiedApi.get('/analytics/attendance/summary', { params })
  }
}

// 导出单例实例
export const analyticsApi = AnalyticsApi.getInstance()

// 兼容旧文件引用
export const analyticsService = analyticsApi
export default AnalyticsApi
