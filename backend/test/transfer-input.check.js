'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { parseTransferInput, prepareWholesalePrices } = require('../src/utils/transfer-input')

const base = { phone_ids: [1], operator_id: 2, customer_name: '张三', customer_phone: '13800138000', sale_time: '2026-11-13 12:00:00' }
const invalidNumbers = ['12abc', '12元', '1e3', '0x10', '12\n', ' ', true, false, [], {}, NaN, Infinity]

function loadService(t, { connection, points = async () => {} } = {}) {
  const database = require('../src/config/database')
  const invoices = require('../src/utils/invoice-number')
  const customerPoints = require('../src/services/customer-points.service')
  t.mock.method(database, 'getDatabase', () => {
    assert.ok(connection, '非法输入不得获取数据库连接')
    return { async getConnection() { return connection } }
  })
  t.mock.method(invoices, 'prepareInvoiceNumberTransaction', async () => {})
  t.mock.method(invoices, 'generateInvoiceNumber', async () => '202611130001PF')
  t.mock.method(customerPoints, 'reconcileCustomerPointsForSale', points)
  const path = require.resolve('../src/services/transfer.service')
  const previous = require.cache[path]
  delete require.cache[path]
  const Service = require(path)
  t.after(() => { if (previous) require.cache[path] = previous; else delete require.cache[path] })
  return new Service()
}

test('批发及划拨在数据库之前拒绝混输ID、姓名、手机号和备注，合法前导零及标点保留', async t => {
  const service = loadService(t)
  for (const patch of [...invalidNumbers.map(customer_id => ({ customer_id })), { phone_ids: [true] }, { phone_ids: [1, '1'] },
    { customer_name: '123' }, { customer_name: {} }, { customer_phone: '138x00138000' }, { customer_phone: 13800138000 },
    { remarks: 'a\u0000b' }, { salesperson_name: '张\n三' }, { store_id: '1e3' }]) {
    await assert.rejects(service.wholesaleToPeer({ ...base, ...patch }), { statusCode: 400 })
    await assert.rejects(service.proxyTransferForSupplier({ ...base, supplier_id: 3, ...patch }), { statusCode: 400 })
  }
  const result = parseTransferInput({ ...base, phone_ids: ['01'], customer_phone: '+86 138-0013-8000', customer_name: "Anne·张 O'Neil", remarks: '备注\n第二行' })
  assert.deepEqual(result.phone_ids, [1])
  assert.equal(result.customer_phone, '13800138000')
  assert.equal(result.customer_name, "Anne·张 O'Neil")
  assert.equal(result.remarks, '备注\n第二行')
})

test('全部批发价格非法时保留逐台失败结果，且不创建客户、预检结构或开启事务', async t => {
  const service = loadService(t)
  for (const wholesale_price of [...invalidNumbers, null, '', 0, -1, '1.001']) {
    const result = await service.wholesaleToPeer({ ...base, phones: [{ phone_id: 1, wholesale_price }] })
    assert.equal(result.success_count, 0)
    assert.equal(result.failed_phones.length, 1)
    assert.equal(result.failed_phones[0].phone_id, 1)
    assert.deepEqual(result.results, [])
  }
  for (const purchase_cost of [...invalidNumbers, -1, '1.001']) {
    assert.equal((await service.wholesaleToPeer({ ...base, phones: [{ phone_id: 1, wholesale_price: '10.01', purchase_cost }] })).failed_phones.length, 1)
  }
})

test('价格明细拒绝伪装数组、重复及未选择ID，合法金额零头与空成本保持', () => {
  for (const phones of [true, {}, [{ phone_id: '1abc' }], [{ phone_id: 1 }, { phone_id: '1' }], [{ phone_id: 2 }]]) {
    assert.throws(() => prepareWholesalePrices([1], phones), { statusCode: 400 })
  }
  for (const purchase_cost of [null, undefined, '']) {
    assert.deepEqual(prepareWholesalePrices([1], [{ phone_id: '1', wholesale_price: '0.01', purchase_cost }]).prices.get(1), { wholesale_price: 0.01, purchase_cost: null })
  }
  assert.equal(prepareWholesalePrices([1], [{ phone_id: 1, wholesale_price: 1, purchase_cost: '0' }]).prices.get(1).purchase_cost, 0)
})

test('批发混合价格保留部分成功，不处理非法明细；单台后续失败仍回滚至保存点', async t => {
  const events = []
  let saleId = 10
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') },
    async query(sql, values) {
      if (sql.includes('FROM customers WHERE id')) return [[{ name: '张三', phone: '13800138000' }]]
      if (sql.includes('FROM phones')) {
        events.push(['phone', values[0]])
        return [[{ id: values[0], imei: '012345678901234', status: 'in_stock', purchase_cost: 1 }]]
      }
      if (sql.includes('INSERT INTO sales')) return [{ insertId: saleId++ }]
      if (/SAVEPOINT/.test(sql)) events.push(sql)
      return [{ affectedRows: 1 }]
    }
  }
  const service = loadService(t, { connection, points: async ({ saleId: id }) => { if (id === 10) throw new Error('模拟积分写入失败') } })
  const result = await service.wholesaleToPeer({ ...base, customer_id: 1, store_id: 3, phone_ids: [1, 2, 3],
    phones: [{ phone_id: 1, wholesale_price: '10.01' }, { phone_id: 2, wholesale_price: '1e3' }, { phone_id: 3, wholesale_price: '12.02', purchase_cost: 0 }] })
  assert.equal(result.total_count, 3)
  assert.equal(result.success_count, 1)
  assert.equal(result.failed_phones.length, 2)
  assert.equal(result.results[0].phone_id, 3)
  assert.equal(result.results[0].wholesale_price, 12.02)
  assert.equal(result.results[0].purchase_cost, 0)
  assert.equal(result.results[0].profit, 12.02)
  assert.deepEqual(events.filter(event => Array.isArray(event)), [['phone', 1], ['phone', 3]])
  assert.equal(events.filter(event => event === 'ROLLBACK TO SAVEPOINT wholesale_phone').length, 1)
  assert.deepEqual(events.slice(-2), ['commit', 'release'])
})
