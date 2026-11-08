const { withConnection } = require('../src/core/db/connection')
const test = require('node:test')
const assert = require('node:assert/strict')
const MemoryController = require('../src/controllers/memory.controller')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('内存列表 controller 保留筛选绑定、白名单排序和标准分页响应', async () => {
  const calls = []
  const controller = new MemoryController({
    databaseConnected: () => true,
    repository: {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        if (calls.length === 1) {
          return [[{
            id: 4,
            size: '8+256GB',
            status: 1,
            sort_order: 2,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: null
          }]]
        }
        return [[{ total: 23 }]]
      }
    }
  })
  const response = createResponse()

  await controller.list({
    query: {
      page: '2',
      page_size: '10',
      size: '256',
      storage_unit: 'GB',
      status: '1',
      sort_by: 'unsafe_column',
      sort_order: 'DESC'
    }
  }, response)

  assert.equal(calls.length, 2)
  assert.match(calls[0].sql, /ORDER BY sort_order DESC, size ASC, id ASC LIMIT 10 OFFSET 10$/)
  assert.deepEqual(calls[0].params, ['%GB', 1, '%256%'])
  assert.match(calls[1].sql, /COUNT\(\*\) as total FROM memories WHERE/)
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.data.memories[0], {
    id: 4,
    size: '8+256GB',
    storage_size: 256,
    storage_unit: 'GB',
    is_combo: true,
    status: 1,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null
  })
  assert.deepEqual(response.body.data.pagination, {
    page: 2,
    page_size: 10,
    total: 23,
    total_pages: 3,
    has_next: true,
    has_prev: true
  })
})

test('内存列表 controller 在 all=true 时返回完整数组且数据库离线时拒绝查询', async () => {
  let queryCount = 0
  const controller = new MemoryController({
    databaseConnected: () => true,
    repository: {
      async executePrepared() {
        queryCount += 1
        return queryCount === 1 ? [[{ id: 1, size: '64GB' }]] : [[{ total: 1 }]]
      }
    }
  })
  const allResponse = createResponse()

  await controller.list({ query: { all: 'true' } }, allResponse)
  assert.equal(Array.isArray(allResponse.body.data), true)
  assert.equal(allResponse.body.data[0].storage_size, 64)

  const offlineController = new MemoryController({
    databaseConnected: () => false,
    repository: { async executePrepared() { assert.fail('offline request must not query') } }
  })
  const offlineResponse = createResponse()
  await offlineController.list({ query: {} }, offlineResponse)
  assert.equal(offlineResponse.statusCode, 500)
})

test('内存规格创建校验格式和重复项，成功后返回格式化记录', async () => {
  const calls = []
  const controller = new MemoryController({
    databaseConnected: () => true,
    repository: {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        if (calls.length === 1) return [[]]
        if (calls.length === 2) return [{ insertId: 9 }]
        return [[{ id: 9, size: '128GB', status: 1, sort_order: 0 }]]
      }
    }
  })
  const invalid = createResponse()
  await controller.create({ body: { size: '128GB!' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(calls.length, 0)

  const success = createResponse()
  await controller.create({ body: { size: ' 128GB ' } }, success)
  assert.equal(success.statusCode, 201)
  assert.equal(success.body.data.size, '128GB')
  assert.deepEqual(calls[0].params, ['128GB'])
  assert.deepEqual(calls[1].params, ['128GB', 0, 1])

  const duplicateController = new MemoryController({
    databaseConnected: () => true,
    repository: { async executePrepared() { return [[{ id: 1 }]] } }
  })
  const duplicate = createResponse()
  await duplicateController.create({ body: { size: '128GB' } }, duplicate)
  assert.equal(duplicate.statusCode, 400)
  assert.equal(duplicate.body.message, '该内存规格已存在')
})

test('内存规格详情与删除保留不存在响应和删除后返回原记录', async () => {
  let deleted = false
  const controller = new MemoryController({
    databaseConnected: () => true,
    repository: {
      async executePrepared(sql) {
        if (sql.startsWith('SELECT id, size')) {
          return deleted ? [[]] : [[{ id: 3, size: '256GB', status: 1, sort_order: 1 }]]
        }
        if (sql.startsWith('DELETE FROM')) {
          deleted = true
          return [[]]
        }
        assert.fail(`unexpected SQL: ${sql}`)
      }
    }
  })
  const detail = createResponse()
  await controller.getById({ params: { id: '3' } }, detail)
  assert.equal(detail.body.data.size, '256GB')

  const removed = createResponse()
  await controller.remove({ params: { id: '3' } }, removed)
  assert.equal(removed.body.message, '内存规格删除成功')
  assert.equal(removed.body.data.id, 3)

  const missing = createResponse()
  await controller.getById({ params: { id: '3' } }, missing)
  assert.equal(missing.statusCode, 404)
})

test('内存规格更新阻止重复值，统计与状态切换保留响应字段', async () => {
  let updateExecuted = false
  const updateController = new MemoryController({
    databaseConnected: () => true,
    repository: {
      async executePrepared(sql) {
        if (sql === 'SELECT id FROM memories WHERE id = ?') return [[{ id: 2 }]]
        if (sql === 'SELECT size FROM memories WHERE id = ?') return [[{ size: '64GB' }]]
        if (sql.includes('SELECT id FROM memories WHERE size = ?')) return [[{ id: 3 }]]
        updateExecuted = true
        return [[]]
      }
    }
  })
  const duplicate = createResponse()
  await updateController.update({ params: { id: '2' }, body: { size: '128GB' } }, duplicate)
  assert.equal(duplicate.statusCode, 409)
  assert.equal(updateExecuted, false)

  let statsCalls = 0
  let memorySelectCalls = 0
  const controller = new MemoryController({
    databaseConnected: () => true,
    repository: {
      async executePrepared(sql, params) {
        if (sql.includes('UPDATE memories SET status')) return [[]]
        if (sql.includes('SELECT COUNT(*) AS related_phones')) {
          assert.deepEqual(params, ['%GB', 1, '%128%'])
          return [[{ related_phones: 5 }]]
        }
        if (sql.includes('SUM(CASE')) {
          statsCalls += 1
          assert.deepEqual(params, ['%GB', 1, '%128%'])
          return [[{ total: 6, active: 4, inactive: 2 }]]
        }
        if (sql.startsWith('SELECT id, size')) {
          memorySelectCalls += 1
          return [[{ id: 2, size: '128GB', status: memorySelectCalls === 1 ? 1 : 0, sort_order: 0 }]]
        }
        assert.fail(`unexpected SQL: ${sql}`)
      }
    }
  })
  const stats = createResponse()
  await controller.getStats({ query: { size: '128', storage_unit: 'GB', status: '1' } }, stats)
  assert.deepEqual(stats.body.data, { total: 6, active: 4, inactive: 2, related_phones: 5 })
  assert.equal(statsCalls, 1)

  const toggled = createResponse()
  await controller.toggle({ params: { id: '2' } }, toggled)
  assert.equal(toggled.body.data.status, 0)
  assert.equal(toggled.body.message, '内存规格禁用成功')
})

test('内存批量排序按原事务提交，失败回滚且始终释放连接', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async execute(sql, params) { calls.push({ sql, params }) },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const controller = new MemoryController({
    databaseConnected: () => true,
    repository: { withConnection(operation) { return withConnection({ getConnection: async () => connection }, operation) } }
  })
  const success = createResponse()
  await controller.reorder({ body: { items: [{ id: 1, sort_order: 3 }, { id: 2 }] } }, success)
  assert.deepEqual(calls.map(call => typeof call === 'string' ? call : call.params), ['begin', [3, 1], 'commit', 'release'])
  assert.equal(success.body.message, '排序更新成功')

  calls.length = 0
  connection.execute = async () => { throw new Error('write failed') }
  const failure = createResponse()
  await controller.reorder({ body: { items: [{ id: 1, sort_order: 3 }] } }, failure)
  assert.deepEqual(calls, ['begin', 'rollback', 'release'])
  assert.equal(failure.statusCode, 500)
})
