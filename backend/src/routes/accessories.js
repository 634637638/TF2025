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

const getAccessoryHiddenFields = async req => {
  const permissions = await dataMaskingService.getUserFieldPermissions(req.user.id, ACCESSORY_FIELD_MODULE_KEY)
  return new Set(permissions.hiddenFields || [])
}

const rejectHiddenWrites = fields => async (req, res, next) => {
  try {
    const hiddenFields = await getAccessoryHiddenFields(req)
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
const rejectHiddenAccessorySellWrites = rejectHiddenWrites(ACCESSORY_SELL_FIELD_IDS)

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
router.get('/barcode/:barcode', unifiedAuth, requirePermission('accessories:view'), requireVisibleAccessoryField('basic_info.barcode'), accessoryController.getByBarcode.bind(accessoryController))
router.get('/:id', unifiedAuth, requirePermission('accessories:view'), accessoryController.getById.bind(accessoryController))
router.post('/', unifiedAuth, requirePermission('accessories:create'), rejectHiddenAccessoryWrites, accessoryController.create.bind(accessoryController))
router.put('/:id', unifiedAuth, requirePermission('accessories:edit'), rejectHiddenAccessoryWrites, accessoryController.update.bind(accessoryController))
router.delete('/:id', unifiedAuth, requirePermission('accessories:delete'), accessoryController.remove.bind(accessoryController))
router.post('/stock-in', unifiedAuth, requirePermission('accessories:create'), rejectHiddenAccessoryWrites, accessoryController.stockIn.bind(accessoryController))
router.get('/stock-in/records', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  accessory_id: 'basic_info.name', supplier_id: 'basic_info.supplier_name', store_id: 'stock_info.distribution',
  start_date: 'time_info.inventory_time', end_date: 'time_info.inventory_time'
}), accessoryController.listStockInRecords.bind(accessoryController))
router.get('/:id/stock', unifiedAuth, requirePermission('accessories:view'), accessoryController.getStock.bind(accessoryController))
router.get('/stock/list', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  store_id: 'stock_info.distribution', low_stock_only: 'stock_info.stock_status'
}), accessoryController.listStock.bind(accessoryController))
router.get('/stock/warnings', unifiedAuth, requirePermission('accessories:view'), rejectHiddenAccessoryQueries({
  threshold: 'stock_info.min_stock'
}), accessoryController.listStockWarnings.bind(accessoryController))
router.post('/sell', unifiedAuth, requirePermission('accessories:create'), rejectHiddenAccessorySellWrites, accessoryController.sell.bind(accessoryController))
router.get('/stats/category', unifiedAuth, requirePermission('accessories:view'), accessoryController.getCategoryStats.bind(accessoryController))

module.exports = router
