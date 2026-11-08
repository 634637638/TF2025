'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('comprehensive query rejects manually selected stores outside the user scope', () => {
  const controller = read('src/controllers/query.controller.js')
  const storeScope = read('src/utils/store-scope.js')

  assert.match(controller, /const validateRequestedStoreScope = \(req, res\) =>/)
  assert.match(controller, /resolveStoreScope\(req\.user, req\.query\.store_id\)/)
  assert.match(storeScope, /if \(isSuperAdmin\(user\)\)/)
  assert.match(storeScope, /!userStoreIds\.includes\(requestedStoreId\)/)
  assert.match(storeScope, /无权访问该门店数据/)
  assert.equal((controller.match(/validateRequestedStoreScope\(req, res\)/g) || []).length, 3)
})

test('stock-in and return-goods mutations share the canonical store scope guard', () => {
  const stockIn = read('src/routes/stock-in.js')
  const stockInService = read('src/services/stock-in.service.js')
  const stockInRepository = read('src/repositories/stock-in.repository.js')
  const controller = read('src/controllers/query.controller.js')
  const repository = read('src/repositories/query.repository.js')

  assert.match(stockIn, /stockInController\.create\.bind\(stockInController\)/)
  assert.match(stockIn, /router\.put\('\/:id', unifiedAuth, requirePermission\('stock-in:edit'\), stockInController\.update\.bind\(stockInController\)\)/)
  assert.match(stockIn, /router\.delete\('\/:id', unifiedAuth, requirePermission\('stock-in:delete'\), stockInController\.remove\.bind\(stockInController\)\)/)
  assert.match(stockInService, /resolveStoreScope\(actor, store_id\)/)
  assert.match(stockInService, /assertStoreInScope\(storeScope, existingRecords\[0\]\.store_id\)/)
  assert.match(stockInRepository, /SELECT id, store_id FROM phones WHERE id = \? FOR UPDATE/)
  assert.match(stockInRepository, /UPDATE phones[\s\S]{0,180}WHERE \$\{scopeConditions\.join\(' AND '\)\}/)
  assert.match(stockInRepository, /DELETE FROM phones WHERE \$\{scopeConditions\.join\(' AND '\)\}/)
  assert.match(stockInRepository, /appendStoreScopeCondition\(storeScope, 'store_id', scopeConditions, scopeParams\)/)
  assert.match(stockInService, /await connection\.beginTransaction\(\)[\s\S]{0,300}this\.repository\.lockPhone\(connection, \[id\]\)/)
  assert.match(controller, /returnToStock\(id, operatorId, returnInfo, storeScope\)/)
  assert.match(repository, /SELECT status, store_id FROM phones WHERE id = \? FOR UPDATE/)
  assert.match(repository, /WHERE id = \? AND status IN \('sold', 'peer_transfer', 'supplier_proxy'\)/)
})

test('analytics requires backend permission and an authorized store scope', () => {
  const route = read('src/routes/analytics.js')
  const customerPage = read('../frontend/src/views/analytics/page/CustomerAnalytics.vue')
  const employeePage = read('../frontend/src/views/analytics/page/EmployeeAnalytics.vue')
  const salesPage = read('../frontend/src/views/analytics/page/SalesAnalytics.vue')
  const analyticsPage = read('../frontend/src/views/analytics/AnalyticsView.vue')
  const analyticsApi = read('../frontend/src/api/analytics.ts')

  assert.match(route, /router\.use\(unifiedAuth, requirePermission\('analytics:view'\), enforceAnalyticsStoreScope\)/)
  assert.match(route, /请选择授权门店后再查看分析数据/)
  assert.match(route, /router\.use\('\/customers', requirePermission\('customers:view'\)\)/)
  assert.match(route, /router\.use\('\/inventory', requirePermission\('inventory:view'\)\)/)
  assert.match(customerPage, /getCustomerSegments\(params\)/)
  assert.match(customerPage, /getCustomerActivity\(params\)/)
  assert.match(customerPage, /getCustomerDetail\(selectedCustomer\.value\.id, getStoreParams\(\)\)/)
  assert.match(employeePage, /getEmployeeRoles\(params\)/)
  assert.match(employeePage, /getEmployeeAttendance\(params\)/)
  assert.match(employeePage, /getSalesTrends\(\{[\s\S]*\.\.\.getStoreParams\(\)/)
  assert.match(salesPage, /sales-by-condition'[\s\S]*params/)
  assert.match(salesPage, /period: forecastPeriod\.value,[\s\S]*\.\.\.getStoreParams\(\)/)
  assert.match(analyticsPage, /getCachedStores\(true\)/)
  assert.match(analyticsApi, /getCustomerSegments\(params\?: \{[\s\S]*store_id\?: number/)
})

test('strict store options remain separate from inventory and sales store access', () => {
  const storesController = read('src/controllers/store.controller.js')
  const referenceOptions = read('../frontend/src/services/reference-options.ts')
  const queryController = read('src/controllers/query.controller.js')

  assert.match(storesController, /strict_scope/)
  assert.match(storesController, /if \(strictStoreScope && !this\.superAdminCheck\(req\.user\)\)/)
  assert.match(referenceOptions, /strictScope \? '\/stores\?all=true&strict_scope=true' : '\/stores\?all=true'/)
  assert.match(queryController, /storeIds: storeScope\.storeIds/)
  assert.match(queryController, /allStores: storeScope\.allStores/)
})
