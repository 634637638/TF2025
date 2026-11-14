const SystemSettingsRepository = require('../repositories/system-settings.repository')
const log = require('../utils/log')
const { parseInput } = require('../middleware/validation')

const SettingsRepository = new SystemSettingsRepository()

function parseSettingInput(key, value, type = 'string') {
  const input = parseInput({ key, type }, {
    key: { type: 'string', required: true, maxLength: 100, label: '配置键' },
    type: { type: ['string', 'number', 'boolean', 'json'], required: true, label: '配置类型' }
  })
  if (type === 'number') {
    value = parseInput({ value }, { value: { type: 'number', required: true, label: '配置数值' } }).value
  } else if (type === 'boolean') {
    // 配置存储沿用 true/false 文本；不把任意非空字符串视为 true。
    if (value === 'true') value = true
    if (value === 'false') value = false
    value = String(parseInput({ value }, { value: { type: 'boolean', required: true, label: '配置开关' } }).value)
  } else if (type === 'json') {
    try {
      if (typeof value === 'string') JSON.parse(value)
      else if (value === undefined || JSON.stringify(value) === undefined) throw new Error('invalid')
    } catch (_) {
      throw Object.assign(new Error('配置内容必须为有效 JSON'), { statusCode: 400, code: 'VALIDATION_ERROR' })
    }
  } else {
    if (typeof value !== 'string') throw Object.assign(new Error('配置内容必须为文本'), { statusCode: 400, code: 'VALIDATION_ERROR' })
    value = parseInput({ value }, { value: { type: 'string', maxLength: 1000000, multiline: true } }).value
  }
  return { ...input, value }
}

class SystemSettingsService {
  /**
   * 获取所有配置
   */
  async getAllSettings() {
    try {
      return await SettingsRepository.getAllSettings()
    } catch (error) {
      log.error('获取所有配置失败:', error)
      throw error
    }
  }

  /**
   * 根据分类获取配置
   */
  async getSettingsByCategory(category) {
    try {
      return await SettingsRepository.getSettingsByCategory(category)
    } catch (error) {
      log.error('获取配置失败:', error)
      throw error
    }
  }

  /**
   * 获取单个配置
   */
  async getSettingByKey(settingKey) {
    try {
      const setting = await SettingsRepository.getSettingByKey(settingKey)
      if (!setting) {
        return null
      }

      // 根据类型转换值
      const value = this.parseSettingValue(setting.value, setting.type)
      return {
        key: setting.key_name,
        value: value,
        type: setting.type,
        description: setting.description
      }
    } catch (error) {
      log.error('获取配置失败:', error)
      throw error
    }
  }

  /**
   * 更新配置
   */
  async updateSetting(settingKey, settingValue, settingType) {
    const input = parseSettingInput(settingKey, settingValue, settingType)
    try {
      return await SettingsRepository.upsertSetting(input.key, input.value, input.type)
    } catch (error) {
      log.error('更新配置失败:', error)
      throw error
    }
  }

  /**
   * 批量更新配置
   */
  async batchUpdateSettings(settings) {
    if (!Array.isArray(settings)) throw Object.assign(new Error('settings 必须是数组'), { statusCode: 400 })
    const inputs = settings.map(setting => {
      const input = parseInput(setting, {})
      return parseSettingInput(input.key, input.value, input.type)
    })
    try {
      const results = []
      for (const setting of inputs) {
        const result = await SettingsRepository.upsertSetting(
          setting.key,
          setting.value,
          setting.type || 'string'
        )
        results.push(result)
      }
      return results
    } catch (error) {
      log.error('批量更新配置失败:', error)
      throw error
    }
  }

  /**
   * 删除配置
   */
  async deleteSetting(settingKey) {
    try {
      return await SettingsRepository.deleteSetting(settingKey)
    } catch (error) {
      log.error('删除配置失败:', error)
      throw error
    }
  }

  /**
   * 获取每月休假天数配置
   */
  async getMonthlyLeaveDays() {
    try {
      const setting = await this.getSettingByKey('monthly_leave_days')
      return setting ? parseInt(setting.value) || 2 : 2
    } catch (error) {
      log.error('获取每月休假天数失败:', error)
      return 2 // 默认2天
    }
  }

  /**
   * 解析配置值
   */
  parseSettingValue(value, type) {
    switch (type) {
    case 'number':
      return parseFloat(value)
    case 'boolean':
      return value === 'true' || value === '1'
    case 'json':
      try {
        return JSON.parse(value)
      } catch (e) {
        // 旧版 settings.value 使用 TEXT 保存大体量中文词库时可能被截断。
        // 尽量闭合未完成的字符串/数组/对象，让已有前缀词库仍可读取；
        // 字段升级为 LONGTEXT 后，新保存的数据会走正常 JSON.parse。
        if (typeof value === 'string') {
          try {
            let inString = false
            let escaped = false
            const stack = []
            for (const char of value) {
              if (inString) {
                if (escaped) escaped = false
                else if (char === '\\') escaped = true
                else if (char === '"') inString = false
                continue
              }
              if (char === '"') inString = true
              else if (char === '{' || char === '[') stack.push(char)
              else if (char === '}' && stack.at(-1) === '{') stack.pop()
              else if (char === ']' && stack.at(-1) === '[') stack.pop()
            }
            const repaired = `${value}${inString ? '"' : ''}${stack.reverse().map(char => char === '{' ? '}' : ']').join('')}`
            return JSON.parse(repaired)
          } catch {
            return value
          }
        }
        return value
      }
    default:
      return value
    }
  }
}

module.exports = new SystemSettingsService()
