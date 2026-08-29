const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const AccessoryService = require('../services/accessory.service')
const log = require('../utils/log')
const { getUploadSubdir, getUploadUrl } = require('../utils/upload-paths')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const dataMaskingService = require('../services/dataMaskingService')

const accessoryService = new AccessoryService()
const ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'
const ACCESSORY_WRITE_FIELD_IDS = {
  barcode: 'basic_info.barcode', accessory_id: 'basic_info.name', name: 'basic_info.name',
  category: 'basic_info.category', brand_id: 'basic_info.brand_name', model_id: 'basic_info.model_name',
  color_id: 'basic_info.color_name', supplier_id: 'basic_info.supplier_name', purchase_cost: 'price_info.purchase_cost',
  sale_price: 'price_info.sale_price', unit: 'basic_info.unit', specifications: 'basic_info.specifications',
  status: 'status_info.status', min_stock: 'stock_info.min_stock', total_quantity: 'stock_info.total_quantity',
  distribution: 'stock_info.distribution', store_id: 'stock_info.distribution', remarks: 'other_info.remarks',
  description: 'other_info.description', image_url: 'basic_info.image_url'
}
const ACCESSORY_SELL_FIELD_IDS = {
  accessory_id: 'basic_info.name', store_id: 'stock_info.distribution', quantity: 'stock_info.total_quantity',
  unit_price: 'price_info.unit_price', customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone', remarks: 'other_info.remarks'
}
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
const getAccessoryHiddenFields = async req => {
  const permissions = await dataMaskingService.getUserFieldPermissions(req.user.id, ACCESSORY_FIELD_MODULE_KEY)
  return new Set(permissions.hiddenFields || [])
}
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
const maskAccessoryPayloadWithPermissions = (value, permissions) => {
  if (Array.isArray(value)) return value.map(item => maskAccessoryPayloadWithPermissions(item, permissions))
  if (!value || typeof value !== 'object') return value

  const recursivelyMasked = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, maskAccessoryPayloadWithPermissions(child, permissions)])
  )
  const masked = dataMaskingService.filterSensitiveFields([recursivelyMasked], permissions)[0]
  for (const fieldId of permissions.hiddenFields || []) {
    for (const responseKey of ACCESSORY_RESPONSE_KEYS[fieldId] || []) {
      if (Object.prototype.hasOwnProperty.call(masked, responseKey)) masked[responseKey] = null
    }
  }
  return masked
}
const maskAccessoryPayload = async (value, req) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(req.user.id, ACCESSORY_FIELD_MODULE_KEY)
  return maskAccessoryPayloadWithPermissions(value, permissions)
}
const maskAccessoryList = async (items, req) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(req.user.id, ACCESSORY_FIELD_MODULE_KEY)
  return maskAccessoryPayloadWithPermissions(items.map(decorateAccessory), permissions)
}
const maskAccessoryItem = async (item, req) => (await maskAccessoryList([item], req))[0]
const rejectHiddenAccessoryWrites = async (req, res, next) => {
  try {
    const hiddenFields = await getAccessoryHiddenFields(req)
    const denied = Object.entries(ACCESSORY_WRITE_FIELD_IDS).find(([bodyField, fieldId]) => (
      req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
    ))
    if (!denied) return next()
    return res.status(403).json({ success: false, message: '不能修改已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
  } catch (error) {
    return next(error)
  }
}
const rejectHiddenAccessorySellWrites = async (req, res, next) => {
  try {
    const hiddenFields = await getAccessoryHiddenFields(req)
    const denied = Object.entries(ACCESSORY_SELL_FIELD_IDS).find(([bodyField, fieldId]) => (
      req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
    ))
    if (!denied) return next()
    return res.status(403).json({ success: false, message: '不能修改已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
  } catch (error) {
    return next(error)
  }
}
const requireVisibleAccessoryField = fieldId => async (req, res, next) => {
  try {
    const hiddenFields = await getAccessoryHiddenFields(req)
    if (!hiddenFields.has(fieldId)) return next()
    return res.status(403).json({ success: false, message: '无权访问已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: fieldId })
  } catch (error) {
    return next(error)
  }
}
const rejectHiddenAccessoryQueries = queryFieldIds => async (req, res, next) => {
  try {
    const hiddenFields = await getAccessoryHiddenFields(req)
    const denied = Object.entries(queryFieldIds).find(([queryField, fieldId]) => (
      req.query?.[queryField] !== undefined && hiddenFields.has(fieldId)
    ))
    if (!denied) return next()
    return res.status(403).json({ success: false, message: '不能使用已隐藏的筛选字段', code: 'FIELD_PERMISSION_DENIED', field: denied[1] })
  } catch (error) {
    return next(error)
  }
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

// 配置图片上传存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadSubdir('accessories')
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error, uploadDir)
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex')
    const ext = path.extname(file.originalname)
    cb(null, 'accessory-' + uniqueSuffix + ext)
  }
})

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  }
  cb(new Error('只允许上传图片文件（JPEG, JPG, PNG, GIF, WEBP）'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
})

// ============================
// 图片上传接口
// ============================

/**
 * 上传配件图片
 * POST /api/accessories/upload
 */
router.post('/upload', unifiedAuth, requirePermission('accessories:create'), requireVisibleAccessoryField('basic_info.image_url'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, '没有上传文件', 400)
    }

    if (!(await validateUploadedFileSignature(req.file, ['image']))) {
      await removeUploadedFiles([req.file])
      return ApiResponse.error(res, '文件内容与图片格式不匹配', 400)
    }

    // 返回文件访问URL
    const fileUrl = getUploadUrl('accessories', req.file.filename)

    ApiResponse.success(res, {
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size
    }, '上传成功')
  } catch (error) {
    await removeUploadedFiles(req.file ? [req.file] : []).catch(() => {})
    log.error('上传配件图片失败:', error)
    ApiResponse.error(res, error.message || '上传失败', 500)
  }
})

// ============================
// 配件管理接口
// ============================

/**
 * 获取配件列表
 * GET /api/accessories
 * 查询参数:
 * - page: 页码
 * - page_size: 每页数量
 * - category: 分类
 * - brand_id: 品牌ID
 * - model_id: 型号ID
 * - supplier_id: 供应商ID
 * - status: 状态
 * - search: 搜索关键词
 */
router.get('/', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const hiddenFields = await getAccessoryHiddenFields(req)
    const guardedFilters = {
      category: 'basic_info.category', brand_id: 'basic_info.brand_name', model_id: 'basic_info.model_name',
      supplier_id: 'basic_info.supplier_name', status: 'status_info.status'
    }
    const deniedFilter = Object.entries(guardedFilters).find(([queryField, fieldId]) => req.query[queryField] !== undefined && hiddenFields.has(fieldId))
    if (deniedFilter) return res.status(403).json({ success: false, message: '不能使用已隐藏的筛选字段', code: 'FIELD_PERMISSION_DENIED', field: deniedFilter[1] })
    const searchFields = [
      ['basic_info.name', 'name'], ['basic_info.barcode', 'barcode']
    ].filter(([fieldId]) => !hiddenFields.has(fieldId)).map(([, field]) => field)
    if (req.query.search && !searchFields.length) return res.status(403).json({ success: false, message: '没有可用的配件搜索字段', code: 'FIELD_PERMISSION_DENIED' })
    const params = {
      page: req.query.page,
      page_size: req.query.page_size,
      category: req.query.category,
      brand_id: req.query.brand_id,
      model_id: req.query.model_id,
      supplier_id: req.query.supplier_id,
      status: req.query.status !== undefined ? req.query.status : 1,
      search: req.query.search,
      search_fields: searchFields
    }

    const result = await accessoryService.getAccessories(params)

    if (result.success) {
      const responseData = result.data || {}
      ApiResponse.success(res, {
        ...responseData,
        data: await maskAccessoryList(Array.isArray(responseData.data) ? responseData.data : [], req)
      })
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('获取配件列表失败:', error)
    ApiResponse.error(res, '获取配件列表失败', 500)
  }
})

/**
 * 根据条形码获取配件（必须放在 /:id 之前）
 * GET /api/accessories/barcode/:barcode
 */
router.get('/barcode/:barcode', unifiedAuth, requirePermission('accessories:view'), requireVisibleAccessoryField('basic_info.barcode'), async (req, res) => {
  try {
    const { barcode } = req.params
    const result = await accessoryService.getAccessoryByBarcode(barcode)

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryItem(result.data, req))
    } else {
      ApiResponse.error(res, result.message, 404)
    }
  } catch (error) {
    log.error('根据条形码获取配件失败:', error)
    ApiResponse.error(res, '根据条形码获取配件失败', 500)
  }
})

/**
 * 获取配件详情
 * GET /api/accessories/:id
 */
router.get('/:id', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const { id } = req.params
    const result = await accessoryService.getAccessoryDetail(id)

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryItem(result.data, req))
    } else {
      ApiResponse.error(res, result.message, 404)
    }
  } catch (error) {
    log.error('获取配件详情失败:', error)
    ApiResponse.error(res, '获取配件详情失败', 500)
  }
})

/**
 * 创建配件
 * POST /api/accessories
 */
router.post('/', unifiedAuth, requirePermission('accessories:create'), rejectHiddenAccessoryWrites, async (req, res) => {
  try {
    const result = await accessoryService.createAccessory(normalizeAccessoryPayload(req.body))

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryItem(result.data, req), result.message)
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('创建配件失败:', error)
    ApiResponse.error(res, '创建配件失败', 500)
  }
})

/**
 * 更新配件
 * PUT /api/accessories/:id
 */
router.put('/:id', unifiedAuth, requirePermission('accessories:edit'), rejectHiddenAccessoryWrites, async (req, res) => {
  try {
    const { id } = req.params
    const result = await accessoryService.updateAccessory(id, normalizeAccessoryPayload(req.body))

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryItem(result.data, req), result.message)
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('更新配件失败:', error)
    ApiResponse.error(res, '更新配件失败', 500)
  }
})

/**
 * 删除配件
 * DELETE /api/accessories/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('accessories:delete'), async (req, res) => {
  try {
    const { id } = req.params
    const result = await accessoryService.deleteAccessory(id)

    if (result.success) {
      ApiResponse.success(res, null, result.message)
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('删除配件失败:', error)
    ApiResponse.error(res, '删除配件失败', 500)
  }
})

// ============================
// 配件入库接口
// ============================

/**
 * 配件入库
 * POST /api/accessories/stock-in
 * 请求体:
 * {
 *   barcode: string,              // 条形码（可选）
 *   accessory_id: number,         // 配件ID（可选）
 *   name: string,                 // 配件名称（新配件时必填）
 *   category: string,             // 分类
 *   brand_id: number,             // 品牌ID
 *   model_id: number,             // 型号ID
 *   color_id: number,             // 颜色ID
 *   supplier_id: number,          // 供应商ID（必填）
 *   purchase_cost: number,        // 进价
 *   sale_price: number,           // 售价
 *   unit: string,                 // 单位
 *   total_quantity: number,       // 入库总数量（必填）
 *   distribution: Array,          // 门店分配（必填）
 *   store_id: number,             // 操作门店ID
 *   operator_id: number,          // 操作员ID
 *   operator_name: string,        // 操作员姓名
 *   remarks: string               // 备注
 * }
 */
router.post('/stock-in', unifiedAuth, requirePermission('accessories:create'), rejectHiddenAccessoryWrites, async (req, res) => {
  try {
    const data = {
      ...normalizeAccessoryPayload(req.body),
      operator_id: req.user.id,
      operator_name: req.user.name || req.user.username
    }

    const result = await accessoryService.stockIn(data)

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryPayload(result.data, req), result.message)
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('配件入库失败:', error)
    ApiResponse.error(res, '配件入库失败', 500)
  }
})

/**
 * 获取入库记录列表
 * GET /api/accessories/stock-in/records
 * 查询参数:
 * - accessory_id: 配件ID
 * - supplier_id: 供应商ID
 * - store_id: 门店ID
 * - start_date: 开始日期
 * - end_date: 结束日期
 * - page: 页码
 * - page_size: 每页数量
 */
router.get('/stock-in/records', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  accessory_id: 'basic_info.name', supplier_id: 'basic_info.supplier_name', store_id: 'stock_info.distribution',
  start_date: 'time_info.inventory_time', end_date: 'time_info.inventory_time'
}), async (req, res) => {
  try {
    const params = {
      accessory_id: req.query.accessory_id,
      supplier_id: req.query.supplier_id,
      store_id: req.query.store_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      page: req.query.page,
      page_size: req.query.page_size
    }

    const result = await accessoryService.getStockInRecords(params)

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryPayload(result.data, req))
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('获取入库记录失败:', error)
    ApiResponse.error(res, '获取入库记录失败', 500)
  }
})

// ============================
// 配件库存接口
// ============================

/**
 * 获取配件库存（按门店）
 * GET /api/accessories/:id/stock
 */
router.get('/:id/stock', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const { id } = req.params
    const stock = await accessoryService.accessoryRepository.getAccessoryStock(id)

    ApiResponse.success(res, await maskAccessoryPayload(stock, req))
  } catch (error) {
    log.error('获取配件库存失败:', error)
    ApiResponse.error(res, '获取配件库存失败', 500)
  }
})

/**
 * 获取库存列表
 * GET /api/accessories/stock/list
 * 查询参数:
 * - store_id: 门店ID
 * - low_stock_only: 仅低库存
 * - page: 页码
 * - page_size: 每页数量
 */
router.get('/stock/list', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  store_id: 'stock_info.distribution', low_stock_only: 'stock_info.stock_status'
}), async (req, res) => {
  try {
    const params = {
      store_id: req.query.store_id,
      low_stock_only: req.query.low_stock_only === 'true',
      page: req.query.page,
      page_size: req.query.page_size
    }

    const result = await accessoryService.getStockList(params)

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryPayload(result.data, req))
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('获取库存列表失败:', error)
    ApiResponse.error(res, '获取库存列表失败', 500)
  }
})

/**
 * 获取库存预警
 * GET /api/accessories/stock/warnings
 * 查询参数:
 * - threshold: 预警阈值（默认5）
 */
router.get('/stock/warnings', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  threshold: 'stock_info.min_stock'
}), async (req, res) => {
  try {
    const threshold = req.query.threshold || 5
    const result = await accessoryService.getLowStockWarnings(threshold)

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryPayload(result.data, req))
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('获取库存预警失败:', error)
    ApiResponse.error(res, '获取库存预警失败', 500)
  }
})

// ============================
// 配件销售接口
// ============================

/**
 * 配件销售
 * POST /api/accessories/sell
 * 请求体:
 * {
 *   accessory_id: number,         // 配件ID（必填）
 *   store_id: number,             // 门店ID（必填）
 *   customer_id: number,          // 客户ID（可选）
 *   customer_name: string,        // 客户姓名
 *   customer_phone: string,       // 客户电话
 *   quantity: number,             // 销售数量（必填）
 *   unit_price: number,           // 单价（必填）
 *   remarks: string,              // 备注
 *   operator_id: number,          // 操作员ID
 *   operator_name: string         // 操作员姓名
 * }
 */
router.post('/sell', unifiedAuth, requirePermission('accessories:create'), rejectHiddenAccessorySellWrites, async (req, res) => {
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

    const result = await accessoryService.sell(data)

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryPayload(result.data, req), result.message)
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('配件销售失败:', error)
    ApiResponse.error(res, '配件销售失败', 500)
  }
})

// ============================
// 统计接口
// ============================

/**
 * 获取分类统计
 * GET /api/accessories/stats/category
 */
router.get('/stats/category', unifiedAuth, requirePermission('accessories:view'), async (req, res) => {
  try {
    const result = await accessoryService.getCategoryStats()

    if (result.success) {
      ApiResponse.success(res, await maskAccessoryPayload(result.data, req))
    } else {
      ApiResponse.error(res, result.message, 400)
    }
  } catch (error) {
    log.error('获取分类统计失败:', error)
    ApiResponse.error(res, '获取分类统计失败', 500)
  }
})

module.exports = router
