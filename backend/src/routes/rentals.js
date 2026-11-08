const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const { getUploadSubdir } = require('../utils/upload-paths')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const dataMaskingService = require('../services/data-masking.service')
const auditUnpaginatedPersonnelSearch = require('../middleware/unpaginated-personnel-search')
const RentalCustomerController = require('../controllers/rental-customer.controller')
const RentalDeviceController = require('../controllers/rental-device.controller')
const RentalScheduleController = require('../controllers/rental-schedule.controller')
const RentalFinishController = require('../controllers/rental-finish.controller')
const RentalFileController = require('../controllers/rental-file.controller')
const RentalListController = require('../controllers/rental-list.controller')
const RentalUpdateController = require('../controllers/rental-update.controller')
const RentalCreateController = require('../controllers/rental-create.controller')

router.use(unifiedAuth)

const RENTAL_FIELD_MODULE_KEY = 'rentals_rentalsview'
const RENTAL_DEVICE_FIELD_IDS = [
  'device_info.brand', 'device_info.model', 'device_info.color', 'device_info.memory',
  'device_info.imei', 'device_info.serial_number'
]
const hasRentalAction = (req, action) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
  return permissions.includes(`${RENTAL_FIELD_MODULE_KEY}:${action}`) || permissions.includes(`rentals:${action}`)
}
const getRentalFieldPermissions = async (req, preserveActionFields = true) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(req.user.id, RENTAL_FIELD_MODULE_KEY)
  const hiddenFields = new Set(permissions.hiddenFields || [])
  if (preserveActionFields && hasRentalAction(req, 'edit')) {
    [
      'contract_info.billing_mode', 'contract_info.contract_files',
      'price_info.unit_price', 'price_info.principal_amount', 'price_info.monthly_rent',
      'price_info.installment_amount', 'price_info.paid_rent', 'price_info.payable_rent',
      'schedule_info.term_months', 'schedule_info.next_due_date',
      'operator_info.operator_name', 'status_info.status'
    ].forEach(field => hiddenFields.delete(field))
  }
  return { ...permissions, hiddenFields: Array.from(hiddenFields) }
}
const getRentalHiddenFields = async req => {
  const permissions = await getRentalFieldPermissions(req, false)
  return new Set(permissions.hiddenFields || [])
}
const maskRentalItem = async (item, req) => {
  const permissions = await getRentalFieldPermissions(req)
  return dataMaskingService.filterSensitiveFields([item], permissions)[0]
}
const RENTAL_WRITE_FIELD_IDS = {
  customer_id: ['customer_info.customer_name', 'customer_info.customer_phone'],
  phone_id: RENTAL_DEVICE_FIELD_IDS,
  billing_mode: 'contract_info.billing_mode',
  unit_price: 'price_info.unit_price',
  term_months: 'schedule_info.term_months',
  sale_price: 'price_info.sale_price',
  purchase_cost: 'price_info.purchase_cost',
  down_payment: 'price_info.down_payment',
  monthly_rent: 'price_info.monthly_rent',
  sale_store_id: 'sales_info.sale_store_name',
  sale_operator_id: 'sales_info.sale_operator_name',
  sale_payment_method: 'sales_info.sale_payment_method',
  sale_payment_channel: 'sales_info.sale_payment_channel',
  sale_remarks: 'sales_info.sale_remarks',
  monitoring_lock: 'status_info.monitoring_lock',
  start_date: 'time_info.start_date',
  deposit: 'price_info.deposit',
  remarks: 'other_info.remarks'
}
const CUSTOMER_WRITE_FIELD_IDS = {
  name: 'customer_info.customer_name',
  phone: 'customer_info.customer_phone',
  id_card: 'customer_info.customer_id_card'
}
const isHiddenWrite = (hiddenFields, fieldId) => Array.isArray(fieldId)
  ? fieldId.every(field => hiddenFields.has(field))
  : hiddenFields.has(fieldId)
const rejectHiddenWrites = fieldMap => async (req, res, next) => {
  try {
    const hiddenFields = await getRentalHiddenFields(req)
    const deniedEntry = Object.entries(fieldMap).find(([bodyField, fieldId]) => (
      req.body?.[bodyField] !== undefined && isHiddenWrite(hiddenFields, fieldId)
    ))
    if (!deniedEntry) return next()
    const deniedField = Array.isArray(deniedEntry[1]) ? deniedEntry[1][0] : deniedEntry[1]
    return res.status(403).json({
      success: false,
      message: '不能修改已隐藏的字段',
      code: 'FIELD_PERMISSION_DENIED',
      field: deniedField
    })
  } catch (error) {
    return next(error)
  }
}
const rejectHiddenRentalWriteFields = rejectHiddenWrites(RENTAL_WRITE_FIELD_IDS)
const rejectHiddenCustomerWriteFields = rejectHiddenWrites(CUSTOMER_WRITE_FIELD_IDS)
const requireVisibleRentalFieldOrAction = (fieldId, action) => async (req, res, next) => {
  try {
    const hiddenFields = await getRentalHiddenFields(req)
    if (!hiddenFields.has(fieldId) || hasRentalAction(req, action)) return next()
    return res.status(403).json({ success: false, message: '无权访问已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: fieldId })
  } catch (error) {
    return next(error)
  }
}
const contractUploadDir = getUploadSubdir('rentals', 'contracts')
fs.mkdirSync(contractUploadDir, { recursive: true })
const contractUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, contractUploadDir),
    filename: (req, file, cb) => cb(null, `${req.params.id}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase()
    const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
    const allowed = (allowedImageExtensions.has(extension) && /^image\//.test(file.mimetype))
      || (extension === '.pdf' && file.mimetype === 'application/pdf')
    cb(allowed ? null : new Error('仅支持图片或PDF合同文件'), allowed)
  }
})
const rentalCustomerController = new RentalCustomerController()
const rentalDeviceController = new RentalDeviceController()
const rentalScheduleController = new RentalScheduleController()
const rentalFinishController = new RentalFinishController()
const rentalFileController = new RentalFileController()
const rentalListController = new RentalListController()
const rentalUpdateController = new RentalUpdateController()
const rentalCreateController = new RentalCreateController({ maskRentalItem })

const validateContractUploads = async (req, res, next) => {
  const files = req.files || []
  try {
    const results = await Promise.all(files.map(file => validateUploadedFileSignature(file, ['image', 'pdf'])))
    if (results.every(Boolean)) return next()
    await removeUploadedFiles(files)
    return ApiResponse.error(res, '合同文件内容与声明格式不匹配', 400)
  } catch (error) {
    await removeUploadedFiles(files).catch(() => {})
    return ApiResponse.error(res, '合同文件校验失败', 400)
  }
}

router.get('/customers', requireAnyPermission(['rentals:view', 'rentals:create']), rentalCustomerController.search.bind(rentalCustomerController))

router.get('/sales-options', requireAnyPermission(['rentals:view', 'rentals:create']), auditUnpaginatedPersonnelSearch('rentals-sales-options'), rentalCustomerController.getSalesOptions.bind(rentalCustomerController))

router.post('/customers', requirePermission('rentals:create'), rejectHiddenCustomerWriteFields, rentalCustomerController.create.bind(rentalCustomerController))

router.put('/customers/:id', requirePermission('rentals:create'), rejectHiddenCustomerWriteFields, rentalCustomerController.update.bind(rentalCustomerController))

router.get('/devices', requireAnyPermission(['rentals:view', 'rentals:create']), rentalDeviceController.listAvailable.bind(rentalDeviceController))

router.get('/', requirePermission('rentals:view'), rentalListController.list.bind(rentalListController))

router.post('/', requirePermission('rentals:create'), rejectHiddenRentalWriteFields, rentalCreateController.create.bind(rentalCreateController))

router.put('/:id', requirePermission('rentals:edit'), rejectHiddenRentalWriteFields, rentalUpdateController.update.bind(rentalUpdateController))

router.get('/:id/payment-schedule', requirePermission('rentals:edit'), rentalScheduleController.getPaymentSchedule.bind(rentalScheduleController))

router.post('/:id/payments', requirePermission('rentals:edit'), rejectHiddenWrites({ remarks: 'other_info.remarks' }), rentalScheduleController.recordPayment.bind(rentalScheduleController))

router.post('/:id/files', requirePermission('rentals:edit'), contractUpload.array('files', 12), validateContractUploads, rentalFileController.uploadContractFiles.bind(rentalFileController))

router.get(
  '/:id/files/:fileId/download',
  requirePermission('rentals:view'),
  requireVisibleRentalFieldOrAction('contract_info.contract_files', 'edit'),
  rentalFileController.downloadContractFile.bind(rentalFileController)
)

router.delete('/:id/files/:fileId', requirePermission('rentals:edit'), rentalFileController.deleteContractFile.bind(rentalFileController))

router.post('/:id/finish', requirePermission('rentals:edit'), rentalFinishController.finish.bind(rentalFinishController))

module.exports = router
