/**
 * 智能字段同步服务
 * 当页面字段配置更新时，智能同步权限配置
 */
const { getDatabase } = require('../config/database');
const { getModuleAllFields } = require('../config/moduleFieldMappings');
const log = require('../utils/log');

class SmartFieldSync {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * 同步指定模块的字段配置
   * @param {string} moduleKey - 模块标识
   * @returns {Promise<Object>} 同步结果
   */
  async syncModuleFields(moduleKey) {
    try {
      log.debug(`🔄 开始同步模块 ${moduleKey} 的字段配置...`);

      // 获取模块配置的字段
      const moduleConfig = getModuleAllFields()[moduleKey];
      if (!moduleConfig) {
        throw new Error(`模块 ${moduleKey} 的配置不存在`);
      }

      // 获取数据库中现有的字段映射
      const [existingMappings] = await this.db.execute(`
        SELECT field_key FROM module_field_mappings
        WHERE module_key = ?
      `, [moduleKey]);

      const existingFields = existingMappings.map(m => m.field_key);
      const configuredFields = [];

      // 根据配置生成应有的字段
      for (const [tableName, fieldNames] of Object.entries(moduleConfig)) {
        for (const fieldName of fieldNames) {
          configuredFields.push(`${tableName}.${fieldName}`);
        }
      }

      // 计算需要添加和删除的字段
      const fieldsToAdd = configuredFields.filter(f => !existingFields.includes(f));
      const fieldsToRemove = existingFields.filter(f => !configuredFields.includes(f));

      let addedCount = 0;
      let removedCount = 0;

      // 添加新字段
      if (fieldsToAdd.length > 0) {
        for (const fieldKey of fieldsToAdd) {
          // 检查字段是否在 field_definitions 中存在
          const [fieldExists] = await this.db.execute(`
            SELECT id FROM field_definitions WHERE field_key = ?
          `, [fieldKey]);

          if (fieldExists.length > 0) {
            // 获取当前最大显示顺序
            const [maxOrder] = await this.db.execute(`
              SELECT MAX(display_order) as max_order FROM module_field_mappings
              WHERE module_key = ?
            `, [moduleKey]);

            const displayOrder = (maxOrder[0]?.max_order || 0) + 1;

            // 插入新的字段映射
            await this.db.execute(`
              INSERT INTO module_field_mappings
              (module_key, module_name, module_icon, module_category, field_key, display_order)
              SELECT ?, module_name, module_icon, module_category, ?, ?
              FROM (
                SELECT module_name, module_icon, module_category
                FROM module_field_mappings
                WHERE module_key = ?
                LIMIT 1
              ) AS module_info
            `, [moduleKey, fieldKey, displayOrder, moduleKey]);

            addedCount++;
            log.debug(`  ✓ 添加字段: ${fieldKey}`);
          } else {
            log.warn(`  ⚠️ 字段 ${fieldKey} 在数据库中不存在，跳过`);
          }
        }
      }

      // 删除不再需要的字段
      if (fieldsToRemove.length > 0) {
        const placeholders = fieldsToRemove.map(() => '?').join(',');
        await this.db.execute(`
          DELETE FROM module_field_mappings
          WHERE module_key = ? AND field_key IN (${placeholders})
        `, [moduleKey, ...fieldsToRemove]);
        removedCount = fieldsToRemove.length;

        fieldsToRemove.forEach(fieldKey => {
          log.debug(`  - 删除字段: ${fieldKey}`);
        });
      }

      // 更新角色权限（为新增字段分配默认权限）
      if (fieldsToAdd.length > 0) {
        await this.updatePermissionsForNewFields(moduleKey, fieldsToAdd);
      }

      log.debug(`✅ 同步完成！添加 ${addedCount} 个字段，删除 ${removedCount} 个字段`);

      return {
        success: true,
        moduleKey,
        added: addedCount,
        removed: removedCount,
        totalFields: configuredFields.length
      };

    } catch (error) {
      log.error(`❌ 同步模块 ${moduleKey} 失败:`, error);
      return {
        success: false,
        moduleKey,
        error: error.message
      };
    }
  }

  /**
   * 同步所有模块的字段配置
   * @returns {Promise<Array>} 同步结果数组
   */
  async syncAllModules() {
    const moduleConfigs = getModuleAllFields();
    const results = [];

    log.debug('🔄 开始同步所有模块的字段配置...');

    for (const moduleKey of Object.keys(moduleConfigs)) {
      const result = await this.syncModuleFields(moduleKey);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const totalAdded = results.reduce((sum, r) => sum + (r.added || 0), 0);
    const totalRemoved = results.reduce((sum, r) => sum + (r.removed || 0), 0);

    log.debug('\n✅ 同步完成！');
    log.debug(`- 成功模块: ${successCount}/${results.length}`);
    log.debug(`- 总计添加: ${totalAdded} 个字段`);
    log.debug(`- 总计删除: ${totalRemoved} 个字段`);

    return results;
  }

  /**
   * 为新增字段分配默认权限
   * @param {string} moduleKey - 模块标识
   * @param {Array} newFields - 新增的字段列表
   */
  async updatePermissionsForNewFields(moduleKey, newFields) {
    // 获取所有角色
    const [roles] = await this.db.execute(`
      SELECT id, name FROM roles WHERE is_active = 1
    `);

    // 获取新增字段的敏感度
    const fieldKeys = newFields.map(f => `'${f}'`).join(',');
    const [fields] = await this.db.execute(`
      SELECT field_key, sensitivity_level FROM field_definitions
      WHERE field_key IN (${fieldKeys})
    `, fieldKeys);

    // 为每个角色分配权限
    for (const role of roles) {
      const permission = this.getDefaultPermissionForRole(role.name);

      for (const field of fields) {
        const sensitivity = field.sensitivity_level;
        let finalPermission = { ...permission };

        // 根据敏感度调整权限
        if (sensitivity === 'SENSITIVE' && permission.excludeSensitive) {
          finalPermission.can_view = false;
          finalPermission.is_hidden = true;
        }

        if (sensitivity === 'CONFIDENTIAL' && !role.name.includes('超级管理员')) {
          finalPermission.can_view = false;
          finalPermission.is_hidden = true;
        }

        // 插入权限记录
        await this.db.execute(`
          INSERT INTO role_field_permissions
          (role_id, role_name, module_key, field_key,
           can_view, can_edit, can_search, can_export,
           is_hidden, permission_level, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system')
        `, [
          role.id,
          role.name,
          moduleKey,
          field.field_key,
          finalPermission.can_view,
          finalPermission.can_edit,
          finalPermission.can_search,
          finalPermission.can_export,
          finalPermission.is_hidden,
          finalPermission.permission_level
        ]);
      }
    }

    log.debug(`  ✓ 为 ${newFields.length} 个字段分配了默认权限`);
  }

  /**
   * 获取角色的默认权限配置
   * @param {string} roleName - 角色名称
   * @returns {Object} 权限配置
   */
  getDefaultPermissionForRole(roleName) {
    const permissions = {
      '超级管理员': {
        can_view: true,
        can_edit: true,
        can_search: true,
        can_export: true,
        is_hidden: false,
        permission_level: 'FULL'
      },
      '管理员': {
        can_view: true,
        can_edit: true,
        can_search: true,
        can_export: true,
        is_hidden: false,
        permission_level: 'FULL',
        excludeSensitive: true
      },
      '经理': {
        can_view: true,
        can_edit: false,
        can_search: true,
        can_export: true,
        is_hidden: false,
        permission_level: 'READ_ONLY',
        excludeSensitive: true
      },
      '员工': {
        can_view: true,
        can_edit: false,
        can_search: true,
        can_export: false,
        is_hidden: false,
        permission_level: 'READ_ONLY',
        publicOnly: true
      }
    };

    return permissions[roleName] || permissions['员工'];
  }
}

module.exports = SmartFieldSync;
