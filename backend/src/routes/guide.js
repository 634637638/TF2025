'use strict'

const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const { getUploadSubdir } = require('../utils/upload-paths')
const { createGuideDraftFilename } = require('../utils/guide-upload')
const GuideAdminController = require('../controllers/guide-admin.controller')

const adminRouter = express.Router()
const uploadDir = getUploadSubdir('guide')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const allowedFileTypes = new Map([
  ['.jpg', new Set(['image/jpeg'])], ['.jpeg', new Set(['image/jpeg'])], ['.png', new Set(['image/png'])],
  ['.gif', new Set(['image/gif'])], ['.webp', new Set(['image/webp'])], ['.bmp', new Set(['image/bmp', 'image/x-ms-bmp'])],
  ['.avif', new Set(['image/avif'])], ['.pdf', new Set(['application/pdf'])], ['.doc', new Set(['application/msword', 'application/octet-stream'])],
  ['.docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'])],
  ['.xls', new Set(['application/vnd.ms-excel', 'application/octet-stream'])],
  ['.xlsx', new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'])],
  ['.ppt', new Set(['application/vnd.ms-powerpoint', 'application/octet-stream'])],
  ['.pptx', new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'])],
  ['.mobileconfig', new Set(['application/x-apple-aspen-config', 'application/xml', 'text/xml', 'application/octet-stream'])],
  ['.apk', new Set(['application/vnd.android.package-archive', 'application/octet-stream'])],
  ['.ipa', new Set(['application/octet-stream', 'application/zip'])],
  ['.mp3', new Set(['audio/mpeg', 'audio/mp3', 'application/octet-stream'])],
  ['.m4a', new Set(['audio/mp4', 'audio/x-m4a', 'application/octet-stream'])],
  ['.wav', new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'])],
  ['.flac', new Set(['audio/flac', 'audio/x-flac', 'application/octet-stream'])],
  ['.ogg', new Set(['audio/ogg', 'application/ogg', 'application/octet-stream'])],
  ['.mp4', new Set(['video/mp4', 'application/octet-stream'])],
  ['.mov', new Set(['video/quicktime', 'application/octet-stream'])],
  ['.avi', new Set(['video/x-msvideo', 'video/avi', 'application/octet-stream'])],
  ['.mkv', new Set(['video/x-matroska', 'application/octet-stream'])],
  ['.webm', new Set(['video/webm', 'application/octet-stream'])],
  ['.3gp', new Set(['video/3gpp', 'application/octet-stream'])],
  ['.txt', new Set(['text/plain', 'application/octet-stream'])], ['.csv', new Set(['text/csv', 'application/csv', 'application/octet-stream'])],
  ['.zip', new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])],
  ['.rar', new Set(['application/vnd.rar', 'application/x-rar-compressed', 'application/octet-stream'])],
  ['.7z', new Set(['application/x-7z-compressed', 'application/octet-stream'])]
])
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (req, file, callback) => {
    try {
      callback(null, createGuideDraftFilename(path.extname(file.originalname).toLowerCase(), req.user?.id))
    } catch (error) {
      callback(error)
    }
  }
})
const guideFileUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase()
    const allowedMimeTypes = allowedFileTypes.get(extension)
    if (allowedMimeTypes?.has(String(file.mimetype || '').toLowerCase())) return callback(null, true)
    const error = new Error('文件格式不支持，请上传图片、音频、视频、APK、Office 文档、文本或压缩文件')
    error.status = 400
    callback(error)
  }
})

adminRouter.use(unifiedAuth)

const guideAdminController = new GuideAdminController({
  uploadDir,
  allowedFileTypes,
  fileUpload: guideFileUpload
})

adminRouter.get('/', requirePermission('guide:view'), guideAdminController.list.bind(guideAdminController))
adminRouter.put('/settings', requirePermission('guide:edit'), guideAdminController.updateSettings.bind(guideAdminController))
adminRouter.post('/announcements', requirePermission('guide:create'), guideAdminController.createAnnouncement.bind(guideAdminController))
adminRouter.put('/announcements/:id', requirePermission('guide:edit'), guideAdminController.updateAnnouncement.bind(guideAdminController))
adminRouter.delete('/announcements/:id', requirePermission('guide:delete'), guideAdminController.deleteAnnouncement.bind(guideAdminController))
adminRouter.post('/categories', requirePermission('guide:create'), guideAdminController.createCategory.bind(guideAdminController))
adminRouter.put('/categories/:id', requirePermission('guide:edit'), guideAdminController.updateCategory.bind(guideAdminController))
adminRouter.delete('/categories/:id', requirePermission('guide:delete'), guideAdminController.deleteCategory.bind(guideAdminController))
adminRouter.post('/categories/:id/links', requirePermission('guide:create'), guideAdminController.createLink.bind(guideAdminController))
adminRouter.put('/links/:id', requirePermission('guide:edit'), guideAdminController.updateLink.bind(guideAdminController))
adminRouter.delete('/links/:id', requirePermission('guide:delete'), guideAdminController.deleteLink.bind(guideAdminController))

adminRouter.get('/links/:id/preview', requirePermission('guide:view'), guideAdminController.previewLink.bind(guideAdminController))
adminRouter.get('/links/:id/download', requirePermission('guide:view'), guideAdminController.downloadLink.bind(guideAdminController))
adminRouter.post('/upload/file', requirePermission('guide:upload'), guideAdminController.uploadFile.bind(guideAdminController))
adminRouter.get('/upload/preview/:filename', requirePermission('guide:view'), guideAdminController.previewUploadedFile.bind(guideAdminController))

module.exports = { adminRouter }
