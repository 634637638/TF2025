'use strict'

const { isConnected } = require('../config/database')
const AnalyticsProductRankingRepository = require('../repositories/analytics-product-ranking.repository')

const toInteger = value => parseInt(value, 10) || 0
const toNumber = value => parseFloat(value) || 0

class AnalyticsProductRankingService {
  constructor({ repository = new AnalyticsProductRankingRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getRanking(type, filters) {
    if (type !== 'brand' && type !== 'model') throw new TypeError('Unsupported product ranking type')
    if (!this.connected()) throw new Error('数据库连接失败')
    const pageSize = parseInt(String(filters.pageSize || '10'), 10)
    const sortBy = ['count', 'amount', 'profit'].includes(String(filters.sortBy)) ? String(filters.sortBy) : 'count'
    const { retailRows, wholesaleRows } = await this.repository.getRanking(type, filters)
    const rankingsById = new Map()

    retailRows.forEach(item => {
      rankingsById.set(item.id, {
        id: item.id,
        name: item.name,
        ...(type === 'model' ? { brand_name: item.brand_name, cost: toNumber(item.cost) } : {}),
        count: toInteger(item.count),
        amount: toNumber(item.amount)
      })
    })
    wholesaleRows.forEach(item => {
      const existing = rankingsById.get(item.id)
      const wholesaleCount = toInteger(item.count)
      if (existing) {
        existing.count += wholesaleCount
        existing.amount += toNumber(item.amount)
        if (type === 'model') existing.cost += toNumber(item.cost)
      } else if (wholesaleCount > 0) {
        rankingsById.set(item.id, {
          id: item.id,
          name: item.name,
          ...(type === 'model' ? { brand_name: item.brand_name, cost: toNumber(item.cost) } : {}),
          count: wholesaleCount,
          amount: toNumber(item.amount)
        })
      }
    })

    let rankings = [...rankingsById.values()].filter(item => item.count > 0)
    if (type === 'model') {
      rankings = rankings.map(item => ({ ...item, profit: item.amount - item.cost }))
      rankings.sort((left, right) => sortBy === 'amount'
        ? right.amount - left.amount
        : sortBy === 'profit' ? right.profit - left.profit : right.count - left.count)
    } else {
      rankings.sort((left, right) => right.count - left.count)
    }
    rankings = rankings.slice(0, pageSize)

    if (type === 'brand') {
      const maxCount = rankings.length ? rankings[0].count : 1
      return rankings.map(item => ({
        name: item.name,
        count: toInteger(item.count),
        amount: item.amount,
        percent: Math.round((item.count / maxCount) * 100)
      }))
    }

    const maxCount = rankings.length ? rankings[0].count : 1
    const maxAmount = rankings.length ? rankings[0].amount : 1
    const maxProfit = rankings.length ? rankings[0].profit : 1
    return rankings.map(item => ({
      name: `${item.brand_name} ${item.name}`,
      count: toInteger(item.count),
      amount: item.amount,
      cost: item.cost,
      profit: item.profit,
      percent: Math.round(sortBy === 'amount'
        ? (item.amount / (maxAmount || 1)) * 100
        : sortBy === 'profit'
          ? (item.profit / (maxProfit || 1)) * 100
          : (item.count / (maxCount || 1)) * 100)
    }))
  }
}

module.exports = AnalyticsProductRankingService
