'use strict'

const path = require('node:path')
const RentalFileService = require('../services/rental-file.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

class RentalFileController {
  constructor({ service = new RentalFileService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async downloadContractFile(req, res) {
    try {
      const file = await this.service.getContractFile(Number(req.params.id), Number(req.params.fileId))
      if (!file) return this.response.notFound(res, '合同备份不存在')
      return res.download(file.filePath, path.basename(file.fileName || file.filePath))
    } catch (error) {
      if (error.code === 'ENOENT') return this.response.notFound(res, '合同文件不存在')
      this.logger.error('下载合同备份失败:', error)
      return this.response.serverError(res, '下载合同备份失败', error)
    }
  }

  async deleteContractFile(req, res) {
    try {
      const deleted = await this.service.deleteContractFile(Number(req.params.id), Number(req.params.fileId))
      if (!deleted) return this.response.notFound(res, '合同备份不存在')
      return this.response.success(res, null, '合同备份已删除')
    } catch (error) {
      this.logger.error('删除租赁合同文件失败:', error)
      return this.response.serverError(res, '删除合同备份失败', error)
    }
  }

  async uploadContractFiles(req, res) {
    try {
      const uploaded = await this.service.uploadContractFiles(Number(req.params.id), req.user.id, req.files || [])
      if (!uploaded) return this.response.notFound(res, '租赁合同不存在')
      return this.response.created(res, '合同备份上传成功', uploaded)
    } catch (error) {
      this.logger.error('上传租赁合同文件失败:', error)
      return this.response.serverError(res, '合同备份上传失败', error)
    }
  }
}

module.exports = RentalFileController
