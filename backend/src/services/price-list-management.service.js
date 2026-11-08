/**
 * 价目管理业务与同步编排
 */
const { getDatabase } = require('../config/database')
const XLSX = require('xlsx')
const { PAGINATION } = require('../config/constants')
const log = require('../utils/log')
const { readSpreadsheetBufferSafe, sheetToJsonSafe } = require('../utils/spreadsheet-security')

function getPriceListService() {
  return require('./price-list.service')
}

function getScheduler() {
  return require('../scripts/price-sync-scheduler')
}

const parseNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const normalized = typeof value === 'string'
    ? value.replace(/[,%\s]/g, '')
    : value
  const parsed = Number(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

const parseFlag = (value, defaultValue = 1, truthyLabels = ['1', 'true', '是', '启用', '显示', '采集']) => {
  if (value === '' || value === null || value === undefined) {
    return defaultValue
  }

  const normalized = String(value).trim()
  return truthyLabels.includes(normalized) ? 1 : 0
}

async function restartPriceSyncScheduler(reason) {
  try {
    const scheduler = getScheduler()
    await scheduler.restartAllJobs()
    log.success(`价格同步调度器已重启: ${reason}`)
  } catch (error) {
    log.error(`重新加载价格同步调度器失败 (${reason}):`, error)
  }
}
const BaseService = require('../core/base/base.service')
const PriceListMaintenanceRepository = require('../repositories/price-list-maintenance.repository')

class PriceListManagementService extends BaseService {
  constructor({ repository = new PriceListMaintenanceRepository(), database = getDatabase, priceService = getPriceListService, restartScheduler = restartPriceSyncScheduler } = {}) {
    super()
    this.repository = repository
    this.database = database
    this.priceService = priceService
    this.restartScheduler = restartScheduler
    this.dbInitialized = false
  }

  initializeDatabase() {
    if (this.dbInitialized) return true
    try {
      const database = this.database()
      if (!database) return false
      this.priceService().setDatabase(database)
      this.dbInitialized = true
      return true
    } catch (error) {
      log.warn('价格列表服务数据库初始化暂时失败:', error.message)
      return false
    }
  }

  async getPriceList(query) {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.getPriceList(query)
    return { data: result.data, message: result.message }
  }

  async exportPriceList(query) {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.getPriceList({
      ...query,
      page: PAGINATION.DEFAULT_PAGE,
      limit: PAGINATION.DEFAULT_LIMIT
    })

    if (!result.success) {
      throw this.createError(result.message || '导出价格列表失败', 400)
    }

    const rows = (result.data?.list || []).map((item) => ({
      品牌: item.brand_name || '',
      型号: item.model_number || '',
      颜色: item.color_name || '',
      内存: item.memory || '',
      库存数量: item.stock_quantity || 0,
      零售价: item.retail_price || 0,
      批发价: item.wholesale_price || 0,
      采集状态: Number(item.is_collect) === 1 ? '采集' : '不采集',
      显示状态: Number(item.show_price) === 1 ? '显示' : '隐藏',
      状态: Number(item.status) === 1 ? '启用' : '停用',
      外部型号: item.external_model || '',
      采集来源: item.source_name || '默认来源',
      最后同步时间: item.last_sync_time || ''
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    const beijingDate = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '-')

    XLSX.utils.book_append_sheet(workbook, worksheet, '报价管理')

    return { filename: `报价管理_${beijingDate}.xlsx`, buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) }
  }

  async importPriceList(file) {
    this.initializeDatabase()
    const priceListService = this.priceService()

    if (!file?.buffer) {
      throw this.createError('请选择要导入的 Excel 文件', 400)
    }

    const workbook = readSpreadsheetBufferSafe(file.buffer)
    const sheetName = workbook.SheetNames[0]
    const rows = sheetToJsonSafe(workbook.Sheets[sheetName], { defval: '' })

    if (!Array.isArray(rows) || rows.length === 0) {
      throw this.createError('导入文件没有有效数据', 400)
    }

    let imported = 0
    let failed = 0
    const errors = []

    for (const [index, row] of rows.entries()) {
      const brand_name = String(row['品牌'] || row['brand_name'] || '').trim()
      const model_number = String(row['型号'] || row['model_number'] || '').trim()

      if (!brand_name || !model_number) {
        failed += 1
        errors.push(`第 ${index + 2} 行缺少品牌或型号`)
        continue
      }

      const payload = {
        brand_name,
        model_number,
        color_name: String(row['颜色'] || row['color_name'] || '').trim() || null,
        memory: String(row['内存'] || row['memory'] || '').trim() || null,
        external_model: String(row['外部型号'] || row['external_model'] || '').trim() || null,
        retail_price: parseNullableNumber(row['零售价'] ?? row['retail_price']),
        wholesale_price: parseNullableNumber(row['批发价'] ?? row['wholesale_price']),
        stock_quantity: parseNullableNumber(row['库存数量'] ?? row['stock_quantity']) ?? 0,
        is_collect: parseFlag(row['采集状态'] ?? row['is_collect'], 1),
        show_price: parseFlag(row['显示状态'] ?? row['show_price'], 0, ['1', 'true', '是', '启用', '显示']),
        status: parseFlag(row['状态'] ?? row['status'], 1, ['1', 'true', '是', '启用']),
        last_sync_time: String(row['最后同步时间'] || row['last_sync_time'] || '').trim() || null,
        is_manual_edit: true
      }

      const result = await priceListService.upsertPriceItem(payload, null, {
        allowCreate: true,
        isManualEdit: true,
        changeReason: 'import'
      })

      if (result.success) {
        imported += 1
      } else {
        failed += 1
        errors.push(`第 ${index + 2} 行导入失败: ${result.message || '未知错误'}`)
      }
    }

    return { data: {
      imported,
      failed,
      errors: errors.slice(0, 20)
    }, message: `价目表导入完成，成功 ${imported} 条，失败 ${failed} 条` }
  }

  async getPricesByBrand(params) {
    const { brand } = params
    const priceListService = this.priceService()
    const result = await priceListService.getPricesByBrand(brand)
    return { data: result.data, message: result.message }
  }

  async getAllPrices() {
    const priceListService = this.priceService()
    const result = await priceListService.getAllPrices()
    return { data: result.data, message: result.message }
  }

  async getAllSalesPrices() {
    const priceListService = this.priceService()
    const result = await priceListService.getAllSalesPrices()
    return { data: result.data, message: result.message }
  }

  async searchSalesPrices(params) {
    const { keyword } = params
    if (!keyword || keyword.length < 2) {
      throw this.createError('搜索关键词至少2个字符', 400)
    }
    const priceListService = this.priceService()
    const result = await priceListService.searchSalesPrices(keyword)
    return { data: result.data, message: result.message }
  }

  async searchPrices(params) {
    const { keyword } = params
    if (!keyword || keyword.length < 2) {
      throw this.createError('搜索关键词至少2个字符', 400)
    }
    const priceListService = this.priceService()
    const result = await priceListService.searchPrices(keyword)
    return { data: result.data, message: result.message }
  }

  async upsertPriceItem(body) {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.upsertPriceItem(body)
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, 400)
  }

  async batchUpdatePriceSource(body) {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.batchUpdatePriceSource(body)
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, result.statusCode || 400)
  }

  async deletePriceItem(params) {
    this.initializeDatabase()
    const db = this.database()
    const { id } = params
    await this.repository.deletePriceItem(db, id)
    return { data: null, message: '删除成功' }
  }

  async getSyncConfig() {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.getSyncConfig()
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, 404)
  }

  async updateSyncConfig(body) {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.updateSyncConfig(body)
    if (result.success) {
      await this.restartScheduler('更新默认同步配置')
      return { data: null, message: result.message }
    }
    throw this.createError(result.message, 400)
  }

  async getAllSyncConfigs() {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.getAllSyncConfigs()
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, 404)
  }

  async createSyncConfig(body) {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.createSyncConfig(body)
    if (result.success) {
      await this.restartScheduler('新增同步配置')
      return { data: null, message: result.message }
    }
    throw this.createError(result.message, 400)
  }

  async setDefaultSyncConfig(params) {
    this.initializeDatabase()
    const { configId } = params
    const priceListService = this.priceService()
    const result = await priceListService.setDefaultSyncConfig(configId)
    if (result.success) {
      await this.restartScheduler(`切换默认同步配置: ${configId}`)
      return { data: null, message: result.message }
    }
    throw this.createError(result.message, 400)
  }

  async deleteSyncConfig(params) {
    this.initializeDatabase()
    const { configId } = params
    const priceListService = this.priceService()
    const result = await priceListService.deleteSyncConfig(configId)
    if (result.success) {
      await this.restartScheduler(`删除同步配置: ${configId}`)
      return { data: null, message: result.message }
    }
    throw this.createError(result.message, 400)
  }

  async getSyncConfigById(params) {
    this.initializeDatabase()
    const { configId } = params
    const priceListService = this.priceService()
    const result = await priceListService.getSyncConfigById(configId)
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, 404)
  }

  async updateSyncConfigById(body, params) {
    this.initializeDatabase()
    const { configId } = params
    const priceListService = this.priceService()
    const result = await priceListService.updateSyncConfigById(configId, body)
    if (result.success) {
      await this.restartScheduler(`更新同步配置: ${configId}`)
      return { data: null, message: result.message }
    }
    throw this.createError(result.message, 400)
  }

  async triggerSync(query, body, actor) {
    this.initializeDatabase()
    const userId = actor?.id || null
    const priceListService = this.priceService()

    const requestedConfigId = body?.configId || query?.configId
    if (requestedConfigId === 'all') {
      const syncTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' ')
      const syncBatchId = `manual-${Date.now()}`
      const [configs] = await this.repository.allSyncConfigs(this.database())
      const results = []
      for (const config of configs) {
        results.push(await priceListService.executeSync(
          config.id,
          'manual',
          userId,
          { syncTime, syncBatchId }
        ))
      }
      const successful = results.filter(result => result.success)
      const sourceResults = results.map((result, index) => ({
        configId: configs[index].id,
        success: result.success,
        message: result.message,
        total: Number(result.data?.total || 0),
        successCount: Number(result.data?.success || 0),
        failedCount: Number(result.data?.failed || (result.success ? 0 : 1))
      }))
      return { data: {
        total: results.reduce((sum, result) => sum + Number(result.data?.total || 0), 0),
        success: successful.reduce((sum, result) => sum + Number(result.data?.success || 0), 0),
        failed: sourceResults.reduce((sum, result) => sum + result.failedCount, 0),
        sources: sourceResults
      }, message: '全部来源同步完成' }
    }

    if (requestedConfigId && Number.isInteger(Number(requestedConfigId))) {
      const result = await priceListService.executeSync(Number(requestedConfigId), 'manual', userId)
      if (result.success) {
        return { data: result.data, message: result.message }
      }
      throw this.createError(result.message, 400)
    }

    // 未指定时保持兼容：同步默认配置
    const db = this.database()
    const [configs] = await this.repository.defaultSyncConfig(db)

    if (configs.length === 0) {
      log.warn('未找到默认的同步配置')
      throw this.createError('未找到默认的同步配置，请先在价格列表中配置同步账户', 400)
    }

    const configId = configs[0].id
    const configInfo = {
      id: configs[0].id,
      name: configs[0].config_name,
      username: configs[0].login_username
    }

    log.start(`[手动触发同步] 使用配置: ID=${configInfo.id}, 名称=${configInfo.name}, 账户=${configInfo.username}`)

    const result = await priceListService.executeSync(configId, 'manual', userId)
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, 400)
  }

  async getSyncLogs(query) {
    this.initializeDatabase()
    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 20
    const priceListService = this.priceService()
    const result = await priceListService.getSyncLogs(page, limit)
    return { data: result.data, message: result.message }
  }

  async getSyncLogStatistics() {
    this.initializeDatabase()
    const priceListService = this.priceService()
    const result = await priceListService.getSyncLogStatistics()
    return { data: result.data, message: result.message }
  }

  async deleteSyncLog(params) {
    this.initializeDatabase()
    const db = this.database()
    const { id } = params
      
    // 检查日志是否存在
    const [logs] = await this.repository.findSyncLog(db, id)
    if (logs.length === 0) {
      throw this.createError('日志不存在', 404)
    }
      
    await this.repository.deleteSyncLog(db, id)
    return { data: null, message: '删除成功' }
  }

  async clearSyncLogs() {
    this.initializeDatabase()
    const db = this.database()
      
    // 同步日志仅作为可清理的运行记录保存，没有外键引用。
    // 使用 TRUNCATE 在清空记录的同时回收 InnoDB 表空间，并重置自增 ID。
    await this.repository.clearSyncLogs(db)
    return { data: null, message: '清空成功，空间已回收' }
  }

  async getPriceHistory(query, params) {
    const { id } = params
    const limit = parseInt(query.limit) || 50
    const priceListService = this.priceService()
    const result = await priceListService.getPriceHistory(id, limit)
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, 404)
  }

  async getPriceHistoryTrends(query) {
    const rawIds = Array.isArray(query.ids)
      ? query.ids
      : String(query.ids || '').split(',')
    const ids = rawIds
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0)
      .slice(0, 100)

    const priceListService = this.priceService()
    const result = await priceListService.getPriceHistoryTrends(ids)
    if (result.success) {
      return { data: result.data, message: result.message }
    }
    throw this.createError(result.message, 500)
  }

  async getBrands() {
    this.initializeDatabase()
    const db = this.database()
    const [rows] = await this.repository.listBrands(db)
    const brands = rows.map(row => row.brand_name)
    return { data: '获取成功', message: brands }
  }

  async deletePriceHistory(params) {
    this.initializeDatabase()
    const db = this.database()
    const { id } = params
    const { historyId } = params

    await this.repository.deleteHistory(db, historyId, id)

    return { data: null, message: '删除成功' }
  }

  async batchDeletePriceHistory(body, params) {
    this.initializeDatabase()
    const db = this.database()
    const { id } = params
    const { historyIds } = body

    if (!Array.isArray(historyIds) || historyIds.length === 0) {
      throw this.createError('无效的历史记录ID列表', 400)
    }

    await this.repository.deleteHistoryBatch(db, historyIds, id)

    return { data: null, message: `成功删除 ${historyIds.length} 条记录` }
  }

  async clearPriceHistory(params) {
    this.initializeDatabase()
    const db = this.database()
    const { id } = params

    const [result] = await this.repository.clearHistory(db, id)

    return { data: { deletedCount: result.affectedRows }, message: '清空成功' }
  }

  async clearAllPriceHistory() {
    this.initializeDatabase()
    const db = this.database()

    const [result] = await this.repository.clearAllHistory(db)

    return { data: { deletedCount: result.affectedRows }, message: '清理成功' }
  }

  async fixIsCollect() {
    this.initializeDatabase()
    const db = this.database()

    const [result] = await this.repository.fixCollectionFlags(db)

    return { data: { updatedCount: result.affectedRows }, message: '修复成功' }
  }

  async clearPrices() {
    this.initializeDatabase()
    const db = this.database()

    // 清零批发价和零售价
    const [result] = await this.repository.clearPrices(db)

    return { data: { updatedCount: result.affectedRows }, message: `已清零 ${result.affectedRows} 条价格记录` }
  }

  async checkIphone16(database) {
    const db = database
    const [records] = await this.repository.checkIphone16(db)

    return {
      success: true,
      message: `找到 ${records.length} 条iPhone 16记录`,
      data: records
    }
  }

  async updateIphone16Collection(body, database) {
    const db = database
    const { is_collect = 1 } = body
    const [result] = await this.repository.updateIphone16Collection(db, is_collect)
    const [records] = await this.repository.iphone16Collection(db)

    return {
      success: true,
      message: `已更新 ${result.affectedRows} 条iPhone 16记录的采集状态为 ${is_collect}`,
      data: records
    }
  }
}

module.exports = PriceListManagementService
