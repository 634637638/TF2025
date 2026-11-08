'use strict'

const path = require('node:path')
const ApiResponse = require('../utils/response')
const { getUploadUrl } = require('../utils/upload-paths')
const {
  validateUploadedFileSignature,
  removeUploadedFiles
} = require('../utils/upload-file-validation')

class ContentMediaController {
  constructor({
    validateFileSignature = validateUploadedFileSignature,
    removeFiles = removeUploadedFiles,
    createUploadUrl = getUploadUrl
  } = {}) {
    this.validateFileSignature = validateFileSignature
    this.removeFiles = removeFiles
    this.createUploadUrl = createUploadUrl
  }

  async upload(req, res) {
    if (!req.file) {
      return ApiResponse.error(res, '请选择图片或视频', 400)
    }

    try {
      if (!(await this.validateFileSignature(req.file, ['image', 'video']))) {
        await this.removeFiles([req.file])
        return ApiResponse.error(res, '文件内容与图片或视频格式不匹配', 400)
      }

      return ApiResponse.success(res, {
        url: this.createUploadUrl('content-media', req.file.filename),
        name: path.basename(req.file.originalname),
        mime: req.file.mimetype
      }, '媒体上传成功')
    } catch (validationError) {
      await this.removeFiles([req.file])
      return ApiResponse.error(res, validationError.message || '媒体上传失败', 400)
    }
  }
}

module.exports = ContentMediaController
