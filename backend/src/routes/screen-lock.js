/**
 * 屏幕保护设置 API 路由
 * 处理屏幕锁定功能的配置管理
 */

const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const crypto = require('crypto')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const ScreenLockController = require('../controllers/screen-lock.controller')
const { getUploadSubdir } = require('../utils/upload-paths')
const screenLockController = new ScreenLockController()

// 存储配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = getUploadSubdir('screen-lock')
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex')
    const ext = path.extname(file.originalname)
    const isImage = file.mimetype.startsWith('image/')
    const fileType = isImage ? 'image' : 'video'
    cb(null, `screen-lock-${fileType}-${uniqueSuffix}${ext}`)
  }
})

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 图片文件检查
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  // 视频文件检查
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg']
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('只支持 JPEG、PNG、GIF、WebP 格式的图片和 MP4、WebM、OGG 格式的视频'), false)
  }
}

// 上传配置
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  }
})

// 获取屏幕锁定设置（仅背景设置）
router.get('/', unifiedAuth, screenLockController.getSettings.bind(screenLockController))

// 更新系统背景设置
router.post('/', unifiedAuth, requirePermission('system:edit'), screenLockController.updateSettings.bind(screenLockController))

// 统一文件上传路由 (兼容 /api/v1/upload/screen-lock)
router.post('/upload/screen-lock',
  unifiedAuth,
  requirePermission('system:edit'),
  upload.single('file'),
  screenLockController.uploadBackgroundFile.bind(screenLockController)
)


// 验证解锁密码（使用登录密码）
router.post('/verify', unifiedAuth, screenLockController.verifyLoginPassword.bind(screenLockController))

// 获取在库查询用户列表（系统设置编辑权限）
router.get('/query-users', unifiedAuth, requirePermission('system:edit'), screenLockController.listQueryUsers.bind(screenLockController))

// 添加在库查询用户（系统设置编辑权限）
router.post('/query-users', unifiedAuth, requirePermission('system:edit'), screenLockController.createQueryUser.bind(screenLockController))

// 更新在库查询用户（系统设置编辑权限）
router.put('/query-users/:id', unifiedAuth, requirePermission('system:edit'), screenLockController.updateQueryUser.bind(screenLockController))

// 删除在库查询用户（系统设置删除权限）
router.delete('/query-users/:id', unifiedAuth, requirePermission('system:delete'), screenLockController.deleteQueryUser.bind(screenLockController))

// 验证在库查询密码（无需登录，使用多密码验证）
router.post('/verify-inventory-query', screenLockController.verifyInventoryQueryPassword.bind(screenLockController))

// 删除上传的文件
router.delete('/upload/screen-lock/:filename',
  unifiedAuth,
  requirePermission('system:delete'),
  screenLockController.deleteBackgroundFile.bind(screenLockController)
)

module.exports = router
