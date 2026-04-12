/**
 * 一键智能同步服务
 * 自动识别表结构，智能匹配数据，自动创建关联数据
 */
const DatabaseSyncService = require('./database-sync.service');
const log = require('../utils/log');

class SmartSyncService {
  constructor() {
    this.syncService = new DatabaseSyncService();
  }

  /**
   * 智能识别表类型
   */
  identifyTableType(tableName, columns) {
    const columnNames = columns.map(c => c.field.toLowerCase());

    // 表类型识别规则
    const tableTypes = {
      phones: {
        keywords: ['imei', 'serial', 'phone', 'brand', 'model', 'color', 'memory'],
        requiredFields: ['imei', 'serial_number', 'brand_id', 'model_id'],
        priority: 1
      },
      customers: {
        keywords: ['customer', 'phone', 'member', 'name'],
        requiredFields: ['phone', 'name'],
        priority: 2
      },
      sales: {
        keywords: ['sale', 'customer_id', 'phone_id', 'sale_date'],
        requiredFields: ['phone_id', 'customer_id'],
        priority: 3
      },
      brands: {
        keywords: ['brand', 'name'],
        requiredFields: ['name'],
        priority: 4
      },
      models: {
        keywords: ['model', 'brand_id', 'name'],
        requiredFields: ['name', 'brand_id'],
        priority: 5
      },
      colors: {
        keywords: ['color', 'name'],
        requiredFields: ['name'],
        priority: 6
      },
      memories: {
        keywords: ['memory', 'size', 'storage'],
        requiredFields: ['size'],
        priority: 7
      },
      suppliers: {
        keywords: ['supplier', 'vendor', 'provider'],
        requiredFields: ['name'],
        priority: 8
      },
      stores: {
        keywords: ['store', 'shop'],
        requiredFields: ['name'],
        priority: 9
      },
      users: {
        keywords: ['user', 'employee', 'operator', 'staff'],
        requiredFields: ['name', 'username'],
        priority: 10
      }
    };

    // 计算匹配分数
    let bestMatch = null;
    let highestScore = 0;

    for (const [type, config] of Object.entries(tableTypes)) {
      let score = 0;

      // 表名匹配
      const tableNameLower = tableName.toLowerCase();
      if (tableNameLower.includes(type) || type.includes(tableNameLower)) {
        score += 50;
      }

      // 关键词匹配
      config.keywords.forEach(keyword => {
        if (columnNames.some(col => col.includes(keyword))) {
          score += 10;
        }
      });

      // 必需字段匹配
      config.requiredFields.forEach(field => {
        if (columnNames.includes(field)) {
          score += 5;
        }
      });

      if (score > highestScore) {
        highestScore = score;
        bestMatch = type;
      }
    }

    return highestScore > 20 ? bestMatch : null;
  }

  /**
   * 智能生成字段映射配置
   */
  generateSmartMapping(sourceColumns, targetColumns) {
    const mappings = {};
    const targetFieldMap = new Map();

    // 构建目标字段映射（用于快速查找）
    targetColumns.forEach(t => {
      targetFieldMap.set(t.field.toLowerCase(), t.field);

      // 添加别名
      const aliases = this.getFieldAliases(t.field);
      aliases.forEach(alias => {
        targetFieldMap.set(alias, t.field);
      });
    });

    // 为每个源字段查找匹配的目标字段
    sourceColumns.forEach(sourceCol => {
      const sourceField = sourceCol.field;
      const sourceLower = sourceField.toLowerCase();

      // 1. 完全匹配
      if (targetFieldMap.has(sourceLower)) {
        mappings[sourceField] = targetFieldMap.get(sourceLower);
        return;
      }

      // 2. 别名匹配
      for (const [alias, targetField] of targetFieldMap.entries()) {
        if (sourceLower === alias) {
          mappings[sourceField] = targetField;
          return;
        }
      }

      // 3. 特殊规则匹配
      const specialMapping = this.getSpecialMapping(sourceField, targetColumns);
      if (specialMapping) {
        mappings[sourceField] = specialMapping;
        return;
      }

      // 4. 不映射（添加注释）
      mappings[sourceField] = '';
    });

    return mappings;
  }

  /**
   * 获取字段别名
   */
  getFieldAliases(field) {
    const aliasMap = {
      'brand_id': ['brand', 'brand_name', 'mark', 'make'],
      'model_id': ['model', 'model_name', 'type', 'product'],
      'color_id': ['color', 'color_name', 'colour'],
      'memory_id': ['memory', 'size', 'storage', 'capacity'],
      'supplier_id': ['supplier', 'vendor', 'provider'],
      'store_id': ['store', 'shop', 'branch'],
      'customer_id': ['customer', 'client'],
      'inventory_operator_id': ['inventory_operator', 'in_operator', 'stock_operator'],
      'sale_operator_id': ['sale_operator', 'seller', 'salesman'],
      'salestime': ['sale_date', 'sold_date', 'sell_date'],
      'Inventorytime': ['purchase_date', 'buy_date', 'in_date'],
      'purchase_cost': ['cost', 'buy_price', 'in_price'],
      'sale_price': ['price', 'sell_price', 'out_price']
    };

    return aliasMap[field] || [];
  }

  /**
   * 特殊字段映射规则
   */
  getSpecialMapping(sourceField, targetColumns) {
    // 品牌名称 → brand_id
    if (sourceField.toLowerCase().includes('brand') && !sourceField.includes('_id')) {
      return targetFields.find(f => f.field === 'brand_id')?.field;
    }

    // 型号名称 → model_id
    if (sourceField.toLowerCase().includes('model') && !sourceField.includes('_id')) {
      return targetFields.find(f => f.field === 'model_id')?.field;
    }

    // 颜色名称 → color_id
    if (sourceField.toLowerCase().includes('color') && !sourceField.includes('_id')) {
      return targetFields.find(f => f.field === 'color_id')?.field;
    }

    return null;
  }

  /**
   * 一键智能同步
   */
  async smartSync(connectionId, user = null) {
    const sourceConnection = this.syncService.getConnection(connectionId);
    const targetConnection = await require('../config/database').getDatabase().getConnection();

    try {
      log.debug('🚀 开始一键智能同步...\n');

      // 1. 获取源数据库所有表
      const [sourceTables] = await sourceConnection.query('SHOW TABLES');
      const sourceTableNames = sourceTables.map(t => Object.values(t)[0]);

      log.debug(`📊 发现 ${sourceTableNames.length} 个源表\n`);

      // 2. 获取目标数据库所有表
      const [targetTables] = await targetConnection.query('SHOW TABLES');
      const targetTableNames = targetTables.map(t => Object.values(t)[0]);

      // 3. 构建目标表结构缓存
      const targetTableStructures = new Map();
      for (const tableName of targetTableNames) {
        const [columns] = await targetConnection.query(`
          SELECT COLUMN_NAME as field, DATA_TYPE as type
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [tableName]);
        targetTableStructures.set(tableName, columns);
      }

      // 4. 为每个源表生成智能映射
      const syncTasks = [];

      for (const sourceTableName of sourceTableNames) {
        // 获取源表结构
        const [sourceColumns] = await sourceConnection.query(`
          SELECT COLUMN_NAME as field, DATA_TYPE as type
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [sourceConnection.config.database, sourceTableName]);

        // 识别表类型
        const tableType = this.identifyTableType(sourceTableName, sourceColumns);

        if (!tableType) {
          log.debug(`⏭️  跳过表: ${sourceTableName} (无法识别类型)`);
          continue;
        }

        // 查找匹配的目标表
        const targetTableName = targetTableNames.find(t => t === tableType);

        if (!targetTableName) {
          log.debug(`⏭️  跳过表: ${sourceTableName} (目标表 ${tableType} 不存在)`);
          continue;
        }

        const targetColumns = targetTableStructures.get(targetTableName);

        // 生成字段映射
        const fieldMappings = this.generateSmartMapping(sourceColumns, targetColumns);

        // 推断匹配字段
        const keyFields = this.inferKeyFields(tableType, sourceColumns, targetColumns);

        // 推断同步模式
        const syncMode = this.inferSyncMode(tableType);

        syncTasks.push({
          name: `${sourceTableName} → ${targetTableName}`,
          sourceTable: sourceTableName,
          targetTable: targetTableName,
          fieldMappings,
          syncOptions: {
            mode: syncMode,
            keyFields,
            batchSize: 100,
            autoCreateRelated: true,
            // 🔄 启用智能冲突保护（保护本地已售数据）
            conflictResolution: 'protectLocal',
            protectedFields: this.getDefaultProtectedFields(tableType)
          }
        });

        log.debug(`✅ 识别成功: ${sourceTableName} → ${targetTableName}`);
        log.debug(`   匹配字段: ${keyFields.join(', ')}`);
        log.debug(`   同步模式: ${syncMode}\n`);
      }

      // 5. 执行所有同步任务
      log.debug(`\n📝 共生成 ${syncTasks.length} 个同步任务`);
      log.debug('开始执行同步...\n');

      const results = [];

      for (let i = 0; i < syncTasks.length; i++) {
        const task = syncTasks[i];
        log.debug(`【任务 ${i + 1}/${syncTasks.length}】${task.name}`);

        // 保存映射配置
        const configId = `smart_${task.sourceTable}_${Date.now()}`;
        this.syncService.saveMappingConfig({
          id: configId,
          ...task
        });

        // 执行同步
        const result = await this.syncService.executeSync(
          connectionId,
          configId,
          targetConnection,
          user
        );

        if (result.success) {
          log.debug(`✅ ${task.name} 完成:`);
          log.debug(`   插入: ${result.stats.inserted} 条`);
          log.debug(`   更新: ${result.stats.updated} 条`);
          log.debug(`   跳过: ${result.stats.skipped} 条`);
          if (result.stats.failed > 0) {
            log.debug(`   失败: ${result.stats.failed} 条`);
          }
        } else {
          log.debug(`❌ ${task.name} 失败: ${result.message}`);
        }

        log.debug();
        results.push({
          task: task.name,
          ...result
        });
      }

      // 6. 输出总结
      const totalStats = {
        inserted: 0,
        updated: 0,
        skipped: 0,
        failed: 0
      };

      results.forEach(r => {
        if (r.stats) {
          totalStats.inserted += r.stats.inserted;
          totalStats.updated += r.stats.updated;
          totalStats.skipped += r.stats.skipped;
          totalStats.failed += r.stats.failed;
        }
      });

      log.debug('========================================');
      log.debug('🎉 一键智能同步完成！');
      log.debug('========================================');
      log.debug(`总插入: ${totalStats.inserted} 条`);
      log.debug(`总更新: ${totalStats.updated} 条`);
      log.debug(`总跳过: ${totalStats.skipped} 条`);
      if (totalStats.failed > 0) {
        log.debug(`总失败: ${totalStats.failed} 条`);
      }
      log.debug('========================================\n');

      return {
        success: true,
        results,
        summary: totalStats
      };

    } catch (error) {
      log.error('❌ 智能同步失败:', error);
      return {
        success: false,
        message: error.message
      };
    } finally {
      targetConnection.release();
    }
  }

  /**
   * 推断匹配字段
   */
  inferKeyFields(tableType, sourceColumns, targetColumns) {
    const sourceFields = sourceColumns.map(c => c.field.toLowerCase());

    const keyFieldRules = {
      phones: ['imei', 'serial_number'],
      customers: ['phone'],
      sales: ['phone_id'],
      brands: ['name'],
      models: ['name'],
      colors: ['name'],
      memories: ['size'],
      suppliers: ['name'],
      stores: ['name'],
      users: ['username', 'name']
    };

    const rules = keyFieldRules[tableType] || [];

    // 返回第一个找到的匹配字段
    for (const rule of rules) {
      if (sourceFields.includes(rule)) {
        return [sourceColumns.find(c => c.field.toLowerCase() === rule).field];
      }
    }

    return [];
  }

  /**
   * 推断同步模式
   */
  inferSyncMode(tableType) {
    // 主表使用 upsert，基础数据表使用 insert
    const mainTables = ['phones', 'customers', 'sales'];
    return mainTables.includes(tableType) ? 'upsert' : 'insert';
  }

  /**
   * 获取默认的保护字段配置
   */
  getDefaultProtectedFields(tableType) {
    const protectionConfigs = {
      phones: {
        rules: [
          {
            // 规则：本地已售，云端在库 → 保护本地数据
            condition: (existing, incoming) => {
              const localSold = existing.sale_status === 'sold' ||
                              existing.status === 'sold' ||
                              existing.sold_date ||
                              existing.customer_id;
              const cloudAvailable = incoming.sale_status === 'available' ||
                                     incoming.status === 'available' ||
                                     (!incoming.sold_date && !incoming.customer_id);
              return localSold && cloudAvailable;
            },
            protectFields: ['sale_status', 'status', 'sold_date', 'customer_id', 'sale_price', 'sale_operator_id']
          },
          {
            // 规则：本地有销售记录，保护销售相关字段
            condition: (existing, incoming) => {
              return existing.sold_date || existing.customer_id;
            },
            protectFields: ['sold_date', 'customer_id', 'sale_price', 'sale_operator_id']
          },
          {
            // 规则：本地销售价格 > 0，保护价格
            condition: (existing, incoming) => {
              return existing.sale_price && existing.sale_price > 0;
            },
            protectFields: ['sale_price']
          }
        ]
      },
      customers: {
        rules: [
          {
            // 规则：保护本地客户的消费数据
            condition: (existing, incoming) => {
              return existing.total_consumption && existing.total_consumption > 0;
            },
            protectFields: ['total_consumption', 'member_level', 'points']
          }
        ]
      },
      sales: {
        rules: [
          {
            // 规则：保护本地销售记录的完整性
            condition: (existing, incoming) => {
              // 如果本地有完整销售信息，保护核心字段
              return existing.sale_price && existing.customer_id;
            },
            protectFields: ['sale_price', 'customer_id', 'sale_operator_id', 'sale_date']
          }
        ]
      }
    };

    return protectionConfigs[tableType] || null;
  }
}

module.exports = SmartSyncService;
