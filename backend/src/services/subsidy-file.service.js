'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { getUploadsRoot } = require('../utils/upload-paths')
const { normalizeSubsidyPhotoPath } = require('../utils/subsidy-protected-photo-url')

class SubsidyFileService {
  constructor({ fileSystem = fs, uploadsRoot = getUploadsRoot } = {}) {
    this.fileSystem = fileSystem
    this.uploadsRoot = uploadsRoot
  }

  getFilePath(requestedPath) {
    const relativePath = normalizeSubsidyPhotoPath(`/uploads/${requestedPath}`)
    if (!relativePath) {
      throw Object.assign(new Error('无效的文件路径'), { statusCode: 400 })
    }

    const uploadsRoot = path.resolve(this.uploadsRoot())
    const absolutePath = path.resolve(uploadsRoot, relativePath)
    const pathFromRoot = path.relative(uploadsRoot, absolutePath)
    if (!pathFromRoot || pathFromRoot.startsWith('..') || path.isAbsolute(pathFromRoot)) {
      throw Object.assign(new Error('禁止访问该文件'), { statusCode: 403 })
    }

    if (!this.fileSystem.existsSync(absolutePath)) {
      throw Object.assign(new Error('文件不存在'), { statusCode: 404 })
    }

    return absolutePath
  }
}

module.exports = SubsidyFileService
