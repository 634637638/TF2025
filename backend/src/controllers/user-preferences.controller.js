const log = require('../utils/log');
/**
 * 用户偏好设置控制器
 */
const UserPreferencesService = require('../services/user-preferences.service');

class UserPreferencesController {
  constructor() {
    this.userPreferencesService = new UserPreferencesService();
  }

  getAuthenticatedUserId(req, res) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: '用户未登录或登录已失效',
        code: 'UNAUTHORIZED'
      });
      return null;
    }
    return userId;
  }

  /**
   * 获取用户偏好设置
   */
  getPreference = async (req, res) => {
    try {
      const { preferenceKey } = req.params;
      const { defaultValue } = req.query;

      if (!preferenceKey) {
        return res.status(400).json({
          success: false,
          message: '偏好设置键名不能为空',
          code: 'MISSING_PREFERENCE_KEY'
        });
      }

      const userId = this.getAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }
      const result = await this.userPreferencesService.getPreference(
        userId,
        preferenceKey,
        defaultValue
      );

      res.json({
        success: true,
        message: '获取用户偏好设置成功',
        data: result
      });
    } catch (error) {
      log.error('获取用户偏好设置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户偏好设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 设置用户偏好设置
   */
  setPreference = async (req, res) => {
    try {
      const { preferenceKey } = req.params;
      const { value, type = 'string' } = req.body;

      if (!preferenceKey) {
        return res.status(400).json({
          success: false,
          message: '偏好设置键名不能为空',
          code: 'MISSING_PREFERENCE_KEY'
        });
      }

      if (value === undefined || value === null) {
        return res.status(400).json({
          success: false,
          message: '偏好设置值不能为空',
          code: 'MISSING_PREFERENCE_VALUE'
        });
      }

      const userId = this.getAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }
      const result = await this.userPreferencesService.setPreference(
        userId,
        preferenceKey,
        value,
        type
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('设置用户偏好设置失败:', error);
      res.status(500).json({
        success: false,
        message: '设置用户偏好设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 获取用户的所有偏好设置
   */
  getAllPreferences = async (req, res) => {
    try {
      const userId = this.getAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }
      const result = await this.userPreferencesService.getAllPreferences(userId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('获取所有用户偏好设置失败:', error);
      res.status(500).json({
        success: false,
        message: '获取所有用户偏好设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 批量设置用户偏好
   */
  setMultiplePreferences = async (req, res) => {
    try {
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({
          success: false,
          message: '偏好设置数据格式不正确',
          code: 'INVALID_PREFERENCES_DATA'
        });
      }

      const userId = this.getAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }
      const result = await this.userPreferencesService.setMultiplePreferences(
        userId,
        preferences
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      log.error('批量设置用户偏好失败:', error);
      res.status(500).json({
        success: false,
        message: '批量设置用户偏好失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * 删除用户偏好设置
   */
  deletePreference = async (req, res) => {
    try {
      const { preferenceKey } = req.params;

      if (!preferenceKey) {
        return res.status(400).json({
          success: false,
          message: '偏好设置键名不能为空',
          code: 'MISSING_PREFERENCE_KEY'
        });
      }

      const userId = this.getAuthenticatedUserId(req, res);
      if (!userId) {
        return;
      }
      const result = await this.userPreferencesService.deletePreference(
        userId,
        preferenceKey
      );

      res.json(result);
    } catch (error) {
      log.error('删除用户偏好设置失败:', error);
      res.status(500).json({
        success: false,
        message: '删除用户偏好设置失败',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

module.exports = UserPreferencesController;
