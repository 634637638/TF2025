'use strict'

const { isConnected } = require('../config/database')
const AnalyticsSalesForecastRepository = require('../repositories/analytics-sales-forecast.repository')
const { formatDateString } = require('../utils/analytics-query')
const log = require('../utils/log')

class AnalyticsSalesForecastService {
  constructor({ repository = new AnalyticsSalesForecastRepository(), connected = isConnected, logger = log } = {}) {
    this.repository = repository
    this.connected = connected
    this.logger = logger
  }

  async getForecast(query = {}, now = new Date()) {
    const period = query.period || 'month'
    const storeId = query.store_id
    const pageSize = query.page_size ?? 10
    if (!this.connected()) throw Object.assign(new Error('数据库连接失败'), { code: 'DATABASE_UNAVAILABLE' })

    const dates = {
      day30Ago: this.getDateDaysAgo(now, 30),
      day60Ago: this.getDateDaysAgo(now, 60),
      day90Ago: this.getDateDaysAgo(now, 90)
    }
    const today = formatDateString(now)
    this.logger.debug('生成销售预测数据:', { period, store_id: storeId, page_size: pageSize })
    const topProducts = await this.repository.getTopProducts({ dates, storeId })
    topProducts.forEach((product, index) => {
      this.logger.debug(`${index + 1}. ${product.brand_name} ${product.model_name} ${product.color_name} ${product.memory}; score=${product.weighted_score}; sales=${product.total_sales}`)
    })
    if (!topProducts.length) {
      return { combinations: [], summary: { total_combinations: 0, avg_confidence: 0 } }
    }

    const rows = await this.repository.getCombinationSales({ dates, today, storeId, products: topProducts })
    return {
      combinations: processCombinationForecast(rows, period, parseInt(pageSize), this.logger),
      period,
      historicalDays: 90,
      forecastDays: period === 'week' ? 7 : period === 'month' ? 30 : 90
    }
  }

  getDateDaysAgo(now, days) {
    const date = new Date(now)
    date.setDate(date.getDate() - days)
    return formatDateString(date)
  }
}

function processCombinationForecast(rawData, period, limit, logger = log) {
  // 按组合聚合数据
  const combinationMap = new Map()

  rawData.forEach(row => {
    const key = `${row.brand_name}_${row.model_name}_${row.color_name}_${row.memory}`
    if (!combinationMap.has(key)) {
      combinationMap.set(key, {
        brand_name: row.brand_name,
        model_name: row.model_name,
        color_name: row.color_name,
        memory: row.memory,
        display_name: `${row.brand_name} ${row.model_name} ${row.color_name} ${row.memory}`,
        historical_sales: [],
        daily_sales: {},
        total_sales: 0,
        total_revenue: 0,
        total_profit: 0
      })
    }

    const combination = combinationMap.get(key)
    const dateStr = row.sale_time ? new Date(row.sale_time).toISOString().split('T')[0] : ''

    combination.historical_sales.push({
      date: dateStr,
      count: parseInt(row.sales_count) || 0
    })

    // 按日期聚合
    if (!combination.daily_sales[dateStr]) {
      combination.daily_sales[dateStr] = 0
    }
    combination.daily_sales[dateStr] += parseInt(row.sales_count) || 0

    combination.total_sales += parseInt(row.sales_count) || 0
    combination.total_revenue += parseFloat(row.total_revenue) || 0
    combination.total_profit += parseFloat(row.total_profit) || 0
  })

  // 计算预测值
  const forecastData = []
  combinationMap.forEach((combination, _key) => {
    // 只保留有销售记录的组合（至少有1次销售）
    if (combination.total_sales === 0) return

    // 计算日均销量
    const avgDailySales = combination.total_sales / 90

    // 计算预测周期的销量
    let forecastDays = 30
    if (period === 'week') forecastDays = 7
    else if (period === 'quarter') forecastDays = 90

    const predictedSales = Math.round(avgDailySales * forecastDays)
    const predictedRevenue = Math.round((combination.total_revenue / combination.total_sales) * predictedSales)
    const predictedProfit = Math.round((combination.total_profit / combination.total_sales) * predictedSales)

    // 计算趋势（最近30天 vs 之前60天）
    const now = new Date()
    const recent30DaysAgo = new Date(now)
    recent30DaysAgo.setDate(recent30DaysAgo.getDate() - 30)
    const recent60DaysAgo = new Date(now)
    recent60DaysAgo.setDate(recent60DaysAgo.getDate() - 90)

    let recent30DaysSales = 0
    let previous60DaysSales = 0

    Object.keys(combination.daily_sales).forEach(dateStr => {
      const date = new Date(dateStr)
      if (date >= recent30DaysAgo) {
        recent30DaysSales += combination.daily_sales[dateStr]
      } else if (date >= recent60DaysAgo) {
        previous60DaysSales += combination.daily_sales[dateStr]
      }
    })

    const trend = previous60DaysSales > 0
      ? ((recent30DaysSales / 30) / (previous60DaysSales / 60) - 1) * 100
      : 0

    // 生成历史和预测的时间序列数据（用于图表）
    const timeSeriesData = generateTimeSeries(combination.daily_sales, period, combination.total_sales, combination.historical_sales.length, logger)

    forecastData.push({
      brand_name: combination.brand_name,
      model_name: combination.model_name,
      color_name: combination.color_name,
      memory: combination.memory,
      display_name: combination.display_name,
      actual_sales: combination.total_sales,
      actual_revenue: Math.round(combination.total_revenue),
      actual_profit: Math.round(combination.total_profit),
      predicted_sales: predictedSales,
      predicted_revenue: predictedRevenue,
      predicted_profit: predictedProfit,
      trend: parseFloat(trend.toFixed(1)),
      confidence: calculateConfidence(combination.historical_sales),
      time_series: timeSeriesData
    })
  })

  // 按实际销量排序，取前 N 个
  return forecastData.sort((a, b) => b.actual_sales - a.actual_sales).slice(0, limit)
}

// 生成时间序列数据（历史 + 预测）- 基于实际销售数据的智能预测
function generateTimeSeries(dailySales, period, totalSales, _historicalDays, logger = log) {
  const result = {
    dates: [],
    actual: [],
    predicted: [],
    upper_bound: [],
    lower_bound: []
  }

  // 生成过去90天的历史数据（使用本地时间，适配北京时间）
  const now = new Date()
  const last90DaysData = []
  const last90DaysDates = []

  for (let i = 89; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = formatDateString(date) // 使用本地时间（北京时间）
    const sales = dailySales[dateStr] || 0

    last90DaysData.push(sales)
    last90DaysDates.push(dateStr)

    // 显示最近30天的历史数据在图表上（包括今天）
    if (i <= 29) {
      result.dates.push(dateStr)
      result.actual.push(sales)
      result.predicted.push(null)
      result.upper_bound.push(null)
      result.lower_bound.push(null)
    }
  }

  // 如果没有任何销售数据，直接返回全0预测
  if (totalSales === 0) {
    const forecastDays = period === 'week' ? 7 : period === 'month' ? 30 : 90
    for (let i = 1; i <= forecastDays; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() + i)
      result.dates.push(formatDateString(date))
      result.actual.push(null)
      result.predicted.push(0)
      result.upper_bound.push(0)
      result.lower_bound.push(0)
    }
    return result
  }

  // 分析90天数据，分为三个时间段：最近30天、31-60天、61-90天
  const last30Days = last90DaysData.slice(-30)
  const days31to60 = last90DaysData.slice(-60, -30)
  const days61to90 = last90DaysData.slice(-90, -60)

  // 计算每个时间段的销售统计
  const stats30 = calculatePeriodStats(last30Days)
  const stats60 = calculatePeriodStats(days31to60)
  const stats90 = calculatePeriodStats(days61to90)

  // 产品类型分类
  let productType = 'normal'
  let productTypeDesc = '正常销售'

  // 热销产品：最近30天销售频率>30%（即30天内至少9天有销售），且总销量>=5台
  if (stats30.frequency > 0.3 && stats30.totalSales >= 5) {
    productType = 'hot'
    productTypeDesc = '热销产品'
  }
  // 高频产品：最近30天销售频率>50%（即30天内至少15天有销售）
  else if (stats30.frequency > 0.5) {
    productType = 'hot'
    productTypeDesc = '高频销售'
  }
  // 滞销产品：最近30天销售频率<10%（即30天内少于3天有销售）
  else if (stats30.frequency < 0.1) {
    productType = 'slow'
    productTypeDesc = '滞销产品'
  }
  // 新品：最近30天有销售，但之前60天没有或很少
  else if (stats30.totalSales > 0 && stats60.totalSales === 0 && stats90.totalSales === 0) {
    productType = 'new'
    productTypeDesc = '新品'
  }

  // 根据产品类型使用不同的预测策略
  // 核心算法：多时间窗口加权组合 30天×50% + 60天×30% + 90天×20%
  let predictedDailySales = 0

  if (productType === 'hot') {
    // 热销产品：加权组合 + 趋势加成
    const weightedAvg = stats30.avgPerDay * 0.5 +
                        stats60.avgPerDay * 0.3 +
                        stats90.avgPerDay * 0.2
    predictedDailySales = weightedAvg
  } else if (productType === 'slow') {
    // 滞销产品：使用活跃日平均 * 频率，加权组合
    predictedDailySales = (stats30.avgPerActiveDay * stats30.frequency * 0.5 +
                          stats60.avgPerActiveDay * stats60.frequency * 0.3 +
                          stats90.avgPerActiveDay * stats90.frequency * 0.2)
    // 滞销产品至少保证有一定的预测值（如果90天有销售）
    if (predictedDailySales < 0.05 && totalSales > 0) {
      predictedDailySales = totalSales / 90 // 使用90天平均
    }
  } else if (productType === 'new') {
    // 新品：主要基于最近30天，使用日均销量并增加增长预期
    predictedDailySales = stats30.avgPerDay * 0.7 * 1.2 + // 30天占70%，增长20%
                          stats60.avgPerDay * 0.3
  } else {
    // 正常产品：标准加权组合 30天×50% + 60天×30% + 90天×20%
    predictedDailySales = stats30.avgPerDay * 0.5 +
                          stats60.avgPerDay * 0.3 +
                          stats90.avgPerDay * 0.2
  }

  // 计算趋势系数
  let trendFactor = 1.0
  if (stats60.avgPerDay > 0) {
    trendFactor = stats30.avgPerDay / stats60.avgPerDay
    // 根据产品类型调整趋势系数的影响范围
    if (productType === 'hot') {
      trendFactor = Math.max(0.8, Math.min(1.5, trendFactor)) // 热销产品允许更大波动
    } else if (productType === 'slow') {
      trendFactor = Math.max(0.9, Math.min(1.1, trendFactor)) // 滞销产品趋势变化小
    } else {
      trendFactor = Math.max(0.85, Math.min(1.3, trendFactor)) // 正常产品中等波动
    }
  }

  // 应用趋势系数
  predictedDailySales *= trendFactor

  // 调试日志 - 显示加权组合算法
  logger.debug(`\n📊 [${productTypeDesc}] 预测计算 (加权组合: 30天×50% + 60天×30% + 90天×20%)`)
  logger.debug(`   总销量: ${totalSales}台 (90天)`)
  logger.debug(`   最近30天: 销售${stats30.totalSales}台, 日均${stats30.avgPerDay.toFixed(3)}台`)
  logger.debug(`   31-60天: 销售${stats60.totalSales}台, 日均${stats60.avgPerDay.toFixed(3)}台`)
  logger.debug(`   61-90天: 销售${stats90.totalSales}台, 日均${stats90.avgPerDay.toFixed(3)}台`)
  logger.debug(`   加权日均: ${stats30.avgPerDay.toFixed(3)}×0.5 + ${stats60.avgPerDay.toFixed(3)}×0.3 + ${stats90.avgPerDay.toFixed(3)}×0.2 = ${(stats30.avgPerDay * 0.5 + stats60.avgPerDay * 0.3 + stats90.avgPerDay * 0.2).toFixed(3)}台`)
  logger.debug(`   趋势系数: ${trendFactor.toFixed(2)}`)
  logger.debug(`   最终日均预测: ${predictedDailySales.toFixed(3)}台/天`)

  // 生成未来的预测数据
  let forecastDays = 30
  if (period === 'week') forecastDays = 7
  else if (period === 'quarter') forecastDays = 90

  // 计算整个预测周期的总销量
  const rawPredicted = predictedDailySales * forecastDays
  let totalPredicted = Math.round(rawPredicted)

  // 对于小数预测，使用更合理的规则：
  // - 如果原始预测 >= 0.2台，至少预测1台（因为有一定销售可能性）
  // - 如果原始预测 < 0.2台，预测0台（销售可能性很低）
  if (totalPredicted === 0 && rawPredicted >= 0.2) {
    totalPredicted = 1
  }

  logger.debug(`   预测周期: ${forecastDays}天`)
  logger.debug(`   原始预测: ${rawPredicted.toFixed(2)}台`)
  logger.debug(`   预测总销量: ${totalPredicted}台\n`)

  // 将总销量智能分配到各天
  const dailyPredictions = distributeSalesIntelligent(totalPredicted, forecastDays, stats30.frequency, productType)

  logger.debug(`   每日分配: [${dailyPredictions.slice(0, 8).join(', ')}]`)

  // 计算标准差（用于置信区间）
  const stdDev = Math.sqrt(stats30.variance)

  // 先更新今天的预测值（今天的历史数据已在前面添加，需要更新其predicted值）
  // 找到今天在result.dates中的索引
  const todayStr = formatDateString(now)
  const todayIndex = result.dates.indexOf(todayStr)
  if (todayIndex !== -1) {
    // 今天也使用第一天的预测值
    const todayPredicted = dailyPredictions[0] || 0
    result.predicted[todayIndex] = todayPredicted
    logger.debug(`   今天(${todayStr})预测: ${todayPredicted}台, 实际: ${result.actual[todayIndex]}台`)
  }

  // 从明天开始预测
  for (let i = 1; i <= forecastDays; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() + i)
    const dateStr = formatDateString(date)

    const predicted = dailyPredictions[i] || 0

    // 计算置信区间
    let upperBound, lowerBound

    if (totalPredicted === 0) {
      upperBound = 0
      lowerBound = 0
    } else if (productType === 'hot') {
      // 热销产品：置信区间较窄
      const confidenceRange = Math.max(1, Math.round(stdDev * 1.2))
      upperBound = predicted + confidenceRange
      lowerBound = Math.max(0, predicted - Math.round(confidenceRange * 0.8))
    } else if (productType === 'slow') {
      // 滞销产品：置信区间较宽
      const confidenceRange = Math.max(1, Math.round(stdDev * 2))
      upperBound = predicted + confidenceRange
      lowerBound = Math.max(0, predicted - confidenceRange)
    } else {
      // 正常产品：中等置信区间
      const confidenceRange = Math.max(1, Math.round(stdDev * 1.5))
      upperBound = predicted + confidenceRange
      lowerBound = Math.max(0, predicted - confidenceRange)
    }

    result.dates.push(dateStr)
    result.actual.push(null)
    result.predicted.push(predicted)
    result.upper_bound.push(upperBound)
    result.lower_bound.push(lowerBound)
  }

  return result
}

// 计算时间段的统计数据
function calculatePeriodStats(salesData) {
  const totalDays = salesData.length
  const totalSales = salesData.reduce((sum, val) => sum + val, 0)
  const activeDays = salesData.filter(val => val > 0).length
  const frequency = activeDays / totalDays
  const avgPerDay = totalSales / totalDays
  const avgPerActiveDay = activeDays > 0 ? totalSales / activeDays : 0

  // 计算方差
  const mean = avgPerDay
  const variance = salesData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totalDays

  return {
    totalSales,
    activeDays,
    frequency,
    avgPerDay,
    avgPerActiveDay,
    variance
  }
}

// 智能分配销量到各天
function distributeSalesIntelligent(totalSales, days, frequency, productType) {
  const distribution = new Array(days + 1).fill(0)

  if (totalSales === 0) return distribution

  // 根据产品类型和销售频率决定分配策略
  if (productType === 'hot') {
    // 热销产品：均匀分配并保持可复现，避免每次刷新得到不同的业务预测。
    const basePerDay = Math.floor(totalSales / days)
    const remainder = totalSales % days
    for (let i = 0; i < days; i++) {
      distribution[i] = basePerDay + (i < remainder ? 1 : 0)
    }
  } else if (productType === 'slow') {
    // 滞销产品：集中在少数几天
    const activeDaysCount = Math.max(1, Math.round(days * frequency))
    const salesPerActiveDay = Math.ceil(totalSales / activeDaysCount)
    let remaining = totalSales

    // 均匀间隔选择活跃日
    const interval = Math.floor(days / activeDaysCount)
    for (let i = 0; i < activeDaysCount && remaining > 0; i++) {
      const dayIndex = Math.min(i * interval, days - 1)
      const allocated = Math.min(salesPerActiveDay, remaining)
      distribution[dayIndex] = allocated
      remaining -= allocated
    }
  } else {
    // 正常产品：基于频率分配
    const expectedActiveDays = Math.max(1, Math.round(days * frequency))

    if (totalSales <= expectedActiveDays) {
      // 销量少，每个活跃日1台
      const interval = Math.floor(days / totalSales)
      for (let i = 0; i < totalSales; i++) {
        const dayIndex = Math.min(i * interval, days)
        distribution[dayIndex] = 1
      }
    } else {
      // 销量多，平均分配到活跃日
      const avgPerActiveDay = Math.ceil(totalSales / expectedActiveDays)
      let remaining = totalSales
      const interval = Math.floor(days / expectedActiveDays)

      for (let i = 0; i < expectedActiveDays && remaining > 0; i++) {
        const dayIndex = Math.min(i * interval, days - 1)
        const allocated = Math.min(avgPerActiveDay, remaining)
        distribution[dayIndex] = allocated
        remaining -= allocated
      }

      // 将剩余的分配到第一个活跃日
      if (remaining > 0) {
        distribution[0] += remaining
      }
    }
  }

  return distribution
}


// 计算预测置信度（基于数据稳定性）
function calculateConfidence(historicalSales) {
  if (historicalSales.length < 7) return 'low'

  // 计算变异系数（标准差/平均值）
  const counts = historicalSales.map(item => item.count)
  const avg = counts.reduce((sum, val) => sum + val, 0) / counts.length

  if (avg === 0) return 'low'

  const variance = counts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / counts.length
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / avg

  // 变异系数越小，数据越稳定，置信度越高
  if (cv < 0.3) return 'high'
  if (cv < 0.6) return 'medium'
  return 'low'
}

module.exports = AnalyticsSalesForecastService
