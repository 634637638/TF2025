/**
 * 本地到云端数据同步服务
 * 将本地最新的数据同步到云端数据库
 * 本地数据是权威来源，云端数据会被更新
 */
const DatabaseSyncService = require('./database-sync.service');
const log = require('../utils/log');

class LocalToCloudSyncService {
  constructor() {
    this.syncService = new DatabaseSyncService();
  }

  /**
   * 本地数据同步到云端
   * @param {string} connectionId - 云端数据库连接ID
   * @param {object} options - 同步选项
   */
  async syncLocalToCloud(connectionId, options = {}) {
    const {
      tables = ['phones', 'customers', 'sales', 'brands', 'models', 'colors', 'memories'],
      syncMode = 'update', // update: 只更新已存在的，upsert: 更新或插入
      autoCreateRelations = true,
      dryRun = false // 预演模式，不实际执行
    } = options;

    const cloudConnection = this.syncService.getConnection(connectionId);
    const localConnection = await require('../config/database').getDatabase().getConnection();

    try {
      log.debug('🚀 开始本地到云端同步...\n');

      const results = [];
      const stats = {
        total: 0,
        updated: 0,
        inserted: 0,
        skipped: 0,
        failed: 0,
        relationsCreated: 0
      };

      // 1. 先获取云端的数据映射（品牌、型号、颜色、内存、客户）
      log.debug('📊 构建云端数据映射...');
      const cloudDataMaps = await this.buildCloudDataMaps(cloudConnection);

      // 2. 同步基础数据表（品牌、型号、颜色、内存）
      const baseTables = ['brands', 'models', 'colors', 'memories'];
      for (const tableName of baseTables) {
        if (!tables.includes(tableName)) continue;

        log.debug(`\n【${tableName}】同步基础数据...`);
        const result = await this.syncTableToCloud(
          localConnection,
          cloudConnection,
          tableName,
          {
            ...options,
            syncMode: 'upsert', // 基础数据使用 upsert
            cloudDataMaps
          }
        );

        results.push({ table: tableName, ...result });
        stats.total += result.total;
        stats.updated += result.updated;
        stats.inserted += result.inserted;
        stats.skipped += result.skipped;
        stats.failed += result.failed;
      }

      // 3. 同步客户数据
      if (tables.includes('customers')) {
        log.debug(`\n【customers】同步客户数据...`);
        const result = await this.syncTableToCloud(
          localConnection,
          cloudConnection,
          'customers',
          {
            ...options,
            syncMode: 'upsert',
            keyFields: ['phone'], // 根据手机号匹配
            fieldMappings: this.getCustomerFieldMappings(),
            cloudDataMaps
          }
        );

        results.push({ table: 'customers', ...result });
        stats.total += result.total;
        stats.updated += result.updated;
        stats.inserted += result.inserted;
        stats.skipped += result.skipped;
        stats.failed += result.failed;
      }

      // 4. 同步手机数据（最重要）
      if (tables.includes('phones')) {
        log.debug(`\n【phones】同步手机数据...`);
        const result = await this.syncPhonesToCloud(
          localConnection,
          cloudConnection,
          {
            ...options,
            cloudDataMaps
          }
        );

        results.push({ table: 'phones', ...result });
        stats.total += result.total;
        stats.updated += result.updated;
        stats.inserted += result.inserted;
        stats.skipped += result.skipped;
        stats.failed += result.failed;
        stats.relationsCreated = result.relationsCreated || 0;
      }

      // 5. 同步销售记录
      if (tables.includes('sales')) {
        log.debug(`\n【sales】同步销售记录...`);
        const result = await this.syncTableToCloud(
          localConnection,
          cloudConnection,
          'sales',
          {
            ...options,
            syncMode: 'upsert',
            keyFields: ['phone_id'], // 根据手机ID匹配
            fieldMappings: this.getSalesFieldMappings(),
            cloudDataMaps
          }
        );

        results.push({ table: 'sales', ...result });
        stats.total += result.total;
        stats.updated += result.updated;
        stats.inserted += result.inserted;
        stats.skipped += result.skipped;
        stats.failed += result.failed;
      }

      // 6. 输出总结
      log.debug('\n========================================');
      log.debug('🎉 本地到云端同步完成！');
      log.debug('========================================');
      log.debug(`总处理: ${stats.total} 条`);
      log.debug(`已更新: ${stats.updated} 条（云端状态已更新为本地状态）`);
      log.debug(`新插入: ${stats.inserted} 条（云端新增）`);
      log.debug(`跳过: ${stats.skipped} 条（云端已有相同数据）`);
      if (stats.failed > 0) {
        log.debug(`失败: ${stats.failed} 条`);
      }
      log.debug(`关联数据创建: ${stats.relationsCreated} 条`);
      log.debug('========================================\n');

      return {
        success: true,
        results,
        summary: stats
      };

    } catch (error) {
      log.error('❌ 同步失败:', error);
      return {
        success: false,
        message: error.message
      };
    } finally {
      localConnection.release();
    }
  }

  /**
   * 构建云端数据映射（用于匹配和创建关联数据）
   */
  async buildCloudDataMaps(cloudConnection) {
    const maps = {
      brands: new Map(),
      models: new Map(),
      colors: new Map(),
      memories: new Map(),
      customers: new Map()
    };

    try {
      // 品牌
      const [brands] = await cloudConnection.query('SELECT id, name FROM brands WHERE status = 1');
      brands.forEach(item => maps.brands.set(item.name, item.id));

      // 型号
      const [models] = await cloudConnection.query('SELECT id, name, brand_id FROM models WHERE status = 1');
      models.forEach(item => maps.models.set(`${item.brand_id}:${item.name}`, item.id));

      // 颜色
      const [colors] = await cloudConnection.query('SELECT id, name FROM colors WHERE status = 1');
      colors.forEach(item => maps.colors.set(item.name, item.id));

      // 内存
      const [memories] = await cloudConnection.query('SELECT id, size FROM memories WHERE status = 1');
      memories.forEach(item => maps.memories.set(item.size, item.id));

      // 客户
      const [customers] = await cloudConnection.query('SELECT id, phone, name FROM customers WHERE status = 1');
      customers.forEach(item => maps.customers.set(item.phone, item.id));

      log.debug('✅ 云端数据映射构建完成');
    } catch (error) {
      log.error('⚠️ 构建云端数据映射失败:', error.message);
    }

    return maps;
  }

  /**
   * 同步手机数据到云端（特殊处理）
   */
  async syncPhonesToCloud(localConnection, cloudConnection, options) {
    const { cloudDataMaps, syncMode = 'upsert', dryRun = false } = options;

    // 获取本地所有手机数据
    const [localPhones] = await localConnection.query(`
      SELECT p.*,
        b.name as brand_name,
        mo.name as model_name,
        c.name as color_name,
        me.size as memory_size,
        st.name as store_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories me ON p.memory_id = me.id
      LEFT JOIN stores st ON p.store_id = st.id
      ORDER BY p.id
    `);

    log.debug(`📱 本地有 ${localPhones.length} 条手机数据`);

    const stats = { total: localPhones.length, updated: 0, inserted: 0, skipped: 0, failed: 0, relationsCreated: 0 };

    for (const localPhone of localPhones) {
      try {
        // 1. 在云端查找匹配的手机（通过IMEI）
        const [existing] = await cloudConnection.query(
          'SELECT * FROM phones WHERE imei = ? OR serial_number = ? LIMIT 1',
          [localPhone.imei, localPhone.serial_number]
        );

        // 2. 准备云端数据
        const cloudPhone = {
          // 基础字段
          imei: localPhone.imei,
          serial_number: localPhone.serial_number,
          purchase_price: localPhone.purchase_price,
          sale_price: localPhone.sale_price,
          purchase_cost: localPhone.purchase_cost,

          // 状态字段（以本地为准）
          sale_status: localPhone.sale_status || (localPhone.sold_date ? 'sold' : 'available'),
          status: localPhone.status || (localPhone.sold_date ? 'sold' : 'available'),
          sold_date: localPhone.sold_date,
          sale_date: localPhone.sale_date,

          // 关联字段（需要匹配或创建）
          brand_id: await this.getOrCreateCloudBrand(cloudConnection, localPhone.brand_name, cloudDataMaps.brands),
          model_id: await this.getOrCreateCloudModel(cloudConnection, localPhone.model_name, localPhone.brand_name, cloudDataMaps),
          color_id: await this.getOrCreateCloudColor(cloudConnection, localPhone.color_name, cloudDataMaps.colors),
          memory_id: await this.getOrCreateCloudMemory(cloudConnection, localPhone.memory_size, cloudDataMaps.memories),
          store_id: await this.getOrCreateCloudStore(cloudConnection, localPhone.store_name),
          customer_id: await this.getOrCreateCloudCustomer(cloudConnection, localPhone, cloudDataMaps),
          inventory_operator_id: await this.getOrCreateCloudUser(cloudConnection, localPhone.inventory_operator_name),
          sale_operator_id: await this.getOrCreateCloudUser(cloudConnection, localPhone.sale_operator_name),

          // 其他字段
          supplier_id: localPhone.supplier_id,
          remarks: localPhone.remarks,
          created_at: localPhone.created_at,
          updated_at: new Date()
        };

        // 3. 同步到云端
        let result;
        if (existing.length > 0) {
          // 已存在 - 更新
          if (syncMode === 'update' || syncMode === 'upsert') {
            const updateResult = await this.updateCloudPhone(cloudConnection, existing[0], cloudPhone, dryRun);
            result = updateResult;
            if (updateResult.status === 'updated') {
              stats.updated++;
              log.debug(`✅ 更新云端手机: ${localPhone.imei} (状态: ${cloudPhone.sale_status})`);
            } else {
              stats.skipped++;
            }
          } else {
            stats.skipped++;
          }
        } else {
          // 不存在 - 插入
          if (syncMode === 'insert' || syncMode === 'upsert') {
            const insertResult = await this.insertCloudPhone(cloudConnection, cloudPhone, dryRun);
            result = insertResult;
            if (insertResult.status === 'inserted') {
              stats.inserted++;
              log.debug(`✅ 新增云端手机: ${localPhone.imei}`);
            } else if (insertResult.status === 'failed') {
              stats.failed++;
            }
          } else {
            stats.skipped++;
          }
        }

      } catch (error) {
        log.error(`❌ 处理手机 ${localPhone.imei} 失败:`, error.message);
        stats.failed++;
      }
    }

    stats.relationsCreated = this.relationsCreatedCount;

    return { success: true, stats };
  }

  /**
   * 更新云端手机数据
   */
  async updateCloudPhone(connection, existing, newData, dryRun = false) {
    // 构建更新语句（只更新有差异的字段）
    const updates = [];
    const values = [];

    const fieldsToUpdate = ['sale_status', 'status', 'sold_date', 'sale_date', 'customer_id', 'sale_price', 'sale_operator_id',
                          'purchase_price', 'purchase_cost', 'remarks'];

    for (const field of fieldsToUpdate) {
      if (newData[field] !== undefined && newData[field] !== existing[field]) {
        updates.push(`\`${field}\` = ?`);
        values.push(newData[field]);
      }
    }

    if (updates.length === 0) {
      return { status: 'skipped' };
    }

    if (dryRun) {
      log.debug(`[预演] 将更新: ${existing.imei} - 更新字段: ${updates.join(', ')}`);
      return { status: 'updated' };
    }

    values.push(existing.id);

    await connection.query(
      `UPDATE phones SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return { status: 'updated' };
  }

  /**
   * 插入云端手机数据
   */
  async insertCloudPhone(connection, data, dryRun = false) {
    if (dryRun) {
      return { status: 'inserted' };
    }

    const fields = Object.keys(data).filter(k => data[k] !== null);
    const values = fields.map(k => data[k]);

    if (fields.length === 0) {
      return { status: 'skipped' };
    }

    try {
      const [result] = await connection.query(
        `INSERT INTO phones (\`${fields.join('`, `')}\`) VALUES (${fields.map(() => '?').join(', ')})`,
        values
      );
      return { status: 'inserted', id: result.insertId };
    } catch (error) {
      return { status: 'failed', error: error.message };
    }
  }

  /**
   * 获取或创建云端品牌
   */
  async getOrCreateCloudBrand(connection, brandName, brandMap) {
    if (!brandName) return null;

    // 检查是否已存在
    if (brandMap.has(brandName)) {
      return brandMap.get(brandName);
    }

    // 不存在，创建
    try {
      const [result] = await connection.query(
        'INSERT INTO brands (name, status, created_at, updated_at) VALUES (?, 1, NOW(), NOW())',
        [brandName]
      );
      const id = result.insertId;
      brandMap.set(brandName, id);
      this.relationsCreatedCount++;
      log.debug(`  ✅ 创建云端品牌: ${brandName} (ID: ${id})`);
      return id;
    } catch (error) {
      log.error(`  ⚠️ 创建品牌 ${brandName} 失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取或创建云端型号
   */
  async getOrCreateCloudModel(connection, modelName, brandName, modelMap) {
    if (!modelName) return null;

    // 先获取品牌ID
    const brandId = await this.getOrCreateCloudBrand(connection, brandName, modelMap);
    if (!brandId) return null;

    const key = `${brandId}:${modelName}`;

    // 检查是否已存在
    if (modelMap.has(key)) {
      return modelMap.get(key);
    }

    // 不存在，创建
    try {
      const [result] = await connection.query(
        'INSERT INTO models (name, brand_id, status, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
        [modelName, brandId]
      );
      const id = result.insertId;
      modelMap.set(key, id);
      this.relationsCreatedCount++;
      log.debug(`  ✅ 创建云端型号: ${modelName} (品牌ID: ${brandId}, ID: ${id})`);
      return id;
    } catch (error) {
      log.error(`  ⚠️ 创建型号 ${modelName} 失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取或创建云端颜色
   */
  async getOrCreateCloudColor(connection, colorName, colorMap) {
    if (!colorName) return null;

    if (colorMap.has(colorName)) {
      return colorMap.get(colorName);
    }

    try {
      const [result] = await connection.query(
        'INSERT INTO colors (name, status, created_at, updated_at) VALUES (?, 1, NOW(), NOW())',
        [colorName]
      );
      const id = result.insertId;
      colorMap.set(colorName, id);
      this.relationsCreatedCount++;
      log.debug(`  ✅ 创建云端颜色: ${colorName} (ID: ${id})`);
      return id;
    } catch (error) {
      log.error(`  ⚠️ 创建颜色 ${colorName} 失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取或创建云端内存
   */
  async getOrCreateCloudMemory(connection, memorySize, memoryMap) {
    if (!memorySize) return null;

    if (memoryMap.has(memorySize)) {
      return memoryMap.get(memorySize);
    }

    try {
      const [result] = await connection.query(
        'INSERT INTO memories (size, status, created_at, updated_at) VALUES (?, 1, NOW(), NOW())',
        [memorySize]
      );
      const id = result.insertId;
      memoryMap.set(memorySize, id);
      this.relationsCreatedCount++;
      log.debug(`  ✅ 创建云端内存: ${memorySize} (ID: ${id})`);
      return id;
    } catch (error) {
      log.error(`  ⚠️ 创建内存 ${memorySize} 失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取或创建云端店铺
   */
  async getOrCreateCloudStore(connection, storeName) {
    if (!storeName) return null;

    try {
      const [existing] = await connection.query(
        'SELECT id FROM stores WHERE name = ? LIMIT 1',
        [storeName]
      );

      if (existing.length > 0) {
        return existing[0].id;
      }

      const [result] = await connection.query(
        'INSERT INTO stores (name, status, created_at, updated_at) VALUES (?, 1, NOW(), NOW())',
        [storeName]
      );
      this.relationsCreatedCount++;
      log.debug(`  ✅ 创建云端店铺: ${storeName} (ID: ${result.insertId})`);
      return result.insertId;
    } catch (error) {
      log.error(`  ⚠️ 创建店铺 ${storeName} 失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取或创建云端客户
   */
  async getOrCreateCloudCustomer(connection, localPhone, customerMap) {
    // 从本地手机数据中提取客户信息
    const customerName = localPhone.customer_name || localPhone.customer_id || '';
    const customerPhone = localPhone.customer_phone || localPhone.customer_id || '';

    if (!customerPhone) return null;

    if (customerMap.has(customerPhone)) {
      return customerMap.get(customerPhone);
    }

    try {
      // 检查是否已存在
      const [existing] = await connection.query(
        'SELECT id FROM customers WHERE phone = ? LIMIT 1',
        [customerPhone]
      );

      if (existing.length > 0) {
        customerMap.set(customerPhone, existing[0].id);
        return existing[0].id;
      }

      // 创建新客户
      const registerDate = localPhone.created_at?.split('T')[0] || new Date().toISOString().slice(0, 10);

      const [result] = await connection.query(
        `INSERT INTO customers (name, phone, member_number, customer_type, status, created_at)
         VALUES (?, ?, (SELECT IFNULL(MAX(member_number), 'TF99999') + 1 FROM customers), 'individual', 1, ?)`,
        [customerName || '未知', customerPhone, registerDate]
      );

      const id = result.insertId;
      customerMap.set(customerPhone, id);
      this.relationsCreatedCount++;
      log.debug(`  ✅ 创建云端客户: ${customerName} (${customerPhone}) - ID: ${id}`);
      return id;
    } catch (error) {
      log.error(`  ⚠️ 创建客户失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取或创建云端用户
   */
  async getOrCreateCloudUser(connection, userName) {
    if (!userName) return null;

    try {
      const [existing] = await connection.query(
        'SELECT id FROM users WHERE username = ? OR name = ? LIMIT 1',
        [userName, userName]
      );

      if (existing.length > 0) {
        return existing[0].id;
      }

      const [result] = await connection.query(
        'INSERT INTO users (username, name, status, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
        [userName, userName]
      );

      this.relationsCreatedCount++;
      log.debug(`  ✅ 创建云端用户: ${userName} (ID: ${result.insertId})`);
      return result.insertId;
    } catch (error) {
      log.error(`  ⚠️ 创建用户 ${userName} 失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取客户字段映射
   */
  getCustomerFieldMappings() {
    return {
      name: 'name',
      phone: 'phone',
      member_number: 'member_number',
      total_consumption: 'total_consumption',
      member_level: 'member_level',
      points: 'points'
    };
  }

  /**
   * 获取销售字段映射
   */
  getSalesFieldMappings() {
    return {
      phone_id: 'phone_id',
      customer_id: 'customer_id',
      sale_price: 'sale_price',
      sale_operator_id: 'sale_operator_id',
      sale_date: 'sale_date',
      salestime: 'sale_date',
      remarks: 'remarks'
    };
  }

  /**
   * 通用表同步方法
   */
  async syncTableToCloud(localConnection, cloudConnection, tableName, options) {
    const { syncMode = 'upsert', keyFields = [], fieldMappings = null, dryRun = false } = options;

    // 获取本地数据
    const [localData] = await localConnection.query(`SELECT * FROM \`${tableName}\``);

    const stats = { total: localData.length, updated: 0, inserted: 0, skipped: 0, failed: 0 };

    for (const row of localData) {
      try {
        // 如果有键字段，检查是否存在
        if (keyFields.length > 0 && (syncMode === 'update' || syncMode === 'upsert')) {
          const whereConditions = keyFields.map(f => `\`${f}\` = ?`);
          const whereValues = keyFields.map(f => row[f]);

          const [existing] = await cloudConnection.query(
            `SELECT * FROM \`${tableName}\` WHERE ${whereConditions.join(' AND ')} LIMIT 1`,
            whereValues
          );

          if (existing.length > 0) {
            // 已存在 - 检查是否有差异
            const hasChanges = Object.keys(existing[0]).some(key => existing[0][key] !== row[key]);

            if (hasChanges && (syncMode === 'update' || syncMode === 'upsert')) {
              // 有差异，更新
              const setClause = Object.keys(row)
                .filter(k => !keyFields.includes(k))
                .map(f => `\`${f}\` = ?`)
                .join(', ');
              const setValues = Object.keys(row)
                .filter(k => !keyFields.includes(k))
                .map(k => row[k]);

              if (setClause && !dryRun) {
                await cloudConnection.query(
                  `UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereConditions.join(' AND ')}`,
                  [...setValues, ...whereValues]
                );
                stats.updated++;
              } else if (dryRun) {
                stats.updated++;
              }
            } else {
              stats.skipped++;
            }
            continue;
          }
        }

        // 不存在或插入模式
        if (syncMode === 'insert' || syncMode === 'upsert') {
          if (!dryRun) {
            try {
              const fields = Object.keys(row);
              const values = Object.values(row);

              if (fields.length > 0) {
                await cloudConnection.query(
                  `INSERT INTO \`${tableName}\` (\`${fields.join('`, `')}\`) VALUES (${fields.map(() => '?').join(', ')})`,
                  values
                );
                stats.inserted++;
              }
            } catch (error) {
              log.error(`插入数据失败:`, error.message);
              stats.failed++;
            }
          } else {
            stats.inserted++;
          }
        }
      } catch (error) {
        log.error(`处理记录失败:`, error.message);
        stats.failed++;
      }
    }

    return { success: true, stats };
  }

  // 用于统计创建的关联数据数量
  relationsCreatedCount = 0
}

module.exports = LocalToCloudSyncService;
