/**
 * 数据导入服务
 * 支持从Excel导入销售记录，提供跳过、覆盖、合并等选项
 */
const XLSX = require('xlsx');
const fs = require('fs');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class DataImportService {
  constructor() {
    // 不要在构造函数中获取数据库连接
    // 数据库连接应该在需要时动态获取
    this.importProgress = new Map();
    this.importHistory = [];
    this.importProgressTimestamps = new Map(); // 记录进度更新时间戳
    this.PROGRESS_TIMEOUT = 30 * 60 * 1000; // 30分钟超时
    this.CLEANUP_INTERVAL = 5 * 60 * 1000; // 5分钟清理一次

    // 启动定期清理任务
    this.startCleanupTask();
  }

  /**
   * 获取数据库连接
   */
  getPool() {
    return getDatabase();
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTask() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredProgress();
    }, this.CLEANUP_INTERVAL);

    log.debug('✅ 导入进度清理任务已启动，每5分钟清理一次过期数据');
  }

  /**
   * 清理过期的导入进度数据
   */
  cleanupExpiredProgress() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [importId, timestamp] of this.importProgressTimestamps.entries()) {
      const age = now - timestamp;
      if (age > this.PROGRESS_TIMEOUT) {
        expiredKeys.push(importId);
      }
    }

    if (expiredKeys.length > 0) {
      log.debug(`🧹 清理 ${expiredKeys.length} 个过期的导入进度数据:`, expiredKeys);
      for (const key of expiredKeys) {
        this.importProgress.delete(key);
        this.importProgressTimestamps.delete(key);
      }
      log.debug(`✅ 清理完成，剩余活跃任务: ${this.importProgress.size}`);
    }
  }

  /**
   * 分析Excel数据并检查重复（优化版本 - 批量查询）
   */
  async analyzeData(filePath, options = {}) {
    const connection = await this.getPool().getConnection();

    try {
      const startTime = Date.now();
      log.debug('📊 开始分析数据...');

      // 读取Excel
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (data.length === 0) {
        return {
          total: 0,
          newRecords: 0,
          duplicateRecords: 0,
          duplicates: [],
          summary: {}
        };
      }

      log.debug(`✓ 读取Excel完成，共 ${data.length} 行数据`);

      // 分析数据
      const analysis = {
        total: data.length,
        newRecords: 0,
        duplicateRecords: 0,
        duplicates: [],
        summary: {}
      };

      // 收集所有需要检查的数据行，用于复合键检查
      // 重复检测标准：姓名 + 手机号码 + 序列号 + IMEI
      const rowsToCheck = [];
      const rowIndexMap = new Map(); // compositeKey -> 行号映射

      // 用于统计唯一值的 Set
      const uniqueBrands = new Set();
      const uniqueModels = new Set();
      const uniqueSuppliers = new Set();
      const uniqueStores = new Set();
      const uniqueCustomers = new Set();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const imei = String(row['IMEI'] || '').trim();
        const serialNumber = String(row['序列号'] || '').trim();
        const customerName = String(row['客户姓名'] || '').trim();
        const customerPhone = String(row['手机号'] || '').trim();

        // 至少需要有序列号或IMEI
        if (!imei && !serialNumber) continue;

        // 构建复合键：姓名|手机号|序列号|IMEI
        const key = `${customerName}|${customerPhone}|${serialNumber}|${imei}`;
        rowsToCheck.push({
          rowIndex: i,
          imei,
          serialNumber,
          customerName,
          customerPhone,
          compositeKey: key
        });
        rowIndexMap.set(key, i);

        // 统计唯一的基础数据
        if (row['品牌']) uniqueBrands.add(String(row['品牌']).trim());
        if (row['型号']) uniqueModels.add(String(row['型号']).trim());
        if (row['供应商']) uniqueSuppliers.add(String(row['供应商']).trim());
        if (row['店铺']) uniqueStores.add(String(row['店铺']).trim());
        if (row['客户姓名']) uniqueCustomers.add(customerName);
      }

      // 更新统计结果为唯一值数量
      analysis.summary.brands = uniqueBrands.size;
      analysis.summary.models = uniqueModels.size;
      analysis.summary.suppliers = uniqueSuppliers.size;
      analysis.summary.stores = uniqueStores.size;
      analysis.summary.customers = uniqueCustomers.size;

      log.debug(`✓ 数据统计完成 - 品牌: ${uniqueBrands.size}, 型号: ${uniqueModels.size}, 供应商: ${uniqueSuppliers.size}, 店铺: ${uniqueStores.size}, 客户: ${uniqueCustomers.size}`);
      log.debug(`✓ 收集完成，需要检查 ${rowsToCheck.length} 条记录`);

      // 批量查询数据库中的重复数据（使用复合键）
      if (rowsToCheck.length > 0) {
        // 收集所有唯一的序列号和IMEI
        const allSerialNumbers = [...new Set(rowsToCheck.map(r => r.serialNumber).filter(s => s))];
        const allImeis = [...new Set(rowsToCheck.map(r => r.imei).filter(i => i))];

        const existingCompositeKeys = new Set();
        const duplicatesMap = new Map(); // 存储重复记录的详细信息

        // 批量查询phones表，关联customers、brands、models等信息
        if (allSerialNumbers.length > 0 || allImeis.length > 0) {
          log.debug(`🔍 批量查询 phones 表，关联客户、品牌、型号等信息...`);

          let query = `
            SELECT p.id, p.imei, p.serial_number, p.status, p.purchase_cost, p.sale_price,
                   p.salestime, p.sale_operator_id,
                   b.name as brand_name, mo.name as model_name, col.name as color_name,
                   mem.size as memory_size, sup.name as supplier_name, st.name as store_name,
                   sa.id as sale_id, sa.customer_id, sa.sale_date,
                   c.name as customer_name, c.phone as customer_phone,
                   u.name as salesman_name
            FROM phones p
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN models mo ON p.model_id = mo.id
            LEFT JOIN colors col ON p.color_id = col.id
            LEFT JOIN memories mem ON p.memory_id = mem.id
            LEFT JOIN suppliers sup ON p.supplier_id = sup.id
            LEFT JOIN stores st ON p.store_id = st.id
            LEFT JOIN (
              SELECT phone_id, id, customer_id, sale_date,
                     ROW_NUMBER() OVER (PARTITION BY phone_id ORDER BY sale_date DESC) as rn
              FROM sales
            ) sa ON p.id = sa.phone_id AND sa.rn = 1
            LEFT JOIN customers c ON sa.customer_id = c.id
            LEFT JOIN users u ON p.sale_operator_id = u.id
            WHERE (
          `;

          const conditions = [];
          const params = [];

          if (allSerialNumbers.length > 0) {
            const placeholders = allSerialNumbers.map(() => '?').join(',');
            conditions.push(`p.serial_number IN (${placeholders})`);
            params.push(...allSerialNumbers);
          }

          if (allImeis.length > 0) {
            const placeholders = allImeis.map(() => '?').join(',');
            conditions.push(`p.imei IN (${placeholders})`);
            params.push(...allImeis);
          }

          query += conditions.join(' OR ') + ')';

          const [records] = await connection.query(query, params);

          log.debug(`✓ 查询到 ${records.length} 条数据库记录`);

          // 构建数据库记录的映射（使用IMEI/序列号作为键）
          // 本地Excel是最新的销售数据，只要IMEI/序列号匹配就认为是同一台手机
          const dbRecordsByImei = new Map();
          const dbRecordsBySerial = new Map();

          for (const record of records) {
            const dbSerialNumber = String(record.serial_number || '').trim();
            const dbImei = String(record.imei || '').trim();

            const recordData = {
              id: record.id,
              imei: dbImei,
              serialNumber: dbSerialNumber,
              status: record.status,
              purchaseCost: record.purchase_cost,
              salePrice: record.sale_price,
              salestime: record.salestime,
              saleDate: record.sale_date,
              brandName: String(record.brand_name || '').trim(),
              modelName: String(record.model_name || '').trim(),
              colorName: String(record.color_name || '').trim(),
              memorySize: String(record.memory_size || '').trim(),
              supplierName: String(record.supplier_name || '').trim(),
              storeName: String(record.store_name || '').trim(),
              customerName: String(record.customer_name || '').trim(),
              customerPhone: String(record.customer_phone || '').trim(),
              salesmanName: String(record.salesman_name || '').trim(),
              saleId: record.sale_id,
              customerId: record.customer_id,
              hasSale: !!record.sale_id // 是否已有销售记录
            };

            // 按IMEI索引
            if (dbImei) {
              if (!dbRecordsByImei.has(dbImei)) {
                dbRecordsByImei.set(dbImei, []);
              }
              dbRecordsByImei.get(dbImei).push(recordData);
            }

            // 按序列号索引
            if (dbSerialNumber) {
              if (!dbRecordsBySerial.has(dbSerialNumber)) {
                dbRecordsBySerial.set(dbSerialNumber, []);
              }
              dbRecordsBySerial.get(dbSerialNumber).push(recordData);
            }
          }

          log.debug(`✓ 数据库中有 ${dbRecordsByImei.size + dbRecordsBySerial.size} 台手机（包含库存和已销售）`);

          // 检查每条待导入的记录是否重复
          // 重复规则：只要IMEI/序列号匹配就算重复（本地Excel是最新的真实数据）
          for (const rowToCheck of rowsToCheck) {
            const { imei, serialNumber, customerName, customerPhone, compositeKey, rowIndex } = rowToCheck;

            let isDuplicate = false;
            let existingRecord = null;

            // 通过IMEI查找
            if (imei && dbRecordsByImei.has(imei)) {
              existingRecord = dbRecordsByImei.get(imei)[0];
              isDuplicate = true;
            }
            // 通过序列号查找
            else if (serialNumber && dbRecordsBySerial.has(serialNumber)) {
              existingRecord = dbRecordsBySerial.get(serialNumber)[0];
              isDuplicate = true;
            }

            if (isDuplicate && existingRecord) {
              existingCompositeKeys.add(compositeKey);
              // 保存重复记录的详细信息
              duplicatesMap.set(compositeKey, {
                rowIndex: rowIndex + 2, // Excel行号（从1开始，加上标题行）
                imei: imei || serialNumber,
                compositeKey,
                existingRecord: existingRecord, // 云端的现有记录
                data: data[rowIndex], // Excel的新数据（最新销售数据）
                note: existingRecord.hasSale ? '云端已有销售记录' : '云端为库存状态，将更新为已销售'
              });
            }
          }

          log.debug(`✓ 找到 ${existingCompositeKeys.size} 条匹配记录`);
        }

        // 统计重复和新记录，只保存有差异的数据
        let identicalCount = 0; // 完全相同的记录数
        let diffCount = 0; // 有差异的记录数

        for (const rowToCheck of rowsToCheck) {
          const { compositeKey, rowIndex, imei, serialNumber } = rowToCheck;

          if (existingCompositeKeys.has(compositeKey)) {
            analysis.duplicateRecords++;
            const dupInfo = duplicatesMap.get(compositeKey);
            const excelData = data[rowIndex];
            const cloudData = dupInfo?.existingRecord;

            // 计算云端与本地数据的差异
            const differences = this.calculateDifferences(cloudData, excelData);

            // 如果有差异或云端已售（重要信息），则保存
            const hasDifferences = Object.keys(differences).length > 0;
            const isCloudSold = cloudData?.hasSale;

            if (hasDifferences || isCloudSold) {
              diffCount++;
              // 只保存前100条有差异的重复记录，避免响应过大
              if (analysis.duplicates.length < 100) {
                analysis.duplicates.push({
                  rowIndex: rowIndex + 2,
                  imei: imei || serialNumber,
                  compositeKey,
                  data: excelData,
                  existingRecord: cloudData,
                  differences: differences // 新增：差异字段
                });
              }
            } else {
              identicalCount++;
            }
          } else {
            analysis.newRecords++;
          }
        }

        log.debug(`✓ 差异统计完成: ${diffCount} 条有差异, ${identicalCount} 条完全相同`);
      }

      return analysis;
    } finally {
      connection.release();
    }
  }

  /**
   * 计算云端数据与本地Excel数据的差异
   * @param {Object} cloudData - 云端数据
   * @param {Object} excelData - 本地Excel数据
   * @returns {Object} - 差异对象，只包含不同的字段
   */
  calculateDifferences(cloudData, excelData) {
    if (!cloudData || !excelData) return {};

    const differences = {};

    // 字段映射：Excel字段名 -> 云端字段名
    const fieldMapping = {
      '品牌': 'brandName',
      '型号': 'modelName',
      '颜色': 'colorName',
      '内存': 'memorySize',
      '供应商': 'supplierName',
      '店铺': 'storeName',
      '客户姓名': 'customerName',
      '手机号': 'customerPhone',
      '销售员': 'salesmanName',
      '入库价': 'purchaseCost',
      '销售价': 'salePrice',
      '销售日期': 'saleDate'
    };

    // 比较每个字段
    for (const [excelField, cloudField] of Object.entries(fieldMapping)) {
      const excelValue = this.normalizeValue(excelData[excelField]);
      const cloudValue = this.normalizeValue(cloudData[cloudField]);

      if (excelValue !== cloudValue) {
        differences[excelField] = {
          cloud: cloudValue,
          excel: excelValue,
          field: cloudField
        };
      }
    }

    // 检查销售状态差异
    const isCloudSold = cloudData.hasSale;
    const excelStatus = String(excelData['状态'] || '').trim();
    const excelSaleDate = String(excelData['销售日期'] || '').trim();
    const excelCustomer = String(excelData['客户姓名'] || '').trim();
    const excelPhone = String(excelData['手机号'] || '').trim();
    const isExcelSold = excelStatus === '已销售' || excelSaleDate || (excelCustomer && excelPhone);

    if (isCloudSold !== isExcelSold) {
      differences['状态'] = {
        cloud: isCloudSold ? '已售' : '库存',
        excel: isExcelSold ? '已售' : '库存',
        field: 'status'
      };
    }

    return differences;
  }

  /**
   * 标准化值用于比较
   */
  normalizeValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  /**
   * 导入数据
   */
  async importData(filePath, options = {}, user = null) {
    const connection = await this.getPool().getConnection();
    const importId = options.importId || Date.now();
    const startTime = Date.now();

    // 从文件路径提取文件名
    const fileName = filePath.split('/').pop() || 'unknown.xlsx';

    log.debug('🔄 importData 开始 - importId:', importId, 'options:', options);

    try {
      // 初始化进度
      this.importProgress.set(importId, {
        status: 'processing',
        progress: 0,
        message: '正在读取Excel文件...'
      });
      log.debug('✓ importData 进度初始化完成');

      // 读取Excel
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      this.updateProgress(importId, 10, `正在分析 ${data.length} 条数据...`);

      // 策略：skip（跳过）、overwrite（覆盖）、merge（合并）、replace_all（完全替换）
      const strategy = options.strategy || 'skip';

      let processed = 0;
      let skipped = 0;
      let imported = 0;
      let updated = 0;
      let errors = 0;

      // 如果是完全替换策略，先清空所有数据并重置ID
      if (strategy === 'replace_all') {
        await connection.beginTransaction();

        try {
          this.updateProgress(importId, 15, '正在清空所有旧数据...');

          // 1. 删除所有关联数据（从子表到主表的顺序）
          await connection.execute('DELETE FROM sales');
          await connection.execute('DELETE FROM phones');

          // 2. 删除所有基础数据（按正确的依赖顺序）
          await connection.execute('DELETE FROM customers');
          await connection.execute('DELETE FROM stores');
          await connection.execute('DELETE FROM suppliers');
          await connection.execute('DELETE FROM memories');
          await connection.execute('DELETE FROM colors');
          await connection.execute('DELETE FROM models');
          await connection.execute('DELETE FROM brands');

          this.updateProgress(importId, 18, '正在重置自增ID...');

          // 3. 重置所有表的自增ID（从1开始）
          const tables = [
            'sales', 'phones', 'customers', 'stores',
            'suppliers', 'memories', 'colors', 'models', 'brands'
          ];

          for (const table of tables) {
            try {
              await connection.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
            } catch (err) {
              log.warn(`重置表 ${table} 自增ID失败:`, err.message);
            }
          }

          await connection.commit();

          // 清空基础数据映射，重新开始
          var maps = {
            brands: new Map(),
            models: new Map(),
            colors: new Map(),
            memories: new Map(),
            suppliers: new Map(),
            stores: new Map(),
            customers: new Map(),
            users: new Map()
          };
        } catch (error) {
          await connection.rollback();
          throw new Error('清空数据失败: ' + error.message);
        }
      } else {
        // 创建基础数据映射
        var maps = await this.buildDataMaps(connection, data);
      }

      this.updateProgress(importId, 20, '基础数据准备完成，开始导入...');

      // 导入数据
      for (let i = 0; i < data.length; i++) {
        const row = data[i];

        try {
          const result = await this.importRow(connection, row, maps, strategy, user);

          if (result.status === 'imported') {
            imported++;
          } else if (result.status === 'updated') {
            updated++;
          } else if (result.status === 'skipped') {
            skipped++;
          }
        } catch (error) {
          log.error(`导入第 ${i + 2} 行失败:`, error);
          errors++;
        }

        processed++;

        // 更新进度
        if (processed % 100 === 0 || processed === data.length) {
          const progress = 20 + Math.floor((processed / data.length) * 75);
          this.updateProgress(importId, progress, `已处理 ${processed}/${data.length} 条数据`);
        }
      }

      // 完成
      this.updateProgress(importId, 100, '导入完成');

      const endTime = Date.now();
      const total = data.length;

      const result = {
        status: 'completed',
        total: total,
        processed,
        imported,
        updated,
        skipped,
        errors,
        strategy
      };

      // 记录历史
      const historyRecord = {
        importId,
        ...result,
        user: user?.name || 'system',
        timestamp: new Date().toISOString()
      };

      this.importHistory.unshift(historyRecord);

      // 只保留最近100条记录
      if (this.importHistory.length > 100) {
        this.importHistory = this.importHistory.slice(0, 100);
      }

      // 保存到数据库
      await this.saveImportHistory(connection, {
        import_id: importId,
        user_id: user?.id || null,
        user_name: user?.name || 'system',
        strategy,
        file_name: fileName,
        total_records: total,
        imported,
        updated,
        skipped,
        error_count: errors,
        status: errors > 0 ? (imported === 0 && updated === 0 ? 'failed' : 'completed') : 'completed',
        error_message: errors > 0 ? `${errors}条记录处理失败` : null,
        start_time: startTime,
        end_time: endTime,
        duration_ms: endTime - startTime
      });

      return result;
    } catch (error) {
      this.updateProgress(importId, -1, '导入失败: ' + error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 构建基础数据映射
   */
  async buildDataMaps(connection, data) {
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

    // 获取现有品牌
    const [brands] = await connection.execute('SELECT id, name FROM brands');
    brands.forEach(item => maps.brands.set(item.name, item.id));

    // 获取现有型号
    const [models] = await connection.execute('SELECT id, name FROM models');
    models.forEach(item => maps.models.set(item.name, item.id));

    // 获取现有颜色
    const [colors] = await connection.execute('SELECT id, name FROM colors');
    colors.forEach(item => maps.colors.set(item.name, item.id));

    // 获取现有内存
    const [memories] = await connection.execute('SELECT id, size FROM memories');
    memories.forEach(item => maps.memories.set(item.size, item.id));

    // 获取现有供应商
    const [suppliers] = await connection.execute('SELECT id, name FROM suppliers');
    suppliers.forEach(item => maps.suppliers.set(item.name, item.id));

    // 获取现有店铺
    const [stores] = await connection.execute('SELECT id, name FROM stores');
    stores.forEach(item => maps.stores.set(item.name, item.id));

    // 获取现有客户
    const [customers] = await connection.execute('SELECT id, phone FROM customers');
    customers.forEach(item => maps.customers.set(item.phone, item.id));

    // 获取现有员工（支持多种匹配方式）
    const [users] = await connection.execute('SELECT id, name, username FROM users');
    users.forEach(item => {
      // name 作为主要匹配键
      maps.users.set(item.name, item.id);
      // username 作为备用匹配键（支持向后兼容）
      if (item.username && item.username !== item.name) {
        maps.users.set(item.username, item.id);
      }
    });

    return maps;
  }

  /**
   * 导入单行数据
   */
  async importRow(connection, row, maps, strategy, user = null) {
    const imei = String(row['IMEI'] || '').trim();
    const serialNumber = String(row['序列号'] || '').trim();
    const customerName = String(row['客户姓名'] || '').trim();
    const customerPhone = String(row['手机号'] || '').trim();

    // 至少需要有 IMEI 或序列号之一，且 IMEI 不能为空（数据库限制）
    if (!imei && !serialNumber) {
      return { status: 'skipped', reason: '无IMEI或序列号' };
    }

    // 如果 IMEI 为空但有序列号，使用序列号作为 IMEI（满足数据库非空要求）
    const effectiveImei = imei || serialNumber;

    // 检查是否已存在（使用IMEI/序列号）
    // 本地Excel是最新的销售数据，只要IMEI/序列号匹配就认为是同一台手机
    let existingRecords = [];

    if (imei || serialNumber) {
      // 构建查询条件，通过sales表关联客户信息
      let query = `
        SELECT p.id, p.imei, p.serial_number,
               s.id as sale_id, s.customer_id,
               c.name as customer_name, c.phone as customer_phone
        FROM phones p
        LEFT JOIN sales s ON p.id = s.phone_id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE (p.serial_number = ? OR p.imei = ?)
      `;
      let params = [serialNumber || '', imei || ''];

      const [records] = await connection.execute(query, params);
      existingRecords = records;
    }

    // 检查是否有匹配的重复记录
    // 逻辑：只要IMEI或序列号匹配，就认为是同一台手机
    // 因为Excel是最新的销售数据，即使云端显示未销售，也应该更新为已销售
    let duplicateRecord = null;

    for (const record of existingRecords) {
      const dbImei = String(record.imei || '').trim();
      const dbSerialNumber = String(record.serial_number || '').trim();

      // 检查序列号或IMEI是否匹配（只要一个匹配即可）
      const serialMatch = serialNumber && serialNumber === dbSerialNumber;
      const imeiMatch = imei && imei === dbImei;

      if (serialMatch || imeiMatch) {
        // 找到匹配的手机记录
        duplicateRecord = record;
        const hasSale = !!record.sale_id;
        const status = hasSale ? '已销售' : '库存';
        log.debug(`🔄 找到匹配记录: IMEI=${dbImei}, 序列号=${dbSerialNumber}, 云端状态=${status}, 将更新为Excel的销售信息`);
        break;
      }
    }

    if (duplicateRecord) {
      // 已存在记录 - 智能判断云端和Excel状态
      const isCloudSold = !!duplicateRecord.saleId; // 云端是否已售

      // 解析Excel数据
      const statusStr = String(row['状态'] || '').trim();
      const saleDate = row['销售日期'] || null;
      const customerName = String(row['客户姓名'] || row['客户'] || '').trim();
      const phone = String(row['手机号'] || '').trim();
      const saleOperator = String(row['销售员'] || '').trim();
      const salePrice = parseFloat(row['销售价']) || null;

      // 判断Excel中的销售状态
      const hasSaleDate = !!saleDate;
      const hasCustomerInfo = !!customerName;
      const hasPhone = !!phone;
      const hasSaleOperator = !!saleOperator;
      const hasStatusSold = statusStr === '已销售' || statusStr === '已售' || statusStr === 'sold' || statusStr === '出售';
      const isExcelSold = hasStatusSold || hasSaleDate || (hasCustomerInfo && hasPhone);

      // ========== 智能策略 ==========
      if (strategy === 'smart') {
        log.debug(`  🧠 [智能] 云端状态=${isCloudSold ? '已售' : '库存'}, Excel状态=${isExcelSold ? '已售' : '库存'}`);

        // 场景1: 云端库存 → Excel已售（最常见，以本地为准完整更新）
        if (!isCloudSold && isExcelSold) {
          log.debug(`  ✨ [智能] 场景1: 库存→已售，以本地Excel为准完整更新所有数据`);
          // 使用 overwrite 逻辑，确保所有字段都按本地Excel更新
          strategy = 'overwrite';
          // 强制标记为已售（即使Excel状态列不明确）
          row['状态'] = '已销售';
        }
        // 场景2: 云端已售 → Excel库存（保持已售，不降级）
        else if (isCloudSold && !isExcelSold) {
          log.debug(`  🛡️ [智能] 场景2: 已售→库存，保持已售状态（不降级）`);
          // 跳过更新，保持云端的已售状态
          // 但可以更新客户 Apple ID
          if (phone) {
            await this.getOrCreateCustomer(connection, row, maps.customers);
          }
          return { status: 'skipped', reason: '云端已售，保持不变', existingId: duplicateRecord.id };
        }
        // 场景3: 云端已售 → Excel已售（以本地为准完整更新）
        else if (isCloudSold && isExcelSold) {
          log.debug(`  🔄 [智能] 场景3: 已售→已售，以本地Excel为准完整更新销售信息`);
          // 使用 overwrite 逻辑，确保所有字段都按本地Excel更新
          strategy = 'overwrite';
        }
        // 场景4: 云端库存 → Excel库存（保持库存）
        else {
          log.debug(`  📦 [智能] 场景4: 库存→库存，保持库存状态`);
          // 跳过更新，保持库存状态
          return { status: 'skipped', reason: '双方都是库存，保持不变', existingId: duplicateRecord.id };
        }
      }

      // 已存在
      if (strategy === 'skip') {
        // 跳过：不更新手机记录，但检查并更新客户 Apple ID
        const phone = String(row['手机号'] || '').trim();
        if (phone) {
          // 获取或创建客户（会自动处理 Apple ID）
          await this.getOrCreateCustomer(connection, row, maps.customers);
        }
        return { status: 'skipped', reason: '数据已存在', existingId: duplicateRecord.id };
      } else if (strategy === 'overwrite') {
        // 覆盖：更新所有字段，但保留Excel中有值的字段（本地Excel是最新的真实数据）
        const updateFields = [];
        const updateValues = [];

        // 解析数据 - 本地Excel是最新的真实数据
        const excelPurchasePrice = !isNaN(parseFloat(row['入库价'])) ? parseFloat(row['入库价']) : null;
        const excelSalePrice = !isNaN(parseFloat(row['销售价'])) ? parseFloat(row['销售价']) : null;
        const remarks = String(row['备注'] || '').trim();
        const isNewStr = String(row['全新/二手'] || '').trim();
        const saleDate = row['销售日期'] || null;
        const purchaseDate = row['进货日期'] || null;
        const statusStr = String(row['状态'] || '').trim();
        const status = (statusStr === '已销售') ? 'sold' : 'in_stock';

        // 判断是否为全新手机
        let isNew = 1;
        if (isNewStr === '全新' || remarks === '是') {
          isNew = 1;
        } else {
          const secondHandKeywords = [
            '二手', '2手', '９成新', '9成新', '8成新', '８成新',
            '7成新', '７成新', 'used', '翻新', '官换', '官翻',
            '二手机', '旧机', '回收机', '保修一个月', '二手保修', '二手机'
          ];
          const hasSecondHandKeyword = secondHandKeywords.some(keyword =>
            remarks.includes(keyword)
          );
          if (hasSecondHandKeyword || isNewStr === '二手') {
            isNew = 0;
          } else if (saleDate) {
            const saleYear = new Date(saleDate).getFullYear();
            if (saleYear < 2000) {
              isNew = 0;
            }
          }
        }

        // 获取基础数据ID（智能匹配）
        const brandId = await this.getOrCreate(connection, 'brands', row['品牌'], maps.brands);
        const modelId = await this.getOrCreate(connection, 'models', row['型号'], maps.models, 'name', { brand_id: brandId });
        const colorId = await this.getOrCreate(connection, 'colors', row['颜色'], maps.colors);
        const memoryId = await this.getOrCreate(connection, 'memories', row['内存'], maps.memories, 'size');
        const supplierId = await this.getOrCreate(connection, 'suppliers', row['供应商'], maps.suppliers);
        const storeId = await this.getOrCreate(connection, 'stores', row['店铺'], maps.stores);

        // 智能获取或创建操作员ID
        const inventoryOperatorId = await this.getOrCreateUser(connection, row['入库员'], maps.users);
        const saleOperatorId = await this.getOrCreateUser(connection, row['销售员'], maps.users);

        // 构建更新字段（覆盖所有字段，包括空值）
        updateFields.push('brand_id = ?');
        updateValues.push(brandId);

        updateFields.push('model_id = ?');
        updateValues.push(modelId);

        updateFields.push('color_id = ?');
        updateValues.push(colorId);

        updateFields.push('memory_id = ?');
        updateValues.push(memoryId);

        updateFields.push('supplier_id = ?');
        updateValues.push(supplierId);

        updateFields.push('store_id = ?');
        updateValues.push(storeId);

        updateFields.push('status = ?');
        updateValues.push(status);

        updateFields.push('salestime = ?');
        updateValues.push(saleDate);

        updateFields.push('Inventorytime = ?');
        updateValues.push(purchaseDate);

        updateFields.push('purchase_cost = ?');
        updateValues.push(excelPurchasePrice);

        updateFields.push('sale_price = ?');
        updateValues.push(excelSalePrice);

        updateFields.push('remarks = ?');
        updateValues.push(remarks || null);

        updateFields.push('is_new = ?');
        updateValues.push(isNew);

        updateFields.push('inventory_operator_id = ?');
        updateValues.push(inventoryOperatorId);

        updateFields.push('sale_operator_id = ?');
        updateValues.push(saleOperatorId);

        // 执行更新
        updateValues.push(duplicateRecord.id);
        await connection.execute(
          `UPDATE phones SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
        log.debug(`  ✓ 覆盖更新手机记录: ID=${duplicateRecord.id}`);

        // 处理客户信息（无论是否已售出，都检查并更新客户 Apple ID）
        const phone = String(row['手机号'] || '').trim();
        if (phone) {
          // 获取或创建客户（会自动处理 Apple ID）
          const customerId = await this.getOrCreateCustomer(connection, row, maps.customers);

          // 如果已售出，处理销售记录
          if (status === 'sold' && saleDate) {
            if (customerId) {
              // 检查是否已有销售记录
              const [existingSales] = await connection.execute(
                'SELECT id FROM sales WHERE phone_id = ?',
                [duplicateRecord.id]
              );

              if (existingSales.length > 0) {
                // 更新现有销售记录
                await connection.execute(
                  `UPDATE sales SET customer_id = ?, sale_date = ?, operator_id = ? WHERE phone_id = ?`,
                  [customerId, saleDate, saleOperatorId, duplicateRecord.id]
                );
                log.debug(`  ✓ 更新销售记录: phone_id=${duplicateRecord.id}, customer_id=${customerId}`);
              } else {
                // 创建新的销售记录
                await connection.execute(
                  `INSERT INTO sales (phone_id, customer_id, sale_date, operator_id)
                   VALUES (?, ?, ?, ?)`,
                  [duplicateRecord.id, customerId, saleDate, saleOperatorId]
                );
                log.debug(`  ✓ 创建销售记录: phone_id=${duplicateRecord.id}, customer_id=${customerId}`);
              }
            }
          }
        }

        return { status: 'overwritten', id: duplicateRecord.id };
      } else if (strategy === 'merge') {
        // 合并：更新现有记录的非空字段
        const updateFields = [];
        const updateValues = [];

        // 解析数据
        const purchasePrice = !isNaN(parseFloat(row['入库价'])) ? parseFloat(row['入库价']) : null;
        const salePrice = !isNaN(parseFloat(row['销售价'])) ? parseFloat(row['销售价']) : null;
        const remarks = String(row['备注'] || '').trim();
        const isNewStr = String(row['全新/二手'] || '').trim();
        const saleDate = row['销售日期'] || null;
        const purchaseDate = row['进货日期'] || null;
        const statusStr = String(row['状态'] || '').trim();
        const status = (statusStr === '已销售') ? 'sold' : 'in_stock';

        // 获取更多销售相关信息
        const customerName = String(row['客户姓名'] || row['客户'] || '').trim();
        const phone = String(row['手机号'] || '').trim();
        const saleOperator = String(row['销售员'] || '').trim();

        // 判断是否有销售信息的多个指标
        const hasSaleDate = !!saleDate;
        const hasCustomerInfo = !!customerName;
        const hasPhone = !!phone;
        const hasSaleOperator = !!saleOperator;
        const hasStatusSold = statusStr === '已销售';

        // 智能判断：只要有任一销售信息，就标记为已售
        const shouldBeSold = hasSaleDate || hasCustomerInfo || hasPhone || hasSaleOperator || hasStatusSold;

        // 调试日志：检查销售状态
        if (shouldBeSold || hasSaleDate) {
          log.debug(`  🔍 [合并] 检查销售状态:`);
          log.debug(`     - 状态列="${statusStr}"`);
          log.debug(`     - 销售日期="${saleDate}"`);
          log.debug(`     - 客户姓名="${customerName}"`);
          log.debug(`     - 手机号="${phone}"`);
          log.debug(`     - 销售员="${saleOperator}"`);
          log.debug(`     - 判定应标记为已售: ${shouldBeSold}`);
        }

        // 判断是否为全新手机
        let isNew = 1;
        if (isNewStr === '全新' || remarks === '是') {
          isNew = 1;
        } else {
          const secondHandKeywords = [
            '二手', '2手', '９成新', '9成新', '8成新', '８成新',
            '7成新', '７成新', 'used', '翻新', '官换', '官翻',
            '二手机', '旧机', '回收机', '保修一个月', '二手保修', '二手机'
          ];
          const hasSecondHandKeyword = secondHandKeywords.some(keyword =>
            remarks.includes(keyword)
          );
          if (hasSecondHandKeyword || isNewStr === '二手') {
            isNew = 0;
          } else if (saleDate) {
            const saleYear = new Date(saleDate).getFullYear();
            if (saleYear < 2000) {
              isNew = 0;
            }
          }
        }

        // 获取基础数据ID（智能匹配）
        const brandId = await this.getOrCreate(connection, 'brands', row['品牌'], maps.brands);
        // 型号需要与品牌关联
        const modelId = await this.getOrCreate(connection, 'models', row['型号'], maps.models, 'name', { brand_id: brandId });
        const colorId = await this.getOrCreate(connection, 'colors', row['颜色'], maps.colors);
        const memoryId = await this.getOrCreate(connection, 'memories', row['内存'], maps.memories, 'size');
        const supplierId = await this.getOrCreate(connection, 'suppliers', row['供应商'], maps.suppliers);
        const storeId = await this.getOrCreate(connection, 'stores', row['店铺'], maps.stores);

        // 智能获取或创建操作员ID
        const inventoryOperatorId = await this.getOrCreateUser(connection, row['入库员'], maps.users);
        const saleOperatorId = await this.getOrCreateUser(connection, row['销售员'], maps.users);

        // 构建更新字段（只更新非空值）
        if (row['品牌']) {
          updateFields.push('brand_id = ?');
          updateValues.push(brandId);
        }
        if (row['型号']) {
          updateFields.push('model_id = ?');
          updateValues.push(modelId);
        }
        if (row['颜色']) {
          updateFields.push('color_id = ?');
          updateValues.push(colorId);
        }
        if (row['内存']) {
          updateFields.push('memory_id = ?');
          updateValues.push(memoryId);
        }
        if (row['供应商']) {
          updateFields.push('supplier_id = ?');
          updateValues.push(supplierId);
        }
        if (row['店铺']) {
          updateFields.push('store_id = ?');
          updateValues.push(storeId);
        }
        // 智能状态更新：只要有任一销售信息，就更新为已售
        if (shouldBeSold) {
          updateFields.push('status = ?');
          updateValues.push('sold');
          updateFields.push('salestime = ?');
          updateValues.push(saleDate || purchaseDate || new Date().toISOString().slice(0, 10));
          log.debug(`  🔄 [合并] 检测到销售信息（日期=${saleDate}, 客户=${customerName}, 手机=${phone}, 销售员=${saleOperator}），自动更新状态为 sold`);
        } else if (statusStr) {
          updateFields.push('status = ?');
          updateValues.push(status);
          log.debug(`  🔄 [合并] 根据状态列更新为 ${status}`);
        }
        if (purchaseDate) {
          updateFields.push('Inventorytime = ?');
          updateValues.push(purchaseDate);
        }
        if (!isNaN(purchasePrice)) {
          updateFields.push('purchase_cost = ?');
          updateValues.push(purchasePrice);
        }
        if (!isNaN(salePrice)) {
          updateFields.push('sale_price = ?');
          updateValues.push(salePrice);
        }
        if (remarks) {
          updateFields.push('remarks = ?');
          updateValues.push(remarks);
        }
        if (row['全新/二手'] || remarks) {
          updateFields.push('is_new = ?');
          updateValues.push(isNew);
        }
        if (row['入库员']) {
          updateFields.push('inventory_operator_id = ?');
          updateValues.push(inventoryOperatorId);
        }
        if (row['销售员']) {
          updateFields.push('sale_operator_id = ?');
          updateValues.push(saleOperatorId);
        }

        // 执行更新
        if (updateFields.length > 0) {
          updateValues.push(duplicateRecord.id);
          await connection.execute(
            `UPDATE phones SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
          );
          log.debug(`  ✓ 合并更新手机记录: ID=${duplicateRecord.id}, 更新字段: ${updateFields.length}个`);
        } else {
          log.debug(`  ⚠️  合并策略：无任何字段需要更新`);
        }

        // 处理客户信息（无论是否已售出，都检查并更新客户 Apple ID）
        if (phone) {
          // 获取或创建客户（会自动处理 Apple ID）
          const customerId = await this.getOrCreateCustomer(connection, row, maps.customers);

          // 如果已售出，处理销售记录
          if (status === 'sold' && saleDate) {
            if (customerId) {
              // 检查是否已有销售记录
              const [existingSales] = await connection.execute(
                'SELECT id FROM sales WHERE phone_id = ?',
                [duplicateRecord.id]
              );

              if (existingSales.length > 0) {
                // 更新现有销售记录
                await connection.execute(
                  `UPDATE sales SET customer_id = ?, sale_date = ?, operator_id = ? WHERE phone_id = ?`,
                  [customerId, saleDate, saleOperatorId, duplicateRecord.id]
                );
                log.debug(`  ✓ 更新销售记录: phone_id=${duplicateRecord.id}, customer_id=${customerId}`);
              } else {
                // 创建新的销售记录
                await connection.execute(
                  `INSERT INTO sales (phone_id, customer_id, sale_date, operator_id)
                   VALUES (?, ?, ?, ?)`,
                  [duplicateRecord.id, customerId, saleDate, saleOperatorId]
                );
                log.debug(`  ✓ 创建销售记录: phone_id=${duplicateRecord.id}, customer_id=${customerId}`);
              }
            }
          }
        }

        return { status: 'merged', id: duplicateRecord.id };
      }
    }

    // 获取或创建基础数据（智能匹配）
    const brandId = await this.getOrCreate(connection, 'brands', row['品牌'], maps.brands);
    // 型号需要与品牌关联
    const modelId = await this.getOrCreate(connection, 'models', row['型号'], maps.models, 'name', { brand_id: brandId });
    const colorId = await this.getOrCreate(connection, 'colors', row['颜色'], maps.colors);
    const memoryId = await this.getOrCreate(connection, 'memories', row['内存'], maps.memories, 'size');
    const supplierId = await this.getOrCreate(connection, 'suppliers', row['供应商'], maps.suppliers);
    const storeId = await this.getOrCreate(connection, 'stores', row['店铺'], maps.stores);

    // 获取或创建客户
    const phone = String(row['手机号'] || '').trim();
    let customerId = null;
    if (phone) {
      customerId = await this.getOrCreateCustomer(connection, row, maps.customers);
    }

    // 解析数据
    const purchasePrice = !isNaN(parseFloat(row['入库价'])) ? parseFloat(row['入库价']) : 0;
    const salePrice = !isNaN(parseFloat(row['销售价'])) ? parseFloat(row['销售价']) : 0;
    const remarks = String(row['备注'] || '').trim();
    const isNewStr = String(row['全新/二手'] || '').trim();
    const saleDate = row['销售日期'] || null;
    const purchaseDate = row['进货日期'] || null;

    // 判断是否为全新手机
    // 规则1: 备注="是" 或 全新/二手="全新" → 全新
    // 规则2: 备注包含任何二手相关字眼（二手、二手保修等）→ 二手
    // 规则3: 2000年以前销售的机器 → 二手
    // 规则4: 其他情况 → 全新
    let isNew = 1; // 默认为全新

    if (isNewStr === '全新' || remarks === '是') {
      isNew = 1; // 明确标注全新
    } else {
      // 检查备注中是否包含二手相关关键词
      const secondHandKeywords = [
        '二手', '2手', '９成新', '9成新', '8成新', '８成新',
        '7成新', '７成新', 'used', '翻新', '官换', '官翻',
        '二手机', '旧机', '回收机'
      ];

      const hasSecondHandKeyword = secondHandKeywords.some(keyword =>
        remarks.includes(keyword)
      );

      if (hasSecondHandKeyword || isNewStr === '二手') {
        isNew = 0; // 包含任何二手相关字眼
      } else if (saleDate) {
        // 检查销售日期是否在2000年以前
        const saleYear = new Date(saleDate).getFullYear();
        if (saleYear < 2000) {
          isNew = 0; // 2000年以前销售的机器判断为二手
        }
      }
    }

    const statusStr = String(row['状态'] || '').trim();
    // 支持多种状态表示方式
    const isSold = statusStr === '已销售' || statusStr === '已售' || statusStr === 'sold' || statusStr === '出售';
    const status = isSold ? 'sold' : 'in_stock';

    // 打印状态判断日志，帮助调试
    if (process.env.NODE_ENV === 'development') {
      log.debug(`  状态判断: "${statusStr}" → ${status} (isSold: ${isSold})`);
    }

    // 智能获取或创建操作员ID
    const inventoryOperatorId = await this.getOrCreateUser(connection, row['入库员'], maps.users);
    const saleOperatorId = await this.getOrCreateUser(connection, row['销售员'], maps.users);

    // 创建手机记录
    const [result] = await connection.execute(
      `INSERT INTO phones (
        imei, serial_number, brand_id, model_id, color_id, memory_id,
        supplier_id, store_id, status, salestime, Inventorytime,
        purchase_cost, sale_price, remarks, is_new,
        inventory_operator_id, sale_operator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        effectiveImei,
        serialNumber || null,
        brandId,
        modelId,
        colorId,
        memoryId,
        supplierId,
        storeId,
        status,
        saleDate,
        purchaseDate,
        purchasePrice || null,
        salePrice || null,
        remarks || null,
        isNew,
        inventoryOperatorId,
        saleOperatorId
      ]
    );

    // 如果已售出，创建销售记录
    if (status === 'sold') {
      if (!saleDate) {
        log.debug(`⚠️ 手机 ${effectiveImei} 状态为已销售，但没有销售日期，跳过创建销售记录`);
      } else if (!customerId) {
        log.debug(`⚠️ 手机 ${effectiveImei} 状态为已销售，但没有客户信息（phone: ${phone}），跳过创建销售记录`);
      } else {
        log.debug(`✓ 创建销售记录: phone_id=${result.insertId}, customer_id=${customerId}, sale_date=${saleDate}`);
        const [saleResult] = await connection.execute(
          `INSERT INTO sales (phone_id, customer_id, sale_date, operator_id, status)
           VALUES (?, ?, ?, ?, 'completed')`,
          [result.insertId, customerId, saleDate, saleOperatorId]
        );
        log.debug(`  ✓ 销售记录创建成功: sale_id=${saleResult.insertId}`);
      }
    }

    return { status: 'imported', id: result.insertId };
  }

  /**
   * 获取或创建基础数据（智能版本 - 支持模糊匹配）
   */
  async getOrCreate(connection, table, name, map, field = 'name', extraData = {}) {
    if (!name) return null;

    const normalizedName = String(name).trim();
    if (!normalizedName) return null;

    // 检查是否已存在于映射中
    if (map.has(normalizedName)) {
      return map.get(normalizedName);
    }

    // 智能匹配：尝试模糊匹配，传入 extraData 以支持品牌关联
    const existingRecords = await this.findExistingRecord(connection, table, field, normalizedName, extraData);

    if (existingRecords && existingRecords.length > 0) {
      // 找到匹配的记录，添加到映射
      const id = existingRecords[0].id;
      map.set(normalizedName, id);
      log.debug(`  ✓ 匹配到${table}: "${normalizedName}" → ID ${id}`);

      // 如果是型号表，且提供了 brand_id，则更新型号的 brand_id
      if (table === 'models' && extraData.brand_id) {
        await connection.execute(
          'UPDATE models SET brand_id = ? WHERE id = ?',
          [extraData.brand_id, id]
        );
        log.debug(`  ✓ 更新型号品牌关联: model_id=${id} → brand_id=${extraData.brand_id}`);
      }

      return id;
    }

    // 未找到匹配的记录，自动创建新记录
    log.debug(`  ➕ 创建新${table}: "${normalizedName}"`);

    // 构建 INSERT 语句
    const columns = [field, 'status'];
    const values = [normalizedName, 1];
    const placeholders = ['?', '?'];

    // 处理额外字段（如 models 表的 brand_id）
    if (extraData.brand_id && table === 'models') {
      columns.push('brand_id');
      values.push(extraData.brand_id);
      placeholders.push('?');
    }

    const [result] = await connection.execute(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );

    const id = result.insertId;
    map.set(normalizedName, id);

    log.debug(`  ✓ 新${table}创建成功: ID=${id}, ${field}="${normalizedName}"`);

    return id;
  }

  /**
   * 查找现有记录（支持模糊匹配）
   * @param {Object} connection - 数据库连接
   * @param {string} table - 表名
   * @param {string} field - 字段名
   * @param {string} name - 要查找的名称
   * @param {Object} extraData - 额外数据（如 brand_id）
   */
  async findExistingRecord(connection, table, field, name, extraData = {}) {
    // 精确匹配 - 对于型号表，需要同时匹配品牌
    let query = `SELECT id, ${field}`;
    if (table === 'models') {
      query += ', brand_id';
    }
    query += ` FROM ${table} WHERE ${field} = ? AND status = 1`;
    const params = [name];

    // 型号表需要匹配品牌
    if (table === 'models' && extraData.brand_id) {
      query += ' AND brand_id = ?';
      params.push(extraData.brand_id);
    }
    query += ' LIMIT 1';

    const [exactMatches] = await connection.execute(query, params);

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    // 模糊匹配（忽略大小写、空格、特殊字符）
    const normalizedName = name.toLowerCase().replace(/[\s\-_]/g, '');

    let fuzzyQuery = `SELECT id, ${field}`;
    if (table === 'models') {
      fuzzyQuery += ', brand_id';
    }
    fuzzyQuery += ` FROM ${table} WHERE status = 1`;

    // 型号表需要过滤品牌
    const fuzzyParams = [];
    if (table === 'models' && extraData.brand_id) {
      fuzzyQuery += ' AND brand_id = ?';
      fuzzyParams.push(extraData.brand_id);
    }

    const [allRecords] = await connection.execute(fuzzyQuery, fuzzyParams);

    for (const record of allRecords) {
      const recordName = String(record[field] || '').toLowerCase().replace(/[\s\-_]/g, '');

      // 完全匹配（忽略格式差异）
      if (recordName === normalizedName) {
        log.debug(`  🔍 模糊匹配${table}: "${record[field]}" ≈ "${name}"`);
        return [record];
      }

      // 包含匹配（处理缩写或简称）
      if (recordName.includes(normalizedName) || normalizedName.includes(recordName)) {
        log.debug(`  🔍 包含匹配${table}: "${record[field]}" ∋ "${name}"`);
        return [record];
      }
    }

    return null;
  }

  /**
   * 获取或创建客户
   */
  async getOrCreateCustomer(connection, row, map) {
    const phone = String(row['手机号'] || '').trim();
    if (!phone) return null;

    // 获取 Apple ID - 支持多种可能的列名格式
    const appleId = String(
      row['Apple ID'] ||
      row['AppleID'] ||
      row['apple_id'] ||
      row['APPLEID'] ||
      row['AppleID '] ||  // 可能有尾随空格
      row[' Apple ID'] ||  // 可能有前导空格
      ''
    ).trim();

    // 检查是否已存在于映射中
    if (map.has(phone)) {
      const customerId = map.get(phone);

      // 如果提供了新的 Apple ID，更新客户信息
      if (appleId) {
        const [existingCustomer] = await connection.execute(
          'SELECT id, apple_id FROM customers WHERE id = ?',
          [customerId]
        );

        if (existingCustomer.length > 0) {
          const currentAppleId = existingCustomer[0].apple_id;

          // 只有当 Apple ID 为空或不同时才更新
          if (!currentAppleId || currentAppleId !== appleId) {
            await connection.execute(
              'UPDATE customers SET apple_id = ? WHERE id = ?',
              [appleId, customerId]
            );
            log.debug(`✓ 更新客户 Apple ID: ID=${customerId}, phone=${phone}, apple_id=${appleId}`);
          }
        }
      }

      return customerId;
    }

    // 先查询数据库，检查是否已存在该手机号的客户
    const [existingCustomers] = await connection.execute(
      'SELECT id, name, phone, apple_id FROM customers WHERE phone = ? LIMIT 1',
      [phone]
    );

    if (existingCustomers.length > 0) {
      const customerId = existingCustomers[0].id;
      // 添加到映射中，避免重复查询
      map.set(phone, customerId);
      log.debug(`✓ 匹配到已有客户: ID=${customerId}, phone=${phone}, name=${existingCustomers[0].name || '(未命名)'}`);

      // 如果提供了新的 Apple ID，更新客户信息
      if (appleId && appleId !== existingCustomers[0].apple_id) {
        await connection.execute(
          'UPDATE customers SET apple_id = ? WHERE id = ?',
          [appleId, customerId]
        );
        log.debug(`✓ 更新客户 Apple ID: ID=${customerId}, apple_id=${appleId}`);
      }

      return customerId;
    }

    // 未找到，创建新客户
    const saleDate = row['销售日期'] || null;
    let registerDate = saleDate || new Date().toISOString().slice(0, 10);

    // 处理 Excel 日期格式（可能是数字或特殊格式）
    if (saleDate && typeof saleDate === 'number') {
      // Excel 日期是从 1900-01-01 开始的天数
      const excelDate = new Date(Math.round((saleDate - 25569) * 86400 * 1000));
      registerDate = excelDate.toISOString().slice(0, 10);
    }

    // 生成会员号：从 TF10000 开始递增
    // 先查询当前最大的会员号
    const [maxMember] = await connection.execute(
      `SELECT member_number FROM customers WHERE member_number LIKE 'TF%' ORDER BY member_number DESC LIMIT 1`
    );

    let nextNumber = 10000; // 默认从 TF10000 开始
    if (maxMember.length > 0 && maxMember[0].member_number) {
      const memberNum = maxMember[0].member_number;
      const currentNum = parseInt(memberNum.replace('TF', ''), 10);
      if (!isNaN(currentNum) && currentNum >= 10000) {
        nextNumber = currentNum + 1;
      }
    }

    const memberNumber = 'TF' + nextNumber;

    // 创建新客户，使用销售日期作为注册时间
    // 使用 NOW() 作为 created_at 确保正确的时间戳
    const [result] = await connection.execute(
      `INSERT INTO customers (name, phone, member_number, apple_id, customer_type, status, register_date, created_at)
       VALUES (?, ?, ?, ?, 'individual', 1, ?, NOW())`,
      [row['客户姓名'] || '未知', phone, memberNumber, appleId || null, registerDate]
    );

    // 验证插入是否成功
    if (!result || result.affectedRows === 0) {
      log.error(`❌ 创建客户失败: phone=${phone}, name=${row['客户姓名']}`);
      throw new Error(`创建客户失败: ${phone}`);
    }

    const id = result.insertId;

    // 验证 insertId 是否有效
    if (!id || id <= 0) {
      log.error(`❌ 客户 ID 无效: insertId=${id}, phone=${phone}`);
      // 尝试重新查询获取刚插入的记录
      const [newCustomers] = await connection.execute(
        `SELECT id FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1`,
        [phone]
      );
      if (newCustomers.length > 0) {
        const validId = newCustomers[0].id;
        log.debug(`✓ 通过查询获取客户ID: ${validId} (phone: ${phone})`);
        map.set(phone, validId);
        return validId;
      }
      throw new Error(`无法获取客户ID: ${phone}`);
    }

    log.debug(`✓ 创建客户成功: ID=${id}, phone=${phone}, member_number=${memberNumber}, apple_id=${appleId || '(无)'}`);
    map.set(phone, id);

    return id;
  }

  /**
   * 获取或创建员工（智能匹配）
   * 支持多种匹配方式：name、username、自动创建
   */
  async getOrCreateUser(connection, operatorName, map) {
    if (!operatorName) return null;

    const name = String(operatorName).trim();
    if (!name) return null;

    // 检查是否已存在于映射中（可能是 name 或 username）
    if (map.has(name)) {
      return map.get(name);
    }

    // 智能匹配：尝试模糊匹配
    const [existingUsers] = await connection.execute(
      'SELECT id, name, username FROM users WHERE name = ? OR username = ?',
      [name, name]
    );

    if (existingUsers.length > 0) {
      // 找到匹配的员工，添加到映射
      const userId = existingUsers[0].id;
      map.set(name, userId);
      log.debug(`  ✓ 匹配到员工: "${name}" → ID ${userId}`);
      return userId;
    }

    // 未找到匹配的员工，自动创建新员工
    log.debug(`  ➕ 创建新员工: "${name}"`);

    // 生成用户名：如果名字是中文，使用拼音首字母；否则使用名字的小写
    let username = name.toLowerCase().replace(/\s+/g, '');

    // 检查用户名是否已存在
    const [usernameCheck] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    // 如果用户名已存在，添加数字后缀
    let suffix = 1;
    let originalUsername = username;
    while (usernameCheck.length > 0) {
      username = originalUsername + suffix;
      const [check] = await connection.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
      if (check.length === 0) break;
      suffix++;
    }

    // 生成默认密码（使用 MD5 或 bcrypt，这里简化处理）
    const bcrypt = require('bcryptjs');
    const defaultPassword = '123456'; // 默认密码
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // 创建新员工
    const [result] = await connection.execute(
      `INSERT INTO users (username, name, password, role_id, status, created_at)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'employee' LIMIT 1), 1, NOW())`,
      [username, name, hashedPassword]
    );

    const userId = result.insertId;
    map.set(name, userId);
    map.set(username, userId); // 同时注册 username 映射

    log.debug(`  ✓ 新员工创建成功: ID=${userId}, name="${name}", username="${username}", 默认密码="123456"`);

    return userId;
  }

  /**
   * 更新进度
   */
  updateProgress(importId, progress, message) {
    // 确保 importId 是字符串类型，保持键的一致性
    const key = String(importId);

    let progressData = this.importProgress.get(key);

    if (!progressData) {
      // 如果进度不存在，创建新的
      progressData = {
        status: 'processing',
        progress: 0,
        message: ''
      };
      this.importProgress.set(key, progressData);
    }

    // 更新进度数据
    progressData.progress = progress;
    progressData.message = message;

    // 更新时间戳（用于超时清理）
    this.importProgressTimestamps.set(key, Date.now());

    if (progress === 100) {
      progressData.status = 'completed';
    } else if (progress === -1) {
      progressData.status = 'failed';
    }
  }

  /**
   * 获取导入进度
   */
  getImportProgress(importId) {
    // 确保 importId 是字符串类型，保持键的一致性
    return this.importProgress.get(String(importId));
  }

  /**
   * 获取导入历史
   */
  getImportHistory() {
    return this.importHistory;
  }

  /**
   * 获取活跃的导入任务列表（用于调试）
   */
  getActiveTasks() {
    const tasks = [];
    const now = Date.now();

    for (const [importId, progress] of this.importProgress.entries()) {
      const timestamp = this.importProgressTimestamps.get(importId) || 0;
      const age = now - timestamp;
      const ageMinutes = Math.floor(age / 60000);

      tasks.push({
        importId,
        progress,
        ageMinutes,
        timestamp: new Date(timestamp).toISOString()
      });
    }

    return tasks;
  }

  /**
   * 手动清理指定的导入进度
   */
  clearProgress(importId) {
    const key = String(importId);
    this.importProgress.delete(key);
    this.importProgressTimestamps.delete(key);
    log.debug(`🧹 手动清理导入进度: ${importId}`);
  }

  /**
   * 保存导入历史到数据库
   */
  async saveImportHistory(connection, historyData) {
    try {
      log.debug('📝 准备保存导入历史:', {
        import_id: historyData.import_id,
        user_id: historyData.user_id,
        user_name: historyData.user_name,
        strategy: historyData.strategy,
        file_name: historyData.file_name,
        total_records: historyData.total_records,
        imported: historyData.imported,
        updated: historyData.updated,
        skipped: historyData.skipped,
        error_count: historyData.error_count,
        status: historyData.status
      });

      const startTime = new Date(historyData.start_time).toISOString().slice(0, 19).replace('T', ' ');
      const endTime = historyData.end_time ? new Date(historyData.end_time).toISOString().slice(0, 19).replace('T', ' ') : null;

      await connection.execute(
        `INSERT INTO import_history (
          import_id, user_id, user_name, strategy, file_name,
          total_records, imported, updated, skipped, error_count,
          status, error_message, start_time, end_time, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          historyData.import_id,
          historyData.user_id,
          historyData.user_name,
          historyData.strategy,
          historyData.file_name,
          historyData.total_records,
          historyData.imported,
          historyData.updated,
          historyData.skipped,
          historyData.error_count,
          historyData.status,
          historyData.error_message,
          startTime,
          endTime,
          historyData.duration_ms
        ]
      );

      log.debug(`✅ 导入历史已保存到数据库: import_id=${historyData.import_id}`);
    } catch (error) {
      log.error(`❌ 保存导入历史失败:`, error);
      log.error(`错误详情:`, {
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage,
        sqlState: error.sqlState
      });
      // 不抛出错误，避免影响导入流程
    }
  }
}

module.exports = DataImportService;
