'use strict'

const crypto = require('crypto')
const backupService = require('../services/backup.service')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const log = require('../utils/log')

const DOWNLOAD_TOKEN_TTL_MS = 60 * 1000

class BackupController {
  constructor({
    service = backupService,
    logger = log,
    now = Date.now,
    createToken = () => crypto.randomBytes(24).toString('hex')
  } = {}) {
    this.service = service
    this.logger = logger
    this.now = now
    this.createToken = createToken
    this.downloadTokens = new Map()
  }

  validateFilename(filename) {
    if (!this.service.isValidBackupFilename(filename)) {
      const error = new Error('无效的文件名')
      error.statusCode = 400
      throw error
    }
    return filename
  }

  createDownloadToken({ filename, userId }) {
    const token = this.createToken()
    this.downloadTokens.set(token, {
      filename,
      userId,
      expiresAt: this.now() + DOWNLOAD_TOKEN_TTL_MS
    })
    return token
  }

  validateDownloadToken(token, filename) {
    if (!token || typeof token !== 'string') return false
    const entry = this.downloadTokens.get(token)
    if (!entry) return false
    if (entry.expiresAt < this.now()) {
      this.downloadTokens.delete(token)
      return false
    }
    return entry.filename === filename
  }

  authenticateDownload(req, res, next) {
    const filename = req.params.filename
    const queryToken = typeof req.query.download_token === 'string' ? req.query.download_token.trim() : ''
    if (queryToken) {
      if (!this.validateDownloadToken(queryToken, filename)) {
        return res.status(401).json({
          success: false,
          message: '下载链接已失效，请在 1 分钟内重新获取下载链接'
        })
      }
      return next()
    }
    return unifiedAuth(req, res, () => {
      const permissionMiddleware = requirePermission('backup:view')
      return permissionMiddleware(req, res, next)
    })
  }

  async create(req, res) {
    try {
      const type = req.body?.type || 'full'
      if (!['full', 'database'].includes(type)) {
        return res.status(400).json({ success: false, message: '备份类型无效，请选择 database 或 full' })
      }
      const result = await this.service.createBackup(type)
      return res.json({
        success: true,
        message: type === 'database' ? '数据库备份创建成功' : '完整备份创建成功',
        data: result
      })
    } catch (error) {
      this.logger.error('[Backup] 创建备份失败:', error)
      return res.status(500).json({ success: false, message: '备份创建失败: ' + error.message })
    }
  }

  list(req, res) {
    try {
      const backups = this.service.getBackupList()
      return res.json({ success: true, data: backups, total: backups.length })
    } catch (error) {
      this.logger.error('[Backup] 获取备份列表失败:', error)
      return res.status(500).json({ success: false, message: '获取备份列表失败: ' + error.message })
    }
  }

  remove(req, res) {
    try {
      const filename = this.validateFilename(req.params.filename)
      this.service.deleteBackup(filename)
      return res.json({ success: true, message: '备份删除成功' })
    } catch (error) {
      const statusCode = error.statusCode || 500
      this.logger.error('[Backup] 删除备份失败:', error)
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 400 ? error.message : '删除备份失败: ' + error.message
      })
    }
  }

  cleanup(req, res) {
    try {
      const { keep_count: keepCount = 5 } = req.body
      const result = this.service.cleanOldBackups(keepCount)
      return res.json({ success: true, message: result.message, data: { deleted: result.deleted } })
    } catch (error) {
      this.logger.error('[Backup] 清理备份失败:', error)
      return res.status(500).json({ success: false, message: '清理备份失败: ' + error.message })
    }
  }

  storage(req, res) {
    try {
      const backups = this.service.getBackupList()
      const totalSize = backups.reduce((sum, backup) => sum + backup.size_bytes, 0)
      return res.json({
        success: true,
        data: {
          backup_dir: this.service.getBackupDir(),
          backend_root: this.service.getBackendRoot(),
          total_count: backups.length,
          total_size: this.service.formatFileSize(totalSize),
          total_size_bytes: totalSize
        }
      })
    } catch (error) {
      this.logger.error('[Backup] 获取存储信息失败:', error)
      return res.status(500).json({ success: false, message: '获取存储信息失败: ' + error.message })
    }
  }

  downloadLink(req, res) {
    try {
      const filename = this.validateFilename(req.params.filename)
      const filePath = this.service.getBackupPath(filename)
      if (!filePath) {
        return res.status(404).json({ success: false, message: '备份文件不存在' })
      }
      const token = this.createDownloadToken({ filename, userId: req.user?.id || null })
      return res.json({
        success: true,
        data: { url: `/api/backup/download/${encodeURIComponent(filename)}?download_token=${token}` }
      })
    } catch (error) {
      const statusCode = error.statusCode || 500
      this.logger.error('[Backup] 获取下载链接失败:', error)
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 400 ? error.message : '获取下载链接失败: ' + error.message
      })
    }
  }

  download(req, res) {
    try {
      const filename = this.validateFilename(req.params.filename)
      const filePath = this.service.getBackupPath(filename)
      if (!filePath) {
        return res.status(404).json({ success: false, message: '备份文件不存在' })
      }
      return res.download(filePath, filename, error => {
        if (error) this.logger.error('[Backup] 下载失败:', error)
      })
    } catch (error) {
      const statusCode = error.statusCode || 500
      this.logger.error('[Backup] 下载备份失败:', error)
      return res.status(statusCode).json({
        success: false,
        message: statusCode === 400 ? error.message : '下载备份失败: ' + error.message
      })
    }
  }
}

module.exports = BackupController
