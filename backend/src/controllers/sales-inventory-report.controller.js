'use strict'

const SalesInventoryReportService = require('../services/sales-inventory-report.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class SalesInventoryReportController {
  constructor({ service = new SalesInventoryReportService(), logger = log } = {}) {
    if (!service || typeof service.getSummary !== 'function' || typeof service.getDetail !== 'function') {
      throw new TypeError('SalesInventoryReportController requires an inventory report service')
    }
    this.service = service
    this.logger = logger
  }

  async getSummary(req, res) {
    const { start_date: startDate, end_date: endDate, store_id: storeId, supplier_id: supplierId } = req.query
    const normalizedStartDate = String(startDate ?? '').trim()
    const normalizedEndDate = String(endDate ?? '').trim()
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (normalizedStartDate && !datePattern.test(normalizedStartDate)) return ApiResponse.badRequest(res, '开始日期格式无效')
    if (normalizedEndDate && !datePattern.test(normalizedEndDate)) return ApiResponse.badRequest(res, '结束日期格式无效')
    if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) return ApiResponse.badRequest(res, '开始日期不能晚于结束日期')
    const parsedStoreId = storeId ? Number(String(storeId)) : null
    const parsedSupplierId = supplierId ? Number(String(supplierId)) : null
    if (storeId && (!Number.isSafeInteger(parsedStoreId) || parsedStoreId <= 0)) return ApiResponse.badRequest(res, '门店编号无效')
    if (supplierId && (!Number.isSafeInteger(parsedSupplierId) || parsedSupplierId <= 0)) return ApiResponse.badRequest(res, '供应商编号无效')

    try {
      const data = await this.service.getSummary(req.query)
      return res.json({ success: true, message: '获取库存统计成功', data })
    } catch (error) {
      this.logger.error('❌ 获取库存统计失败:', error)
      return ApiResponse.serverError(res, '获取库存统计失败', error)
    }
  }

  async getDetail(req, res) {
    const pageSize = Number.parseInt(String(req.query.page_size ?? 500), 10)
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) return ApiResponse.badRequest(res, '每页数量必须为 1-500')
    if (!req.query.brand) return res.status(400).json({ success: false, message: '缺少必需参数: brand' })

    try {
      const result = await this.service.getDetail(req.query, pageSize)
      if (result.notFoundBrand) return res.status(404).json({ success: false, message: `未找到品牌: ${result.brand}` })
      return res.json({ success: true, data: result.rows, message: '获取库存明细成功' })
    } catch (error) {
      this.logger.error('❌ 获取库存明细失败:', error)
      return ApiResponse.serverError(res, '获取库存明细失败', error)
    }
  }
}

module.exports = SalesInventoryReportController
