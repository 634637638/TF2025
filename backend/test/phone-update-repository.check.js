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
