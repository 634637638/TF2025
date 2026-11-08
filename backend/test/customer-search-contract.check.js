'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('customer remote search uses the shared service across business contexts', () => {
  const service = read('src/services/customer-search.service.js')
  assert.match(service, /LIMIT \$\{pageSize\} OFFSET \$\{offset\}/)
  assert.match(service, /total_pages/)
  assert.match(service, /has_next/)
  assert.match(service, /has_prev/)
  assert.match(service, /CUSTOMER_FIELDS/)

  const customerController = read('src/controllers/customer.controller.js')
  assert.match(customerController, /customer-search\.service/)
  assert.match(customerController, /this\.searchCustomers\(/)
  assert.match(read('src/routes/customers.js'), /customerController\.search\.bind\(customerController\)/)

  const salesRoute = read('src/routes/sales.js')
  const salesController = read('src/controllers/sales-customer-search.controller.js')
  assert.match(salesRoute, /salesCustomerSearchController\.search\.bind\(salesCustomerSearchController\)/)
  assert.match(salesController, /customer-search\.service/)
  assert.match(salesController, /this\.searchCustomers\(/)

  const rentalService = read('src/services/rental-customer.service.js')
  assert.match(rentalService, /customer-search\.service/)
  assert.match(rentalService, /customerSearch = searchCustomers/)
  assert.match(read('src/controllers/rental-customer.controller.js'), /this\.service\.search\(/)
  assert.match(read('src/routes/rentals.js'), /rentalCustomerController\.search\.bind\(rentalCustomerController\)/)

  const repairRoute = read('src/routes/repairs.js')
  const repairService = read('src/services/repair-lookup.service.js')
  assert.match(repairRoute, /customer-search\.service/)
  assert.match(repairRoute, /searchCustomers: searchCustomerOptions/)
  assert.match(repairService, /this\.searchCustomers\(/)
})

test('customer search enforces bounded server pagination and never exposes arbitrary SQL fields', () => {
  const service = read('src/services/customer-search.service.js')
  assert.match(service, /Math\.min\(100, Math\.max\(1/)
  assert.match(service, /CUSTOMER_FIELDS\.has\(order_by\)/)
  assert.match(service, /normalizeSearchFields/)
  assert.doesNotMatch(service, /SELECT \* FROM customers/)
})

test('customer search binds filters and emits only normalized integer pagination values', async () => {
  const calls = []
  const database = {
    async execute(sql, params) {
      calls.push({ sql, params })
      return calls.length === 1
        ? [[{ id: 12, name: '测试客户', phone: '13800138000' }]]
        : [[{ total: 1 }]]
    }
  }
  const databaseModule = require('../src/config/database')
  const originalGetDatabase = databaseModule.getDatabase
  databaseModule.getDatabase = () => database
  const servicePath = require.resolve('../src/services/customer-search.service')
  const originalService = require.cache[servicePath]
  delete require.cache[servicePath]
  try {
    const { searchCustomers, normalizePage, normalizePageSize, MAX_PAGE_NUMBER } = require('../src/services/customer-search.service')
    const result = await searchCustomers({
      keyword: '13800138000',
      page: 2,
      page_size: 50,
      search_fields: ['phone']
    })

    assert.match(calls[0].sql, /LIMIT 50 OFFSET 50$/)
    assert.deepEqual(calls[0].params, [1, '%13800138000%'])
    assert.deepEqual(calls[1].params, [1, '%13800138000%'])
    assert.equal(result.records.length, 1)
    assert.equal(normalizePage('999999999999999999999'), 1)
    assert.equal(normalizePage(MAX_PAGE_NUMBER + 1), MAX_PAGE_NUMBER)
    assert.equal(normalizePageSize(1000), 100)
  } finally {
    databaseModule.getDatabase = originalGetDatabase
    if (originalService) require.cache[servicePath] = originalService
    else delete require.cache[servicePath]
  }
})

test('paginated API responses expose only the canonical pagination contract', () => {
  const response = read('src/utils/response.js')
  assert.match(response, /page_size: pageSize/)
  assert.match(response, /total_pages: totalPages/)
  assert.match(response, /has_next:/)
  assert.match(response, /has_prev:/)
  assert.doesNotMatch(response, /pagination:\s*\{[\s\S]*\.\.\.pagination/)
})

test('reference option routes share pagination, stable ordering and sort_order fallback helpers', () => {
  const service = read('src/services/reference-options.service.js')
  assert.match(service, /normalizeReferencePagination/)
  assert.match(service, /buildReferenceOrder/)
  assert.match(service, /buildPagination/)
  for (const modulePath of [
    'src/controllers/color.controller.js',
    'src/controllers/memory.controller.js',
    'src/controllers/model.controller.js',
    'src/controllers/supplier.controller.js'
  ]) {
    const source = read(modulePath)
    assert.match(source, /reference-options\.service/)
    assert.match(source, /buildReferenceOrder/)
    assert.match(source, /buildPagination/)
  }
})
