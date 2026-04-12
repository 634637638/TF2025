const log = require('../utils/log');
/**
 * 数据库同步控制器
 * 处理跨数据库数据同步的请求
 */
const { getDatabase } = require('../config/database');
const DatabaseSyncService = require('../services/database-sync.service');
const SmartSyncService = require('../services/smart-sync.service');

// 创建服务实例
const syncService = new DatabaseSyncService();
const smartSyncService = new SmartSyncService();

class DatabaseSyncController {
  /**
   * 创建外部数据库连接
   */
  async createConnection(req, res) {
    try {
      const { host, port, user, password, database } = req.body;

      // 验证必填字段
      if (!host || !user || !password || !database) {
        return res.status(400).json({
          success: false,
          message: '缺少必填字段'
        });
      }

      // 生成连接ID
      const connectionId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 创建连接
      const result = await syncService.createConnection({
        id: connectionId,
        host,
        port: port || 3306,
        user,
        password,
        database
      });

      res.json(result);
    } catch (error) {
      log.error('创建数据库连接失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取所有连接
   */
  async getConnections(req, res) {
    try {
      const connections = syncService.getConnections();
      res.json({
        success: true,
        connections
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 关闭连接
   */
  async closeConnection(req, res) {
    try {
      const { connectionId } = req.params;
      const result = await syncService.closeConnection(connectionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取外部数据库的表列表
   */
  async getTables(req, res) {
    try {
      const { connectionId } = req.params;
      const result = await syncService.getTables(connectionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取表结构
   */
  async getTableStructure(req, res) {
    try {
      const { connectionId, tableName } = req.params;
      const result = await syncService.getTableStructure(connectionId, tableName);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取表数据预览
   */
  async getTableData(req, res) {
    try {
      const { connectionId, tableName } = req.params;
      const { limit, offset, where, orderBy } = req.query;

      const result = await syncService.getTableData(connectionId, tableName, {
        limit: parseInt(limit) || 10,
        offset: parseInt(offset) || 0,
        where: where || '',
        orderBy: orderBy || ''
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取本地数据库的表列表
   */
  async getLocalTables(req, res) {
    try {
      const connection = await getDatabase().getConnection();

      try {
        const [rows] = await connection.query('SHOW TABLES');
        const tables = rows.map(row => Object.values(row)[0]);

        res.json({
          success: true,
          tables
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取本地表结构
   */
  async getLocalTableStructure(req, res) {
    try {
      const { tableName } = req.params;
      const connection = await getDatabase().getConnection();

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
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `, [tableName]);

        // 获取表注释
        const [tableComment] = await connection.query(`
          SELECT TABLE_COMMENT as comment
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [tableName]);

        // 获取记录数
        const [count] = await connection.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);

        res.json({
          success: true,
          table: tableName,
          comment: tableComment[0]?.comment || '',
          recordCount: count[0].total,
          columns
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 保存映射配置
   */
  async saveMappingConfig(req, res) {
    try {
      const {
        id,
        sourceTable,
        targetTable,
        fieldMappings,
        syncOptions
      } = req.body;

      // 验证必填字段
      if (!id || !sourceTable || !targetTable || !fieldMappings) {
        return res.status(400).json({
          success: false,
          message: '缺少必填字段'
        });
      }

      const result = syncService.saveMappingConfig({
        id,
        sourceTable,
        targetTable,
        fieldMappings,
        syncOptions
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取所有映射配置
   */
  async getMappingConfigs(req, res) {
    try {
      const configs = syncService.getAllMappingConfigs();
      res.json({
        success: true,
        configs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取单个映射配置
   */
  async getMappingConfig(req, res) {
    try {
      const { configId } = req.params;
      const config = syncService.getMappingConfig(configId);

      if (!config) {
        return res.status(404).json({
          success: false,
          message: '配置不存在'
        });
      }

      res.json({
        success: true,
        config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 删除映射配置
   */
  async deleteMappingConfig(req, res) {
    try {
      const { configId } = req.params;
      const result = syncService.deleteMappingConfig(configId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 智能字段映射建议
   */
  async suggestFieldMapping(req, res) {
    try {
      const { connectionId, sourceTable, targetTable } = req.query;

      if (!connectionId || !sourceTable || !targetTable) {
        return res.status(400).json({
          success: false,
          message: '缺少必填参数'
        });
      }

      const targetConnection = await getDatabase().getConnection();

      try {
        const result = await syncService.suggestFieldMapping(
          connectionId,
          sourceTable,
          targetTable,
          targetConnection
        );

        res.json(result);
      } finally {
        targetConnection.release();
      }
    } catch (error) {
      log.error('生成映射建议失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 数据预检查
   */
  async preCheckSync(req, res) {
    try {
      const { connectionId, configId } = req.body;

      if (!connectionId || !configId) {
        return res.status(400).json({
          success: false,
          message: '缺少必填参数'
        });
      }

      const targetConnection = await getDatabase().getConnection();

      try {
        const result = await syncService.preCheckSync(
          connectionId,
          configId,
          targetConnection
        );

        res.json(result);
      } finally {
        targetConnection.release();
      }
    } catch (error) {
      log.error('预检查失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 执行数据同步
   */
  async executeSync(req, res) {
    try {
      const { connectionId, configId } = req.body;
      const user = req.user;

      if (!connectionId || !configId) {
        return res.status(400).json({
          success: false,
          message: '缺少必填参数'
        });
      }

      const targetConnection = await getDatabase().getConnection();

      try {
        // 异步执行同步
        const result = await syncService.executeSync(
          connectionId,
          configId,
          targetConnection,
          user
        );

        res.json(result);
      } finally {
        targetConnection.release();
      }
    } catch (error) {
      log.error('执行同步失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取同步进度
   */
  async getSyncProgress(req, res) {
    try {
      const { syncId } = req.params;
      const progress = syncService.getSyncProgress(syncId);

      if (!progress) {
        return res.status(404).json({
          success: false,
          message: '同步任务不存在'
        });
      }

      res.json({
        success: true,
        progress
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 一键智能同步
   */
  async smartSync(req, res) {
    try {
      const { connectionId } = req.body;
      const user = req.user;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: '缺少连接ID'
        });
      }

      const result = await smartSyncService.smartSync(connectionId, user);

      res.json(result);
    } catch (error) {
      log.error('智能同步失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 本地到云端同步（一键）
   */
  async localToCloudSync(req, res) {
    try {
      const { connectionId, tables, dryRun = false } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: '缺少连接ID'
        });
      }

      const LocalToCloudSyncService = require('../services/local-to-cloud-sync.service');
      const syncService = new LocalToCloudSyncService();

      const result = await syncService.syncLocalToCloud(connectionId, {
        tables: tables || ['phones', 'customers', 'sales', 'brands', 'models', 'colors', 'memories'],
        dryRun
      });

      res.json(result);
    } catch (error) {
      log.error('本地到云端同步失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 本地到云端预检查
   */
  async localToCloudPreCheck(req, res) {
    try {
      const { connectionId, tables } = req.body;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: '缺少连接ID'
        });
      }

      const LocalToCloudSyncService = require('../services/local-to-cloud-sync.service');
      const syncService = new LocalToCloudSyncService();

      // 预检查：分析本地数据和云端数据的差异
      const cloudConnection = syncService.syncService.getConnection(connectionId);
      const localConnection = await require('../config/database').getDatabase().getConnection();

      try {
        const analysis = {
          phones: { local: 0, cloud: 0, conflicts: 0, toUpdate: 0, toInsert: [] },
          customers: { local: 0, cloud: 0, conflicts: 0, toUpdate: 0, toInsert: [] },
          sales: { local: 0, cloud: 0, conflicts: 0, toUpdate: 0, toInsert: [] },
          relations: { brands: 0, models: 0, colors: 0, memories: 0, customers: 0 }
        };

        // 分析手机数据冲突
        const [localPhones] = await localConnection.query(`
          SELECT p.*,
            b.name as brand_name,
            mo.name as model_name,
            c.name as color_name,
            me.size as memory_size
          FROM phones p
          LEFT JOIN brands b ON p.brand_id = b.id
          LEFT JOIN models mo ON p.model_id = mo.id
          LEFT JOIN colors c ON p.color_id = c.id
          LEFT JOIN memories me ON p.memory_id = me.id
        `);

        const [cloudPhones] = await cloudConnection.query(`
          SELECT p.*,
            b.name as brand_name,
            mo.name as model_name,
            c.name as color_name,
            me.size as memory_size
          FROM phones p
          LEFT JOIN brands b ON p.brand_id = b.id
          LEFT JOIN models mo ON p.model_id = mo.id
          LEFT JOIN colors c ON p.color_id = c.id
          LEFT JOIN memories me ON p.memory_id = me.id
        `);

        analysis.phones.local = localPhones.length;
        analysis.phones.cloud = cloudPhones.length;

        // 检查冲突（本地已售，云端在库）
        const conflictRecords = [];
        for (const localPhone of localPhones) {
          const cloudMatch = cloudPhones.find(p =>
            (p.imei === localPhone.imei) ||
            (p.serial_number === localPhone.serial_number)
          );

          if (cloudMatch) {
            const isLocalSold = localPhone.sale_status === 'sold' || localPhone.sold_date || localPhone.customer_id;
            const isCloudAvailable = !cloudMatch.sold_date && !cloudMatch.customer_id;

            if (isLocalSold && isCloudAvailable) {
              // 冲突：本地已售，云端在库
              analysis.phones.conflicts++;
              analysis.phones.toUpdate++;

              conflictRecords.push({
                imei: localPhone.imei,
                local: { status: '已售', customer: localPhone.customer_name },
                cloud: { status: '在库', customer: null },
                action: 'updateCloudToLocal'
              });
            }
          }
        }

        // 分析其他表的数据量
        for (const tableName of ['customers', 'sales']) {
          const [local] = await localConnection.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
          const [cloud] = await cloudConnection.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);

          analysis[tableName].local = local[0].total;
          analysis[tableName].cloud = cloud[0].total;
        }

        // 分析关联数据缺失情况
        // 品牌、型号、颜色、内存、客户
        const [cloudBrands] = await cloudConnection.query('SELECT COUNT(*) as total FROM brands WHERE status = 1');
        analysis.relations.brands = cloudBrands[0].total;

        const [cloudModels] = await cloudConnection.query('SELECT COUNT(*) as total FROM models WHERE status = 1');
        analysis.relations.models = cloudModels[0].total;

        const [cloudColors] = await cloudConnection.query('SELECT COUNT(*) as total FROM colors WHERE status = 1');
        analysis.relations.colors = cloudColors[0].total;

        const [cloudMemories] = await cloudConnection.query('SELECT COUNT(*) as total FROM memories WHERE status = 1');
        analysis.relations.memories = cloudMemories[0].total;

        const [cloudCustomers] = await cloudConnection.query('SELECT COUNT(*) as total FROM customers WHERE status = 1');
        analysis.relations.customers = cloudCustomers[0].total;

        res.json({
          success: true,
          analysis,
          summary: {
            totalConflicts: analysis.phones.conflicts + analysis.customers.conflicts + analysis.sales.conflicts,
            phones: analysis.phones,
            customers: analysis.customers,
            sales: analysis.sales,
            relations: analysis.relations
          }
        });
      } finally {
        localConnection.release();
      }

    } catch (error) {
      log.error('预检查失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 执行本地到云端同步
   */
  async localToCloudExecute(req, res) {
    try {
      const { connectionId, tables, dryRun = false } = req.body;
      const user = req.user;

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          message: '缺少连接ID'
        });
      }

      const LocalToCloudSyncService = require('../services/local-to-cloud-sync.service');
      const syncService = new LocalToCloudSyncService();

      const result = await syncService.syncLocalToCloud(connectionId, {
        tables: tables || ['phones', 'customers', 'sales', 'brands', 'models', 'colors', 'memories'],
        dryRun
      });

      res.json(result);
    } catch (error) {
      log.error('本地到云端同步执行失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new DatabaseSyncController();
