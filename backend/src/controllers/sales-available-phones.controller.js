'use strict'

const XLSX = require('xlsx')
const SalesAvailablePhonesService = require('../services/sales-available-phones.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

const getSalesStatusLabel = status => ({
  in_stock: '可售',
  sold: '已售',
  reserved: '预订',
  repair: '维修',
  rented: '租赁',
  lost: '丢失',
  peer_transfer: '调货',
  supplier_proxy: '划拨',
  returned: '退货',
  damaged: '损坏'
}[status] || status || '')

class SalesAvailablePhonesController {
  constructor({ service = new SalesAvailablePhonesService(), logger = log, now = () => new Date() } = {}) {
    if (!service
      || typeof service.getStats !== 'function'
      || typeof service.getAvailablePhones !== 'function'
      || typeof service.getAvailablePhonesForExport !== 'function') {
      throw new TypeError('SalesAvailablePhonesController requires an available phones service')
    }
    this.service = service
    this.logger = logger
    this.now = now
  }

  async getAvailablePhones(req, res) {
    const { page = 1, page_size, preorder_id } = req.query
    const requestedPage = Number.parseInt(String(page), 10)
    const requestedPageSize = Number.parseInt(String(page_size ?? 100), 10)
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      return ApiResponse.badRequest(res, '页码无效')
    }
    if (!Number.isSafeInteger(requestedPageSize) || requestedPageSize < 1 || requestedPageSize > 500) {
      return ApiResponse.badRequest(res, '每页数量必须为 1-500')
    }

    const normalizedPreorderId = preorder_id ? Number.parseInt(String(preorder_id), 10) : null
    if (preorder_id && (!Number.isSafeInteger(normalizedPreorderId) || normalizedPreorderId < 1)) {
      return ApiResponse.badRequest(res, '预定单参数无效')
    }

    try {
      const result = await this.service.getAvailablePhones(req.query, {
        page: requestedPage,
        pageSize: requestedPageSize,
        preorderId: normalizedPreorderId
      })
      const totalPages = Math.ceil(result.total / requestedPageSize)
      return res.json({
        success: true,
        message: '获取可销售设备列表成功',
        data: result.phones,
        pagination: {
          page: requestedPage,
          page_size: requestedPageSize,
          total: result.total,
          total_pages: totalPages,
          has_next: requestedPage < totalPages,
          has_prev: requestedPage > 1
        },
        stats: {
          total_value: parseFloat(result.values.total_value) || 0,
          new_value: parseFloat(result.values.new_value) || 0,
          used_value: parseFloat(result.values.used_value) || 0
        }
      })
    } catch (error) {
      if (error.statusCode === 400) return ApiResponse.badRequest(res, error.message)
      if (error.statusCode === 404) return ApiResponse.notFound(res, error.message)
      this.logger.error('❌ 获取可销售手机列表失败:', error)
      return ApiResponse.serverError(res, '获取可销售设备列表失败', error)
    }
  }

  async exportAvailablePhones(req, res) {
    try {
      const phones = await this.service.getAvailablePhonesForExport(req.query)
      const rows = phones.map(phone => ({
        IMEI: phone.imei || '',
        序列号: phone.serial_number || '',
        品牌: phone.brand || '',
        型号: phone.model || '',
        颜色: phone.color || '',
        内存: phone.memory || '',
        店铺: phone.store_name || '',
        供应商: phone.supplier_name || '',
        入库员: phone.inventory_operator_name || phone.operator_username || '',
        新旧: phone.is_new ? '全新' : '二手',
        成色: phone.quality_grade || '',
        状态: getSalesStatusLabel(phone.status),
        库存售价: phone.sale_price || '',
        入库成本: phone.purchase_cost || '',
        入库时间: phone.inventory_time || '',
        销售时间: phone.sale_time || '',
        备注: phone.remarks || ''
      }))
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      const beijingDate = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(this.now()).replace(/\//g, '-')
      XLSX.utils.book_append_sheet(workbook, worksheet, '销售管理')
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      const filename = `销售管理_${beijingDate}.xlsx`

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      res.setHeader('X-Export-Total', String(rows.length))
      return res.send(buffer)
    } catch (error) {
      this.logger.error('❌ 导出可销售手机列表失败:', error)
      return res.status(500).json({
        success: false,
        message: '导出可销售手机列表失败',
        error: error.message
      })
    }
  }

  async getStats(req, res) {
    try {
      const data = await this.service.getStats(req.query)
      return res.json({ success: true, message: '获取统计数据成功', data })
    } catch (error) {
      this.logger.error('❌ 获取统计数据失败:', error)
      return res.status(500).json({
        success: false,
        message: '获取统计数据失败',
        error: error.message
      })
    }
  }
}

module.exports = SalesAvailablePhonesController
