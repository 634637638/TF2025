const log = require('../utils/log');
const SystemSettingsService = require('../services/system-settings.service');
const ApiResponse = require('../utils/response');

/**
 * 系统配置控制器
 */
class SystemSettingsController {
  /**
   * 获取所有配置
   */
  async getAllSettings(req, res) {
    try {
      const result = await SystemSettingsService.getAllSettings();
      ApiResponse.success(res, '获取配置成功', result, 200);
    } catch (error) {
      log.error('获取配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 根据分类获取配置
   */
  async getSettingsByCategory(req, res) {
    try {
      const { category } = req.params;
      const result = await SystemSettingsService.getSettingsByCategory(category);
      ApiResponse.success(res, '获取配置成功', result, 200);
    } catch (error) {
      log.error('获取配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取单个配置
   */
  async getSettingByKey(req, res) {
    try {
      const { key } = req.params;
      const result = await SystemSettingsService.getSettingByKey(key);

      if (!result) {
        return ApiResponse.error(res, '配置不存在', 404);
      }

      ApiResponse.success(res, '获取配置成功', result, 200);
    } catch (error) {
      log.error('获取配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 更新配置
   */
  async updateSetting(req, res) {
    try {
      const { key } = req.params;
      const { value, type } = req.body;

      const result = await SystemSettingsService.updateSetting(key, value, type);
      ApiResponse.success(res, '更新配置成功', result, 200);
    } catch (error) {
      log.error('更新配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 批量更新配置
   */
  async batchUpdateSettings(req, res) {
    try {
      const { settings } = req.body;

      if (!Array.isArray(settings)) {
        return ApiResponse.error(res, 'settings 必须是数组', 400);
      }

      const result = await SystemSettingsService.batchUpdateSettings(settings);
      ApiResponse.success(res, '批量更新配置成功', result, 200);
    } catch (error) {
      log.error('批量更新配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 删除配置
   */
  async deleteSetting(req, res) {
    try {
      const { key } = req.params;
      await SystemSettingsService.deleteSetting(key);
      ApiResponse.success(res, '删除配置成功', null, 200);
    } catch (error) {
      log.error('删除配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取考勤相关配置
   */
  async getAttendanceSettings(req, res) {
    try {
      const settings = await SystemSettingsService.getSettingsByCategory('attendance');

      // 转换为键值对格式
      const result = {};
      settings.forEach(setting => {
        result[setting.key_name] = SystemSettingsService.parseSettingValue(
          setting.value,
          setting.type
        );
      });

      ApiResponse.success(res, '获取考勤配置成功', result, 200);
    } catch (error) {
      log.error('获取考勤配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取加价配置
   */
  async getMarkupConfig(req, res) {
    try {
      const setting = await SystemSettingsService.getSettingByKey('price_markup_config');

      // 默认配置
      const defaultConfig = {
        mode: 'fixed',
        lowFixed: 250,
        highFixed: 200,
        lowPercent: 8.0,
        highPercent: 3.0,
        threshold: 6000,
        enabled: true,
        wholesale: {
          enabled: false,
          adjustment: 0
        }
      };

      const result = setting ? setting.value : defaultConfig;
      ApiResponse.success(res, '获取加价配置成功', result, 200);
    } catch (error) {
      log.error('获取加价配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 保存加价配置
   */
  async saveMarkupConfig(req, res) {
    try {
      const config = req.body;

      // 验证配置数据
      if (!config || typeof config !== 'object') {
        return ApiResponse.error(res, '配置数据无效', 400);
      }

      // 保存到 settings 表
      await SystemSettingsService.updateSetting(
        'price_markup_config',
        JSON.stringify(config),
        'json'
      );

      ApiResponse.success(res, '保存加价配置成功', config, 200);
    } catch (error) {
      log.error('保存加价配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = new SystemSettingsController();
