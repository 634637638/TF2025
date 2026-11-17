'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { requireAllPermissions, requirePermission } = require('../src/middleware/unified-auth')
const capabilities = require('../src/config/module-permission-capabilities.json')

const historyPermissions = ['query:view', 'query:film']
const permissions = ['query_queryview:view', 'query_queryview:film']

async function authorize(user, guard = requireAllPermissions(historyPermissions)) {
  const response = { statusCode: 200,
    status(value) { this.statusCode = value; return this },
    json(value) { this.body = value; return this } }
  let allowed = false
  await guard({ user }, response, () => { allowed = true })
  return { allowed, response }
}

test('贴膜记录读取识别角色保存的完整模块权限，兼容字符串及权限对象', async () => {
  for (const user of [
    { id: 7, permissions },
    { id: 7, permissionObjects: permissions.map(value => {
      const [module_key, permission_type] = value.split(':')
      return { module_key, permission_type }
    }) },
    { id: 7, permissions: ['query:view', 'query:film'] }
  ]) {
    const result = await authorize(user)
    assert.equal(result.allowed, true)
    assert.equal(result.response.statusCode, 200)
  }
})

test('贴膜历史未登录或缺少任一必要权限均拒绝，赠送销售及CRUD不代替贴膜授权', async () => {
  const unauthenticated = await authorize(undefined)
  assert.equal(unauthenticated.response.statusCode, 401)
  assert.equal(unauthenticated.allowed, false)
  for (const missing of permissions) {
    const user = { id: 7, permissions: [
      ...permissions.filter(permission => permission !== missing),
      'query_queryview:create', 'query_queryview:edit', 'query_queryview:delete',
      'accessories_accessoriesview:create', 'accessories_accessoriesview:gift',
      'sales_salesview:create', 'accessories_accessoriesview:film'
    ] }
    const result = await authorize(user)
    assert.equal(result.allowed, false, `缺少 ${missing} 时不应放行`)
    assert.equal(result.response.statusCode, 403)
    assert.equal(result.response.body.code, 'INSUFFICIENT_PERMISSIONS')
  }
})

test('贴膜读取权限不自动授予商品赠送或收费出库权限', async () => {
  for (const permission of ['accessories:gift', 'accessories:create']) {
    const result = await authorize({ id: 7, permissions }, requirePermission(permission))
    assert.equal(result.allowed, false)
    assert.equal(result.response.statusCode, 403)
  }
})

for (const [moduleKey, alias] of [
  ['query_queryview', 'query'],
  ['accessories_accessoriesview', 'accessories']
]) {
  for (const action of capabilities.modules[moduleKey]) {
    test(`贴膜调用链公共权限映射：${moduleKey}:${action} 可由 ${alias}:${action} 正确识别`, async () => {
      const result = await authorize({ id: 7, permissions: [`${moduleKey}:${action}`] }, requirePermission(`${alias}:${action}`))
      assert.equal(result.allowed, true)
    })
  }
}


test('贴膜和单模块管理权限不提升为商品管理或系统管理员', async () => {
  for (const granted of [permissions, ['customers_customersview:manage'], ['shared_sharedview:manage'],
    ['reminders_reminderview:manage'], ['permissions_modulemanagementview:view'],
    ['permissions_permissionsview:view'], ['permissions_permissionsview:edit']]) {
    for (const required of ['permissions:admin', 'accessories:view', 'accessories:create', 'accessories:gift', 'system:edit']) {
      const result = await authorize({ id: 7, permissions: granted }, requirePermission(required))
      assert.equal(result.allowed, false, `${granted.join(',')} 不应授予 ${required}`)
    }
  }
  for (const granted of [['permissions:admin'], ['view', 'create', 'edit', 'delete'].map(action => `permissions_permissionsview:${action}`)]) {
    assert.equal((await authorize({ id: 7, permissions: granted }, requirePermission('permissions:admin'))).allowed, true)
  }
  assert.equal((await authorize({ id: 7, permissions: ['customers_customersview:edit'] }, requirePermission('customers:manage'))).allowed, false)
  assert.equal((await authorize({ id: 7, permissions: ['customers_customersview:manage'] }, requirePermission('customers:manage'))).allowed, true)
})
