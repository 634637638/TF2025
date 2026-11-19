'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RentalCustomerService = require('../src/services/rental-customer.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')
const repositoryStub = overrides => ({
  async getActiveStores() { return [] },
  async findPhoneOwner() { return null },
  async updateActiveCustomer() { return true },
  ...overrides
})

test('租赁客户创建复用公共客户接口，保留编辑路由和字段权限', () => {
  assert.doesNotMatch(routeSource, /router\.post\('\/customers'/)
  assert.match(routeSource, /router\.put\('\/customers\/:id', requirePermission\('rentals:create'\), requirePermission\('customers:edit'\)/)
})

test('租赁客户编辑复用公共姓名最小长度规则', async () => {
  const service = new RentalCustomerService({
    repository: repositoryStub(),
    masking: { async getUserFieldPermissions() { return { hiddenFields: [] } } },
    customerSearch: async () => ({ records: [] }),
    operatorSearch: async () => ({ records: [] })
  })
  await assert.rejects(service.update('1', { name: '李', phone: '13800000000', id_card: 'ID' }), /客户姓名至少需要2个字符/)
})
