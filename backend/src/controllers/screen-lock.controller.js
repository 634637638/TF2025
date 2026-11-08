'use strict'

const bcrypt = require('bcryptjs')
const fs = require('fs').promises
const { getDatabase, isConnected } = require('../config/database')
const ApiResponse = require('../utils/response')
const { createInventoryQueryToken } = require('../utils/inventory-query-token')
const log = require('../utils/log')
const { getUploadSubdir, getUploadUrl } = require('../utils/upload-paths')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const ScreenLockService = require('../services/screen-lock.service')
const { ScreenLockSettingsService, sanitizeSystemSettings } = require('../services/screen-lock-settings.service')

class ScreenLockController {
  constructor({
    settingsService = new ScreenLockSettingsService(),
    repository,
    service,
    getDatabase: getDatabaseConnection = getDatabase,
    isConnected: databaseIsConnected = isConnected,
    passwordVerifier = bcrypt.compare,
    passwordHasher = bcrypt.hash,
    response = ApiResponse,
    createQueryToken = createInventoryQueryToken,
    uploadDirectory = getUploadSubdir,
    uploadUrl = getUploadUrl,
    validateFileSignature = validateUploadedFileSignature,
    removeFiles = removeUploadedFiles,
    fileSystem = fs,
    logger = log
  } = {}) {
    this.settingsService = settingsService
    this.service = service || new ScreenLockService({ database: getDatabaseConnection, repository, passwordVerifier, passwordHasher })
    this.isConnected = databaseIsConnected
    this.response = response
    this.createQueryToken = createQueryToken
    this.uploadDirectory = uploadDirectory
    this.uploadUrl = uploadUrl
    this.validateFileSignature = validateFileSignature
    this.removeFiles = removeFiles
    this.fileSystem = fileSystem
    this.logger = logger
  }

  async getSettings(_req, res) {
    try {
      const settings = await this.settingsService.load()
      return res.json({ success: true, data: settings, message: '获取屏幕锁定设置成功' })
    } catch (error) {
      this.logger.error('获取屏幕锁定设置失败:', error)
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取设置失败' }
      })
    }
  }

  async updateSettings(req, res) {
    try {
      const { backgroundType, imageUrl, videoUrl, title, message } = req.body
      const validBackgroundTypes = ['default', 'image', 'video']
      if (backgroundType && !validBackgroundTypes.includes(backgroundType)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '无效的背景类型' }
        })
      }

      const settings = sanitizeSystemSettings({
        backgroundType: backgroundType || 'default',
        imageUrl: imageUrl || '',
        videoUrl: videoUrl || '',
        title: title || '屏幕已锁定',
        message: message || '请输入密码解锁'
      })
      if (await this.settingsService.save(settings)) {
        return res.json({ success: true, data: settings, message: '屏幕锁定设置保存成功' })
      }
      throw new Error('保存设置失败')
    } catch (error) {
      this.logger.error('保存屏幕锁定设置失败:', error)
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '保存设置失败' }
      })
    }
  }

  async verifyLoginPassword(req, res) {
    try {
      const { password } = req.body
      const userId = req.user.sub || req.user.id || req.user.userId
      this.logger.debug('开始验证屏幕锁定密码')
      if (!password) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PASSWORD', message: '请输入密码' }
        })
      }

      if (!this.isConnected()) {
        return res.status(500).json({
          success: false,
          error: { code: 'DATABASE_ERROR', message: '数据库未连接' }
        })
      }

      const result = await this.service.verifyPassword(userId, password)
      if (!result.exists) {
        return res.status(400).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
        })
      }

      if (result.valid) {
        return res.json({ success: true, message: '密码验证成功' })
      }
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: '密码错误' }
      })
    } catch (error) {
      this.logger.error('验证屏幕锁定密码失败:', error)
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || '验证失败' }
      })
    }
  }

  async listQueryUsers(_req, res) {
    try {
      const maskedRows = await this.service.listQueryUsers()
      return this.response.success(res, '获取密码列表成功', {
        total: maskedRows.length,
        data: maskedRows
      })
    } catch (error) {
      this.logger.error('获取在库查询密码列表失败:', error)
      return this.response.serverError(res, '获取密码列表失败', error)
    }
  }

  async createQueryUser(req, res) {
    try {
      const { name, password, remarks } = req.body
      if (!name || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: '用户名和密码不能为空' }
        })
      }

      const id = await this.service.createQueryUser({
        name,
        password,
        remarks: remarks || '',
        createdBy: req.user.id
      })
      return this.response.success(res, '添加用户成功', { id, name, remarks })
    } catch (error) {
      this.logger.error('添加在库查询用户失败:', error)
      return this.response.serverError(res, '添加用户失败', error)
    }
  }

  async updateQueryUser(req, res) {
    try {
      const { id } = req.params
      const { name, password, is_active: isActive, remarks } = req.body
      const updated = await this.service.updateQueryUser(id, { name, password, is_active: isActive, remarks })
      if (!updated) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FIELDS', message: '没有要更新的字段' }
        })
      }

      return this.response.success(res, '更新用户成功')
    } catch (error) {
      this.logger.error('更新在库查询用户失败:', error)
      return this.response.serverError(res, '更新用户失败', error)
    }
  }

  async deleteQueryUser(req, res) {
    try {
      await this.service.deleteQueryUser(req.params.id)
      return this.response.success(res, '删除用户成功')
    } catch (error) {
      this.logger.error('删除在库查询用户失败:', error)
      return this.response.serverError(res, '删除用户失败', error)
    }
  }

  async verifyInventoryQueryPassword(req, res) {
    try {
      const { password } = req.body
      if (!password) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PASSWORD', message: '请输入密码' }
        })
      }

      const matchedUser = await this.service.matchQueryPassword(password)

      if (!matchedUser) {
        this.logger.debug('在库查询密码验证失败')
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: '密码错误' }
        })
      }

      return res.json({
        success: true,
        message: '密码验证成功',
        data: {
          userName: matchedUser.name,
          queryToken: this.createQueryToken(matchedUser),
          expiresIn: 600
        }
      })
    } catch (error) {
      this.logger.error('验证在库查询密码失败:', error)
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message || '验证失败' }
      })
    }
  }

  async uploadBackgroundFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: '未上传文件' }
        })
      }

      const hasValidSignature = await this.validateFileSignature(req.file, ['image', 'video'])
      if (!hasValidSignature) {
        await this.removeFiles([req.file])
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILE_CONTENT', message: '文件内容与图片或视频格式不匹配' }
        })
      }

      const isImage = req.file.mimetype.startsWith('image/')
      const isVideo = req.file.mimetype.startsWith('video/')
      if (!isImage && !isVideo) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILE_TYPE', message: '只支持图片或视频文件' }
        })
      }

      const fileType = isImage ? '图片' : '视频'
      return res.json({
        success: true,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          url: this.uploadUrl('screen-lock', req.file.filename),
          type: isImage ? 'image' : 'video'
        },
        message: `${fileType}上传成功`
      })
    } catch (error) {
      await this.removeFiles(req.file ? [req.file] : []).catch(() => {})
      this.logger.error('上传文件失败:', error)
      return res.status(500).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: '上传失败' }
      })
    }
  }

  async deleteBackgroundFile(req, res) {
    try {
      const { filename } = req.params
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILENAME', message: '无效的文件名' }
        })
      }

      const filePath = this.uploadDirectory('screen-lock', filename)
      try {
        await this.fileSystem.unlink(filePath)
        return res.json({ success: true, message: '文件删除成功' })
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({
            success: false,
            error: { code: 'FILE_NOT_FOUND', message: '文件不存在' }
          })
        }
        throw error
      }
    } catch (error) {
      this.logger.error('删除文件失败:', error)
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '删除文件失败' }
      })
    }
  }
}

module.exports = ScreenLockController
