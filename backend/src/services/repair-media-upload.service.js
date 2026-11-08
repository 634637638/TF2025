'use strict'

const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')

const requestError = message => Object.assign(new Error(message), { statusCode: 400, code: 'BAD_REQUEST' })

class RepairMediaUploadService {
  constructor({ validateFile = validateUploadedFileSignature, removeFiles = removeUploadedFiles, buildMediaUrl, mediaTypeFromUrl } = {}) {
    if (typeof validateFile !== 'function') throw new TypeError('RepairMediaUploadService requires validateFile')
    if (typeof removeFiles !== 'function') throw new TypeError('RepairMediaUploadService requires removeFiles')
    if (typeof buildMediaUrl !== 'function') throw new TypeError('RepairMediaUploadService requires buildMediaUrl')
    if (typeof mediaTypeFromUrl !== 'function') throw new TypeError('RepairMediaUploadService requires mediaTypeFromUrl')
    this.validateFile = validateFile
    this.removeFiles = removeFiles
    this.buildMediaUrl = buildMediaUrl
    this.mediaTypeFromUrl = mediaTypeFromUrl
  }

  async upload(files, userId) {
    const uploads = Array.isArray(files) ? files : []
    if (!uploads.length) throw requestError('请选择图片或视频')

    const valid = await Promise.all(uploads.map(file => this.validateFile(file, ['image', 'video'])))
    if (valid.some(item => !item)) {
      await this.removeFiles(uploads)
      throw requestError('文件内容与图片或视频格式不匹配')
    }

    return {
      files: uploads.map(file => ({
        url: this.buildMediaUrl(`temp/${file.filename}`, userId),
        name: file.originalname,
        type: file.mimetype || this.mediaTypeFromUrl(file.filename),
        size: file.size
      }))
    }
  }

  async removeUploadedFiles(files) {
    return this.removeFiles(Array.isArray(files) ? files : [])
  }
}

module.exports = RepairMediaUploadService
