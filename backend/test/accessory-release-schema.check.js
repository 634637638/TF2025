'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { checkAccessoryReleaseSchema, migrations } = require('../scripts/check-accessory-release-schema')

function fixture(results = {}) {
  const events = []
  const connection = {
    async query(sql) { events.push(sql); return [[]] },
    async execute(sql) { events.push(sql); return [[]] },
    async rollback() { events.push('rollback') }
  }
  const loadMigration = name => async (db, options) => {
    events.push(name)
    assert.deepEqual(options, { apply: false, rollback: false })
    assert.equal(db.commit, undefined); assert.equal(db.beginTransaction, undefined)
    await db.query('SELECT TABLE_NAME FROM information_schema.TABLES')
    const result = results[name]
    if (typeof result === 'function') return result(db)
    return result || { status: 'already_ready', writes: false }
  }
  return { connection, loadMigration, events }
}

test('全部登记结构匹配才报告schema_ready，原库只读事务始终回滚', async () => {
  const f = fixture(), result = await checkAccessoryReleaseSchema(f.connection, f)
  assert.equal(result.status, 'schema_ready'); assert.equal(result.writes, false)
  assert.deepEqual(result.counts, { ready: migrations.length, pending: 0, blocked: 0, error: 0 })
  assert.deepEqual(result.results.map(row => row.name), migrations.map(row => row.name))
  assert.deepEqual(f.events.slice(0, 2), ['SET TRANSACTION ISOLATION LEVEL REPEATABLE READ', 'START TRANSACTION READ ONLY'])
  assert.equal(f.events.at(-1), 'rollback')
})

test('字符串DDL按一条计数；来源账待迁移时售后账标记blocked并继续检查其他功能', async () => {
  const f = fixture({
    'accessory-stock-in-requests': { status: 'dry_run', writes: false, sql: 'ALTER TABLE accessory_stock_in ADD COLUMN request_key CHAR(32)' },
    'customer-points-ledger': { status: 'dry_run', writes: false, sql: ['CREATE TABLE entries (id INT)', 'CREATE TABLE allocations (id INT)'] }
  })
  const result = await checkAccessoryReleaseSchema(f.connection, f)
  assert.equal(result.status, 'schema_not_ready')
  assert.deepEqual(result.counts, { ready: migrations.length - 5, pending: 2, blocked: 3, error: 0 })
  assert.equal(result.results.find(row => row.name === 'accessory-stock-in-requests').statements, 1)
  assert.deepEqual(result.results.find(row => row.name === 'customer-points-aftersales').dependencies, ['customer-points-ledger'])
  assert.equal(f.events.includes('customer-points-aftersales'), false)
  assert.ok(f.events.includes('film-services'))
})

test('共同结算异常不能使依赖售后及贴膜虚假就绪，原错误和凭据不进入报告', async () => {
  const secret = 'private-database-fixture'
  const f = fixture({ 'sales-checkout': () => { throw new Error(secret) } })
  const result = await checkAccessoryReleaseSchema(f.connection, f)
  assert.deepEqual(result.counts, { ready: migrations.length - 6, pending: 0, blocked: 5, error: 1 })
  assert.equal(result.results.find(row => row.name === 'sales-aftersales').status, 'blocked')
  assert.equal(result.results.find(row => row.name === 'film-services').status, 'blocked')
  assert.equal(result.results.find(row => row.name === 'film-cancellations').status, 'blocked')
  assert.equal(result.results.find(row => row.name === 'film-order-phone-index').status, 'blocked')
  assert.equal(JSON.stringify(result).includes(secret), false)
  assert.equal(f.events.at(-1), 'rollback')
})

test('贴膜或售后原表缺失时不预览撤销表，缺撤销表不能报告整批结构就绪', async () => {
  for (const name of ['film-services', 'sales-aftersales', 'film-cancellations']) {
    const f = fixture({ [name]: { status: 'dry_run', writes: false, sql: ['CREATE TABLE pending (id INT)'] } })
    const result = await checkAccessoryReleaseSchema(f.connection, f)
    const cancellation = result.results.find(row => row.name === 'film-cancellations')
    assert.equal(result.status, 'schema_not_ready')
    assert.equal(cancellation.status, name === 'film-cancellations' ? 'pending' : 'blocked')
    if (name !== 'film-cancellations') {
      assert.deepEqual(cancellation.dependencies, [name])
      assert.equal(f.events.includes('film-cancellations'), false)
    }
  }
})

for (const sql of ['ALTER TABLE customers ADD x INT', 'CREATE TABLE x (id INT)', 'UPDATE customers SET points=0', 'DELETE FROM sales', 'START TRANSACTION', 'SET FOREIGN_KEY_CHECKS=0', { sql: 'SELECT 1' }]) {
  test(`预览不暴露非读取入口：${typeof sql === 'object' ? 'query对象' : sql.split(' ')[0]}`, async () => {
    const f = fixture({ 'accessory-stock-in-requests': async db => { await db.query(sql); return { status: 'already_ready', writes: false } } })
    const result = await checkAccessoryReleaseSchema(f.connection, f)
    assert.equal(result.results[0].status, 'error')
    assert.equal(f.events.includes(sql), false)
    assert.equal(f.events.at(-1), 'rollback')
  })
}

for (const invalid of [{ status: 'already_ready' }, { status: 'migrated_and_verified', writes: true },
  { status: 'already_ready', writes: false, sql: ['ALTER TABLE x ADD y INT'] },
  { status: 'dry_run', writes: false, sql: [] }, { status: 'dry_run', writes: false, sql: [null] }]) {
  test(`拒绝不明确或自相矛盾的预览结果：${JSON.stringify(invalid)}`, async () => {
    const f = fixture({ 'accessory-stock-in-requests': invalid })
    const result = await checkAccessoryReleaseSchema(f.connection, f)
    assert.equal(result.results[0].status, 'error')
    assert.equal(result.status, 'schema_not_ready')
  })
}

test('回滚失败不报告检查成功', async () => {
  const f = fixture()
  f.connection.rollback = async () => { throw new Error('rollback-failed') }
  await assert.rejects(checkAccessoryReleaseSchema(f.connection, f), /rollback-failed/)
})

test('拒绝apply及任意参数，在加载真实环境与数据库连接前退出', () => {
  for (const option of ['--apply', '--rollback', '--help']) {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/check-accessory-release-schema.js'), option],
      { env: { ...process.env, ENV_FILE: 'test/missing-unit-env' }, encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /仅支持无参数只读检查/)
  }
})
