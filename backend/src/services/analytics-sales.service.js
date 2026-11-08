'use strict'

const { isConnected } = require('../config/database')
const AnalyticsSalesRepository = require('../repositories/analytics-sales.repository')

class AnalyticsSalesService {
  constructor({ repository = new AnalyticsSalesRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getSales(filters) {
    if (!this.connected()) throw new Error('数据库连接失败')
    const { salesRows, storeRows, productRows } = await this.repository.getSales(filters)
    const totalSales = salesRows.reduce((sum, item) => sum + parseFloat(item.totalSales || 0), 0)
    const totalOrders = salesRows.reduce((sum, item) => sum + parseInt(item.totalOrders || 0, 10), 0)
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    return {
      top_products: productRows.map(item => ({
        id: item.id,
        imei: item.imei,
        model_name: item.model_name,
        brand_name: item.brand_name,
        quantity: Number(item.quantity) || 0,
        revenue: Number(item.revenue) || 0,
        growth: null,
        stock_status: item.stock_status || 'unknown'
      })),
      sales_by_store: storeRows.map(item => ({
        id: item.id,
        name: item.name,
        total_sales: Number(item.totalSales) || 0,
        total_orders: Number(item.totalOrders) || 0,
        average_order_value: Number(item.averageOrderValue) || 0,
        performance: Number(item.totalSales) > 50000 ? 'excellent' :
          Number(item.totalSales) > 20000 ? 'good' : 'average',
        growth_rate: 0
      })),
      sales_by_period: salesRows.map(item => ({
        period: item.date,
        sales: parseFloat(item.totalSales || 0),
        orders: parseInt(item.totalOrders || 0, 10),
        revenue: parseFloat(item.totalSales || 0),
        target: parseFloat(item.totalSales || 0),
        achievement: parseFloat(item.totalSales || 0) > 0 ? 100 : 0
      })),
      total_sales: { total: totalSales, change: 0, change_percent: 0, trend: 'stable' },
      total_orders: { total: totalOrders, change: 0, change_percent: 0, trend: 'stable' },
      average_order_value: { total: averageOrderValue, change: 0, change_percent: 0, trend: 'stable' },
      revenue_forecast: []
    }
  }
}

module.exports = AnalyticsSalesService
