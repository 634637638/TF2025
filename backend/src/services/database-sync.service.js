/**
 * 跨数据库同步服务
 * 支持连接外部数据库，进行数据映射、匹配和同步
 */
const mysql = require('mysql2/promise');
const log = require('../utils/log');

class DatabaseSyncService {
  constructor() {
    // 存储外部数据库连接
    this.externalConnections = new Map();
    // 存储数据映射配置
    this.mappingConfigs = new Map();
    // 同步任务状态
    this.syncTasks = new Map();
  }

  /**
   * 创建外部数据库连接
   */
  async createConnection(config) {
    const { id, host, port, user, password, database } = config;

    try {
      // 测试连接
      const connection = await mysql.createConnection({
        host,
        port: port || 3306,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
      });

      // 存储连接
      this.externalConnections.set(id, {
        connection,
        config: {
          id,
          host,
          port,
          user,
          database
        },
        connectedAt: new Date()
      });

      return {
        success: true,
        message: '数据库连接成功',
        connectionId: id
      };
    } catch (error) {
      return {
        success: false,
        message: `数据库连接失败: ${error.message}`,
        error: error.code
      };
    }
  }

  /**
   * 获取数据库连接
   */
  getConnection(connectionId) {
    const conn = this.externalConnections.get(connectionId);
    if (!conn) {
      throw new Error('数据库连接不存在');
    }
    return conn.connection;
  }

  /**
   * 关闭数据库连接
   */
  async closeConnection(connectionId) {
    const conn = this.externalConnections.get(connectionId);
    if (!conn) {
      throw new Error('数据库连接不存在');
    }

    try {
      await conn.connection.end();
      this.externalConnections.delete(connectionId);
      return { success: true, message: '连接已关闭' };
    } catch (error) {
      return {
        success: false,
        message: `关闭连接失败: ${error.message}`
      };
    }
  }

  /**
   * 获取所有连接
   */
  getConnections() {
    const connections = [];
    for (const [id, conn] of this.externalConnections.entries()) {
      connections.push({
        id,
        host: conn.config.host,
        port: conn.config.port,
        user: conn.config.user,
        database: conn.config.database,
        connectedAt: conn.connectedAt
      });
    }
    return connections;
  }

  /**
   * 获取外部数据库的表列表
   */
  async getTables(connectionId) {
    const connection = this.getConnection(connectionId);

    try {
      const [rows] = await connection.query('SHOW TABLES');
      const tables = rows.map(row => Object.values(row)[0]);

      return {
        success: true,
        tables
      };
    } catch (error) {
      return {
        success: false,
        message: `获取表列表失败: ${error.message}`
      };
    }
  }

  /**
   * 获取表结构
   */
  async getTableStructure(connectionId, tableName) {
    const connection = this.getConnection(connectionId);

    try {
      // 获取列信息
      const [columns] = await connection.query(`
        SELECT
          COLUMN_NAME as field,
          DATA_TYPE as type,
          IS_NULLABLE as nullable,
          COLUMN_KEY as column_key,
          COLUMN_DEFAULT as default,
          EXTRA as extra,
          COLUMN_COMMENT as comment
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [connection.config.database, tableName]);

      // 获取表注释
      const [tableComment] = await connection.query(`
        SELECT TABLE_COMMENT as comment
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [connection.config.database, tableName]);

      // 获取记录数
      const [count] = await connection.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);

      return {
        success: true,
        table: tableName,
        comment: tableComment[0]?.comment || '',
        recordCount: count[0].total,
        columns
      };
    } catch (error) {
      return {
        success: false,
        message: `获取表结构失败: ${error.message}`
      };
    }
  }

  /**
   * 获取表数据（预览）
   */
  async getTableData(connectionId, tableName, options = {}) {
    const connection = this.getConnection(connectionId);

    try {
      const {
        limit = 10,
        offset = 0,
        where = '',
        orderBy = ''
      } = options;

      let query = `SELECT * FROM \`${tableName}\``;
      const params = [];

      if (where) {
        query += ` WHERE ${where}`;
      }

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await connection.query(query, params);

      // 获取总数
      let countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\``;
      const [countResult] = await connection.query(countQuery);

      return {
        success: true,
        data: rows,
        pagination: {
          total: countResult[0].total,
          limit,
          offset
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `获取表数据失败: ${error.message}`
      };
    }
  }

  /**
   * 保存数据映射配置
   */
  saveMappingConfig(config) {
    const { id, sourceTable, targetTable, fieldMappings, syncOptions } = config;

    this.mappingConfigs.set(id, {
      id,
      sourceTable,
      targetTable,
      fieldMappings, // { sourceField: targetField }
      syncOptions: {
        mode: syncOptions?.mode || 'insert', // insert, update, upsert
        keyFields: syncOptions?.keyFields || [], // 用于匹配更新的字段
        batchSize: syncOptions?.batchSize || 100,
        ...syncOptions
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return {
      success: true,
      message: '映射配置已保存',
      configId: id
    };
  }

  /**
   * 获取映射配置
   */
  getMappingConfig(configId) {
    return this.mappingConfigs.get(configId);
  }

  /**
   * 获取所有映射配置
   */
  getAllMappingConfigs() {
    return Array.from(this.mappingConfigs.values());
  }

  /**
   * 删除映射配置
   */
  deleteMappingConfig(configId) {
    const deleted = this.mappingConfigs.delete(configId);
    return {
      success: deleted,
      message: deleted ? '配置已删除' : '配置不存在'
    };
  }

  /**
   * 数据预检查（匹配检查）
   */
  async preCheckSync(connectionId, configId, targetConnection) {
    const config = this.getMappingConfig(configId);
    if (!config) {
      throw new Error('映射配置不存在');
    }

    const sourceConnection = this.getConnection(connectionId);

    try {
      const { sourceTable, targetTable, fieldMappings, syncOptions } = config;

      // 获取源数据
      const [sourceData] = await sourceConnection.query(`SELECT * FROM \`${sourceTable}\``);

      // 获取目标数据（用于检查匹配）
      const [targetData] = await targetConnection.query(`SELECT * FROM \`${targetTable}\``);

      // 分析数据
      const analysis = {
        total: sourceData.length,
        newRecords: 0,
        updateRecords: 0,
        skipRecords: 0,
        sampleMatches: []
      };

      // 构建目标数据的键映射
      const targetKeyMap = new Map();
      for (const row of targetData) {
        const key = syncOptions.keyFields
          .map(f => String(row[f] || '').trim())
          .join('|');
        targetKeyMap.set(key, row);
      }

      // 检查每条源数据
      for (const row of sourceData) {
        const key = syncOptions.keyFields
          .map(f => String(row[f] || '').trim())
          .join('|');

        if (targetKeyMap.has(key)) {
          analysis.updateRecords++;
          if (analysis.sampleMatches.length < 10) {
            analysis.sampleMatches.push({
              key,
              source: row,
              target: targetKeyMap.get(key)
            });
          }
        } else {
          analysis.newRecords++;
        }
      }

      return {
        success: true,
        analysis
      };
    } catch (error) {
      return {
        success: false,
        message: `预检查失败: ${error.message}`
      };
    }
  }

  /**
   * 执行数据同步
   */
  async executeSync(connectionId, configId, targetConnection, user = null) {
    const config = this.getMappingConfig(configId);
    if (!config) {
      throw new Error('映射配置不存在');
    }

    const sourceConnection = this.getConnection(connectionId);
    const syncId = `${configId}-${Date.now()}`;

    try {
      // 初始化同步任务
      this.syncTasks.set(syncId, {
        status: 'processing',
        progress: 0,
        message: '正在准备同步...',
        stats: {
          total: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          failed: 0
        }
      });

      const { sourceTable, targetTable, fieldMappings, syncOptions } = config;

      // 更新进度
      this.updateSyncProgress(syncId, 5, '正在读取源数据...');

      // 获取源数据
      const [sourceData] = await sourceConnection.query(`SELECT * FROM \`${sourceTable}\``);

      this.updateSyncProgress(syncId, 10, `共 ${sourceData.length} 条数据，开始同步...`);

      // 构建数据映射（用于自动创建关联数据）
      this.updateSyncProgress(syncId, 12, '正在构建基础数据映射...');
      const dataMaps = await this.buildDataMaps(targetConnection);

      // 如果是替换模式，先清空目标表
      if (syncOptions.mode === 'replace') {
        await targetConnection.query(`DELETE FROM \`${targetTable}\``);
        this.updateSyncProgress(syncId, 15, '已清空目标表，开始插入...');
      }

      // 批量处理
      const batchSize = syncOptions.batchSize || 100;
      let processed = 0;

      for (let i = 0; i < sourceData.length; i += batchSize) {
        const batch = sourceData.slice(i, i + batchSize);

        await targetConnection.beginTransaction();

        try {
          for (const row of batch) {
            const result = await this.syncRow(
              targetConnection,
              targetTable,
              row,
              fieldMappings,
              syncOptions,
              dataMaps // 传递数据映射
            );

            this.syncTasks.get(syncId).stats[result.status]++;
          }

          await targetConnection.commit();

          processed += batch.length;
          const progress = 10 + Math.floor((processed / sourceData.length) * 85);
          this.updateSyncProgress(syncId, progress, `已处理 ${processed}/${sourceData.length} 条数据`);
        } catch (error) {
          await targetConnection.rollback();
          throw error;
        }
      }

      // 完成
      this.updateSyncProgress(syncId, 100, '同步完成');
      this.syncTasks.get(syncId).status = 'completed';

      return {
        success: true,
        syncId,
        stats: this.syncTasks.get(syncId).stats
      };
    } catch (error) {
      this.updateSyncProgress(syncId, -1, `同步失败: ${error.message}`);
      this.syncTasks.get(syncId).status = 'failed';

      return {
        success: false,
        message: error.message,
        syncId
      };
    }
  }

  /**
   * 同步单行数据（增强版：自动创建关联数据 + 双向同步）
   */
  async syncRow(connection, table, sourceRow, fieldMappings, syncOptions, dataMaps = null, sourceConnection = null) {
    // 映射字段
    const targetRow = {};
    for (const [sourceField, targetField] of Object.entries(fieldMappings)) {
      if (targetField && sourceRow[sourceField] !== undefined) {
        targetRow[targetField] = sourceRow[sourceField];
      }
    }

    const mode = syncOptions.mode || 'insert';
    const keyFields = syncOptions.keyFields || [];

    // 自动创建关联的基础数据（品牌、型号、颜色、内存、供应商、店铺、客户）
    if (dataMaps && syncOptions.autoCreateRelated !== false) {
      // 品牌映射
      if (targetRow.brand_id && typeof targetRow.brand_id === 'string') {
        targetRow.brand_id = await this.getOrCreateRelatedData(
          connection,
          'brands',
          'name',
          targetRow.brand_id,
          dataMaps.brands
        );
      }

      // 型号映射
      if (targetRow.model_id && typeof targetRow.model_id === 'string') {
        targetRow.model_id = await this.getOrCreateRelatedData(
          connection,
          'models',
          'name',
          targetRow.model_id,
          dataMaps.models
        );
      }

      // 颜色映射
      if (targetRow.color_id && typeof targetRow.color_id === 'string') {
        targetRow.color_id = await this.getOrCreateRelatedData(
          connection,
          'colors',
          'name',
          targetRow.color_id,
          dataMaps.colors
        );
      }

      // 内存映射
      if (targetRow.memory_id && typeof targetRow.memory_id === 'string') {
        targetRow.memory_id = await this.getOrCreateRelatedData(
          connection,
          'memories',
          'size',
          targetRow.memory_id,
          dataMaps.memories
        );
      }

      // 供应商映射
      if (targetRow.supplier_id && typeof targetRow.supplier_id === 'string') {
        targetRow.supplier_id = await this.getOrCreateRelatedData(
          connection,
          'suppliers',
          'name',
          targetRow.supplier_id,
          dataMaps.suppliers
        );
      }

      // 店铺映射
      if (targetRow.store_id && typeof targetRow.store_id === 'string') {
        targetRow.store_id = await this.getOrCreateRelatedData(
          connection,
          'stores',
          'name',
          targetRow.store_id,
          dataMaps.stores
        );
      }

      // 客户映射
      if (targetRow.customer_id && typeof targetRow.customer_id === 'string') {
        // 对于客户，需要特殊处理（可能有名字和电话）
        const customerName = targetRow.customer_name || sourceRow['customer_name'] || '';
        const customerPhone = targetRow.customer_id; // 假设customer_id存储的是电话
        if (customerPhone) {
          targetRow.customer_id = await this.getOrCreateCustomer(
            connection,
            { name: customerName, phone: customerPhone },
            dataMaps.customers
          );
        }
      }

      // 操作员映射
      if (targetRow.inventory_operator_id && typeof targetRow.inventory_operator_id === 'string') {
        targetRow.inventory_operator_id = await this.getOrCreateRelatedData(
          connection,
          'users',
          'name',
          targetRow.inventory_operator_id,
          dataMaps.users
        );
      }

      if (targetRow.sale_operator_id && typeof targetRow.sale_operator_id === 'string') {
        targetRow.sale_operator_id = await this.getOrCreateRelatedData(
          connection,
          'users',
          'name',
          targetRow.sale_operator_id,
          dataMaps.users
        );
      }
    }

    // 如果有键字段，检查是否存在
    if (keyFields.length > 0 && (mode === 'update' || mode === 'upsert')) {
      const whereConditions = keyFields.map(f => `\`${f}\` = ?`);
      const whereValues = keyFields.map(f => targetRow[f]);

      const [existing] = await connection.query(
        `SELECT * FROM \`${table}\` WHERE ${whereConditions.join(' AND ')} LIMIT 1`,
        whereValues
      );

      if (existing.length > 0) {
        // 已存在，执行智能双向同步
        const existingRecord = existing[0];

        // 🔄 双向同步策略：本地已售 → 更新云端
        if (syncOptions.bidirectionalSync) {
          return await this.handleBidirectionalSync(
            connection,
            table,
            existingRecord,
            targetRow,
            keyFields,
            syncOptions,
            sourceConnection
          );
        }

        // 🔄 智能冲突处理：保护本地重要状态
        if (syncOptions.conflictResolution === 'protectLocal') {
          // 检查是否存在需要保护的字段差异
          const conflictFields = this.checkProtectedFields(table, existingRecord, targetRow, syncOptions.protectedFields);

          if (conflictFields.hasConflict) {
            // 有冲突，跳过更新，保护本地数据
            log.debug(`⚠️ 检测到数据冲突，跳过更新: ${conflictFields.fields.join(', ')}`);
            return {
              status: 'skipped',
              reason: 'conflict',
              conflictFields: conflictFields.fields,
              message: '本地数据受保护，跳过云端更新'
            };
          }
        }

        // 更新
        if (mode === 'update' || mode === 'upsert') {
          const setClause = Object.keys(targetRow)
            .filter(k => !keyFields.includes(k))
            .map(f => `\`${f}\` = ?`)
            .join(', ');
          const setValues = Object.keys(targetRow)
            .filter(k => !keyFields.includes(k))
            .map(k => targetRow[k]);

          if (setClause) {
            await connection.query(
              `UPDATE \`${table}\` SET ${setClause} WHERE ${whereConditions.join(' AND ')}`,
              [...setValues, ...whereValues]
            );
            return { status: 'updated' };
          }
        }
        return { status: 'skipped' };
      }
    }

    // 不存在或插入模式，插入新记录
    const fields = Object.keys(targetRow);
    const values = Object.values(targetRow);

    if (fields.length > 0) {
      try {
        await connection.query(
          `INSERT INTO \`${table}\` (\`${fields.join('`, `')}\`) VALUES (${fields.map(() => '?').join(', ')})`,
          values
        );
        return { status: 'inserted' };
      } catch (error) {
        log.error('插入数据失败:', error.message);
        log.debug('数据:', JSON.stringify(targetRow, null, 2));
        return { status: 'failed', error: error.message };
      }
    }

    return { status: 'skipped' };
  }

  /**
   * 获取或创建关联数据
   */
  async getOrCreateRelatedData(connection, table, field, value, map) {
    if (!value) return null;

    // 检查是否已存在于映射中
    if (map.has(value)) {
      return map.get(value);
    }

    // 检查数据库中是否存在
    const [existing] = await connection.query(
      `SELECT id FROM \`${table}\` WHERE \`${field}\` = ? LIMIT 1`,
      [value]
    );

    if (existing.length > 0) {
      const id = existing[0].id;
      map.set(value, id);
      return id;
    }

    // 不存在，创建新记录
    const [result] = await connection.query(
      `INSERT INTO \`${table}\` (\`${field}\`, status) VALUES (?, 1)`,
      [value]
    );

    const id = result.insertId;
    map.set(value, id);

    log.debug(`✅ 自动创建 ${table}: ${value} (ID: ${id})`);

    return id;
  }

  /**
   * 获取或创建客户
   */
  async getOrCreateCustomer(connection, customerData, map) {
    const { name, phone } = customerData;
    if (!phone) return null;

    // 检查是否已存在于映射中
    if (map.has(phone)) {
      return map.get(phone);
    }

    // 检查数据库中是否存在
    const [existing] = await connection.query(
      `SELECT id FROM customers WHERE phone = ? LIMIT 1`,
      [phone]
    );

    if (existing.length > 0) {
      const id = existing[0].id;
      map.set(phone, id);
      return id;
    }

    // 不存在，创建新客户
    const registerDate = customerData.register_date || new Date().toISOString().slice(0, 10);

    // 生成会员号：从 TF10000 开始递增
    const [maxMember] = await connection.query(
      `SELECT member_number FROM customers WHERE member_number LIKE 'TF%' ORDER BY CAST(SUBSTRING(member_number, 3) AS UNSIGNED) DESC LIMIT 1`
    );

    let nextNumber = 10000;
    if (maxMember.length > 0 && maxMember[0].member_number) {
      const currentNum = parseInt(maxMember[0].member_number.replace('TF', ''), 10);
      if (!isNaN(currentNum) && currentNum >= 10000) {
        nextNumber = currentNum + 1;
      }
    }

    const memberNumber = 'TF' + nextNumber;

    const [result] = await connection.query(
      `INSERT INTO customers (name, phone, member_number, customer_type, status, created_at)
       VALUES (?, ?, ?, 'individual', 1, ?)`,
      [name || '未知', phone, memberNumber, registerDate]
    );

    const id = result.insertId;
    map.set(phone, id);

    log.debug(`✅ 自动创建客户: ${name} (${phone}) - 会员号: ${memberNumber} (ID: ${id})`);

    return id;
  }

  /**
   * 构建数据映射（用于自动创建关联数据）
   */
  async buildDataMaps(connection) {
    const maps = {
      brands: new Map(),
      models: new Map(),
      colors: new Map(),
      memories: new Map(),
      suppliers: new Map(),
      stores: new Map(),
      customers: new Map(),
      users: new Map()
    };

    try {
      // 获取现有品牌
      const [brands] = await connection.execute('SELECT id, name FROM brands WHERE status = 1');
      brands.forEach(item => maps.brands.set(item.name, item.id));

      // 获取现有型号
      const [models] = await connection.execute('SELECT id, name FROM models WHERE status = 1');
      models.forEach(item => maps.models.set(item.name, item.id));

      // 获取现有颜色
      const [colors] = await connection.execute('SELECT id, name FROM colors WHERE status = 1');
      colors.forEach(item => maps.colors.set(item.name, item.id));

      // 获取现有内存
      const [memories] = await connection.execute('SELECT id, size FROM memories WHERE status = 1');
      memories.forEach(item => maps.memories.set(item.size, item.id));

      // 获取现有供应商
      const [suppliers] = await connection.execute('SELECT id, name FROM suppliers WHERE status = 1');
      suppliers.forEach(item => maps.suppliers.set(item.name, item.id));

      // 获取现有店铺
      const [stores] = await connection.execute('SELECT id, name FROM stores WHERE status = 1');
      stores.forEach(item => maps.stores.set(item.name, item.id));

      // 获取现有客户
      const [customers] = await connection.execute('SELECT id, phone FROM customers WHERE status = 1');
      customers.forEach(item => maps.customers.set(item.phone, item.id));

      // 获取现有用户
      const [users] = await connection.execute('SELECT id, name FROM users WHERE status = 1');
      users.forEach(item => maps.users.set(item.name, item.id));

      log.debug('✅ 数据映射构建完成:');
      log.debug(`  品牌: ${maps.brands.size}`);
      log.debug(`  型号: ${maps.models.size}`);
      log.debug(`  颜色: ${maps.colors.size}`);
      log.debug(`  内存: ${maps.memories.size}`);
      log.debug(`  供应商: ${maps.suppliers.size}`);
      log.debug(`  店铺: ${maps.stores.size}`);
      log.debug(`  客户: ${maps.customers.size}`);
      log.debug(`  用户: ${maps.users.size}`);
    } catch (error) {
      log.error('构建数据映射失败:', error);
    }

    return maps;
  }

  /**
   * 更新同步进度
   */
  updateSyncProgress(syncId, progress, message) {
    const task = this.syncTasks.get(syncId);
    if (task) {
      task.progress = progress;
      task.message = message;
    }
  }

  /**
   * 获取同步进度
   */
  getSyncProgress(syncId) {
    return this.syncTasks.get(syncId);
  }

  /**
   * 智能字段映射建议
   */
  async suggestFieldMapping(connectionId, sourceTable, targetTable, targetConnection) {
    const sourceConnection = this.getConnection(connectionId);

    try {
      // 获取源表结构
      const sourceStructure = await this.getTableStructure(connectionId, sourceTable);

      // 获取目标表结构
      const targetStructure = await this.getTableStructure(
        null,
        targetTable,
        targetConnection
      );

      if (!sourceStructure.success || !targetStructure.success) {
        throw new Error('获取表结构失败');
      }

      // 智能匹配字段
      const suggestions = {};
      const sourceColumns = sourceStructure.columns.map(c => c.field);
      const targetColumns = targetStructure.columns.map(c => c.field);

      for (const sourceField of sourceColumns) {
        // 尝试完全匹配
        if (targetColumns.includes(sourceField)) {
          suggestions[sourceField] = sourceField;
          continue;
        }

        // 尝试相似匹配
        const similar = targetColumns.find(t => this.isSimilarField(sourceField, t));
        if (similar) {
          suggestions[sourceField] = similar;
        }
      }

      return {
        success: true,
        suggestions,
        sourceFields: sourceColumns,
        targetFields: targetColumns
      };
    } catch (error) {
      return {
        success: false,
        message: `生成映射建议失败: ${error.message}`
      };
    }
  }

  /**
   * 判断字段是否相似
   */
  isSimilarField(field1, field2) {
    // 常见别名映射
    const aliases = {
      'id': ['id', 'ID'],
      'name': ['name', 'title', 'label', '名称'],
      'phone': ['phone', 'telephone', 'mobile', 'contact', '电话', '手机'],
      'email': ['email', 'mail', '邮箱'],
      'created_at': ['created_at', 'create_time', 'createdAt', '创建时间'],
      'updated_at': ['updated_at', 'update_time', 'updatedAt', '更新时间'],
      'status': ['status', 'state', '状态']
    };

    const f1 = field1.toLowerCase().replace(/[_\s]/g, '');
    const f2 = field2.toLowerCase().replace(/[_\s]/g, '');

    if (f1 === f2) return true;

    for (const [key, values] of Object.entries(aliases)) {
      if (values.map(v => v.toLowerCase().replace(/[_\s]/g, '')).includes(f1) &&
          values.map(v => v.toLowerCase().replace(/[_\s]/g, '')).includes(f2)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查受保护字段是否存在冲突
   * @param {string} table - 表名
   * @param {object} existing - 本地现有记录
   * @param {object} incoming - 云端导入记录
   * @param {object} protectedFields - 受保护字段配置
   * @returns {object} { hasConflict: boolean, fields: string[] }
   */
  checkProtectedFields(table, existing, incoming, protectedFields = null) {
    // 默认保护规则
    const defaultProtection = {
      phones: {
        // 如果本地已售，保护这些字段不被云端"在库"状态覆盖
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
            // 本地已售时保护这些字段
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
      }
    };

    const tableProtection = protectedFields || defaultProtection[table];
    if (!tableProtection) {
      return { hasConflict: false, fields: [] };
    }

    const conflicts = [];

    // 检查每条保护规则
    for (const rule of tableProtection.rules || []) {
      if (rule.condition(existing, incoming)) {
        // 检查字段是否有差异
        for (const field of rule.protectFields) {
          if (existing[field] !== incoming[field]) {
            conflicts.push({
              field,
              local: existing[field],
              cloud: incoming[field],
              rule: rule.condition.toString()
            });
          }
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      fields: conflicts.map(c => c.field),
      details: conflicts
    };
  }
}

module.exports = DatabaseSyncService;
