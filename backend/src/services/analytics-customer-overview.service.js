'use strict'

const { isConnected } = require('../config/database')
const { getBeijingTimeString } = require('../utils/time')
const AnalyticsCustomerOverviewRepository = require('../repositories/analytics-customer-overview.repository')

class AnalyticsCustomerOverviewService {
  constructor({ repository = new AnalyticsCustomerOverviewRepository(), connected = isConnected, getNow = getBeijingTimeString } = {}) {
    this.repository = repository
    this.connected = connected
    this.getNow = getNow
  }

  async getOverview(filters) {
    if (!this.connected()) throw new Error('数据库连接失败')
    const data = await this.repository.getOverview(filters)
    const newGrowth = data.lastMonthNew > 0
      ? ((data.newCustomers - data.lastMonthNew) / data.lastMonthNew * 100).toFixed(1)
      : data.newCustomers > 0 ? '100' : '0'
    const activeGrowth = data.lastYearActive > 0
      ? ((data.activeCustomers - data.lastYearActive) / data.lastYearActive * 100).toFixed(1)
      : data.activeCustomers > 0 ? '100' : '0'

    return {
      total_customers: Number(data.totalCustomers) || 0,
      customers_growth: parseFloat(newGrowth),
      new_customers: Number(data.newCustomers) || 0,
      last_month_new_customers: Number(data.lastMonthNew) || 0,
      new_customers_growth: parseFloat(newGrowth),
      active_customers: Number(data.activeCustomers) || 0,
      active_customers_growth: parseFloat(activeGrowth),
      high_value_customers: Number(data.highValueCount) || 0,
      high_value_customers_growth: 0,
      customer_segments: data.segments.map(item => ({
        segment: item.segment,
        count: item.count,
        avg_order_value: Number(item.avgOrderValue) || 0,
        total_revenue: Number(item.totalRevenue) || 0
      })),
      insights: [
        {
          id: 'customer-overview', type: 'info', title: '客户总览',
          content: `目前共有 ${data.totalCustomers.toLocaleString()} 位客户，本月新增 ${data.newCustomers} 位，上月新增 ${data.lastMonthNew} 位`,
          impact: 'medium', impact_text: '本月新增客户', date: this.getNow()
        },
        {
          id: 'customer-activity', type: data.activeCustomers > 0 ? 'success' : 'warning', title: '活跃度分析',
          content: `${data.activeCustomers} 位客户在最近30天内有购买记录`,
          impact: data.activeCustomers > 100 ? 'high' : 'low',
          impact_text: data.activeCustomers > 100 ? '活跃度高' : '需要提升活跃度', date: this.getNow()
        }
      ]
    }
  }
}

module.exports = AnalyticsCustomerOverviewService
