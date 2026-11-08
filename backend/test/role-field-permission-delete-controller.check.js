'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/role-field-permission-delete.controller')
const Service = require('../src/services/role-field-permission-delete.service')
const Repository = require('../src/repositories/role-field-permission-delete.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
const makeResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('role field permission deletion route keeps admin authorization and delegates to controller', () => {
  assert.match(routeSource, /router\.delete\('\/field-permissions\/:role_id\/:module_key', requirePermission\('permissions:admin'\), roleFieldPermissionDeleteController\.remove\.bind\(roleFieldPermissionDeleteController\)\)/)
})

test('role field permission deletion controller preserves validation and response contracts', async () => {
  const controller = new Controller({
    service: { async remove(roleId, moduleKey) {
      if (moduleKey === 'missing') return 0
      if (moduleKey === 'failure') throw new Error('database unavailable')
      assert.deepEqual([roleId, moduleKey], ['7', 'sales'])
      return 2
    } },
    logger: { error() {} }
  })

  const invalid = makeResponse()
  await controller.remove({ params: { role_id: '', module_key: 'sales' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const missing = makeResponse()
  await controller.remove({ params: { role_id: '7', module_key: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '字段权限配置不存在' })

  const success = makeResponse()
  await controller.remove({ params: { role_id: '7', module_key: 'sales' } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '删除字段权限配置成功',
    data: { role_id: 7, module_key: 'sales', deleted_count: 2 }
  })

  const failure = makeResponse()
  await controller.remove({ params: { role_id: '7', module_key: 'failure' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '删除角色字段权限失败: database unavailable')
})

test('role field permission deletion service clears cache even when no row was deleted', async () => {
  const events = []
  const service = new Service({
    repository: { async delete(roleId, moduleKey) { events.push(['delete', roleId, moduleKey]); return 0 } },
    invalidateCache() { events.push(['cache']) }
  })

  assert.equal(await service.remove('7', 'sales'), 0)
  assert.deepEqual(events, [['delete', '7', 'sales'], ['cache']])
})

test('role field permission deletion repository binds role and module identifiers', async () => {
  let call
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      call = { sql, params }
      return [{ affectedRows: 3 }]
    }
  }) })

  assert.equal(await repository.delete('7', 'sales'), 3)
  assert.match(call.sql, /DELETE FROM role_field_permissions WHERE role_id = \? AND module_key = \?/)
  assert.deepEqual(call.params, ['7', 'sales'])
})
