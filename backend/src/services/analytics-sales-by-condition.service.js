'use strict'

const { isConnected } = require('../config/database')
const AnalyticsSalesByConditionRepository = require('../repositories/analytics-sales-by-condition.repository')
const log = require('../utils/log')

const EMPTY_TOTAL = Object.freeze({ salesCount: 0, salesAmount: 0, profit: 0 })
const toInteger = value => parseInt(value, 10) || 0
const toNumber = value => parseFloat(value) || 0

const toSummary = (row = EMPTY_TOTAL) => {
  const salesCount = toInteger(row.salesCount)
  const salesAmount = toNumber(row.salesAmount)
  const profit = toNumber(row.profit)
  return {
    sales_count: salesCount,
    sales_amount: salesAmount,
    profit,
    margin_rate: parseFloat((salesAmount > 0 ? (profit / salesAmount) * 100 : 0).toFixed(1)),
    avg_price: parseFloat((salesCount > 0 ? salesAmount / salesCount : 0).toFixed(0))
  }
}

class AnalyticsSalesByConditionService {
  constructor({ repository = new AnalyticsSalesByConditionRepository(), connected = isConnected, logger = log } = {}) {
    this.repository = repository
    this.connected = connected
    this.logger = logger
  }

  async getSalesByCondition(filters) {
    if (!this.connected()) throw new Error('数据库连接失败')
    const [newRetail, usedRetail] = await this.repository.getRetailTotals(filters)
    try {
      await this.repository.getWholesaleTotals(filters)
    } catch (error) {
      this.logger.error('批发数据查询失败:', error)
    }

    return {
      new: toSummary(newRetail),
      used: toSummary(usedRetail)
    }
  }
}

module.exports = AnalyticsSalesByConditionService
