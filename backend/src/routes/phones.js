const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { requireInventoryQueryToken } = require('../utils/inventory-query-token')
const PhoneInventoryQueryController = require('../controllers/phone-inventory-query.controller')
const PhoneProductController = require('../controllers/phone-product.controller')
const PhoneUpdateController = require('../controllers/phone-update.controller')
const phoneInventoryQueryController = new PhoneInventoryQueryController()
const phoneUpdateController = new PhoneUpdateController()

// 获取手机列表
router.get('/', unifiedAuth, requirePermission('inventory:view'), phoneInventoryQueryController.listInventoryPhones.bind(phoneInventoryQueryController))

// 获取已销售手机的时间信息（入库时间和出库时间）
router.get('/sold-timeline', unifiedAuth, requirePermission('system:edit'), phoneInventoryQueryController.getSoldTimeline.bind(phoneInventoryQueryController))

// 根据IMEI或序列号搜索商品（用于销售单添加商品）
// 支持精确匹配和模糊搜索
// 注意：此路由必须在 /:id 路由之前定义
router.get('/search-by-identifier', unifiedAuth, requirePermission('query:view'), phoneInventoryQueryController.searchByIdentifier.bind(phoneInventoryQueryController))

// ===== 公开端点（无需登录认证）=====
// 注意：这些路由必须在 /:id 之前定义，否则会被 /:id 路由拦截

// 按规格和入库价汇总在库二手机；仅返回公开查询所需的聚合字段。
router.get('/used-models', requireInventoryQueryToken, phoneInventoryQueryController.getUsedModels.bind(phoneInventoryQueryController))

// 获取在库最久的商品信息（用于同行咨询，无需登录）
router.get('/longest-inventory', requireInventoryQueryToken, phoneInventoryQueryController.getLongestInventory.bind(phoneInventoryQueryController))

// ===== 需要认证的路由 =====

// 获取单个手机详情
router.get('/:id', unifiedAuth, requirePermission('sales:view'), phoneInventoryQueryController.getPhoneDetails.bind(phoneInventoryQueryController))

// 更新手机 - 支持四种权限：phones:edit（库存管理）、sales-editphoneview:edit（销售管理）、query:edit（综合查询编辑）、inventory:edit（库存编辑）
router.put('/:id', unifiedAuth, requireAnyPermission(['phones:edit', 'sales-editphoneview:edit', 'query:edit', 'inventory:edit']), phoneUpdateController.update.bind(phoneUpdateController))

// 删除手机
router.delete(
  '/:id',
  unifiedAuth,
  requireAnyPermission(['phones:delete', 'sales:delete', 'sales-editphoneview:delete', 'query:delete', 'inventory:delete']),
  phoneInventoryQueryController.deleteInventoryPhone.bind(phoneInventoryQueryController)
)

// ============================================================================
// 手机图片管理 API（库存管理用）
// ============================================================================

const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const { getUploadSubdir } = require('../utils/upload-paths')
const phoneMediaController = require('../controllers/phone-media.controller')
const phoneProductController = new PhoneProductController()

const PHONE_MEDIA_VIEW_PERMISSIONS = [
  'sales:view',
  'inventory:view',
  'query:view',
  'h5-sold-products:view',
  'h5-templates:view',
  'h5-admin:view'
]
const PHONE_MEDIA_EDIT_PERMISSIONS = [
  'inventory:edit',
  'query:edit',
  'h5-templates:edit',
  'h5-admin:edit',
  'h5-sold-products:delete',
  'h5-templates:delete',
  'h5-admin:delete',
  'inventory:delete'
]
const PHONE_MEDIA_UPLOAD_PERMISSIONS = [
  'inventory:edit',
  'query:edit',
  'h5-templates:create',
  'h5-admin:create',
  'inventory:create'
]

// 配置图片上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadSubdir('phones')
    try {
      await fs.mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // 目录已存在，忽略错误
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex')
    const ext = path.extname(file.originalname)
    cb(null, 'phone-' + uniqueSuffix + ext)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('只支持上传图片文件（jpeg, jpg, png, gif, webp）'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024 // 30MB
  }
})



/**
 * 上传手机图片
 * POST /api/phones/:id/upload-image
 * 权限：inventory:edit
 */
router.post('/:id/upload-image',
  unifiedAuth,
  requireAnyPermission(PHONE_MEDIA_UPLOAD_PERMISSIONS),
  upload.single('image'),
  phoneMediaController.uploadImage
)

/**
 * 获取手机图片列表
 * GET /api/phones/:id/images
 * 权限：inventory:view
 */
router.get('/:id/images',
  unifiedAuth,
  requireAnyPermission(PHONE_MEDIA_VIEW_PERMISSIONS),
  phoneMediaController.list
)

/**
 * 设置主图
 * PUT /api/phones/:id/images/:imageId/primary
 * 权限：inventory:edit
 */
router.put('/:id/images/:imageId/primary',
  unifiedAuth,
  requireAnyPermission(PHONE_MEDIA_EDIT_PERMISSIONS),
  phoneMediaController.setPrimary
)

/**
 * 重新排序图片
 * PUT /api/phones/:id/images/reorder
 * 权限：inventory:edit
 * Body: { imageIds: [1, 2, 3, ...] } - 按新顺序排列的图片ID数组
 */
router.put('/:id/images/reorder',
  unifiedAuth,
  requireAnyPermission(PHONE_MEDIA_EDIT_PERMISSIONS),
  phoneMediaController.reorder
)

/**
 * 删除图片
 * DELETE /api/phones/:id/images/:imageId
 * 权限：inventory:edit
 */
router.delete('/:id/images/:imageId',
  unifiedAuth,
  requireAnyPermission(PHONE_MEDIA_EDIT_PERMISSIONS),
  phoneMediaController.remove
)

// ============================================================================
// H5商品验机信息管理 API
// ============================================================================

/**
 * 获取商品H5上架信息
 * GET /api/phones/:id/h5-product
 * 权限：inventory:view
 */
router.get('/:id/h5-product',
  unifiedAuth,
  requirePermission('inventory:view'),
  phoneProductController.getH5Product.bind(phoneProductController)
)

/**
 * 更新商品H5上架状态
 * PUT /api/phones/:id/h5-product
 * 权限：inventory:edit
 * Body: { is_published: 0 | 1 }
 */
router.put('/:id/h5-product',
  unifiedAuth,
  requirePermission('inventory:edit'),
  phoneProductController.updateH5Product.bind(phoneProductController)
)

/**
 * 保存商品验机信息
 * POST /api/phones/:id/inspection
 * 权限：inventory:edit
 */
router.post('/:id/inspection',
  unifiedAuth,
  requirePermission('inventory:edit'),
  phoneProductController.saveInspection.bind(phoneProductController)
)

/**
 * 获取商品验机信息
 * GET /api/phones/:id/inspection
 * 权限：inventory:view
 */
router.get('/:id/inspection',
  unifiedAuth,
  requirePermission('inventory:view'),
  phoneProductController.getInspection.bind(phoneProductController)
)

// ============================================================================
// 视频上传 API
// ============================================================================

// 配置视频上传存储
const videoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadSubdir('videos')
    try {
      await fs.mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // 目录已存在，忽略错误
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex')
    const ext = path.extname(file.originalname)
    cb(null, 'video-' + uniqueSuffix + ext)
  }
})

// 视频文件过滤器
const videoFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('只支持上传视频文件（mp4, webm, ogg, mov）'), false)
  }
}

const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
})

/**
 * 上传商品视频
 * POST /api/phones/:id/upload-video
 * 权限：inventory:edit
 */
router.post('/:id/upload-video',
  unifiedAuth,
  requireAnyPermission(PHONE_MEDIA_UPLOAD_PERMISSIONS),
  videoUpload.single('video'),
  phoneMediaController.uploadVideo
)

module.exports = router
