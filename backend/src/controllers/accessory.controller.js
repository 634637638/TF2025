'use strict'

const AccessoryService = require('../services/accessory.service')
const dataMaskingService = require('../services/data-masking.service')
const { getUploadUrl } = require('../utils/upload-paths')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const FieldAccessService = require('../services/field-access.service')

const ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'
const ACCESSORY_RESPONSE_KEYS = {
  'basic_info.name': ['name', 'accessory_name', 'template_id'],
  'basic_info.barcode': ['barcode', 'barcode_scanned'],
  'basic_info.batch_no': ['batch_no', 'stock_in_id'],
  'basic_info.category': ['category', 'category_id'],
  'basic_info.brand_name': ['brand_id', 'brand_name'],
  'basic_info.model_name': ['model_id', 'model_ids', 'model_name', 'model_brand_id', 'model_brand_name', 'compatible_model_names'],
  'basic_info.color_name': ['color_id', 'color_name'],
  'basic_info.supplier_name': ['supplier_id', 'supplier_name'],
  'basic_info.unit': ['unit', 'unit_id'],
  'basic_info.specifications': ['product_model'],
  'basic_info.usage_type': ['usage_type'],
  'basic_info.serial_tracking': ['serial_tracking'],
  'basic_info.serial_number': ['serial_number', 'serial_numbers', 'serial_id', 'serial_quantity'],
  'basic_info.image_url': ['image_url'],
  'price_info.purchase_cost': ['purchase_cost', 'profit'],
  'price_info.sale_price': ['sale_price', 'total_value', 'profit'],
  'price_info.profit': ['profit'],
  'price_info.unit_price': ['unit_price'],
  'price_info.total_amount': ['total_amount'],
  'price_info.total_price': ['total_price'],
  'stock_info.total_stock': ['total_stock', 'remaining_stock'],
  'stock_info.total_in': ['total_in'],
  'stock_info.total_out': ['total_out'],
  'stock_info.remaining_stock': ['remaining_stock'],
  'stock_info.min_stock': ['min_stock', 'min_stock_threshold'],
  'stock_info.total_quantity': ['quantity', 'total_quantity', 'serial_quantity', 'plain_quantity'],
  'stock_info.distribution': ['distribution', 'store_id', 'store_name', 'stores', 'default_store_id', 'warehouse_store_id', 'from_store_id', 'to_store_id', 'from_store_name', 'to_store_name'],
  'stock_info.stock_status': ['stock_status'],
  'customer_info.customer_name': ['customer_name'],
  'customer_info.customer_phone': ['customer_phone'],
  'status_info.status': ['status'],
  'other_info.description': ['description'],
  'other_info.remarks': ['remarks'],
  'time_info.created_at': ['created_at', 'sale_time'],
  'time_info.updated_at': ['updated_at'],
  'time_info.inventory_time': ['inventory_time'],
  'operator_info.operator_name': ['operator_id', 'operator_name', 'inventory_operator_name']
}

const normalizeAccessoryPayload = (body = {}) => ({
  barcode: body.barcode,
  accessory_id: body.accessory_id,
  name: body.name,
  category: body.category,
  category_id: body.category_id,
  product_model: body.product_model,
  serial_tracking: body.serial_tracking,
  usage_type: body.usage_type,
  serial_numbers: body.serial_numbers,
  brand_id: body.brand_id,
  model_id: body.model_id,
  model_ids: body.model_ids,
  color_id: body.color_id,
  supplier_id: body.supplier_id,
  purchase_cost: body.purchase_cost,
  sale_price: body.sale_price,
  unit: body.unit,
  unit_id: body.unit_id,
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
  const decorated = {
    ...item,
    total_stock: totalStock,
    profit: Number(item.sale_price || 0) - Number(item.purchase_cost || 0),
    // 划拨不增加采购/销售累计数；剩余必须取当前授权门店的实物库存。
    remaining_stock: totalStock
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
    this.batchFields = new FieldAccessService({ moduleKey: ACCESSORY_FIELD_MODULE_KEY, responseKeys: ACCESSORY_RESPONSE_KEYS, masking, strict: true })
  }

  async listInventoryBatches(req, res) {
    try {
      const permissions = await this.batchFields.getPermissions(req.user.id)
      if (['stock_info.distribution', 'stock_info.total_quantity'].some(field => permissions.hiddenFields?.includes(field))) {
        return this.response.error(res, '无权读取批次库存必要字段', 403)
      }
      const result = await this.service.getInventoryBatches(req.user, req.params.id, req.query)
      // 原采购内部ID不透传；来源标记仅表达流水完整性。
      for (const row of result.data) delete row.stock_in_id
      return this.response.success(res, this.batchFields.maskPayload(result, permissions))
    } catch (error) {
      if (!error.statusCode) this.logger.error('读取配件批次库存失败:', error)
      return this.response.error(res, error.statusCode ? error.message : '读取配件批次库存失败', error.statusCode || 500)
    }
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
    return req.fieldPermissions || this.batchFields.getPermissions(req.user.id)
  }

  async saleOptions(req, res) {
    try {
      const permissions = await this.getPermissions(req)
      const hidden = new Set(permissions.hiddenFields || [])
      if (['basic_info.name', 'stock_info.distribution', 'stock_info.total_quantity'].some(field => hidden.has(field)) ||
        (req.query.film_only === true || req.query.film_only === 'true') && hidden.has('basic_info.category')) {
        return res.status(403).json({ success: false, message: '无权读取商品销售必要字段', code: 'FIELD_PERMISSION_DENIED' })
      }
      const searchFields = [['basic_info.name', 'name'], ['basic_info.barcode', 'barcode'],
        ['basic_info.brand_name', 'brand_name'], ['basic_info.specifications', 'product_model'],
        ['basic_info.serial_number', 'serial_number']].filter(([field]) => !hidden.has(field)).map(([, key]) => key)
      return this.response.success(res, await this.mask(req, await this.service.getSaleOptions(req.user, req.query, searchFields), permissions))
    } catch (error) {
      if (!error.statusCode) this.logger.error('读取商品销售候选失败:', error)
      return this.response.error(res, error.statusCode ? error.message : '读取商品销售候选失败', error.statusCode || 500)
    }
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

  async entryOptions(req, res) {
    try {
      const permissions = await this.getPermissions(req)
      const hidden = new Set(permissions.hiddenFields || [])
      if (req.query.brand_id !== undefined && hidden.has('basic_info.model_name')) {
        return this.response.error(res, '无权检索适配手机型号', 403)
      }
      const options = await this.service.getEntryOptions(req.user, req.query)
      const fields = {
        categories: 'basic_info.category', brands: 'basic_info.brand_name',
        units: 'basic_info.unit',
        models: 'basic_info.model_name', colors: 'basic_info.color_name',
        suppliers: 'basic_info.supplier_name', stores: 'stock_info.distribution'
      }
      for (const [group, field] of Object.entries(fields)) {
        if (hidden.has(field)) options[group] = []
      }
      if (hidden.has('stock_info.distribution')) options.default_store_id = null
      // 适配型号品牌是型号选择器的辅助选项，不依赖商品品牌。
      if (hidden.has('basic_info.model_name')) options.model_brands = []
      return this.response.success(res, options)
    } catch (error) {
      if (error.statusCode) return this.response.error(res, error.message, error.statusCode)
      this.logger.error('获取配件入库选项失败:', error)
      return this.response.error(res, '获取配件入库选项失败', 500)
    }
  }

  async productCatalog(req, res) {
    try {
      const result = await this.service.getProductCatalog()
      return this.response.success(res, result.data, result.message)
    } catch (error) {
      this.logger.error('获取商品资料失败:', error)
      return this.response.error(res, '获取商品资料失败', 500)
    }
  }

  async transfer(req, res) {
    try {
      const body = req.body || {}
      const result = await this.service.transfer({ accessory_id: body.accessory_id, from_store_id: body.from_store_id,
        to_store_id: body.to_store_id, quantity: body.quantity, serial_numbers: body.serial_numbers,
        request_key: body.request_key, remarks: body.remarks }, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
      return this.response.success(res, result.data, result.message)
    } catch (error) {
      this.logger.error('配件划拨失败:', error)
      return this.response.error(res, '配件划拨失败', 500)
    }
  }

  async listTransfers(req, res) {
    try {
      const result = await this.service.getTransfers(req.user, req.params.id, req.query)
      return this.response.success(res, await this.mask(req, result))
    } catch (error) {
      if (!error.statusCode) this.logger.error('读取配件划拨记录失败:', error)
      return this.response.error(res, error.statusCode ? error.message : '读取配件划拨记录失败', error.statusCode || 500)
    }
  }

  async getSettings(req, res) {
    try {
      return this.response.success(res, await this.mask(req, await this.service.getSettings(req.user)))
    } catch (error) {
      if (!error.statusCode) this.logger.error('获取配件设置失败', error)
      return this.response.error(res, error.statusCode ? error.message : '获取配件设置失败', error.statusCode || 500)
    }
  }

  async saveSettings(req, res) {
    try {
      return this.response.success(res, await this.mask(req, await this.service.saveSettings(req.user, req.body || {})), '配件设置已保存')
    } catch (error) {
      if (!error.statusCode) this.logger.error('保存配件设置失败', error)
      return this.response.error(res, error.statusCode ? error.message : '保存配件设置失败', error.statusCode || 500)
    }
  }

  async saveProductCatalogItem(req, res) {
    try {
      const id = req.params.id ? Number(req.params.id) : null
      const result = await this.service.saveProductCatalogItem(req.params.kind, id, req.body)
      return this.response.success(res, result.data, result.message)
    } catch (error) {
      if (error.statusCode) return this.response.error(res, error.message, error.statusCode)
      if (error.code === 'ER_DUP_ENTRY') return this.response.error(res, '名称已存在', 409)
      this.logger.error('保存商品资料失败:', error)
      return this.response.error(res, '保存商品资料失败', 500)
    }
  }

  async list(req, res) {
    try {
      const permissions = await this.getPermissions(req)
      const hiddenFields = new Set(permissions.hiddenFields || [])
      const guardedFilters = {
        category: 'basic_info.category', brand_id: 'basic_info.brand_name', model_id: 'basic_info.model_name',
        supplier_id: 'basic_info.supplier_name', status: 'status_info.status', store_id: 'stock_info.distribution'
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

      if (req.query.status !== undefined && !['all', '0', '1'].includes(String(req.query.status))) {
        return this.response.error(res, '商品状态仅支持全部、启用或停用', 400)
      }

      if (req.query.mode !== undefined && !['templates', 'inventory'].includes(req.query.mode)) {
        return this.response.error(res, '商品查询模式无效', 400)
      }

      const searchFields = [
        ['basic_info.name', 'name'], ['basic_info.barcode', 'barcode'],
        ['basic_info.category', 'category'], ['basic_info.brand_name', 'brand_name'],
        ['basic_info.model_name', 'model_name'], ['basic_info.specifications', 'product_model']
      ].filter(([fieldId]) => !hiddenFields.has(fieldId)).map(([, field]) => field)
      if (req.query.search && !searchFields.length) {
        return res.status(403).json({ success: false, message: '没有可用的配件搜索字段', code: 'FIELD_PERMISSION_DENIED' })
      }

      const result = await this.service.getAccessories({
        mode: req.query.mode,
        page: req.query.page,
        page_size: req.query.page_size,
        category: req.query.category,
        brand_id: req.query.brand_id,
        model_id: req.query.model_id,
        supplier_id: req.query.supplier_id,
        store_id: req.query.store_id,
        status: req.query.status === 'all' ? null : (req.query.status !== undefined ? req.query.status : 1),
        search: req.query.search,
        search_fields: searchFields
      }, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)

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
      const result = await this.service.getAccessoryByBarcode(req.params.barcode, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 404)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('根据条形码获取配件失败:', error)
      return this.response.error(res, '根据条形码获取配件失败', 500)
    }
  }

  async getById(req, res) {
    try {
      const result = await this.service.getAccessoryDetail(req.params.id, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 404)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('获取配件详情失败:', error)
      return this.response.error(res, '获取配件详情失败', 500)
    }
  }

  async create(req, res) {
    try {
      const result = await this.service.createAccessory(normalizeAccessoryPayload(req.body))
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
      return this.response.success(res, await this.mask(req, result.data), result.message)
    } catch (error) {
      this.logger.error('创建配件失败:', error)
      return this.response.error(res, '创建配件失败', 500)
    }
  }

  async update(req, res) {
    try {
      const result = await this.service.updateAccessory(req.params.id, normalizeAccessoryPayload(req.body))
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
      return this.response.success(res, await this.mask(req, result.data), result.message)
    } catch (error) {
      this.logger.error('更新配件失败:', error)
      return this.response.error(res, '更新配件失败', 500)
    }
  }

  async remove(req, res) {
    try {
      const result = await this.service.deleteAccessory(req.params.id)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
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
        request_key: req.body?.request_key,
        operator_id: req.user.id,
        operator_name: req.user.name || req.user.username
      }
      const result = await this.service.stockIn(data, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400, result.code)
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
      }, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
      return this.response.success(res, await this.mask(req, result.data))
    } catch (error) {
      this.logger.error('获取入库记录失败:', error)
      return this.response.error(res, '获取入库记录失败', 500)
    }
  }

  async getStock(req, res) {
    try {
      const stores = await this.service.getInventoryLocations(req.user, req.params.id, req.query)
      const stock = { stores, total_stock: stores.reduce((sum, store) => sum + Number(store.quantity || 0), 0) }
      return this.response.success(res, await this.mask(req, stock))
    } catch (error) {
      if (!error.statusCode) this.logger.error('获取配件库存失败:', error)
      return this.response.error(res, error.statusCode ? error.message : '获取配件库存失败', error.statusCode || 500)
    }
  }

  async listStock(req, res) {
    try {
      const permissions = await this.getPermissions(req)
      if ((req.query.low_stock_only === true || req.query.low_stock_only === 'true') &&
        ['stock_info.min_stock', 'stock_info.total_quantity', 'stock_info.stock_status'].some(field => permissions.hiddenFields?.includes(field))) {
        return this.response.error(res, '无权按库存预警筛选', 403)
      }
      const result = await this.service.getStockList({
        store_id: req.query.store_id,
        low_stock_only: req.query.low_stock_only,
        page: req.query.page,
        page_size: req.query.page_size
      }, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
      return this.response.success(res, await this.mask(req, result.data, permissions))
    } catch (error) {
      this.logger.error('获取库存列表失败:', error)
      return this.response.error(res, '获取库存列表失败', 500)
    }
  }

  async listStockWarnings(req, res) {
    try {
      const permissions = await this.getPermissions(req)
      if (['stock_info.min_stock', 'stock_info.total_quantity', 'stock_info.stock_status'].some(field => permissions.hiddenFields?.includes(field))) {
        return this.response.error(res, '无权读取库存预警', 403)
      }
      const result = await this.service.getLowStockWarnings({ threshold: req.query.threshold, store_id: req.query.store_id }, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
      return this.response.success(res, await this.mask(req, result.data, permissions))
    } catch (error) {
      this.logger.error('获取库存预警失败:', error)
      return this.response.error(res, '获取库存预警失败', 500)
    }
  }

  async listSerials(req, res) {
    try {
      return this.response.success(res, await this.mask(req, await this.service.getSerials(req.user, req.params.id, req.query)))
    } catch (error) {
      if (!error.statusCode) this.logger.error('读取配件 SN 失败', error)
      return this.response.error(res, error.statusCode ? error.message : '读取配件 SN 失败', error.statusCode || 500)
    }
  }

  async serialTrace(req, res) {
    try {
      return this.response.success(res, await this.mask(req, await this.service.getSerialTrace(req.user, req.params.serialNumber)))
    } catch (error) {
      if (!error.statusCode) this.logger.error('读取配件 SN 追踪失败', error)
      return this.response.error(res, error.statusCode ? error.message : '读取配件 SN 追踪失败', error.statusCode || 500)
    }
  }

  async getCategoryStats(req, res) {
    try {
      const permissions = await this.getPermissions(req)
      if (permissions.hiddenFields?.includes('basic_info.category')) return this.response.error(res, '无权按商品类型统计', 403)
      const result = await this.service.getCategoryStats({ store_id: req.query.store_id }, req.user)
      if (!result.success) return this.response.error(res, result.message, result.statusCode || 400)
      const hiddenQuantity = ['stock_info.total_stock', 'stock_info.total_quantity'].some(field => permissions.hiddenFields?.includes(field))
      const data = hiddenQuantity ? result.data.map(row => ({ ...row, count: null, total_value: null })) : result.data
      return this.response.success(res, await this.mask(req, data, permissions))
    } catch (error) {
      this.logger.error('获取分类统计失败:', error)
      return this.response.error(res, '获取分类统计失败', 500)
    }
  }
}

module.exports = AccessoryController
