'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/sales-checkout.service')
const Controller = require('../src/controllers/sales-checkout.controller')
const Repository = require('../src/repositories/sales-checkout.repository')
const actor = { id: 7, store_ids: [1] }
const query = { phone: '13800138000', store_id: '1' }
const setup = () => {
  const calls = [], denied = new Set()
  const connection = { async beginTransaction() { calls.push('begin') }, async rollback() { calls.push('rollback') }, destroy() { calls.push('destroy') } }
  const customer = { id: 9, member_number: 'VIP001', points: 80, balance: 25 }
  const pointsLedger = { async ready() { return true }, async snapshot(executor, id) { assert.equal(executor, connection); assert.equal(id, 9); return { available_points: 35 } } }
  const repository = { withConnection: operation => operation(connection), async customerSummary(executor, phone) { assert.equal(executor, connection); calls.push(phone); return customer },
    async customerSummaryById(executor, id) { assert.equal(executor, connection); calls.push(`id:${id}`); return customer } }
  const service = new Service({ repository, pointsLedger, permissionCheck: async (_actor, permission) => !permission.startsWith('query:goods-') && !denied.has(permission) })
  return { service, calls, denied, pointsLedger, repository }
}

test('会员摘要区分账户与来源可用积分，在同一事务读取并回滚，不写账', async () => {
  const { service, calls, denied } = setup()
  assert.deepEqual(await service.customerSummary(query, actor), { member_number: 'VIP001', points: 80, available_points: 35, balance: 25 })
  assert.deepEqual(calls, ['begin', query.phone, 'rollback'])
  await assert.rejects(service.customerSummary({ ...query, store_id: '2' }, actor), { statusCode: 403 })
  await assert.rejects(service.customerSummary({ ...query, extra: 1 }, actor), { statusCode: 400 })
  await assert.rejects(service.customerSummary({ ...query, phone: '123' }, actor), { statusCode: 400 })
  await assert.rejects(service.customerSummary({ ...query, context: 'all' }, actor), { statusCode: 400 })
  for (const permissions of [['accessories:view'], ['sales:sell', 'inventory:sell'], ['accessories:sell', 'accessories:gift']]) {
    denied.clear(); permissions.forEach(value => denied.add(value))
    await assert.rejects(service.customerSummary(query, actor), { statusCode: 403 })
  }
  assert.equal(calls.length, 3)
})

test('独立商品销售无需手机销售权限，仍严格核验商品动作和门店', async () => {
  const { service, denied } = setup()
  denied.add('sales:sell'); denied.add('inventory:sell')
  assert.equal((await service.customerSummary({ ...query, context: 'goods' }, actor)).available_points, 35)
  denied.add('accessories:sell'); denied.add('accessories:gift')
  await assert.rejects(service.customerSummary({ ...query, context: 'goods' }, actor), { statusCode: 403 })
})

test('贴膜客户摘要按客户ID读取，不要求手机号字段且仍使用同一只读事务', async () => {
  const { service, calls, denied } = setup()
  assert.deepEqual(await service.customerSummary({ customer_id: '9', store_id: '1', context: 'film' }, actor),
    { member_number: 'VIP001', points: 80, available_points: 35, balance: 25 })
  assert.deepEqual(calls, ['begin', 'id:9', 'rollback'])
  denied.add('query:film')
  await assert.rejects(service.customerSummary({ customer_id: '9', store_id: '1', context: 'film' }, actor), { statusCode: 403 })
  assert.deepEqual(calls, ['begin', 'id:9', 'rollback'])
})

test('无客户或来源账未安装时可用为零，来源核验失败回滚且不冒充账户余额', async () => {
  const { service, pointsLedger, calls, repository } = setup()
  pointsLedger.ready = async () => false
  assert.equal((await service.customerSummary(query, actor)).available_points, 0)
  pointsLedger.ready = async () => true
  pointsLedger.snapshot = async () => { throw new Error('来源账不一致') }
  await assert.rejects(service.customerSummary(query, actor), /来源账不一致/)
  assert.equal(calls.at(-1), 'rollback')
  repository.customerSummary = async () => null
  assert.deepEqual(await service.customerSummary(query, actor), { member_number: null, points: 0, available_points: 0, balance: 0 })
})

test('摘要按客户字段权限脱敏，字段配置故障拒绝返回，未授权客户字段不执行查询', async () => {
  let reads = 0
  const access = { async getPermissions() { return { hiddenFields: [] } } }
  const controller = new Controller({ permissionCheck: async () => true, service: { async customerSummary() { reads++; return { member_number: 'VIP001', points: 80, available_points: 35 } } }, phoneAccess: access, goodsAccess: access,
    customerAccess: { async getPermissions() { return { hiddenFields: ['customer.member_number', 'customer.points', 'customer.balance'] } } }, logger: { error() {} } })
  const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
  let res = response()
  await controller.customerSummary({ user: actor, query }, res)
  assert.deepEqual(res.body.data, { member_number: null, points: null, available_points: null, balance: null })
  controller.customerAccess.getPermissions = async () => { throw new Error('权限读取失败') }
  res = response(); await controller.customerSummary({ user: actor, query }, res)
  assert.equal(res.code, 500)
  assert.equal(res.body.data, undefined)
  controller.phoneAccess = { async getPermissions() { return { hiddenFields: ['sale.customer_phone'] } } }
  controller.customerAccess = access
  res = response(); await controller.customerSummary({ user: actor, query }, res)
  assert.equal(res.code, 403)
  assert.equal(reads, 1)
  res = response(); await controller.customerSummary({ user: actor, query: { ...query, context: 'goods' } }, res)
  assert.equal(res.body.data.available_points, 35)
  controller.goodsAccess = { async getPermissions() { return { hiddenFields: ['customer_info.customer_phone'] } } }
  res = response(); await controller.customerSummary({ user: actor, query: { ...query, context: 'goods' } }, res)
  assert.equal(res.code, 403)
  assert.equal(reads, 2)
})

test('仓储摘要使用调用方连接及参数化SELECT，客户锁先于来源账读取，不写客户', async () => {
  const repository = new Repository(), calls = []
  await repository.customerSummary({ async execute(sql, params) { calls.push({ sql, params }); return [[{ id: 9, member_number: 'VIP001', points: 80 }]] } }, query.phone)
  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /^SELECT id, member_number, points, balance FROM customers/)
  assert.match(calls[0].sql, /FOR UPDATE$/)
  assert.doesNotMatch(calls[0].sql, /INSERT|UPDATE customers|DELETE|ALTER/)
  assert.deepEqual(calls[0].params, [query.phone])
})

test('查询商品专用结算使用商品子范围，隐藏客户手机号字段不阻止商品销售', async () => {
  const FieldAccess = require('../src/services/field-access.service')
  for (const operation of ['Summary', 'Quote', 'Checkout']) {
    for (const hasAccessoryPage of [false, true]) {
      const reads = [], calls = []
      const access = (moduleKey, fieldScope) => new FieldAccess({ moduleKey, fieldScope, strict: true, masking: {
        async getUserFieldPermissions(id, key, options) {
          assert.equal(id, actor.id)
          reads.push({ key, scope: options.fieldScope })
          return { hiddenFields: options.fieldScope === 'goods' ? ['customer_info.customer_phone'] : [] }
        }
      } })
      const controller = new Controller({
        permissionCheck: async (_actor, permission) => { assert.equal(permission, 'accessories:view'); return hasAccessoryPage },
        goodsAccess: access('accessories_accessoriesview'), queryGoodsAccess: access('query_queryview', 'goods'),
        customerAccess: access('customers_customersview'), phoneAccess: access('sales_salesview'),
        service: Object.fromEntries(['customerSummary', 'quote', 'checkout'].map(name => [name, async () => { calls.push(name); return {} }])),
        logger: { error() {} }
      })
      const request = () => ({ user: actor, query: { ...query, context: 'goods' },
        body: { customer_info: { phone: query.phone }, accessories: [{ accessory_id: 1, quantity: 1, unit_price: 10 }] } })
      const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
      let res = response()
      await controller[`queryGoods${operation}`](request(), res)
      assert.equal(res.body.success, true)
      assert.equal(calls.length, 1)
      assert.ok(reads.some(row => row.key === 'query_queryview' && row.scope === 'goods'))
      reads.length = 0
      res = response()
      const method = operation === 'Summary' ? 'customerSummary' : operation.toLowerCase()
      await controller[method](request(), res)
      assert.equal(res.body.success, true)
      assert.equal(calls.length, 2)
      assert.ok(reads.some(row => row.key === (hasAccessoryPage ? 'accessories_accessoriesview' : 'query_queryview') && row.scope === (hasAccessoryPage ? undefined : 'goods')))
    }
  }
})
