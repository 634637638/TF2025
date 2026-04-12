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
  PerformanceAnalytics,
  FinancialAnalytics,
  RealTimeData,
  DashboardConfig,
  AnalyticsReport,
  ExportConfig
} from '@/types/analytics'

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
    startDate?: string
    endDate?: string
    storeId?: number
    productId?: number
  }): Promise<AnalyticsApiResponse<SalesAnalytics>> {
    return await unifiedApi.get('/analytics/sales', { params })
  }

  async getSalesTrends(params?: {
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    startDate?: string
    endDate?: string
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/sales/trends', { params })
  }

  async getTopProducts(params?: {
    limit?: number
    period?: string
    category?: string
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/sales/top-products', { params })
  }

  async getSalesForecast(params?: {
    period: 'week' | 'month' | 'quarter' | 'year'
    storeId?: number
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/sales/forecast', { params })
  }

  // 库存分析
  async getInventoryAnalytics(params?: {
    storeId?: number
    categoryId?: number
    supplierId?: number
  }): Promise<AnalyticsApiResponse<InventoryAnalytics>> {
    return await unifiedApi.get('/analytics/inventory', { params })
  }

  async getLowStockItems(params?: {
    storeId?: number
    limit?: number
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/inventory/low-stock', { params })
  }

  async getInventoryTurnover(params?: {
    period?: string
    categoryId?: number
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/inventory/turnover', { params })
  }

  async getInventoryValue(params?: {
    storeId?: number
    categoryId?: number
  }): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/inventory/value', { params })
  }

  // 客户分析
  async getCustomerAnalytics(params?: {
    startDate?: string
    endDate?: string
    segment?: string
    period?: '30d' | '7d' | '90d'
  }): Promise<AnalyticsApiResponse<CustomerAnalytics>> {
    return await unifiedApi.get('/analytics/customers', { params })
  }

  async getCustomerSegments(params?: {
    type?: 'rfm' | 'value' | 'behavior'
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/customers/segments', { params })
  }

  async getCustomerRetention(params?: {
    period?: 'monthly' | 'quarterly' | 'yearly',
    cohort?: 'monthly' | 'quarterly' | 'yearly'
  }): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/customers/retention', { params })
  }

  async getCustomerLifetimeValue(params?: {
    segment?: string
    period?: string
  }): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/customers/lifetime-value', { params })
  }

  async getCustomerGrowth(params?: {
    period: '7d' | '30d' | '90d'
  }): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/customers/growth', { params })
  }

  async getHighValueCustomers(params?: {
    page?: number
    pageSize?: number
    search?: string
  }): Promise<AnalyticsListResponse<any>> {
    return await unifiedApi.get('/analytics/customers/high-value', { params })
  }

  async getCustomerActivity(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/customers/activity')
  }

  // 财务分析
  async getFinancialAnalytics(params?: {
    startDate?: string
    endDate?: string
    type?: 'revenue' | 'profit' | 'expenses' | 'cashflow'
  }): Promise<AnalyticsApiResponse<FinancialAnalytics>> {
    return await unifiedApi.get('/analytics/financial', { params })
  }

  async getRevenueByPeriod(params?: {
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    startDate?: string
    endDate?: string
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/financial/revenue', { params })
  }

  async getProfitAnalysis(params?: {
    productId?: number
    categoryId?: number
    period?: string
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/financial/profit', { params })
  }

  async getExpenseAnalysis(params?: {
    category?: string
    period?: string
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/financial/expenses', { params })
  }

  async getFinancialHealth(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/financial/health')
  }

  // 性能分析
  async getPerformanceMetrics(): Promise<AnalyticsApiResponse<PerformanceAnalytics>> {
    return await unifiedApi.get('/analytics/performance')
  }

  async getPerformanceAnalytics(params?: {
    startDate?: string
    endDate?: string
    metric?: string
  }): Promise<AnalyticsApiResponse<PerformanceAnalytics>> {
    return await unifiedApi.get('/analytics/performance', { params })
  }

  async getPagePerformance(params?: {
    url?: string
    period?: string
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/performance/pages', { params })
  }

  async getApiPerformance(params?: {
    endpoint?: string
    period?: string
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/performance/api', { params })
  }

  async getSystemHealth(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/performance/health')
  }

  async getRealTimePerformance(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/performance/realtime')
  }

  async getApiMetrics(params?: {
    startDate?: string
    endDate?: string
  }): Promise<AnalyticsListResponse<any>> {
    return await unifiedApi.get('/analytics/performance/api-metrics', { params })
  }

  async getDatabaseMetrics(params?: {
    startDate?: string
    endDate?: string
  }): Promise<AnalyticsListResponse<any>> {
    return await unifiedApi.get('/analytics/performance/database-metrics', { params })
  }

  async getPerformanceRecommendations(): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/performance/recommendations')
  }

  // 实时数据
  async getRealTimeData(): Promise<AnalyticsApiResponse<RealTimeData>> {
    return await unifiedApi.get('/analytics/realtime')
  }

  async getActiveUsers(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/realtime/users')
  }

  async getCurrentSales(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/realtime/sales')
  }

  async getSystemLoad(): Promise<AnalyticsApiResponse<any>> {
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
    filters?: Record<string, any>
  }): Promise<AnalyticsApiResponse<AnalyticsReport>> {
    return await unifiedApi.post('/analytics/reports/generate', config)
  }

  async deleteReport(id: string): Promise<AnalyticsApiResponse<void>> {
    return await unifiedApi.delete(`/analytics/reports/${id}`)
  }

  // 导出
  async exportData(config: ExportConfig): Promise<any> {
    return await unifiedApi.post('/analytics/export', config, {
      responseType: 'blob'
    })
  }

  async getExportHistory(): Promise<AnalyticsListResponse<any>> {
    return await unifiedApi.get('/analytics/export/history')
  }

  async downloadExport(id: string): Promise<any> {
    return await unifiedApi.get(`/analytics/export/${id}/download`, {
      responseType: 'blob'
    })
  }

  // 设置
  async getAnalyticsSettings(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/settings')
  }

  async updateAnalyticsSettings(settings: any): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.put('/analytics/settings', settings)
  }

  async getMetricsConfig(): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/settings/metrics')
  }

  async updateMetricsConfig(config: any): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.put('/analytics/settings/metrics', config)
  }

  // 告警
  async getAlerts(params?: {
    status?: string
    type?: string
    startDate?: string
    endDate?: string
  }): Promise<AnalyticsListResponse<any>> {
    return await unifiedApi.get('/analytics/alerts', { params })
  }

  async acknowledgeAlert(id: string): Promise<AnalyticsApiResponse<void>> {
    return await unifiedApi.post(`/analytics/alerts/${id}/acknowledge`)
  }

  async createAlertRule(rule: any): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.post('/analytics/alerts/rules', rule)
  }

  async updateAlertRule(id: string, rule: any): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.put(`/analytics/alerts/rules/${id}`, rule)
  }

  async deleteAlertRule(id: string): Promise<AnalyticsApiResponse<void>> {
    return await unifiedApi.delete(`/analytics/alerts/rules/${id}`)
  }

  // 员工分析
  async getEmployeeAnalytics(params?: {
    startDate?: string
    endDate?: string
    storeId?: number | string
  }): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/employees/detail', { params })
  }

  async getEmployeePerformance(params?: {
    metric?: string
    limit?: number
  }): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/employees/performance', { params })
  }

  async getEmployeeRoles(): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/employees/roles')
  }

  async getEmployeeSalaryTrend(params?: {
    months?: number
  }): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/employees/salary-trend', { params })
  }

  async getEmployeeAttendance(): Promise<AnalyticsApiResponse<any[]>> {
    return await unifiedApi.get('/analytics/employees/attendance')
  }

  async getAttendanceSummary(params?: {
    startDate?: string
    endDate?: string
    storeId?: number | string
  }): Promise<AnalyticsApiResponse<any>> {
    return await unifiedApi.get('/analytics/attendance/summary', { params })
  }
}

// 导出单例实例
export const analyticsApi = AnalyticsApi.getInstance()

// 兼容旧文件引用
export const analyticsService = analyticsApi
export default AnalyticsApi
