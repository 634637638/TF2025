/**
 * 用户偏好设置服务类
 * 处理用户个性化设置，如菜单宽度等
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class UserPreferencesService {
  constructor() {
    // 数据库连接将在需要时获取
  }

  /**
   * 获取用户偏好设置
   */
  async getPreference(userId, preferenceKey, defaultValue = null) {
    try {
      const db = getDatabase();
      const query = `
        SELECT preference_value, preference_type
        FROM user_preferences
        WHERE user_id = ? AND preference_key = ?
      `;
      const [preferences] = await db.execute(query, [userId, preferenceKey]);

      if (preferences.length === 0) {
        return defaultValue;
      }

      const preference = preferences[0];
      return this.parseValue(preference.preference_value, preference.preference_type);
    } catch (error) {
      log.error('获取用户偏好设置失败:', error);
      return defaultValue;
    }
  }

  /**
   * 设置用户偏好设置
   */
  async setPreference(userId, preferenceKey, value, type = 'string') {
    try {
      const db = getDatabase();
      const stringValue = this.stringifyValue(value, type);

      const query = `
        INSERT INTO user_preferences (user_id, preference_key, preference_value, preference_type)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        preference_value = VALUES(preference_value),
        preference_type = VALUES(preference_type),
        updated_at = CURRENT_TIMESTAMP
      `;

      await db.execute(query, [userId, preferenceKey, stringValue, type]);

      return {
        success: true,
        message: '用户偏好设置保存成功',
        data: { user_id: userId, preference_key: preferenceKey, value: value, type: type }
      };
    } catch (error) {
      log.error('设置用户偏好失败:', error);
      return {
        success: false,
        message: '设置用户偏好失败',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * 获取用户的所有偏好设置
   */
  async getAllPreferences(userId) {
    try {
      const db = getDatabase();
      const query = `
        SELECT preference_key, preference_value, preference_type
        FROM user_preferences
        WHERE user_id = ?
      `;
      const [preferences] = await db.execute(query, [userId]);

      const result = {};
      preferences.forEach(preference => {
        result[preference.preference_key] = this.parseValue(
          preference.preference_value,
          preference.preference_type
        );
      });

      return {
        success: true,
        message: '获取用户偏好设置成功',
        data: result
      };
    } catch (error) {
      log.error('获取所有用户偏好设置失败:', error);
      return {
        success: false,
        message: '获取用户偏好设置失败',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * 批量设置用户偏好
   */
  async setMultiplePreferences(userId, preferences) {
    try {
      const db = getDatabase();
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        for (const [key, config] of Object.entries(preferences)) {
          const { value, type = 'string' } = typeof config === 'object' ? config : { value: config };
          const stringValue = this.stringifyValue(value, type);

          const query = `
            INSERT INTO user_preferences (user_id, preference_key, preference_value, preference_type)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            preference_value = VALUES(preference_value),
            preference_type = VALUES(preference_type),
            updated_at = CURRENT_TIMESTAMP
          `;

          await connection.execute(query, [userId, key, stringValue, type]);
        }

        await connection.commit();

        return {
          success: true,
          message: '批量设置用户偏好成功',
          data: { updated_count: Object.keys(preferences).length }
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      log.error('批量设置用户偏好失败:', error);
      return {
        success: false,
        message: '批量设置用户偏好失败',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * 删除用户偏好设置
   */
  async deletePreference(userId, preferenceKey) {
    try {
      const db = getDatabase();
      const query = `
        DELETE FROM user_preferences
        WHERE user_id = ? AND preference_key = ?
      `;
      const [result] = await db.execute(query, [userId, preferenceKey]);

      return {
        success: true,
        message: result.affectedRows > 0 ? '用户偏好设置删除成功' : '偏好设置不存在',
        data: { deleted: result.affectedRows > 0 }
      };
    } catch (error) {
      log.error('删除用户偏好设置失败:', error);
      return {
        success: false,
        message: '删除用户偏好设置失败',
        code: 'DATABASE_ERROR'
      };
    }
  }

  /**
   * 将值转换为字符串存储
   */
  stringifyValue(value, type) {
    switch (type) {
      case 'number':
        return Number(value).toString();
      case 'boolean':
        return Boolean(value) ? '1' : '0';
      case 'json':
        return JSON.stringify(value);
      case 'string':
      default:
        return String(value);
    }
  }

  /**
   * 将字符串解析为对应类型的值
   */
  parseValue(stringValue, type) {
    if (stringValue === null || stringValue === undefined) {
      return null;
    }

    switch (type) {
      case 'number':
        return Number(stringValue);
      case 'boolean':
        return stringValue === '1' || stringValue === 'true';
      case 'json':
        try {
          return JSON.parse(stringValue);
        } catch (e) {
          log.warn('JSON解析失败:', stringValue);
          return stringValue;
        }
      case 'string':
      default:
        return stringValue;
    }
  }
}

module.exports = UserPreferencesService;
