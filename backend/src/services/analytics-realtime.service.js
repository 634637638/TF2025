'use strict'

const os = require('node:os')
const { isConnected } = require('../config/database')
const AnalyticsRealtimeRepository = require('../repositories/analytics-realtime.repository')

class AnalyticsRealtimeService {
  constructor({ repository = new AnalyticsRealtimeRepository(), connected = isConnected, system = os } = {}) {
    this.repository = repository
    this.connected = connected
    this.system = system
  }

  async getRealtime(storeId) {
    if (!this.connected()) {
      const error = new Error('数据库连接失败')
      error.statusCode = 500
      throw error
    }

    const { sales, pending } = await this.repository.getSnapshots(storeId)
    const cpuCount = Math.max(this.system.cpus().length, 1)
    const cpuLoadPercent = Math.min((this.system.loadavg()[0] / cpuCount) * 100, 100)
    const totalMemory = this.system.totalmem()
    const memoryUsagePercent = totalMemory > 0
      ? ((totalMemory - this.system.freemem()) / totalMemory) * 100
      : null

    return {
      timestamp: new Date().toISOString(),
      active_users: null,
      current_sales: Number(sales.total_sales || 0),
      pending_orders: Number(pending.pending_count || 0),
      today_orders: Number(sales.order_count || 0),
      system_load: {
        cpu_percent: Number(cpuLoadPercent.toFixed(2)),
        memory_percent: memoryUsagePercent === null ? null : Number(memoryUsagePercent.toFixed(2)),
        process_memory_bytes: process.memoryUsage().rss,
        uptime_seconds: Math.floor(process.uptime()),
        disk_percent: null
      },
      alerts: []
    }
  }
}

module.exports = AnalyticsRealtimeService
