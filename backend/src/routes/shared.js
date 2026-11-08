'use strict'

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const { getUploadSubdir } = require('../utils/upload-paths')
const log = require('../utils/log')
const SharedController = require('../controllers/shared.controller')

const router = express.Router()
const uploadDir = getUploadSubdir('shared')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const imageExtensions = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.bmp', '.avif',
  '.heic', '.heif', '.tif', '.tiff'
])
const allowedExtensions = new Set([
  ...imageExtensions, '.mp4', '.webm', '.mov',
  '.pdf', '.ofd', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx',
  '.wps', '.et', '.dps', '.txt', '.md', '.rtf', '.log', '.json', '.xml',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.epub',
  '.mp3', '.wav', '.m4a', '.aac', '.flac'
])
const allowedMimePrefixes = ['image/', 'video/', 'audio/']
const allowedMimes = new Set([
  'application/pdf', 'application/ofd',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/kswps', 'application/kset', 'application/ksdps',
  'application/vnd.ms-works', 'application/x-wps', 'application/x-et', 'application/x-dps',
  'text/plain', 'text/csv', 'application/csv', 'text/markdown', 'text/rtf', 'application/rtf',
  'application/json', 'application/xml', 'text/xml',
  'application/zip', 'application/x-zip-compressed', 'application/vnd.rar',
  'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar',
  'application/gzip', 'application/x-gzip', 'application/x-bzip2', 'application/epub+zip',
  'application/octet-stream'
])
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase()
    callback(null, `${Number(req.user?.id) || 0}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`)
  }
})
const isAllowedUpload = file => {
  const ext = path.extname(file.originalname || '').toLowerCase()
  const mime = String(file.mimetype || '').toLowerCase()
  if (!allowedExtensions.has(ext)) return false
  if (imageExtensions.has(ext)) return mime.startsWith('image/') || mime === 'application/octet-stream'
  return allowedMimePrefixes.some(prefix => mime.startsWith(prefix)) || allowedMimes.has(mime)
}
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (isAllowedUpload(file)) return callback(null, true)
    const error = new Error('不支持该文件格式，请上传常用图片、视频、音频或文档文件')
    error.status = 400
    error.code = 'UNSUPPORTED_UPLOAD_TYPE'
    return callback(error)
  }
})

const uploadSharedFiles = (req, res, next) => {
  upload.array('files', 10)(req, res, error => {
    if (!error) return next()
    for (const file of req.files || []) {
      try { fs.unlinkSync(file.path) } catch (cleanupError) {
        log.warn('清理共享上传临时文件失败:', cleanupError)
      }
    }
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') return ApiResponse.error(res, '单个文件不能超过100MB', 400)
      if (error.code === 'LIMIT_FILE_COUNT') return ApiResponse.error(res, '一次最多上传10个文件', 400)
      return ApiResponse.error(res, `上传失败：${error.message}`, 400)
    }
    return ApiResponse.error(res, error.message || '上传文件格式不受支持', 400)
  })
}

const sharedController = new SharedController({ uploadDir })

router.get(
  '/files/:filename',
  sharedController.verifySharedFileAccess.bind(sharedController),
  sharedController.canAccessAttachment.bind(sharedController),
  sharedController.readAttachment.bind(sharedController)
)
router.use(unifiedAuth)
router.get('/', requirePermission('shared:view'), sharedController.list.bind(sharedController))
router.get('/categories', requirePermission('shared:view'), sharedController.listCategories.bind(sharedController))
router.post('/categories', requirePermission('shared:manage'), sharedController.rejectHiddenWrites(SharedController.CATEGORY_WRITE_IDS), sharedController.createCategory.bind(sharedController))
router.put('/categories/:id', requirePermission('shared:manage'), sharedController.rejectHiddenWrites(SharedController.CATEGORY_WRITE_IDS), sharedController.updateCategory.bind(sharedController))
router.delete('/categories/:id', requirePermission('shared:manage'), sharedController.removeCategory.bind(sharedController))
router.get('/:id', requirePermission('shared:view'), sharedController.getById.bind(sharedController))
router.post('/upload', requireAnyPermission(['shared:create', 'shared:edit', 'shared:manage']), sharedController.requireVisibleField('post_info.attachments'), uploadSharedFiles, sharedController.upload.bind(sharedController))
router.post('/uploads/cleanup', requireAnyPermission(['shared:create', 'shared:edit', 'shared:delete', 'shared:manage']), sharedController.cleanupUploads.bind(sharedController))
router.post('/', requirePermission('shared:create'), sharedController.rejectHiddenWrites(SharedController.FIELD_WRITE_IDS), sharedController.create.bind(sharedController))
router.put('/:id', requireAnyPermission(['shared:edit', 'shared:manage']), sharedController.rejectHiddenWrites(SharedController.FIELD_WRITE_IDS), sharedController.update.bind(sharedController))
router.delete('/:id', requireAnyPermission(['shared:delete', 'shared:manage']), sharedController.remove.bind(sharedController))
router.patch('/:id/pin', requirePermission('shared:manage'), sharedController.rejectHiddenWrites({ pinned: 'post_info.is_pinned' }), sharedController.pin.bind(sharedController))

module.exports = router
