const SystemSettingsRepository = require('../repositories/system-settings.repository');
const log = require('../utils/log');

const SettingsRepository = new SystemSettingsRepository();

class SystemSettingsService {
  /**
   * 获取所有配置
   */
  async getAllSettings() {
    try {
      return await SettingsRepository.getAllSettings();
    } catch (error) {
      log.error('获取所有配置失败:', error);
      throw error;
    }
  }

  /**
   * 根据分类获取配置
   */
  async getSettingsByCategory(category) {
    try {
      return await SettingsRepository.getSettingsByCategory(category);
    } catch (error) {
      log.error('获取配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个配置
   */
  async getSettingByKey(settingKey) {
    try {
      const setting = await SettingsRepository.getSettingByKey(settingKey);
      if (!setting) {
        return null;
      }

      // 根据类型转换值
      const value = this.parseSettingValue(setting.value, setting.type);
      return {
        key: setting.key_name,
        value: value,
        type: setting.type,
        description: setting.description
      };
    } catch (error) {
      log.error('获取配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  async updateSetting(settingKey, settingValue, settingType) {
    try {
      return await SettingsRepository.upsertSetting(settingKey, settingValue, settingType);
    } catch (error) {
      log.error('更新配置失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新配置
   */
  async batchUpdateSettings(settings) {
    try {
      const results = [];
      for (const setting of settings) {
        const result = await SettingsRepository.upsertSetting(
          setting.key,
          setting.value,
          setting.type || 'string'
        );
        results.push(result);
      }
      return results;
    } catch (error) {
      log.error('批量更新配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteSetting(settingKey) {
    try {
      return await SettingsRepository.deleteSetting(settingKey);
    } catch (error) {
      log.error('删除配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取每月休假天数配置
   */
  async getMonthlyLeaveDays() {
    try {
      const setting = await this.getSettingByKey('monthly_leave_days');
      return setting ? parseInt(setting.value) || 2 : 2;
    } catch (error) {
      log.error('获取每月休假天数失败:', error);
      return 2; // 默认2天
    }
  }

  /**
   * 解析配置值
   */
  parseSettingValue(value, type) {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      default:
        return value;
    }
  }
}

module.exports = new SystemSettingsService();
