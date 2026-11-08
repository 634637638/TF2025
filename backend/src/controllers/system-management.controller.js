'use strict'

const SystemManagementService = require('../services/system-management.service')
const log = require('../utils/log')
const ModuleScanner = require('../services/module-scanner.service')

class SystemManagementController {
  constructor({ database, service = new SystemManagementService({ database }), scannerFactory = () => new ModuleScanner() } = {}) {
    this.service = service
    this.scannerFactory = scannerFactory
  }

  verifyTables() { return this.service.verifyTables() }

  async initModuleManagement(_req, res) {
    try {
      const result = await this.service.initialize()
      if (!result) return res.status(404).json({ success: false, message: 'SQL文件不存在' })
      return res.json({
        success: result.successCount > 0,
        message: `初始化完成: ${result.successCount} 成功, ${result.errorCount} 失败`,
        data: result
      })
    } catch (error) {
      log.error('初始化失败:', error)
      return res.status(500).json({ success: false, message: '初始化失败: ' + error.message })
    }
  }

  async verifyModuleManagement(_req, res) {
    try {
      const verification = await this.verifyTables()
      return res.json({
        success: verification.allTablesExist,
        message: verification.allTablesExist ? '验证成功' : '验证失败',
        data: verification
      })
    } catch (error) {
      log.error('验证失败:', error)
      return res.status(500).json({ success: false, message: '验证失败: ' + error.message })
    }
  }

  async logSyncOperation(operationType, moduleKey, status, message, details = null) {
    try {
      log.debug(`[同步日志] ${operationType} ${moduleKey || 'ALL'} ${status}: ${message}`)
      if (details) log.debug('[同步详情]', details)
    } catch (error) {
      log.error('记录同步日志失败:', error)
    }
  }

  async syncModules(_req, res) {
    try {
      log.debug('🔄 开始同步模块...')
      const result = await this.scannerFactory().syncAllModules()
      await this.logSyncOperation(
        'sync',
        null,
        'success',
        `同步完成: 总数${result.total}, 成功${result.success}, 失败${result.errors}`,
        result
      )
      return res.json({ success: result.success > 0, message: '模块同步完成', data: result })
    } catch (error) {
      log.error('同步模块失败:', error)
      await this.logSyncOperation('sync', null, 'error', `同步失败: ${error.message}`, { error: error.message })
      return res.status(500).json({ success: false, message: '同步失败: ' + error.message })
    }
  }

  async getSyncLogs(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query
      const logs = []
      const total = 0
      return res.json({
        success: true,
        message: '获取同步日志成功',
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      })
    } catch (error) {
      log.error('获取同步日志失败:', error)
      return res.status(500).json({ success: false, message: '获取同步日志失败: ' + error.message })
    }
  }
}

module.exports = SystemManagementController
