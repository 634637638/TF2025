'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const database = require('../src/config/database')
const SettingsService = require('../src/services/settings.service')
const dataBackupService = require('../src/services/data-backup.service')
const ShopService = require('../src/services/shop.service')

function connectionFixture({ failBegin = false, failWrite = false } = {}) {
  const events = []
  const connection = {
    async beginTransaction() {
      events.push('begin')
      if (failBegin) throw new Error('begin failed')
    },
    async execute(sql, values) {
      events.push(['execute', sql, values])
      if (failWrite) throw new Error('write failed')
      return [{ affectedRows: 1, insertId: 17 }]
    },
    async query(sql, values) { return this.execute(sql, values) },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const pool = { async getConnection() { events.push('acquire'); return connection } }
  return { events, connection, pool }
}

for (const failure of [null, 'begin', 'write']) {
  test(`批量设置${failure || '成功'}路径释放一次连接并保留业务响应`, async () => {
    const fixture = connectionFixture({ failBegin: failure === 'begin', failWrite: failure === 'write' })
    const service = new SettingsService()
    service.db = fixture.pool
    const result = await service.setMultipleSettings({ example: 3 })
    assert.equal(result.success, failure === null)
    const lifecycle = fixture.events.filter(event => typeof event === 'string')
    assert.deepEqual(lifecycle, failure === 'begin'
      ? ['acquire', 'begin', 'release']
      : failure === 'write'
        ? ['acquire', 'begin', 'rollback', 'release']
        : ['acquire', 'begin', 'commit', 'release'])
    if (!failure) {
      assert.deepEqual(result.data, { example: 3 })
      assert.deepEqual(fixture.events.find(Array.isArray).at(-1), ['example', '3', 'number'])
    }
  })
}

test('备份查询为空的提前返回仍释放一次连接', async t => {
  const fixture = connectionFixture()
  fixture.connection.execute = async () => [[]]
  const service = dataBackupService
  t.mock.method(service, 'initBackupTable', async () => {})
  t.mock.method(service, 'getPool', () => fixture.pool)
  const result = await service.backupData('brands', 'delete', [17], 7)
  assert.equal(result.success, true)
  assert.equal(result.count, undefined)
  assert.deepEqual(fixture.events, ['acquire', 'release'])
})

test('商城模板删除先提交并释放，随后才删除关联媒体', async t => {
  const fixture = connectionFixture()
  fixture.connection.query = async sql => {
    if (sql.includes('FROM h5_newimages')) return [[{ image_url: '/uploads/shop/a.jpg' }]]
    if (sql.includes('FROM h5_template_media_drafts')) return [[]]
    return [{ affectedRows: 1 }]
  }
  t.mock.method(database, 'getDatabase', () => fixture.pool)
  const service = new ShopService()
  service.deletePhysicalFile = async url => {
    assert.equal(fixture.events.at(-1), 'release')
    fixture.events.push(['delete-file', url])
  }
  await service.deleteTemplate(17)
  assert.deepEqual(fixture.events.filter(event => typeof event === 'string'), ['acquire', 'begin', 'commit', 'release'])
  assert.deepEqual(fixture.events.at(-1), ['delete-file', '/uploads/shop/a.jpg'])
})

test('待办创建提交释放后才读取详情，读取失败不回滚已提交事务', async t => {
  const fixture = connectionFixture()
  t.mock.method(database, 'getDatabase', () => fixture.pool)
  const modulePath = require.resolve('../src/services/reminder.service')
  const cached = require.cache[modulePath]
  delete require.cache[modulePath]
  t.after(() => {
    if (cached) require.cache[modulePath] = cached
    else delete require.cache[modulePath]
  })
  const service = require(modulePath)
  t.mock.method(service, 'ensure', async () => {})
  t.mock.method(service, 'normalizePayload', () => ({ repeat_rule: {}, target_mode: 'all' }))
  t.mock.method(service, 'validateTargets', async () => [])
  t.mock.method(service, 'materialize', async () => {})
  t.mock.method(service, 'getById', async id => {
    assert.equal(id, 17)
    assert.equal(fixture.events.at(-1), 'release')
    throw new Error('detail unavailable')
  })
  await assert.rejects(service.create(7, {}), /detail unavailable/)
  assert.deepEqual(fixture.events.filter(event => typeof event === 'string'), ['acquire', 'begin', 'commit', 'release'])
})
