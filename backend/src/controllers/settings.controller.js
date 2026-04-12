const log = require('../utils/log');
/**
 * 系统设置控制器
 */
const SettingsService = require('../services/settings.service');

class SettingsController {
  constructor() {
    this.settingsService = new SettingsService();
  }

  /**
   * 获取单个设置
   */
  getSetting = async (req, res) => {
    try {
      const { settingKey } = req.params;
      const { defaultValue } = req.query;

      if (!settingKey) {
        return res.status(400).json({
          success: false,
          message: '设置键名不能为空',
          code: 'MISSING_SETTING_KEY'
        });
      }

      const result = await this.settingsService.getSetting(
        settingKey,
        defaultValue
      );

      res.json({
        success: true,
        message: '获取设置成功',
        data: {
          settingKey,
          value: result
        }
      });
    } catch (error) {
      log.error('获取设置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 设置单个设置
   */
  setSetting = async (req, res) => {
    try {
      const { settingKey } = req.params;
      const { value, type = 'string' } = req.body;

      if (!settingKey) {
        return res.status(400).json({
          success: false,
          message: '设置键名不能为空',
          code: 'MISSING_SETTING_KEY'
        });
      }

      if (value === undefined || value === null) {
        return res.status(400).json({
          success: false,
          message: '设置值不能为空',
          code: 'MISSING_SETTING_VALUE'
        });
      }

      const result = await this.settingsService.setSetting(
        settingKey,
        value,
        type
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('设置失败:', error);
      res.status(500).json({
        success: false,
        message: '设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 获取所有设置
   */
  getAllSettings = async (req, res) => {
    try {
      const { group } = req.query;
      const result = await this.settingsService.getAllSettings(group);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('获取所有设置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取所有设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 批量设置
   */
  setMultipleSettings = async (req, res) => {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          success: false,
          message: '设置数据格式不正确',
          code: 'INVALID_SETTINGS_DATA'
        });
      }

      const result = await this.settingsService.setMultipleSettings(settings);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('批量设置失败:', error);
      res.status(500).json({
        success: false,
        message: '批量设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 获取菜单宽度（公开接口，不需要认证）
   */
  getMenuWidth = async (req, res) => {
    try {
      const { type } = req.query;
      const result = await this.settingsService.getMenuWidth(type);

      res.json({
        success: true,
        message: '获取菜单宽度成功',
        data: result
      });
    } catch (error) {
      log.error('获取菜单宽度失败:', error);
      res.status(500).json({
        success: false,
        message: '获取菜单宽度失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 获取所有菜单宽度（PC端和手机端）
   */
  getAllMenuWidths = async (req, res) => {
    try {
      const result = await this.settingsService.getAllMenuWidths();

      res.json({
        success: true,
        message: '获取所有菜单宽度成功',
        data: result
      });
    } catch (error) {
      log.error('获取所有菜单宽度失败:', error);
      res.status(500).json({
        success: false,
        message: '获取所有菜单宽度失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 设置菜单宽度
   */
  setMenuWidth = async (req, res) => {
    try {
      // 兼容前端发送的 value 字段和后端期望的 width 字段
      const { width, value, type = 'pc' } = req.body;
      const menuWidth = width !== undefined ? width : value;

      if (menuWidth === undefined || menuWidth === null) {
        return res.status(400).json({
          success: false,
          message: '菜单宽度不能为空',
          code: 'MISSING_MENU_WIDTH'
        });
      }

      const widthNum = Number(menuWidth);
      if (isNaN(widthNum) || widthNum < 100 || widthNum > 500) {
        return res.status(400).json({
          success: false,
          message: '菜单宽度必须是100-500之间的数字',
          code: 'INVALID_MENU_WIDTH'
        });
      }

      const result = await this.settingsService.setMenuWidth(widthNum, type);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('设置菜单宽度失败:', error);
      res.status(500).json({
        success: false,
        message: '设置菜单宽度失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 批量设置PC和手机端菜单宽度
   */
  setBothMenuWidths = async (req, res) => {
    log.info('接收到菜单宽度设置请求');
    try {
      log.debug('请求体:', req.body);
      const { widths } = req.body;

      if (!widths || typeof widths !== 'object' || !widths.pc || !widths.mobile) {
        log.debug('验证失败:', { widths, hasPc: !!widths?.pc, hasMobile: !!widths?.mobile });
        return res.status(400).json({
          success: false,
          message: '必须提供PC端和手机端菜单宽度',
          code: 'MISSING_MENU_WIDTHS'
        });
      }

      const pcNum = Number(widths.pc);
      const mobileNum = Number(widths.mobile);

      if (isNaN(pcNum) || pcNum < 100 || pcNum > 500) {
        return res.status(400).json({
          success: false,
          message: 'PC端菜单宽度必须是100-500之间的数字',
          code: 'INVALID_PC_MENU_WIDTH'
        });
      }

      if (isNaN(mobileNum) || mobileNum < 100 || mobileNum > 500) {
        return res.status(400).json({
          success: false,
          message: '手机端菜单宽度必须是100-500之间的数字',
          code: 'INVALID_MOBILE_MENU_WIDTH'
        });
      }

      const result = await this.settingsService.setBothMenuWidths({
        pc: pcNum,
        mobile: mobileNum
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('批量设置菜单宽度失败:', error);
      res.status(500).json({
        success: false,
        message: '批量设置菜单宽度失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

module.exports = SettingsController;