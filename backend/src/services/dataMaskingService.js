/**
 * 数据脱敏服务
 * 根据用户角色权限动态过滤敏感数据
 */

const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class DataMaskingService {
  /**
   * 根据用户角色获取字段权限配置
   * @param {number} userId - 用户ID
   * @param {string} moduleKey - 模块标识
   * @returns {Object} - 字段权限配置
   */
  async getUserFieldPermissions(userId, moduleKey) {
    const pool = getDatabase();

    try {
      // 获取用户的所有角色
      const [userRoles] = await pool.execute(`
        SELECT DISTINCT ur.role_id
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? AND r.is_active = 1
      `, [userId]);

      if (userRoles.length === 0) {
        return { hiddenFields: [], readonlyFields: [] };
      }

      const roleIds = userRoles.map(r => r.role_id);
      const placeholders = roleIds.map(() => '?').join(',');

      // 获取角色的字段权限配置
      const [fieldPermissions] = await pool.execute(`
        SELECT role_id, module_key, field_config
        FROM role_field_permissions
        WHERE role_id IN (${placeholders})
        AND module_key = ?
        ORDER BY module_key
      `, [...roleIds, moduleKey]);

      // 合并所有角色的权限（取最严格的）
      const mergedConfig = {
        hiddenFields: new Set(),
        readonlyFields: new Set()
      };

      fieldPermissions.forEach(perm => {
        try {
          const config = typeof perm.field_config === 'object'
            ? perm.field_config
            : JSON.parse(perm.field_config || '{}');

          if (config.hiddenFields) {
            config.hiddenFields.forEach(field => {
              mergedConfig.hiddenFields.add(field);
            });
          }

          if (config.readonlyFields) {
            config.readonlyFields.forEach(field => {
              mergedConfig.readonlyFields.add(field);
            });
          }
        } catch (error) {
          log.warn('解析字段权限配置失败:', perm.field_config);
        }
      });

      return {
        hiddenFields: Array.from(mergedConfig.hiddenFields),
        readonlyFields: Array.from(mergedConfig.readonlyFields)
      };
    } catch (error) {
      log.error('获取用户字段权限失败:', error);
      return { hiddenFields: [], readonlyFields: [] };
    }
  }

  /**
   * 过滤数据中的敏感字段
   * @param {Array} data - 数据数组
   * @param {Object} fieldConfig - 字段权限配置
   * @returns {Array} - 过滤后的数据
   */
  filterSensitiveFields(data, fieldConfig) {
    if (!Array.isArray(data) || !fieldConfig) {
      return data;
    }

    const { hiddenFields, readonlyFields } = fieldConfig;

    return data.map(item => {
      const filteredItem = { ...item };

      // 处理嵌套对象字段
      hiddenFields.forEach(fieldPath => {
        const pathParts = fieldPath.split('.');
        let current = filteredItem;

        // 找到要隐藏的字段的父对象
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];

          // 处理中文键名
          if (part === 'basic_info' && current['基本信息']) {
            current = current['基本信息'];
          } else if (part === 'price_info' && current['价格信息']) {
            current = current['价格信息'];
          } else if (part === 'customer_info' && current['客户信息']) {
            current = current['客户信息'];
          } else if (part === 'supplier_info' && current['供应商信息']) {
            current = current['供应商信息'];
          } else if (part === 'operator_info' && current['操作员信息']) {
            current = current['操作员信息'];
          } else if (part === 'time_info' && current['时间信息']) {
            current = current['时间信息'];
          } else if (part === 'other_info' && current['其他信息']) {
            current = current['其他信息'];
          } else {
            if (current[part]) {
              current = current[part];
            } else {
              return; // 路径不存在
            }
          }
        }

        // 隐藏字段
        const finalKey = pathParts[pathParts.length - 1];
        if (finalKey && typeof current === 'object' && current !== null) {
          current[finalKey] = null;
        }
      });

      return filteredItem;
    });
  }

  /**
   * 脱敏单个数据项
   * @param {Object} item - 数据项
   * @param {number} userId - 用户ID
   * @param {string} moduleKey - 模块标识
   * @returns {Object} - 脱敏后的数据项
   */
  async maskDataItem(item, userId, moduleKey) {
    const fieldConfig = await this.getUserFieldPermissions(userId, moduleKey);
    const filteredData = this.filterSensitiveFields([item], fieldConfig);
    return filteredData[0];
  }

  /**
   * 脱敏数据列表
   * @param {Array} items - 数据列表
   * @param {number} userId - 用户ID
   * @param {string} moduleKey - 模块标识
   * @returns {Array} - 脱敏后的数据列表
   */
  async maskDataList(items, userId, moduleKey) {
    const fieldConfig = await this.getUserFieldPermissions(userId, moduleKey);
    return this.filterSensitiveFields(items, fieldConfig);
  }
}

// 创建单例实例
const dataMaskingService = new DataMaskingService();

module.exports = dataMaskingService;
