/**
 * 数据分析相关类型定义
 */

// 基础统计指标
export interface BaseMetrics {
  total: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
}

// 销售数据统计
export interface SalesAnalytics {
  totalSales: BaseMetrics
  totalOrders: BaseMetrics
  averageOrderValue: BaseMetrics
  topProducts: ProductSalesData[]
  salesByStore: StoreSalesData[]
  salesByPeriod: SalesPeriodData[]
  revenueForecast: RevenueForecastData[]
}

// 产品销售数据
export interface ProductSalesData {
  id: number
  imei?: string
  name?: string
  brand_name: string
  model_name: string
  quantity: number
  revenue: number
  profit?: number
  growth?: number
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock'
}

// 店铺销售数据
export interface StoreSalesData {
  id: number
  name: string
  totalSales: number
  totalOrders: number
  averageOrderValue: number
  performance: 'excellent' | 'good' | 'average' | 'poor'
  growthRate: number
}

// 销售周期数据
export interface SalesPeriodData {
  period: string
  sales: number
  orders: number
  revenue: number
  target: number
  achievement: number
}

// 收入预测数据
export interface RevenueForecastData {
  period: string
  predicted: number
  actual?: number
  confidence: number
  factors: string[]
}

// 库存分析数据
export interface InventoryAnalytics {
  totalProducts: number
  totalValue: number
  lowStockItems: number
  outOfStockItems: number
  overstockItems: number
  stockTurnover: number
  inventoryHealth: InventoryHealthMetrics
  categoryAnalysis: CategoryAnalysis[]
  supplierAnalysis: SupplierAnalysis[]
}

// 库存健康指标
export interface InventoryHealthMetrics {
  score: number
  level: 'excellent' | 'good' | 'warning' | 'critical'
  issues: InventoryIssue[]
  recommendations: string[]
}

// 库存问题
export interface InventoryIssue {
  type: 'low_stock' | 'overstock' | 'slow_moving' | 'obsolete'
  severity: 'high' | 'medium' | 'low'
  description: string
  affectedItems: number
  potentialLoss: number
}

// 分类分析
export interface CategoryAnalysis {
  category: string
  totalItems: number
  totalValue: number
  turnoverRate: number
  margin: number
  growth: number
}

// 供应商分析
export interface SupplierAnalysis {
  id: number
  name: string
  totalProducts: number
  totalValue: number
  averageDeliveryTime: number
  qualityScore: number
  reliability: number
}

// 客户分析数据
export interface CustomerAnalytics {
  totalCustomers: BaseMetrics
  newCustomers: BaseMetrics
  activeCustomers: BaseMetrics
  customerRetention: RetentionMetrics
  customerSegments: CustomerSegment[]
  customerLifetimeValue: CLVMetrics
  behaviorAnalysis: CustomerBehaviorData[]
}

// 留存指标
export interface RetentionMetrics {
  rate: number
  period: 'monthly' | 'quarterly' | 'yearly'
  trend: 'improving' | 'stable' | 'declining'
  churnRate: number
}

// 客户分群
export interface CustomerSegment {
  segment: string
  count: number
  percentage: number
  avgOrderValue: number
  totalRevenue: number
  characteristics: string[]
}

// 客户生命周期价值
export interface CLVMetrics {
  average: number
  bySegment: Record<string, number>
  trends: CLVTrend[]
}

export interface CLVTrend {
  period: string
  value: number
  change: number
}

// 客户行为数据
export interface CustomerBehaviorData {
  behavior: string
  count: number
  percentage: number
  value: number
  trend: 'up' | 'down' | 'stable'
}

// 性能分析数据
export interface PerformanceAnalytics {
  pageLoadTime: PerformanceMetric
  apiLatency: PerformanceMetric
  errorRate: PerformanceMetric
  uptime: PerformanceMetric
  userSatisfaction: PerformanceMetric
  systemHealth: SystemHealthMetrics
  performanceTrends: PerformanceTrend[]
}

// 性能指标
export interface PerformanceMetric {
  current: number
  average: number
  target: number
  unit: string
  status: 'excellent' | 'good' | 'warning' | 'critical'
  trend: 'improving' | 'stable' | 'degrading'
}

// 系统健康指标
export interface SystemHealthMetrics {
  overall: 'healthy' | 'warning' | 'critical'
  cpu: PerformanceMetric
  memory: PerformanceMetric
  disk: PerformanceMetric
  network: PerformanceMetric
  database: PerformanceMetric
}

// 性能趋势
export interface PerformanceTrend {
  timestamp: string
  metric: string
  value: number
  target: number
}

// 财务分析数据
export interface FinancialAnalytics {
  revenue: RevenueMetrics
  profit: ProfitMetrics
  expenses: ExpenseMetrics
  cashFlow: CashFlowMetrics
  financialHealth: FinancialHealthMetrics
  projections: FinancialProjection[]
}

// 收入周期数据
export interface RevenuePeriodData {
  period: string
  revenue: number
  target: number
  achievement: number
  growth: number
}

// 产品利润数据
export interface ProfitByProduct {
  id: number
  name: string
  brand_name: string
  model_name: string
  revenue: number
  cost: number
  profit: number
  margin: number
  quantity: number
}

// 费用趋势数据
export interface ExpenseTrend {
  period: string
  amount: number
  category: string
  trend: 'up' | 'down' | 'stable'
}

// 收入指标
export interface RevenueMetrics {
  total: BaseMetrics
  byCategory: Record<string, BaseMetrics>
  byStore: Record<string, BaseMetrics>
  byPeriod: RevenuePeriodData[]
  growth: GrowthMetrics
}

// 利润指标
export interface ProfitMetrics {
  gross: BaseMetrics
  net: BaseMetrics
  margin: BaseMetrics
  byProduct: ProfitByProduct[]
}

// 费用指标
export interface ExpenseMetrics {
  total: BaseMetrics
  byCategory: Record<string, BaseMetrics>
  trends: ExpenseTrend[]
}

// 现金流指标
export interface CashFlowMetrics {
  operating: CashFlowItem
  investing: CashFlowItem
  financing: CashFlowItem
  net: CashFlowItem
}

export interface CashFlowItem {
  inflow: number
  outflow: number
  net: number
}

// 财务健康指标
export interface FinancialHealthMetrics {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  ratios: FinancialRatios
  alerts: FinancialAlert[]
}

export interface FinancialRatios {
  currentRatio: number
  quickRatio: number
  debtToEquity: number
  grossMargin: number
  netMargin: number
  returnOnAssets: number
}

export interface FinancialAlert {
  type: 'warning' | 'critical'
  message: string
  impact: string
  recommendation: string
}

// 财务预测
export interface FinancialProjection {
  period: string
  revenue: ProjectionItem
  expenses: ProjectionItem
  profit: ProjectionItem
  cashFlow: ProjectionItem
}

export interface ProjectionItem {
  predicted: number
  confidence: number
  range: { min: number; max: number }
  factors: string[]
}

// 趋势指标
export interface GrowthMetrics {
  rate: number
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  trend: 'accelerating' | 'steady' | 'decelerating'
  forecast: GrowthForecast
}

export interface GrowthForecast {
  nextPeriod: number
  nextQuarter: number
  nextYear: number
  confidence: number
}

// 报告数据
export interface AnalyticsReport {
  id: string
  title: string
  type: 'sales' | 'inventory' | 'customer' | 'financial' | 'performance'
  period: {
    start: string
    end: string
  }
  generatedAt: string
  data: any
  summary: ReportSummary
}

export interface ReportSummary {
  keyMetrics: Record<string, any>
  insights: string[]
  recommendations: string[]
  status: 'positive' | 'neutral' | 'negative'
}

// 仪表盘配置
export interface DashboardConfig {
  id: string
  name: string
  layout: DashboardLayout
  widgets: WidgetConfig[]
  filters: FilterConfig[]
  refreshInterval: number
}

export interface DashboardLayout {
  columns: number
  rows: number
  gap: number
}

export interface WidgetConfig {
  id: string
  type: 'metric' | 'chart' | 'table' | 'list'
  title: string
  dataSource: string
  position: { x: number; y: number; w: number; h: number }
  config: Record<string, any>
}

export interface FilterConfig {
  key: string
  label: string
  type: 'date' | 'select' | 'multiselect' | 'range'
  options?: Array<{ label: string; value: any }>
  defaultValue?: any
}

// 实时数据
export interface RealTimeData {
  timestamp: string
  activeUsers: number
  currentSales: number
  pendingOrders: number
  systemLoad: number
  alerts: RealTimeAlert[]
}

export interface RealTimeAlert {
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: string
  acknowledged: boolean
}

// 数据导出配置
export interface ExportConfig {
  format: 'excel' | 'csv' | 'pdf' | 'json'
  dateRange: {
    start: string
    end: string
  }
  metrics: string[]
  filters: Record<string, any>
  includeCharts: boolean
}

// API 响应类型
export interface AnalyticsApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  timestamp?: string
}

export interface AnalyticsListResponse<T> {
  success: boolean
  data?: T[]
  pagination?: {
    page: number
    pageSize?: number
    limit?: number
    total: number
    totalPages?: number
    pages?: number
  }
  message?: string
  timestamp?: string
}

// 性能告警
export interface PerformanceAlert {
  id: string
  level: 'info' | 'warning' | 'critical'
  title: string
  message: string
  timestamp: string
}

// 优化建议
export interface OptimizationSuggestion {
  id: string
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  expectedImprovement: string
}

// 客户详情
export interface CustomerDetail {
  id: number
  name: string
  phone: string
  segment: string
  orders_count: number
  total_amount: number
  avg_order_value: number
  last_order_date: string
  created_at: string
}

// 客户洞察
export interface CustomerInsight {
  id: string
  type: 'success' | 'warning' | 'danger' | 'info'
  title: string
  content: string
  impact: 'high' | 'medium' | 'low'
  impactText: string
  date: string
  icon?: any // 图标组件（可选）
}

// ==================== 员工分析相关类型定义 ====================

// 员工分析详情数据
export interface EmployeeAnalytics {
  totalCount: number
  activeCount: number
  totalSalary: number
  avgAttendance: number
  storeCount: number
  newCount: number
  usedCount: number
  avgSales: number
  totalTrend: 'up' | 'down' | 'stable'
  totalChange: number
  salaryTrend: 'up' | 'down' | 'stable'
  salaryChange: number
}

// 员工销售业绩数据
export interface EmployeePerformance {
  id: number
  name: string
  store_id: number | null
  store_name: string | null
  new_sales: number
  used_sales: number
  total_orders: number
  total_sales: number
  salary: number
  attendance_rate: number
  trend: 'up' | 'down' | 'stable'
}

// 员工角色分布
export interface EmployeeRole {
  name: string
  value: number
}

// 工资趋势数据
export interface SalaryTrend {
  months: string[]
  salaries: number[]
}

// 出勤统计数据
export interface AttendanceStat {
  value: number
  name: string
  color: string
}

// 考勤记录
export interface AttendanceAlert {
  date: string
  employee_name: string
  store_name: string
  type: string
  status: 'pending' | 'processed'
}

// 考勤汇总数据
export interface AttendanceSummary {
  alerts: AttendanceAlert[]
}