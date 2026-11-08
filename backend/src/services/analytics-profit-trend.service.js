'use strict'

const { isConnected } = require('../config/database')
const AnalyticsProfitTrendRepository = require('../repositories/analytics-profit-trend.repository')

function formatDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildPeriods(granularity, anchorDate, count) {
  const periods = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    let start
    let end
    let key
    let label
    if (granularity === 'quarter') {
      const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - (offset * 3), 1)
      const quarter = Math.floor(date.getMonth() / 3)
      start = new Date(date.getFullYear(), quarter * 3, 1)
      end = new Date(date.getFullYear(), quarter * 3 + 3, 0)
      key = `${start.getFullYear()}-Q${quarter + 1}`
      label = `${start.getFullYear()}年Q${quarter + 1}`
    } else if (granularity === 'year') {
      const year = anchorDate.getFullYear() - offset
      start = new Date(year, 0, 1)
      end = new Date(year, 11, 31)
      key = `${year}`
      label = `${year}年`
    } else {
      const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1)
      start = new Date(date.getFullYear(), date.getMonth(), 1)
      end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      label = `${start.getFullYear()}年${start.getMonth() + 1}月`
    }
    periods.push({ key, label, startDate: formatDateString(start), endDate: formatDateString(end) })
  }
  return periods
}

class AnalyticsProfitTrendService {
  constructor({ repository = new AnalyticsProfitTrendRepository(), connected = isConnected, now = () => new Date() } = {}) {
    this.repository = repository
    this.connected = connected
    this.now = now
  }

  async getProfitTrend({ granularity = 'month', endDate, storeId = null }) {
    const supported = new Set(['month', 'quarter', 'year'])
    const normalizedGranularity = supported.has(String(granularity)) ? String(granularity) : 'month'
    const bucketCount = normalizedGranularity === 'quarter' ? 8 : normalizedGranularity === 'year' ? 6 : 12
    const parsedAnchorDate = endDate ? new Date(String(endDate)) : this.now()
    const anchorDate = Number.isNaN(parsedAnchorDate.getTime()) ? this.now() : parsedAnchorDate
    const periods = buildPeriods(normalizedGranularity, anchorDate, bucketCount)
    if (periods.length === 0) return { granularity: normalizedGranularity, series: [] }
    if (!this.connected()) throw new Error('数据库连接失败')

    const rangeStart = periods[0].startDate
    const rangeEnd = periods[periods.length - 1].endDate
    const rows = await this.repository.getProfitTrend({ granularity: normalizedGranularity, rangeStart, rangeEnd, storeId })
    const rowMap = new Map(rows.map(row => [row.period_key, {
      totalSales: parseInt(row.totalSales, 10) || 0,
      totalRevenue: Math.round(parseFloat(row.totalRevenue) || 0),
      totalCost: Math.round(parseFloat(row.totalCost) || 0)
    }]))
    const series = periods.map(period => {
      const raw = rowMap.get(period.key) || { totalSales: 0, totalRevenue: 0, totalCost: 0 }
      return {
        key: period.key,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        totalSales: raw.totalSales,
        totalRevenue: raw.totalRevenue,
        totalCost: raw.totalCost,
        totalProfit: raw.totalRevenue - raw.totalCost
      }
    })
    return { granularity: normalizedGranularity, rangeStart, rangeEnd, series }
  }
}

module.exports = AnalyticsProfitTrendService
