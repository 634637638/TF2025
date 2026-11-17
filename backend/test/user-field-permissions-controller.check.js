'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/user-field-permissions.controller')
const Service = require('../src/services/user-field-permissions.service')
const Repository = require('../src/repositories/user-field-permissions.repository')
const Masking = require('../src/services/data-masking.service').constructor
const { clearSchemaInspectorCache } = require('../src/utils/schema-inspector')

test('字段接口与后端脱敏共用有效角色，排除停用角色、停用绑定及过期绑定', async () => {
  const now = Date.parse('2026-11-16T08:00:00Z')
  const relations = [
    { role_id: 1, role_name: '有效', active: 1, status: 'active', expires: null },
    { role_id: 2, role_name: '角色停用', active: 0, status: 'active', expires: null },
    { role_id: 3, role_name: '绑定停用', active: 1, status: 'inactive', expires: null },
    { role_id: 4, role_name: '已过期', active: 1, status: 'active', expires: now - 1 },
    { role_id: 5, role_name: '到期边界', active: 1, status: 'active', expires: now },
    { role_id: 6, role_name: '尚未到期', active: 1, status: 'active', expires: now + 1 }
  ]
  const roleReads = []
  const database = { async execute(sql, params) {
    if (sql.includes('information_schema.COLUMNS')) return [[{ present: 1 }]]
    assert.match(sql, /FROM user_roles/)
    assert.deepEqual(params, [7])
    roleReads.push(sql)
    return [relations.filter(role =>
      (!sql.includes('r.is_active = 1') || role.active === 1) &&
      (!sql.includes("ur.status = 'active'") || role.status === 'active') &&
      (!sql.includes('ur.expires_at > NOW()') || role.expires === null || role.expires > now))]
  } }
  const repository = { async listRoleFieldPermissions(_db, roleIds) {
    assert.deepEqual(roleIds, [1, 6])
    return roleIds.map(role_id => ({ role_id, module_key: 'sales', field_config: { hidden_fields: [`field_${role_id}`] } }))
  } }
  clearSchemaInspectorCache()
  try {
    const result = await new Service({ databaseProvider: () => database, repository }).getForUser(7, 'sales')
    assert.deepEqual(result.roles.map(role => role.role_id), [1, 6])
    assert.deepEqual(result.field_permissions.sales.hidden_fields, ['field_1', 'field_6'])
    const masked = await new Masking({ database: () => database, fieldRepository: repository }).getUserFieldPermissions(7, 'sales', { strict: true })
    assert.deepEqual(masked.hiddenFields, ['field_1', 'field_6'])
    assert.equal(roleReads.length, 2)
    assert.ok(roleReads.every(sql => sql.includes('r.is_active = 1') && sql.includes("ur.status = 'active'") && sql.includes('ur.expires_at > NOW()')))
  } finally { clearSchemaInspectorCache() }
})

test('公共有效角色来源兼容缺少可选列的旧结构，角色读取故障不会返回字段授权', async () => {
  clearSchemaInspectorCache()
  let failed = false
  const database = { async execute(sql) {
    if (sql.includes('information_schema.COLUMNS')) return [[]]
    if (failed) throw new Error('role source unavailable')
    assert.doesNotMatch(sql, /r\.is_active|ur\.status|ur\.expires_at/)
    return [[{ role_id: 1, role_name: '旧结构角色' }]]
  } }
  const service = new Service({ databaseProvider: () => database,
    repository: { async listRoleFieldPermissions() { return [] } } })
  try {
    assert.deepEqual((await service.getForUser(7)).roles, [{ role_id: 1, role_name: '旧结构角色' }])
    failed = true
    await assert.rejects(service.getForUser(7), /role source unavailable/)
  } finally { clearSchemaInspectorCache() }
})

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('user field permissions route inherits authentication and delegates to controller', () => {
  assert.match(routeSource, /router\.use\(unifiedAuth\)/)
  assert.match(routeSource, /router\.get\('\/user-field-permissions', userFieldPermissionsController\.getCurrent\.bind\(userFieldPermissionsController\)\)/)
})

test('user field permissions controller preserves identity validation, response and error shape', async () => {
  const calls = []
  const controller = new Controller({
    service: { async getForUser(...args) { calls.push(args); return { user_id: 8, roles: [], field_permissions: {} } } },
    logger: { debug() {}, error() {} }
  })
  const missing = response()
  await controller.getCurrent({ user: null, query: {} }, missing)
  assert.equal(missing.statusCode, 401)

  const success = response()
  await controller.getCurrent({ user: { userId: 8 }, query: { module_key: 'inventory' } }, success)
  assert.deepEqual(calls, [[8, 'inventory']])
  assert.deepEqual(success.body, {
    success: true,
    message: '获取用户字段权限成功',
    data: { user_id: 8, roles: [], field_permissions: {} }
  })

  controller.service.getForUser = async () => { throw new Error('database unavailable') }
  const failed = response()
  await controller.getCurrent({ user: { id: 9 }, query: {} }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, {
    success: false,
    message: '获取用户字段权限失败: database unavailable',
    data: { user_id: 9, roles: [], field_permissions: {} }
  })
})

test('user field permissions service merges fields from the shared active-role source', async () => {
  const calls = []
  const service = new Service({
    databaseProvider: () => ({}),
    getActiveRoles: async (...args) => {
      calls.push(['roles', ...args])
      return [{ role_id: 2, role_name: '销售' }, { role_id: 3, role_name: '主管' }]
    },
    repository: {
      async listRoleFieldPermissions(...args) {
        calls.push(['fields', ...args])
        return [
          { role_id: 2, module_key: 'sales', field_config: '{"hidden_fields":["cost"],"editable_fields":["remark"]}' },
          { role_id: 3, module_key: 'sales', field_config: { hidden_fields: ['cost', 'phone'], editable_fields: ['remark', 'status'] } }
        ]
      }
    },
    logger: { debug() {}, warn() {} }
  })

  const result = await service.getForUser(7, 'sales')
  assert.deepEqual(result.roles, [{ role_id: 2, role_name: '销售' }, { role_id: 3, role_name: '主管' }])
  assert.deepEqual(result.field_permissions.sales, {
    module_key: 'sales',
    hidden_fields: ['cost', 'phone'],
    editable_fields: ['remark', 'status'],
    has_editable_scope: true,
    role_sources: [{ role_id: 2, role_name: '销售' }, { role_id: 3, role_name: '主管' }]
  })
  assert.equal(result.total_modules, 1)
  assert.deepEqual(calls[0], ['roles', 7, {}])
  assert.deepEqual(calls[1], ['fields', {}, [2, 3], 'sales'])
})

test('user field permissions service omits malformed stored JSON and retains the no-role response', async () => {
  const warnings = []
  const service = new Service({
    databaseProvider: () => ({}),
    getActiveRoles: async () => [{ role_id: 4, role_name: '员工' }],
    repository: {
      async listRoleFieldPermissions() {
        return [{ role_id: 4, module_key: 'inventory', field_config: '{bad json' }]
      }
    },
    logger: { debug() {}, warn(...args) { warnings.push(args) } }
  })
  assert.deepEqual(await service.getForUser(4), {
    user_id: 4,
    roles: [{ role_id: 4, role_name: '员工' }],
    field_permissions: {},
    total_modules: 0
  })
  assert.equal(warnings.length, 1)

  service.getActiveRoles = async () => []
  assert.deepEqual(await service.getForUser(5), { user_id: 5, roles: [], field_permissions: {} })
})

test('user field permissions repository binds identity, role IDs and optional module key', async () => {
  const calls = []
  const repository = new Repository({ columnExists: async () => false })
  const database = { async execute(sql, params) { calls.push({ sql, params }); return [[{ role_id: 2, role_name: '销售' }]] } }
  await repository.listRoleFieldPermissions(database, [2, 3], 'sales')
  assert.deepEqual(calls[0].params, [2, 3, 'sales'])
  assert.match(calls[0].sql, /role_id IN \(\?,\?\).*AND module_key = \?/s)
  await repository.listRoleFieldPermissions(database, [2])
  assert.deepEqual(calls[1].params, [2])
  await repository.listRoleFieldPermissions(database, [])
  assert.equal(calls.length, 2)
})

test('单字段旧记录与JSON配置共用解析，多角色隐藏和只读优先于可编辑', async () => {
  const legacy = { module_key: 'system_systemview', field_config: null, field_config_is_null: 1,
    field_key: 'settings.site_info', can_view: 1, can_edit: 0, is_hidden: 0, permission_level: 'READ_ONLY' }
  const rows = [
    { ...legacy, role_id: 2 },
    { ...legacy, role_id: 3, can_edit: 1, permission_level: 'FULL' },
    { ...legacy, role_id: 3, field_key: 'settings.logo', can_view: 0, can_edit: 1, permission_level: 'HIDDEN' },
    { role_id: 3, module_key: legacy.module_key, field_config: { editable_fields: ['settings.logo', 'settings.site_info', 'settings.title'] } }
  ]
  const service = new Service({ databaseProvider: () => ({}),
    getActiveRoles: async () => [{ role_id: 2, role_name: '员工' }, { role_id: 3, role_name: '主管' }],
    repository: { listRoleFieldPermissions: async () => rows } })
  const result = await service.getForUser(7, legacy.module_key)
  assert.deepEqual(result.field_permissions[legacy.module_key].hidden_fields, ['settings.logo'])
  assert.deepEqual(result.field_permissions[legacy.module_key].editable_fields, ['settings.title'])
  assert.deepEqual(result.field_permissions[legacy.module_key].readonly_fields, ['settings.site_info'])
  assert.equal(result.field_permissions[legacy.module_key].has_editable_scope, true)
})

test('仓储按实际列构造投影，区分SQL NULL与JSON null且不执行结构写入', async () => {
  for (const supportsSingleField of [false, true]) {
    const metadata = [], queries = []
    const repository = new Repository({ columnExists: async (table, column, db) => {
      metadata.push({ table, column, db }); return supportsSingleField
    } })
    const database = { execute: async (sql, params) => { queries.push({ sql, params }); return [[]] } }
    await repository.listRoleFieldPermissions(database, [2], 'system_systemview')
    assert.equal(metadata.length, 5)
    assert.equal(metadata.every(item => item.table === 'role_field_permissions' && item.db === database), true)
    assert.match(queries[0].sql, /field_config IS NULL AS field_config_is_null/)
    assert.equal(queries[0].sql.includes('can_view'), supportsSingleField)
    assert.doesNotMatch(queries[0].sql, /ALTER|UPDATE|INSERT|DELETE|CREATE/)
    assert.deepEqual(queries[0].params, [2, 'system_systemview'])
  }
})

test('用户字段接口返回独立商品范围，逐角色兼容旧限制且不污染手机或配件模块', async () => {
  const rows = [
    { role_id: 1, module_key: 'query_queryview', field_config: { hidden_fields: ['basic_info.imei'], scopes: { goods: { hidden_fields: ['price_info.profit'] } } } },
    { role_id: 1, module_key: 'accessories_accessoriesview', field_config: { hidden_fields: ['basic_info.name'] } },
    { role_id: 2, module_key: 'accessories_accessoriesview', field_config: { hidden_fields: ['customer_info.customer_phone'] } }
  ]
  const service = new Service({ databaseProvider: () => ({}), getActiveRoles: async () => [{ role_id: 1 }, { role_id: 2 }],
    repository: { async listRoleFieldPermissions() { return rows } } })
  const result = (await service.getForUser(7)).field_permissions
  assert.deepEqual(result.query_goods.hidden_fields, ['price_info.profit', 'customer_info.customer_phone'])
  assert.deepEqual(result.query_queryview.hidden_fields, ['basic_info.imei'])
  assert.deepEqual(result.accessories_accessoriesview.hidden_fields, ['basic_info.name', 'customer_info.customer_phone'])
  rows[0].field_config.scopes.goods = { hidden_fields: 'bad' }
  await assert.rejects(service.getForUser(7), /字段权限配置无效/)
})

test('库存聚合JSON的只读限制跨角色优先于编辑授权，仍可查看且拒绝零值与清空写入', async () => {
  const FieldAccess = require('../src/services/field-access.service')
  const rows = [
    { role_id: 1, module_key: 'inventory_inventoryview', field_config: { hidden_fields: ['basic.imei'], readonly_fields: ['price_info.purchase_cost'] } },
    { role_id: 2, module_key: 'inventory_inventoryview', field_config: { editable_fields: ['basic.imei', 'price_info.purchase_cost', 'other_info.remarks'] } }
  ]
  const roles = [{ role_id: 1 }, { role_id: 2 }]
  const repository = { async listRoleFieldPermissions() { return rows } }
  const masking = new Masking({ database: () => ({}), getActiveRoles: async () => roles, fieldRepository: repository })
  const permissions = await masking.getUserFieldPermissions(7, 'inventory_inventoryview', { strict: true })
  assert.deepEqual(permissions.readonlyFields, ['price_info.purchase_cost'])
  assert.deepEqual(permissions.editableFields, ['other_info.remarks'])
  const fields = new FieldAccess({ moduleKey: 'inventory_inventoryview', masking })
  const map = { purchase_cost: 'price_info.purchase_cost', imei: 'basic.imei', remarks: 'other_info.remarks' }
  for (const value of [0, null, '', 99]) {
    assert.equal(fields.findDeniedWrite({ purchase_cost: value }, map, permissions), 'price_info.purchase_cost')
  }
  assert.equal(fields.findDeniedWrite({ remarks: '' }, map, permissions), undefined)
  const visible = fields.maskPayload({ purchase_cost: 100, imei: 'TEST', remarks: '备注' }, permissions)
  assert.equal(visible.purchase_cost, 100)
  assert.equal(visible.imei, null)
  const user = await new Service({ databaseProvider: () => ({}), getActiveRoles: async () => roles, repository }).getForUser(7, 'inventory_inventoryview')
  assert.deepEqual(user.field_permissions.inventory_inventoryview.readonly_fields, ['price_info.purchase_cost'])
  assert.deepEqual(user.field_permissions.inventory_inventoryview.editable_fields, ['other_info.remarks'])
})
