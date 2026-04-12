/**
 * 系统配置数据访问层
 */
const BaseRepository = require('./base.repository');
const db = require('../config/database');
const log = require('../utils/log');

class SystemSettingsRepository extends BaseRepository {
  constructor() {
    super('settings');
  }

  /**
   * 执行查询
   */
  async executeQuery(query, params = []) {
    try {
      const [results] = await db.getDatabase().query(query, params);
      return results;
    } catch (error) {
      log.error('数据库查询失败:', error);
      throw error;
    }
  }

  /**
   * 根据配置键获取配置值
   */
  async getSettingByKey(settingKey) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE key_name = ?`;
      const results = await this.executeQuery(query, [settingKey]);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      log.error('获取系统配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取多个配置
   */
  async getSettingsByKeys(settingKeys) {
    try {
      const placeholders = settingKeys.map(() => '?').join(', ');
      const query = `SELECT * FROM ${this.tableName} WHERE key_name IN (${placeholders})`;
      return await this.executeQuery(query, settingKeys);
    } catch (error) {
      log.error('获取系统配置列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据分类获取配置
   */
  async getSettingsByCategory(category) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE category = ? ORDER BY id`;
      return await this.executeQuery(query, [category]);
    } catch (error) {
      log.error('获取系统配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有配置
   */
  async getAllSettings() {
    try {
      const query = `SELECT * FROM ${this.tableName} ORDER BY id`;
      return await this.executeQuery(query);
    } catch (error) {
      log.error('获取所有配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新或创建配置
   */
  async upsertSetting(settingKey, settingValue, settingType = 'string') {
    try {
      const query = `
        INSERT INTO ${this.tableName} (key_name, value, type)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        value = VALUES(value),
        type = VALUES(type),
        updated_at = CURRENT_TIMESTAMP
      `;
      await this.executeQuery(query, [settingKey, settingValue, settingType]);
      return await this.getSettingByKey(settingKey);
    } catch (error) {
      log.error('更新系统配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteSetting(settingKey) {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE key_name = ?`;
      return await this.executeQuery(query, [settingKey]);
    } catch (error) {
      log.error('删除系统配置失败:', error);
      throw error;
    }
  }
}

module.exports = SystemSettingsRepository;
