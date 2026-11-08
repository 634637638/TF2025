'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const DatabaseSyncManagementService = require('../src/services/database-sync-management.service')
const DatabaseSyncService = require('../src/services/database-sync.service')
const DatabaseSyncManagementRepository = require('../src/repositories/database-sync-management.repository')
const LocalToCloudSyncService = require('../src/services/local-to-cloud-sync.service')
const SmartSyncService = require('../src/services/smart-sync.service')

const createService = ({ query = async () => [[]], syncService = new DatabaseSyncService() } = {}) => {
  const events = []
  const connection = {
    query: async (...args) => { events.push(['query', ...args]); return query(...args) },
    release() { events.push('release') }
  }
  const service = new DatabaseSyncManagementService({
    syncService,
    database: () => ({ async getConnection() { events.push('acquire'); return connection } })
  })
  return { service, events, connection }
}

test('同步本地表列表在读取成功和查询失败时均释放一次', async () => {
  const success = createService({ query: async () => [[{ table: 'phones' }, { table: 'sales' }]] })
  assert.deepEqual(await success.service.getLocalTables(), { success: true, tables: ['phones', 'sales'] })
  assert.deepEqual(success.events.filter(event => typeof event === 'string'), ['acquire', 'release'])
  const failure = createService({ query: async () => { throw new Error('query failed') } })
  await assert.rejects(failure.service.getLocalTables(), /query failed/)
  assert.deepEqual(failure.events.filter(event => typeof event === 'string'), ['acquire', 'release'])
})

test('同步表结构先校验标识符，缺表仍释放，计数仓储也拒绝非法表名', async () => {
  const { service, events } = createService()
  await assert.rejects(service.getLocalTableStructure({ tableName: 'phones`; DROP TABLE users' }), /表名不合法/)
  assert.equal(events.length, 0)
  await assert.rejects(service.getLocalTableStructure({ tableName: 'phones' }), error => error.statusCode === 404)
  assert.deepEqual(events.filter(event => typeof event === 'string'), ['acquire', 'release'])
  const repository = new DatabaseSyncManagementRepository()
  assert.throws(() => repository.countTable({ query() { assert.fail('invalid SQL must not run') } }, 'phones;DELETE'), /表名不合法/)
})

test('同步映射/预检/执行保留目标连接与用户归属，业务失败后释放', async () => {
  for (const operation of ['suggestFieldMapping', 'preCheckSync', 'executeSync']) {
    let received
    const { service, events, connection } = createService({ syncService: {
      async [operation](...args) { received = args; throw new Error('operation failed') }
    } })
    const input = operation === 'suggestFieldMapping'
      ? { connectionId: 'external', sourceTable: 'phones', targetTable: 'phones' }
      : { connectionId: 'external', configId: 'mapping' }
    const actor = { id: 7 }
    await assert.rejects(service[operation](input, actor), /operation failed/)
    assert.ok(received.includes(connection))
    assert.equal(received.at(-1), operation === 'executeSync' ? actor : 7)
    assert.deepEqual(events.filter(event => typeof event === 'string'), ['acquire', 'release'])
  }
})

test('同步预检统计本地和已有外部连接，禁止跨用户读取', async () => {
  const sync = new DatabaseSyncService()
  const cloud = { async query(sql) { return sql.includes('SELECT p.*') ? [[]] : [[{ total: 4 }]] } }
  sync.externalConnections.set('external', { config: { ownerId: '7' }, connection: cloud })
  const { service, events } = createService({ syncService: sync, query: async sql => sql.includes('SELECT p.*') ? [[]] : [[{ total: 3 }]] })
  await assert.rejects(service.localToCloudPreCheck({ connectionId: 'external' }, { id: 8 }), error => error.statusCode === 403)
  assert.equal(events.length, 0)
  const result = await service.localToCloudPreCheck({ connectionId: 'external' }, { id: 7 })
  assert.equal(result.analysis.customers.local, 3)
  assert.equal(result.analysis.customers.cloud, 4)
  assert.equal(result.summary.relations.brands, 4)
  assert.deepEqual(events.filter(event => typeof event === 'string'), ['acquire', 'release'])
})

test('两个本地到云端入口复用同一外部连接注册表与参数', async t => {
  const registry = new DatabaseSyncService()
  const captured = []
  t.mock.method(LocalToCloudSyncService.prototype, 'syncLocalToCloud', async function (...args) {
    captured.push({ registry: this.syncService, args })
    return { success: true }
  })
  const { service } = createService({ syncService: registry })
  const body = { connectionId: 'external', tables: ['phones'], dryRun: true }
  const actor = { id: 7 }
  await service.localToCloudSync(body, actor)
  await service.localToCloudExecute(body, actor)
  for (const result of captured) {
    assert.equal(result.registry, registry)
    assert.deepEqual(result.args, ['external', { tables: ['phones'], dryRun: true }, actor])
  }
  assert.equal(captured.length, 2)
})

test('智能同步在获取本地连接前拒绝其他用户的外部连接', async () => {
  const registry = new DatabaseSyncService()
  registry.externalConnections.set('external', { config: { ownerId: '7' }, connection: { query() { assert.fail('must not read external data') } } })
  const service = new SmartSyncService(registry)
  await assert.rejects(service.smartSync('external', { id: 8 }), error => error.statusCode === 403)
})
