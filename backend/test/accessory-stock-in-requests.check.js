'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Service = require('../src/services/accessory.service')
const Repository = require('../src/repositories/accessory.repository')
const { migrate } = require('../scripts/migrate-accessory-stock-in-requests')
const actor = { id: 7, name: '入库员', store_ids: [1, 2] }
const input = extra => ({ request_key: 'a'.repeat(32), accessory_id: 5, store_id: 1, supplier_id: 8,
  total_quantity: 3, purchase_cost: 10.25, usage_type: 'sale', ...extra })

/** 用独立暂存事务及唯一请求预约模拟竞争；提交前的数据对其他连接不可见。 */
function fixture({ race = false, failReceive = false, loseCommitResponse = false } = {}) {
  const state = { entries: [], quantity: 0, serials: [], events: [] }
  const transactions = [], reservations = new Map()
  let ready = true, reads = 0, nextId = 1, openBarrier
  const barrier = new Promise(resolve => { openBarrier = resolve })
  const repository = {
    async withConnection(callback) {
      let release
      const db = { row: null, quantity: 0, serials: [], events: [], committed: false,
        finished: new Promise(resolve => { release = resolve }),
        async beginTransaction() { transactions.push('begin') },
        async commit() {
          state.entries.push(db.row); state.quantity += db.quantity; state.serials.push(...db.serials); state.events.push(...db.events)
          db.committed = true; reservations.delete(db.row.request_key); release(); transactions.push('commit')
          if (loseCommitResponse) { loseCommitResponse = false; throw Object.assign(new Error('connection lost after commit'), { code: 'ECONNRESET' }) }
        },
        async rollback() {
          if (!db.committed && db.row && reservations.get(db.row.request_key) === db) reservations.delete(db.row.request_key)
          release(); transactions.push('rollback')
        }
      }
      return callback(db)
    },
    async stockInReady() { return ready },
    async purchaseSnapshotSource(accessory_id, supplier_id, store_id) { return { accessory_id, supplier_id, store_id,
      name: '原充电器', category: '充电器', brand_name: null, product_model: 'C65', color_name: null,
      unit: '个', supplier_name: '原供应商', store_name: '原入库门店' } },
    async getStockInByKey(key) {
      if (race && ++reads <= 2) { if (reads === 2) openBarrier(); await barrier }
      return state.entries.find(row => row.request_key === key) || null
    },
    async getReference(id) { return { id, status: 1, business_scope: 'both' } },
    async getAccessoryById(id) { return { id, name: '充电器', status: 1, brand_id: null, sale_price: 20 } },
    async lockAccessory(id) { return this.getAccessoryById(id) },
    async lockStoreStock() { return { quantity: state.quantity } },
    async createStockInRecord(row, db) {
      const occupied = reservations.get(row.request_key)
      if (occupied) await occupied.finished
      if (state.entries.some(entry => entry.request_key === row.request_key)) throw Object.assign(new Error('unique request'), { code: 'ER_DUP_ENTRY' })
      db.row = { ...row, id: nextId++ }; reservations.set(row.request_key, db)
      return db.row.id
    },
    async updateAccessoryStock(id, store, quantity, operation, warning, db) { db.quantity += quantity },
    async createSerial(serial, db) {
      if (state.serials.some(row => row.serial_number === serial.serial_number)) throw Object.assign(new Error('duplicate SN'), { code: 'ER_DUP_ENTRY' })
      db.serials.push(serial); return db.serials.length
    },
    async createSerialEvent(event, db) { db.events.push(event) }
  }
  const inventoryService = { async ensureBalance() {}, async receive(context, quantity, db) {
    db.events.push({ ...context, quantity }); if (failReceive) { failReceive = false; throw new Error('ledger failed') }
  } }
  return { state, transactions, repository, service: new Service({ repository, inventoryService }), notReady() { ready = false } }
}

test('普通采购提交后重试返回原回执；不读取当前模板/库存，也不重复整批应付', async () => {
  const f = fixture(), request = input(), beforeInput = structuredClone(request)
  const first = await f.service.stockIn(request, actor)
  assert.equal(first.success, true)
  assert.equal(first.data.quantity, 3)
  assert.equal(first.data.total_amount, 30.75)
  assert.equal(first.data.replayed, false)
  // MySQL JSON可重排对象键；同义数字及JSON键顺序不应使原采购失去重放能力。
  f.state.entries[0].distribution = JSON.stringify([{ quantity: 3, store_id: 1 }])
  const before = structuredClone(f.state)
  f.repository.getAccessoryById = async () => { throw new Error('重试不得读取后来模板') }
  const second = await f.service.stockIn(request, actor)
  assert.deepEqual(second.data, { ...first.data, replayed: true })
  assert.deepEqual(f.state, before)
  assert.deepEqual(request, beforeInput)
  assert.deepEqual(f.transactions, ['begin', 'commit'])
  assert.equal('request_hash' in second.data, false)
})

test('采购资料取服务端最终实际商品/本次供应商及原门店，客户端快照不能覆盖；重试不读取改名后的资料', async () => {
  const f = fixture(), original = f.repository.purchaseSnapshotSource
  const lock = f.repository.lockAccessory, create = f.repository.createStockInRecord
  let transaction
  f.repository.lockAccessory = async (id, db) => { transaction = db; return lock.call(f.repository, id, db) }
  f.repository.purchaseSnapshotSource = async (...args) => {
    assert.deepEqual(args.slice(0, 3), [5, 8, 1])
    assert.ok(f.transactions.includes('begin'))
    assert.equal(args[3], transaction)
    return original(...args)
  }
  f.repository.createStockInRecord = async (row, db) => { assert.equal(db, transaction); return create.call(f.repository, row, db) }
  const request = input({ product_snapshot: { name: '客户端伪造资料' } })
  const first = await f.service.stockIn(request, actor)
  assert.equal(first.success, true)
  assert.equal(f.state.entries[0].product_snapshot.name, '原充电器')
  assert.equal(f.state.entries[0].product_snapshot.supplier_name, '原供应商')
  assert.equal('product_snapshot' in first.data, false)
  const before = structuredClone(f.state)
  f.repository.purchaseSnapshotSource = async () => { throw new Error('重试不能重读资料') }
  assert.equal((await f.service.stockIn(request, actor)).data.replayed, true)
  assert.deepEqual(f.state, before)
})

test('采购原资料缺失/身份不符/读取失败时整单回滚，不保存无快照新单', async () => {
  for (const broken of [null, { name: '缺字段' }, 'read-failed']) {
    const f = fixture()
    f.repository.purchaseSnapshotSource = async () => { if (broken === 'read-failed') throw new Error('资料读取失败'); return broken }
    assert.equal((await f.service.stockIn(input(), actor)).success, false)
    assert.deepEqual(f.state.entries, [])
    assert.equal(f.state.quantity, 0)
    assert.deepEqual(f.transactions, ['begin', 'rollback'])
  }
})

test('同请求并发普通入库：唯一键冲突后整单回滚，再读已提交原采购', async () => {
  const f = fixture({ race: true })
  const results = await Promise.all([f.service.stockIn(input(), actor), f.service.stockIn(input(), actor)])
  assert.equal(results.every(row => row.success), true)
  assert.deepEqual(results.map(row => row.data.replayed).sort(), [false, true])
  assert.equal(f.state.entries.length, 1)
  assert.equal(f.state.quantity, 3)
  assert.equal(f.state.events.length, 1)
  assert.equal(f.transactions.filter(value => value === 'rollback').length, 1)
})

test('不同模板并发复用同键：只有一笔采购，另一笔冲突且库存流水全部回滚', async () => {
  const f = fixture({ race: true })
  const results = await Promise.all([f.service.stockIn(input(), actor), f.service.stockIn(input({ accessory_id: 6 }), actor)])
  assert.equal(results.filter(row => row.success).length, 1)
  assert.equal(results.find(row => !row.success).code, 'STOCK_IN_REQUEST_CONFLICT')
  assert.equal(f.state.entries.length, 1)
  assert.equal(f.state.quantity, 3)
  assert.equal(f.state.events.length, 1)
})

test('提交成功后响应断开，浏览器重试仍复用原采购；提交前流水失败可用原请求重新入库', async () => {
  const committed = fixture({ loseCommitResponse: true })
  assert.equal((await committed.service.stockIn(input(), actor)).success, false)
  assert.equal(committed.state.entries.length, 1)
  assert.equal((await committed.service.stockIn(input(), actor)).data.replayed, true)
  assert.equal(committed.state.quantity, 3)
  const rolledBack = fixture({ failReceive: true })
  assert.equal((await rolledBack.service.stockIn(input(), actor)).success, false)
  assert.deepEqual(rolledBack.state, { entries: [], quantity: 0, serials: [], events: [] })
  assert.equal((await rolledBack.service.stockIn(input(), actor)).data.replayed, false)
  assert.equal(rolledBack.state.quantity, 3)
})

test('SN采购重试只记录一次实物及入库事件；另一笔新采购的重复SN仍拒绝', async () => {
  const f = fixture(), request = input({ serial_tracking: 1, total_quantity: 99,
    serial_numbers: [{ serial_number: '00aa', store_id: 1 }, { serial_number: '00bb', store_id: 1 }] })
  assert.equal((await f.service.stockIn(request, actor)).data.quantity, 2)
  const before = structuredClone(f.state)
  assert.equal((await f.service.stockIn({ ...request, total_quantity: 1 }, actor)).data.replayed, true)
  assert.deepEqual(f.state, before)
  assert.equal((await f.service.stockIn({ ...request, request_key: 'b'.repeat(32) }, actor)).code, 'DUPLICATE_SERIAL')
  assert.deepEqual(f.state, before)
})

for (const change of [{ total_quantity: 4 }, { purchase_cost: 11 }, { supplier_id: 9 }, { brand_id: 2 },
  { store_id: 2 }, { usage_type: 'gift' }, { product_model: 'other' }, { remarks: '改了备注' }, { brand_id: null }]) {
  test(`原请求不能改采购内容：${JSON.stringify(change)}`, async () => {
    const f = fixture(); await f.service.stockIn(input(), actor)
    const before = structuredClone(f.state)
    assert.equal((await f.service.stockIn(input(change), actor)).code, 'STOCK_IN_REQUEST_CONFLICT')
    assert.deepEqual(f.state, before)
  })
}

test('请求绑定实际入库员与全部原分配店，撤权不重放；原数量/成本凭据损坏拒绝', async () => {
  const f = fixture(), request = input({ distribution: [{ store_id: 2, quantity: 1 }] })
  await f.service.stockIn(request, actor)
  assert.equal((await f.service.stockIn(request, { ...actor, id: 9 })).code, 'STOCK_IN_REQUEST_CONFLICT')
  assert.equal((await f.service.stockIn(request, { ...actor, store_ids: [1] })).code, 'STORE_SCOPE_DENIED')
  f.state.entries[0].quantity = 9
  assert.equal((await f.service.stockIn(request, actor)).code, 'STOCK_IN_REQUEST_CONFLICT')
  assert.equal(f.state.entries.length, 1)
})

test('零成本采购有稳定零金额回执；缺迁移结构必须拒绝且无任何事务写入', async () => {
  const f = fixture(), request = input({ purchase_cost: 0 })
  assert.equal((await f.service.stockIn(request, actor)).data.total_amount, 0)
  assert.equal((await f.service.stockIn(request, actor)).data.replayed, true)
  f.notReady()
  const before = structuredClone(f.state)
  assert.equal((await f.service.stockIn(input({ request_key: 'b'.repeat(32) }), actor)).code, 'STOCK_IN_NOT_READY')
  assert.deepEqual(f.state, before)
  assert.deepEqual(f.transactions, ['begin', 'commit'])
})

for (const change of [{ request_key: undefined }, { request_key: true }, { request_key: 'A'.repeat(32) },
  { total_quantity: [3] }, { total_quantity: true }, { total_quantity: '3junk' },
  { purchase_cost: [10] }, { purchase_cost: false }, { purchase_cost: '1e1' },
  { store_id: [1] }, { supplier_id: [8] }, { brand_id: true },
  { distribution: {} }, { distribution: [{ store_id: [1], quantity: 1 }] }, { distribution: [{ store_id: 1, quantity: true }] }]) {
  test(`入库验证原始类型，不先Number转换：${JSON.stringify(change)}`, async () => {
    const f = fixture()
    assert.equal((await f.service.stockIn(input(change), actor)).success, false)
    assert.equal(f.state.entries.length, 0)
  })
}

function migrationFixture() {
  const state = { engine: 'InnoDB', fields: [{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'total_amount' }], indexes: [], occupied: false, changed: false }
  const writes = [], original = { id: 31, total_amount: '30.75' }
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [[{ ENGINE: state.engine }]]
    if (sql.includes('information_schema.COLUMNS')) return [state.fields]
    if (sql.includes('information_schema.STATISTICS')) return [state.indexes]
    if (sql.startsWith('SHOW CREATE')) return [[{ 'Create Table': 'original' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: state.occupied ? 1 : 0 }]]
    if (sql.startsWith('SELECT')) return [[{ ...original, ...(state.changed && writes.length ? { total_amount: '99.00' } : {}) }]]
    writes.push(sql)
    for (const [name, length] of [['request_key', 32], ['request_hash', 64]]) {
      if (sql.includes(`ADD COLUMN ${name}`)) state.fields.push({ COLUMN_NAME: name, COLUMN_TYPE: `char(${length})`, IS_NULLABLE: 'YES', COLLATION_NAME: 'ascii_bin' })
      if (sql.includes(`DROP COLUMN ${name}`)) state.fields = state.fields.filter(row => row.COLUMN_NAME !== name)
    }
    if (sql.includes('ADD UNIQUE')) state.indexes = [{ INDEX_NAME: 'uq_accessory_stock_in_request', COLUMN_NAME: 'request_key', NON_UNIQUE: 0, SEQ_IN_INDEX: 1, SUB_PART: null }]
    if (sql.includes('DROP INDEX')) state.indexes = []
    return [{}]
  } }
  return { db, state, writes, original }
}

test('防重迁移默认预览、备份前零写入；原采购不回填，可重复且空凭据才允许回滚', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-stock-in-request-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const f = migrationFixture(), backupFile = path.join(dir, 'before.json')
  assert.equal((await migrate(f.db)).status, 'dry_run')
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.deepEqual(f.writes, [])
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  assert.deepEqual(JSON.parse(await fs.readFile(backupFile, 'utf8')).rows, [f.original])
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  assert.equal(await new Repository().stockInRequestsReady(f.db), true)
  f.state.occupied = true
  await assert.rejects(migrate(f.db, { rollback: true }), /已有入库请求凭据/)
  f.state.occupied = false
  assert.equal((await migrate(f.db, { apply: true, rollback: true, backupFile: path.join(dir, 'rollback.json') })).writes, true)
  assert.equal(await new Repository().stockInRequestsReady(f.db), false)
})

for (const defect of ['engine', 'type', 'nullable', 'collation', 'index', 'prefix']) test(`迁移及运行时拒绝不完整/冲突结构：${defect}`, async () => {
  const f = migrationFixture()
  await f.db.query('ALTER TABLE accessory_stock_in ADD COLUMN request_key, ADD COLUMN request_hash, ADD UNIQUE KEY test')
  if (defect === 'engine') f.state.engine = 'MyISAM'
  if (defect === 'type') f.state.fields[2].COLUMN_TYPE = 'varchar(32)'
  if (defect === 'nullable') f.state.fields[2].IS_NULLABLE = 'NO'
  if (defect === 'collation') f.state.fields[2].COLLATION_NAME = 'ascii_general_ci'
  if (defect === 'index') f.state.indexes[0].NON_UNIQUE = 1
  if (defect === 'prefix') f.state.indexes[0].SUB_PART = 8
  await assert.rejects(migrate(f.db), /冲突|非InnoDB/)
  assert.equal(await new Repository().stockInRequestsReady(f.db), false)
})

test('仓储入库请求键/摘要与原采购同条参数化INSERT，不在响应读取中透出凭据', async () => {
  let captured
  const db = { async query(sql, values) { captured = { sql, values }; return [{ insertId: 31 }] } }
  const row = { product_snapshot: { version: 1, name: '原采购商品' }, request_key: 'a'.repeat(32), request_hash: 'b'.repeat(64), batch_no: 'IN-31', accessory_id: 5,
    supplier_id: 8, store_id: 1, quantity: 3, purchase_cost: 10.25, total_amount: 30.75, operator_id: 7, operator_name: '入库员', inventory_time: '2026-11-14 10:00:00' }
  assert.equal(await new Repository().createStockInRecord(row, db), 31)
  assert.match(captured.sql, /status, request_key, request_hash/)
  assert.equal(captured.sql.includes(row.request_key), false)
  assert.deepEqual(captured.values.slice(-3, -1), [row.request_key, row.request_hash])
  assert.deepEqual(JSON.parse(captured.values.at(-1)), row.product_snapshot)
  assert.equal((captured.sql.match(/\?/g) || []).length, captured.values.length)
})
