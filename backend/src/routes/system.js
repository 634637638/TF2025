const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const DatabaseConnectionController = require('../controllers/database-connection.controller')
const BrandSettingsController = require('../controllers/brand-settings.controller')
const BrandImageController = require('../controllers/brand-image.controller')
const SiteSettingsController = require('../controllers/site-settings.controller')
const SiteAnnouncementController = require('../controllers/site-announcement.controller')
const _mysql = require('mysql2/promise')
const multer = require('multer')
const path = require('path')
const {
  getUploadSubdir
} = require('../utils/upload-paths')
const SystemHealthController = require('../controllers/system-health.controller')
const databaseConnectionController = new DatabaseConnectionController()
const brandSettingsController = new BrandSettingsController()
const brandImageController = new BrandImageController()
const siteSettingsController = new SiteSettingsController()
const siteAnnouncementController = new SiteAnnouncementController()
const systemHealthController = new SystemHealthController()

const BRAND_IMAGE_ALLOWED_MIME_TYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.ico': [
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'application/vnd.microsoft.icon',
    'application/x-ico',
    'image/ico',
    'application/octet-stream'
  ]
}

const BRAND_IMAGE_ALLOWED_LABEL = 'JPG、PNG、GIF、ICO'

// 测试数据库连接
router.get('/test-db-connection', unifiedAuth, requirePermission('system:view'), databaseConnectionController.testConnection.bind(databaseConnectionController))

// 获取数据库状态
router.get('/db-status', unifiedAuth, requirePermission('system:view'), databaseConnectionController.getStatus.bind(databaseConnectionController))

// 重新连接数据库
router.post('/reconnect-db', unifiedAuth, requirePermission('system:edit'), databaseConnectionController.reconnect.bind(databaseConnectionController))

// 获取系统统计数据
router.get('/stats', unifiedAuth, requirePermission('system:view'), systemHealthController.getStats.bind(systemHealthController))

// 获取系统状态
router.get('/status', unifiedAuth, requirePermission('system:view'), systemHealthController.getStatus.bind(systemHealthController))

// 配置文件上传
const upload = multer({
  dest: getUploadSubdir('brand'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase()
    const allowedMimeTypes = BRAND_IMAGE_ALLOWED_MIME_TYPES[extension]
    const mimeType = String(file.mimetype || '').toLowerCase()

    if (!allowedMimeTypes) {
      cb(new Error(`仅支持 ${BRAND_IMAGE_ALLOWED_LABEL} 格式`), false)
      return
    }

    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      cb(new Error(`文件 MIME 类型不支持: ${mimeType}`), false)
      return
    }

    cb(null, true)
  }
})

// 获取品牌设置
router.get('/brand-settings', unifiedAuth, requirePermission('system:view'), brandSettingsController.getCurrent.bind(brandSettingsController))

// 保存品牌设置
router.post('/brand-settings', unifiedAuth, requirePermission('system:edit'), brandSettingsController.saveCurrent.bind(brandSettingsController))

// 上传品牌图片
router.post('/upload-brand-image', unifiedAuth, requirePermission('system:edit'), upload.single('image'), brandImageController.upload.bind(brandImageController))

// 清理无用的品牌图片文件
router.post('/cleanup-brand-images', unifiedAuth, requirePermission('system:delete'), brandImageController.cleanup.bind(brandImageController))

// 获取品牌图片管理信息
router.get('/brand-images-info', unifiedAuth, requirePermission('system:view'), brandImageController.getInfo.bind(brandImageController))

// 获取站点信息设置（使用现有的settings表）
router.get('/site-settings', siteSettingsController.getPublic.bind(siteSettingsController))

// 管理后台读取完整站点设置；公开路由只返回展示和公开报价所需字段。
router.get('/site-settings/admin', unifiedAuth, requirePermission('system:view'), siteSettingsController.getAdmin.bind(siteSettingsController))

router.get('/announcements', unifiedAuth, siteAnnouncementController.listPublished.bind(siteAnnouncementController))
router.get('/announcements/admin', unifiedAuth, requirePermission('system:view'), siteAnnouncementController.listAdmin.bind(siteAnnouncementController))
router.post('/announcements', unifiedAuth, requirePermission('system:edit'), siteAnnouncementController.create.bind(siteAnnouncementController))
router.put('/announcements/:id', unifiedAuth, requirePermission('system:edit'), siteAnnouncementController.update.bind(siteAnnouncementController))
router.delete('/announcements/:id', unifiedAuth, requirePermission('system:delete'), siteAnnouncementController.remove.bind(siteAnnouncementController))

// 保存站点信息设置（使用现有的settings表）
router.post('/site-settings', unifiedAuth, requirePermission('system:edit'), siteSettingsController.save.bind(siteSettingsController))

module.exports = router
