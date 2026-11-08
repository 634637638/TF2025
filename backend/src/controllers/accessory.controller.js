'use strict'

const AccessoryService = require('../services/accessory.service')
const dataMaskingService = require('../services/data-masking.service')
const { getUploadUrl } = require('../utils/upload-paths')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

const ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'
const ACCESSORY_RESPONSE_KEYS = {
  'basic_info.name': ['name', 'accessory_name'],
  'basic_info.barcode': ['barcode', 'barcode_scanned'],
  'basic_info.batch_no': ['batch_no'],
  'basic_info.category': ['category'],
  'basic_info.brand_name': ['brand_id', 'brand_name'],
  'basic_info.model_name': ['model_id', 'model_name'],
  'basic_info.color_name': ['color_id', 'color_name'],
  'basic_info.supplier_name': ['supplier_id', 'supplier_name'],
  'basic_info.unit': ['unit'],
  'basic_info.specifications': ['specifications'],
  'basic_info.image_url': ['image_url'],
  'price_info.purchase_cost': ['purchase_cost'],
  'price_info.sale_price': ['sale_price', 'total_value'],
  'price_info.profit': ['profit'],
  'price_info.unit_price': ['unit_price'],
  'price_info.total_amount': ['total_amount'],
  'price_info.total_price': ['total_price'],
  'stock_info.total_stock': ['total_stock'],
  'stock_info.total_in': ['total_in'],
  'stock_info.total_out': ['total_out'],
  'stock_info.remaining_stock': ['remaining_stock'],
  'stock_info.min_stock': ['min_stock', 'min_stock_threshold'],
  'stock_info.total_quantity': ['quantity', 'total_quantity'],
  'stock_info.distribution': ['distribution', 'store_id', 'store_name', 'stores'],
  'stock_info.stock_status': ['stock_status'],
  'customer_info.customer_name': ['customer_name'],
  'customer_info.customer_phone': ['customer_phone'],
  'status_info.status': ['status'],
  'other_info.description': ['description'],
  'other_info.remarks': ['remarks'],
  'time_info.created_at': ['created_at'],
  'time_info.updated_at': ['updated_at'],
  'time_info.inventory_time': ['inventory_time'],
  'operator_info.operator_name': ['operator_id', 'operator_name']
}

const normalizeAccessoryPayload = (body = {}) => ({
  barcode: body.barcode,
  accessory_id: body.accessory_id,
  name: body.name,
  category: body.category,
  brand_id: body.brand_id,
  model_id: body.model_id,
  color_id: body.color_id,
  supplier_id: body.supplier_id,
  purchase_cost: body.purchase_cost,
  sale_price: body.sale_price,
  unit: body.unit,
  specifications: body.specifications,
  status: body.status,
  min_stock: body.min_stock,
  total_quantity: body.total_quantity,
  distribution: body.distribution,
  store_id: body.store_id,
  remarks: body.remarks,
  description: body.description,
  image_url: body.image_url
})

const decorateAccessory = item => {
  if (!item || typeof item !== 'object') return item
  const stockRows = Array.isArray(item.stock) ? item.stock : []
  const totalStock = item.total_stock === undefined
    ? stockRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
    : Number(item.total_stock || 0)
  const totalIn = Number(item.total_in || 0)
  const totalOut = Number(item.total_out || 0)
  const decorated = {
    ...item,
    total_stock: totalStock,
    profit: Number(item.sale_price || 0) - Number(item.purchase_cost || 0),
    remaining_stock: item.total_in === undefined ? totalStock : totalIn - totalOut
  }
  delete decorated.stock
  return decorated
}

class AccessoryController {
  constructor({
    service = new AccessoryService(),
    masking = dataMaskingService,
    uploadUrl = getUploadUrl,
    validateFileSignature = validateUploadedFileSignature,
    removeFiles = removeUploadedFiles,
    response = ApiResponse,
    logger = log
  } = {}) {
    this.service = service
    this.masking = masking
    this.uploadUrl = uploadUrl
    this.validateFileSignature = validateFileSignature
    this.removeFiles = removeFiles
    this.response = response
    this.logger = logger
  }

  async maskPayload(value, req, permissions) {
    if (Array.isArray(value)) {
      return Promise.all(value.map(item => this.maskPayload(item, req, permissions)))
    }
    if (!value || typeof value !== 'object') return value

    const recursivelyMasked = Object.fromEntries(await Promise.all(
      Object.entries(value).map(async ([key, child]) => [key, await this.maskPayload(child, req, permissions)])
    ))
    const masked = this.masking.filterSensitiveFields([recursivelyMasked], permissions)[0]
    for (const fieldId of permissions.hiddenFields || []) {
      for (const responseKey of ACCESSORY_RESPONSE_KEYS[fieldId] || []) {
        if (Object.prototype.hasOwnProperty.call(masked, responseKey)) masked[responseKey] = null
      }
    }
    return masked
  }

  async getPermissions(req) {
    return this.masking.getUserFieldPermissions(req.user.id, ACCESSORY_FIELD_MODULE_KEY)
  }

  async mask(req, value, permissions) {
    const fieldPermissions = permissions || await this.getPermissions(req)
    return this.maskPayload(value, req, fieldPermissions)
  }

  async maskList(req, items, permissions) {
    const fieldPermissions = permissions || await this.getPermissions(req)
    return this.maskPayload(items.map(decorateAccessory), req, fieldPermissions)
  }

  async upload(req, res) {
    try {
      if (!req.file) return this.response.error(res, '没有上传文件', 400)
      if (!(await this.validateFileSignature(req.file, ['image']))) {
        await this.removeFiles([req.file])
        return this.response.error(res, '文件内容与图片格式不匹配', 400)
      }

      return this.response.success(res, {
        url: this.uploadUrl('accessories', req.file.filename),
        filename: req.file.filename,
        size: req.file.size
      }, '上传成功')
    } catch (error) {
      await this.removeFiles(req.file ? [req.file] : []).catch(() => {})
      this.logger.error('上传配件图片失败:', error)
      return this.response.error(res, error.message || '上传失败', 500)
    }
  }

  async list(req, res) {
    try {
      const permissions = await this.getPermissions(req)
      const hiddenFields = new Set(permissions.hiddenFields || [])
      const guardedFilters = {
        category: 'basic_info.category', brand_id: 'basic_info.brand_name', model_id: 'basic_info.model_name',
        supplier_id: 'basic_info.supplier_name', status: 'status_info.status'
      }
      const deniedFilter = Object.entries(guardedFilters).find(([queryField, fieldId]) => (
        req.query[queryField] !== undefined && hiddenFields.has(fieldId)
      ))
      if (deniedFilter) {
        return res.status(403).json({
          success: false,
          message: '不能使用已隐藏的筛选字段',
          code: 'FIELD_PERMISSION_DENIED',
          field: deniedFilter[1]
        })
      }

      const searchFields = [
        ['basic_info.name', 'name'], ['basic_info.barcode', 'barcode']
      ].filter(([fieldId]) => !hiddenFields.has(fieldId)).map(([, field]) => field)
      if (req.query.search && !searchFields.length) {
        return res.status(403).json({ success: false, message: '没有可用的配件搜索字段', code: 'FIELD_PERMISSION_DENIED' })
      }

      const result = await this.service.getAccessories({
        page: req.query.page,
        page_size: req.query.page_size,
        category: req.query.category,
        brand_id: req.query.brand_id,
        model_id: req.query.model_id,
        supplier_id: req.query.supplier_id,
        status: req.query.status !== undefined ? req.query.status : 1,
        search: req.query.search,
        search_fields: searchFields
      })
      if (!result.success) return this.response.error(res, result.message, 400)

      const responseData = result.data || {}
      return this.response.success(res, {
        ...responseData,
        data: await this.maskList(req, Array.isArray(responseData.data) ? responseData.data : [], permissions)
      })
    } catch (error) {
      this.logger.error('获取配件列表失败:', error)
      return this.response.error(res, '获取配件列表失败', 500)
    }
  }

  async getByBarcode(req, res) {
    try {
      const result = await this.service.getAccessoryByBarcode(req.params.barcode)
      if (!result.success) return this.response.error(res, result.message, 404)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('根据条形码获取配件失败:', error)
      return this.response.error(res, '根据条形码获取配件失败', 500)
    }
  }

  async getById(req, res) {
    try {
      const result = await this.service.getAccessoryDetail(req.params.id)
      if (!result.success) return this.response.error(res, result.message, 404)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('获取配件详情失败:', error)
      return this.response.error(res, '获取配件详情失败', 500)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.createAccessory(normalizeAccessoryPayload(req.body))
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data), result.message)
    } catch (error) {
      this.logger.error('创建配件失败:', error)
      return this.response.error(res, '创建配件失败', 500)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.updateAccessory(req.params.id, normalizeAccessoryPayload(req.body))
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data), result.message)
    } catch (error) {
      this.logger.error('更新配件失败:', error)
      return this.response.error(res, '更新配件失败', 500)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.deleteAccessory(req.params.id)
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, null, result.message)
    } catch (error) {
      this.logger.error('删除配件失败:', error)
      return this.response.error(res, '删除配件失败', 500)
    }
  }

  async stockIn(req, res) {
    try {
      const data = {
        ...normalizeAccessoryPayload(req.body),
        operator_id: req.user.id,
        operator_name: req.user.name || req.user.username
      }
      const result = await this.service.stockIn(data)
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data), result.message)
    } catch (error) {
      this.logger.error('配件入库失败:', error)
      return this.response.error(res, '配件入库失败', 500)
    }
  }

  async listStockInRecords(req, res) {
    try {
      const result = await this.service.getStockInRecords({
        accessory_id: req.query.accessory_id,
        supplier_id: req.query.supplier_id,
        store_id: req.query.store_id,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        page: req.query.page,
        page_size: req.query.page_size
      })
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('获取入库记录失败:', error)
      return this.response.error(res, '获取入库记录失败', 500)
    }
  }

  async getStock(req, res) {
    try {
      const stock = await this.service.accessoryRepository.getAccessoryStock(req.params.id)
      return this.response.success(res, await this.mask(req, stock))
    } catch (error) {
      this.logger.error('获取配件库存失败:', error)
      return this.response.error(res, '获取配件库存失败', 500)
    }
  }

  async listStock(req, res) {
    try {
      const result = await this.service.getStockList({
        store_id: req.query.store_id,
        low_stock_only: req.query.low_stock_only === 'true',
        page: req.query.page,
        page_size: req.query.page_size
      })
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('获取库存列表失败:', error)
      return this.response.error(res, '获取库存列表失败', 500)
    }
  }

  async listStockWarnings(req, res) {
    try {
      const result = await this.service.getLowStockWarnings(req.query.threshold || 5)
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('获取库存预警失败:', error)
      return this.response.error(res, '获取库存预警失败', 500)
    }
  }

  async sell(req, res) {
    try {
      const data = {
        accessory_id: req.body.accessory_id,
        store_id: req.body.store_id,
        customer_id: req.body.customer_id,
        customer_name: req.body.customer_name,
        customer_phone: req.body.customer_phone,
        quantity: req.body.quantity,
        unit_price: req.body.unit_price,
        remarks: req.body.remarks,
        operator_id: req.user.id,
        operator_name: req.user.name || req.user.username
      }
      const result = await this.service.sell(data)
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data), result.message)
    } catch (error) {
      this.logger.error('配件销售失败:', error)
      return this.response.error(res, '配件销售失败', 500)
    }
  }

  async getCategoryStats(req, res) {
    try {
      const result = await this.service.getCategoryStats()
      if (!result.success) return this.response.error(res, result.message, 400)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('获取分类统计失败:', error)
      return this.response.error(res, '获取分类统计失败', 500)
    }
  }
}

module.exports = AccessoryController
