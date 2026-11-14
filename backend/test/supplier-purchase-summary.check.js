'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/supplier-management.service')
const Repository = require('../src/repositories/supplier-management.repository')
const Purchases = require('../src/repositories/accessory-purchase.repository')
const Accessories = require('../src/repositories/accessory.repository')

const actor = { id: 7, store_ids: [1, 2] }
const emptyStats = { accessories_count: null, accessories_total_cost: null, phones_count: null, phones_total_cost: null }

function fixture(options = {}) {
  const events = [], reads = []
  const connection = {
    async beginTransaction() { events.push('begin'); if (options.fail === 'begin') throw new Error('begin failed') },
    async execute(sql, params) {
      reads.push({ sql, params })
      if (sql.startsWith('SET ')) {
        events.push('configure')
        if (options.fail === 'configure') throw new Error('configure failed')
        return []
      }
      if (options.fail === 'read') throw new Error('read failed')
      if (sql.startsWith('SELECT') && sql.includes('FROM suppliers')) return [options.missing ? [] : [{ id: 8, name: '供应商', status: 1 }]]
      if (sql.includes('AS has_history')) {
        if (options.fail === 'schema') throw new Error('history schema missing')
        return [[{ has_history: options.history ? 1 : 0 }]]
      }
      if (sql.includes('FROM accessories')) return [[{ count: options.accessories || 0 }]]
      if (sql.includes('FROM phones')) return [[options.phoneSummary || { count: options.phones || 0, total_cents: '0' }]]
      if (sql.startsWith('DELETE')) {
        if (options.fail === 'foreign') throw Object.assign(new Error('referenced'), { code: 'ER_ROW_IS_REFERENCED_2' })
        events.push('delete')
        return [{ affectedRows: 1 }]
      }
      throw new Error('unexpected SQL')
    },
    async query(sql, params) {
      reads.push({ sql, params })
      assert.match(sql, /FROM accessory_stock_in si/)
      return [[options.purchaseSummary || { quantity: '30', total_cents: '60000', invalid_count: '0' }]]
    },
    async rollback() { events.push('rollback'); if (options.fail === 'rollback') throw new Error('rollback failed') },
    async commit() { events.push('commit'); if (options.fail === 'commit') throw new Error('commit failed') },
    destroy() { events.push('destroy') },
    release() { events.push('release') }
  }
  const database = () => ({ async getConnection() { events.push('lease'); return connection } })
  const fieldReads = []
  const fields = (source, hiddenFields = []) => ({ async getPermissions(id) {
    fieldReads.push([source, id])
    if (options.fail === 'fields') throw new Error('fields failed')
    return { hiddenFields }
  } })
  const repository = new Repository({ database })
  const service = new Service({ connected: () => true, repository,
    permissionCheck: async (_actor, permission) => !(options.denied || []).includes(permission),
    purchaseFields: fields('purchase', options.purchaseHidden), inventoryFields: fields('phone', options.phoneHidden) })
  return { service, repository, connection, events, reads, fieldReads }
}

test('供应商详情从原采购整单汇总真实数量金额，全部读取共用只读快照及授权门店', async () => {
  const f = fixture({ phoneSummary: { count: '2', total_cents: '100000' } })
  const detail = await f.service.detail('8', actor)
  assert.deepEqual(detail.stats, { accessories_count: 30, accessories_total_cost: 600, phones_count: 2, phones_total_cost: 1000 })
  assert.deepEqual(f.events, ['lease', 'configure', 'begin', 'rollback', 'release'])
  assert.deepEqual(f.fieldReads, [['purchase', 7], ['phone', 7]])
  const purchase = f.reads.find(read => read.sql.includes('FROM accessory_stock_in si'))
  assert.match(purchase.sql, /SUM\(si.quantity\)/)
  assert.match(purchase.sql, /SUM\(si.total_amount \* 100\)/)
  assert.match(purchase.sql, /si.total_amount <> si.quantity \* si.purchase_cost/)
  assert.match(purchase.sql, /si.status = 'completed'/)
  assert.match(purchase.sql, /JSON_VALID\(si.distribution\)/)
  assert.deepEqual(purchase.params, [1, 2, 1, 2, 8])
  assert.doesNotMatch(purchase.sql, /JOIN|accessory_stock\s|accessory_sales|sale_price/)
  const phone = f.reads.find(read => read.sql.includes('FROM phones'))
  assert.match(phone.sql, /COUNT\(\*\) = COUNT\(purchase_cost\)/)
  assert.deepEqual(phone.params, [8, 1, 2])
})

test('无来源查看权限不读取统计或来源字段权限，不将隐藏值当成零', async () => {
  const f = fixture({ denied: ['supplier-payments:view', 'inventory:view'] })
  assert.deepEqual((await f.service.detail(8, actor)).stats, emptyStats)
  assert.deepEqual(f.fieldReads, [])
  assert.equal(f.reads.length, 2)
})

for (const field of ['payment.supplier_name', 'payment.store_name']) {
  test(`隐藏${field}不关联读取配件统计`, async () => {
    const f = fixture({ purchaseHidden: [field], denied: ['inventory:view'] })
    assert.deepEqual((await f.service.detail(8, actor)).stats, emptyStats)
    assert.equal(f.reads.some(read => read.sql.includes('FROM accessory_stock_in')), false)
  })
}
for (const field of ['supplier_info.supplier_name', 'store_info.store_name']) {
  test(`隐藏${field}不关联读取手机统计`, async () => {
    const f = fixture({ phoneHidden: [field], denied: ['supplier-payments:view'] })
    assert.deepEqual((await f.service.detail(8, actor)).stats, emptyStats)
    assert.equal(f.reads.some(read => read.sql.includes('FROM phones')), false)
  })
}

test('采购数量和成本分别遮蔽，手机未知成本保留NULL', async () => {
  const f = fixture({ purchaseHidden: ['purchase.quantity'], phoneSummary: { count: '2', total_cents: null } })
  assert.deepEqual((await f.service.detail(8, actor)).stats,
    { accessories_count: null, accessories_total_cost: 600, phones_count: 2, phones_total_cost: null })
  const g = fixture({ purchaseHidden: ['payment.purchase_cost'], phoneHidden: ['stats.total_phones', 'stats.inventory_value'] })
  assert.deepEqual((await g.service.detail(8, actor)).stats, { ...emptyStats, accessories_count: 30 })
  assert.equal(g.reads.some(read => read.sql.includes('FROM phones')), false)
})

test('全部数量和成本隐藏时不读取相应来源', async () => {
  const f = fixture({ purchaseHidden: ['purchase.quantity', 'payment.purchase_cost'], phoneHidden: ['stats.total_phones', 'price_info.purchase_cost'] })
  assert.deepEqual((await f.service.detail(8, actor)).stats, emptyStats)
  assert.equal(f.reads.length, 2)
})

test('零采购合法，大额累计使用安全整数分而非单笔金额限额', async () => {
  for (const [quantity, cents] of [['0', '0'], ['20000', '20000000000']]) {
    const f = fixture({ purchaseSummary: { quantity, total_cents: cents, invalid_count: 0 } })
    const { stats } = await f.service.detail(8, actor)
    assert.equal(stats.accessories_count, Number(quantity))
    assert.equal(stats.accessories_total_cost, Number(cents) / 100)
  }
})

test('采购损坏、越界或非整数累计拒绝返回伪造统计且结束快照', async () => {
  for (const patch of [{ invalid_count: 1 }, { quantity: '1.5' }, { total_cents: '-1' }, { total_cents: '9007199254740992' }]) {
    const f = fixture({ purchaseSummary: { quantity: '2', total_cents: '1000', invalid_count: 0, ...patch } })
    await assert.rejects(f.service.detail(8, actor), { statusCode: 409, code: 'PURCHASE_AMOUNT_CONFLICT' })
    assert.deepEqual(f.events.slice(-2), ['rollback', 'release'])
  }
})

test('无门店统计强制空集，全店范围不附普通门店条件', async () => {
  const repository = new Purchases()
  const calls = []
  const connection = { query: async (sql, params) => { calls.push({ sql, params }); return [[{}]] } }
  await repository.supplierSummary(8, { allStores: false, storeIds: [] }, connection)
  assert.match(calls[0].sql, /1 = 0/)
  await repository.supplierSummary(8, { allStores: true, storeIds: [] }, connection)
  assert.doesNotMatch(calls[1].sql, /si.store_id IN|JSON_VALID/)
  assert.deepEqual(calls[1].params, [8])
})

test('非法ID、认证、字段权限故障在租借前失败', async () => {
  for (const [id, user, statusCode] of [[0, actor, 400], [[], actor, 400], [8, null, 401]]) {
    const f = fixture()
    await assert.rejects(f.service.detail(id, user), { statusCode })
    assert.deepEqual(f.events, [])
  }
  const f = fixture({ fail: 'fields' })
  await assert.rejects(f.service.detail(8, actor), /fields failed/)
  assert.deepEqual(f.events, [])
})

test('供应商不存在仍正常结束只读事务', async () => {
  const f = fixture({ missing: true })
  await assert.rejects(f.service.detail(8, actor), { statusCode: 404 })
  assert.deepEqual(f.events.slice(-2), ['rollback', 'release'])
})

for (const fail of ['configure', 'begin', 'read', 'rollback']) {
  test(`详情${fail}失败释放连接，异常配置或事务清理不回池`, async () => {
    const f = fixture({ fail })
    await assert.rejects(f.service.detail(8, actor), new RegExp(`${fail} failed`))
    assert.equal(f.events.at(-1), 'release')
    assert.equal(f.events.includes('destroy'), fail !== 'read')
  })
}

for (const options of [{ history: true }, { accessories: 1 }, { phones: 1 }]) {
  test(`供应商有业务事实时拒删${JSON.stringify(options)}`, async () => {
    const f = fixture(options)
    await assert.rejects(f.service.remove(8), { statusCode: 409 })
    assert.match(f.reads[0].sql, /FROM suppliers WHERE id = \? FOR UPDATE/)
    assert.equal(f.events.includes('delete'), false)
    assert.deepEqual(f.events.slice(-2), ['rollback', 'release'])
  })
}

test('无商品无采购付款历史允许删除并提交；付款历史含撤销仍受保护', async () => {
  const f = fixture()
  assert.equal(await f.service.remove(8), null)
  assert.deepEqual(f.events, ['lease', 'begin', 'delete', 'commit', 'release'])
  const historyRead = f.reads.find(read => read.sql.includes('AS has_history'))
  assert.match(historyRead.sql, /accessory_stock_in/)
  assert.match(historyRead.sql, /accessory_purchase_payments/)
  assert.doesNotMatch(historyRead.sql, /action\s*=|status\s*=/)
})

test('删除时来源结构缺失、提交或回滚失败均失败关闭，外键冲突转409', async () => {
  for (const fail of ['schema', 'foreign', 'commit', 'rollback']) {
    const f = fixture({ fail, history: fail === 'rollback' })
    await assert.rejects(f.service.remove(8), fail === 'foreign' ? { statusCode: 409 } : new RegExp(fail === 'schema' ? 'history schema missing' : `${fail} failed`))
    assert.equal(f.events.at(-1), 'release')
    assert.equal(f.events.includes('destroy'), fail === 'rollback')
  }
})

test('事务内采购供应商引用使用共享锁，普通选项读取不加锁', async () => {
  const repository = new Accessories()
  const calls = []
  repository.queryRows = async (sql, params, connection) => { calls.push({ sql, params, connection }); return [{ id: 8 }] }
  const connection = {}
  await repository.getReference(8, 'supplier_id', connection)
  assert.match(calls[0].sql, /LOCK IN SHARE MODE$/)
  assert.equal(calls[0].connection, connection)
  await repository.getReference(8, 'supplier_id')
  assert.doesNotMatch(calls[1].sql, /LOCK IN SHARE MODE/)
  await repository.getReference(1, 'store_id', connection)
  assert.doesNotMatch(calls[2].sql, /LOCK IN SHARE MODE/)
})
