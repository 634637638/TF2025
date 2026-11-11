'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const PriceListManagementService = require('../services/price-list-management.service')
const managementService = new PriceListManagementService()

class PriceListController {
  async getPriceList(req, res) {
    try {
      const result = await managementService.getPriceList(req.query)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取价格列表失败:', error)
      return ApiResponse.error(res, '获取价格列表失败', 500)
    }
  }

  async exportPriceList(req, res) {
    try {
      const result = await managementService.exportPriceList(req.query)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`)
      return res.send(result.buffer)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('导出价格列表失败:', error)
      return ApiResponse.error(res, '导出价格列表失败', 500)
    }
  }

  async importPriceList(req, res) {
    try {
      const result = await managementService.importPriceList(req.file)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('导入价格列表失败:', error)
      return ApiResponse.error(res, error.message || '导入价格列表失败', error.statusCode || 500)
    }
  }

  async getPricesByBrand(req, res) {
    try {
      const result = await managementService.getPricesByBrand(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取品牌价格失败:', error)
      return ApiResponse.error(res, '获取价格失败', 500)
    }
  }

  async getAllPrices(req, res) {
    try {
      const result = await managementService.getAllPrices()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取所有价格失败:', error)
      return ApiResponse.error(res, '获取价格失败', 500)
    }
  }

  async getAllSalesPrices(req, res) {
    try {
      const result = await managementService.getAllSalesPrices()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取销售价格失败:', error)
      return ApiResponse.error(res, '获取销售价格失败', 500)
    }
  }

  async searchSalesPrices(req, res) {
    try {
      const result = await managementService.searchSalesPrices(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('搜索销售价格失败:', error)
      return ApiResponse.error(res, '搜索失败', 500)
    }
  }

  async searchPrices(req, res) {
    try {
      const result = await managementService.searchPrices(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('搜索价格失败:', error)
      return ApiResponse.error(res, '搜索失败', 500)
    }
  }

  async upsertPriceItem(req, res) {
    try {
      const result = await managementService.upsertPriceItem(req.body)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('保存价格记录失败:', error)
      return ApiResponse.error(res, '保存失败', 500)
    }
  }

  async batchUpdatePriceSource(req, res) {
    try {
      const result = await managementService.batchUpdatePriceSource(req.body)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('批量设置采集来源失败:', error)
      return ApiResponse.error(res, '批量设置采集来源失败', 500)
    }
  }

  async batchUpdatePriceItems(req, res) {
    try {
      const result = await managementService.batchUpdatePriceItems(req.body)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)
      log.error('批量设置价格记录失败:', error)
      return ApiResponse.error(res, '批量设置失败，请稍后重试', 500)
    }
  }

  async deletePriceItem(req, res) {
    try {
      const result = await managementService.deletePriceItem(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('删除价格记录失败:', error)
      return ApiResponse.error(res, '删除失败', 500)
    }
  }

  async getSyncConfig(req, res) {
    try {
      const result = await managementService.getSyncConfig()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取同步配置失败:', error)
      return ApiResponse.error(res, '获取配置失败', 500)
    }
  }

  async updateSyncConfig(req, res) {
    try {
      const result = await managementService.updateSyncConfig(req.body)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('更新同步配置失败:', error)
      return ApiResponse.error(res, '更新配置失败', 500)
    }
  }

  async getAllSyncConfigs(req, res) {
    try {
      const result = await managementService.getAllSyncConfigs()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取同步配置列表失败:', error)
      return ApiResponse.error(res, '获取配置列表失败', 500)
    }
  }

  async createSyncConfig(req, res) {
    try {
      const result = await managementService.createSyncConfig(req.body)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('创建同步配置失败:', error)
      return ApiResponse.error(res, '创建配置失败', 500)
    }
  }

  async setDefaultSyncConfig(req, res) {
    try {
      const result = await managementService.setDefaultSyncConfig(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('设置默认配置失败:', error)
      return ApiResponse.error(res, '设置默认配置失败', 500)
    }
  }

  async deleteSyncConfig(req, res) {
    try {
      const result = await managementService.deleteSyncConfig(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('删除同步配置失败:', error)
      return ApiResponse.error(res, '删除配置失败', 500)
    }
  }

  async getSyncConfigById(req, res) {
    try {
      const result = await managementService.getSyncConfigById(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取同步配置详情失败:', error)
      return ApiResponse.error(res, '获取配置详情失败', 500)
    }
  }

  async updateSyncConfigById(req, res) {
    try {
      const result = await managementService.updateSyncConfigById(req.body, req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('更新同步配置失败:', error)
      return ApiResponse.error(res, '更新配置失败', 500)
    }
  }

  async triggerSync(req, res) {
    try {
      const result = await managementService.triggerSync(req.query, req.body, req.user)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('触发同步失败:', error)
      return ApiResponse.error(res, '同步失败: ' + error.message, 500)
    }
  }

  async getSyncLogs(req, res) {
    try {
      const result = await managementService.getSyncLogs(req.query)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取同步日志失败:', error)
      return ApiResponse.error(res, '获取日志失败', 500)
    }
  }

  async getSyncLogStatistics(req, res) {
    try {
      const result = await managementService.getSyncLogStatistics()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取同步日志统计失败:', error)
      return ApiResponse.error(res, '获取统计失败', 500)
    }
  }

  async deleteSyncLog(req, res) {
    try {
      const result = await managementService.deleteSyncLog(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('删除同步日志失败:', error)
      return ApiResponse.error(res, '删除失败', 500)
    }
  }

  async clearSyncLogs(req, res) {
    try {
      const result = await managementService.clearSyncLogs()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('清空同步日志失败:', error)
      return ApiResponse.error(res, '清空失败', 500)
    }
  }

  async getPriceHistory(req, res) {
    try {
      const result = await managementService.getPriceHistory(req.query, req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取价格历史失败:', error)
      return ApiResponse.error(res, '获取历史失败', 500)
    }
  }

  async getPriceHistoryTrends(req, res) {
    try {
      const result = await managementService.getPriceHistoryTrends(req.query)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('批量获取价格趋势失败:', error)
      return ApiResponse.error(res, '获取价格趋势失败', 500)
    }
  }

  async getBrands(req, res) {
    try {
      const result = await managementService.getBrands()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('获取品牌列表失败:', error)
      return ApiResponse.error(res, '获取品牌列表失败', 500)
    }
  }

  async deletePriceHistory(req, res) {
    try {
      const result = await managementService.deletePriceHistory(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('删除价格历史失败:', error)
      return ApiResponse.error(res, '删除失败', 500)
    }
  }

  async batchDeletePriceHistory(req, res) {
    try {
      const result = await managementService.batchDeletePriceHistory(req.body, req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('批量删除价格历史失败:', error)
      return ApiResponse.error(res, '批量删除失败', 500)
    }
  }

  async clearPriceHistory(req, res) {
    try {
      const result = await managementService.clearPriceHistory(req.params)
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('清空价格历史失败:', error)
      return ApiResponse.error(res, '清空失败', 500)
    }
  }

  async clearAllPriceHistory(req, res) {
    try {
      const result = await managementService.clearAllPriceHistory()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('清空全部价格历史失败:', error)
      return ApiResponse.error(res, '清理失败', 500)
    }
  }

  async fixIsCollect(req, res) {
    try {
      const result = await managementService.fixIsCollect()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('修复 is_collect 失败:', error)
      return ApiResponse.error(res, '修复失败', 500)
    }
  }

  async clearPrices(req, res) {
    try {
      const result = await managementService.clearPrices()
      return ApiResponse.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('清零价格失败:', error)
      return ApiResponse.error(res, '清零失败', 500)
    }
  }

  async acknowledgeMigration(req, res) {
    return res.json({
      success: true,
      message: '表已是新结构，无需迁移',
      data: { results: [] }
    })
  }

  async checkIphone16(req, res) {
    try {
      const result = await managementService.checkIphone16(req.app.get('db'))
      return res.json(result)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('检查失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  async updateIphone16Collection(req, res) {
    try {
      const result = await managementService.updateIphone16Collection(req.body, req.app.get('db'))
      return res.json(result)
    } catch (error) {
      if (error.statusCode) return ApiResponse.error(res, error.message, error.statusCode)

      log.error('更新失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }
}

module.exports = new PriceListController()
