'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('维修客户创建复用公共客户接口，不保留独立创建路由', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  const customersRoute = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  const repairApi = fs.readFileSync(path.join(__dirname, '../../frontend/src/api/repairs.ts'), 'utf8')
  const repairView = fs.readFileSync(path.join(__dirname, '../../frontend/src/views/repairs/RepairsView.vue'), 'utf8')
  assert.doesNotMatch(route, /router\.post\('\/customers'/)
  assert.doesNotMatch(repairApi, /createCustomer\s*:/)
  assert.match(customersRoute, /router\.post\('\/', unifiedAuth, requirePermission\('customers:create'\)/)
  assert.match(repairView, /createCustomerProfile\(/)
})

test('公共客户姓名规则拒绝单字姓名', () => {
  const { isCustomerName } = require('../src/utils/input-values')
  assert.equal(isCustomerName('李'), false)
  assert.equal(isCustomerName('李明'), true)
})
