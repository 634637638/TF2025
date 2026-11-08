'use strict'

const path = require('path')
const fs = require('fs/promises')
const { isConnected } = require('../config/database')
const BrandImageRepository = require('../repositories/brand-image.repository')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const {
  getUploadSubdir,
  getUploadUrl,
  getUploadPathFromUrl,
  getRelativeUploadPathFromUrl
} = require('../utils/upload-paths')
const log = require('../utils/log')

class BrandImageService {
  constructor({
    repository = new BrandImageRepository(),
    connected = isConnected,
    fileSystem = fs,
    resolveUploadSubdir = getUploadSubdir,
    uploadUrl = getUploadUrl,
    uploadPathFromUrl = getUploadPathFromUrl,
    relativePathFromUrl = getRelativeUploadPathFromUrl,
    validateFileSignature = validateUploadedFileSignature,
    removeFiles = removeUploadedFiles,
    now = Date.now,
    logger = log
  } = {}) {
    this.repository = repository
    this.connected = connected
    this.fileSystem = fileSystem
    this.resolveUploadSubdir = resolveUploadSubdir
    this.uploadUrl = uploadUrl
    this.uploadPathFromUrl = uploadPathFromUrl
    this.relativePathFromUrl = relativePathFromUrl
    this.validateFileSignature = validateFileSignature
    this.removeFiles = removeFiles
    this.now = now
    this.logger = logger
  }

  isConnected() {
    return this.connected()
  }

  async upload(file) {
    if (!(await this.validateFileSignature(file, ['image']))) {
      await this.removeFiles([file])
      const error = new Error('文件内容与图片格式不匹配')
      error.statusCode = 400
      throw error
    }

    if (!this.isConnected()) {
      await this.removeFiles([file])
      const error = new Error('数据库未连接')
      error.statusCode = 500
      throw error
    }

    let uploadedPath = file.path
    try {
      const brandDirectory = this.resolveUploadSubdir('brand')
      try {
        await this.fileSystem.access(brandDirectory)
      } catch {
        await this.fileSystem.mkdir(brandDirectory, { recursive: true })
      }

      const oldLogoUrl = await this.repository.getCurrentLogoUrl()
      const extension = path.extname(file.originalname || '')
      const filename = `brand_${this.now()}${extension}`
      const destinationPath = this.resolveUploadSubdir('brand', filename)
      await this.fileSystem.rename(file.path, destinationPath)
      uploadedPath = destinationPath

      const fileUrl = this.uploadUrl('brand', filename)
      await this.repository.saveCurrentLogoUrl(fileUrl)

      if (oldLogoUrl && oldLogoUrl !== fileUrl) {
        try {
          await this.fileSystem.unlink(this.uploadPathFromUrl(oldLogoUrl))
        } catch (error) {
          if (error.code !== 'ENOENT') this.logger.warn('删除旧Logo失败:', error.message)
        }
      }

      return { url: fileUrl, filename, size: file.size }
    } catch (error) {
      await this.removeFiles([{ path: uploadedPath }]).catch(() => {})
      throw error
    }
  }

  async cleanupUnreferencedFiles() {
    const validRows = await this.repository.listReferencedPaths()
    const validPaths = new Set(validRows.map(row => this.relativePathFromUrl(row.filepath)))
    const brandDirectory = this.resolveUploadSubdir('brand')

    try {
      await this.fileSystem.access(brandDirectory)
      const files = await this.fileSystem.readdir(brandDirectory)
      let deletedFiles = 0

      for (const file of files) {
        const filePath = this.resolveUploadSubdir('brand', file)
        const relativeFilePath = path.join('brand', file).replace(/\\/g, '/')
        if (validPaths.has(relativeFilePath)) continue

        try {
          await this.fileSystem.unlink(filePath)
          deletedFiles++
        } catch (error) {
          this.logger.warn('删除文件失败:', filePath, error.message)
        }
      }

      return {
        deletedFiles,
        message: `已清理 ${deletedFiles} 个无用文件`
      }
    } catch {
      return { deletedFiles: 0, message: '品牌图片目录不存在或为空' }
    }
  }

  async getManagementInfo() {
    const currentImage = await this.repository.getCurrentLogoUrl()
    let databaseRecords = []
    try {
      databaseRecords = await this.repository.listImageRecords()
    } catch (error) {
      this.logger.warn('读取brand_images表失败:', error.message)
    }

    const physicalFiles = []
    try {
      const brandDirectory = this.resolveUploadSubdir('brand')
      await this.fileSystem.access(brandDirectory)
      const files = await this.fileSystem.readdir(brandDirectory, { withFileTypes: true })

      for (const file of files) {
        if (!file.isFile()) continue

        const filePath = this.resolveUploadSubdir('brand', file.name)
        const relativeFilePath = path.join('brand', file.name).replace(/\\/g, '/')
        const stats = await this.fileSystem.stat(filePath)
        physicalFiles.push({
          name: file.name,
          path: relativeFilePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isCurrent: currentImage === this.uploadUrl('brand', file.name)
            || this.relativePathFromUrl(currentImage) === relativeFilePath
        })
      }
    } catch (error) {
      this.logger.warn('无法读取品牌图片目录:', error.message)
    }

    return {
      currentImage: currentImage || null,
      databaseRecords,
      physicalFiles,
      totalFiles: physicalFiles.length,
      totalSize: physicalFiles.reduce((sum, file) => sum + file.size, 0)
    }
  }
}

module.exports = BrandImageService
