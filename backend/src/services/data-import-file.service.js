'use strict'

const fs = require('fs')
const path = require('path')
const { getUploadSubdir } = require('../utils/upload-paths')
const { validateSpreadsheetFile } = require('../utils/spreadsheet-security')

const FILE_TOKEN_TTL = 30 * 60 * 1000

class DataImportFileService {
  constructor({
    importDirectory = getUploadSubdir('import'),
    validateFile = validateSpreadsheetFile,
    fileSystem = fs,
    now = Date.now,
    tokenTtl = FILE_TOKEN_TTL
  } = {}) {
    this.importDirectory = importDirectory
    this.validateFile = validateFile
    this.fileSystem = fileSystem
    this.now = now
    this.tokenTtl = tokenTtl
    this.fileTokens = new Map()
  }

  register(fileToken, userId) {
    this.fileTokens.set(fileToken, { userId: String(userId), createdAt: this.now() })
  }

  remove(fileToken) {
    this.fileTokens.delete(path.basename(String(fileToken || '')))
  }

  validateUploadedFile(filePath) {
    return this.validateFile(filePath, { rootPath: this.importDirectory })
  }

  resolve(fileToken, userId) {
    const now = this.now()
    for (const [token, metadata] of this.fileTokens.entries()) {
      if (now - metadata.createdAt > this.tokenTtl) this.fileTokens.delete(token)
    }

    if (typeof fileToken !== 'string' || !fileToken.trim()) {
      throw this.createError('文件令牌无效')
    }
    const token = path.basename(fileToken.trim())
    if (token !== fileToken.trim() || token.includes('..')) {
      throw this.createError('文件令牌无效')
    }

    const metadata = this.fileTokens.get(token)
    if (!metadata || now - metadata.createdAt > this.tokenTtl) {
      this.fileTokens.delete(token)
      throw this.createError('文件令牌已过期或不存在', 404)
    }
    if (String(userId) !== metadata.userId) {
      throw this.createError('无权访问该导入文件', 403)
    }

    const safePath = this.validateFile(path.join(this.importDirectory, token), { rootPath: this.importDirectory })
    if (!this.fileSystem.existsSync(safePath)) {
      this.fileTokens.delete(token)
      throw this.createError('导入文件不存在', 404)
    }
    return safePath
  }

  createError(message, statusCode = 400) {
    const error = new Error(message)
    error.statusCode = statusCode
    return error
  }
}

module.exports = DataImportFileService
