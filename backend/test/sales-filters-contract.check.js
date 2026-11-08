const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('sales inventory list, export and stats share the service filter builder', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  const service = fs.readFileSync(path.join(__dirname, '../src/services/sales-available-phones.service.js'), 'utf8')
  const listStart = route.indexOf("router.get('/phones/available'")
  const exportStart = route.indexOf("router.get('/phones/available/export'")
  const statsStart = route.indexOf("router.get('/phones/available/stats'")
  const createSaleStart = route.indexOf("router.post('/phone'")
  const customerLookupStart = route.indexOf("router.get('/customer/phone/:phone'")

  assert.ok(listStart >= 0 && exportStart > listStart && createSaleStart > exportStart)

  const list = route.slice(listStart, exportStart)
  const exportRoute = route.slice(exportStart, createSaleStart)
  const statsRoute = route.slice(statsStart, customerLookupStart)

  assert.match(service, /preorderDeliveryPhoneId/)
  assert.match(service, /sale_status/)
  assert.match(service, /brand_id/)
  assert.match(service, /model_id/)
  assert.match(service, /color_id/)
  assert.match(service, /memory_id/)
  assert.match(list, /salesAvailablePhonesController\.getAvailablePhones\.bind\(salesAvailablePhonesController\)/)
  assert.match(exportRoute, /salesAvailablePhonesController\.exportAvailablePhones\.bind\(salesAvailablePhonesController\)/)
  assert.match(statsRoute, /salesAvailablePhonesController\.getStats\.bind\(salesAvailablePhonesController\)/)
  assert.doesNotMatch(statsRoute, /const whereConditions\s*=\s*\[COMPLETED_TRANSACTION_STATUS_SQL\]/)
  assert.doesNotMatch(list, /const whereConditions\s*=\s*\[COMPLETED_TRANSACTION_STATUS_SQL\]/)
})

test('sales available stats keep reference joins for text search filters', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  const statsStart = route.indexOf("router.get('/phones/available/stats'")
  const statsEnd = route.indexOf("router.get('/customer/phone/:phone'")
  assert.ok(statsStart >= 0 && statsEnd > statsStart)
  const repository = fs.readFileSync(path.join(__dirname, '../src/repositories/sales-available-phones.repository.js'), 'utf8')
  assert.match(repository, /const AVAILABLE_PHONE_REFERENCE_JOINS = `[^`]*LEFT JOIN brands b ON p\.brand_id = b\.id/)
  assert.equal((repository.match(/\$\{AVAILABLE_PHONE_REFERENCE_JOINS\}/g) || []).length, 5)
})

test('sales transaction initializes invoice sequence before beginTransaction', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  const service = fs.readFileSync(path.join(__dirname, '../src/services/sales-phone.service.js'), 'utf8')

  assert.match(route, /router\.post\('\/phone',[\s\S]*salesPhoneController\.sell\.bind/)
  assert.match(service, /await this\.prepareInvoiceTransaction\(connection\)\s+await connection\.beginTransaction\(\)/)
})

test('sales inventory summary and detail delegate to report controller and keep scope rules in service', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/sales-inventory-report.controller.js'), 'utf8')
  const service = fs.readFileSync(path.join(__dirname, '../src/services/sales-inventory-report.service.js'), 'utf8')
  const repository = fs.readFileSync(path.join(__dirname, '../src/repositories/sales-inventory-report.repository.js'), 'utf8')

  assert.match(route, /router\.get\('\/inventory-summary', unifiedAuth, requirePermission\('sales:view'\), salesInventoryReportController\.getSummary\.bind\(salesInventoryReportController\)\)/)
  assert.match(route, /router\.get\('\/inventory-detail', unifiedAuth, requirePermission\('sales:view'\), salesInventoryReportController\.getDetail\.bind\(salesInventoryReportController\)\)/)
  assert.match(controller, /开始日期不能晚于结束日期/)
  assert.match(controller, /门店编号无效/)
  assert.match(service, /DATE\(p\.inventory_time\) BETWEEN \? AND \?/)
  assert.match(service, /findExactId\(resource, value, brandId\)/)
  assert.match(service, /p\.\$\{field\}_id IS NULL/)
  assert.match(repository, /SELECT id FROM models WHERE name = \? AND brand_id = \? LIMIT 1/)
})

test('sales list and summary share exact reference resolution without redundant fuzzy lookups', () => {
  const availableRepository = fs.readFileSync(path.join(__dirname, '../src/repositories/sales-available-phones.repository.js'), 'utf8')
  const reportService = fs.readFileSync(path.join(__dirname, '../src/services/sales-inventory-report.service.js'), 'utf8')
  const reportRepository = fs.readFileSync(path.join(__dirname, '../src/repositories/sales-inventory-report.repository.js'), 'utf8')

  assert.match(reportRepository, /brand: 'SELECT id FROM brands WHERE LOWER\(TRIM\(name\)\) = LOWER\(\?\)'/)
  assert.match(reportRepository, /color: 'SELECT id FROM colors WHERE LOWER\(TRIM\(name\)\) = LOWER\(\?\)'/)
  assert.match(reportRepository, /memory: 'SELECT id FROM memories WHERE TRIM\(size\) = \?'/)
  assert.match(reportService, /for \(const \[field, resource, column\] of/)
  assert.match(reportService, /this\.repository\.findReferenceId\(resource, query\[field\]\)/)
  assert.match(availableRepository, /brand: 'SELECT id FROM brands WHERE LOWER\(TRIM\(name\)\) = LOWER\(\?\)'/)
  assert.match(reportRepository, /SELECT id FROM models WHERE name = \? AND brand_id = \? LIMIT 1/)
  assert.match(reportRepository, /SELECT id FROM memories WHERE size = \? LIMIT 1/)
})
