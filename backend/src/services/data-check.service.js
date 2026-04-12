/**
 * 数据检查服务
 * 检查和管理基础数据的重复问题
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class DataCheckService {
  constructor() {
    // 不要在构造函数中获取数据库连接
    // 数据库连接应该在需要时动态获取
  }

  /**
   * 获取数据库连接
   */
  getPool() {
    return getDatabase();
  }

  /**
   * 创建成功的响应格式
   */
  createSuccessResponse(message, data = null) {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 创建错误的响应格式
   */
  createErrorResponse(message, code = null) {
    return {
      success: false,
      message,
      code
    };
  }

  /**
   * 通用重复数据检查方法
   */
  async checkDuplicates(tableName, fieldName, extraFields = []) {
    const connection = await this.getPool().getConnection();

    try {
      // 构建查询SQL
      const selectFields = ['id', fieldName, 'status', 'created_at', ...extraFields].join(', ');
      const sql = `
        SELECT ${selectFields}
        FROM ${tableName}
        ORDER BY ${fieldName}, id
      `;

      const [rows] = await connection.execute(sql);

      // 查找重复项
      const duplicates = [];
      const seen = new Map();

      for (const row of rows) {
        const key = String(row[fieldName] || '').trim().toLowerCase();

        if (!key) continue;

        if (seen.has(key)) {
          const existing = seen.get(key);
          existing.duplicates.push(row);
        } else {
          seen.set(key, {
            primary: row,
            duplicates: []
          });
        }
      }

      // 过滤出有重复的数据
      for (const [key, value] of seen.entries()) {
        if (value.duplicates.length > 0) {
          duplicates.push({
            key,
            primary: value.primary,
            duplicates: value.duplicates,
            count: value.duplicates.length + 1,
            totalRecords: value.duplicates.length + 1
          });
        }
      }

      return {
        total: rows.length,
        unique: seen.size,
        duplicateGroups: duplicates.length,
        duplicates: duplicates
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 检查品牌重复数据
   */
  async checkBrands() {
    const result = await this.checkDuplicates('brands', 'name', ['sort_order']);

    return {
      table: 'brands',
      tableName: '品牌',
      field: 'name',
      fieldName: '品牌名称',
      ...result
    };
  }

  /**
   * 检查型号重复数据
   */
  async checkModels() {
    const connection = await this.getPool().getConnection();

    try {
      const sql = `
        SELECT m.id, m.name, m.brand_id, b.name as brand_name, m.status, m.created_at
        FROM models m
        LEFT JOIN brands b ON m.brand_id = b.id
        ORDER BY m.name, m.id
      `;

      const [rows] = await connection.execute(sql);

      // 查找重复项（考虑品牌）
      const duplicates = [];
      const seen = new Map();

      for (const row of rows) {
        const nameKey = String(row.name || '').trim().toLowerCase();
        const brandKey = row.brand_id || 'null';
        const key = `${nameKey}|${brandKey}`;

        if (!nameKey) continue;

        if (seen.has(key)) {
          const existing = seen.get(key);
          existing.duplicates.push(row);
        } else {
          seen.set(key, {
            primary: row,
            duplicates: []
          });
        }
      }

      // 过滤出有重复的数据
      for (const [key, value] of seen.entries()) {
        if (value.duplicates.length > 0) {
          duplicates.push({
            key,
            primary: value.primary,
            duplicates: value.duplicates,
            count: value.duplicates.length + 1
          });
        }
      }

      return {
        table: 'models',
        tableName: '型号',
        field: 'name',
        fieldName: '型号名称',
        total: rows.length,
        unique: seen.size,
        duplicateGroups: duplicates.length,
        duplicates: duplicates
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 检查颜色重复数据
   */
  async checkColors() {
    const result = await this.checkDuplicates('colors', 'name', []);

    return {
      table: 'colors',
      tableName: '颜色',
      field: 'name',
      fieldName: '颜色名称',
      ...result
    };
  }

  /**
   * 检查内存重复数据
   */
  async checkMemories() {
    const result = await this.checkDuplicates('memories', 'size', []);

    return {
      table: 'memories',
      tableName: '内存',
      field: 'size',
      fieldName: '内存大小',
      ...result
    };
  }

  /**
   * 检查供应商重复数据
   */
  async checkSuppliers() {
    const result = await this.checkDuplicates('suppliers', 'name', ['contact', 'phone']);

    return {
      table: 'suppliers',
      tableName: '供应商',
      field: 'name',
      fieldName: '供应商名称',
      ...result
    };
  }

  /**
   * 检查店铺重复数据
   */
  async checkStores() {
    const result = await this.checkDuplicates('stores', 'name', ['phone']);

    return {
      table: 'stores',
      tableName: '店铺',
      field: 'name',
      fieldName: '店铺名称',
      ...result
    };
  }

  /**
   * 检查客户重复数据
   * 检测两种情况：
   * 1. 重复数据行（相同ID的多条记录）
   * 2. 重复客户（不同ID但相同手机号和姓名）
   */
  async checkCustomers() {
    const connection = await this.getPool().getConnection();

    try {
      const duplicates = [];

      log.debug('========== 开始检查客户重复数据 ==========');

      // 首先检查总体情况
      const [totalStats] = await connection.execute(`
        SELECT
          COUNT(*) as total_rows,
          COUNT(DISTINCT id) as distinct_ids
        FROM customers
      `);
      log.debug('客户表统计:', {
        总行数: totalStats[0].total_rows,
        不同ID数: totalStats[0].distinct_ids,
        重复行数: totalStats[0].total_rows - totalStats[0].distinct_ids
      });

      // 1. 检测重复数据行（相同ID的多条记录）
      // 优化：一次性批量获取所有重复ID的记录，避免循环查询
      const [duplicateRowIds] = await connection.execute(`
        SELECT id, COUNT(*) as count
        FROM customers
        GROUP BY id
        HAVING COUNT(*) > 1
        ORDER BY id
        LIMIT 500
      `);

      log.debug('查询到的重复数据行ID数量:', duplicateRowIds.length);

      // 批量获取所有重复ID的记录（一次性查询）
      if (duplicateRowIds.length > 0) {
        const duplicateIds = duplicateRowIds.map(row => row.id);
        const placeholders = duplicateIds.map(() => '?').join(',');
        const [allDuplicateRecords] = await connection.execute(`
          SELECT
            id,
            name,
            phone,
            member_number,
            customer_type,
            vip_level,
            status,
            register_date,
            total_spent,
            created_at
          FROM customers
          WHERE id IN (${placeholders})
          ORDER BY id, created_at ASC
        `, duplicateIds);

        log.debug('批量获取到的重复记录数量:', allDuplicateRecords.length);

        // 按ID分组，每组的第一条作为主记录
        const recordsGroupById = new Map();
        for (const record of allDuplicateRecords) {
          if (!recordsGroupById.has(record.id)) {
            recordsGroupById.set(record.id, []);
          }
          recordsGroupById.get(record.id).push(record);
        }

        // 构建重复数据结构
        for (const [id, records] of recordsGroupById.entries()) {
          if (records.length > 1) {
            const primaryRow = records[0];  // 第一条（最早创建的）作为主记录
            const duplicateRowsList = records.slice(1);  // 其余的作为重复记录

            duplicates.push({
              key: `ID:${id}`,
              field: 'duplicate_rows',
              fieldName: '重复数据行',
              primary: primaryRow,
              duplicates: duplicateRowsList,
              count: records.length,
              isDuplicateRows: true
            });
          }
        }
      }

      log.debug('处理后的重复数据行数量:', duplicates.filter(d => d.isDuplicateRows).length);

      // 2. 检测重复客户（不同ID但相同手机号和姓名）
      // 优化版本：减少查询次数，使用 IN 批量查询
      const [duplicateCustomers] = await connection.execute(`
        SELECT
          GROUP_CONCAT(id ORDER BY id) as all_ids,
          COUNT(DISTINCT id) as id_count,
          phone,
          name,
          MIN(id) as first_id,
          COUNT(*) as total_count
        FROM customers
        WHERE phone IS NOT NULL AND phone != '' AND name IS NOT NULL AND name != ''
        GROUP BY phone, name
        HAVING COUNT(DISTINCT id) > 1
        ORDER BY phone, name
        LIMIT 100
      `);

      log.debug('查询到的重复客户（手机号+姓名）数量:', duplicateCustomers.length);
      if (duplicateCustomers.length > 0) {
        log.debug('重复客户示例（前3条）:', JSON.stringify(duplicateCustomers.slice(0, 3), null, 2));
      }

      // 收集所有需要查询的ID
      const allIdsToQuery = [];
      const duplicateMap = new Map();

      for (const row of duplicateCustomers) {
        const ids = row.all_ids.split(',').map(id => parseInt(id));
        allIdsToQuery.push(...ids);
        duplicateMap.set(row.first_id, row);
      }

      // 批量获取所有客户记录
      const allCustomerRecords = [];
      if (allIdsToQuery.length > 0) {
        const uniqueIds = [...new Set(allIdsToQuery)];
        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 500) {
          chunks.push(uniqueIds.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const [records] = await connection.execute(`
            SELECT id, name, phone, member_number, customer_type, vip_level, status, register_date, total_spent, created_at
            FROM customers
            WHERE id IN (${chunk.map(() => '?').join(',')})
          `, chunk);
          allCustomerRecords.push(...records);
        }
      }

      // 为每组重复客户获取详细信息
      for (const row of duplicateCustomers) {
        const ids = row.all_ids.split(',').map(id => parseInt(id));
        const primaryId = row.first_id;

        // 从批量查询结果中获取记录
        const primaryRecord = allCustomerRecords.find(r => r.id === primaryId);
        const duplicateRecords = ids
          .filter(id => id !== primaryId)
          .map(id => allCustomerRecords.find(r => r.id === id))
          .filter(r => r);

        if (primaryRecord) {
          duplicates.push({
            key: `${row.phone}|${row.name}`,
            field: 'phone+name',
            fieldName: '手机号+姓名',
            primary: primaryRecord,
            duplicates: duplicateRecords,
            count: row.id_count,
            isDuplicateRows: false
          });
        }
      }

      // 获取总记录数
      const [totalCount] = await connection.execute('SELECT COUNT(DISTINCT id) as total FROM customers');

      log.debug('最终结果统计:', {
        总客户数: totalCount[0].total,
        重复组数: duplicates.length,
        重复数据行数量: duplicateRowIds.length,
        重复客户数量: duplicateCustomers.length
      });
      log.debug('========== 客户检查完成 ==========');

      return {
        table: 'customers',
        tableName: '客户',
        total: totalCount[0].total,
        duplicates: duplicates,
        duplicateGroups: duplicates.length
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 检查员工重复数据
   * 检测两种情况：
   * 1. 重复数据行（相同ID的多条记录）
   * 2. 重复员工（不同ID但相同用户名或手机号）
   */
  async checkUsers() {
    const connection = await this.getPool().getConnection();

    try {
      const allDuplicates = [];

      // 1. 检测重复数据行（相同ID的多条记录）
      // 明确选择 created_at 最早的记录作为主记录
      const [duplicateRows] = await connection.execute(`
        SELECT u.id, u.username, u.name, u.phone, u.email, u.status, u.created_at, cnt.count
        FROM users u
        INNER JOIN (
          SELECT id, COUNT(*) as count
          FROM users
          GROUP BY id
          HAVING COUNT(*) > 1
        ) cnt ON u.id = cnt.id
        WHERE u.created_at = (
          SELECT MIN(created_at)
          FROM users
          WHERE id = u.id
        )
        ORDER BY u.id
      `);

      for (const row of duplicateRows) {
        allDuplicates.push({
          key: `ID:${row.id}`,
          field: 'duplicate_rows',
          fieldName: '重复数据行',
          primary: row,
          duplicates: [],
          count: row.count,
          isDuplicateRows: true
        });
      }

      // 2. 获取所有唯一记录进行常规重复检测
      const sql = `
        SELECT DISTINCT id, username, name, phone, email, status, created_at
        FROM users
        ORDER BY username, id
      `;

      const [rows] = await connection.execute(sql);

      // 按用户名查找重复
      const seenByUsername = new Map();

      for (const row of rows) {
        const username = String(row.username || '').trim();

        if (!username) continue;

        if (seenByUsername.has(username)) {
          const existing = seenByUsername.get(username);
          existing.duplicates.push(row);
        } else {
          seenByUsername.set(username, {
            primary: row,
            duplicates: []
          });
        }
      }

      for (const [username, value] of seenByUsername.entries()) {
        if (value.duplicates.length > 0) {
          allDuplicates.push({
            key: username,
            field: 'username',
            fieldName: '用户名',
            primary: value.primary,
            duplicates: value.duplicates,
            count: value.duplicates.length + 1,
            isDuplicateRows: false
          });
        }
      }

      // 按手机号查找重复
      const seenByPhone = new Map();

      for (const row of rows) {
        const phone = String(row.phone || '').trim();

        if (!phone) continue;

        if (seenByPhone.has(phone)) {
          const existing = seenByPhone.get(phone);
          existing.duplicates.push(row);
        } else {
          seenByPhone.set(phone, {
            primary: row,
            duplicates: []
          });
        }
      }

      for (const [phone, value] of seenByPhone.entries()) {
        if (value.duplicates.length > 0) {
          allDuplicates.push({
            key: phone,
            field: 'phone',
            fieldName: '手机号',
            primary: value.primary,
            duplicates: value.duplicates,
            count: value.duplicates.length + 1,
            isDuplicateRows: false
          });
        }
      }

      // 获取总记录数
      const [totalCount] = await connection.execute('SELECT COUNT(DISTINCT id) as total FROM users');

      return {
        table: 'users',
        tableName: '员工',
        total: totalCount[0].total,
        duplicates: allDuplicates,
        duplicateGroups: allDuplicates.length
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 综合检查所有数据
   */
  async checkAll() {
    const [
      brands,
      models,
      colors,
      memories,
      suppliers,
      stores,
      customers,
      users
    ] = await Promise.all([
      this.checkBrands(),
      this.checkModels(),
      this.checkColors(),
      this.checkMemories(),
      this.checkSuppliers(),
      this.checkStores(),
      this.checkCustomers(),
      this.checkUsers()
    ]);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        brands: {
          total: brands.total,
          duplicateGroups: brands.duplicateGroups
        },
        models: {
          total: models.total,
          duplicateGroups: models.duplicateGroups
        },
        colors: {
          total: colors.total,
          duplicateGroups: colors.duplicateGroups
        },
        memories: {
          total: memories.total,
          duplicateGroups: memories.duplicateGroups
        },
        suppliers: {
          total: suppliers.total,
          duplicateGroups: suppliers.duplicateGroups
        },
        stores: {
          total: stores.total,
          duplicateGroups: stores.duplicateGroups
        },
        customers: {
          total: customers.total,
          duplicateGroups: customers.duplicateGroups
        },
        users: {
          total: users.total,
          duplicateGroups: users.duplicateGroups
        }
      },
      details: {
        brands,
        models,
        colors,
        memories,
        suppliers,
        stores,
        customers,
        users
      }
    };
  }

  /**
   * 合并重复数据
   */
  async mergeDuplicates(type, primaryId, duplicateIds, user = null) {
    const connection = await this.getPool().getConnection();

    try {
      // ===== 安全检查 =====
      // 1. 确保 primaryId 不在 duplicateIds 中
      if (duplicateIds.includes(primaryId)) {
        throw new Error('主记录ID不能在待删除列表中');
      }

      // 2. 确保 duplicateIds 不为空
      if (!duplicateIds || duplicateIds.length === 0) {
        throw new Error('没有指定要合并的重复记录');
      }

      await connection.beginTransaction();

      // 表配置映射，包含正确的字段名
      const tableConfig = {
        brands: {
          table: 'brands',
          relations: [
            { table: 'models', field: 'brand_id' },
            { table: 'phones', field: 'brand_id' }
          ]
        },
        models: {
          table: 'models',
          relations: [
            { table: 'phones', field: 'model_id' }
          ]
        },
        colors: {
          table: 'colors',
          relations: [
            { table: 'phones', field: 'color_id' }
          ]
        },
        memories: {
          table: 'memories',
          relations: [
            { table: 'phones', field: 'memory_id' }
          ]
        },
        suppliers: {
          table: 'suppliers',
          relations: [
            { table: 'phones', field: 'supplier_id' }
          ]
        },
        stores: {
          table: 'stores',
          relations: [
            { table: 'phones', field: 'store_id' },
            { table: 'users', field: 'store_id' }
          ]
        },
        customers: {
          table: 'customers',
          relations: [
            { table: 'sales', field: 'customer_id' }
          ]
        },
        users: {
          table: 'users',
          relations: [
            { table: 'sales', field: 'user_id' },
            { table: 'phones', field: 'inventory_operator_id' },
            { table: 'phones', field: 'sale_operator_id' }
          ]
        }
      };

      const config = tableConfig[type];
      if (!config) {
        throw new Error('不支持的数据类型');
      }

      const { table, relations } = config;

      // 验证主记录存在
      const [primaryRecords] = await connection.execute(
        `SELECT * FROM ${table} WHERE id = ?`,
        [primaryId]
      );

      if (primaryRecords.length === 0) {
        throw new Error('主记录不存在');
      }

      // 更新所有关联记录
      for (const relation of relations) {
        const placeholders = duplicateIds.map(() => '?').join(',');
        await connection.execute(
          `UPDATE ${relation.table} SET ${relation.field} = ? WHERE ${relation.field} IN (${placeholders})`,
          [primaryId, ...duplicateIds]
        );
      }

      // 删除重复记录
      const placeholders = duplicateIds.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM ${table} WHERE id IN (${placeholders})`,
        duplicateIds
      );

      await connection.commit();

      return {
        type,
        primaryId,
        mergedIds: duplicateIds,
        mergedCount: duplicateIds.length,
        message: `成功合并 ${duplicateIds.length} 条记录到 ${primaryId}`
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 批量合并多组重复数据（优化版：一次事务处理所有组）
   */
  async batchMergeMultipleGroups(type, mergeGroups, user = null) {
    const connection = await this.getPool().getConnection();

    try {
      await connection.beginTransaction();

      // 表配置映射，包含正确的字段名
      const tableConfig = {
        brands: {
          table: 'brands',
          relations: [
            { table: 'models', field: 'brand_id' },
            { table: 'phones', field: 'brand_id' }
          ]
        },
        models: {
          table: 'models',
          relations: [
            { table: 'phones', field: 'model_id' }
          ]
        },
        colors: {
          table: 'colors',
          relations: [
            { table: 'phones', field: 'color_id' }
          ]
        },
        memories: {
          table: 'memories',
          relations: [
            { table: 'phones', field: 'memory_id' }
          ]
        },
        suppliers: {
          table: 'suppliers',
          relations: [
            { table: 'phones', field: 'supplier_id' }
          ]
        },
        stores: {
          table: 'stores',
          relations: [
            { table: 'phones', field: 'store_id' },
            { table: 'users', field: 'store_id' }
          ]
        },
        customers: {
          table: 'customers',
          relations: [
            { table: 'sales', field: 'customer_id' }
          ]
        },
        users: {
          table: 'users',
          relations: [
            { table: 'sales', field: 'user_id' },
            { table: 'phones', field: 'inventory_operator_id' },
            { table: 'phones', field: 'sale_operator_id' }
          ]
        }
      };

      const config = tableConfig[type];
      if (!config) {
        throw new Error('不支持的数据类型');
      }

      const { table, relations } = config;
      let totalMerged = 0;

      // 收集所有需要更新的ID和需要删除的ID
      const allUpdateIds = new Map(); // Map<duplicateId, primaryId>
      const allDeleteIds = [];

      for (const group of mergeGroups) {
        const { primaryId, duplicateIds } = group;

        // 验证主记录存在
        const [primaryRecords] = await connection.execute(
          `SELECT * FROM ${table} WHERE id = ?`,
          [primaryId]
        );

        if (primaryRecords.length === 0) {
          throw new Error(`主记录 ID ${primaryId} 不存在`);
        }

        // 确保 primaryId 不在 duplicateIds 中
        if (duplicateIds.includes(primaryId)) {
          throw new Error('主记录ID不能在待删除列表中');
        }

        // 记录需要更新的ID映射
        for (const dupId of duplicateIds) {
          allUpdateIds.set(dupId, primaryId);
        }
        allDeleteIds.push(...duplicateIds);
        totalMerged += duplicateIds.length;
      }

      // 批量更新所有关联记录
      for (const relation of relations) {
        // 为每个关联表构建批量更新
        for (const [duplicateId, primaryId] of allUpdateIds.entries()) {
          await connection.execute(
            `UPDATE ${relation.table} SET ${relation.field} = ? WHERE ${relation.field} = ?`,
            [primaryId, duplicateId]
          );
        }
      }

      // 批量删除重复记录
      if (allDeleteIds.length > 0) {
        const placeholders = allDeleteIds.map(() => '?').join(',');
        await connection.execute(
          `DELETE FROM ${table} WHERE id IN (${placeholders})`,
          allDeleteIds
        );
      }

      await connection.commit();

      return {
        type,
        mergedGroups: mergeGroups.length,
        totalMerged,
        message: `成功合并 ${mergeGroups.length} 个重复组，共 ${totalMerged} 条记录`
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 批量删除重复数据
   */
  async batchDeleteDuplicates(type, ids, user = null) {
    const connection = await this.getPool().getConnection();

    try {
      await connection.beginTransaction();

      const tableMap = {
        brands: 'brands',
        models: 'models',
        colors: 'colors',
        memories: 'memories',
        suppliers: 'suppliers',
        stores: 'stores',
        customers: 'customers',
        users: 'users'
      };

      const table = tableMap[type];
      if (!table) {
        throw new Error('不支持的数据类型');
      }

      // 对于客户表，额外检查是否尝试删除"主记录"（有其他重复记录存在的记录）
      if (type === 'customers') {
        for (const id of ids) {
          // 检查该ID是否是某个重复组的主记录
          // 主记录定义：存在其他记录具有相同的姓名和手机号，但ID更小或创建时间更早
          const [primaryCheck] = await connection.execute(`
            SELECT
              c1.id,
              c1.name,
              c1.phone,
              c1.created_at,
              COUNT(c2.id) as duplicate_count,
              MIN(c2.id) as other_id
            FROM customers c1
            INNER JOIN customers c2 ON c1.name = c2.name AND c1.phone = c2.phone AND c1.id != c2.id
            WHERE c1.id = ?
            GROUP BY c1.id, c1.name, c1.phone, c1.created_at
          `, [id]);

          if (primaryCheck.length > 0) {
            // 这个ID存在重复记录，可能是主记录
            const record = primaryCheck[0];

            // 检查是否是主记录（创建时间最早或ID最小）
            const [isPrimary] = await connection.execute(`
              SELECT c.id, c.created_at
              FROM customers c
              WHERE c.name = ? AND c.phone = ? AND c.id != ?
              ORDER BY c.created_at ASC, c.id ASC
              LIMIT 1
            `, [record.name, record.phone, id]);

            if (isPrimary.length > 0) {
              // 存在其他记录，检查当前记录是否是主记录
              const [currentRecord] = await connection.execute(`
                SELECT created_at
                FROM customers
                WHERE id = ?
              `, [id]);

              if (currentRecord.length > 0) {
                const currentCreatedAt = new Date(currentRecord[0].created_at);
                const otherCreatedAt = new Date(isPrimary[0].created_at);

                // 如果当前记录的创建时间早于或等于其他记录，则可能是主记录
                if (currentCreatedAt <= otherCreatedAt) {
                  throw new Error(
                    `客户 "${record.name}"（电话：${record.phone}）存在重复记录。\n` +
                    `ID ${id} 是主记录（创建时间：${currentCreatedAt.toLocaleString('zh-CN')}），不能删除。\n` +
                    `建议操作：\n` +
                    `1. 使用"合并"功能将重复记录合并到此主记录\n` +
                    `2. 只选择并删除重复记录（非主记录）\n` +
                    `这样可以保留最早创建的客户记录，确保历史数据完整性。`
                  );
                }
              }
            }
          }
        }
      }

      // 对于员工表，同样检查主记录保护
      if (type === 'users') {
        for (const id of ids) {
          const [primaryCheck] = await connection.execute(`
            SELECT
              u1.id,
              u1.username,
              u1.phone,
              u1.created_at,
              COUNT(u2.id) as duplicate_count
            FROM users u1
            INNER JOIN users u2 ON (u1.username = u2.username OR u1.phone = u2.phone) AND u1.id != u2.id
            WHERE u1.id = ?
            GROUP BY u1.id, u1.username, u1.phone, u1.created_at
          `, [id]);

          if (primaryCheck.length > 0) {
            const record = primaryCheck[0];

            const [isPrimary] = await connection.execute(`
              SELECT u.id, u.created_at
              FROM users u
              WHERE (u.username = ? OR u.phone = ?) AND u.id != ?
              ORDER BY u.created_at ASC, u.id ASC
              LIMIT 1
            `, [record.username, record.phone, id]);

            if (isPrimary.length > 0) {
              const [currentRecord] = await connection.execute(`
                SELECT created_at
                FROM users
                WHERE id = ?
              `, [id]);

              if (currentRecord.length > 0) {
                const currentCreatedAt = new Date(currentRecord[0].created_at);
                const otherCreatedAt = new Date(isPrimary[0].created_at);

                if (currentCreatedAt <= otherCreatedAt) {
                  throw new Error(
                    `员工 "${record.username}"（电话：${record.phone}）存在重复记录。\n` +
                    `ID ${id} 是主记录（创建时间：${currentCreatedAt.toLocaleString('zh-CN')}），不能删除。\n` +
                    `建议操作：\n` +
                    `1. 使用"合并"功能将重复记录合并到此主记录\n` +
                    `2. 只选择并删除重复记录（非主记录）`
                  );
                }
              }
            }
          }
        }
      }

      // 检查关联关系（表名 -> 字段名映射）
      const relationMap = {
        brands: [
          { table: 'models', field: 'brand_id' },
          { table: 'phones', field: 'brand_id' }
        ],
        models: [
          { table: 'phones', field: 'model_id' }
        ],
        colors: [
          { table: 'phones', field: 'color_id' }
        ],
        memories: [
          { table: 'phones', field: 'memory_id' }
        ],
        suppliers: [
          { table: 'phones', field: 'supplier_id' }
        ],
        stores: [
          { table: 'phones', field: 'store_id' },
          { table: 'users', field: 'store_id' }
        ],
        customers: [
          { table: 'sales', field: 'customer_id' }
        ],
        users: [
          { table: 'sales', field: 'user_id' },
          { table: 'phones', field: 'inventory_operator_id' },
          { table: 'phones', field: 'sale_operator_id' }
        ]
      };

      const relations = relationMap[type] || [];

      // 检查每个ID是否有关联数据
      for (const id of ids) {
        for (const relation of relations) {
          const [related] = await connection.execute(
            `SELECT COUNT(*) as count FROM ${relation.table} WHERE ${relation.field} = ?`,
            [id]
          );

          if (related[0].count > 0) {
            // 获取记录的名称以便提供更友好的提示
            let recordName = `ID ${id}`;
            if (type === 'customers') {
              const [customerInfo] = await connection.execute(
                'SELECT name, phone FROM customers WHERE id = ?',
                [id]
              );
              if (customerInfo.length > 0) {
                recordName = `"${customerInfo[0].name}"（电话：${customerInfo[0].phone}）`;
              }
            } else if (type === 'users') {
              const [userInfo] = await connection.execute(
                'SELECT username, phone FROM users WHERE id = ?',
                [id]
              );
              if (userInfo.length > 0) {
                recordName = `"${userInfo[0].username}"（电话：${userInfo[0].phone}）`;
              }
            }

            throw new Error(
              `${type === 'customers' ? '客户' : type === 'users' ? '员工' : '记录'} ${recordName} 在 ${relation.table} 表中有关联数据（${related[0].count} 条），无法删除。\n` +
              `请先处理关联数据后再删除。`
            );
          }
        }
      }

      // 执行删除
      const placeholders = ids.map(() => '?').join(',');
      const [result] = await connection.execute(
        `DELETE FROM ${table} WHERE id IN (${placeholders})`,
        ids
      );

      await connection.commit();

      return {
        type,
        deletedIds: ids,
        deletedCount: result.affectedRows
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 编辑数据
   */
  async editData(type, id, data, user = null) {
    const connection = await this.getPool().getConnection();

    try {
      const tableMap = {
        brands: 'brands',
        models: 'models',
        colors: 'colors',
        memories: 'memories',
        suppliers: 'suppliers',
        stores: 'stores',
        customers: 'customers',
        users: 'users'
      };

      const table = tableMap[type];
      if (!table) {
        throw new Error('不支持的数据类型');
      }

      // 构建更新SQL
      const fields = Object.keys(data).filter(key => key !== 'id');
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => data[field]);

      const [result] = await connection.execute(
        `UPDATE ${table} SET ${setClause} WHERE id = ?`,
        [...values, id]
      );

      if (result.affectedRows === 0) {
        throw new Error('更新失败或记录不存在');
      }

      // 获取更新后的数据
      const [updated] = await connection.execute(
        `SELECT * FROM ${table} WHERE id = ?`,
        [id]
      );

      return {
        type,
        id,
        data: updated[0]
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 删除单条数据
   */
  async deleteData(type, id, user = null) {
    const connection = await this.getPool().getConnection();

    try {
      const tableMap = {
        brands: 'brands',
        models: 'models',
        colors: 'colors',
        memories: 'memories',
        suppliers: 'suppliers',
        stores: 'stores',
        customers: 'customers',
        users: 'users'
      };

      const table = tableMap[type];
      if (!table) {
        throw new Error('不支持的数据类型');
      }

      // 对于客户表和员工表，检查是否存在重复记录
      // 如果存在重复记录，不允许直接删除，必须通过批量删除或合并功能处理
      if (type === 'customers') {
        const [duplicateCheck] = await connection.execute(`
          SELECT
            c1.id,
            c1.name,
            c1.phone,
            COUNT(c2.id) as duplicate_count
          FROM customers c1
          INNER JOIN customers c2 ON c1.name = c2.name AND c1.phone = c2.phone AND c1.id != c2.id
          WHERE c1.id = ?
          GROUP BY c1.id, c1.name, c1.phone
        `, [id]);

        if (duplicateCheck.length > 0 && duplicateCheck[0].duplicate_count > 0) {
          const record = duplicateCheck[0];
          throw new Error(
            `该客户存在 ${duplicateCheck[0].duplicate_count} 条重复记录（姓名：${record.name}，电话：${record.phone}）。\n` +
            `请先在数据检查页面使用"合并"功能合并重复记录，或使用"删除选中"功能删除重复记录。\n` +
            `这样可以确保数据的完整性和一致性。`
          );
        }
      }

      if (type === 'users') {
        const [duplicateCheck] = await connection.execute(`
          SELECT
            u1.id,
            u1.username,
            u1.phone,
            COUNT(u2.id) as duplicate_count
          FROM users u1
          INNER JOIN users u2 ON (u1.username = u2.username OR u1.phone = u2.phone) AND u1.id != u2.id
          WHERE u1.id = ?
          GROUP BY u1.id, u1.username, u1.phone
        `, [id]);

        if (duplicateCheck.length > 0 && duplicateCheck[0].duplicate_count > 0) {
          const record = duplicateCheck[0];
          throw new Error(
            `该员工存在 ${duplicateCheck[0].duplicate_count} 条重复记录（用户名：${record.username}，电话：${record.phone}）。\n` +
            `请先在数据检查页面使用"合并"功能合并重复记录，或使用"删除选中"功能删除重复记录。\n` +
            `这样可以确保数据的完整性和一致性。`
          );
        }
      }

      // 检查关联关系（表名 -> 字段名映射）
      const relationMap = {
        brands: [
          { table: 'models', field: 'brand_id' },
          { table: 'phones', field: 'brand_id' }
        ],
        models: [
          { table: 'phones', field: 'model_id' }
        ],
        colors: [
          { table: 'phones', field: 'color_id' }
        ],
        memories: [
          { table: 'phones', field: 'memory_id' }
        ],
        suppliers: [
          { table: 'phones', field: 'supplier_id' }
        ],
        stores: [
          { table: 'phones', field: 'store_id' },
          { table: 'users', field: 'store_id' }
        ],
        customers: [
          { table: 'sales', field: 'customer_id' }
        ],
        users: [
          { table: 'sales', field: 'user_id' },
          { table: 'phones', field: 'inventory_operator_id' },
          { table: 'phones', field: 'sale_operator_id' }
        ]
      };

      const relations = relationMap[type] || [];

      for (const relation of relations) {
        const [related] = await connection.execute(
          `SELECT COUNT(*) as count FROM ${relation.table} WHERE ${relation.field} = ?`,
          [id]
        );

        if (related[0].count > 0) {
          throw new Error(`该记录在 ${relation.table} 表中有关联数据（${related[0].count} 条），无法删除。请先处理关联数据后再删除。`);
        }
      }

      // 执行删除
      const [result] = await connection.execute(
        `DELETE FROM ${table} WHERE id = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new Error('记录不存在');
      }

      return {
        type,
        id,
        deleted: true
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 获取数据统计
   */
  async getStatistics() {
    const connection = await this.getPool().getConnection();

    try {
      const [stats] = await connection.query(`
        SELECT
          'brands' as table_name, COUNT(*) as total FROM brands
        UNION ALL SELECT 'models', COUNT(*) FROM models
        UNION ALL SELECT 'colors', COUNT(*) FROM colors
        UNION ALL SELECT 'memories', COUNT(*) FROM memories
        UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
        UNION ALL SELECT 'stores', COUNT(*) FROM stores
        UNION ALL SELECT 'customers', COUNT(*) FROM customers
        UNION ALL SELECT 'users', COUNT(*) FROM users
      `);

      const statsMap = {};
      stats.forEach(stat => {
        statsMap[stat.table_name] = stat.total;
      });

      return statsMap;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取所有数据（含重复状态标记）
   * 用于前端显示所有数据并用颜色高亮重复项
   */
  async getAllData(type) {
    const connection = await this.getPool().getConnection();

    try {
      const tableMap = {
        brands: { table: 'brands', nameField: 'name', extraFields: [] },
        models: {
          table: 'models',
          nameField: 'name',
          extraFields: ['brand_id'],
          joins: ['LEFT JOIN brands b ON models.brand_id = b.id'],
          selectFields: ['b.name as brand_name']
        },
        colors: { table: 'colors', nameField: 'name', extraFields: [] },
        memories: { table: 'memories', nameField: 'size', extraFields: [] },
        suppliers: { table: 'suppliers', nameField: 'name', extraFields: [] },
        stores: { table: 'stores', nameField: 'name', extraFields: [] },
        customers: { table: 'customers', nameField: 'name', extraFields: ['phone', 'member_number', 'customer_type', 'vip_level'] },
        users: { table: 'users', nameField: 'username', extraFields: ['name', 'phone', 'email'] }
      };

      const config = tableMap[type];
      if (!config) {
        throw new Error('不支持的数据类型');
      }

      const { table, nameField, extraFields, joins, selectFields: extraSelectFields } = config;

      // 构建查询SQL
      let selectFields = [`id`, `${nameField}`, `status`, `created_at`, ...extraFields];
      if (joins) {
        selectFields = selectFields.map(f => {
          if (f.includes(' as ')) return `${table}.${f.split(' as ')[0]} as ${f.split(' as ')[1]}`;
          return `${table}.${f}`;
        });
        // 添加额外的选择字段（来自 JOIN 的表）
        if (extraSelectFields) {
          selectFields = [...selectFields, ...extraSelectFields];
        }
      }
      const sql = `
        SELECT ${selectFields.join(', ')}
        FROM ${table}
        ${joins ? joins.join(' ') : ''}
        ORDER BY ${table}.${nameField}, ${table}.id
      `;

      const [rows] = await connection.execute(sql);

      // 如果没有数据，返回空结果而不是抛出错误
      if (!rows || rows.length === 0) {
        return {
          type,
          table,
          total: 0,
          duplicateCount: 0,
          data: []
        };
      }

      // 查找重复项并标记
      const nameMap = new Map();
      const duplicateNames = new Set();

      // 第一遍：找出所有重复的项
      for (const row of rows) {
        // 对于客户，使用 姓名+手机号 作为唯一键
        let key;
        if (type === 'customers') {
          const name = String(row.name || '').trim().toLowerCase();
          const phone = String(row.phone || '').trim().toLowerCase();
          // 如果姓名或手机号为空，跳过
          if (!name || !phone) continue;
          key = `${name}|${phone}`;
        } else {
          // 其他类型使用名称字段
          key = String(row[nameField] || '').trim().toLowerCase();
          if (!key) continue;
        }

        if (nameMap.has(key)) {
          nameMap.get(key).push(row);
          duplicateNames.add(key);
        } else {
          nameMap.set(key, [row]);
        }
      }

      // 第二遍：为每条记录添加重复状态标记
      const dataList = rows.map(row => {
        let key;
        if (type === 'customers') {
          const name = String(row.name || '').trim().toLowerCase();
          const phone = String(row.phone || '').trim().toLowerCase();
          key = (!name || !phone) ? null : `${name}|${phone}`;
        } else {
          key = String(row[nameField] || '').trim().toLowerCase();
          if (!key) key = null;
        }

        const isDuplicate = key ? duplicateNames.has(key) : false;

        return {
          ...row,
          _isDuplicate: isDuplicate,
          _duplicateCount: key ? (nameMap.get(key)?.length || 1) : 1
        };
      });

      return {
        type,
        table,
        total: dataList.length,
        duplicateCount: dataList.filter(item => item._isDuplicate).length,
        data: dataList
      };
    } finally {
      connection.release();
    }
  }

  /**
   * 执行数据清理（优化版：批量处理）
   * 对于重复行（相同ID的多条记录），保留最早创建的那一条
   */
  async cleanupData(type, user = null, specificIds = null) {
    const connection = await this.getPool().getConnection();

    try {
      if (type === 'customers' || type === 'users') {
        log.debug(`开始清理 ${type} 表的重复数据行...`);

        const tableName = type;
        const fieldName = type === 'customers' ? '客户' : '员工';

        let targetIds = specificIds;

        // 如果没有指定ID，则获取所有有重复的ID
        if (!targetIds) {
          const [duplicateIds] = await connection.execute(`
            SELECT id, COUNT(*) as cnt
            FROM ${tableName}
            GROUP BY id
            HAVING COUNT(*) > 1
            ORDER BY id
          `);
          targetIds = duplicateIds.map(r => r.id);
          log.debug(`发现 ${targetIds.length} 个ID有重复记录`);
        } else {
          log.debug(`清理指定的 ${targetIds.length} 个ID:`, targetIds);
        }

        if (targetIds.length === 0) {
          return {
            type,
            message: '没有需要清理的重复数据',
            cleaned: 0,
            remainingGroups: 0
          };
        }

        let totalCleaned = 0;
        const skippedIds = [];

        // 逐个ID处理
        for (let i = 0; i < targetIds.length; i++) {
          const id = targetIds[i];
          log.debug(`处理 ID ${id} (${i + 1}/${targetIds.length})`);

          try {
            // 步骤1：获取该ID的所有记录，按创建时间排序
            const [records] = await connection.execute(`
              SELECT * FROM ${tableName}
              WHERE id = ?
              ORDER BY created_at ASC
            `, [id]);

            if (records.length <= 1) {
              log.debug(`  ID ${id}: 只有 ${records.length} 条记录，无需清理`);
              continue;
            }

            log.debug(`  ID ${id}: 发现 ${records.length} 条记录`);

            // 步骤2：保留第一条（最早创建），删除其余的
            const keepRecord = records[0];
            const deleteRecords = records.slice(1);

            // 步骤3：可选 - 检查数据是否一致
            let hasDifference = false;
            const diffFields = [];

            // 根据不同表选择不同的比较字段
            const fieldsToCompare = type === 'customers'
              ? ['name', 'phone', 'member_number', 'customer_type', 'vip_level', 'status', 'register_date', 'total_spent']
              : ['username', 'name', 'phone', 'email', 'status'];

            for (let j = 1; j < records.length; j++) {
              const record = records[j];

              for (const field of fieldsToCompare) {
                if (keepRecord[field] != record[field]) {
                  hasDifference = true;
                  if (!diffFields.includes(field)) {
                    diffFields.push(field);
                  }
                }
              }
            }

            if (hasDifference) {
              log.debug(`  ID ${id}: ⚠️  检测到数据差异，字段: ${diffFields.join(', ')}`);
              log.debug('  保留记录:', JSON.stringify(keepRecord));
              log.debug('  将删除记录中较早创建的...');
            }

            // 步骤4：删除除第一条外的所有记录
            for (const deleteRecord of deleteRecords) {
              const [deleteResult] = await connection.execute(`
                DELETE FROM ${tableName}
                WHERE id = ? AND created_at = ?
              `, [id, deleteRecord.created_at]);

              if (deleteResult.affectedRows > 0) {
                totalCleaned++;
                log.debug(`  ID ${id}: 删除创建时间为 ${deleteRecord.created_at} 的记录`);
              }
            }

            if (hasDifference) {
              log.debug(`  ID ${id}: ✅ 已保留最早记录，删除了 ${deleteRecords.length} 条记录（有数据差异）`);
            } else {
              log.debug(`  ID ${id}: ✅ 删除了 ${deleteRecords.length} 条完全相同的重复记录`);
            }
          } catch (err) {
            log.error(`  ID ${id}: 处理失败 -`, err.message);
            skippedIds.push(id);
            // 继续处理下一个ID
          }

          // 每处理50个ID暂停一下，释放锁
          if ((i + 1) % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        log.debug(`清理完成，共删除 ${totalCleaned} 条`);

        // 检查还有多少重复
        const [remainingDuplicates] = await connection.execute(`
          SELECT COUNT(*) as count FROM (
            SELECT id, COUNT(*) as cnt FROM ${tableName} GROUP BY id HAVING cnt > 1
          ) as t
        `);

        log.debug(`剩余重复组: ${remainingDuplicates[0].count}`);

        let message = `成功清理 ${totalCleaned} 条${fieldName}重复数据行，还剩 ${remainingDuplicates[0].count} 个重复组`;
        if (skippedIds.length > 0) {
          message += `（跳过 ${skippedIds.length} 个处理失败的ID: ${skippedIds.slice(0, 5).join(', ')}${skippedIds.length > 5 ? '...' : ''}）`;
        }

        return {
          type,
          message,
          cleaned: totalCleaned,
          remainingGroups: remainingDuplicates[0].count,
          skippedIds
        };
      } else {
        throw new Error('暂不支持清理该类型的数据');
      }
    } catch (error) {
      log.error('清理数据时出错:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = DataCheckService;
