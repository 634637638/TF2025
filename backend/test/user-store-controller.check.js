const test = require('node:test')
const assert = require('node:assert/strict')

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

test('用户门店 controller 保留替换绑定顺序、主门店参数和变更审计', async () => {
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
      async assignStoresToUser(userId, storeIds, assignedBy, isPrimary) {
        calls.push(['assign', userId, storeIds, assignedBy, isPrimary])
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
  assert.deepEqual(calls.slice(0, 4), ['get', 'remove-all', ['assign', 9, [2], 7, 1], 'get'].slice(0, 4))
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
