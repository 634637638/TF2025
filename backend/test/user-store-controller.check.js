const test = require('node:test')
const assert = require('node:assert/strict')
const UserStoreRepository = require('../src/repositories/user-store.repository')

test('替换门店在单事务提交，插入失败恢复旧绑定，清空也先锁定用户', async () => {
  for (const fail of [false, true]) {
    const events = []
    let bindings = [1], before
    const connection = {
      async beginTransaction() { before = [...bindings]; events.push('begin') },
      async execute(sql, params) {
        if (/SELECT id FROM users/.test(sql)) { events.push('user-lock'); return [[{ id: 9 }]] }
        if (/SELECT id FROM stores/.test(sql)) return [[{ id: 2 }]]
        if (/DELETE FROM user_stores/.test(sql)) { bindings = []; return [{ affectedRows: 1 }] }
        if (/UPDATE user_stores/.test(sql)) return [{ affectedRows: 1 }]
        if (/INSERT INTO user_stores/.test(sql)) {
          if (fail) throw new Error('insert-failed')
          assert.deepEqual(params, [9, 2, 1, 7])
          bindings = [2]
          return [{ affectedRows: 1 }]
        }
        throw new Error(`未模拟的SQL: ${sql}`)
      },
      async commit() { events.push('commit') },
      async rollback() { bindings = before; events.push('rollback') },
      release() { events.push('release') }
    }
    const repository = new UserStoreRepository({ database: () => ({ getConnection: async () => connection }) })
    const operation = repository.assignStoresToUser(9, [2, '2'], 7, 1, true)
    if (fail) {
      await assert.rejects(operation, /insert-failed/)
      assert.deepEqual(bindings, [1])
      assert.deepEqual(events, ['begin', 'user-lock', 'rollback', 'release'])
    } else {
      await operation
      assert.deepEqual(bindings, [2])
      assert.deepEqual(events, ['begin', 'user-lock', 'commit', 'release'])
      events.length = 0
      await repository.removeAllUserStores(9)
      assert.deepEqual(bindings, [])
      assert.deepEqual(events, ['begin', 'user-lock', 'commit', 'release'])
    }
  }
})

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

test('用户门店 controller 原子替换绑定、主门店参数和变更审计', async () => {
  const UserStoreController = require('../src/controllers/user-store.controller')
  const calls = []
  const auditEntries = []
  let state = [{ store_id: 1, store_name: '旧门店', is_primary: 1 }]
  const controller = new UserStoreController({
    repository: {
      async getUserStores() {
        calls.push('get')
        return state
      },
      async removeAllUserStores() {
        calls.push('remove-all')
        state = []
        return { affectedRows: 1 }
      },
      async assignStoresToUser(userId, storeIds, assignedBy, isPrimary, replaceExisting) {
        calls.push(['assign', userId, storeIds, assignedBy, isPrimary, replaceExisting])
        state = [{ store_id: 2, store_name: '新门店', is_primary: isPrimary }]
        return { success: true, message: '已关联' }
      },
      async setPrimaryStore(userId, storeId) {
        calls.push(['primary', userId, storeId])
        state = [{ store_id: Number(storeId), store_name: '新门店', is_primary: 1 }]
        return { success: true, message: '主门店已更新' }
      },
      async removeUserStore(userId, storeId) {
        calls.push(['remove', userId, storeId])
        state = []
        return { success: true, message: '已移除' }
      }
    },
    database: () => ({
      async execute() {
        return [[{ id: 9, username: 'employee', name: '员工' }]]
      }
    }),
    auditOperation: async (...args) => auditEntries.push(args)
  })
  const req = { user: { id: 7 }, body: { user_id: 9, store_ids: [2], is_primary: true, replace_existing: true } }
  const assignResponse = createResponse()
  await controller.assignStores(req, assignResponse)
  assert.deepEqual(calls, ['get', ['assign', 9, [2], 7, 1, true], 'get'])
  assert.equal(assignResponse.body.data.message, '已关联')
  assert.equal(auditEntries.length, 1)
  assert.equal(auditEntries[0][1], 'assign')
  assert.equal(auditEntries[0][6].audit_type, 'user_store_binding')

  const primaryResponse = createResponse()
  await controller.setPrimaryStore({ ...req, body: { user_id: 9, store_id: 3 } }, primaryResponse)
  assert.deepEqual(calls.find(call => Array.isArray(call) && call[0] === 'primary'), ['primary', 9, 3])
  assert.equal(auditEntries[1][6].primary_store_id, 3)
})

test('用户门店 controller 保留必填校验和清空无变化时不记审计', async () => {
  const UserStoreController = require('../src/controllers/user-store.controller')
  let auditCount = 0
  const controller = new UserStoreController({
    repository: {
      async getUserStores() { return [] },
      async removeAllUserStores() { return { affectedRows: 0, message: '无关联' } }
    },
    auditOperation: async () => { auditCount++ }
  })
  const invalid = createResponse()
  await controller.assignStores({ body: {}, user: { id: 1 } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '用户ID和门店ID列表不能为空')

  const clearResponse = createResponse()
  await controller.removeAllStores({ params: { user_id: '8' } }, clearResponse)
  assert.equal(clearResponse.body.data.message, '无关联')
  assert.equal(auditCount, 0)
})
