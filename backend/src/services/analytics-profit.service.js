'use strict'

const { isConnected } = require('../config/database')
const AnalyticsProfitRepository = require('../repositories/analytics-profit.repository')
const log = require('../utils/log')

const parseInteger = value => parseInt(value, 10) || 0
const parseNumber = value => parseFloat(value) || 0
const emptyResult = Object.freeze({ totalSales: 0, totalRevenue: 0, totalCost: 0 })

function sumResults(retail = emptyResult, wholesale = emptyResult) {
  return {
    totalSales: parseInteger(retail.totalSales) + parseInteger(wholesale.totalSales),
    totalRevenue: parseNumber(retail.totalRevenue) + parseNumber(wholesale.totalRevenue),
    totalCost: parseNumber(retail.totalCost) + parseNumber(wholesale.totalCost)
  }
}

function getPreviousMonthRange(startDate) {
  const start = new Date(startDate)
  const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
  const previousEnd = new Date(start.getFullYear(), start.getMonth(), 0)
  const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { startDate: format(previousStart), endDate: format(previousEnd) }
}

class AnalyticsProfitService {
  constructor({ repository = new AnalyticsProfitRepository(), connected = isConnected, now = () => new Date(), logger = log } = {}) {
    this.repository = repository
    this.connected = connected
    this.now = now
    this.logger = logger
  }

  async getProfit({ startDate, endDate, storeId }) {
    if (!this.connected()) throw new Error('数据库连接失败')

    let currentStartDate = startDate
    let currentEndDate = endDate
    if (!currentStartDate || !currentEndDate) {
      const now = this.now()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      currentStartDate = `${year}-${month}-01`
      currentEndDate = `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`
    }
    const previousRange = getPreviousMonthRange(currentStartDate)
    this.logger.debug('本月日期范围:', currentStartDate, '-', currentEndDate)
    this.logger.debug('上月日期范围:', previousRange.startDate, '-', previousRange.endDate)

    const periodData = await this.repository.getPeriodData({
      currentStartDate,
      currentEndDate,
      previousStartDate: previousRange.startDate,
      previousEndDate: previousRange.endDate,
      storeId
    })
    const currentData = sumResults(periodData.currentRetail, periodData.currentWholesale)
    const lastData = sumResults(periodData.previousRetail, periodData.previousWholesale)
    let lastRevenue = lastData.totalRevenue
    let lastCost = lastData.totalCost

    this.logger.debug('合并后本月数据:', currentData)
    this.logger.debug('合并后上月数据:', lastData)

    if ((lastRevenue === 0 || lastCost === 0) && (currentData.totalRevenue > 0 || currentData.totalCost > 0)) {
      this.logger.debug('上月数据为空，尝试查找最近有销售数据的月份...')
      const recentMonth = await this.repository.getMostRecentRetailMonth({ beforeDate: currentStartDate, storeId })
      if (recentMonth && recentMonth.length > 0) {
        lastRevenue = parseNumber(recentMonth.totalRevenue)
        lastCost = parseNumber(recentMonth.totalCost)
        this.logger.debug('找到最近有销售数据的月份:', recentMonth.month, '数据:', { lastRevenue, lastCost })
      } else {
        this.logger.debug('未找到最近有销售数据的月份')
      }
    }

    const currentSales = currentData.totalSales
    const currentRevenue = currentData.totalRevenue
    const currentCost = currentData.totalCost
    this.logger.debug('本月数据:', { sales: currentSales, revenue: currentRevenue, cost: currentCost })
    this.logger.debug('上月数据:', { revenue: lastRevenue, cost: lastCost })

    const currentGrossProfit = currentRevenue - currentCost
    const currentMarginRate = currentRevenue > 0 ? (currentGrossProfit / currentRevenue) * 100 : 0
    const currentNetProfit = currentGrossProfit
    const currentNetMarginRate = currentRevenue > 0 ? (currentNetProfit / currentRevenue) * 100 : 0
    const lastGrossProfit = lastRevenue - lastCost
    const lastNetProfit = lastGrossProfit
    const lastNetMarginRate = lastRevenue > 0 ? (lastNetProfit / lastRevenue) * 100 : 0
    const revenueChange = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 0
    const netProfitChange = lastNetProfit > 0 ? ((currentNetProfit - lastNetProfit) / lastNetProfit * 100) : 0
    const netMarginRateChange = currentNetMarginRate - lastNetMarginRate

    const result = {
      summary: {
        totalRevenue: Math.round(currentRevenue),
        totalCost: Math.round(currentCost),
        grossProfit: Math.round(currentGrossProfit),
        marginRate: parseFloat(currentMarginRate.toFixed(1)),
        netMarginRate: parseFloat(currentNetMarginRate.toFixed(1)),
        netProfit: Math.round(currentNetProfit),
        totalSalesCount: currentSales,
        roi: currentCost > 0 ? parseFloat((currentGrossProfit / currentCost * 100).toFixed(1)) : 0,
        perCapitaOutput: currentSales > 0 ? Math.round(currentRevenue / currentSales) : 0,
        lastMonth: {
          totalRevenue: Math.round(lastRevenue),
          netProfit: Math.round(lastNetProfit),
          netMarginRate: parseFloat(lastNetMarginRate.toFixed(1))
        },
        revenueTrend: revenueChange >= 0 ? 'up' : 'down',
        revenueChange: parseFloat(Math.abs(revenueChange).toFixed(1)),
        netProfitTrend: netProfitChange >= 0 ? 'up' : 'down',
        netProfitChange: parseFloat(Math.abs(netProfitChange).toFixed(1)),
        netMarginRateTrend: netMarginRateChange >= 0 ? 'up' : 'down',
        netMarginRateChange: parseFloat(Math.abs(netMarginRateChange).toFixed(1))
      },
      costBreakdown: []
    }
    this.logger.debug('盈利分析数据:', result.summary)
    return result
  }
}

module.exports = AnalyticsProfitService
