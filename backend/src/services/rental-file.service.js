'use strict'

const { resolveStoreScope, assertStoreInScope } = require('../utils/store-scope')

const RentalFileRepository = require('../repositories/rental-file.repository')
const RentalUpdateService = require('./rental-update.service')
const fs = require('node:fs')
const { ensureRentalSchema } = require('../utils/rental-schema')
const { getUploadPathFromUrl, getUploadUrl } = require('../utils/upload-paths')
const { withConnection } = require('../core/db/connection')
const { removeUploadedFiles } = require('../utils/upload-file-validation')
const log = require('../utils/log')

class RentalFileService {
  constructor({ access = new RentalUpdateService(), repository = new RentalFileRepository(), ensureSchema = ensureRentalSchema, resolveUploadPath = getUploadPathFromUrl, createUploadUrl = getUploadUrl, fileSystem = fs, removeFiles = removeUploadedFiles, databaseProvider = require('../config/database').getDatabase, connectionRunner = withConnection, logger = log } = {}) {
    this.access = access
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

  async getContractFile(rentalId, fileId, actor) {
    await this.ensureSchema()
    const file = await this.repository.findContractFile(rentalId, fileId)
    if (!file) return null
    assertStoreInScope(resolveStoreScope(actor), file.store_id)
    return {
      filePath: this.resolveUploadPath(file.file_url),
      fileName: file.file_name
    }
  }

  async mutateContract(rentalId, actor, mutate) {
    await this.access.assertEditAccess(actor)
    await this.ensureSchema()
    return this.connectionRunner(this.databaseProvider, async connection => {
      await connection.beginTransaction()
      try {
        const rental = await this.repository.findRentalForUpdate(connection, rentalId)
        if (!rental) throw Object.assign(new Error('租赁合同不存在'), { statusCode: 404 })
        await this.access.assertEditAccess(actor, rental)
        const result = await mutate(connection)
        await connection.commit()
        return result
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async deleteContractFile(rentalId, fileId, actor) {
    const file = await this.mutateContract(rentalId, actor,
      connection => this.repository.deleteContractFile(connection, rentalId, fileId))
    if (!file) return false
    try {
      this.fileSystem.unlinkSync(this.resolveUploadPath(file.file_url))
    } catch (error) {
      this.logger.warn('清理租赁合同文件失败:', error)
    }
    return true
  }

  async uploadContractFiles(rentalId, actor, files) {
    try {
      return await this.mutateContract(rentalId, actor, connection =>
        this.repository.insertContractFiles(connection, rentalId, actor.id, files.map(file => ({
          fileUrl: this.createUploadUrl('rentals', 'contracts', file.filename),
          fileName: file.originalname
        }))))
    } catch (error) {
      await this.removeFiles(files)
      throw error
    }
  }
}

module.exports = RentalFileService
