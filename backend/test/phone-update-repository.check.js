'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const PhoneUpdateRepository = require('../src/repositories/phone-update.repository')

test('phone update repository binds dynamic customer values and owns the timestamp assignment', async () => {
  let call
  const repository = new PhoneUpdateRepository({ database: () => ({}) })
  const connection = {
    async execute(sql, values) {
      call = { sql, values }
      return [{ affectedRows: 1 }]
    }
  }

  await repository.updateCustomer(connection, ['name = ?'], ['客户名'], 42)

  assert.match(call.sql, /UPDATE customers SET name = \?, updated_at = NOW\(\) WHERE id = \?/)
  assert.deepEqual(call.values, ['客户名', 42])
  assert.equal((call.sql.match(/updated_at = NOW\(\)/g) || []).length, 1)
})

test('phone update repository builds phone assignments only from service-provided fixed fields', async () => {
  let call
  const repository = new PhoneUpdateRepository({ database: () => ({}) })
  const connection = {
    async execute(sql, values) {
      call = { sql, values }
      return [{ affectedRows: 1 }]
    }
  }

  await repository.updatePhone(connection, ['brand_id = ?', 'remarks = ?'], [3, '备注'], 42)

  assert.match(call.sql, /UPDATE phones SET brand_id = \?, remarks = \? WHERE id = \?/)
  assert.deepEqual(call.values, [3, '备注', 42])
})

test('phone update repository reads, updates and creates canonical sale payment fields', async () => {
  const calls = []
  const repository = new PhoneUpdateRepository({ database: () => ({}) })
  const connection = {
    async execute(sql, values) {
      calls.push({ sql, values })
      if (sql.includes('SELECT id, customer_id')) {
        return [[{ id: 71, payment_method: 'mobile', payment_channel: 'wechat' }]]
      }
      if (sql.includes('INSERT INTO sales')) return [{ insertId: 72 }]
      return [{ affectedRows: 1 }]
    }
  }

  const existingSale = await repository.findLatestSaleByPhone(connection, 42)
  await repository.updateSale(
    connection,
    ['payment_method = ?', 'payment_channel = ?'],
    ['mobile', 'alipay'],
    existingSale.id
  )
  const createdSaleId = await repository.createSale(connection, {
    phoneId: 42,
    customerId: 8,
    saleType: 'retail',
    operatorId: 9,
    storeId: 3,
    salePrice: 100,
    purchaseCost: 50,
    paymentMethod: 'mobile',
    paymentChannel: 'alipay',
    saleTime: '2026-11-08 12:00:00',
    invoiceNumber: '202611080001XS',
    remarks: null
  })

  assert.deepEqual(
    [existingSale.payment_method, existingSale.payment_channel],
    ['mobile', 'wechat']
  )
  assert.match(calls[0].sql, /payment_method, payment_channel/)
  assert.match(calls[1].sql, /UPDATE sales SET payment_method = \?, payment_channel = \? WHERE id = \?/)
  assert.deepEqual(calls[1].values, ['mobile', 'alipay', 71])
  assert.match(calls[2].sql, /payment_method, payment_channel/)
  assert.deepEqual(calls[2].values.slice(7, 9), ['mobile', 'alipay'])
  assert.equal(createdSaleId, 72)
})
