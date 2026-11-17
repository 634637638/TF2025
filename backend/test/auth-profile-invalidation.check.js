'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')

test('撤销授权后清理身份缓存，下一次同令牌请求重新读取权限；停用账户不能复用旧身份', async () => {
  const filename = path.resolve(__dirname, '../src/middleware/unified-auth.js')
  const actualRequire = createRequire(filename)
  let enabled = true, granted = true, reads = 0, permissionReadFails = false
  let storeIds = [1, 2], primaryStoreId = 1
  const database = { async execute(sql) {
    if (sql.includes('SHOW COLUMNS')) return [[]]
    if (sql.includes('FROM users u')) { reads++; return [enabled ? [{ id: 7, username: 'isolated', status: 1, current_store_ids: storeIds.join(','), current_primary_store_id: primaryStoreId }] : []] }
    if (permissionReadFails) throw new Error('isolated-permission-read-failure')
    assert.match(sql, /JOIN roles r ON r.id = rp.role_id AND r.is_active = 1/)
    return [granted ? [{ module_key: 'query_queryview', permission_type: 'view' }] : []]
  } }
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process,
    require(name) {
      if (name === '../config/database') return { getDatabase: () => database }
      if (name === './jwt-blacklist') return { verifyToken: async () => ({ sub: 7, iat: 1, store_id: 99, store_ids: [99] }) }
      return actualRequire(name)
    }
  }, { filename })
  const { unifiedAuth, invalidateAuthProfiles } = module.exports
  const request = async () => {
    const req = { headers: { authorization: 'Bearer isolated.test.signature' } }
    const res = { status(code) { this.code = code; return this }, json() { return this } }
    let next = false
    await unifiedAuth(req, res, () => { next = true })
    return { req, res, next }
  }
  assert.deepEqual(Array.from((await request()).req.user.permissions), ['query_queryview:view'])
  await request()
  assert.equal(reads, 1)
  assert.equal((await request()).req.token, 'isolated.test.signature')
  // 照片签名读取不能复用 JWT 身份缓存中的旧店铺。
  storeIds = [1]
  assert.deepEqual(Array.from((await module.exports.loadCurrentAuthUser(7)).store_ids), [1])
  storeIds = [1, 2]
  // 独立身份装配增加一次读取，JWT 缓存仍按原失效流程计数。
  reads = 1
  granted = false
  invalidateAuthProfiles([7])
  assert.deepEqual(Array.from((await request()).req.user.permissions), [])
  assert.equal(reads, 2)
  // 沿用真实门店服务及同一身份缓存，模拟持久层；不写业务库。
  const serviceFile = path.resolve(__dirname, '../src/services/user-store.service.js')
  const serviceRequire = createRequire(serviceFile)
  const serviceModule = { exports: {} }
  vm.runInNewContext(fs.readFileSync(serviceFile, 'utf8'), {
    module: serviceModule, exports: serviceModule.exports,
    require(name) {
      return name === '../middleware/unified-auth' ? module.exports : serviceRequire(name)
    }
  }, { filename: serviceFile })
  const stores = () => storeIds.map(id => ({ store_id: id, is_primary: id === primaryStoreId ? 1 : 0 }))
  const service = new serviceModule.exports({
    database: () => ({ async execute() { return [[{ id: 7, username: 'isolated' }]] } }),
    auditOperation: async () => {},
    repository: {
      async getUserStores() { return stores() },
      async removeUserStore(_userId, id) { storeIds = storeIds.filter(item => item !== id); return {} },
      async assignStoresToUser(_userId, ids) { storeIds = [...new Set([...storeIds, ...ids])]; return {} },
      async setPrimaryStore(_userId, id) { primaryStoreId = id; return {} },
      async removeAllUserStores() { storeIds = []; primaryStoreId = null; return { affectedRows: 1 } }
    }
  })
  assert.deepEqual(Array.from((await request()).req.user.store_ids), [1, 2])
  await service.removeStore({ user_id: 7, store_id: 2 })
  assert.deepEqual(Array.from((await request()).req.user.store_ids), [1])
  await service.assignStores({ id: 1 }, { user_id: 7, store_ids: [3] })
  assert.deepEqual(Array.from((await request()).req.user.store_ids), [1, 3])
  await service.setPrimaryStore({ user_id: 7, store_id: 3 })
  assert.equal((await request()).req.user.store_id, 3)
  await service.removeAllStores({ user_id: 7 })
  const noStores = (await request()).req.user
  assert.deepEqual(Array.from(noStores.store_ids), [])
  assert.equal(noStores.store_id, null)
  permissionReadFails = true
  const UserRoleAssignmentService = require('../src/services/user-role-assignment.service')
  const roles = new UserRoleAssignmentService({ permissionCheck: module.exports.hasUnifiedPermission })
  await assert.rejects(roles.assertAccountAccess(7, { id: 8 }), /isolated-permission-read-failure/)
  permissionReadFails = false
  enabled = false
  invalidateAuthProfiles()
  const inactive = await request()
  assert.equal(inactive.next, false)
  assert.equal(inactive.res.code, 401)
})
