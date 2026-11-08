'use strict'

const { isConnected } = require('../config/database')
const AnalyticsCustomerActivityRepository = require('../repositories/analytics-customer-activity.repository')

const ACTIVITY_LEVELS = Object.freeze(['非常活跃', '活跃', '一般', '不活跃'])
const DAY_NAMES = Object.freeze(['周日', '周一', '周二', '周三', '周四', '周五', '周六'])

class AnalyticsCustomerActivityService {
  constructor({ repository = new AnalyticsCustomerActivityRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  async getActivity({ storeId }) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const result = await this.repository.getActivity(storeId)
    const rateData = result.rate || { total_customers: 0, active_customers: 0 }
    const activeRate = Number(rateData.total_customers) > 0
      ? ((Number(rateData.active_customers) / Number(rateData.total_customers)) * 100).toFixed(1)
      : 0
    const distributionByLevel = new Map(result.distribution.map(row => [row.activity_level, row]))

    return {
      active_rate: parseFloat(activeRate),
      distribution: ACTIVITY_LEVELS.map(level => ({
        name: level,
        value: distributionByLevel.get(level)?.count || 0
      })),
      weekly_activity: result.weeklyActivity.map(row => {
        const date = new Date(row.date)
        return {
          date: row.date,
          day: DAY_NAMES[date.getDay()],
          active_users: Number(row.active_users) || 0
        }
      })
    }
  }
}

module.exports = AnalyticsCustomerActivityService
