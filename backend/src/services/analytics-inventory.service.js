'use strict'

const { isConnected } = require('../config/database')
const DashboardRepository = require('../repositories/dashboard.repository')
const AnalyticsInventoryRepository = require('../repositories/analytics-inventory.repository')

class AnalyticsInventoryService {
  constructor({
    repository = new DashboardRepository(),
    turnoverRepository = new AnalyticsInventoryRepository(),
    connected = isConnected
  } = {}) {
    this.repository = repository
    this.turnoverRepository = turnoverRepository
    this.connected = connected
  }

  async getOverview({ storeId, supplierId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const [overview, warnings] = await Promise.all([
      this.turnoverRepository.getOverviewData({ storeId, supplierId }),
      this.repository.getModelStockWarnings(undefined, 500, { storeId, supplierId })
    ])
    const { summary, brands, turnover, suppliers } = overview
    const summaryData = summary || {}
    const turnoverData = turnover || {}
    const soldLast30 = Number.parseInt(turnoverData.soldLast30Days, 10) || 0
    const availableNow = Number.parseInt(turnoverData.availableNow, 10) || 0
    const totalProducts = Number(summaryData.totalProducts) || 0
    const availableProducts = Number(summaryData.availableProducts) || 0
    const availableRate = totalProducts > 0 ? (availableProducts / totalProducts) * 100 : 0
    const warningItems = Array.isArray(warnings) ? warnings : []
    const lowStockItems = warningItems.length
    const outOfStockItems = warningItems.filter(item => (Number.parseInt(item.stock_count, 10) || 0) === 0).length
    const outOfStockPotentialLoss = warningItems
      .filter(item => (Number.parseInt(item.stock_count, 10) || 0) === 0)
      .reduce((sum, item) => sum + (Number.parseFloat(item.avg_cost) || 0) * (Number.parseInt(item.warning_threshold, 10) || 0), 0)
    let healthScore = 100
    if (availableRate < 20) healthScore -= 30
    else if (availableRate < 40) healthScore -= 15
    if (lowStockItems > 5) healthScore -= 20
    else if (lowStockItems > 0) healthScore -= 10
    if (outOfStockItems > 3) healthScore -= 20
    else if (outOfStockItems > 0) healthScore -= 10

    const issues = []
    if (lowStockItems > 0) issues.push({
      type: 'low_stock', severity: lowStockItems > 5 ? 'high' : 'medium',
      description: `有 ${lowStockItems} 个型号库存不足`, affected_items: lowStockItems,
      potential_loss: warningItems.reduce((sum, item) => sum + ((Number.parseFloat(item.avg_cost) || 0) * Math.max((Number.parseInt(item.warning_threshold, 10) || 0) - (Number.parseInt(item.stock_count, 10) || 0), 1)), 0)
    })
    if (outOfStockItems > 0) issues.push({
      type: 'out_of_stock', severity: 'high', description: `有 ${outOfStockItems} 个型号已售罄`,
      affected_items: outOfStockItems, potential_loss: outOfStockPotentialLoss
    })
    const recommendations = []
    if (lowStockItems > 0) recommendations.push('及时补充库存不足的商品')
    if (outOfStockItems > 0) recommendations.push('优先补货已售罄的热销型号')
    if (availableRate < 40) recommendations.push('增加商品备货以提高可售率')
    recommendations.push('定期进行库存盘点确保数据准确性')

    return {
      total_products: totalProducts,
      total_value: Number.parseFloat(summaryData.totalValue) || 0,
      low_stock_items: lowStockItems,
      out_of_stock_items: outOfStockItems,
      overstock_items: 0,
      stock_turnover: Number((availableNow > 0 ? (soldLast30 / availableNow) * 30 : 0).toFixed(2)),
      inventory_health: {
        score: Math.max(0, healthScore),
        level: healthScore >= 80 ? 'excellent' : healthScore >= 60 ? 'good' : healthScore >= 40 ? 'warning' : 'critical',
        issues,
        recommendations
      },
      category_analysis: (brands || []).map(item => ({
        category: item.brand_name, total_items: Number(item.totalItems) || 0,
        total_value: Number.parseFloat(item.totalValue) || 0,
        turnover_rate: Number(item.totalItems) > 0 ? Number(((soldLast30 / Number(item.totalItems)) * 30).toFixed(2)) : 0,
        margin: 15, growth: 0
      })),
      supplier_analysis: (suppliers || []).map(item => {
        const total = Number.parseInt(item.totalProducts, 10) || 0
        const available = Number.parseInt(item.availableProducts, 10) || 0
        const rate = total > 0 ? (available / total) * 100 : 0
        return {
          id: item.id, name: item.name, total_products: total,
          total_value: Number.parseFloat(item.totalValue) || 0, average_delivery_time: null,
          quality_score: Number(rate.toFixed(1)), reliability: Number(rate.toFixed(1))
        }
      })
    }
  }

  async getTurnover({ period, storeId, supplierId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const days = period === '90d' ? 90 : period === '180d' ? 180 : 30
    const { sales, availableCount } = await this.turnoverRepository.getTurnoverData({ days, storeId, supplierId })
    const currentAvailableCount = parseInt(availableCount, 10) || 0

    return sales.map(item => {
      const sold = parseInt(item.soldCount, 10) || 0
      const dailyTurnover = currentAvailableCount > 0 ? sold / currentAvailableCount : 0

      return {
        date: item.date,
        actual_turnover: parseFloat(dailyTurnover.toFixed(2)),
        target_turnover: 0.08
      }
    })
  }

  async getSupplierStats({ storeId, supplierId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const supplierCount = await this.turnoverRepository.getSupplierCount({ storeId, supplierId })
    return { supplier_count: Number(supplierCount) || 0 }
  }

  async getValue({ storeId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const data = await this.turnoverRepository.getInventoryValue(storeId)
    return {
      total_value: parseFloat(data.totalValue) || 0,
      breakdown: {
        available: {
          count: parseInt(data.availableCount, 10) || 0,
          value: parseFloat(data.availableValue) || 0
        },
        sold: {
          count: parseInt(data.soldCount, 10) || 0,
          value: parseFloat(data.soldValue) || 0
        },
        reserved: {
          count: parseInt(data.reservedCount, 10) || 0,
          value: parseFloat(data.reservedValue) || 0
        }
      }
    }
  }

  async getRecentSold({ limit, storeId, supplierId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const rows = await this.turnoverRepository.getRecentSold({ limit, storeId, supplierId })
    return rows.map(row => ({
      brand: row.brand || '未知',
      model: row.model || '未知',
      color: row.color || '未知',
      sale_price: parseFloat(row.salePrice) || 0,
      sale_time: row.saleDate ? new Date(row.saleDate).toLocaleString('zh-CN') : '',
      store: row.store || '未知'
    }))
  }

  async getLowStock({ limit, storeId, supplierId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const warnings = await this.repository.getModelStockWarnings(undefined, limit, { storeId, supplierId })
    return (warnings || []).map((item, index) => {
      const currentStock = parseInt(item.stock_count, 10) || 0
      const reorderPoint = parseInt(item.warning_threshold, 10) || 0
      const avgCost = parseFloat(item.avg_cost) || 0
      const memoryName = item.memory_name || ''
      const conditionLabel = item.condition_label && item.condition_label !== '全部'
        ? ` · ${item.condition_label}`
        : ''

      return {
        id: `${item.model_id}-${item.color_id || 0}-${item.memory_id || 0}-${item.warning_condition ?? 'all'}-${index}`,
        brand: item.brand_name || '',
        model: `${item.model_name || ''}${memoryName ? ` ${memoryName}` : ''}${conditionLabel}`.trim(),
        color: item.color_name || '默认',
        current_stock: currentStock,
        reorder_point: reorderPoint,
        unit_cost: avgCost,
        total_value: avgCost * currentStock,
        last_sale_time: null,
        stock_status: currentStock === 0 ? 'out_of_stock' : currentStock <= reorderPoint ? 'low_stock' : 'in_stock'
      }
    })
  }
}

module.exports = AnalyticsInventoryService
