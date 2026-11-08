'use strict'

const { isConnected } = require('../config/database')
const AnalyticsEmployeePerformanceRepository = require('../repositories/analytics-employee-performance.repository')

const dateString = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

class AnalyticsEmployeePerformanceService {
  constructor({ repository = new AnalyticsEmployeePerformanceRepository(), connected = isConnected, now = () => new Date() } = {}) {
    this.repository = repository
    this.connected = connected
    this.now = now
  }

  async getPerformance({ startDate, endDate, storeId }) {
    if (!this.connected()) throw new Error('数据库连接失败')
    let queryStartDate = startDate
    let queryEndDate = endDate
    if (!queryStartDate || !queryEndDate) {
      const now = this.now()
      const year = now.getFullYear()
      const month = now.getMonth()
      queryStartDate = dateString(new Date(year, month, 1))
      queryEndDate = dateString(new Date(year, month + 1, 0))
    }

    const { retailRows, wholesaleRows } = await this.repository.getPerformance({
      startDate: queryStartDate,
      endDate: queryEndDate,
      storeId
    })
    const wholesaleByUser = new Map(wholesaleRows.map(row => [row.user_id, row]))
    return retailRows.map(row => {
      const wholesale = wholesaleByUser.get(row.user_id) || {}
      const newCount = (parseInt(row.new_sales_count, 10) || 0) + (parseInt(wholesale.new_wholesale_count, 10) || 0)
      const newAmount = (parseFloat(row.new_sales_amount) || 0) + (parseFloat(wholesale.new_wholesale_amount) || 0)
      const newProfit = (parseFloat(row.new_profit) || 0) + (parseFloat(wholesale.new_wholesale_profit) || 0)
      const usedCount = (parseInt(row.used_sales_count, 10) || 0) + (parseInt(wholesale.used_wholesale_count, 10) || 0)
      const usedAmount = (parseFloat(row.used_sales_amount) || 0) + (parseFloat(wholesale.used_wholesale_amount) || 0)
      const usedProfit = (parseFloat(row.used_profit) || 0) + (parseFloat(wholesale.used_wholesale_profit) || 0)
      const totalCount = newCount + usedCount
      return {
        id: row.user_id,
        name: row.real_name || row.user_name,
        store: row.store_name || '未分配',
        newCount,
        newAmount: Math.round(newAmount),
        newProfit: Math.round(newProfit),
        usedCount,
        usedAmount: Math.round(usedAmount),
        usedProfit: Math.round(usedProfit),
        totalCount,
        totalAmount: Math.round(newAmount + usedAmount),
        totalProfit: Math.round(newProfit + usedProfit)
      }
    }).filter(employee => employee.totalCount > 0)
      .sort((left, right) => right.totalCount - left.totalCount)
  }
}

module.exports = AnalyticsEmployeePerformanceService
