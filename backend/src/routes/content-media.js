'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const multer = require('multer')
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const { getUploadSubdir, getUploadUrl } = require('../utils/upload-paths')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')

const router = express.Router()
const uploadDir = getUploadSubdir('content-media')
fs.mkdirSync(uploadDir, { recursive: true })
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.mp4', '.mov', '.webm', '.ogg'])
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) return callback(new Error('只支持常见图片或视频格式'))
    callback(null, true)
  }
})

router.post('/', unifiedAuth, requireAnyPermission(['system:edit', 'guide:edit']), (req, res) => {
  upload.single('file')(req, res, async error => {
    if (error) return ApiResponse.error(res, error.message || '媒体上传失败', 400)
    if (!req.file) return ApiResponse.error(res, '请选择图片或视频', 400)
    try {
      if (!(await validateUploadedFileSignature(req.file, ['image', 'video']))) {
        await removeUploadedFiles([req.file])
        return ApiResponse.error(res, '文件内容与图片或视频格式不匹配', 400)
      }
      return ApiResponse.success(res, {
        url: getUploadUrl('content-media', req.file.filename),
        name: path.basename(req.file.originalname),
        mime: req.file.mimetype
      }, '媒体上传成功')
    } catch (validationError) {
      await removeUploadedFiles([req.file])
      return ApiResponse.error(res, validationError.message || '媒体上传失败', 400)
    }
  })
})

module.exports = router
