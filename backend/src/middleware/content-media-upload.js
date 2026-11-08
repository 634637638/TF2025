'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const multer = require('multer')
const ApiResponse = require('../utils/response')
const { getUploadSubdir } = require('../utils/upload-paths')

const uploadDir = getUploadSubdir('content-media')
fs.mkdirSync(uploadDir, { recursive: true })

const allowedExtensions = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.mp4', '.mov', '.webm', '.ogg'
])

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
      return callback(new Error('只支持常见图片或视频格式'))
    }
    return callback(null, true)
  }
})

const receiveContentMediaFile = (req, res, next) => upload.single('file')(req, res, error => {
  if (error) return ApiResponse.error(res, error.message || '媒体上传失败', 400)
  return next()
})

module.exports = receiveContentMediaFile
