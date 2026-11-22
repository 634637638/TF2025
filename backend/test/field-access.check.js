'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const ReminderController = require('../src/controllers/reminder.controller')
const SharedController = require('../src/controllers/shared.controller')
const FieldAccessService = require('../src/services/field-access.service')
const Masking = require('../src/services/data-masking.service').constructor

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('公共字段写入校验同时执行隐藏、只读和显式可编辑范围，空值不能清除受限字段', async () => {
  const service = new FieldAccessService({ moduleKey: 'sales', strict: true, masking: new Masking({
    database: () => ({}), getActiveRoles: async () => [{ role_id: 1 }, { role_id: 2 }],
    fieldRepository: { async listRoleFieldPermissions() { return [
      { field_config: { hidden_fields: ['cost'], editable_fields: ['price', 'readonly', 'cost'] } },
      { field_config: null, field_config_is_null: 1, field_key: 'readonly',
        can_view: 1, can_edit: 0, is_hidden: 0, permission_level: 'READ_ONLY' }
    ] } }
  }) })
  const map = { cost: 'cost', readonly: 'readonly', price: 'price', other: 'other' }
  for (const key of ['cost', 'readonly', 'other']) {
    for (const value of [null, 0, false, '', 99]) {
      assert.equal(await service.getDeniedWrite(7, { [key]: value }, map), key)
    }
  }
  assert.equal(await service.getDeniedWrite(7, { price: 0 }, map), undefined)
  assert.equal(await service.getDeniedWrite(7, {}, map), undefined)
  assert.equal(await service.getDeniedWrite(7, { readonly: 0 }, map, { visibleOnly: true }), undefined)
  assert.equal(await service.getDeniedWrite(7, { other: 0 }, map, { visibleOnly: true }), undefined)
  assert.equal(await service.getDeniedWrite(7, { cost: 0 }, map, { visibleOnly: true }), 'cost')
  const permissions = await service.getPermissions(7)
  assert.equal(service.maskPayload({ readonly: 1 }, permissions).readonly, 1)
})

test('没有字段配置时保留动作权限下的默认写入，显式空可编辑列表则禁止已映射字段', async () => {
  const service = new FieldAccessService({ moduleKey: 'sales', masking: {} })
  assert.equal(service.findDeniedWrite({ price: 3 }, { price: 'price' }, {}), undefined)
  assert.equal(service.findDeniedWrite({ price: 3 }, { price: 'price' }, { editableFields: [] }), 'price')
})

test('缓存本请求字段配置的HTTP守卫同样拦截只读字段，不执行后续业务', async () => {
  const service = new FieldAccessService({ moduleKey: 'sales', masking: {
    async getUserFieldPermissions() { return { readonlyFields: ['price'] } }
  } })
  const middleware = require('../src/middleware/field-access')(service)
  const res = response()
  await middleware.protectFields({ price: 'price' })({ user: { id: 7 }, body: { price: null } }, res,
    () => assert.fail('只读字段不可写入'))
  assert.equal(res.statusCode, 403)
})

for (const [Controller, moduleKey, hidden, bodyKey] of [
  [ReminderController, 'reminders_reminderview', 'basic_info.title', 'title'],
  [SharedController, 'shared_sharedview', 'post_info.title', 'title']
]) {
  test(`${moduleKey} 递归脱敏数组和嵌套对象，保留可见值且不修改原对象`, async () => {
    const controller = new Controller({
      masking: {
        async getUserFieldPermissions(userId, key) {
          assert.equal(userId, 7)
          assert.equal(key, moduleKey)
          return { hiddenFields: [hidden] }
        },
        filterSensitiveFields(rows) { return rows.map(row => ({ ...row, filtered: true })) }
      }
    })
    const input = { rows: [{ title: '隐藏', nested: { title: '隐藏', content: '可见' } }], count: 1, empty: null }
    const output = await controller.maskPayload(input, { user: { id: 7 } })
    assert.equal(output.rows[0].title, null)
    assert.equal(output.rows[0].nested.title, null)
    assert.equal(output.rows[0].nested.content, '可见')
    assert.equal(output.rows[0].nested.filtered, true)
    assert.equal(output.count, 1)
    assert.equal(output.empty, null)
    assert.equal(input.rows[0].title, '隐藏')
  })

  test(`${moduleKey} 显式空值也拒写，未提交隐藏字段放行；字段读取拒绝`, async () => {
    const controller = new Controller({ masking: {
      async getUserFieldPermissions() { return { hiddenFields: [hidden] } }
    } })
    for (const value of ['', null, false, 0]) {
      const res = response()
      await controller.rejectHiddenWrites({ [bodyKey]: hidden })(
        { user: { id: 7 }, body: { [bodyKey]: value } }, res,
        () => assert.fail('隐藏字段不应放行')
      )
      assert.equal(res.statusCode, 403)
      assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
      assert.equal(res.body.field, hidden)
    }
    let nextCalls = 0
    await controller.rejectHiddenWrites({ [bodyKey]: hidden })(
      { user: { id: 7 }, body: { content: '可见' } }, response(), () => { nextCalls += 1 }
    )
    await controller.requireVisibleField('visible')(
      { user: { id: 7 } }, response(), () => { nextCalls += 1 }
    )
    assert.equal(nextCalls, 2)
    const denied = response()
    await controller.requireVisibleField(hidden)(
      { user: { id: 7 } }, denied, () => assert.fail('隐藏字段不可读')
    )
    assert.equal(denied.statusCode, 403)
  })

  test(`${moduleKey} 权限服务异常交给统一错误处理，不放行业务`, async () => {
    const error = new Error('权限获取失败')
    const controller = new Controller({ masking: {
      async getUserFieldPermissions() { throw error }
    } })
    for (const handler of [controller.rejectHiddenWrites({ title: hidden }), controller.requireVisibleField(hidden)]) {
      let received
      await handler({ user: { id: 7 }, body: { title: 'x' } }, response(), err => { received = err })
      assert.equal(received, error)
    }
  })
}

test('提醒类型 name 特例与分享 author 别名保持隔离', () => {
  const masking = { filterSensitiveFields: rows => rows }
  const reminder = new ReminderController({ masking })
  const shared = new SharedController({ masking })
  assert.deepEqual(reminder.maskPayloadWithPermissions(
    [{ name: '提醒类型', default_remind_days: 2 }, { name: '其他名字' }],
    { hiddenFields: ['type_info.type_name'] }
  ), [{ name: null, default_remind_days: 2 }, { name: '其他名字' }])
  assert.deepEqual(shared.maskPayloadWithPermissions(
    { author: { name: '作者' }, author_id: 7, title: '可见' },
    { hiddenFields: ['author_info.author'] }
  ), { author: null, author_id: null, title: '可见' })
  assert.equal(shared.maskPayloadWithPermissions({ title: '可见' }, { hiddenFields: ['basic_info.title'] }).title, '可见')
})

test('商品查询字段逐角色独立合并，未配置角色沿用旧限制，显式空配置不继承配件或手机', async () => {
  const rows = [
    { role_id: 1, module_key: 'query_queryview', field_config: { hidden_fields: ['customer_info.customer_phone'], scopes: { goods: { hidden_fields: ['price_info.profit'] } } } },
    { role_id: 1, module_key: 'accessories_accessoriesview', field_config: { hidden_fields: ['basic_info.name'] } },
    { role_id: 2, module_key: 'accessories_accessoriesview', field_config: { hidden_fields: ['price_info.purchase_cost'] } }
  ]
  const masking = new Masking({ database: () => ({}), getActiveRoles: async () => [{ role_id: 1 }, { role_id: 2 }],
    fieldRepository: { async listRoleFieldPermissions(_database, _ids, key) { return rows.filter(row => row.module_key === key) } } })
  const goods = new FieldAccessService({ moduleKey: 'query_queryview', fieldScope: 'goods', masking,
    responseKeys: { 'price_info.profit': ['profit'], 'price_info.purchase_cost': ['cost'] } })
  assert.deepEqual((await goods.getPermissions(7)).hiddenFields, ['price_info.profit', 'price_info.purchase_cost'])
  assert.deepEqual(goods.maskPayload({ name: '充电器', customer_phone: '13900000001', cost: 5, profit: 10 }, await goods.getPermissions(7)),
    { name: '充电器', customer_phone: '13900000001', cost: null, profit: null })
  assert.deepEqual((await masking.getUserFieldPermissions(7, 'query_queryview')).hiddenFields, ['customer_info.customer_phone'])
  assert.deepEqual((await masking.getUserFieldPermissions(7, 'accessories_accessoriesview')).hiddenFields, ['basic_info.name', 'price_info.purchase_cost'])
  rows.push({ role_id: 2, module_key: 'query_queryview', field_config: { scopes: { goods: { hidden_fields: [] } } } })
  assert.deepEqual((await goods.getPermissions(7)).hiddenFields, ['price_info.profit'])
  rows[0].field_config.scopes.goods.hidden_fields = []
  assert.deepEqual((await goods.getPermissions(7)).hiddenFields, [])
})

test('商品字段配置损坏或读取故障时失败关闭，不能回退为无限制', async () => {
  for (const config of [{ scopes: { goods: null } }, { scopes: { goods: { hidden_fields: 'cost' } } },
    { scopes: { goods: { scopes: {} } } }, '{bad']) {
    const masking = new Masking({ database: () => ({}), logger: { error() {} }, getActiveRoles: async () => [{ role_id: 1 }],
      fieldRepository: { async listRoleFieldPermissions(_db, _ids, key) {
        return key === 'query_queryview' ? [{ role_id: 1, module_key: key, field_config: config }] : []
      } } })
    await assert.rejects(masking.getUserFieldPermissions(7, 'query_queryview', { fieldScope: 'goods' }))
  }
})
