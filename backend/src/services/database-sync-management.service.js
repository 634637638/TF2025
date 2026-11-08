'use strict'

const crypto = require('crypto')
const BaseService = require('../core/base/base.service')
const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const DatabaseSyncService = require('./database-sync.service')
const SmartSyncService = require('./smart-sync.service')
const DatabaseSyncManagementRepository = require('../repositories/database-sync-management.repository')

class DatabaseSyncManagementService extends BaseService {
  constructor({ database = getDatabase, syncService = new DatabaseSyncService(), smartSyncService = new SmartSyncService(syncService), repository = new DatabaseSyncManagementRepository() } = {}) {
    super()
    Object.assign(this, { database, syncService, smartSyncService, repository })
  }

  async createConnection(body, actor) {
    const { host, port, user, password, database } = body

    // 验证必填字段
    if (!host || !user || !password || !database) {
      throw this.createError('缺少必填字段', 400)
    }

    // 生成连接ID
    const connectionId = `ext_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`

    // 创建连接
    const result = await this.syncService.createConnection({
      id: connectionId,
      ownerId: this.getActorId(actor),
      host,
      port: port || 3306,
      user,
      password,
      database
    })

    return result
  }

  async getConnections(actor) {
    const connections = this.syncService.getConnections(this.getActorId(actor))
    return {
      success: true,
      connections
    }
  }

  async closeConnection(params, actor) {
    const { connectionId } = params
    const result = await this.syncService.closeConnection(connectionId, this.getActorId(actor))
    return result
  }

  async getTables(params, actor) {
    const { connectionId } = params
    const result = await this.syncService.getTables(connectionId, this.getActorId(actor))
    return result
  }

  async getTableStructure(params, actor) {
    const { connectionId, tableName } = params
    const result = await this.syncService.getTableStructure(connectionId, tableName, this.getActorId(actor))
    return result
  }

  async getTableData(params, query, actor) {
    const { connectionId, tableName } = params
    const { limit, offset } = query

    const result = await this.syncService.getTableData(connectionId, tableName, {
      limit: parseInt(limit) || 10,
      offset: parseInt(offset) || 0
    }, this.getActorId(actor))

    return result
  }

  async getLocalTables() {
    return withConnection(this.database, async connection => {
      const [rows] = await this.repository.listTables(connection)
      const tables = rows.map(row => Object.values(row)[0])

      return {
        success: true,
        tables
      }
    })
  }

  async getLocalTableStructure(params) {
    const tableName = this.syncService.normalizeIdentifier(params.tableName, '表名')
    return withConnection(this.database, async connection => {
      // 获取列信息
      const [columns] = await this.repository.columns(connection, tableName)

      if (columns.length === 0) {
        throw this.createError('数据表不存在', 404)
      }

      // 获取表注释
      const [tableComment] = await this.repository.comment(connection, tableName)

      // 获取记录数
      const [count] = await this.repository.countTable(connection, tableName)

      return {
        success: true,
        table: tableName,
        comment: tableComment[0]?.comment || '',
        recordCount: count[0].total,
        columns
      }
    })
  }

  async saveMappingConfig(body, actor) {
    const {
      id,
      sourceTable,
      targetTable,
      fieldMappings,
      syncOptions
    } = body

    // 验证必填字段
    if (!id || !sourceTable || !targetTable || !fieldMappings) {
      throw this.createError('缺少必填字段', 400)
    }

    const result = this.syncService.saveMappingConfig({
      id,
      ownerId: this.getActorId(actor),
      sourceTable,
      targetTable,
      fieldMappings,
      syncOptions
    })

    return result
  }

  async getMappingConfigs(actor) {
    const configs = this.syncService.getAllMappingConfigs(this.getActorId(actor))
    return {
      success: true,
      configs
    }
  }

  async getMappingConfig(params, actor) {
    const { configId } = params
    const config = this.syncService.getMappingConfig(configId, this.getActorId(actor))

    if (!config) {
      throw this.createError('配置不存在', 404)
    }

    return {
      success: true,
      config
    }
  }

  async deleteMappingConfig(params, actor) {
    const { configId } = params
    const result = this.syncService.deleteMappingConfig(configId, this.getActorId(actor))
    return result
  }

  async suggestFieldMapping(query, actor) {
    const { connectionId, sourceTable, targetTable } = query

    if (!connectionId || !sourceTable || !targetTable) {
      throw this.createError('缺少必填参数', 400)
    }

    return withConnection(this.database, async targetConnection => {
      const result = await this.syncService.suggestFieldMapping(
        connectionId,
        sourceTable,
        targetTable,
        targetConnection,
        this.getActorId(actor)
      )

      return result
    })
  }

  async preCheckSync(body, actor) {
    const { connectionId, configId } = body

    if (!connectionId || !configId) {
      throw this.createError('缺少必填参数', 400)
    }

    return withConnection(this.database, async targetConnection => {
      const result = await this.syncService.preCheckSync(
        connectionId,
        configId,
        targetConnection,
        this.getActorId(actor)
      )

      return result
    })
  }

  async executeSync(body, actor) {
    const { connectionId, configId } = body
    const user = actor

    if (!connectionId || !configId) {
      throw this.createError('缺少必填参数', 400)
    }

    return withConnection(this.database, async targetConnection => {
      // 异步执行同步
      const result = await this.syncService.executeSync(
        connectionId,
        configId,
        targetConnection,
        user
      )

      return result
    })
  }

  async getSyncProgress(params, actor) {
    const { syncId } = params
    const progress = this.syncService.getSyncProgress(syncId, this.getActorId(actor))

    if (!progress) {
      throw this.createError('同步任务不存在', 404)
    }

    return {
      success: true,
      progress
    }
  }

  async smartSync(body, actor) {
    const { connectionId } = body
    const user = actor

    if (!connectionId) {
      throw this.createError('缺少连接ID', 400)
    }

    const result = await this.smartSyncService.smartSync(connectionId, user)

    return result
  }

  async localToCloudSync(body, actor) {
    const { connectionId, tables, dryRun = false } = body

    if (!connectionId) {
      throw this.createError('缺少连接ID', 400)
    }

    const LocalToCloudSyncService = require('./local-to-cloud-sync.service')

    const localToCloudService = new LocalToCloudSyncService(this.syncService)
    const result = await localToCloudService.syncLocalToCloud(connectionId, {
      tables: tables || ['phones', 'customers', 'sales', 'brands', 'models', 'colors', 'memories'],
      dryRun
    }, actor)

    return result
  }

  async localToCloudPreCheck(body, actor) {
    const { connectionId } = body

    if (!connectionId) {
      throw this.createError('缺少连接ID', 400)
    }

    // 预检查：读取当前用户已持有的外部连接。
    const cloudConnection = this.syncService.getConnection(connectionId, this.getActorId(actor))
    return withConnection(this.database, async localConnection => {
      const analysis = {
        phones: { local: 0, cloud: 0, conflicts: 0, toUpdate: 0, toInsert: [] },
        customers: { local: 0, cloud: 0, conflicts: 0, toUpdate: 0, toInsert: [] },
        sales: { local: 0, cloud: 0, conflicts: 0, toUpdate: 0, toInsert: [] },
        relations: { brands: 0, models: 0, colors: 0, memories: 0, customers: 0 }
      }

      // 分析手机数据冲突
      const [localPhones] = await this.repository.phones(localConnection)

      const [cloudPhones] = await this.repository.phones(cloudConnection)

      analysis.phones.local = localPhones.length
      analysis.phones.cloud = cloudPhones.length

      // 检查冲突（本地已售，云端在库）
      for (const localPhone of localPhones) {
        const cloudMatch = cloudPhones.find(p =>
          (p.imei === localPhone.imei) ||
            (p.serial_number === localPhone.serial_number)
        )

        if (cloudMatch) {
          const isLocalSold = localPhone.sale_status === 'sold' || localPhone.sold_date || localPhone.customer_id
          const isCloudAvailable = !cloudMatch.sold_date && !cloudMatch.customer_id

          if (isLocalSold && isCloudAvailable) {
            // 冲突：本地已售，云端在库
            analysis.phones.conflicts++
            analysis.phones.toUpdate++


          }
        }
      }

      // 分析其他表的数据量
      for (const tableName of ['customers', 'sales']) {
        const [local] = await this.repository.countTable(localConnection, tableName)
        const [cloud] = await this.repository.countTable(cloudConnection, tableName)

        analysis[tableName].local = local[0].total
        analysis[tableName].cloud = cloud[0].total
      }

      // 分析关联数据缺失情况
      // 品牌、型号、颜色、内存、客户
      const [cloudBrands] = await this.repository.activeBrands(cloudConnection)
      analysis.relations.brands = cloudBrands[0].total

      const [cloudModels] = await this.repository.activeModels(cloudConnection)
      analysis.relations.models = cloudModels[0].total

      const [cloudColors] = await this.repository.activeColors(cloudConnection)
      analysis.relations.colors = cloudColors[0].total

      const [cloudMemories] = await this.repository.activeMemories(cloudConnection)
      analysis.relations.memories = cloudMemories[0].total

      const [cloudCustomers] = await this.repository.activeCustomers(cloudConnection)
      analysis.relations.customers = cloudCustomers[0].total

      return {
        success: true,
        analysis,
        summary: {
          totalConflicts: analysis.phones.conflicts + analysis.customers.conflicts + analysis.sales.conflicts,
          phones: analysis.phones,
          customers: analysis.customers,
          sales: analysis.sales,
          relations: analysis.relations
        }
      }
    })

  }

  async localToCloudExecute(body, actor) {
    return this.localToCloudSync(body, actor)
  }
}

module.exports = DatabaseSyncManagementService
