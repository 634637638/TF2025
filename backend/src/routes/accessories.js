'use strict'

const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const AccessoryController = require('../controllers/accessory.controller')
const { getUploadSubdir } = require('../utils/upload-paths')
const dataMaskingService = require('../services/data-masking.service')

const accessoryController = new AccessoryController()
const ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'
const ACCESSORY_WRITE_FIELD_IDS = {
  barcode: 'basic_info.barcode', accessory_id: 'basic_info.name', name: 'basic_info.name',
  category: 'basic_info.category', category_id: 'basic_info.category', product_model: 'basic_info.specifications', brand_id: 'basic_info.brand_name', model_id: 'basic_info.model_name', model_ids: 'basic_info.model_name',
  free_film: 'basic_info.usage_type',
  usage_type: 'basic_info.usage_type', serial_tracking: 'basic_info.serial_tracking', serial_numbers: 'basic_info.serial_number',
  color_id: 'basic_info.color_name', supplier_id: 'basic_info.supplier_name', purchase_cost: 'price_info.purchase_cost',
  sale_price: 'price_info.sale_price', unit: 'basic_info.unit', unit_id: 'basic_info.unit',
  status: 'status_info.status', min_stock: 'stock_info.min_stock', total_quantity: 'stock_info.total_quantity',
  distribution: 'stock_info.distribution', store_id: 'stock_info.distribution', remarks: 'other_info.remarks',
  description: 'other_info.description', image_url: 'basic_info.image_url', inventory_time: 'time_info.inventory_time'
}
const getAccessoryHiddenFields = async req => {
  const permissions = req.fieldPermissions || await dataMaskingService.getUserFieldPermissions(req.user.id, ACCESSORY_FIELD_MODULE_KEY, { strict: true })
  req.fieldPermissions = permissions
  return new Set(permissions.hiddenFields || [])
}

const rejectHiddenWrites = fields => async (req, res, next) => {
  try {
    const hiddenFields = await getAccessoryHiddenFields(req)
    if (req.body?.entries !== undefined) {
      if (!Array.isArray(req.body.entries) || !req.body.entries.length || req.body.entries.length > 100) {
        return res.status(400).json({ success: false, message: '颜色入库资料格式无效', code: 'VALIDATION_ERROR' })
      }
      const required = ['basic_info.name', 'basic_info.color_name', 'stock_info.total_quantity', 'stock_info.distribution',
        'basic_info.supplier_name', 'price_info.purchase_cost', 'basic_info.usage_type']
      const denied = required.find(field => hiddenFields.has(field)) || Object.entries(fields).find(([key, field]) =>
        hiddenFields.has(field) && req.body.entries.some(entry => entry?.[key] !== undefined))?.[1]
      if (denied) return res.status(403).json({ success: false, message: '无权提交颜色入库字段', code: 'FIELD_PERMISSION_DENIED', field: denied })
    }
    if (req.body?.color_variants !== undefined) {
      const deniedColorField = hiddenFields.has('basic_info.color_name') ? 'basic_info.color_name'
        : hiddenFields.has('basic_info.barcode') && (!Array.isArray(req.body.color_variants) || req.body.color_variants.some(row => row?.barcode !== undefined)) ? 'basic_info.barcode' : null
      if (deniedColorField) return res.status(403).json({ success: false, message: '不能修改已隐藏的颜色或条形码', code: 'FIELD_PERMISSION_DENIED', field: deniedColorField })
    }
    const denied = Object.entries(fields).find(([bodyField, fieldId]) => (
      req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
    ))
    if (!denied) return next()
    return res.status(403).json({
      success: false,
      message: '不能修改已隐藏的字段',
      code: 'FIELD_PERMISSION_DENIED',
      field: denied[1]
    })
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
    return res.status(403).json({
      success: false,
      message: '不能使用已隐藏的筛选字段',
      code: 'FIELD_PERMISSION_DENIED',
      field: denied[1]
    })
  } catch (error) {
    return next(error)
  }
}

const rejectHiddenAccessoryWrites = rejectHiddenWrites(ACCESSORY_WRITE_FIELD_IDS)

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

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)
  if (mimetype && extname) return cb(null, true)
  cb(new Error('只允许上传图片文件（JPEG, JPG, PNG, GIF, WEBP）'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
})

router.post('/upload', unifiedAuth, requirePermission('accessories:create'), requireVisibleAccessoryField('basic_info.image_url'), upload.single('file'), accessoryController.upload.bind(accessoryController))
router.get('/', unifiedAuth, requirePermission('accessories:view'), accessoryController.list.bind(accessoryController))
router.get('/sale-options', unifiedAuth, requirePermission('accessories:view'), accessoryController.saleOptions.bind(accessoryController))
router.get('/barcode/:barcode', unifiedAuth, requirePermission('accessories:view'), requireVisibleAccessoryField('basic_info.barcode'), accessoryController.getByBarcode.bind(accessoryController))
router.get('/options', unifiedAuth, requirePermission('accessories:view'), accessoryController.entryOptions.bind(accessoryController))
router.get('/catalog', unifiedAuth, requirePermission('accessories-catalog:view'), accessoryController.productCatalog.bind(accessoryController))
router.get('/settings', unifiedAuth, requirePermission('accessories-catalog:view'), requireVisibleAccessoryField('stock_info.distribution'), accessoryController.getSettings.bind(accessoryController))
router.put('/settings', unifiedAuth, requirePermission('accessories-catalog:edit'), rejectHiddenWrites({ warehouse_store_id: 'stock_info.distribution' }), accessoryController.saveSettings.bind(accessoryController))
router.post('/transfer', unifiedAuth, requirePermission('accessories:transfer'), rejectHiddenWrites({
  accessory_id: 'basic_info.name', from_store_id: 'stock_info.distribution', to_store_id: 'stock_info.distribution',
  quantity: 'stock_info.total_quantity', serial_numbers: 'basic_info.serial_number', remarks: 'other_info.remarks'
}), accessoryController.transfer.bind(accessoryController))
router.get('/:id/transfers', unifiedAuth, requirePermission('accessories:view'), requireVisibleAccessoryField('stock_info.distribution'), accessoryController.listTransfers.bind(accessoryController))
router.get('/:id/batches', unifiedAuth, requirePermission('accessories:view'), accessoryController.listInventoryBatches.bind(accessoryController))
router.post('/:id/inventory-adjustments', unifiedAuth, requirePermission('accessories:edit'), rejectHiddenAccessoryWrites, accessoryController.adjustInventory.bind(accessoryController))
router.get('/:id/stock-in-options', unifiedAuth, requirePermission('accessories:view'), requirePermission('accessories:edit'), accessoryController.stockCorrectionOptions.bind(accessoryController))
router.get('/stock-in/:id/edit', unifiedAuth, requirePermission('accessories:view'), requirePermission('accessories:edit'), accessoryController.stockCorrectionContext.bind(accessoryController))
router.post('/stock-in/:id/corrections', unifiedAuth, requirePermission('accessories:edit'), rejectHiddenAccessoryWrites, accessoryController.correctStockIn.bind(accessoryController))
router.get('/serials/:serialNumber', unifiedAuth, requirePermission('accessories:view'), requireVisibleAccessoryField('basic_info.serial_number'), accessoryController.serialTrace.bind(accessoryController))
router.get('/:id/serials', unifiedAuth, requirePermission('accessories:view'), requireVisibleAccessoryField('basic_info.serial_number'), rejectHiddenAccessoryQueries({ store_id: 'stock_info.distribution' }), accessoryController.listSerials.bind(accessoryController))
router.post('/catalog/:kind', unifiedAuth, requirePermission('accessories-catalog:create'), accessoryController.saveProductCatalogItem.bind(accessoryController))
router.put('/catalog/:kind/:id', unifiedAuth, requirePermission('accessories-catalog:edit'), accessoryController.saveProductCatalogItem.bind(accessoryController))
router.get('/:id', unifiedAuth, requirePermission('accessories:view'), accessoryController.getById.bind(accessoryController))
router.post('/', unifiedAuth, requirePermission('accessories:create'), rejectHiddenAccessoryWrites, accessoryController.create.bind(accessoryController))
router.put('/:id', unifiedAuth, requirePermission('accessories:edit'), rejectHiddenAccessoryWrites, accessoryController.update.bind(accessoryController))
router.delete('/:id', unifiedAuth, requirePermission('accessories:delete'), accessoryController.remove.bind(accessoryController))
router.post('/stock-in', unifiedAuth, requirePermission('accessories:stock-in'), rejectHiddenAccessoryWrites, accessoryController.stockIn.bind(accessoryController))
router.get('/stock-in/records', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  accessory_id: 'basic_info.name', supplier_id: 'basic_info.supplier_name', store_id: 'stock_info.distribution',
  start_date: 'time_info.inventory_time', end_date: 'time_info.inventory_time'
}), accessoryController.listStockInRecords.bind(accessoryController))
router.get('/:id/stock', unifiedAuth, requirePermission('accessories:view'), accessoryController.getStock.bind(accessoryController))
router.get('/stock/list', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  store_id: 'stock_info.distribution', low_stock_only: 'stock_info.stock_status'
}), accessoryController.listStock.bind(accessoryController))
router.get('/stock/warnings', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  threshold: 'stock_info.min_stock', store_id: 'stock_info.distribution'
}), accessoryController.listStockWarnings.bind(accessoryController))
router.get('/stats/category', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({ store_id: 'stock_info.distribution' }), accessoryController.getCategoryStats.bind(accessoryController))

module.exports = router
