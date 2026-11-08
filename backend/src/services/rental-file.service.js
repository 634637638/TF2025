'use strict'

const RentalFileRepository = require('../repositories/rental-file.repository')
const fs = require('node:fs')
const { ensureRentalSchema } = require('../utils/rental-schema')
const { getUploadPathFromUrl, getUploadUrl } = require('../utils/upload-paths')
const { withConnection } = require('../core/db/connection')
const { removeUploadedFiles } = require('../utils/upload-file-validation')
const log = require('../utils/log')

class RentalFileService {
  constructor({ repository = new RentalFileRepository(), ensureSchema = ensureRentalSchema, resolveUploadPath = getUploadPathFromUrl, createUploadUrl = getUploadUrl, fileSystem = fs, removeFiles = removeUploadedFiles, databaseProvider = require('../config/database').getDatabase, connectionRunner = withConnection, logger = log } = {}) {
    this.repository = repository
    this.ensureSchema = ensureSchema
    this.resolveUploadPath = resolveUploadPath
    this.createUploadUrl = createUploadUrl
    this.fileSystem = fileSystem
    this.removeFiles = removeFiles
    this.databaseProvider = databaseProvider
    this.connectionRunner = connectionRunner
    this.logger = logger
  }

  async getContractFile(rentalId, fileId) {
    await this.ensureSchema()
    const file = await this.repository.findContractFile(rentalId, fileId)
    if (!file) return null
    return {
      filePath: this.resolveUploadPath(file.file_url),
      fileName: file.file_name
    }
  }

  async deleteContractFile(rentalId, fileId) {
    await this.ensureSchema()
    const file = await this.repository.deleteContractFile(rentalId, fileId)
    if (!file) return false
    try {
      this.fileSystem.unlinkSync(this.resolveUploadPath(file.file_url))
    } catch (error) {
      this.logger.warn('清理租赁合同文件失败:', error)
    }
    return true
  }

  async uploadContractFiles(rentalId, actorId, files) {
    await this.ensureSchema()
    const exists = await this.repository.rentalExists(rentalId)
    if (!exists) {
      await this.removeFiles(files)
      return null
    }

    try {
      return await this.connectionRunner(this.databaseProvider, async connection => {
        await connection.beginTransaction()
        try {
          const uploaded = await this.repository.insertContractFiles(connection, rentalId, actorId, files.map(file => ({
            fileUrl: this.createUploadUrl('rentals', 'contracts', file.filename),
            fileName: file.originalname
          })))
          await connection.commit()
          return uploaded
        } catch (error) {
          await connection.rollback()
          throw error
        }
      })
    } catch (error) {
      await this.removeFiles(files).catch(() => {})
      throw error
    }
  }
}

module.exports = RentalFileService
