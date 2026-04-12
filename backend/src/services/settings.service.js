/**
 * 系统设置服务
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class SettingsService {
  constructor() {
    // 延迟获取数据库连接，避免在初始化时数据库未连接
    this.db = null;
  }

  getDb() {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  /**
   * 获取设置值
   * @param {string} settingKey - 设置键名
   * @param {any} defaultValue - 默认值
   * @returns {any} 设置值
   */
  async getSetting(settingKey, defaultValue = null) {
    try {
      const query = `
        SELECT setting_value, setting_type
        FROM settings
        WHERE setting_key = ?
      `;
      const [settings] = await this.getDb().execute(query, [settingKey]);

      if (settings.length === 0) {
        return defaultValue;
      }

      const { setting_value, setting_type } = settings[0];

      // 根据类型转换值
      switch (setting_type) {
        case 'number':
          return Number(setting_value);
        case 'boolean':
          return setting_value === 'true' || setting_value === '1';
        case 'json':
          return JSON.parse(setting_value || '{}');
        default:
          return setting_value;
      }
    } catch (error) {
      log.error('获取设置失败:', error);
      return defaultValue;
    }
  }

  /**
   * 设置值
   * @param {string} settingKey - 设置键名
   * @param {any} settingValue - 设置值
   * @param {string} settingType - 设置类型
   * @returns {object} 操作结果
   */
  async setSetting(settingKey, settingValue, settingType = 'string') {
    try {
      // 转换值为字符串存储
      let valueStr = settingValue.toString();
      if (settingType === 'json') {
        valueStr = JSON.stringify(settingValue);
      }

      const query = `
        INSERT INTO settings (setting_key, setting_value, setting_type)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        setting_type = VALUES(setting_type),
        updated_at = CURRENT_TIMESTAMP
      `;

      await this.getDb().execute(query, [settingKey, valueStr, settingType]);

      return {
        success: true,
        message: '设置保存成功',
        data: {
          settingKey,
          settingValue,
          settingType
        }
      };
    } catch (error) {
      log.error('保存设置失败:', error);
      return {
        success: false,
        message: '保存设置失败',
        code: 'SAVE_SETTING_ERROR'
      };
    }
  }

  /**
   * 获取所有设置
   * @param {string} group - 设置分组（可选）
   * @returns {object} 操作结果
   */
  async getAllSettings(group = null) {
    try {
      let query = `
        SELECT setting_key, setting_value, setting_type, setting_group, description
        FROM settings
      `;
      let params = [];

      if (group) {
        query += ' WHERE setting_group = ?';
        params.push(group);
      }

      const [settings] = await this.getDb().execute(query, params);

      const result = {};
      settings.forEach(setting => {
        const { setting_key, setting_value, setting_type } = setting;

        // 根据类型转换值
        switch (setting_type) {
          case 'number':
            result[setting_key] = Number(setting_value);
            break;
          case 'boolean':
            result[setting_key] = setting_value === 'true' || setting_value === '1';
            break;
          case 'json':
            result[setting_key] = JSON.parse(setting_value || '{}');
            break;
          default:
            result[setting_key] = setting_value;
        }
      });

      return {
        success: true,
        message: '获取设置成功',
        data: result
      };
    } catch (error) {
      log.error('获取所有设置失败:', error);
      return {
        success: false,
        message: '获取设置失败',
        code: 'GET_SETTINGS_ERROR'
      };
    }
  }

  /**
   * 批量设置
   * @param {object} settingsObj - 设置对象
   * @returns {object} 操作结果
   */
  async setMultipleSettings(settingsObj) {
    try {
      const connection = await this.getDb().getConnection();
      await connection.beginTransaction();

      try {
        for (const [key, value] of Object.entries(settingsObj)) {
          let settingType = 'string';

          // 自动推断类型
          if (typeof value === 'number') {
            settingType = 'number';
          } else if (typeof value === 'boolean') {
            settingType = 'boolean';
          } else if (typeof value === 'object') {
            settingType = 'json';
          }

          let valueStr = value.toString();
          if (settingType === 'json') {
            valueStr = JSON.stringify(value);
          }

          const query = `
            INSERT INTO settings (setting_key, setting_value, setting_type)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
            setting_value = VALUES(setting_value),
            setting_type = VALUES(setting_type),
            updated_at = CURRENT_TIMESTAMP
          `;

          await connection.execute(query, [key, valueStr, settingType]);
        }

        await connection.commit();

        return {
          success: true,
          message: '批量设置保存成功',
          data: settingsObj
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      log.error('批量设置失败:', error);
      return {
        success: false,
        message: '批量设置失败',
        code: 'BATCH_SET_ERROR'
      };
    }
  }

  /**
   * 获取菜单宽度
   * @param {string} type - 类型：'pc' 或 'mobile'
   * @returns {number} 菜单宽度
   */
  async getMenuWidth(type = 'pc') {
    try {
      const keyName = type === 'mobile' ? 'mobile_menu_width' : 'menu_width';
      const query = `SELECT value FROM settings WHERE key_name = ? LIMIT 1`;
      const [settings] = await this.getDb().execute(query, [keyName]);

      if (settings.length === 0) {
        return type === 'mobile' ? 280 : 200; // 默认值：手机端280px，PC端200px
      }
      return Number(settings[0].value) || (type === 'mobile' ? 280 : 200);
    } catch (error) {
      log.error(`获取${type === 'mobile' ? '手机端' : 'PC端'}菜单宽度失败:`, error);
      return type === 'mobile' ? 280 : 200;
    }
  }

  /**
   * 获取所有菜单宽度
   * @returns {object} PC和手机端菜单宽度
   */
  async getAllMenuWidths() {
    try {
      const query = `SELECT key_name, value FROM settings WHERE key_name IN ('menu_width', 'mobile_menu_width')`;
      const [settings] = await this.getDb().execute(query);

      const result = {
        pc: 200,
        mobile: 280
      };

      settings.forEach(setting => {
        if (setting.key_name === 'menu_width') {
          result.pc = Number(setting.value) || 200;
        } else if (setting.key_name === 'mobile_menu_width') {
          result.mobile = Number(setting.value) || 280;
        }
      });

      return result;
    } catch (error) {
      log.error('获取菜单宽度失败:', error);
      return {
        pc: 200,
        mobile: 280
      };
    }
  }

  /**
   * 设置菜单宽度
   * @param {number} width - 菜单宽度
   * @param {string} type - 类型：'pc' 或 'mobile'
   * @returns {object} 操作结果
   */
  async setMenuWidth(width, type = 'pc') {
    try {
      const keyName = type === 'mobile' ? 'mobile_menu_width' : 'menu_width';

      // 使用 INSERT ... ON DUPLICATE KEY UPDATE 语法
      const query = `
        INSERT INTO settings (key_name, value, type, description)
        VALUES (?, ?, 'number', ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP
      `;

      await this.getDb().execute(query, [
        keyName,
        width.toString(),
        `${type === 'mobile' ? '移动端' : 'PC端'}菜单宽度设置`
      ]);

      return {
        success: true,
        message: `${type === 'mobile' ? '手机端' : 'PC端'}菜单宽度设置成功`,
        data: {
          type,
          width
        }
      };
    } catch (error) {
      log.error(`设置${type === 'mobile' ? '手机端' : 'PC端'}菜单宽度失败:`, error);
      return {
        success: false,
        message: `设置${type === 'mobile' ? '手机端' : 'PC端'}菜单宽度失败`,
        code: 'SET_MENU_WIDTH_ERROR'
      };
    }
  }

  /**
   * 批量设置PC和手机端菜单宽度
   * @param {object} widths - 包含pc和mobile宽度的对象
   * @returns {object} 操作结果
   */
  async setBothMenuWidths(widths) {
    try {
      const db = this.getDb();
      log.debug('开始设置菜单宽度:', widths);

      // 使用REPLACE语法，更简单可靠
      await db.execute(`
        REPLACE INTO settings (key_name, value, type, description)
        VALUES ('menu_width', ?, 'number', 'PC端菜单宽度设置')
      `, [widths.pc.toString()]);
      log.debug('PC端宽度设置成功:', widths.pc);

      await db.execute(`
        REPLACE INTO settings (key_name, value, type, description)
        VALUES ('mobile_menu_width', ?, 'number', '移动端菜单宽度设置')
      `, [widths.mobile.toString()]);
      log.debug('移动端宽度设置成功:', widths.mobile);

      return {
        success: true,
        message: '批量设置菜单宽度成功',
        data: widths
      };
    } catch (error) {
      log.error('批量设置菜单宽度失败:', error);
      return {
        success: false,
        message: '批量设置菜单宽度失败: ' + error.message,
        code: 'SET_MENU_WIDTHS_ERROR'
      };
    }
  }
}

module.exports = SettingsService;
