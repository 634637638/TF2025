'use strict'

const AnalyticsTransfersRepository = require('../repositories/analytics-transfers.repository')
const { isConnected } = require('../config/database')
const { parseOptionalInt, hasValidQueryValue, parseOptionalDate } = require('../utils/analytics-query')
const log = require('../utils/log')

class AnalyticsTransfersService {
  constructor({ repository = new AnalyticsTransfersRepository(), connected = isConnected, logger = log } = {}) {
    this.repository = repository
    this.connected = connected
    this.logger = logger
  }

  async getAnalytics(query = {}, now = new Date()) {
    const requestedStartDate = query.start_date
    const requestedEndDate = query.end_date
    const startDate = parseOptionalDate(requestedStartDate)
    const endDate = parseOptionalDate(requestedEndDate)
    if ((hasValidQueryValue(requestedStartDate) && !startDate) || (hasValidQueryValue(requestedEndDate) && !endDate)) {
      throw Object.assign(new Error('日期格式必须为 YYYY-MM-DD'), { statusCode: 400, code: 'INVALID_DATE' })
    }
    if (!this.connected()) {
      throw Object.assign(new Error('数据库连接失败'), { statusCode: 503, code: 'DATABASE_UNAVAILABLE' })
    }

    let startStr = startDate
    let endStr = endDate
    if (!startDate || !endDate) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      startStr = monthStart.toISOString().split('T')[0]
      endStr = monthEnd.toISOString().split('T')[0]
    }
    const storeId = parseOptionalInt(query.store_id)
    this.logger.debug('查询划拨批发分析数据:', { startDate: startStr, endDate: endStr, storeId })
    const rows = await this.repository.getAnalytics({ startDate: startStr, endDate: endStr, storeId })
    const wholesale = rows.wholesale?.[0] || { count: 0, amount: 0, profit: 0 }
    const allocation = rows.allocation?.[0] || { count: 0, amount: 0 }
    const wholesaleCount = Number.parseInt(wholesale.count || 0, 10)
    const allocationCount = Number.parseInt(allocation.count || 0, 10)

    return {
      transfer: {
        transfer_count: wholesaleCount + allocationCount,
        inbound_count: allocationCount,
        outbound_count: wholesaleCount,
        pending_count: 0,
        transfer_growth: 0
      },
      allocation: {
        allocation_count: allocationCount,
        wholesale_count: wholesaleCount,
        allocation_amount: Number.parseFloat(allocation.amount || 0),
        wholesale_amount: Number.parseFloat(wholesale.amount || 0),
        wholesale_profit: Number.parseFloat(wholesale.profit || 0),
        allocation_growth: 0,
        wholesale_growth: 0
      },
      trends: (rows.trends || []).map(row => ({
        date: row.date,
        wholesale: Number.parseInt(row.wholesale_count || 0, 10),
        allocation: Number.parseInt(row.allocation_count || 0, 10)
      })),
      wholesale_product_ranks: (rows.wholesaleRanks || []).map(row => ({
        name: `${row.brand_name || ''} ${row.model_name || '未知型号'}`.trim(),
        count: Number.parseInt(row.count || 0, 10),
        amount: Number.parseFloat(row.amount || 0),
        profit: Number.parseFloat(row.profit || 0)
      })),
      allocation_product_ranks: (rows.allocationRanks || []).map(row => ({
        name: `${row.brand_name || ''} ${row.model_name || '未知型号'}`.trim(),
        count: Number.parseInt(row.count || 0, 10),
        amount: Number.parseFloat(row.amount || 0)
      })),
      store_distribution: (rows.stores || []).map(row => ({
        store_id: row.store_id,
        store_name: row.store_name || '未知店铺',
        count: Number.parseInt(row.count || 0, 10),
        amount: Number.parseFloat(row.amount || 0),
        wholesale_count: Number.parseInt(row.wholesale_count || 0, 10),
        allocation_count: Number.parseInt(row.allocation_count || 0, 10)
      })),
      records: (rows.records || []).map(row => ({
        id: row.id,
        order_no: row.order_no || `TF${row.id}`,
        type: row.type === 'wholesale' ? 'wholesale' : 'allocation',
        from_store_id: row.store_id,
        from_store_name: row.from_store_name || '总店',
        supplier_name: row.supplier_name || '-',
        to_store_id: null,
        to_store_name: row.to_store_name || '客户',
        brand_name: row.brand_name || '',
        model_name: row.model_name || '',
        color_name: row.color_name || '',
        quantity: 1,
        amount: Number.parseFloat(row.amount || 0),
        profit: row.profit !== null ? Number.parseFloat(row.profit) : null,
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '',
        operator_name: row.operator_name || ''
      })),
      month_range: { start: startStr, end: endStr }
    }
  }
}

module.exports = AnalyticsTransfersService
