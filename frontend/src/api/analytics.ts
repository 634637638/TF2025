/**
 * 数据分析 API 服务
 * 提供销售、库存、客户、财务等各类分析数据的 API 调用
 */

import { unifiedApi } from '@/utils/unified-api'
import type {
  AnalyticsApiResponse,
  AnalyticsListResponse,
  SalesAnalytics,
  InventoryAnalytics,
  CustomerAnalytics,
  CustomerDetail,
  CustomerSegment,
  InventoryLowStockItem,
  InventoryRecentSoldItem,
  InventoryTurnoverPoint,
  InventoryValue,
  PerformanceAnalytics,
  FinancialAnalytics,
  RealTimeData,
  DashboardConfig,
  AnalyticsReport,
  ExportConfig
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
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/sales/trends', { params })
  }

  async getTopProducts(params?: {
    page_size?: number
    period?: string
    category?: string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/sales/top-products', { params })
  }

  async getSalesForecast(params?: {
    period: 'week' | 'month' | 'quarter' | 'year'
    store_id?: number
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/sales/forecast', { params })
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
  }): Promise<AnalyticsApiResponse<CustomerSegment[]>> {
    return await unifiedApi.get('/analytics/customers/segments', { params })
  }

  async getCustomerRetention(params?: {
    period?: 'monthly' | 'quarterly' | 'yearly',
    cohort?: 'monthly' | 'quarterly' | 'yearly'
  }): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/customers/retention', { params })
  }

  async getCustomerLifetimeValue(params?: {
    segment?: string
    period?: string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/customers/lifetime-value', { params })
  }

  async getCustomerGrowth(params?: {
    period: '7d' | '30d' | '90d'
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

  async getCustomerDetail(customerId: number): Promise<AnalyticsApiResponse<{
    trends: Array<{ period: string; amount: number }>
    preferences: Array<{ name: string; value: number }>
  }>> {
    return await unifiedApi.get(`/analytics/customers/${customerId}/detail`)
  }

  async getCustomerActivity(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/customers/activity')
  }

  // 财务分析
  async getFinancialAnalytics(params?: {
    start_date?: string
    end_date?: string
    type?: 'revenue' | 'profit' | 'expenses' | 'cashflow'
  }): Promise<AnalyticsApiResponse<FinancialAnalytics>> {
    return await unifiedApi.get('/analytics/financial', { params })
  }

  async getRevenueByPeriod(params?: {
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    start_date?: string
    end_date?: string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/financial/revenue', { params })
  }

  async getProfitAnalysis(params?: {
    product_id?: number
    category_id?: number
    period?: string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/financial/profit', { params })
  }

  async getExpenseAnalysis(params?: {
    category?: string
    period?: string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/financial/expenses', { params })
  }

  async getFinancialHealth(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/financial/health')
  }

  // 性能分析
  async getPerformanceMetrics(): Promise<AnalyticsApiResponse<PerformanceAnalytics>> {
    return await unifiedApi.get('/analytics/performance')
  }

  async getPerformanceAnalytics(params?: {
    start_date?: string
    end_date?: string
    metric?: string
  }): Promise<AnalyticsApiResponse<PerformanceAnalytics>> {
    return await unifiedApi.get('/analytics/performance', { params })
  }

  async getPagePerformance(params?: {
    url?: string
    period?: string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/performance/pages', { params })
  }

  async getApiPerformance(params?: {
    endpoint?: string
    period?: string
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/performance/api', { params })
  }

  async getSystemHealth(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/performance/health')
  }

  async getRealTimePerformance(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/performance/realtime')
  }

  async getApiMetrics(params?: {
    start_date?: string
    end_date?: string
  }): Promise<AnalyticsListResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/performance/api-metrics', { params })
  }

  async getDatabaseMetrics(params?: {
    start_date?: string
    end_date?: string
  }): Promise<AnalyticsListResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/performance/database-metrics', { params })
  }

  async getPerformanceRecommendations(): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/performance/recommendations')
  }

  // 实时数据
  async getRealTimeData(): Promise<AnalyticsApiResponse<RealTimeData>> {
    return await unifiedApi.get('/analytics/realtime')
  }

  async getActiveUsers(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/realtime/users')
  }

  async getCurrentSales(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/realtime/sales')
  }

  async getSystemLoad(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/realtime/system')
  }

  // 仪表盘
  async getDashboardConfigs(): Promise<AnalyticsListResponse<DashboardConfig>> {
    return await unifiedApi.get('/analytics/dashboards')
  }

  async getDashboardConfig(id: string): Promise<AnalyticsApiResponse<DashboardConfig>> {
    return await unifiedApi.get(`/analytics/dashboards/${id}`)
  }

  async createDashboardConfig(config: Partial<DashboardConfig>): Promise<AnalyticsApiResponse<DashboardConfig>> {
    return await unifiedApi.post('/analytics/dashboards', config)
  }

  async updateDashboardConfig(id: string, config: Partial<DashboardConfig>): Promise<AnalyticsApiResponse<DashboardConfig>> {
    return await unifiedApi.put(`/analytics/dashboards/${id}`, config)
  }

  async deleteDashboardConfig(id: string): Promise<AnalyticsApiResponse<void>> {
    return await unifiedApi.delete(`/analytics/dashboards/${id}`)
  }

  // 报告
  async getReports(type?: string): Promise<AnalyticsListResponse<AnalyticsReport>> {
    return await unifiedApi.get('/analytics/reports', { params: { type } })
  }

  async getReport(id: string): Promise<AnalyticsApiResponse<AnalyticsReport>> {
    return await unifiedApi.get(`/analytics/reports/${id}`)
  }

  async generateReport(config: {
    type: string
    title: string
    dateRange: { start: string; end: string }
    metrics: string[]
    filters?: Record<string, unknown>
  }): Promise<AnalyticsApiResponse<AnalyticsReport>> {
    return await unifiedApi.post('/analytics/reports/generate', config)
  }

  async deleteReport(id: string): Promise<AnalyticsApiResponse<void>> {
    return await unifiedApi.delete(`/analytics/reports/${id}`)
  }

  // 导出
  async exportData(config: ExportConfig): Promise<unknown> {
    return await unifiedApi.post('/analytics/export', config, {
      responseType: 'blob'
    })
  }

  async getExportHistory(): Promise<AnalyticsListResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/export/history')
  }

  async downloadExport(id: string): Promise<unknown> {
    return await unifiedApi.get(`/analytics/export/${id}/download`, {
      responseType: 'blob'
    })
  }

  // 设置
  async getAnalyticsSettings(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/settings')
  }

  async updateAnalyticsSettings(settings: AnalyticsRecord): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.put('/analytics/settings', settings)
  }

  async getMetricsConfig(): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/settings/metrics')
  }

  async updateMetricsConfig(config: AnalyticsRecord): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.put('/analytics/settings/metrics', config)
  }

  // 告警
  async getAlerts(params?: {
    status?: string
    type?: string
    start_date?: string
    end_date?: string
  }): Promise<AnalyticsListResponse<AnalyticsRecord>> {
    return await unifiedApi.get('/analytics/alerts', { params })
  }

  async acknowledgeAlert(id: string): Promise<AnalyticsApiResponse<void>> {
    return await unifiedApi.post(`/analytics/alerts/${id}/acknowledge`)
  }

  async createAlertRule(rule: AnalyticsRecord): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.post('/analytics/alerts/rules', rule)
  }

  async updateAlertRule(id: string, rule: AnalyticsRecord): Promise<AnalyticsApiResponse<AnalyticsRecord>> {
    return await unifiedApi.put(`/analytics/alerts/rules/${id}`, rule)
  }

  async deleteAlertRule(id: string): Promise<AnalyticsApiResponse<void>> {
    return await unifiedApi.delete(`/analytics/alerts/rules/${id}`)
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
  }): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/employees/performance', { params })
  }

  async getEmployeeRoles(): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/employees/roles')
  }

  async getEmployeeSalaryTrend(params?: {
    months?: number
  }): Promise<AnalyticsApiResponse<SalaryTrendApiData>> {
    return await unifiedApi.get('/analytics/employees/salary-trend', { params })
  }

  async getEmployeeAttendance(): Promise<AnalyticsApiResponse<AnalyticsRecord[]>> {
    return await unifiedApi.get('/analytics/employees/attendance')
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
