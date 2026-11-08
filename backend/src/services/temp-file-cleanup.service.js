const fs = require('fs')
const path = require('path')
const log = require('../utils/log')
const {
  getUploadsRoot,
  getUploadPathFromUrl,
  getRelativeUploadPathFromUrl
} = require('../utils/upload-paths')

const MAX_TEMP_FILE_AGE_MS = 2 * 60 * 60 * 1000

class TempFileCleanupService {
  constructor({
    filesystem = fs,
    getRoot = getUploadsRoot,
    resolveFilePath = getUploadPathFromUrl,
    getRelativePath = getRelativeUploadPathFromUrl,
    logger = log,
    now = Date.now
  } = {}) {
    this.filesystem = filesystem
    this.getRoot = getRoot
    this.resolveFilePath = resolveFilePath
    this.getRelativePath = getRelativePath
    this.logger = logger
    this.now = now
  }

  async deleteTempFiles(files) {
    const deletedFiles = []
    const failedFiles = []

    for (const fileUrl of files) {
      try {
        const relativePath = this.getRelativePath(fileUrl)
        const uploadsRoot = this.getRoot()
        const filePath = this.resolveFilePath(fileUrl)
        const relativeToUploads = path.relative(uploadsRoot, filePath)
        if (!relativeToUploads || relativeToUploads.startsWith('..') || path.isAbsolute(relativeToUploads)) {
          this.logger.warn(`安全警告：尝试删除上传目录外的文件: ${filePath}`)
          failedFiles.push(fileUrl)
          continue
        }

        if (!this.filesystem.existsSync(filePath)) {
          this.logger.warn(`临时文件不存在: ${filePath}`)
          continue
        }

        const stats = this.filesystem.statSync(filePath)
        if (!stats.isFile() || this.now() - stats.mtimeMs > MAX_TEMP_FILE_AGE_MS) {
          this.logger.warn(`拒绝删除非近期临时文件: ${relativePath}`)
          failedFiles.push(fileUrl)
          continue
        }

        this.filesystem.unlinkSync(filePath)
        deletedFiles.push(relativePath)
        await this.removeEmptyDirectories(filePath, uploadsRoot, relativePath)
        this.logger.debug(`已删除临时文件: ${relativePath}`)
      } catch (error) {
        this.logger.error(`删除临时文件失败: ${fileUrl}`, error.message)
        failedFiles.push(fileUrl)
      }
    }

    return { deletedFiles, failedFiles }
  }

  async removeEmptyDirectories(filePath, uploadsRoot, relativePath) {
    const topLevelDirectory = path.resolve(uploadsRoot, String(relativePath).split('/')[0])
    let currentDirectory = path.dirname(filePath)

    while (
      currentDirectory !== topLevelDirectory &&
      currentDirectory.startsWith(`${topLevelDirectory}${path.sep}`)
    ) {
      try {
        const entries = await this.filesystem.promises.readdir(currentDirectory)
        if (entries.length > 0) break
        await this.filesystem.promises.rmdir(currentDirectory)
        currentDirectory = path.dirname(currentDirectory)
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.warn(`清理空临时目录失败: ${currentDirectory}`, error.message)
        }
        break
      }
    }
  }
}

module.exports = TempFileCleanupService
