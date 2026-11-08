'use strict'

const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { isConnected } = require('../config/database')
const log = require('../utils/log')
const SystemHealthRepository = require('../repositories/system-health.repository')

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(2)} ${units[unitIndex]}`
}

const getUsageStatus = usagePercent => {
  if (usagePercent >= 90) return 'error'
  if (usagePercent >= 75) return 'warning'
  return 'online'
}

class SystemHealthService {
  constructor({
    repository = new SystemHealthRepository(),
    connected = isConnected,
    fileSystem = fs,
    operatingSystem = os,
    runtime = process,
    projectRoot = path.resolve(__dirname, '../../..')
  } = {}) {
    this.repository = repository
    this.connected = connected
    this.fileSystem = fileSystem
    this.operatingSystem = operatingSystem
    this.runtime = runtime
    this.projectRoot = projectRoot
  }

  async getStats() {
    if (!this.connected()) return { unavailable: true }

    const stats = { employeeCount: 0, roleCount: 0, storeCount: 0, logCount: 0 }
    const queries = [
      ['employeeCount', '获取员工数量失败'],
      ['roleCount', '获取角色数量失败'],
      ['storeCount', '获取店铺数量失败'],
      ['logCount', null]
    ]

    for (const [key, warning] of queries) {
      try {
        stats[key] = await this.repository[`get${key[0].toUpperCase()}${key.slice(1)}`]()
      } catch (error) {
        if (warning) log.warn(`${warning}:`, error.message)
      }
    }

    return { unavailable: false, stats }
  }

  async getDiskUsage() {
    try {
      const stats = await this.fileSystem.statfs(this.projectRoot)
      const total = stats.blocks * stats.bsize
      const available = stats.bavail * stats.bsize
      const used = Math.max(total - available, 0)
      const usagePercent = total > 0 ? (used / total) * 100 : 0

      return {
        status: getUsageStatus(usagePercent),
        message: `${usagePercent.toFixed(1)}%`,
        details: {
          total: formatBytes(total),
          used: formatBytes(used),
          available: formatBytes(available)
        }
      }
    } catch (error) {
      log.warn('获取磁盘使用率失败:', error.message)
      return {
        status: 'unknown',
        message: '未知',
        details: { total: '未知', used: '未知', available: '未知' }
      }
    }
  }

  getMemoryUsage() {
    const total = this.operatingSystem.totalmem()
    const available = this.operatingSystem.freemem()
    const used = Math.max(total - available, 0)
    const usagePercent = total > 0 ? (used / total) * 100 : 0
    const processMemory = this.runtime.memoryUsage()

    return {
      status: getUsageStatus(usagePercent),
      message: `${usagePercent.toFixed(1)}%`,
      details: {
        total: formatBytes(total),
        used: formatBytes(used),
        available: formatBytes(available),
        processRss: formatBytes(processMemory.rss),
        processHeapUsed: formatBytes(processMemory.heapUsed)
      }
    }
  }

  async getStatus() {
    const databaseConnected = this.connected()
    let poolStatus = 'unknown'
    try {
      poolStatus = await this.repository.checkPool()
    } catch (error) {
      poolStatus = 'error'
      log.warn('数据库连接池状态检查失败:', error.message)
    }

    const diskUsage = await this.getDiskUsage()
    const memoryUsage = this.getMemoryUsage()
    return {
      database: {
        status: databaseConnected ? 'online' : 'offline',
        message: databaseConnected ? '正常' : '连接失败',
        details: { poolStatus }
      },
      api: {
        status: 'online',
        message: '正常',
        version: '1.0.0',
        uptime: this.runtime.uptime()
      },
      disk: diskUsage,
      memory: memoryUsage,
      server: {
        status: 'online',
        message: '正常运行',
        nodeVersion: this.runtime.version,
        platform: this.runtime.platform
      },
      timestamp: new Date().toISOString()
    }
  }
}

module.exports = SystemHealthService
