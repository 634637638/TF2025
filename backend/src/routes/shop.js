/**
 * H5商城管理路由 - 员工端（需要权限）
 * 功能：商城配置管理、轮播图管理、商品图片管理
 */

const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const { unifiedAuth, requireAnyPermission, requireAdmin } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const ShopService = require('../services/shop.service')
const ShopManagementController = require('../controllers/shop-management.controller')
const log = require('../utils/log')
const { getUploadSubdir } = require('../utils/upload-paths')

const shopService = new ShopService()
const shopManagementController = new ShopManagementController({ service: shopService })

const H5_CONFIG_VIEW_PERMISSIONS = ['h5-config:view', 'h5-admin:view']
const H5_CONFIG_EDIT_PERMISSIONS = ['h5-config:edit', 'h5-admin:edit']
const H5_BANNER_VIEW_PERMISSIONS = ['h5-banners:view', 'h5-admin:view']
const H5_BANNER_CREATE_PERMISSIONS = ['h5-banners:create', 'h5-admin:create']
const H5_BANNER_EDIT_PERMISSIONS = ['h5-banners:edit', 'h5-admin:edit']
const H5_BANNER_DELETE_PERMISSIONS = ['h5-banners:delete', 'h5-admin:delete']
const H5_TEMPLATE_VIEW_PERMISSIONS = [
  'h5-templates:view',
  'h5-admin:view',
  'inventory:view',
  'query:view'
]
const H5_TEMPLATE_CREATE_PERMISSIONS = [
  'h5-templates:create',
  'h5-admin:create',
  'inventory:create',
  'inventory:edit'
]
const H5_TEMPLATE_EDIT_PERMISSIONS = [
  'h5-templates:edit',
  'h5-admin:edit',
  'inventory:edit'
]
const H5_TEMPLATE_DELETE_PERMISSIONS = [
  'h5-templates:delete',
  'h5-admin:delete',
  'inventory:delete',
  'inventory:edit'
]
const H5_SOLD_PRODUCTS_VIEW_PERMISSIONS = [
  'h5-sold-products:view',
  'h5-admin:view',
  'h5-templates:view',
  'inventory:view',
  'query:view'
]
const H5_SOLD_PRODUCTS_DELETE_PERMISSIONS = [
  'h5-sold-products:delete',
  'h5-admin:delete',
  'h5-templates:delete',
  'inventory:delete',
  'inventory:edit'
]
const H5_ORDER_VIEW_PERMISSIONS = [
  'h5-orders:view',
  'h5-admin:view',
  'sales:view'
]
const H5_ORDER_EDIT_PERMISSIONS = [
  'h5-orders:edit',
  'h5-admin:edit',
  'sales:edit'
]
const H5_ASSET_EDIT_PERMISSIONS = [
  ...new Set([
    ...H5_CONFIG_EDIT_PERMISSIONS,
    ...H5_BANNER_CREATE_PERMISSIONS,
    ...H5_BANNER_EDIT_PERMISSIONS
  ])
]

// ============================================================================
// 图片上传配置
// ============================================================================

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadSubdir('shop')
    log.debug('[Multer] 上传目录:', uploadDir)
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      log.error('[Multer] 创建上传目录失败:', error)
      cb(error, uploadDir)
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex')
    const ext = path.extname(file.originalname)
    cb(null, 'shop-' + uniqueSuffix + ext)
  }
})

const createFileFilter = ({ allowedTypes, allowedExtensions, label, allowMimePrefixes = [] }) => {
  return (req, file, cb) => {
    log.debug(`[${label}] 检测到的文件信息:`)
    log.debug('  - MIME类型:', file.mimetype)
    log.debug('  - 原始文件名:', file.originalname)

    const ext = path.extname(file.originalname).toLowerCase()
    const isAllowedExt = allowedExtensions.includes(ext)
    const isAllowedMime = allowedTypes.includes(file.mimetype)
    const matchesMimePrefix = !file.mimetype || allowMimePrefixes.some(prefix => file.mimetype.startsWith(prefix))

    log.debug('  - 文件扩展名:', ext)
    log.debug('  - MIME类型通过:', isAllowedMime)
    log.debug('  - 扩展名通过:', isAllowedExt)

    if (isAllowedExt && matchesMimePrefix) {
      log.debug(`[${label}] ✅ 文件类型验证通过（基于扩展名）`)
      cb(null, true)
      return
    }

    if (isAllowedMime) {
      log.debug(`[${label}] ✅ 文件类型验证通过（基于MIME类型）`)
      cb(null, true)
      return
    }

    log.debug(`[${label}] ❌ 文件类型被拒绝:`, file.mimetype, '扩展名:', ext)
    cb(new Error(`只支持上传${label}`), false)
  }
}

const imageFileFilter = createFileFilter({
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  label: '图片文件（jpeg, png, gif, webp）',
  allowMimePrefixes: ['image/']
})

const templateMediaFileFilter = createFileFilter({
  allowedTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov'],
  label: '图片或视频文件（jpg, png, gif, webp, mp4, webm, ogg, mov）',
  allowMimePrefixes: ['image/', 'video/']
})

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
})

const templateMediaUpload = multer({
  storage,
  fileFilter: templateMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
})

// Multer 错误处理中间件
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    log.error('[Multer Error]', err)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.error(res, '文件大小超过限制', 400)
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiResponse.error(res, '上传字段名称错误', 400)
    }
    return ApiResponse.error(res, `上传失败: ${err.message}`, 400)
  }
  if (err) {
    log.error('[Upload Error]', err.message)
    return ApiResponse.error(res, err.message || '上传失败', 400)
  }
  next()
}

// ============================================================================
// 图片上传 API
// ============================================================================

// ============================================================================
// 图片上传 API
// ============================================================================

/**
 * 上传商城图片（配置、轮播图等）- 支持多图上传
 * POST /api/shop/upload/image
 * 权限：h5-config:edit / h5-banners:create/edit
 */
router.post('/upload/image',
  unifiedAuth,
  requireAnyPermission(H5_ASSET_EDIT_PERMISSIONS),
  (req, res, next) => {
    upload.array('files', 10)(req, res, next)
  },
  handleMulterError,
  shopManagementController.uploadShopImages.bind(shopManagementController)
)

/**
 * 删除商城图片文件
 * POST /api/shop/delete-image
 * 权限：h5-config:edit / h5-banners:create/edit
 */
router.post('/delete-image',
  unifiedAuth,
  requireAnyPermission(H5_ASSET_EDIT_PERMISSIONS),
  shopManagementController.deleteShopImage.bind(shopManagementController)
)

// ============================================================================
// 商城配置管理 API
// ============================================================================

/**
 * 获取所有商城配置
 * GET /api/shop/config
 * 权限：h5-admin:view
 */
router.get('/config', unifiedAuth, requireAnyPermission(H5_CONFIG_VIEW_PERMISSIONS), shopManagementController.getAllConfigs.bind(shopManagementController))

/**
 * 获取指定分类的配置
 * GET /api/shop/config/category/:category
 * 权限：h5-admin:view
 */
router.get('/config/category/:category', unifiedAuth, requireAnyPermission(H5_CONFIG_VIEW_PERMISSIONS), shopManagementController.getConfigsByCategory.bind(shopManagementController))

/**
 * 更新单个配置
 * PUT /api/shop/config/:key
 * 权限：h5-admin:edit
 */
router.put('/config/:key', unifiedAuth, requireAnyPermission(H5_CONFIG_EDIT_PERMISSIONS), shopManagementController.updateConfig.bind(shopManagementController))

/**
 * 批量更新配置
 * POST /api/shop/config/batch
 * 权限：h5-admin:edit
 */
router.post('/config/batch', unifiedAuth, requireAnyPermission(H5_CONFIG_EDIT_PERMISSIONS), shopManagementController.batchUpdateConfigs.bind(shopManagementController))

// ============================================================================
// 轮播图管理 API
// ============================================================================

/**
 * 获取所有轮播图
 * GET /api/shop/banners
 * 权限：shop:banners:view
 */
router.get('/banners', unifiedAuth, requireAnyPermission(H5_BANNER_VIEW_PERMISSIONS), shopManagementController.getAllBanners.bind(shopManagementController))

/**
 * 创建轮播图
 * POST /api/shop/banners
 * 权限：shop:banners:create
 */
router.post('/banners', unifiedAuth, requireAnyPermission(H5_BANNER_CREATE_PERMISSIONS), shopManagementController.createBanner.bind(shopManagementController))

/**
 * 更新轮播图
 * PUT /api/shop/banners/:id
 * 权限：shop:banners:edit
 */
router.put('/banners/:id', unifiedAuth, requireAnyPermission(H5_BANNER_EDIT_PERMISSIONS), shopManagementController.updateBanner.bind(shopManagementController))

/**
 * 删除轮播图
 * DELETE /api/shop/banners/:id
 * 权限：shop:banners:delete
 */
router.delete('/banners/:id', unifiedAuth, requireAnyPermission(H5_BANNER_DELETE_PERMISSIONS), shopManagementController.deleteBanner.bind(shopManagementController))

/**
 * 批量更新轮播图排序
 * PUT /api/shop/banners/reorder
 * 权限：shop:banners:edit
 */
router.put('/banners/reorder', unifiedAuth, requireAnyPermission(H5_BANNER_EDIT_PERMISSIONS), shopManagementController.reorderBanners.bind(shopManagementController))

// ============================================================================
// 订单管理 API（员工端）
// ============================================================================

/**
 * 获取订单列表
 * GET /api/shop/orders
 * 权限：sales:view
 */
router.get('/orders',
  unifiedAuth,
  requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS),
  shopManagementController.getOrders.bind(shopManagementController)
)

/**
 * 获取订单详情
 * GET /api/shop/orders/:id
 * 权限：sales:view
 */
router.get('/orders/:id',
  unifiedAuth,
  requireAnyPermission(H5_ORDER_VIEW_PERMISSIONS),
  shopManagementController.getOrderDetail.bind(shopManagementController)
)

/**
 * 更新订单状态
 * PUT /api/shop/orders/:id/status
 * 权限：sales:edit
 */
router.put('/orders/:id/status',
  unifiedAuth,
  requireAnyPermission(H5_ORDER_EDIT_PERMISSIONS),
  shopManagementController.updateOrderStatus.bind(shopManagementController)
)

// ============================================================================
// 数据迁移 API
// ============================================================================

/**
 * 执行成色字段迁移
 * POST /api/shop/migrate/condition-grade
 */
router.post('/migrate/condition-grade',
  unifiedAuth,
  requireAdmin,
  shopManagementController.migrateConditionGrade.bind(shopManagementController)
)

router.post('/migrate/sale-price',
  unifiedAuth,
  requireAdmin,
  shopManagementController.migrateSalePrice.bind(shopManagementController)
)

// ============================================================================
// 全新机商品模板管理
// ============================================================================

/**
 * 获取商品模板列表
 * GET /api/shop/templates
 */
router.get('/templates',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_VIEW_PERMISSIONS),
  shopManagementController.getTemplates.bind(shopManagementController)
)

/**
 * 批量更新模板排序
 * PUT /api/shop/templates/reorder
 * 注意：必须在 /templates/:id 之前定义，否则会被 :id 匹配
 */
router.put('/templates/reorder',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  shopManagementController.reorderTemplates.bind(shopManagementController)
)

/**
 * 获取商品模板详情
 * GET /api/shop/templates/:id
 */
router.get('/templates/:id',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_VIEW_PERMISSIONS),
  shopManagementController.getTemplateById.bind(shopManagementController)
)

/**
 * 创建商品模板
 * POST /api/shop/templates
 */
router.post('/templates',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_CREATE_PERMISSIONS),
  shopManagementController.createTemplate.bind(shopManagementController)
)

/**
 * 更新商品模板
 * PUT /api/shop/templates/:id
 */
router.put('/templates/:id',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  shopManagementController.updateTemplate.bind(shopManagementController)
)

/**
 * 删除商品模板
 * DELETE /api/shop/templates/:id
 */
router.delete('/templates/:id',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_DELETE_PERMISSIONS),
  shopManagementController.deleteTemplate.bind(shopManagementController)
)

/**
 * 上传模板图片
 * POST /api/shop/templates/:id/images
 */
router.post('/templates/:id/images',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  (req, res, next) => {
    templateMediaUpload.single('image')(req, res, next)
  },
  handleMulterError,
  shopManagementController.uploadTemplateImage.bind(shopManagementController)
)

/**
 * 删除模板图片
 * DELETE /api/shop/templates/:id/images/:imageId
 */
router.delete('/templates/:id/images/:imageId',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  shopManagementController.deleteTemplateImage.bind(shopManagementController)
)

router.post('/templates/media/commit-drafts',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  shopManagementController.commitTemplateImageUploads.bind(shopManagementController)
)

router.post('/templates/media/discard-drafts',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  shopManagementController.discardTemplateImageUploads.bind(shopManagementController)
)

/**
 * 设置主图
 * PUT /api/shop/templates/:id/images/:imageId/primary
 */
router.put('/templates/:id/images/:imageId/primary',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  shopManagementController.setPrimaryTemplateImage.bind(shopManagementController)
)

/**
 * 批量更新模板图片排序
 * PUT /api/shop/templates/:id/images/reorder
 */
router.put('/templates/:id/images/reorder',
  unifiedAuth,
  requireAnyPermission(H5_TEMPLATE_EDIT_PERMISSIONS),
  shopManagementController.reorderTemplateImages.bind(shopManagementController)
)

/**
 * 获取已售商品列表（带图片的二手机）
 * GET /api/shop/sold-products
 */
router.get('/sold-products',
  unifiedAuth,
  requireAnyPermission(H5_SOLD_PRODUCTS_VIEW_PERMISSIONS),
  shopManagementController.getSoldProducts.bind(shopManagementController)
)

/**
 * 删除商品所有图片
 * DELETE /api/shop/products/:id/images
 */
router.delete('/products/:id/images',
  unifiedAuth,
  requireAnyPermission(H5_SOLD_PRODUCTS_DELETE_PERMISSIONS),
  shopManagementController.deletePhoneImages.bind(shopManagementController)
)

module.exports = router
