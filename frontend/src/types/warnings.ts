export interface PhoneStockWarning {
  brand_name: string
  model_name: string
  color_name: string
  memory_name: string
  stock_count: number
  warning_threshold?: number
  new_count?: number
  used_count?: number
  status?: string
}

export interface AccessoryStockWarning {
  name: string
  stock: number
  min_stock: number
  status: string
}

export interface SalesWarningSummary {
  today: {
    sales_count: number
    total_amount: number
    total_profit: number
    operator_count: number
  }
  trend: Array<{
    sale_time: string
    sales_count: number
    total_amount: number
  }>
  avg_daily_sales: number
  is_below_average: boolean
}

export interface PurchaseWarning {
  supplier_name: string
  last_inventory_time?: string | null
  days_since_purchase: number
}

export interface ComprehensiveWarningsData {
  phones: {
    warnings: PhoneStockWarning[]
    count: number
    threshold: number
  }
  models?: {
    warnings: PhoneStockWarning[]
    count?: number
  }
  accessories: {
    warnings: AccessoryStockWarning[]
    count: number
  }
  sales: SalesWarningSummary
  purchases: {
    recent: PurchaseWarning[]
    no_recent: PurchaseWarning[]
  }
  summary?: {
    has_warnings: boolean
    total_warnings: number
  }
}
