'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createPurchaseSnapshot, projectPurchaseSnapshot, purchaseSnapshotText } = require('../src/utils/accessory-purchase-snapshot')
const Service = require('../src/services/accessory-purchase.service')
const AccessoryService = require('../src/services/accessory.service')
const Repository = require('../src/repositories/accessory.repository')
const PurchaseRepository = require('../src/repositories/accessory-purchase.repository')
const Controller = require('../src/controllers/accessory-purchase.controller')
const { migrate } = require('../scripts/migrate-accessory-purchase-snapshots')

const identity = { accessory_id: 5, supplier_id: 8, store_id: 1 }
const source = () => ({ ...identity, name: '原充电器', category: '原充电头', brand_name: '原实际品牌', product_model: 'MWVW3CH',
  color_name: '白', unit: '个', supplier_name: '原供应商', store_name: '原一店' })
const actor = { id: 7, store_ids: [1] }

test('采购资料快照白名单与原身份核对，后续主档改名不会覆盖原采购；空原值不补当前资料', () => {
  const snapshot = createPurchaseSnapshot({ ...source(), internal_secret: '不可输出', purchase_cost: 999 }, identity)
  assert.equal('internal_secret' in snapshot, false)
  assert.equal('purchase_cost' in snapshot, false)
  snapshot.brand_name = null
  const row = { id: 31, ...identity, name: '改名后的商品', brand_name: '改名后的品牌', product_snapshot: JSON.stringify(snapshot) }
  const result = projectPurchaseSnapshot(row)
  assert.equal(result.name, '原充电器'); assert.equal(result.brand_name, null)
  assert.equal(result.supplier_name, '原供应商'); assert.equal(result.store_name, '原一店')
  assert.equal(result.has_snapshot, true); assert.equal('product_snapshot' in result, false)
  assert.equal('version' in result, false)
  assert.equal(row.name, '改名后的商品')
  const legacy = projectPurchaseSnapshot({ ...row, product_snapshot: null })
  assert.equal(legacy.name, '改名后的商品'); assert.equal(legacy.has_snapshot, false)
})

for (const [label, mutate] of [
  ['未知版本', row => { row.version = 2 }], ['商品身份', row => { row.accessory_id = 9 }],
  ['供应商身份', row => { row.supplier_id = 9 }], ['门店身份', row => { row.store_id = 9 }],
  ['缺名称', row => { delete row.name }], ['空供应商名称', row => { row.supplier_name = '' }],
  ['字段类型', row => { row.unit = [] }], ['缺可空字段', row => { delete row.color_name }]
]) test(`采购快照${label}损坏拒绝读取，不静默回退为当前档案`, () => {
  const snapshot = createPurchaseSnapshot(source(), identity); mutate(snapshot)
  assert.throws(() => projectPurchaseSnapshot({ ...identity, product_snapshot: snapshot }), { code: 'PURCHASE_SNAPSHOT_CONFLICT' })
})

test('非法JSON、JSON空值/数组及错误字符串快照均拒绝', () => {
  for (const value of ['{', 'null', '[]', '"旧档案"', 1, true]) {
    assert.throws(() => projectPurchaseSnapshot({ ...identity, product_snapshot: value }), { code: 'PURCHASE_SNAPSHOT_CONFLICT' })
  }
})

test('采购列表服务先投影原资料再脱敏，内部原始JSON不透传，即使读取全字段也不能绕过隐藏字段', async () => {
  const record = { id: 31, ...identity, product_snapshot: createPurchaseSnapshot(source(), identity) }
  const service = new Service({ repository: { async list() { return { rows: [record], summary: { total: 1 }, pagination: { total: 1 } } } } })
  const controller = new Controller({ service })
  controller.fields.masking = { async getUserFieldPermissions() { return { hiddenFields: ['payment.supplier_name', 'payment.brand_name'] } }, filterSensitiveFields: value => value }
  const response = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  await controller.list({ user: actor, query: {} }, response)
  assert.equal(response.body.data[0].name, '原充电器')
  assert.equal(response.body.data[0].supplier_name, null)
  assert.equal(response.body.data[0].brand_name, null)
  assert.equal(response.body.data[0].has_snapshot, true)
  assert.equal('product_snapshot' in response.body.data[0], false)
})

test('原资料读取绑定最终商品、本次供应商及原门店；采购名称检索沿用快照并参数绑定', async () => {
  const queries = [], repo = new Repository()
  const db = { async query(sql, params) { queries.push({ sql, params }); return [[source()]] } }
  assert.deepEqual(await repo.purchaseSnapshotSource(5, 8, 1, db), source())
  assert.deepEqual(queries[0].params, [8, 1, 5])
  assert.match(queries[0].sql, /LOCK IN SHARE MODE\s*$/)
  assert.match(queries[0].sql, /b.id = a.brand_id/)
  assert.doesNotMatch(queries[0].sql, /s.id = a.supplier_id/)
  const filter = new PurchaseRepository().conditions({ allStores: true, storeIds: [] }, { keyword: '旧名', supplier_name: '旧供应商', store_name: '旧门店' })
  assert.match(filter.where, /product_snapshot/)
  assert.deepEqual(filter.params, ['%旧供应商%', '%旧门店%', '%旧名%', '%旧名%'])
  assert.doesNotMatch(filter.where, /旧供应商|旧门店|旧名/)
  assert.match(purchaseSnapshotText('supplier_name', 'supplier.name'), /WHEN si.product_snapshot IS NULL THEN supplier.name/)
  assert.throws(() => purchaseSnapshotText('request_hash', 'p.hash'))
  assert.throws(() => purchaseSnapshotText('name', 'a.name', 'untrusted'))
})

test('新采购须防重与JSON快照结构同时就绪，缺字段或错误类型不能降级入库', async () => {
  const repository = new Repository()
  repository.stockInRequestsReady = async () => false
  let reads = 0, rows = []
  const db = { async query() { reads++; return [rows] } }
  assert.equal(await repository.stockInReady(db), false)
  assert.equal(reads, 0)
  repository.stockInRequestsReady = async () => true
  for (const fields of [[], [{ COLUMN_TYPE: 'text', IS_NULLABLE: 'YES' }], [{ COLUMN_TYPE: 'json', IS_NULLABLE: 'NO' }]]) {
    rows = fields; assert.equal(await repository.stockInReady(db), false)
  }
  rows = [{ COLUMN_TYPE: 'json', IS_NULLABLE: 'YES' }]
  assert.equal(await repository.stockInReady(db), true)
})

test('入库历史沿用认证用户整单门店范围并投影原资料；未认证、越店及非法分页不查询仓储', async () => {
  const calls = [], service = new AccessoryService({ repository: { async getStockInRecords(input) {
    calls.push(input)
    return { data: [{ id: 31, ...identity, product_snapshot: createPurchaseSnapshot(source(), identity) }], pagination: { total: 1 } }
  } } })
  for (const [input, user, status] of [[{}, {}, 401], [{ store_id: 99 }, actor, 403], [{ page_size: 101 }, actor, 400], [{ store_id: [1] }, actor, 400]]) {
    assert.equal((await service.getStockInRecords(input, user)).statusCode, status)
  }
  assert.equal(calls.length, 0)
  const result = await service.getStockInRecords({}, actor)
  assert.deepEqual(calls[0].store_scope.storeIds, [1])
  assert.equal(result.data.data[0].accessory_name, '原充电器')
  assert.equal(result.data.data[0].supplier_name, '原供应商')
  assert.equal('product_snapshot' in result.data.data[0], false)
  assert.equal('name' in result.data.data[0], false)
})

test('入库记录总数与分页均限定原入库及全部分配店，无绑定门店保持空范围', async () => {
  const queries = [], repository = new Repository()
  repository.executeQuery = async (sql, params) => { queries.push({ sql, params }); return sql.includes('COUNT(*)') ? [{ total: 0 }] : [] }
  await repository.getStockInRecords({ store_scope: { allStores: false, storeIds: [1, 2] }, page: 1, page_size: 20 })
  for (const query of queries) {
    assert.match(query.sql, /asi.store_id IN/)
    assert.match(query.sql, /JSON_LENGTH\(asi.distribution\)/)
    assert.deepEqual(query.params.slice(0, 4), [1, 2, 1, 2])
  }
  queries.length = 0
  await repository.getStockInRecords({ store_scope: { allStores: false, storeIds: [] } })
  for (const query of queries) assert.match(query.sql, /1 = 0/)
})

function migrationFixture() {
  const state = { engine: 'InnoDB', fields: [{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'total_amount' }], occupied: false, changed: false, failAlter: false }
  const original = { id: 31, total_amount: '30.75' }, writes = []
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [[{ ENGINE: state.engine }]]
    if (sql.includes('information_schema.COLUMNS')) return [state.fields]
    if (sql.includes('information_schema.STATISTICS')) return [[]]
    if (sql.startsWith('SHOW CREATE')) return [[{ 'Create Table': 'original-schema' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: state.occupied ? 1 : 0 }]]
    if (sql.startsWith('SELECT')) return [[{ ...original, ...(state.changed && writes.length ? { total_amount: '99.00' } : {}) }]]
    assert.match(sql, /^ALTER TABLE accessory_stock_in /)
    writes.push(sql)
    if (state.failAlter) throw new Error('alter-failed')
    if (sql.includes('ADD COLUMN')) state.fields.push({ COLUMN_NAME: 'product_snapshot', COLUMN_TYPE: 'json', IS_NULLABLE: 'YES' })
    if (sql.includes('DROP COLUMN')) state.fields = state.fields.filter(row => row.COLUMN_NAME !== 'product_snapshot')
    return [{}]
  } }
  return { state, original, writes, db }
}

test('快照迁移默认预览且不回填旧单，备份完整原数据后才加可空JSON，重复运行不写入', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-purchase-snapshot-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const f = migrationFixture(), backupFile = path.join(directory, 'before.json')
  assert.equal((await migrate(f.db)).status, 'dry_run')
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.deepEqual(f.writes, [])
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  assert.deepEqual(JSON.parse(await fs.readFile(backupFile, 'utf8')).rows, [f.original])
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  assert.equal(f.writes.length, 1)
  f.state.occupied = true
  await assert.rejects(migrate(f.db, { rollback: true }), /已有采购资料快照/)
  f.state.occupied = false
  assert.equal((await migrate(f.db, { rollback: true, apply: true, backupFile: path.join(directory, 'rollback.json') })).originalDataUnchanged, true)
  assert.equal(f.state.fields.some(row => row.COLUMN_NAME === 'product_snapshot'), false)
})

test('迁移拒绝非事务表或冲突字段；DDL失败和旧数据变化保留原备份供核对', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-purchase-snapshot-fail-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  for (const type of ['engine', 'column', 'alter', 'changed']) {
    const f = migrationFixture(), backupFile = path.join(directory, `${type}.json`)
    if (type === 'engine') f.state.engine = 'MyISAM'
    if (type === 'column') f.state.fields.push({ COLUMN_NAME: 'product_snapshot', COLUMN_TYPE: 'text', IS_NULLABLE: 'YES' })
    if (type === 'alter') f.state.failAlter = true
    if (type === 'changed') f.state.changed = true
    await assert.rejects(migrate(f.db, { apply: true, backupFile }), /拒绝迁移|结构冲突|alter-failed|原采购数据变化/)
    if (['alter', 'changed'].includes(type)) assert.deepEqual(JSON.parse(await fs.readFile(backupFile, 'utf8')).rows, [f.original])
    else assert.deepEqual(f.writes, [])
  }
})
