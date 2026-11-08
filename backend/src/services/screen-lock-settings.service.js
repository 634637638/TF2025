'use strict'

const fs = require('fs').promises
const path = require('path')
const log = require('../utils/log')

const SETTINGS_FILE = path.join(__dirname, '../lock/screen-lock-settings.json')

const DEFAULT_SYSTEM_SETTINGS = Object.freeze({
  backgroundType: 'default',
  imageUrl: '',
  videoUrl: '',
  title: '屏幕已锁定',
  message: '请输入密码解锁'
})

const sanitizeSystemSettings = (settings = {}) => ({
  backgroundType: ['default', 'image', 'video'].includes(settings.backgroundType)
    ? settings.backgroundType
    : DEFAULT_SYSTEM_SETTINGS.backgroundType,
  imageUrl: typeof settings.imageUrl === 'string' ? settings.imageUrl : '',
  videoUrl: typeof settings.videoUrl === 'string' ? settings.videoUrl : '',
  title: typeof settings.title === 'string' && settings.title.trim()
    ? settings.title.trim()
    : DEFAULT_SYSTEM_SETTINGS.title,
  message: typeof settings.message === 'string' && settings.message.trim()
    ? settings.message.trim()
    : DEFAULT_SYSTEM_SETTINGS.message
})

class ScreenLockSettingsService {
  constructor({ filePath = SETTINGS_FILE, fileSystem = fs, logger = log } = {}) {
    this.filePath = filePath
    this.fileSystem = fileSystem
    this.logger = logger
  }

  async ensureDataDirectory() {
    try {
      await this.fileSystem.mkdir(path.dirname(this.filePath), { recursive: true })
    } catch (error) {
      this.logger.error('创建数据目录失败:', error)
    }
  }

  async load() {
    try {
      await this.ensureDataDirectory()
      const data = await this.fileSystem.readFile(this.filePath, 'utf8')
      return sanitizeSystemSettings(JSON.parse(data))
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.save(DEFAULT_SYSTEM_SETTINGS)
        return sanitizeSystemSettings(DEFAULT_SYSTEM_SETTINGS)
      }
      this.logger.error('读取屏幕锁定设置失败:', error)
      return sanitizeSystemSettings(DEFAULT_SYSTEM_SETTINGS)
    }
  }

  async save(settings) {
    try {
      await this.ensureDataDirectory()
      await this.fileSystem.writeFile(this.filePath, JSON.stringify(settings, null, 2))
      return true
    } catch (error) {
      this.logger.error('保存屏幕锁定设置失败:', error)
      return false
    }
  }
}

module.exports = { ScreenLockSettingsService, DEFAULT_SYSTEM_SETTINGS, sanitizeSystemSettings }
