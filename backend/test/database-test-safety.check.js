const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { configureDatabaseTestEnvironment, assertDatabaseTestTarget } = require('./helpers/database-test-env')
const { withRollbackConnection, runConcurrentRollbackTasks } = require('./helpers/rollback-connection')
const {
  assertFixtureSchema, createDatabaseFixtures, deleteDatabaseFixtures,
  loadLiveDatabaseSamples, exerciseLiveInventoryRollback, verifyLiveDatabaseCleanup
} = require('./helpers/database-fixtures')

const envDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tf2025-db-safety-'))
const emptyEnvFile = path.join(envDirectory, '.env.test')
fs.writeFileSync(emptyEnvFile, '')
test.after(() => fs.rmSync(envDirectory, { recursive: true, force: true }))

const testEnv = () => ({
  RUN_DB_TESTS: 'true', TEST_DB_HOST: 'database.invalid', TEST_DB_USER: 'fixture_user',
  TEST_DB_PASSWORD: 'fixture-only-placeholder', TEST_DB_NAME: 'tf2025_test', TEST_DB_ENV_FILE: emptyEnvFile
})

test('数据库测试默认关闭，不修改普通运行环境', () => {
  const env = { DB_NAME: 'business' }
  assert.equal(configureDatabaseTestEnvironment(env), false)
  assert.deepEqual(env, { DB_NAME: 'business' })
})

test('数据库测试不能从普通业务 DB_* 配置回退', () => {
  const env = { RUN_DB_TESTS: 'true', TEST_DB_ENV_FILE: emptyEnvFile, DB_HOST: 'business.invalid', DB_USER: 'business', DB_PASSWORD: 'hidden', DB_NAME: 'business' }
  assert.throws(() => configureDatabaseTestEnvironment(env), /TEST_DB_.*禁止回退业务库/)
  assert.equal(env.DB_NAME, 'business')
})

test('独立数据库配置覆盖目标，固定测试模式和专用环境文件路径', () => {
  const env = { ...testEnv(), DB_NAME: 'business', ENV_FILE: '.env.production' }
  assert.equal(configureDatabaseTestEnvironment(env), true)
  assert.equal(env.DB_NAME, 'tf2025_test')
  assert.equal(env.DB_HOST, 'database.invalid')
  assert.equal(env.DB_PORT, '3306')
  assert.equal(env.NODE_ENV, 'test')
  assert.equal(env.ENV_FILE, emptyEnvFile)
})

test('生产模式、业务库名称、非法端口和丢失的显式环境文件均被拒绝', () => {
  assert.throws(() => configureDatabaseTestEnvironment({ ...testEnv(), NODE_ENV: 'production' }), /production/)
  for (const name of ['tf2025', 'tf2025_test_prod', 'tf2025_test;DROP DATABASE x', '../tf2025_test']) {
    assert.throws(() => configureDatabaseTestEnvironment({ ...testEnv(), TEST_DB_NAME: name }), /独立测试库/)
  }
  for (const port of ['0', '65536', '3306junk']) {
    assert.throws(() => configureDatabaseTestEnvironment({ ...testEnv(), TEST_DB_PORT: port }), /PORT/)
  }
  assert.throws(() => configureDatabaseTestEnvironment({ ...testEnv(), TEST_DB_ENV_FILE: path.join(__dirname, 'missing-test-environment') }), /文件不存在/)
})

test('测试文件支持专用配置，显式环境变量优先，临时文件最终删除', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tf2025-db-env-'))
  try {
    const file = path.join(directory, '.env.test')
    fs.writeFileSync(file, 'TEST_DB_HOST=database.invalid\nTEST_DB_USER=fixture_user\nTEST_DB_PASSWORD=fixture-only-placeholder\nTEST_DB_NAME=from_file_test\nDB_NAME=business\n')
    const env = { RUN_DB_TESTS: 'true', TEST_DB_ENV_FILE: file, TEST_DB_NAME: 'override_test' }
    configureDatabaseTestEnvironment(env)
    assert.equal(env.DB_NAME, 'override_test')
    assert.equal(env.DB_HOST, 'database.invalid')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
  assert.equal(fs.existsSync(directory), false)
})

test('实际 DATABASE() 与声明目标不一致时失败', async () => {
  const pool = { query: async () => [[{ database_name: 'business' }]] }
  await assert.rejects(assertDatabaseTestTarget(pool, 'tf2025_test', {}), /停止数据库测试/)
  await assert.rejects(assertDatabaseTestTarget(pool, 'business', {}), /停止数据库测试/)
  await assert.doesNotReject(assertDatabaseTestTarget({ query: async () => [[{ database_name: 'tf2025_test' }]] }, 'tf2025_test', {}))
})

const fakeConnection = (failAt, events = []) => ({
  beginTransaction: async () => { events.push('begin'); if (failAt === 'begin') throw new Error('begin failed') },
  rollback: async () => { events.push('rollback'); if (failAt === 'rollback') throw new Error('rollback failed') },
  release: () => events.push('release'),
  destroy: () => events.push('destroy')
})

test('测试事务正常路径返回结果，同时回滚并释放连接', async () => {
  const events = []
  const connection = fakeConnection(null, events)
  const value = await withRollbackConnection({ getConnection: async () => connection }, async () => { events.push('work'); return 42 })
  assert.equal(value, 42)
  assert.deepEqual(events, ['begin', 'work', 'rollback', 'release'])
})

test('准备、启动和业务断言失败都回滚且只释放一次', async () => {
  for (const failAt of ['prepare', 'begin', 'work']) {
    const events = []
    const connection = fakeConnection(failAt, events)
    await assert.rejects(withRollbackConnection(
      { getConnection: async () => connection },
      async () => { if (failAt === 'work') throw new Error('work failed') },
      async () => { if (failAt === 'prepare') throw new Error('prepare failed') }
    ), new RegExp(`${failAt} failed`))
    assert.deepEqual(events.slice(-2), ['rollback', 'release'])
    assert.equal(events.filter(event => event === 'release').length, 1)
  }
})

test('回滚失败销毁连接，保留原业务错误和清理错误', async () => {
  const events = []
  await assert.rejects(withRollbackConnection(
    { getConnection: async () => fakeConnection('rollback', events) },
    async () => { throw new Error('assertion failed') }
  ), error => {
    assert.ok(error instanceof AggregateError)
    assert.deepEqual(error.errors.map(item => item.message), ['assertion failed', 'rollback failed'])
    return true
  })
  assert.deepEqual(events, ['begin', 'rollback', 'destroy'])
})

test('并发连接部分获取失败时，仍等待其他任务完成回滚和释放', async () => {
  const events = []
  let acquired = 0
  let finishWork
  let started
  const waiting = new Promise(resolve => { finishWork = resolve })
  const workStarted = new Promise(resolve => { started = resolve })
  const pool = { getConnection: async () => {
    if (acquired++ === 0) throw new Error('pool exhausted')
    return fakeConnection(null, events)
  } }
  let completed = false
  const batch = runConcurrentRollbackTasks(pool, 2, async () => { started(); await waiting })
  const checked = assert.rejects(batch, error => {
    completed = true
    assert.ok(error instanceof AggregateError)
    assert.equal(error.errors[0].message, 'pool exhausted')
    assert.deepEqual(events.slice(-2), ['rollback', 'release'])
    return true
  })
  await workStarted
  assert.equal(completed, false)
  finishWork()
  await checked
})

test('数据库样本只用合成标记，清理按主键逆序且不清空整表', async () => {
  const statements = []
  let nextId = 0
  const connection = {
    ...fakeConnection(),
    execute: async (sql, params) => {
      statements.push({ sql, params })
      return [{ insertId: ++nextId, affectedRows: 1 }]
    },
    query: async () => [[{ total: 0 }]],
    commit: async () => { statements.push({ sql: 'COMMIT' }) }
  }
  const pool = { getConnection: async () => connection }
  const fixture = {}
  await createDatabaseFixtures(pool, fixture)
  assert.match(fixture.tag, /^qa_[a-f0-9]{12}$/)
  assert.ok(fixture.phoneId)
  assert.ok(fixture.attendanceId)
  assert.ok(statements.some(({ sql, params }) => sql.startsWith('INSERT INTO users') && params.includes('!disabled-database-fixture')))
  await deleteDatabaseFixtures(pool, fixture)
  const deletes = statements.filter(({ sql }) => sql.startsWith('DELETE'))
  assert.equal(deletes.length, 12)
  assert.match(deletes[0].sql, /attendance_records WHERE id = \?/)
  assert.ok(deletes.every(({ sql }) => / WHERE /.test(sql)))
  assert.equal(statements.filter(({ sql }) => sql === 'COMMIT').length, 2)
})

test('缺少表或使用非事务引擎时，在创建样本前失败', async () => {
  await assert.rejects(assertFixtureSchema({ query: async () => [[]] }), /缺少 brands/)
  await assert.rejects(assertFixtureSchema({ query: async () => [[{ table_name: 'brands', engine: 'MyISAM' }]] }), /InnoDB/)
})

test('样本写入中途失败时回滚且不提交，部分样本仍可按已记录主键清理', async () => {
  const events = []
  let insertCount = 0
  const fixture = {}
  const connection = {
    ...fakeConnection(null, events),
    execute: async () => {
      if (++insertCount === 2) throw new Error('fixture write failed')
      return [{ insertId: insertCount }]
    },
    commit: async () => events.push('commit')
  }
  await assert.rejects(createDatabaseFixtures({ getConnection: async () => connection }, fixture), /fixture write failed/)
  assert.equal(fixture.brandId, 1)
  assert.equal(fixture.modelId, undefined)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
  await deleteDatabaseFixtures({ getConnection: async () => connection }, fixture)
  assert.equal(events.filter(event => event === 'commit').length, 1)
})

test('样本清理 SQL 失败时回滚并向外报告，不能假报清理成功', async () => {
  const events = []
  const connection = {
    ...fakeConnection(null, events),
    execute: async () => { throw new Error('fixture cleanup failed') },
    commit: async () => events.push('commit')
  }
  await assert.rejects(deleteDatabaseFixtures({ getConnection: async () => connection }, { phoneId: 1 }), /fixture cleanup failed/)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

const liveEnv = () => ({
  RUN_DB_TESTS: 'true', DB_TEST_MODE: 'live', DB_TEST_BACKUP_CONFIRMED: 'true',
  DB_TEST_EXPECTED_HOST: 'database.invalid', DB_TEST_EXPECTED_PORT: '3306', DB_TEST_EXPECTED_NAME: 'BUSINESS',
  DB_HOST: 'database.invalid', DB_PORT: '3306', DB_NAME: 'BUSINESS',
  DB_USER: 'fixture_user', DB_PASSWORD: 'fixture-only-placeholder', NODE_ENV: 'production'
})

test('业务库模式必须确认备份及准确主机、端口、库名，且不重写业务配置', () => {
  const env = liveEnv()
  const before = { ...env }
  assert.equal(configureDatabaseTestEnvironment(env), true)
  assert.deepEqual(env, before)
  assert.throws(() => configureDatabaseTestEnvironment({ ...env, DB_TEST_BACKUP_CONFIRMED: 'false' }), /备份/)
  for (const key of ['HOST', 'PORT', 'NAME']) {
    assert.throws(() => configureDatabaseTestEnvironment({ ...env, [`DB_TEST_EXPECTED_${key}`]: '' }), /必须明确指定/)
    assert.throws(() => configureDatabaseTestEnvironment({ ...env, [`DB_TEST_EXPECTED_${key}`]: key === 'PORT' ? '3307' : 'wrong' }), /目标不一致/)
  }
  assert.throws(() => configureDatabaseTestEnvironment({ ...env, DB_TEST_MODE: 'other' }), /未知/)
  assert.throws(() => configureDatabaseTestEnvironment({ ...env, DB_TEST_EXPECTED_PORT: '3306junk' }), /端口无效/)
})

test('目标库名仅按服务器大小写策略匹配，业务库模式仍校验实际数据库', async () => {
  const env = liveEnv()
  const pool = value => ({ query: async () => [[value]] })
  await assert.doesNotReject(assertDatabaseTestTarget(pool({ database_name: 'business', lower_case_table_names: 1 }), 'BUSINESS', env))
  await assert.rejects(assertDatabaseTestTarget(pool({ database_name: 'business', lower_case_table_names: 0 }), 'BUSINESS', env), /目标不一致/)
  await assert.rejects(assertDatabaseTestTarget(pool({ database_name: 'wrong', lower_case_table_names: 1 }), 'BUSINESS', env), /目标不一致/)
  await assert.rejects(assertDatabaseTestTarget(pool({ database_name: 'BUSINESS' }), 'another', env), /授权名称不一致/)
})

const liveSamplePool = ({ triggers = [], sequence = [{ current_sequence: 0 }], missingSample = false } = {}) => ({
  query: async sql => {
    assert.match(sql, /^SELECT/)
    if (sql.includes('information_schema.triggers')) return [triggers]
    if (sql.includes('invoice_sequences')) return [sequence]
    if (sql.includes('COUNT(*)')) return [[{ total: 0 }]]
    return [missingSample ? [] : [{ id: 7 }]]
  }
})

test('业务库样本准备全程只读，不创建用户/角色/门店等已提交样本', async () => {
  const fixture = {}
  await loadLiveDatabaseSamples(liveSamplePool(), fixture)
  assert.equal(fixture.userId, 7)
  assert.equal(fixture.phoneId, 7)
  assert.equal(fixture.sequenceBefore, 0)
  assert.match(fixture.inventoryTag, /^qa_live_[a-f0-9]{16}$/)
  assert.equal(fixture.tag, undefined)
})

test('业务库存在触发器、缺少样本或测试日期序列行时在写入前停止', async () => {
  await assert.rejects(loadLiveDatabaseSamples(liveSamplePool({ triggers: [{ TRIGGER_NAME: 'side_effect' }] }), {}), /触发器/)
  await assert.rejects(loadLiveDatabaseSamples(liveSamplePool({ missingSample: true }), {}), /不能空跑/)
  await assert.rejects(loadLiveDatabaseSamples(liveSamplePool({ sequence: [] }), {}), /不自动补建/)
})

const inventoryPool = (failUpdate = false) => {
  const events = []
  let status = null
  const connection = {
    beginTransaction: async () => events.push('begin'),
    query: async sql => {
      if (sql.startsWith('SET SESSION')) { events.push(sql); return [] }
      return [[{ status }]]
    },
    execute: async (sql, params) => {
      events.push({ sql, params })
      if (sql.startsWith('INSERT')) { status = 'in_stock'; return [{ insertId: 101 }] }
      if (failUpdate) throw new Error('inventory update failed')
      status = 'sold'
      return [{ affectedRows: 1 }]
    },
    rollback: async () => { status = null; events.push('rollback') },
    release: () => events.push('release'),
    destroy: () => events.push('destroy')
  }
  return {
    events,
    getConnection: async () => connection,
    query: async () => [[{ total: status === null ? 0 : 1 }]]
  }
}

test('业务库库存测试只更新事务内新建的设备，正常完成后回滚且残留为零', async () => {
  const pool = inventoryPool()
  const fixture = { inventoryTag: 'qa_live_fixture', phoneId: 7 }
  await exerciseLiveInventoryRollback(pool, fixture)
  assert.equal(fixture.transientPhoneId, 101)
  const update = pool.events.find(event => typeof event === 'object' && event.sql.startsWith('UPDATE'))
  assert.deepEqual(update.params, [101])
  assert.deepEqual(pool.events.slice(-2), ['rollback', 'release'])
  assert.ok(pool.events.includes('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED'))
})

test('业务库库存写入失败仍回滚临时设备，不执行提交', async () => {
  const pool = inventoryPool(true)
  await assert.rejects(exerciseLiveInventoryRollback(pool, { inventoryTag: 'qa_live_fixture' }), /inventory update failed/)
  assert.deepEqual(pool.events.slice(-2), ['rollback', 'release'])
  assert.equal((await pool.query())[0][0].total, 0)
})

test('业务库最终回读验证临时设备、单号序列和测试日期销售记录', async () => {
  const fixture = { inventoryTag: 'qa_live_fixture', sequenceBefore: 0 }
  assert.deepEqual(await verifyLiveDatabaseCleanup(liveSamplePool(), fixture), { temporaryPhones: 0, sequenceUnchanged: true, testDateSales: 0 })
  await assert.rejects(verifyLiveDatabaseCleanup({ query: async () => [[{ total: 1 }]] }, fixture), /临时设备残留/)
  await assert.rejects(verifyLiveDatabaseCleanup(liveSamplePool({ sequence: [{ current_sequence: 2 }] }), fixture), /未恢复原序列值/)
})
