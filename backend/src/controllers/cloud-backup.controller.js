'use strict'

const { CloudUploadError } = require('../services/aliyun-drive-client')

class CloudBackupController {
  constructor(service) { this.service = service }

  failure(res, error) {
    return res.status(error.statusCode || (error instanceof CloudUploadError ? 502 : 500)).json({
      success: false, message: error.statusCode || error instanceof CloudUploadError
        ? error.message : '操作失败，请检查后端配置密钥和备份目录权限'
    })
  }

  async connect(req, res) {
    res.set('Cache-Control', 'private, no-store')
    try { return res.json({ success: true, data: await this.service.connect(req.body) }) }
    catch (error) { return this.failure(res, error) }
  }

  accounts(_req, res) {
    res.set('Cache-Control', 'private, no-store')
    try { return res.json({ success: true, data: this.service.getAccounts() }) }
    catch (error) { return this.failure(res, error) }
  }

  saveAccount(req, res) {
    res.set('Cache-Control', 'private, no-store')
    try { return res.json({ success: true, data: this.service.saveAccount(req.body, req.params.accountId) }) }
    catch (error) { return this.failure(res, error) }
  }

  async browse(req, res) {
    res.set('Cache-Control', 'private, no-store')
    try { return res.json({ success: true, data: await this.service.browse(req.query) }) }
    catch (error) { return this.failure(res, error) }
  }

  async drives(req, res) {
    res.set('Cache-Control', 'private, no-store')
    try { return res.json({ success: true, data: await this.service.connect(req.query) }) }
    catch (error) { return this.failure(res, error) }
  }

  async createFolder(req, res) {
    try { return res.status(201).json({ success: true, data: await this.service.createFolder(req.body) }) }
    catch (error) { return this.failure(res, error) }
  }

  async renameFile(req, res) {
    try {
      await this.service.renameFile(req.params.driveId, req.params.fileId, req.body)
      return res.json({ success: true, message: '云盘重命名成功' })
    } catch (error) { return this.failure(res, error) }
  }

  async trashFile(req, res) {
    try {
      await this.service.trashFile(req.params.driveId, req.params.fileId, req.query?.accountId)
      return res.json({ success: true, message: '已移入阿里云盘回收站，本地文件保留' })
    } catch (error) { return this.failure(res, error) }
  }

  async restoreFile(req, res) {
    try {
      await this.service.restoreFile(req.params.driveId, req.params.fileId, req.body?.accountId)
      return res.json({ success: true, message: '云盘文件已恢复' })
    } catch (error) { return this.failure(res, error) }
  }

  async purgeFile(req, res) {
    try {
      await this.service.purgeFile(req.params.driveId, req.params.fileId, req.query?.accountId)
      return res.json({ success: true, message: '云盘文件已彻底删除，本地文件保留' })
    } catch (error) { return this.failure(res, error) }
  }

  settings(_req, res) {
    try {
      res.set('Cache-Control', 'private, no-store')
      return res.json({ success: true, data: this.service.getSettings() })
    } catch { return res.status(500).json({ success: false, message: '读取云盘配置失败' }) }
  }

  saveSettings(req, res) {
    try { return res.json({ success: true, data: this.service.saveSettings(req.body) }) }
    catch (error) { return this.failure(res, error) }
  }

  async testConnection(_req, res) {
    try { return res.json({ success: true, data: await this.service.testConnection() }) }
    catch { return res.status(400).json({ success: false, message: '云盘连接失败，请检查 Token、目录 ID 或等待当前上传完成' }) }
  }

  tasks(_req, res) {
    try {
      res.set('Cache-Control', 'private, no-store')
      this.service.requestStatusRefresh()
      return res.json({ success: true, data: this.service.getTasks(), message: this.service.lastError || '' })
    } catch { return res.status(500).json({ success: false, message: '读取云盘任务失败' }) }
  }

  upload(req, res) {
    try { return res.status(202).json({ success: true, data: this.service.upload(req.params.filename) }) }
    catch (error) {
      if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: '备份文件不存在' })
      return this.failure(res, error)
    }
  }
}

module.exports = CloudBackupController
