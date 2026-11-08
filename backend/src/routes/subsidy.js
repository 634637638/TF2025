const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const { cacheMiddleware } = require('../middleware/cache')
const { CACHE_TTL } = require('../config/constants')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const dataMaskingService = require('../services/data-masking.service')
const { getUploadSubdir } = require('../utils/upload-paths')
const { verifyPrivateFileAccess } = require('../utils/private-file-access')
const SubsidyArrivalController = require('../controllers/subsidy-arrival.controller')
const SubsidyFilterOptionsController = require('../controllers/subsidy-filter-options.controller')
const SubsidyPhotosController = require('../controllers/subsidy-photos.controller')
const SubsidyAuditController = require('../controllers/subsidy-audit.controller')
const SubsidyApprovalController = require('../controllers/subsidy-approval.controller')
const SubsidyDetailController = require('../controllers/subsidy-detail.controller')
const SubsidyFileController = require('../controllers/subsidy-file.controller')
const SubsidyPhoneSearchController = require('../controllers/subsidy-phone-search.controller')
const SubsidyPhoneDetailController = require('../controllers/subsidy-phone-detail.controller')
const SubsidyStatsController = require('../controllers/subsidy-stats.controller')
const SubsidyExportController = require('../controllers/subsidy-export.controller')
const SubsidyListController = require('../controllers/subsidy-list.controller')
const SubsidyApplyController = require('../controllers/subsidy-apply.controller')
const SubsidyUpdateController = require('../controllers/subsidy-update.controller')

const subsidyArrivalController = new SubsidyArrivalController()
const subsidyFilterOptionsController = new SubsidyFilterOptionsController()
const subsidyPhotosController = new SubsidyPhotosController()
const subsidyAuditController = new SubsidyAuditController()
const subsidyApprovalController = new SubsidyApprovalController()
const subsidyDetailController = new SubsidyDetailController()
const subsidyFileController = new SubsidyFileController()
const subsidyPhoneSearchController = new SubsidyPhoneSearchController()
const subsidyPhoneDetailController = new SubsidyPhoneDetailController()
const subsidyStatsController = new SubsidyStatsController()
const subsidyExportController = new SubsidyExportController()
const subsidyListController = new SubsidyListController()
const subsidyApplyController = new SubsidyApplyController()
const subsidyUpdateController = new SubsidyUpdateController()

const handleSubsidyPhotoUpload = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      log.error('文件上传错误:', error)
      return ApiResponse.error(res, error.message || '文件上传失败', 500)
    }
    return next()
  })
}

const getSubsidyHiddenFields = async (req) => {
  const fieldPermissions = await dataMaskingService.getUserFieldPermissions(
    req.user.id,
    'subsidy_subsidyview'
  )
  return new Set(fieldPermissions.hiddenFields || [])
}

const requirePermissionWhen = (permission, predicate) => {
  const guard = requirePermission(permission)
  return (req, res, next) => predicate(req.body || {}) ? guard(req, res, next) : next()
}

const requireSubsidyUploadWhenPhotosPresent = requirePermissionWhen(
  'subsidy:upload',
  body => Array.isArray(body.subsidy_photos) && body.subsidy_photos.length > 0
)
const requireSubsidyApprovalWhenChangingApplyTime = requirePermissionWhen(
  'subsidy:approve',
  body => body.apply_time !== undefined || body.has_audit !== undefined
)
const requireSubsidyArrivalWhenChangingArrivalTime = requirePermissionWhen(
  'subsidy:arrival',
  body => body.arrival_time !== undefined || body.has_arrival !== undefined
)

const requireSubsidyUpload = requirePermission('subsidy:upload')

const SUBSIDY_WRITE_FIELD_IDS = {
  customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone',
  customer_idcard: 'customer_info.customer_idcard',
  phone_brand: 'device_info.brand',
  phone_model: 'device_info.model',
  phone_color: 'device_info.color',
  phone_memory: 'device_info.memory',
  serial_number: 'device_info.serial_number',
  imei1: 'device_info.imei1',
  imei2: 'device_info.imei2',
  sale_price: 'price_info.sale_price',
  sale_time: 'time_info.sale_time',
  store_id: 'store_info.store_name',
  remarks: 'other_info.remarks',
  has_different_handler: 'handler_info.has_different_handler',
  handler_name: 'handler_info.handler_name',
  handler_phone: 'handler_info.handler_phone',
  handler_idcard: 'handler_info.handler_idcard'
}

const rejectHiddenSubsidyWriteFields = async (req, res, next) => {
  const hiddenFields = await getSubsidyHiddenFields(req)
  const deniedEntry = Object.entries(SUBSIDY_WRITE_FIELD_IDS).find(([bodyField, fieldId]) => (
    req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
  ))

  if (!deniedEntry) {
    return next()
  }

  return res.status(403).json({
    success: false,
    message: '不能修改已隐藏的字段',
    code: 'FIELD_PERMISSION_DENIED',
    field: deniedEntry[1]
  })
}

const authenticateSubsidyFileAccess = async (req, res, next) => {
  try {
    const relativePath = typeof req.params[0] === 'string' ? req.params[0] : ''
    const valid = verifyPrivateFileAccess({
      namespace: 'subsidy-file',
      relativePath,
      userId: req.query.user,
      expires: req.query.expires,
      signature: req.query.signature
    })
    if (!valid) return ApiResponse.error(res, '照片链接无效或已过期', 403)

    return next()
  } catch (error) {
    return ApiResponse.error(res, '照片链接无效或已过期', 403)
  }
}

// ============================
// 图片上传配置
// ============================

// 确保上传目录存在
const uploadDir = getUploadSubdir('subsidy')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // 临时文件名：使用时间戳，后续会在处理时重命名
    const timestamp = Date.now()
    const randomSuffix = crypto.randomBytes(6).toString('hex')
    const ext = path.extname(file.originalname)
    const filename = `temp_${timestamp}_${randomSuffix}${ext}`
    cb(null, filename)
  }
})

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif|pdf/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const isImage = /jpeg|jpg|png|gif|webp|heic|heif/.test(file.mimetype) ||
                   file.mimetype === 'image/heic' ||
                   file.mimetype === 'image/heif'
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf'

  if ((isImage || isPdf) && extname) {
    return cb(null, true)
  }
  cb(new Error('只允许上传图片文件（JPEG, JPG, PNG, GIF, WEBP, HEIC）或PDF文件'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})


// 第一步：通过IMEI或序列号搜索设备列表
router.get('/search-phones/:identifier', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), subsidyPhoneSearchController.search.bind(subsidyPhoneSearchController))

// 第二步：获取选定设备的完整销售信息（包括客户信息）
router.get('/phone-detail/:phoneId', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), subsidyPhoneDetailController.getByPhoneId.bind(subsidyPhoneDetailController))

// 创建国补申请
router.post(
  '/apply',
  unifiedAuth,
  requirePermission('subsidy:create'),
  requireSubsidyUploadWhenPhotosPresent,
  subsidyApplyController.create.bind(subsidyApplyController)
)

// 获取国补列表（带缓存，仅缓存第一页）
router.get('/', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), subsidyListController.list.bind(subsidyListController))

// 获取筛选选项（品牌、型号、颜色、内存、店铺）
// 注意：此路由必须在 /:id 之前，否则 filter-options 会被当作 id 参数处理
router.get('/filter-options', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.LONG }), subsidyFilterOptionsController.getFilterOptions.bind(subsidyFilterOptionsController))

router.get('/export/excel', unifiedAuth, requirePermission('subsidy:export'), subsidyExportController.exportExcel.bind(subsidyExportController))

router.get('/:id/photos', unifiedAuth, requireSubsidyUpload, subsidyPhotosController.getPhotos.bind(subsidyPhotosController))

router.get('/:id', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), subsidyDetailController.getById.bind(subsidyDetailController))

router.put('/:id/photos', unifiedAuth, requireSubsidyUpload, subsidyPhotosController.updatePhotos.bind(subsidyPhotosController))

// 更新国补信息
router.put(
  '/:id',
  unifiedAuth,
  requirePermission('subsidy:edit'),
  requireSubsidyApprovalWhenChangingApplyTime,
  requireSubsidyArrivalWhenChangingArrivalTime,
  rejectHiddenSubsidyWriteFields,
  subsidyUpdateController.update.bind(subsidyUpdateController)
)
// 审批国补申请（记录审批时间）
router.put('/:id/audit', unifiedAuth, requirePermission('subsidy:approve'), subsidyAuditController.audit.bind(subsidyAuditController))

// 删除国补记录
router.delete('/:id', unifiedAuth, requirePermission('subsidy:delete'), subsidyPhotosController.deleteRecord.bind(subsidyPhotosController))

// 审批国补申请
router.put('/:id/approve', unifiedAuth, requirePermission('subsidy:approve'), subsidyApprovalController.approve.bind(subsidyApprovalController))

// 确认国补到账（记录到账时间）
router.put('/:id/confirm-arrival', unifiedAuth, requirePermission('subsidy:arrival'), subsidyArrivalController.confirmArrival.bind(subsidyArrivalController))

// 获取国补统计
router.get('/stats/summary', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), subsidyStatsController.getSummary.bind(subsidyStatsController))

// ============================
// 图片上传接口
// ============================

/**
 * 上传国补照片
 * POST /api/subsidy/upload/photo
 * 权限：需要登录
 */
router.post('/upload/photo', unifiedAuth, requireSubsidyUpload, handleSubsidyPhotoUpload, subsidyPhotosController.uploadPhoto.bind(subsidyPhotosController))

router.get('/files/*', authenticateSubsidyFileAccess, subsidyFileController.getFile.bind(subsidyFileController))

/**
 * 删除临时照片（未保存的上传照片）
 * POST /api/subsidy/delete-temp-photos
 * 权限：需要登录
 */
router.post('/delete-temp-photos', unifiedAuth, requirePermission('subsidy:upload'), subsidyPhotosController.deleteTemporaryPhotos.bind(subsidyPhotosController))

module.exports = router
