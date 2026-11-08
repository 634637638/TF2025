'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('employee role assignment delegates from the route and keeps its transaction in the repository', () => {
  const route = read('src/routes/employees.js')
  const repository = read('src/repositories/employee-role.repository.js')

  assert.match(route, /router\.post\('\/:id\/roles', unifiedAuth, requirePermission\('employee:edit'\), employeeRoleController\.assign\.bind\(employeeRoleController\)\)/)
  assert.match(repository, /async assignRoles\(employeeId, roleIds\)[\s\S]*beginTransaction\(\)[\s\S]*commit\(\)[\s\S]*rollback\(\)/)
  assert.match(repository, /roleIds\.map\(\(\) => '\(\?, \?, NOW\(\)\)'\)/)
  assert.match(repository, /roleIds\.flatMap\(roleId => \[employeeId, roleId\]\)/)
})

test('permission-management role assignment delegates to controller and select-all preserves service boundary', () => {
  const source = read('src/routes/permission-management.js')
  const handlerStart = source.indexOf("router.put('/roles/:id/permissions/select-all'")
  const handler = source.slice(handlerStart, source.indexOf('\n', handlerStart))
  const controller = read('src/controllers/role-permissions.controller.js')
  const service = read('src/services/role-permissions.service.js')
  const repository = read('src/repositories/role-permissions.repository.js')

  assert.match(handler, /rolePermissionsController\.selectAllActionPermissions\.bind\(rolePermissionsController\)/)
  assert.match(controller, /this\.service\.selectAllActionPermissions\(req\.params\.id, req\)/)
  assert.match(service, /this\.repository\.replaceActionPermissions\(database, roleId, permissions\)/)
  assert.match(repository, /async replaceActionPermissions\(database, roleId, permissions\)/)
  assert.doesNotMatch(handler, /getConnection|execute\(|beginTransaction|commit\(|rollback\(/)
})

test('phone statuses normalize aliases centrally and preserve the canonical in_stock value', async () => {
  const phoneStatus = require('../src/utils/phone-status')
  const QueryService = require('../src/services/query.service')
  const inventoryRepository = read('src/repositories/inventory.repository.js')
  const phonesRoute = read('src/services/phone-update.service.js')
  const phoneInventoryRepository = read('src/repositories/phone-inventory-query.repository.js')
  const queryRepository = read('src/repositories/query.repository.js')
  const queryService = read('src/services/query.service.js')
  const databaseSync = read('src/services/database-sync.service.js')
  const localToCloudSync = read('src/services/local-to-cloud-sync.service.js')

  assert.equal(phoneStatus.normalizePhoneStatus(' AVAILABLE '), 'in_stock')
  assert.equal(phoneStatus.normalizePhoneStatus('Available'), 'in_stock')
  assert.equal(phoneStatus.normalizePhoneStatus('可用'), 'in_stock')
  assert.equal(phoneStatus.normalizePhoneStatus('可售'), 'in_stock')
  assert.equal(phoneStatus.normalizePhoneStatus('零售'), 'sold')
  assert.equal(phoneStatus.normalizePhoneStatus('toString'), 'toString')
  assert.equal(phoneStatus.isPhoneStatusAlias('AVAILABLE'), true)
  assert.equal(phoneStatus.isSellablePhoneStatus('available'), true)
  assert.equal(phoneStatus.getEffectivePhoneStatus('available', 1), 'reserved')
  assert.match(phoneStatus.getEffectivePhoneStatusSql('p'), /LOWER\(TRIM\(COALESCE\(p\.status, ''\)\)\) = 'available'/)
  const queryServiceInstance = new QueryService()
  assert.doesNotThrow(() => queryServiceInstance.validateQueryFilters({ status: 'available' }))
  assert.doesNotThrow(() => queryServiceInstance.validateQueryFilters({ status: '可用' }))

  for (const source of [inventoryRepository, phoneInventoryRepository]) {
    assert.match(source, /isPhoneStatusAlias\(searchStr\)/)
    assert.match(source, /normalizePhoneStatus\(searchStr\)/)
    assert.doesNotMatch(source, /searchStr\.toLowerCase\(\)\s*===\s*'available'/)
  }
  assert.match(queryRepository, /normalizePhoneStatus\(status\)/)
  assert.match(queryService, /normalizePhoneStatus\(raw\)/)
  assert.match(phonesRoute, /const effectiveStatus = normalizePhoneStatus\(valueOrCurrent\(status, currentPhone\.status\)\)/)
  assert.match(phonesRoute, /updateValues\.push\(effectiveStatus\)/)
  assert.match(databaseSync, /targetRow\[field\] = normalizePhoneStatus\(targetRow\[field\]\)/)
  assert.match(localToCloudSync, /status: normalizePhoneStatus\(/)

  const frontendStatuses = fs.readFileSync(path.join(root, '../frontend/src/constants/phoneStatuses.ts'), 'utf8')
  assert.match(frontendStatuses, /available:\s*'in_stock'/)
  assert.match(frontendStatuses, /PHONE_STATUS_ALIASES\[raw\.toLowerCase\(\)\]/)
})

test('permission management role and user lists use bounded server-side search and pagination', () => {
  const route = read('src/routes/permission-management.js')
  const controller = read('src/controllers/user-roles.controller.js')
  const service = read('src/services/user-roles.service.js')
  const repository = read('src/repositories/user-roles.repository.js')
  const userListRoute = read('src/controllers/permission-users-list.controller.js')
  const userListService = read('src/services/permission-users-list.service.js')
  const userListRepository = read('src/repositories/permission-users-list.repository.js')
  const rolesStart = route.indexOf("router.get('/roles'")
  const usersStart = route.indexOf("router.get('/users-with-roles'")
  const usersEnd = route.indexOf("router.post('/roles'")
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/permissions/PermissionsView.vue'), 'utf8')

  assert.ok(rolesStart >= 0 && usersStart > rolesStart, '权限角色列表路由不存在')
  assert.ok(usersEnd > usersStart, '权限用户列表路由不存在')
  assert.match(route.slice(rolesStart, usersStart), /userRolesController\.listRoles\.bind\(userRolesController\)/)
  assert.match(controller, /PERMISSION_LIST_DEFAULT_PAGE_SIZE/)
  assert.match(controller, /Math\.min\(normalizedLimit, PERMISSION_LIST_MAX_PAGE_SIZE\)/)
  assert.match(service, /inspectColumn\('roles', 'code'\)/)
  assert.match(service, /inspectColumn\('roles', 'is_active'\)/)
  assert.match(repository, /COUNT\(\*\) as total/)
  assert.match(repository, /LIMIT \? OFFSET \?/)
  assert.match(repository, /\.\.\.roleParams, pageSize, offset/)
  assert.match(repository, /r\.name LIKE \?/)
  assert.doesNotMatch(repository, /Math\.min\(normalizedLimit, 10000\)|:\s*10000/)
  assert.match(route.slice(usersStart, usersEnd), /permissionUsersListController\.list\.bind\(permissionUsersListController\)/)
  assert.match(userListRoute, /this\.service\.list\(req\.query\)/)
  assert.match(userListService, /PERMISSION_LIST_MAX_PAGE_SIZE/)
  assert.match(userListRepository, /u\.username LIKE \?/)
  assert.match(userListRepository, /u\.name LIKE \?/)
  assert.match(userListRepository, /u\.email LIKE \?/)
  assert.match(userListRepository, /EXISTS \(SELECT 1 FROM user_roles filter_ur/)
  assert.match(userListRepository, /GROUP_CONCAT\(r\.id SEPARATOR ','\) as role_ids/)
  assert.match(userListRepository, /EXISTS \(SELECT 1 FROM user_stores filter_us/)
  assert.match(userListRepository, /LIMIT \? OFFSET \?/)
  assert.match(view, /loadRoleOptions/)
  assert.match(view, /page_size:\s*storeBindingsPagination\.page_size/)
  assert.match(view, /role_ids/)
})

test('sales trend route keeps only the canonical path', () => {
  const source = read('src/routes/analytics.js')
  const controller = read('src/controllers/analytics-sales-trend.controller.js')
  const service = read('src/services/analytics-sales-trend.service.js')
  const repository = read('src/repositories/analytics-sales-trend.repository.js')
  assert.match(source, /router\.get\(['"]\/sales\/trends['"], unifiedAuth, requireBusinessUser, analyticsSalesTrendController\.getSalesTrends\.bind\(analyticsSalesTrendController\)\)/)
  assert.doesNotMatch(source, /router\.get\(\s*['"]\/sales-trends['"]/)
  assert.match(controller, /this\.service\.getSalesTrends\(/)
  assert.match(service, /VALID_PERIODS/)
  assert.match(repository, /FROM sales s[\s\S]*INNER JOIN phones p/)
})

test('sales inventory checks lock rows and allow only valid stock or preorder deliveries', () => {
  const route = read('src/routes/sales.js')
  const controller = read('src/controllers/sales-phone.controller.js')
  const service = read('src/services/sales-phone.service.js')
  const repository = read('src/repositories/sales-phone.repository.js')

  assert.match(route, /router\.post\('\/phone', unifiedAuth, requireAnyPermission\(\['sales:sell', 'inventory:sell'\]\), salesPhoneController\.sell\.bind\(salesPhoneController\)\)/)
  assert.match(controller, /this\.service\.sell\(/)
  assert.match(service, /findPhonesForSale\(connection, phoneIds\)/)
  assert.match(service, /phone\.status !== 'in_stock' && !isReservedDelivery/)
  assert.match(service, /预定客户或交付设备与预定单不一致/)
  assert.match(service, /beginTransaction\(\)/)
  assert.match(service, /commit\(\)/)
  assert.match(service, /rollback\(\)/)
  assert.match(repository, /WHERE p\.id IN \(\$\{placeholders\}\)[\s\S]*FOR UPDATE/)
  assert.match(repository, /WHERE id = \? AND status IN \('in_stock', 'reserved'\)/)
})

test('available sales inventory uses bounded canonical pagination and safe errors', () => {
  const route = read('src/routes/sales.js')
  const controller = read('src/controllers/sales-available-phones.controller.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/sales/SalesView.vue'), 'utf8')
  const start = route.indexOf("router.get('/phones/available'")
  const end = route.indexOf("router.get('/phones/available/export'")
  const handler = route.slice(start, end > start ? end : undefined)

  assert.match(handler, /salesAvailablePhonesController\.getAvailablePhones\.bind\(salesAvailablePhonesController\)/)
  assert.match(controller, /page_size/)
  assert.match(controller, /String\(page_size \?\? 100\)/)
  assert.doesNotMatch(controller, /legacyLimit|req\.query\.limit|limit:/)
  assert.match(controller, /requestedPageSize < 1 \|\| requestedPageSize > 500/)
  assert.match(controller, /page_size: requestedPageSize/)
  assert.match(controller, /total_pages:/)
  assert.match(controller, /has_next:/)
  assert.match(controller, /ApiResponse\.serverError\(res, '获取可销售设备列表失败', error\)/)
  assert.match(view, /params\.page_size = pagination\.page_size/)
  assert.doesNotMatch(view, /params\.limit = pagination\./)
})

test('sales inventory detail uses canonical page_size and inventory_time', () => {
  const route = read('src/routes/sales.js')
  const controller = read('src/controllers/sales-inventory-report.controller.js')
  const repository = read('src/repositories/sales-inventory-report.repository.js')

  assert.match(route, /router\.get\('\/inventory-detail', unifiedAuth, requirePermission\('sales:view'\), salesInventoryReportController\.getDetail\.bind\(salesInventoryReportController\)\)/)
  assert.match(controller, /req\.query\.page_size \?\? 500/)
  assert.doesNotMatch(controller, /legacyLimit|req\.query\.limit|limit:/)
  assert.match(controller, /pageSize < 1 \|\| pageSize > 500/)
  assert.match(repository, /p\.inventory_time AS inventory_time/)
  assert.match(repository, /LIMIT \?/)
  assert.match(controller, /ApiResponse\.serverError\(res, '获取库存明细失败', error\)/)
})

test('sales inventory summary validates canonical date and store filters', () => {
  const route = read('src/routes/sales.js')
  const controller = read('src/controllers/sales-inventory-report.controller.js')

  assert.match(route, /router\.get\('\/inventory-summary', unifiedAuth, requirePermission\('sales:view'\), salesInventoryReportController\.getSummary\.bind\(salesInventoryReportController\)\)/)
  assert.match(controller, /start_date: startDate/)
  assert.match(controller, /end_date: endDate/)
  assert.match(controller, /String\(startDate \?\? ''\)/)
  assert.match(controller, /String\(endDate \?\? ''\)/)
  assert.doesNotMatch(controller, /legacyDateStart|legacyDateEnd|date_start:|date_end:/)
  assert.match(controller, /Number\(String\(storeId\)\)/)
  assert.match(controller, /开始日期不能晚于结束日期/)
  assert.match(controller, /ApiResponse\.serverError\(res, '获取库存统计失败', error\)/)
})

test('high-value customer report uses a compatible read query', () => {
  const route = read('src/routes/analytics.js')
  const repository = read('src/repositories/analytics-high-value-customers.repository.js')

  assert.match(route, /router\.get\('\/customers\/high-value', unifiedAuth, requireBusinessUser, analyticsHighValueCustomersController\.list\.bind\(analyticsHighValueCustomersController\)\)/)
  assert.match(repository, /db\.query\(customersQuery, params\)/)
  assert.match(repository, /db\.query\(countQuery, params\)/)
})

test('rate-limit audit creates its table idempotently', () => {
  const source = read('src/middleware/rate-limit.js')
  const appSource = read('src/app.js')
  assert.match(source, /CREATE TABLE IF NOT EXISTS rate_limit_logs/)
  assert.match(source, /ensureRateLimitLogTable\(database\)/)
  assert.match(appSource, /await ensureRateLimitLogTable\(getDatabase\(\)\)/)
})

test('phone update contract exposes canonical time and cost fields', () => {
  const source = read('src/routes/phones.js')
  const updateService = read('src/services/phone-update.service.js')
  const service = read('src/services/phone-inventory-query.service.js')
  const editModal = fs.readFileSync(path.join(root, '../frontend/src/components/query/QueryEditModal.vue'), 'utf8')
  assert.match(updateService, /inventory_time/)
  assert.match(updateService, /sale_time/)
  assert.match(updateService, /purchase_cost/)
  assert.match(service, /inventory_time: phone\.inventory_time \|\| null/)
  assert.match(service, /sale_time: phone\.sale_time \|\| null/)
  assert.doesNotMatch(source, /\bInventorytime\b|\bsalestime\b|\bstock_in_date\b/)
  assert.match(editModal, /formData\.purchase_cost/)
  assert.match(editModal, /formData\.inventory_time/)
  assert.match(editModal, /formData\.sale_time/)
  assert.doesNotMatch(editModal, /formData\.purchase_price/)
  assert.doesNotMatch(editModal, /formData\.Inventorytime/)
  assert.doesNotMatch(editModal, /formData\.salestime/)
})

test('phone edits require canonical database IDs', () => {
  const source = read('src/routes/phones.js')
  const handler = read('src/services/phone-update.service.js')

  assert.match(source, /phoneUpdateController\.update\.bind\(phoneUpdateController\)/)
  assert.match(handler, /const effectiveBrandId = valueOrCurrent\(brand_id, currentPhone\.brand_id\)/)
  assert.match(handler, /const effectiveModelId = valueOrCurrent\(model_id, currentPhone\.model_id\)/)
  assert.match(handler, /const effectiveColorId = valueOrCurrent\(color_id, currentPhone\.color_id\)/)
  assert.match(handler, /const effectiveMemoryId = valueOrCurrent\(memory_id, currentPhone\.memory_id\)/)
  assert.match(handler, /const brandId = Number\(effectiveBrandId\)/)
  assert.match(handler, /const modelId = Number\(effectiveModelId\)/)
  assert.match(handler, /const colorId = Number\(effectiveColorId\)/)
  assert.match(handler, /const memoryId = Number\(effectiveMemoryId\)/)
  assert.match(handler, /every\(Number\.isInteger\)/)
  assert.match(handler, /effectiveStatus === 'rented'[\s\S]{0,180}请在租赁管理创建按天租赁合同/)
  assert.match(handler, /normalizePhoneStatus\(currentPhone\.status\) === 'rented'[\s\S]{0,180}租赁管理完成归还/)
  assert.doesNotMatch(handler, /SELECT id FROM (?:brands|models|colors|memories) WHERE (?:name|size) = \?/)
})

test('rental contract mode drives the phone status and buyout sale record', () => {
  const route = read('src/routes/rentals.js')
  const service = read('src/services/rental-create.service.js')
  const repository = read('src/repositories/rental-create.repository.js')

  assert.match(route, /router\.post\('\/', requirePermission\('rentals:create'\), rejectHiddenRentalWriteFields, rentalCreateController\.create\.bind\(rentalCreateController\)\)/)
  assert.match(service, /if \(buyout\)/)
  assert.match(service, /reconcilePoints\(/)
  assert.match(service, /markPhoneRented\(connection, phoneId\)/)
  assert.match(repository, /INSERT INTO sales[\s\S]{0,800}'retail'/)
  assert.match(repository, /status=\\?'sold/)
  assert.match(repository, /status='rented'/)
})

test('stock-in accepts only canonical inventory fields', () => {
  const route = read('src/routes/stock-in.js')
  const controller = read('src/controllers/stock-in.controller.js')
  const service = read('src/services/stock-in.service.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/helpers.ts'), 'utf8')
  const payloadBuilder = frontend.slice(frontend.indexOf('export const buildStockInSubmitPayload'))
  assert.match(route, /router\.post\('\/', unifiedAuth, requireAnyPermission\(\['stock-in:create', 'inventory:create'\]\), stockInController\.create\.bind\(stockInController\)\)/)
  assert.match(controller, /async create\(req, res\)/)
  assert.match(service, /const inventoryTime = inventory_time/)
  assert.match(service, /const finalRemarks = remarks \?\? ''/)
  assert.match(service, /total_amount: products\.reduce\([\s\S]*product\.purchase_cost/)
  assert.match(service, /inventory_time: inventoryTime/)
  assert.match(service, /operator_name: actualOperatorName/)
  assert.match(service, /is_new: condition === '全新' \? 1 : 0/)
  assert.match(service, /product\.is_new\]\)/)
  assert.doesNotMatch(service, /stock_in_date|purchase_price|\bnotes\b|\n\s+actualOperatorName,/)
  assert.match(payloadBuilder, /inventory_time: formData\.inventory_time/)
  assert.match(payloadBuilder, /purchase_cost: phone\.purchase_cost/)
  assert.match(payloadBuilder, /remarks: formData\.remarks/)
  assert.doesNotMatch(payloadBuilder, /stock_in_date:/)
  assert.doesNotMatch(payloadBuilder, /purchase_price:/)
  assert.doesNotMatch(payloadBuilder, /notes:\s*formData\.remarks/)
})

test('stock-in page uses canonical cost and inventory time fields', () => {
  const helpers = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/helpers.ts'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/types.ts'), 'utf8')
  const basic = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/StockInBasicInfoSection.vue'), 'utf8')
  const list = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/StockInPhoneListSection.vue'), 'utf8')
  const modal = fs.readFileSync(path.join(root, '../frontend/src/components/StockInModal.vue'), 'utf8')

  for (const source of [helpers, types, basic, list, modal]) {
    assert.doesNotMatch(source, /purchase_price/)
    assert.doesNotMatch(source, /stock_in_date/)
    assert.doesNotMatch(source, /Inventorytime/)
  }
  assert.match(helpers, /purchase_cost/)
  assert.match(helpers, /inventory_time/)
  assert.match(list, /phones\.\$\{index\}\.purchase_cost/)
  assert.match(basic, /formData\.inventory_time/)
})

test('rental API enforces canonical payload and field-permission contracts', () => {
  const source = read('src/routes/rentals.js')
  const rentalListService = read('src/services/rental-list.service.js')
  const rentalFinishService = read('src/services/rental-finish.service.js')
  const rentalFinishRepository = read('src/repositories/rental-finish.repository.js')
  const rentalUpdateService = read('src/services/rental-update.service.js')
  const rentalUpdateRepository = read('src/repositories/rental-update.repository.js')
  const rentalCreateService = read('src/services/rental-create.service.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/rentals/rental-payload.ts'), 'utf8')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/rentals/RentalsView.vue'), 'utf8')
  const fieldPermissions = fs.readFileSync(path.join(root, '../frontend/src/views/rentals/rental-field-permissions.ts'), 'utf8')
  const moduleFields = fs.readFileSync(path.join(root, '../frontend/src/config/moduleFields.js'), 'utf8')
  for (const field of ['customer_id', 'phone_id', 'billing_mode', 'sale_price', 'start_date', 'remarks']) {
    assert.match(frontend, new RegExp(`${field}:`), `租赁 payload 缺少 ${field}`)
  }
  assert.match(source, /router\.post\('\/'/)
  assert.match(source, /rentalCreateController\.create\.bind\(rentalCreateController\)/)
  assert.match(rentalCreateService, /const billingMode = body\.billing_mode/)
  assert.match(rentalCreateService, /const salePrice = Number\(body\.sale_price/)
  assert.match(rentalCreateService, /const startDate = String\(body\.start_date/)
  assert.match(source, /RENTAL_FIELD_MODULE_KEY = 'rentals_rentalsview'/)
  assert.match(source, /rejectHiddenRentalWriteFields/)
  assert.match(source, /router\.get\('\/', requirePermission\('rentals:view'\), rentalListController\.list\.bind\(rentalListController\)\)/)
  assert.match(source, /router\.put\('\/:id', requirePermission\('rentals:edit'\), rejectHiddenRentalWriteFields, rentalUpdateController\.update\.bind\(rentalUpdateController\)\)/)
  assert.match(rentalUpdateService, /this\.repository\.updateRental\(connection, id, rentalUpdates, rentalParams\)/)
  assert.match(rentalUpdateRepository, /assignments\.join\(','\)/)
  assert.match(rentalListService, /this\.masking\.filterSensitiveFields\(rows, permissions\)/)
  assert.match(rentalListService, /query\.page_size/)
  assert.match(rentalListService, /total_pages: totalPages/)
  assert.match(rentalListService, /has_next: page < totalPages/)
  assert.match(rentalListService, /has_prev: page > 1/)
  assert.doesNotMatch(source, /SELECT \* FROM rentals/)
  assert.match(source, /router\.post\('\/:id\/finish',[\s\S]*rentalFinishController\.finish\.bind/)
  assert.match(rentalFinishService, /beginTransaction\(\)[\s\S]*commit\(\)[\s\S]*rollback\(\)/)
  assert.match(rentalFinishRepository, /SELECT id,status,billing_mode,phone_id,unit_price,start_date[\s\S]*FOR UPDATE/)
  assert.doesNotMatch(source, /req\.query\.limit|hasMore|pagination: \{ page, limit/)
  assert.match(view, /pickVisibleRentalFields\(rawPayload,rentalPayloadFieldMap\)/)
  assert.match(view, /v-model:page-size="pagination\.page_size"/)
  assert.match(view, /showPaymentColumn/)
  assert.match(view, /showStatusColumn/)
  assert.match(fieldPermissions, /purchase_cost: 'price_info\.purchase_cost'/)
  assert.match(moduleFields, /id: 'price_info\.purchase_cost', name: '入库价格'/)
})

test('quick-sale accepts canonical IDs, prices, times and operator fields', () => {
  const route = read('src/routes/inventory.js')
  const service = read('src/services/inventory.service.js')
  const repository = read('src/repositories/inventory.repository.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/components/query/quick-sale/helpers.ts'), 'utf8')
  const modal = fs.readFileSync(path.join(root, '../frontend/src/components/query/QuickSaleModal.vue'), 'utf8')
  const queryView = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8')
  const payload = frontend.slice(frontend.indexOf('export const buildQuickSaleSubmitPayload'))

  for (const field of ['brand_id', 'model_id', 'color_id', 'memory_id', 'purchase_cost', 'inventory_time', 'sale_time', 'sale_operator_id']) {
    assert.match(payload, new RegExp(`${field}:`), `快速出库 payload 缺少 ${field}`)
  }
  assert.doesNotMatch(service, /purchase_price|stock_in_date|customer_idcard/)
  assert.match(service, /Number\.isInteger\(id\)/)
  assert.match(service, /normalizeDateTime\(inventory_time, false\)/)
  assert.match(service, /normalizeDateTime\(sale_time, false\)/)
  assert.match(service, /purchaseCost, salePrice/)
  assert.doesNotMatch(service, /purchaseCost \|\||salePrice \|\||sale_price \|\| 0/)
  assert.match(service, /apple_id/)
  assert.match(service, /payment_channel/)
  assert.match(service, /generateInvoiceNumber\(transactionConfig\.invoiceType, connection, saleTime\)/)
  assert.match(service, /invoice_number/)
  assert.match(repository, /async createQuickSalePhone\(/)
  assert.match(repository, /async createQuickSale\(/)
  assert.match(route, /router\.post\('\/quick-sale', unifiedAuth, requireQuickSalePermission, inventoryController\.quickSale\.bind\(inventoryController\)\)/)
  assert.match(frontend, /purchase_cost:/)
  assert.match(frontend, /inventory_time:/)
  assert.match(frontend, /sale_time:/)
  assert.doesNotMatch(frontend, /purchase_price/)
  assert.doesNotMatch(frontend, /stock_in_date/)
  assert.doesNotMatch(frontend, /sale_date/)
  assert.match(frontend, /payment_channel:/)
  assert.match(modal, /:value="brand\.id"/)
  assert.match(modal, /:value="model\.id"/)
  assert.match(modal, /:value="color\.id"/)
  assert.match(modal, /:value="memory\.id"/)
  assert.doesNotMatch(queryView, /editModalOptions\.brands = \['Apple'/)
})

test('historical sale invoice backfill is preview-first, transactional and idempotent', () => {
  const script = read('scripts/backfill-sale-invoice-numbers.js')
  const packageJson = JSON.parse(read('../backend/package.json'))

  assert.match(script, /const applyChanges = process\.argv\.includes\('--apply'\)/)
  assert.match(script, /if \(!applyChanges\)/)
  assert.match(script, /ORDER BY sale_time, id\s+FOR UPDATE/)
  assert.match(script, /generateInvoiceNumber\(/)
  assert.match(script, /SET invoice_number = \?/)
  assert.match(script, /remaining_missing_invoice_count/)
  assert.equal(packageJson.scripts['backfill:sale-invoice-numbers'], 'node scripts/backfill-sale-invoice-numbers.js')
})

test('field contract registry has an auditable source mapping for every module', () => {
  const contractPath = path.resolve(root, '../config/field-contracts.json')
  const registry = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  const contracts = registry.contracts || {}
  const requiredModules = [
    'preorders',
    'repairs',
    'phones',
    'stock-in',
    'rentals',
    'quick-sale',
    'wholesale-transfer',
    'accessories',
    'salary-records',
    'analytics',
    'data-import',
    'query',
    'sales',
    'customers',
    'h5-sold-products',
    'h5-customer-sales',
    'dashboard-warnings'
  ]

  for (const moduleName of requiredModules) {
    assert.ok(contracts[moduleName], `缺少 ${moduleName} 字段契约`)
    assert.ok(Array.isArray(contracts[moduleName].canonical), `${moduleName} canonical 未登记`)
    assert.ok(Array.isArray(registry.auditSources?.[moduleName]), `${moduleName} 审计源文件未登记`)
    assert.ok(registry.auditSources[moduleName].length > 0, `${moduleName} 审计源文件为空`)
  }
  assert.equal(registry.version, 1)
  assert.match(registry.policy, /canonical/)
})

test('query module uses canonical page_size and safe controller errors', () => {
  const controller = read('src/controllers/query.controller.js')
  const service = read('src/services/query.service.js')
  const repository = read('src/repositories/query.repository.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8')

  assert.match(service, /page_size: parseInt\(processArrayParam\(filters\.page_size\)\)/)
  assert.match(service, /const pageSize = filters\.page_size/)
  assert.match(repository, /parseInt\(page_size, 10/)
  assert.match(repository, /page_size: normalizedLimit/)
  assert.doesNotMatch(service, /filters\.limit/)
  assert.doesNotMatch(repository, /filters\.limit|page_size \?\? limit/)
  assert.match(controller, /ApiResponse\.serverError\(res, '综合查询失败', error\)/)
  assert.match(controller, /page_size: PAGINATION\.DEFAULT_LIMIT/)
  assert.match(frontend, /page_size: 100/)
  assert.match(frontend, /getCachedQueryOptions/)
  assert.match(frontend, /if \(employeesPromise\.value\)/)
  assert.match(frontend, /employeesPromise\.value = \(async \(\) =>/)
  assert.doesNotMatch(frontend, /page_size[=:]\s*10000/)
  assert.doesNotMatch(frontend, /brands: \['Apple'/)
})

test('comprehensive query list defaults to completed sales while statistics also include sellable stock', () => {
  const repository = read('src/repositories/query.repository.js')
  const listStart = repository.indexOf('async getComprehensivePhoneQuery')
  const statisticsStart = repository.indexOf('async getQueryStatistics')
  const returnGoodsStart = repository.indexOf('async getReturnGoodsRecords')
  const list = repository.slice(listStart, statisticsStart)
  const statistics = repository.slice(statisticsStart, returnGoodsStart)

  assert.match(list, /whereParams\.push\(\.\.\.COMPLETED_TRANSACTION_STATUSES\)/)
  assert.doesNotMatch(list, /QUERY_STATS_DEFAULT_STATUSES/)
  assert.match(statistics, /QUERY_STATS_DEFAULT_STATUSES/)
  assert.match(repository, /\.\.\.COMPLETED_TRANSACTION_STATUSES,[\s\S]{0,40}'in_stock'/)
  assert.match(statistics, /SUM\(CASE WHEN \$\{effectiveStatusSql\} = 'in_stock' THEN 1 ELSE 0 END\) as in_stock_count/)
  assert.match(statistics, /store_ids[\s\S]{0,350}COALESCE\(latest_sale\.store_id, p\.store_id\)/)
})

test('comprehensive query accepts rented status in the validated status filter', () => {
  const serviceSource = read('src/services/query.service.js')
  const serviceModule = require('../src/services/query.service')
  const service = new serviceModule()

  assert.match(serviceSource, /validStatuses = \[[^\]]*'rented'/)
  assert.doesNotThrow(() => service.validateQueryFilters({ status: 'rented' }))
  assert.throws(() => service.validateQueryFilters({ status: 'unknown_status' }), /状态参数无效/)
})

test('accessory writes use an explicit canonical payload', () => {
  const controller = read('src/controllers/accessory.controller.js')
  const payload = fs.readFileSync(path.join(root, '../frontend/src/components/accessory-payload.ts'), 'utf8')
  assert.match(controller, /async stockIn\(req, res\)[\s\S]*?normalizeAccessoryPayload\(req\.body\)/)
  assert.match(controller, /async sell\(req, res\)[\s\S]*?accessory_id: req\.body\.accessory_id/)
  assert.doesNotMatch(controller, /\.\.\.req\.body/)
  for (const field of ['purchase_cost', 'sale_price', 'total_quantity', 'distribution', 'remarks']) {
    assert.match(payload, new RegExp(`${field}:`), `配件 payload 缺少 ${field}`)
  }
  assert.match(controller, /purchase_cost: body\.purchase_cost/)
  assert.match(controller, /sale_price: body\.sale_price/)
  assert.doesNotMatch(controller, /purchase_price|selling_price/)
  assert.match(read('src/repositories/accessory.repository.js'), /a\.purchase_cost/)
  assert.match(read('src/repositories/accessory.repository.js'), /a\.sale_price/)
  assert.doesNotMatch(read('src/repositories/accessory.repository.js'), /SELECT\s+ast\.\*/)
})

test('accessory field controls cover reads, filters and writes', () => {
  const route = read('src/routes/accessories.js')
  const controller = read('src/controllers/accessory.controller.js')
  const fields = fs.readFileSync(path.join(root, '../frontend/src/config/moduleFields.js'), 'utf8')
  const helper = fs.readFileSync(path.join(root, '../frontend/src/components/accessory-field-permissions.ts'), 'utf8')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/accessories/AccessoriesView.vue'), 'utf8')
  const form = fs.readFileSync(path.join(root, '../frontend/src/components/AccessoryStockInModal.vue'), 'utf8')

  assert.match(route, /ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'/)
  assert.match(route, /rejectHiddenAccessoryWrites/)
  assert.match(route, /rejectHiddenAccessorySellWrites/)
  assert.match(route, /rejectHiddenAccessoryQueries/)
  assert.match(route, /code: 'FIELD_PERMISSION_DENIED'/)
  assert.match(controller, /maskPayload\(/)
  assert.match(controller, /search_fields: searchFields/)
  assert.match(helper, /pickVisibleAccessoryFields/)
  assert.match(form, /pickVisibleAccessoryFields\(buildAccessoryStockInPayload/)
  assert.match(view, /canViewAccessoryField\('profit'\)/)
  assert.match(view, /canViewAccessoryField\('remaining_stock'\)/)
  for (const fieldId of ['price_info.profit', 'stock_info.remaining_stock', 'stock_info.distribution', 'system_info.operations']) {
    assert.match(fields, new RegExp(fieldId.replace('.', '\\.')))
  }
})

test('wholesale transfer accepts canonical sale_time only', () => {
  const controller = read('src/controllers/transfer.controller.js')
  const service = read('src/services/transfer.service.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/helpers.ts'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/types.ts'), 'utf8')

  assert.match(controller, /sale_time[\s\S]*this\.transferService\.wholesaleToPeer/)
  assert.doesNotMatch(controller, /sale_date|normalizedSaleTime/)
  assert.match(service, /normalizeDateTime\(sale_time, true\)/)
  assert.match(frontend, /payload\.sale_time = options\.formData\.sale_time/)
  assert.doesNotMatch(frontend, /payload\.sale_date/)
  assert.doesNotMatch(types, /sale_date\??:/)
})

test('sale and transfer flows preserve inventory remarks when no new remark is provided', () => {
  const salesRoute = read('src/routes/sales.js')
  const salesService = read('src/services/sales-phone.service.js')
  const salesRepository = read('src/repositories/sales-phone.repository.js')
  const transferService = read('src/services/transfer.service.js')
  assert.match(salesRoute, /router\.post\('\/phone',[\s\S]*salesPhoneController\.sell\.bind/)
  assert.match(salesService, /final_remarks:/)
  assert.match(salesRepository, /remarks = \?/)
  assert.match(salesRepository, /values\.remarks/)
  assert.doesNotMatch(salesRepository, /remarks\s*=\s*COALESCE\(NULLIF\(TRIM\(\?\), ''\), remarks\)/)
  assert.match(transferService, /status = 'peer_transfer',[\s\S]*remarks\s*=\s*COALESCE\(NULLIF\(TRIM\(\?\), ''\), remarks\)/)
  assert.match(transferService, /status = 'supplier_proxy',[\s\S]*remarks\s*=\s*COALESCE\(NULLIF\(TRIM\(\?\), ''\), remarks\)/)
})

test('wholesale transfer zeroes proxy amounts and rolls back each failed phone', () => {
  const service = read('src/services/transfer.service.js')
  const migration = fs.readFileSync(path.join(root, 'scripts/zero-supplier-proxy-amounts.js'), 'utf8')
  const proxyStart = service.indexOf('async proxyTransferForSupplier')
  const recordsStart = service.indexOf('async getWholesaleRecords')
  const proxyMethod = service.slice(proxyStart, recordsStart)

  assert.ok(proxyStart >= 0 && recordsStart > proxyStart)
  assert.match(proxyMethod, /const proxy_price = 0/)
  assert.match(proxyMethod, /const final_purchase_cost = 0/)
  assert.match(proxyMethod, /status = 'supplier_proxy',[\s\S]*purchase_cost = \?[\s\S]*sale_price = \?[\s\S]*wholesale_price = \?/)
  assert.doesNotMatch(proxyMethod, /phone\.purchase_cost|requested_proxy_price/)
  assert.match(proxyMethod, /SAVEPOINT proxy_phone/)
  assert.match(proxyMethod, /ROLLBACK TO SAVEPOINT proxy_phone/)
  assert.match(service, /FOR UPDATE/)
  assert.doesNotMatch(service, /proxy_supplier_id/)
  assert.match(migration, /beginTransaction\(\)/)
  assert.match(migration, /WHERE status = 'supplier_proxy'/)
  assert.match(migration, /WHERE sale_type = 'supplier_proxy'/)
  assert.match(migration, /SET purchase_cost = 0,[\s\S]*sale_price = 0,[\s\S]*wholesale_price = 0/)
  assert.match(migration, /assertZeroed\(after\)/)
  assert.match(migration, /await db\.rollback\(\)/)
})

test('transfer invoice sequence initialization happens before the transaction', () => {
  const service = read('src/services/transfer.service.js')
  for (const method of ['async wholesaleToPeer', 'async proxyTransferForSupplier']) {
    const methodStart = service.indexOf(method)
    const transactionStart = service.indexOf('await connection.beginTransaction()', methodStart)
    const methodBody = service.slice(methodStart, transactionStart)
    assert.ok(methodStart >= 0 && transactionStart > methodStart, `${method} 缺少事务入口`)
    assert.match(methodBody, /await prepareInvoiceNumberTransaction\(connection\)/)
  }
})

test('invoice suffixes share PF for wholesale and peer transfer', () => {
  const {
    generateInvoiceNumberForDate,
    getInvoiceTypeSuffix,
    parseInvoiceNumber
  } = require('../src/utils/invoice-number')

  assert.equal(getInvoiceTypeSuffix('retail'), 'XS')
  assert.equal(getInvoiceTypeSuffix('wholesale'), 'PF')
  assert.equal(getInvoiceTypeSuffix('peer_transfer'), 'PF')
  assert.equal(getInvoiceTypeSuffix('supplier_proxy'), 'HB')
  assert.equal(generateInvoiceNumberForDate('2026-10-07', 5, 'wholesale'), '202610070005PF')
  assert.equal(generateInvoiceNumberForDate('2026-10-07', 6, 'peer_transfer'), '202610070006PF')
  assert.equal(parseInvoiceNumber('202610070007DH').saleType, 'peer_transfer')
})

test('wholesale page uses canonical inventory cost and time fields', () => {
  const helpers = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/helpers.ts'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/types.ts'), 'utf8')
  const summary = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/WholesalePhoneSummarySection.vue'), 'utf8')

  assert.match(helpers, /phone\.purchase_cost/)
  assert.match(summary, /phone\.inventory_time/)
  assert.doesNotMatch(helpers, /phone\.purchase_price/)
  assert.doesNotMatch(types, /purchase_price\??:/)
  assert.doesNotMatch(types, /Inventorytime\??:/)
  assert.doesNotMatch(summary, /phone\.Inventorytime/)
})

test('query contract matches the implemented pagination and filter names', () => {
  const service = read('src/services/query.service.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8')
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts.query

  for (const field of ['page', 'page_size', 'search_term', 'brand', 'model', 'color', 'memory', 'start_date', 'end_date']) {
    assert.ok(contract.canonical.includes(field), `查询契约缺少 ${field}`)
    assert.match(service, new RegExp(`\\b${field}\\b`), `查询服务未使用 ${field}`)
    assert.match(view, new RegExp(`\\b${field}\\b`), `查询页面未使用 ${field}`)
  }
  assert.ok(!contract.canonical.includes('limit'))
  assert.ok(!contract.canonical.includes('search'))
  assert.deepEqual(contract.legacy, [])
  for (const field of ['limit', 'purchase_price', 'Inventorytime', 'salestime', 'sale_date']) {
    assert.ok(contract.retired.includes(field), `查询契约未退役 ${field}`)
  }
})

test('phone option data requires authentication and accessory permission', () => {
  const route = read('src/routes/options.js')
  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /router\.get\('\/phone-options', requireAnyPermission\(\['accessories:view', 'accessories:create'\]\)/)
})

test('query responses use canonical snake_case sections and fields', () => {
  const service = read('src/services/query.service.js')
  const repository = read('src/repositories/query.repository.js')
  const start = service.indexOf('// 格式化返回数据')
  const end = service.indexOf('return {', start)
  const formatter = service.slice(start, end > start ? end : undefined)

  for (const section of ['basic_info', 'supplier_info', 'store_info', 'price_info', 'time_info', 'customer_info', 'operator_info', 'sale_info']) {
    assert.match(formatter, new RegExp(`${section}:`), `查询响应缺少 ${section}`)
  }
  for (const field of ['purchase_cost', 'inventory_time', 'sale_time']) {
    assert.match(formatter, new RegExp(`\\b${field}\\b`), `查询响应缺少 ${field}`)
  }
  assert.doesNotMatch(formatter, /价格信息:\s*\{/)
  assert.doesNotMatch(formatter, /时间信息:\s*\{/)
  assert.match(formatter, /purchase_cost: item\.purchase_cost === null \? null : Number\(item\.purchase_cost\)/)
  assert.match(formatter, /sale_price: item\.sale_price === null \? null : Number\(item\.sale_price\)/)
  assert.doesNotMatch(formatter, /purchase_cost: item\.purchase_cost \?\? 0/)
  const optionsErrorStart = repository.indexOf("log.error('获取查询选项数据失败:'")
  const optionsErrorHandler = repository.slice(optionsErrorStart, optionsErrorStart + 180)
  assert.match(optionsErrorHandler, /throw error/)
  assert.doesNotMatch(optionsErrorHandler, /suppliers:\s*\[\]/)
})

test('query page keeps canonical price and time fields after response normalization', () => {
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/index.ts'), 'utf8')

  assert.match(view, /价格信息: \{[\s\S]*purchase_cost:/)
  assert.match(view, /时间信息: \{[\s\S]*inventory_time:/)
  assert.match(view, /时间信息: \{[\s\S]*sale_time:/)
  assert.match(view, /basic_info\.purchase_cost/)
  assert.match(view, /time_info\.inventory_time/)
  assert.match(view, /time_info\.sale_time/)
  assert.match(types, /purchase_cost\?: number/)
  assert.match(types, /inventory_time\?: string/)
  assert.match(types, /sale_time\?: string/)
  assert.doesNotMatch(view, /item\.价格信息\?\.purchase_price/)
  assert.doesNotMatch(view, /item\.时间信息\?\.Inventorytime/)
  assert.doesNotMatch(view, /item\.时间信息\?\.salestime/)
  assert.doesNotMatch(view, /purchase_price|Inventorytime|salestime|sale_date/)
})

test('query detail content uses canonical field permission ids', () => {
  const detail = fs.readFileSync(path.join(root, '../frontend/src/components/query/QueryDetailContent.vue'), 'utf8')
  const moduleFields = fs.readFileSync(path.join(root, '../frontend/src/config/moduleFields.js'), 'utf8')
  const permissionComposable = fs.readFileSync(path.join(root, '../frontend/src/composables/useFieldPermissions.ts'), 'utf8')

  for (const field of ['basic_info.purchase_cost', 'time_info.inventory_time', 'time_info.sale_time']) {
    assert.match(detail, new RegExp(field.replace('.', '\\.')), `详情弹窗缺少规范权限字段 ${field}`)
    assert.match(moduleFields, new RegExp(`id: '${field.replace('.', '\\.')}'`), `字段配置缺少规范权限字段 ${field}`)
  }
  assert.doesNotMatch(detail, /basic_info\.purchase_price|time_info\.Inventorytime|time_info\.salestime/)
  assert.match(permissionComposable, /hidden_fields/)
  assert.match(permissionComposable, /editable_fields/)
  assert.doesNotMatch(permissionComposable, /basic_info\.purchase_price|time_info\.Inventorytime|time_info\.salestime|price_info\.purchase_price/)
})

test('field permissions use the canonical endpoint and snake_case response fields', () => {
  const route = read('src/routes/permission-management.js')
  const service = read('src/services/user-field-permissions.service.js')
  const composable = fs.readFileSync(path.join(root, '../frontend/src/composables/useFieldPermissions.ts'), 'utf8')
  const directive = fs.readFileSync(path.join(root, '../frontend/src/directives/permission.ts'), 'utf8')
  const activeSource = `${composable}\n${directive}`

  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /router\.get\('\/user-field-permissions', userFieldPermissionsController\.getCurrent\.bind\(userFieldPermissionsController\)\)/)
  assert.match(composable, /\/permissions\/user-field-permissions/)
  assert.match(service, /hidden_fields/)
  assert.match(service, /editable_fields/)
  assert.match(service, /role_sources/)
  assert.doesNotMatch(activeSource, /\/fields\/permissions|\/field-permissions\//)
  assert.doesNotMatch(
    activeSource,
    /\b(?:permissionLevel|hiddenFields|editableFields)\b/
  )
})

test('sales page and extracted modules use canonical fields without runtime compatibility', () => {
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/sales/SalesView.vue'), 'utf8')
  const phoneHelpers = fs.readFileSync(path.join(root, '../frontend/src/views/sales/sales-phone-helpers.ts'), 'utf8')
  const checkout = fs.readFileSync(path.join(root, '../frontend/src/views/sales/useSalesCheckout.ts'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/views/sales/types.ts'), 'utf8')
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts.sales
  const route = read('src/routes/sales.js')
  const salesService = read('src/services/sales-phone.service.js')

  for (const field of ['purchase_cost', 'inventory_time', 'sale_time']) {
    assert.ok(contract.canonical.includes(field), `销售契约缺少 ${field}`)
    assert.match(`${view}\n${phoneHelpers}\n${checkout}`, new RegExp(`\\b${field}\\b`), `销售模块未使用 ${field}`)
  }
  assert.match(phoneHelpers, /export const normalizeSalesPhone =/)
  assert.doesNotMatch(view, /record\.purchase_price|record\.Inventorytime|record\.salestime/)
  assert.match(checkout, /sale_time: saleForm\.sale_time/)
  assert.match(checkout, /sale_time: batchSaleForm\.sale_time/)
  assert.match(checkout, /sale_price: parseFloat\(saleForm\.sale_price\)/)
  assert.doesNotMatch(checkout, /\bprice: parseFloat/)
  assert.doesNotMatch(view, /phone\.(?:purchase_price|Inventorytime|inbound_date|cost)\b/)
  assert.doesNotMatch(route, /legacy(?:SalePrice|SaleDate|Price|Limit|DateStart|DateEnd)/)
  assert.doesNotMatch(route, /date_start:|date_end:|sale_date:|limit: legacyLimit|price: legacy/)
  assert.doesNotMatch(route, /TEMP_\$\{Date\.now\(\)\}|临时客户/)
  assert.match(salesService, /this\.normalizeDate\(saleTime, false\)/)
  assert.match(types, /inventory_time\?: string/)
  assert.doesNotMatch(types, /Inventorytime\?:/)
})

test('data import exposes controlled file tokens and server-owned task IDs', () => {
  const route = read('src/routes/data-import.js')
  const controller = read('src/controllers/data-import.controller.js')
  const fileService = read('src/services/data-import-file.service.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/api/data-optimization.ts'), 'utf8')

  assert.match(route, /router\.post\('\/upload', requirePermission\('data-import:upload'\), upload\.single\('file'\), dataImportController\.upload\.bind/)
  assert.match(route, /router\.post\('\/import', requirePermission\('data-import:execute'\), dataImportController\.startImport\.bind/)
  assert.match(controller, /file_token:/)
  assert.match(controller, /path\.basename\(req\.file\.path\)/)
  assert.match(controller, /this\.createImportId\(\)/)
  assert.match(controller, /import_id: importId/)
  assert.match(controller, /req\.body\.file_token/)
  assert.match(fileService, /resolve\(fileToken, userId\)/)
  assert.match(fileService, /无权访问该导入文件/)
  assert.match(fileService, /validateFile\(path\.join\(this\.importDirectory, token\)/)
  assert.match(read('src/services/data-import-history.service.js'), /query\.page_size/)
  assert.doesNotMatch(route, /filePath|req\.query\.limit|req\.query\.pageSize/)
  assert.match(frontend, /file_token: fileToken/)
  assert.match(frontend, /file_token: fileToken/)
  assert.match(frontend, /user_id\?: number/)
  assert.doesNotMatch(frontend, /filePath/)
  assert.doesNotMatch(frontend, /Date\.now\(\)/)
})

test('data import analysis and history responses use canonical snake_case fields', () => {
  const service = read('src/services/data-import.service.js')
  const controller = read('src/controllers/data-import.controller.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/data-optimization/page/DataImportTab.vue'), 'utf8')

  assert.match(service, /toCanonicalAnalysis\(analysis\)/)
  assert.match(service, /new_records:/)
  assert.match(service, /duplicate_records:/)
  assert.match(service, /existing_record:/)
  assert.match(service, /has_sale:/)
  assert.match(controller, /total_records:/)
  assert.match(controller, /error_count:/)
  assert.match(read('src/services/data-import-history.service.js'), /total_pages:/)
  assert.doesNotMatch(frontend, /analysisResult\.newRecords/)
  assert.doesNotMatch(frontend, /analysisResult\.duplicateRecords/)
  assert.doesNotMatch(frontend, /dup\.existingRecord/)
  assert.doesNotMatch(frontend, /dup\.rowIndex/)
})

test('data import analysis does not fabricate progress percentages', () => {
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/data-optimization/page/DataImportTab.vue'), 'utf8')
  assert.match(frontend, /:indeterminate="analyzing"/)
  assert.doesNotMatch(frontend, /analyzeProgressTimer/)
  assert.doesNotMatch(frontend, /正在分析数据\.\.\. \$\{analyzeProgress\.value\}%/)
})

test('salary list pagination is bounded before reaching SQL LIMIT/OFFSET', () => {
  const controller = read('src/controllers/salary-record.controller.js')
  const repository = read('src/repositories/salary-record.repository.js')
  const listStart = repository.indexOf('async getSalaryRecordsWithPagination')
  const listEnd = repository.indexOf('async getSalaryRecordById')
  const listRepository = repository.slice(listStart, listEnd)
  assert.match(controller, /pageSizeValue/)
  assert.match(controller, /page_size: Number\.isSafeInteger\(pageSizeValue\)/)
  assert.match(listRepository, /const safePageSize = Math\.min\(100, Math\.max\(1/)
  assert.match(listRepository, /LIMIT \$\{safePageSize\} OFFSET \$\{offset\}/)
  assert.match(listRepository, /page_size: safePageSize/)
  assert.match(listRepository, /total_pages:/)
  assert.match(listRepository, /has_next:/)
  assert.match(listRepository, /has_prev:/)
  assert.doesNotMatch(listRepository, /LIMIT \$\{parseInt\(limit\)\}/)
})

test('import history and repair pagination bind LIMIT/OFFSET values in their data-access layer', () => {
  const importController = read('src/repositories/data-import-history.repository.js')
  const repairService = read('src/services/repair-read.service.js')
  const repairRepository = read('src/repositories/repair-read.repository.js')

  assert.match(importController, /LIMIT \? OFFSET \?`/)
  assert.match(importController, /\.\.\.queryParams, pageSize, offset/)
  assert.doesNotMatch(importController, /LIMIT \$\{pageSize\} OFFSET \$\{parseInt\(offset, 10\)\}/)
  assert.match(repairService, /Math\.min\(100, Math\.max\(1/)
  assert.match(repairRepository, /LIMIT \? OFFSET \?`/)
  assert.match(repairRepository, /\.\.\.params, pageSize, offset/)
  assert.doesNotMatch(repairRepository, /LIMIT \$\{pageSize\} OFFSET \$\{offset\}/)
})

test('inventory edit form uses canonical inventory_time internally', () => {
  const view = [
    fs.readFileSync(path.join(root, '../frontend/src/views/inventory/InventoryView.vue'), 'utf8'),
    fs.readFileSync(path.join(root, '../frontend/src/views/inventory/page/InventoryEditDialog.vue'), 'utf8')
  ].join('\n')
  assert.match(view, /v-model="editForm\.inventory_time"/)
  assert.match(view, /inventory_time: editForm\.inventory_time/)
  assert.match(view, /\{ key: 'purchase_cost', label: '入库价格' \}/)
  assert.match(view, /\{ key: 'inventory_time', label: '入库时间' \}/)
  assert.doesNotMatch(view, /v-model="editForm\.Inventorytime"/)
})

test('inventory detail modal reads canonical cost and time fields', () => {
  const modal = fs.readFileSync(path.join(root, '../frontend/src/components/InventoryDetailModal.vue'), 'utf8')
  assert.match(modal, /canViewField\('purchase_cost'\)/)
  assert.match(modal, /canViewField\('inventory_time'\)/)
  assert.match(modal, /props\.item\?\.purchase_cost/)
  assert.match(modal, /props\.item\?\.inventory_time/)
  assert.doesNotMatch(modal, /props\.item\?\.purchase_price/)
  assert.doesNotMatch(modal, /props\.item\?\.Inventorytime/)
})

test('price list inventory detail normalizes inventory_time at the response boundary', () => {
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/price-list/PriceListView.vue'), 'utf8')
  assert.match(view, /prop="inventory_time"/)
  assert.match(view, /formatInventoryDate\(row\.inventory_time\)/)
  assert.match(view, /const normalizePriceListInventory =/)
  assert.match(view, /inventory_time: item\.inventory_time \?\? null/)
  assert.match(view, /calculateInventoryDays\(item\.inventory_time\)/)
  assert.doesNotMatch(view, /\bInventorytime\b/)
})

test('analytics trend and high-value endpoints use canonical query names', () => {
  const route = read('src/routes/analytics.js')
  const transferService = read('src/services/analytics-transfers.service.js')
  const index = read('src/routes/index.js')
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/api/analytics.ts'), 'utf8')
  const highValueController = read('src/controllers/analytics-high-value-customers.controller.js')

  assert.match(index, /router\.use\(['"]\/analytics['"], analyticsRoutes\)/)
  assert.match(transferService, /query\.start_date/)
  assert.match(transferService, /query\.end_date/)
  assert.match(highValueController, /req\.query\.page_size/)
  assert.match(highValueController, /req\.query\.search_term/)
  assert.doesNotMatch(`${route}\n${transferService}`, /req\.query\.startDate|req\.query\.endDate|req\.query\.pageSize|req\.query\.search\b/)
  assert.match(frontend, /start_date\?: string/)
  assert.match(frontend, /end_date\?: string/)
  assert.match(frontend, /page_size\?: number/)
})

test('customer analytics page and response contract use canonical snake_case fields', () => {
  const route = `${read('src/routes/analytics.js')}\n${read('src/controllers/analytics-customer-overview.controller.js')}\n${read('src/services/analytics-customer-overview.service.js')}`
  const highValueService = read('src/services/analytics-high-value-customers.service.js')
  const customerActivityController = read('src/controllers/analytics-customer-activity.controller.js')
  const customerActivityService = read('src/services/analytics-customer-activity.service.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/CustomerAnalytics.vue'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/analytics.ts'), 'utf8')

  for (const field of [
    'total_customers',
    'new_customers',
    'active_customers',
    'high_value_customers',
    'customer_segments',
    'active_rate',
    'page_size',
    'total_pages'
  ]) {
    assert.match(`${route}\n${highValueService}\n${customerActivityController}\n${customerActivityService}`, new RegExp(`${field}`), `客户分析后端缺少 ${field}`)
  }
  assert.match(view, /params\.start_date = props\.startDate/)
  assert.match(view, /params\.end_date = props\.endDate/)
  assert.match(view, /params\.store_id = storeId/)
  assert.match(view, /data\.total_customers/)
  assert.doesNotMatch(view, /data\.totalCustomers/)
  assert.doesNotMatch(view, /data\.activeRate/)
  assert.match(types, /total_customers: number/)
  assert.match(types, /customer_segments: CustomerSegment\[\]/)
})

test('employee analytics page sends canonical date and store filters', () => {
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/analytics.ts'), 'utf8')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/EmployeeAnalytics.vue'), 'utf8')

  assert.match(api, /getEmployeeAnalytics\(params\?: \{[\s\S]*start_date\?: string[\s\S]*end_date\?: string[\s\S]*store_id\?/)
  assert.match(api, /getAttendanceSummary\(params\?: \{[\s\S]*start_date\?: string[\s\S]*end_date\?: string[\s\S]*store_id\?/)
  assert.match(view, /params\.start_date = props\.startDate/)
  assert.match(view, /params\.end_date = props\.endDate/)
  assert.match(view, /const getStoreParams = \(\): \{ store_id\?: number \} =>/)
  assert.match(view, /Number\.isSafeInteger\(storeId\) && storeId > 0/)
  assert.match(view, /Object\.assign\(params, getStoreParams\(\)\)/)
  assert.doesNotMatch(view, /params\.startDate\s*=/)
  assert.doesNotMatch(view, /params\.endDate\s*=/)
  assert.doesNotMatch(view, /params\.storeId\s*=/)
})

test('analytics pages use canonical pagination and date request fields', () => {
  const employee = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/EmployeeAnalytics.vue'), 'utf8')
  const inventory = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/InventoryAnalytics.vue'), 'utf8')
  const sales = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/SalesAnalytics.vue'), 'utf8')
  const profit = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/ProfitAnalytics.vue'), 'utf8')
  const route = read('src/routes/analytics.js')
  const salesForecastService = read('src/services/analytics-sales-forecast.service.js')
  const employeeRepository = read('src/repositories/analytics-employee-summary.repository.js')

  assert.match(employee, /page_size: 20/)
  assert.doesNotMatch(employee, /limit: 20/)
  assert.match(inventory, /page_size: 200/)
  assert.match(inventory, /page_size: 10/)
  assert.doesNotMatch(inventory, /limit: (?:200|10)/)
  assert.match(sales, /const params = \{ start_date: startDate, end_date: endDate, \.\.\.getStoreParams\(\) \}/)
  assert.match(sales, /params: \{ store_id: store\.id \}/)
  assert.match(sales, /page_size: 10/)
  assert.match(profit, /\{ page_size: 10 \}/)
  assert.doesNotMatch(profit, /\{ limit: 10 \}/)
  assert.match(salesForecastService, /const pageSize = query\.page_size/)
  assert.doesNotMatch(`${route}\n${salesForecastService}`, /query\.limit|query\.storeId/)
  assert.match(route, /analyticsEmployeeSummaryController\.employeePerformance/)
  assert.match(employeeRepository, /LIMIT \?/)
})

test('inventory analytics recent sales use canonical time fields', () => {
  const route = read('src/routes/analytics.js')
  const inventoryRepository = read('src/repositories/analytics-inventory.repository.js')
  const inventoryService = read('src/services/analytics-inventory.service.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/InventoryAnalytics.vue'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/analytics.ts'), 'utf8')

  assert.match(inventoryService, /last_sale_time: null/)
  assert.match(route, /router\.get\('\/inventory\/recent-sold'.*analyticsInventoryController\.getRecentSold/)
  assert.match(inventoryRepository, /p\.sale_time as saleDate/)
  assert.match(inventoryService, /sale_time: row\.saleDate/)
  assert.match(view, /prop="last_sale_time"/)
  assert.match(view, /prop="sale_time"/)
  assert.match(view, /latestRecord\?\.sale_time/)
  assert.match(types, /last_sale_time: string \| null/)
  assert.match(types, /sale_time: string/)
  assert.doesNotMatch(view, /last_sale_date|scope\.row\.sale_date|latestRecord\?\.sale_date/)
})

test('analytics inventory filters use validated bound parameters', () => {
  const route = read('src/routes/analytics.js')
  const inventory = route.slice(route.indexOf("router.get('/inventory'"), route.indexOf("router.get('/inventory/recent-sold'"))
  const inventoryController = read('src/controllers/analytics-inventory.controller.js')
  const inventoryRepository = read('src/repositories/analytics-inventory.repository.js')
  assert.match(inventoryController, /parseOptionalInt\(req\.query\.store_id\)/)
  assert.match(inventoryController, /parseOptionalInt\(req\.query\.supplier_id\)/)
  assert.match(inventoryRepository, /AND p\.supplier_id = \?/)
  assert.doesNotMatch(inventory, /supplier_id = \$\{parseInt/)
  assert.match(route, /router\.get\('\/inventory\/supplier-stats'.*analyticsInventoryController\.getSupplierStats/)
  assert.match(inventoryRepository, /AND p\.store_id = \?/)
  assert.match(inventoryRepository, /AND p\.supplier_id = \?/)
  assert.match(route, /router\.get\('\/inventory\/recent-sold'.*analyticsInventoryController\.getRecentSold/)
  assert.match(inventoryRepository, /AND p\.store_id = \?/)
  assert.match(inventoryRepository, /AND p\.supplier_id = \?/)
  assert.match(inventoryRepository, /LIMIT \?/)
  assert.doesNotMatch(inventoryRepository, /store_id = \$\{parseInt/)
})

test('employee analytics overview delegates validated filters and binds store/date parameters in repository', () => {
  const route = read('src/routes/analytics.js')
  const repository = read('src/repositories/analytics-employee-summary.repository.js')
  assert.match(route, /router\.get\('\/employees\/detail', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController\.employeeOverview\.bind\(analyticsEmployeeSummaryController\)\)/)
  assert.match(repository, /DATE\(sale_time\) >= \? AND DATE\(sale_time\) <= \? \$\{phoneFilter\}/)
  assert.match(repository, /AND store_id = \?/)
  assert.doesNotMatch(repository, /store_id = \$\{parseInt/)
  assert.match(repository, /DATE\(ar\.created_at\) >= \? AND DATE\(ar\.created_at\) <= \?/)
})

test('transfer analytics delegates to controller and repository binds all date and store filters', () => {
  const route = read('src/routes/analytics.js')
  const service = read('src/services/analytics-transfers.service.js')
  const repository = read('src/repositories/analytics-transfers.repository.js')
  assert.match(route, /router\.get\('\/transfers-and-allocations', unifiedAuth, requireBusinessUser, analyticsTransfersController\.getTransfersAndAllocations\.bind\(analyticsTransfersController\)\)/)
  assert.match(service, /parseOptionalDate\(requestedStartDate\)/)
  assert.match(service, /parseOptionalDate\(requestedEndDate\)/)
  assert.match(repository, /DATE\(p\.wholesale_date\) >= \?/)
  assert.match(repository, /DATE\(p\.inventory_time\) >= \?/)
  assert.doesNotMatch(repository, /DATE\(p\.wholesale_date\).*\$\{startDate\}/)
  assert.doesNotMatch(repository, /store_id = \$\{parseInt/)
  assert.match(repository, /db\.execute\(trendQuery, \[\.\.\.rangeAndStoreParams, \.\.\.rangeAndStoreParams\]\)/)
})

test('salary responses use an explicit field allowlist', () => {
  const repository = read('src/repositories/salary-record.repository.js')
  const contracts = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8'))
  const responseFields = contracts.contracts['salary-records'].recordResponseFields

  assert.ok(Array.isArray(responseFields) && responseFields.length > 0)
  assert.match(repository, /const RESPONSE_FIELDS = \[/)
  assert.match(repository, /const RESPONSE_SELECT = RESPONSE_FIELDS\.map/)
  assert.doesNotMatch(repository, /sr\.\*/)
  assert.doesNotMatch(repository, /SELECT \* FROM/)
  for (const field of responseFields) assert.match(repository, new RegExp(`\\b${field}\\b`))
})

test('salary employee sales details expose canonical sale_time', () => {
  const service = read('src/services/salary-record.service.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/salary/SalaryView.vue'), 'utf8')
  const employeeSalesDialog = fs.readFileSync(path.join(root, '../frontend/src/views/salary/page/SalaryEmployeeSalesDetailDialog.vue'), 'utf8')
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['salary-records']

  assert.ok(contract.canonical.includes('sale_time'))
  assert.match(service, /p\.sale_time as sale_time/)
  assert.match(service, /shouldExcludeSaleByLeave\(row\.sale_time/)
  assert.match(employeeSalesDialog, /formatSaleTime\(row\.sale_time\)/)
  assert.doesNotMatch(`${view}\n${employeeSalesDialog}`, /item\.salestime/)
  assert.match(view, /v-model:page-size="myPagination\.page_size"/)
  assert.doesNotMatch(view, /myPagination\.size/)
})

test('customer purchase history exposes canonical cost and sale time fields', () => {
  const controller = read('src/services/customer-management.service.js')
  const repository = read('src/repositories/customer.repository.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/customers/CustomersView.vue'), 'utf8')
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts.customers

  for (const field of ['purchase_cost', 'sale_price', 'sale_time', 'profit']) {
    assert.ok(contract.canonical.includes(field))
    assert.match(`${controller}\n${repository}`, new RegExp(`\\b${field}\\b`))
  }
  assert.match(repository, /s\.sale_time/)
  assert.match(repository, /s\.purchase_cost/)
  assert.match(repository, /s\.sale_price/)
  assert.match(controller, /sale_time: purchase\.sale_time/)
  assert.match(controller, /purchase\.sale_price === null \? null : Number\(purchase\.sale_price\)/)
  assert.match(view, /formatDate\(purchase\.sale_time\)/)
  assert.doesNotMatch(view, /purchase\.sale_date/)
  assert.doesNotMatch(view, /purchase_price\?:/)
})

test('H5 sold products uses canonical fields without runtime aliases or fake values', () => {
  const route = read('src/routes/shop.js')
  const service = read('src/services/shop.service.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/H5-admin/page/SoldProductsView.vue'), 'utf8')
  const queryView = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/h5.ts'), 'utf8')
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['h5-sold-products']

  assert.ok(contract.canonical.includes('sale_time'))
  assert.deepEqual(contract.legacy, [])
  assert.ok(contract.retired.includes('sale_date'))
  assert.ok(contract.retired.includes('salestime'))
  assert.ok(contract.retired.includes('imageIds'))
  assert.match(service, /p\.sale_time AS sale_time/)
  assert.match(route, /router\.get\('\/sold-products',[\s\S]*?shopManagementController\.getSoldProducts\.bind\(shopManagementController\)/)
  assert.match(route, /router\.delete\('\/products\/:id\/images'/)
  assert.doesNotMatch(route, /router\.get\('\/products\/:id\/images'/)
  assert.doesNotMatch(route, /router\.put\('\/products\/:id\/images\/reorder'/)
  assert.doesNotMatch(route, /router\.post\('\/upload-phone-image'/)
  assert.match(service, /async deletePhoneImages\(phoneId\)/)
  assert.doesNotMatch(route, /SELECT id, phone_id, image_url, image_type, is_primary, sort_order, uploaded_by FROM H5_images/)
  assert.doesNotMatch(route, /COALESCE\(b\.name, '未知品牌'\)|COALESCE\(m\.name, '未知型号'\)/)
  assert.match(service, /async reorderPhoneImages\(phoneId, image_ids\)/)
  assert.match(service, /await connection\.beginTransaction\(\)/)
  assert.match(service, /await connection\.commit\(\)/)
  assert.match(service, /await connection\.rollback\(\)/)
  assert.match(service, /entry\?\.image_ids/)
  assert.doesNotMatch(service, /entry\?\.imageIds/)
  assert.match(queryView, /\{ imageIds: image_ids \}/)
  assert.match(view, /formatDate\(product\.sale_time\)/)
  assert.match(view, /api\.get<SoldProduct\[]>\('\/shop\/sold-products'\)/)
  assert.match(view, /pagination\.page_size/)
  assert.match(view, /total_pages/)
  assert.doesNotMatch(view, /product\.sale_date|product\.salestime/)
  assert.match(types, /sale_time: string \| null/)
  assert.doesNotMatch(types, /sale_date: string/)
  assert.doesNotMatch(view, /currentPage|pageSize|totalPages/)
})

test('H5 customer sales exposes canonical sale_time', () => {
  const controller = read('src/controllers/shop-public-auth.controller.js')
  const service = read('src/services/shop-public.service.js')
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/auth.ts'), 'utf8')
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/H5-mobile/page/MyCenter.vue'), 'utf8')
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['h5-customer-sales']
  const salesStart = service.indexOf('async getSalesByCustomerId')
  const salesEnd = service.indexOf('async updateOrderStatus', salesStart)
  const salesMethod = service.slice(salesStart, salesEnd)

  assert.ok(contract.canonical.includes('sale_time'))
  assert.ok(salesStart >= 0 && salesEnd > salesStart, 'H5 客户销售历史服务方法不存在')
  assert.match(salesMethod, /COALESCE\(s\.sale_time, p\.sale_time\) as sale_time/)
  assert.doesNotMatch(salesMethod, /as profit|profit: sale\.profit|purchase_cost/)
  assert.match(salesMethod, /sale_time: sale\.sale_time/)
  assert.match(salesMethod, /sale_price: sale\.sale_price (?:== null \? null : Number\(sale\.sale_price\)|=== null \|\| sale\.sale_price === undefined \? null : Number\(sale\.sale_price\))/)
  assert.doesNotMatch(salesMethod, /store_name: sale\.store_name \|\| '未知店铺'/)
  assert.doesNotMatch(salesMethod, /CASE WHEN p\.is_new = 1 THEN '全新' ELSE '二手' END as is_new/)
  assert.match(controller, /getSalesByCustomerId\(customer\.customer_id, normalizeHistoryPagination\(req\.query\)\)/)
  assert.match(controller, /this\.sendPaginated\(res, result, '获取销售记录成功'\)/)
  assert.match(api, /export interface H5CustomerSale/)
  assert.doesNotMatch(api, /profit:/)
  assert.match(api, /getUserSales\(params\?: \{ page\?: number; page_size\?: number \}\): Promise<PaginatedData<H5CustomerSale>>/)
  assert.match(view, /ref<H5CustomerSale\[\]>\(\[\]\)/)
  assert.match(view, /purchaseRecords\.value\.push\(\.\.\.result\.data\)/)
  assert.match(view, /formatDate\(record\.sale_time\)/)
  assert.doesNotMatch(view, /record\.sale_date/)
  assert.doesNotMatch(view, /purchaseRecords = ref<any\[\]>/)
  assert.match(controller, /this\.response\.serverError\(res, '获取用户销售记录失败', error\)/)
})

test('comprehensive dashboard warnings use canonical sale and inventory times', () => {
  const route = read('src/routes/dashboard.js')
  const controller = read('src/controllers/dashboard.controller.js')
  const service = read('src/services/dashboard.service.js')
  const repository = read('src/repositories/dashboard.repository.js')
  const view = fs.readFileSync(path.join(root, '../frontend/src/components/ComprehensiveWarnings.vue'), 'utf8')
  const inventoryWarnings = fs.readFileSync(path.join(root, '../frontend/src/components/InventoryWarnings.vue'), 'utf8')
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['dashboard-warnings']

  for (const field of ['sale_time', 'inventory_time', 'last_inventory_time', 'avg_daily_sales', 'is_below_average', 'no_recent', 'total_warnings', 'has_warnings']) {
    assert.ok(contract.canonical.includes(field))
    assert.ok(contract.responseFields.includes(field))
    assert.match(repository, new RegExp(`\\b${field}\\b`))
  }
  assert.match(repository, /DATE\(p\.sale_time\) as sale_time/)
  assert.match(repository, /DATE\(p\.inventory_time\) as inventory_time/)
  assert.match(repository, /MAX\(p\.inventory_time\) as last_inventory_time/)
  assert.match(repository, /avg_daily_sales:/)
  assert.match(repository, /is_below_average:/)
  assert.match(repository, /no_recent:/)
  assert.match(repository, /total_warnings:/)
  assert.deepEqual(contract.legacy, [])
  assert.ok(contract.retired.includes('limit'))
  assert.doesNotMatch(route, /phoneThreshold|req\.query\.limit|page_size: page_size \?\? limit/)
  assert.match(service, /page_size = 10/)
  assert.match(service, /parseInt\(page_size\)/)
  assert.match(route, /dashboardController\.getPhoneStockWarnings\.bind/)
  assert.match(route, /dashboardController\.getModelStockWarnings\.bind/)
  assert.match(controller, /getPhoneStockWarnings\(\{ threshold, page_size \}\)/)
  assert.match(controller, /getModelStockWarnings\(\{ threshold, page_size \}\)/)
  assert.match(service, /getPhoneStockWarnings\(thresholdNum, pageSizeNum\)/)
  assert.match(service, /getModelStockWarnings\(thresholdNum, pageSizeNum\)/)
  assert.match(repository, /page_size = 10/)
  assert.doesNotMatch(repository, /getPhoneStockWarnings\(phone_threshold, limit\)/)
  assert.doesNotMatch(repository, /getModelStockWarnings\(phone_threshold, limit\)/)
  assert.match(repository, /has_warnings:/)
  assert.match(view, /item\.sale_time/)
  assert.match(view, /prop="last_inventory_time"/)
  assert.doesNotMatch(view, /item\.sale_date|last_purchase_date/)
  assert.match(inventoryWarnings, /data\.summary\?\.has_warnings/)
  assert.match(inventoryWarnings, /data\.summary\?\.total_warnings/)
  assert.doesNotMatch(inventoryWarnings, /hasWarnings|totalWarnings/)
})

test('phone list exposes canonical cost, time and condition fields', () => {
  const route = read('src/routes/phones.js')
  const service = read('src/services/phone-inventory-query.service.js')
  const repository = read('src/repositories/phone-inventory-query.repository.js')
  assert.match(repository, /p\.purchase_cost/)
  assert.match(service, /inventory_time: phone\.inventory_time \|\| null/)
  assert.match(service, /sale_time: phone\.sale_time \|\| null/)
  assert.match(service, /condition: Number\(phone\.is_new\) === 1 \? 'new' : 'used'/)
  assert.match(route, /phoneInventoryQueryController\.listInventoryPhones\.bind\(phoneInventoryQueryController\)/)
  assert.doesNotMatch(route, /const \{ Inventorytime, salestime, \.\.\.canonicalPhone \} = phone/)
  assert.doesNotMatch(route, /inventory_time: Inventorytime/)
  assert.doesNotMatch(service, /purchase_price: phone\.purchase_cost/)
})

test('stock-in list and detail expose canonical response fields', () => {
  const route = read('src/routes/stock-in.js')
  const controller = read('src/controllers/stock-in.controller.js')
  const service = read('src/services/stock-in.service.js')
  const repository = read('src/repositories/stock-in.repository.js')
  const implementation = `${service}\n${repository}`
  const readHandlers = repository.slice(repository.indexOf('async list('), repository.indexOf('async detail('))
  const updateHandler = service.slice(service.indexOf('  update('), service.indexOf('  remove('))
  const detail = fs.readFileSync(path.join(root, '../frontend/src/components/StockInDetailModal.vue'), 'utf8')
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/inventory.ts'), 'utf8')
  assert.match(implementation, /p\.purchase_cost/)
  assert.match(implementation, /inventory_time: record\.inventory_time/)
  assert.match(implementation, /purchase_cost: record\.purchase_cost/)
  assert.match(implementation, /condition: Number\(record\.is_new\) === 1 \? 'new' : 'used'/)
  assert.match(implementation, /const page_size = Math\.min\(200/)
  assert.match(implementation, /p\.inventory_time >= \?/)
  assert.match(implementation, /if \(brand_id\)/)
  assert.match(implementation, /page_size,/)
  assert.match(implementation, /total_pages: Math\.ceil\(total \/ page_size\)/)
  assert.match(implementation, /connection\.query\(listSql, \[\.\.\.params, page_size, offset\]\)/)
  assert.match(implementation, /is_settled: record\.payment_status === 'paid' \? 1 : 0/)
  assert.match(implementation, /today_stock_in: Number\(stats\.today_stock_in\)/)
  assert.match(implementation, /unknown_payment_count: Number\(stats\.unknown_payment_count\)/)
  assert.doesNotMatch(readHandlers, /FROM inventory|使用默认值|p\.created_at/)
  assert.doesNotMatch(readHandlers, /\blimit\b|\bpages\b|productType|brandIdParam|storeIdParam|supplierIdParam|startDateParam|endDateParam/)
  assert.doesNotMatch(updateHandler, /updated_at/)
  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('stock-in:edit'\), stockInController\.update\.bind\(stockInController\)\)/)
  assert.match(route, /router\.delete\('\/:id', unifiedAuth, requirePermission\('stock-in:delete'\), stockInController\.remove\.bind\(stockInController\)\)/)
  assert.doesNotMatch(`${route}\n${controller}`, /SELECT \* FROM phones/)
  assert.match(implementation, /b\.name as brand_name/)
  assert.match(implementation, /GROUP BY b\.id, b\.name/)
  assert.match(detail, /record\.inventory_time/)
  assert.match(detail, /record\.purchase_cost/)
  assert.match(detail, /record\.remarks/)
  assert.doesNotMatch(detail, /record\.(?:created_at|updated_at|unit_cost|total_cost|note)\b/)
  assert.match(types, /page_size: number/)
  assert.match(types, /total_pages: number/)
})

test('quick-sale inventory list exposes canonical fields and pagination', () => {
  const service = read('src/services/inventory.service.js')
  const repository = read('src/repositories/inventory.repository.js')
  assert.match(repository, /p\.inventory_time AS inventory_time/)
  assert.match(repository, /p\.sale_time AS sale_time/)
  assert.match(service, /purchase_cost: parseFloat\(item\.purchase_cost\)/)
  assert.doesNotMatch(service, /purchase_price: parseFloat\(item\.purchase_price\)/)
  assert.match(service, /condition: Number\(item\.is_new\) === 1 \? 'new' : 'used'/)
  assert.match(service, /page,/)
  assert.match(service, /page_size: pageSize/)
})

test('wholesale records expose sale_time and count uses all filters', () => {
  const service = read('src/services/transfer.service.js')
  assert.match(service, /s\.sale_time as sale_time/)
  assert.match(service, /pool\.query\(countQuery, whereParams\)/)
  assert.doesNotMatch(service, /whereParams\.slice\(0, -2\)/)
})

test('preorder mutation paths avoid SELECT * and accept canonical date filters', () => {
  const route = read('src/routes/preorders.js')
  const service = read('src/services/preorder-read.service.js')
  const constants = read('src/config/preorder-response.constants.js')
  const schema = read('src/utils/preorder-schema.js')
  assert.match(constants, /const PREORDER_CORE_FIELDS = \[/)
  assert.match(constants, /const PREORDER_RESPONSE_FIELDS = \[/)
  assert.doesNotMatch(route, /(?:SELECT|,)\s*p\.\*/)
  assert.doesNotMatch(route, /SELECT \* FROM preorders/)
  assert.match(service, /'start_date', 'end_date'/)
  assert.doesNotMatch(route, /req\.query\.(?:startDate|endDate|limit)/)
  assert.doesNotMatch(schema, /\b(?:ALTER|DROP|INSERT|UPDATE|DELETE)\b/i)
  assert.match(schema, /missingColumns/)
})

test('preorder edit form sends customer_id instead of retired customer snapshot fields', () => {
  const form = read('../frontend/src/views/preorders/page/PreorderFormModal.vue')
  const editBlock = form.slice(form.indexOf('const handleEditSubmit'))
  assert.match(editBlock, /customer_id: customerId/)
  assert.doesNotMatch(editBlock, /customer_name:/)
  assert.doesNotMatch(editBlock, /customer_phone:/)
  assert.doesNotMatch(form, /params:\s*\{[^}]*\blimit:/s)
  assert.match(form, /searchCustomerOptions\(keyword, 'generic'\)/)
})

test('preorder customer and product can be corrected before delivery and stale matches are released', () => {
  const route = read('src/routes/preorders.js')
  const service = read('src/services/preorder-mutation.service.js')
  const repository = read('src/repositories/preorder-mutation.repository.js')
  const controller = read('src/controllers/preorder-mutation.controller.js')
  const form = read('../frontend/src/views/preorders/page/PreorderFormModal.vue')
  const page = read('../frontend/src/views/preorders/PreordersView.vue')

  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('preorders:edit'\), rejectHiddenPreorderWriteFields, preorderMutationController\.update\.bind\(preorderMutationController\)\)/)
  assert.match(service, /\[PREORDER_STATUS\.PENDING, PREORDER_STATUS\.MATCHED\]\.includes\(preorder\.status\)/)
  assert.match(service, /this\.repository\.hasCustomer\(connection, customerId\)/)
  assert.match(service, /const specificationFields = \['brand_id', 'model_id', 'color_id', 'memory_id', 'is_new'\]/)
  assert.match(service, /const specificationChanged = preorder\.status === PREORDER_STATUS\.MATCHED/)
  assert.match(service, /if \(staleMatchNeedsClearing && preorder\.matched_phone_id\)/)
  assert.match(repository, /matched_phone_id = NULL/)
  assert.match(repository, /SET status = 'in_stock', is_preordered = 0/)
  assert.doesNotMatch(controller, /\.execute\(|beginTransaction\(|\.commit\(|\.rollback\(/)
  assert.doesNotMatch(form, /const isMatchedEdit = computed/)
  assert.match(page, /\['pending', 'arrived'\]\.includes\(row\.status\)/)
})

test('customer search forms share locked-name editing and customer replacement contracts', () => {
  const lockInput = fs.readFileSync(
    path.join(root, '../frontend/src/components/common/CustomerNameLockInput.vue'),
    'utf8'
  )
  const formPaths = [
    '../frontend/src/views/sales/page/SalesCheckoutForm.vue',
    '../frontend/src/views/sales/page/SalesBatchForm.vue',
    '../frontend/src/components/query/QuickSaleModal.vue',
    '../frontend/src/components/query/QueryEditModal.vue',
    '../frontend/src/components/wholesale/WholesalePartySection.vue',
    '../frontend/src/views/preorders/page/PreorderFormModal.vue'
  ]

  assert.match(lockInput, /if \(props\.selected\) return !props\.editing/)
  assert.match(lockInput, /@dblclick="handleUnlock"/)
  assert.match(lockInput, /title="更换客户"/)
  assert.match(lockInput, /@click="emit\('clear'\)"/)

  for (const formPath of formPaths) {
    const form = fs.readFileSync(path.join(root, formPath), 'utf8')
    assert.match(form, /<CustomerNameLockInput/)
    assert.match(form, /@clear="(?:emit\('clear-customer'\)|clearSelectedCustomer)"/)
    assert.doesNotMatch(form, /customer-lock-button|customer-name-group/)
  }

  const preorderForm = fs.readFileSync(
    path.join(root, '../frontend/src/views/preorders/page/PreorderFormModal.vue'),
    'utf8'
  )
  assert.match(preorderForm, /unifiedApi\.put\(`\/customers\/\$\{selectedCustomer\.value\.id\}`/)
  assert.match(preorderForm, /selectedCustomer\.value\.name = normalizedName/)
  assert.match(preorderForm, /selectedCustomer\.value = null[\s\S]*formData\.customer_id = null[\s\S]*formData\.customer_phone = ''/)
  assert.match(preorderForm, /const selected: CustomerOption = \{ \.\.\.customer \}[\s\S]*selectedCustomer\.value = selected[\s\S]*formData\.customer_id = selected\.id/)

  const nameEditors = [
    '../frontend/src/views/sales/useSalesCustomers.ts',
    '../frontend/src/components/query/QuickSaleModal.vue',
    '../frontend/src/components/query/QueryEditModal.vue',
    '../frontend/src/components/WholesaleModal.vue',
    '../frontend/src/views/preorders/page/PreorderFormModal.vue'
  ]
  for (const editorPath of nameEditors) {
    const editor = fs.readFileSync(path.join(root, editorPath), 'utf8')
    assert.match(editor, /normalizedCustomerName === normalizePersonName|formData\.customer_name === normalizePersonName|normalizedName === normalizePersonName/)
  }

  const salesCustomers = fs.readFileSync(
    path.join(root, '../frontend/src/views/sales/useSalesCustomers.ts'),
    'utf8'
  )
  const singleSave = salesCustomers.slice(
    salesCustomers.indexOf('const saveCustomerNameEdit'),
    salesCustomers.indexOf('const handleCustomerNameTouchEnd')
  )
  assert.doesNotMatch(singleSave, /apple_id|email/)
})

test('repair routes use canonical fields and never migrate schema during requests', () => {
  const route = read('src/routes/repairs.js')
  const readService = read('src/services/repair-read.service.js')
  const readRepository = read('src/repositories/repair-read.repository.js')
  const createRepository = read('src/repositories/repair-create.repository.js')
  const updateService = read('src/services/repair-update.service.js')
  const updateRepository = read('src/repositories/repair-update.repository.js')
  const statusRepository = read('src/repositories/repair-status.repository.js')
  const migration = read('scripts/migrate-repair-device-fields.js')
  const view = read('../frontend/src/views/repairs/RepairsView.vue')
  const api = read('../frontend/src/api/repairs.ts')
  const fieldRegistry = read('../frontend/src/config/moduleFields.js')
  const schemaBlock = route.slice(route.indexOf('const ensureRepairsSchema'), route.indexOf('const getDb'))
  const repairFieldStart = fieldRegistry.indexOf('repairs: {')
  const repairFieldEnd = fieldRegistry.indexOf('\n  menu: {', repairFieldStart)
  const repairFields = fieldRegistry.slice(repairFieldStart, repairFieldEnd)

  assert.match(schemaBlock, /SHOW COLUMNS FROM repairs/)
  assert.match(schemaBlock, /missingColumns/)
  assert.doesNotMatch(schemaBlock, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/i)
  assert.doesNotMatch(`${route}\n${readService}\n${readRepository}`, /req\.query\.limit/)
  assert.match(readService, /req\.query\.page_size/)
  assert.match(readService, /page_size:/)
  assert.match(readService, /total_pages:/)
  assert.match(readService, /has_next:/)
  assert.match(readService, /has_prev:/)
  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('repairs:view'\), repairReadController\.list\.bind/)
  assert.match(route, /router\.delete\('\/:id', unifiedAuth, requirePermission\('repairs:delete'\), repairStatusController\.cancel\.bind\(repairStatusController\)\)/)
  assert.match(statusRepository, /status = 'cancelled' WHERE id = \? AND status != 'completed'/)
  assert.match(route, /router\.get\('\/devices\/search'/)
  assert.match(route, /serial_number/)
  assert.match(route, /color_id/)
  assert.match(route, /memory_id/)
  assert.match(view, /prop="imei"\s+label="IMEI"/)
  assert.match(view, /prop="serial_number"\s+label="序列号"/)
  assert.doesNotMatch(view, /label="IMEI\/序列号"/)
  assert.match(view, /IMEI：\{\{ item\.imei \|\| '-' \}\}/)
  assert.match(view, /序列号：\{\{ item\.serial_number \|\| '-' \}\}/)
  assert.match(route, /'phone_id',[\s\S]*?'photos'/)
  assert.match(migration, /name: 'phone_id', definition: 'INT NULL'/)
  assert.match(migration, /name: 'photos', definition: 'LONGTEXT NULL'/)
  assert.match(migration, /name: 'repair_time', definition: 'DATETIME NULL'/)
  assert.match(migration, /UPDATE repairs SET repair_time = created_at WHERE repair_time IS NULL/)
  assert.match(migration, /const apply = process\.argv\.includes\('--apply'\)/)
  assert.match(route, /COALESCE\(r\.repair_time, r\.created_at\) AS repair_time/)
  assert.match(updateService, /add\('repair_time', value\)/)
  assert.doesNotMatch(route, /updates\.push\('created_at = \?'\)/)
  assert.match(createRepository, /created_at, repair_time, status/)
  assert.match(updateRepository, /UPDATE repairs SET \$\{fields\.join\(', '\)\} WHERE id = \?/)
  assert.match(read('src/services/data-masking.service.js'), /created_at: \['created_at', 'repair_time'\]/)
  assert.match(view, /v-if="canViewRepairField\('repair_time'\)"[\s\S]{0,120}label="维修时间"/)
  assert.doesNotMatch(view, /label="(?:更新时间|完成时间)"/)
  assert.match(view, /repair_time: 'time_info\.created_at'/)
  assert.doesNotMatch(route.slice(route.indexOf('const listQuery'), route.indexOf("router.get('/',")), /r\.updated_at|r\.completed_at/)
  assert.ok(repairFieldStart >= 0 && repairFieldEnd > repairFieldStart)
  assert.doesNotMatch(repairFields, /time_info\.(?:updated_at|completed_at)/)
  assert.doesNotMatch(view, /\b(?:monthlyRevenue|totalPages|pageSize)\b/)
  assert.match(view, /stats\.monthly_revenue/)
  assert.match(view, /pagination\.page_size/)
  assert.match(view, /v-if="canDelete"/)
  assert.match(view, /row\.status === 'completed'/)
  assert.match(view, /searchDeviceSuggestions/)
  assert.match(view, /handleDeviceSelect/)
  assert.match(view, /await repairsApi\.cancel\(repair\.id\)/)
  assert.match(read('src/config/permission-mapping.js'), /'repairs:delete': \['repairs_repairsview:delete'\]/)
  assert.match(api, /RepairOrderFilters/)
  assert.match(api, /searchDevices/)
})

test('store list exposes canonical snake_case pagination metadata', () => {
  const route = ['src/controllers/store.controller.js', 'src/services/store-management.service.js', 'src/repositories/store.repository.js'].map(read).join('\n')
  const storeRoutes = read('src/routes/stores.js')
  const view = read('../frontend/src/views/stores/StoresView.vue')
  const registry = JSON.parse(read('../config/field-contracts.json'))
  assert.match(route, /PAGINATION\.DEFAULT_LIMIT/)
  assert.doesNotMatch(route, /req\.query\.limit/)
  assert.match(route, /page_size: pageSize/)
  assert.match(route, /total_pages: Math\.ceil/)
  assert.match(route, /has_next:/)
  assert.match(route, /has_prev:/)
  assert.match(route, /with_manager/)
  assert.match(storeRoutes, /router\.put\('\/:id\(\\\\d\+\)'/)
  assert.match(route, /const \{ name, address, phone, manager_id/)
  assert.doesNotMatch(route, /SELECT\s+(?:s\.)?\*/)
  assert.doesNotMatch(route, /pagination:\s*\{[^}]*\blimit:/s)
  assert.match(view, /pagination\.page_size/)
  assert.match(view, /pagination\.total_pages/)
  assert.match(view, /manager_id: storeForm\.manager_id/)
  assert.doesNotMatch(view, /pagination\.(?:limit|pages)/)
  assert.deepEqual(registry.contracts.stores.legacy, [])
  for (const field of ['limit', 'pages', 'hasNext', 'hasPrev']) {
    assert.ok(registry.contracts.stores.retired.includes(field), `stores 未登记已退役字段 ${field}`)
  }
  assert.equal(registry.legacyBoundarySources.stores, undefined)
})

test('employee list exposes canonical snake_case pagination metadata', () => {
  const route = read('src/routes/employees.js')
  const directoryService = read('src/services/employee-directory.service.js')
  const directoryRepository = read('src/repositories/employee-directory.repository.js')
  const page = read('../frontend/src/views/employees/EmployeesView.vue')
  const types = read('../frontend/src/types/employee.ts')
  const registry = JSON.parse(read('../config/field-contracts.json'))
  const contract = registry.contracts.employees

  assert.deepEqual(contract.legacy, [])
  for (const field of ['limit', 'current', 'pageSize', 'pages', 'role_id', 'confirmPassword']) {
    assert.ok(contract.retired.includes(field), `employees 未登记已退役字段 ${field}`)
  }
  assert.equal(registry.legacyBoundarySources.employees, undefined)
  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('employee:view'\), employeeDirectoryController\.list\.bind/)
  assert.match(directoryService, /query\.page_size \?\? PAGINATION\.DEFAULT_LIMIT/)
  assert.doesNotMatch(directoryService, /query\.limit/)
  assert.match(directoryService, /page_size:/)
  assert.match(directoryService, /total_pages:/)
  assert.match(directoryService, /has_next: page < totalPages/)
  assert.match(directoryService, /has_prev: page > 1/)
  assert.match(directoryRepository, /as role_names/)
  assert.match(directoryService, /employees\.map\(formatEmployeeRoles\)/)
  assert.doesNotMatch(directoryRepository, /SELECT\s+\*/i)
  assert.doesNotMatch(directoryRepository, /\brole_id,\s*\n\s*role_ids\b/)
  assert.doesNotMatch(directoryService, /pagination:\s*\{[^}]*\bpageSize:/s)
  assert.match(page, /const page = ref\(1\)/)
  assert.match(page, /const page_size = ref\(10\)/)
  assert.match(page, /confirm_password/)
  assert.doesNotMatch(page, /confirmPassword|currentPage|pageSize|employee\.roles\b/)
  assert.doesNotMatch(page, /role:\s*employeeForm\.value\.role|role:\s*employee\.role/)
  assert.match(types, /role_ids: number\[\]/)
  assert.match(types, /page_size: number/)
  assert.match(types, /total_pages: number/)
  assert.doesNotMatch(types, /confirmPassword|role_ids\?: string/)
})

test('employee overview statistics route delegates with its original view permission', () => {
  const route = read('src/routes/employees.js')
  const controller = read('src/controllers/employee-statistics.controller.js')
  assert.match(route, /router\.get\('\/stats\/overview', unifiedAuth, requirePermission\('employee:view'\), employeeStatisticsController\.overview\.bind\(employeeStatisticsController\)\)/)
  assert.match(controller, /this\.service\.getOverviewStats\(req\.query\)/)
})


test('preorder list uses canonical page_size pagination at the API boundary', () => {
  const route = read('src/routes/preorders.js')
  const controller = read('src/controllers/preorder-read.controller.js')
  const service = read('src/services/preorder-read.service.js')
  const repository = read('src/repositories/preorder-read.repository.js')
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/preorder.ts'), 'utf8')
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/preorders/PreordersView.vue'), 'utf8')

  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('preorders:view'\), preorderReadController\.list\.bind/)
  assert.doesNotMatch(service, /query\.limit/)
  assert.match(service, /const pageSize = query\.page_size \?\? 20/)
  assert.match(service, /page_size: parsedPageSize/)
  assert.match(service, /total_pages: Math\.ceil/)
  assert.match(service, /has_next:/)
  assert.match(service, /has_prev:/)
  assert.match(controller, /this\.maskList\(result\.records, req\)/)
  assert.match(repository, /LIMIT \? OFFSET \?/)
  assert.match(api, /page_size\?: number/)
  assert.doesNotMatch(api, /limit\?: number/)
  assert.match(page, /page_size: pagination\.page_size/)
  assert.doesNotMatch(page, /limit: pagination\.limit/)
})

test('preorder creation delegates business rules and stock locking through service and repository', () => {
  const route = read('src/routes/preorders.js')
  const service = read('src/services/preorder-mutation.service.js')
  const repository = read('src/repositories/preorder-mutation.repository.js')

  assert.match(route, /preorderMutationController\.create\.bind\(preorderMutationController\)/)
  assert.match(service, /expected_arrival,\s*remarks/)
  assert.match(service, /const normalizedCondition = Number\(is_new\)/)
  assert.doesNotMatch(service, /is_new\s*\|\|\s*1/)
  assert.match(repository, /ORDER BY id ASC\s+LIMIT 1\s+FOR UPDATE/)
  assert.match(repository, /values\.remarks \|\| null/)
  assert.doesNotMatch(repository, /finalRemarks|_remarks/)
  assert.doesNotMatch(repository, /product_name,\s*\n\s*CASE\s*\n\s*p\.deposit_amount/)
})

test('preorder field controls cover business data, forms, responses and semantic actions', () => {
  const page = read('../frontend/src/views/preorders/PreordersView.vue')
  const form = read('../frontend/src/views/preorders/page/PreorderFormModal.vue')
  const matchModal = read('../frontend/src/views/preorders/page/MatchPreorderModal.vue')
  const fieldMap = read('../frontend/src/views/preorders/preorder-field-permissions.ts')
  const moduleFields = read('../frontend/src/config/moduleFields.js')
  const route = read('src/routes/preorders.js')

  for (const fieldId of [
    'basic_info.preorder_number',
    'supplier_info.supplier_name',
    'store_info.store_name',
    'customer_info.customer_name',
    'customer_info.customer_phone',
    'product_info.brand_name',
    'product_info.model_name',
    'product_info.color_name',
    'product_info.memory_size',
    'product_info.is_new',
    'product_info.imei',
    'product_info.serial_number',
    'price_info.deposit_amount',
    'price_info.total_price',
    'price_info.actual_price',
    'price_info.remaining_amount',
    'price_info.matchable_sale_price',
    'status_info.status',
    'time_info.expected_arrival',
    'time_info.created_at',
    'time_info.matched_time',
    'time_info.delivered_time',
    'operator_info.operator_name',
    'other_info.remarks',
    'system_info.operations'
  ]) {
    assert.match(moduleFields, new RegExp(`id: '${fieldId.replace('.', '\\.')}'`), `预定字段配置缺少 ${fieldId}`)
    assert.match(fieldMap, new RegExp(`'${fieldId.replace('.', '\\.')}'`), `预定字段映射缺少 ${fieldId}`)
  }

  for (const field of [
    'preorder_number', 'supplier_name', 'store_name', 'customer_name', 'customer_phone',
    'brand_name', 'model_name', 'color_name', 'memory_size', 'is_new', 'imei',
    'deposit_amount', 'total_price', 'actual_price', 'remaining_amount', 'status',
    'created_at', 'matched_time', 'delivered_time', 'operator_name'
  ]) {
    assert.match(page, new RegExp(`canViewPreorderField\\('${field}'\\)|show[A-Za-z]+${field.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('')}Field`), `预定列表缺少 ${field} 字段控制`)
  }

  assert.match(form, /pickVisiblePreorderFields/)
  assert.match(form, /canSubmitVisibleFields/)
  assert.doesNotMatch(form, /preorder_date|预定日期:/)
  assert.match(matchModal, /getVisibleProductName/)
  assert.match(matchModal, /canViewPreorderField\('matchable_sale_price'\)/)

  const pendingOperationStart = page.indexOf('v-if="showPendingActionField"')
  const pendingOperation = page.slice(pendingOperationStart, page.indexOf('</el-table-column>', pendingOperationStart))
  assert.match(pendingOperation, /editPreorder/)
  assert.match(pendingOperation, /openMatchModal/)
  assert.match(pendingOperation, /canCancel[\s\S]{0,180}cancelPreorder/)
  const matchedOperationStart = page.indexOf('v-if="showMatchedActionField"')
  const matchedOperation = page.slice(matchedOperationStart, page.indexOf('</el-table-column>', matchedOperationStart))
  assert.match(matchedOperation, /canMatch[\s\S]{0,220}openMatchModal/)
  assert.match(matchedOperation, /canDeliver[\s\S]{0,220}deliverPreorder/)
  assert.match(matchedOperation, /canCancel[\s\S]{0,220}cancelMatchedPreorder/)
  assert.match(matchedOperation, /canEdit[\s\S]{0,220}restorePreorder/)
  assert.match(page, /v-if="showMatchedStatusField"/)
  assert.match(page, /v-if="showMatchedTimeField"/)
  assert.match(page, /v-if="showMatchedDeliveryField"/)

  assert.match(route, /const PREORDER_WRITE_FIELD_IDS =/)
  assert.match(route, /rejectHiddenPreorderWriteFields/)
  const readController = read('src/controllers/preorder-read.controller.js')
  assert.match(readController, /this\.maskList\(result\.records, req\)/)
  assert.match(route, /preorderReadController\.getById\.bind\(preorderReadController\)/)
  const constants = read('src/config/preorder-response.constants.js')
  const coreFields = constants.match(/const PREORDER_CORE_FIELDS = \[([\s\S]*?)\]/)?.[1] || ''
  assert.ok(coreFields.length > 0, '预定核心响应字段未定义')
  assert.doesNotMatch(coreFields, /purchase_cost/)
})

test('data-check merge payloads use canonical snake_case IDs', () => {
  const controller = read('src/controllers/data-check.controller.js')
  const service = read('src/services/data-check.service.js')
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/data-optimization.ts'), 'utf8')
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/data-optimization/page/DataCheckTab.vue'), 'utf8')

  assert.match(controller, /primary_id/)
  assert.match(controller, /duplicate_ids/)
  assert.match(controller, /merge_groups/)
  assert.match(api, /primary_id: number/)
  assert.match(api, /duplicate_ids: number\[\]/)
  assert.match(api, /merge_groups:/)
  assert.doesNotMatch(api, /primaryId: number/)
  assert.doesNotMatch(api, /duplicateIds: number\[\]/)
  assert.match(page, /primary_id: group\.primary\.id/)
  assert.match(page, /merge_groups: merge_groups/)
  for (const source of [controller, service, page]) {
    assert.doesNotMatch(source, /\b(?:primaryId|duplicateIds|mergeGroups|duplicateCount|duplicateGroups|isDuplicateRows|isEmpty)\b/)
  }
  assert.match(service, /duplicate_groups:/)
  assert.match(service, /is_duplicate_rows:/)
  assert.match(service, /merged_ids:/)
  assert.doesNotMatch(controller, /error\.code === 'ER_NO_SUCH_TABLE'/)
})

test('customer lists and purchase history use canonical page_size pagination', () => {
  const route = read('src/routes/customers.js')
  const controller = read('src/services/customer-management.service.js')
  const repository = read('src/repositories/customer.repository.js')
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/customers/CustomersView.vue'), 'utf8')

  assert.match(controller, /page_size/)
  assert.match(controller, /page_size: pageSize/)
  assert.match(route, /customerController\.list\.bind\(customerController\)/)
  assert.match(controller, /total_pages:/)
  assert.match(controller, /has_next:/)
  assert.match(controller, /has_prev:/)
  assert.doesNotMatch(route, /req\.query\.limit/)
  assert.match(repository, /ORDER BY s\.sale_time DESC, s\.id DESC/)
  assert.match(repository, /s\.purchase_cost/)
  assert.match(repository, /s\.sale_price/)
  assert.match(repository, /LIMIT \? OFFSET \?/)
  assert.match(page, /page_size: pagination\.page_size/)
  assert.match(page, /page_size: purchasesPagination\.value\.page_size/)
  assert.doesNotMatch(page, /limit: pagination\.pageSize/)
  assert.doesNotMatch(page, /purchasesPagination\.value\.limit/)
})

test('customer stats expose canonical snake_case response fields', () => {
  const route = read('src/routes/customers.js')
  const controller = read('src/services/customer-management.service.js')
  const repository = read('src/repositories/customer.repository.js')
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/customers/CustomersView.vue'), 'utf8')
  for (const field of ['total_customers', 'active_customers', 'new_customers', 'premium_customers']) {
    assert.match(repository, new RegExp(field))
  }
  assert.match(controller, /this\.repository\.getStatistics\(query\)/)
  assert.match(route, /customerController\.getStatistics\.bind\(customerController\)/)
  assert.match(page, /data\.total_customers/)
  assert.doesNotMatch(page, /data\.totalCustomers|data\.activeCustomers|data\.newCustomers|data\.premiumCustomers/)
  assert.doesNotMatch(repository, /totalCustomers|activeCustomers|newCustomers|premiumCustomers/)
})

test('analytics API client declarations use canonical snake_case parameters', () => {
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/analytics.ts'), 'utf8')
  for (const field of ['start_date', 'end_date', 'store_id', 'product_id', 'page_size']) {
    assert.match(api, new RegExp(`${field}`), `analytics API 缺少 ${field}`)
  }
  for (const field of ['startDate', 'endDate', 'storeId', 'categoryId', 'productId']) {
    assert.doesNotMatch(api, new RegExp(`\\b${field}\\b`), `analytics API 仍声明旧字段 ${field}`)
  }
  // category_id only belonged to the retired, unsupported financial API.
  assert.doesNotMatch(api, /\bcategory_id\b/)
  assert.match(api, /unifiedApi\.get\('\/analytics\/sales-forecast', \{ params \}\)/)
  assert.doesNotMatch(api, /['"]\/analytics\/sales\/forecast['"]|['"]\/analytics\/financial(?:\/|['"])/)
})

test('brand list removes legacy pagination and wildcard response queries', () => {
  const controller = read('src/controllers/brand.controller.js')
  const service = read('src/services/brand-management.service.js')
  const repository = read('src/repositories/brand.repository.js')
  const page = read('../frontend/src/views/brands/BrandsView.vue')
  const callers = [
    read('../frontend/src/composables/useBrandModels.ts'),
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/price-list/PriceListView.vue')
  ]

  for (const source of [controller, service, repository]) {
    assert.doesNotMatch(source, /req\.query\.limit|\blimit\s*:/)
    assert.doesNotMatch(source, /\btotalPages\s*:|\bhasNextPage\s*:|\bhasPrevPage\s*:/)
  }
  for (const source of [controller, repository]) {
    assert.doesNotMatch(source, /SELECT\s+(?:[a-z]+\.)?\*/i)
  }
  assert.match(service, /query\.page_size\) \|\| PAGINATION\.DEFAULT_LIMIT/)
  assert.match(service, /page_size: pageSize/)
  assert.match(service, /const totalPages = Math\.ceil/)
  assert.match(service, /has_next: page < totalPages/)
  assert.match(service, /has_prev: page > 1/)
  assert.match(page, /page_size: Number\(apiPagination\.page_size\)/)
  assert.doesNotMatch(page, /apiPagination\.limit/)
  for (const caller of callers) {
    assert.doesNotMatch(caller, /\/brands\?[^'"\n]*\blimit=/)
  }
})

test('model routes and callers use canonical fields and explicit response columns', () => {
  const route = ['src/controllers/model.controller.js', 'src/services/model-management.service.js', 'src/repositories/model.repository.js', 'src/utils/reference-options.js'].map(read).join('\n')
  const modelRoutes = read('src/routes/models.js')
  const page = read('../frontend/src/views/models/ModelsView.vue')
  const stockIn = read('../frontend/src/components/stock-in/helpers.ts')
  const queryEdit = read('../frontend/src/components/query/QueryEditModal.vue')
  const priceList = read('../frontend/src/views/price-list/PriceListView.vue')
  const inventory = read('../frontend/src/views/inventory/InventoryView.vue')
  const remoteSearchStart = inventory.indexOf('const remoteSearchModel')
  const remoteSearchEnd = inventory.indexOf('\nconst ', remoteSearchStart + 1)
  const remoteSearch = inventory.slice(remoteSearchStart, remoteSearchEnd)

  assert.doesNotMatch(route, /req\.query\.(?:limit|sortBy|sortOrder)|\bis_active\b|\bseries\b/)
  assert.doesNotMatch(route, /SELECT\s+(?:[a-z]+\.)?\*/i)
  assert.match(route, /PAGINATION\.DEFAULT_LIMIT/)
  assert.match(route, /sort_by/)
  assert.match(route, /sort_order/)
  assert.match(route, /page_size: query\.page_size/)
  assert.match(route, /total_pages/)
  assert.match(route, /has_next: page < totalPages/)
  assert.match(route, /has_prev: page > 1/)
  assert.match(modelRoutes, /router\.get\('\/brand\/:brandId'/)
  assert.match(route, /name/)
  assert.match(route, /page_size/)
  assert.match(route, /for \(const field of \['brand_id', 'name', 'status', 'sort_order'\]\)/)
  assert.ok(
    modelRoutes.indexOf("router.get('/stats/overview'") < modelRoutes.indexOf("router.get('/:id'"),
    '型号统计静态路由必须位于动态详情路由之前'
  )

  assert.doesNotMatch(page, /\.is_active\b|paginationData\.limit|paginationData\.pages/)
  for (const caller of [stockIn, queryEdit, priceList]) {
    assert.doesNotMatch(caller, /\/models\?[^'"\n]*\blimit=/)
  }
  assert.doesNotMatch(stockIn, /page_size=10000|page_size:\s*10000/)
  assert.doesNotMatch(queryEdit, /page_size=10000|page_size:\s*10000/)
  assert.match(remoteSearch, /keyword: query\.trim\(\)/)
  assert.match(remoteSearch, /getModels\(\{/)
  assert.doesNotMatch(remoteSearch, /params\.append\('page_size', '50'\)/)
  assert.doesNotMatch(remoteSearch, /params\.append\('(?:search|limit)'/)
})

test('color routes and callers use live columns and canonical fields', () => {
  const colors = [read('src/controllers/color.controller.js'), read('src/services/reference-management.service.js'), read('src/repositories/reference-management.repository.js')].join('\n')
  const page = read('../frontend/src/views/colors/ColorsView.vue')
  const callers = [
    read('../frontend/src/composables/useBrandModels.ts'),
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/price-list/PriceListView.vue')
  ]

  assert.doesNotMatch(colors, /req\.query\.(?:limit|sortBy|sortOrder)|\bis_active\b|\bsearch\b|\bbrand_id\b|\bcategory\b|\bis_premium\b/)
  assert.doesNotMatch(colors, /SELECT\s+(?:[a-z]+\.)?\*/i)
  assert.doesNotMatch(colors, /\/categories\/list/)
  assert.match(colors, /defaultPageSize: PAGINATION\.DEFAULT_LIMIT/)
  assert.match(colors, /page_size: query\.page_size/)
  assert.match(colors, /buildPagination\(/)
  assert.match(colors, /related_phones/)

  assert.doesNotMatch(page, /\.is_active\b|\.hex_code\b|relatedPhones|\.\.\.apiPagination/)
  assert.match(page, /page_size: Number\(apiPagination\.page_size\)/)
  assert.match(page, /related_phones: Number\(data\.related_phones\)/)
  for (const caller of callers) {
    assert.doesNotMatch(caller, /\/colors\?[^'"\n]*\b(?:limit|sortBy|sortOrder)=/)
  }
})

test('memory routes and callers use live columns and canonical fields', () => {
  const memories = [read('src/controllers/memory.controller.js'), read('src/services/reference-management.service.js'), read('src/repositories/reference-management.repository.js')].join('\n')
  const memoryRoutes = read('src/routes/memories.js')
  const page = read('../frontend/src/views/memories/MemoriesView.vue')
  const callers = [
    read('../frontend/src/composables/useBrandModels.ts'),
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/price-list/PriceListView.vue')
  ]

  assert.doesNotMatch(memories, /req\.query\.(?:limit|sortBy|sortOrder)|\bis_active\b|\bsearch\b/)
  assert.doesNotMatch(memories, /SELECT\s+(?:[a-z]+\.)?\*/i)
  assert.doesNotMatch(memories, /price_multiplier|\/units\/list|\/init-missing|missingMemories/)
  assert.match(memories, /defaultPageSize: PAGINATION\.DEFAULT_LIMIT/)
  assert.match(memories, /sort_by/)
  assert.match(memories, /sort_order/)
  assert.match(memories, /page_size: query\.page_size/)
  assert.match(memories, /buildPagination\(/)
  assert.match(memoryRoutes, /requireAnyPermission\(\['memories:view', 'inventory:view', 'h5-templates:view', 'h5-admin:view'\]\)/)
  assert.match(memoryRoutes, /memoryController\.list\.bind\(memoryController\)/)

  assert.doesNotMatch(page, /\.is_active\b|relatedPhones|\.\.\.apiPagination|params\.(?:search|is_active)/)
  assert.match(page, /page_size: Number\(apiPagination\.page_size\)/)
  assert.match(page, /related_phones: Number\(data\.related_phones\)/)
  for (const caller of callers) {
    assert.doesNotMatch(caller, /\/memories\?[^'"\n]*\b(?:limit|sortBy|sortOrder)=/)
  }
  assert.doesNotMatch(callers[2], /memories:\s*\['64GB'|colors:\s*\['黑色'/)
  assert.doesNotMatch(callers[3], /options\.memories\s*=\s*\['64GB'|options\.brands\s*=\s*\['苹果'/)
})

test('supplier module uses canonical fields and explicit live-schema queries', () => {
  const route = read('src/routes/suppliers.js')
  const controller = read('src/controllers/supplier.controller.js')
  const service = read('src/services/supplier-management.service.js')
  const repository = read('src/repositories/supplier-management.repository.js')
  const page = read('../frontend/src/views/suppliers/SuppliersView.vue')
  const callers = [
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/inventory/InventoryView.vue'),
    read('../frontend/src/components/AccessoryStockInModal.vue'),
    read('../frontend/src/components/wholesale/helpers.ts'),
    read('../frontend/src/views/analytics/AnalyticsView.vue')
  ].join('\n')

  for (const source of [route, controller, service, repository, page]) {
    assert.doesNotMatch(source, /\b(?:totalPages|hasNextPage|hasPrevPage|supplier_accounts)\b/)
  }
  assert.doesNotMatch(route, /validateQueryParams|ApiResponse\.paginated|migrate-sort-order/)
  assert.doesNotMatch(route, /SELECT\s+(?:[a-z]+\.)?\*/i)
  assert.doesNotMatch(repository, /SELECT\s+(?:[a-z]+\.)?\*/i)
  assert.match(service, /page_size = DEFAULT_PAGE_SIZE/)
  assert.match(service, /buildPagination\(pageNum, pageSizeNum, total\)/)
  assert.match(repository, /COALESCE\(SUM\(purchase_cost\), 0\)/)
  assert.match(route, /router\.get\('\/', requirePermission\('suppliers:view'\), supplierController\.list\.bind\(supplierController\)\)/)
  assert.match(repository, /LIMIT \$\{page_size\} OFFSET \$\{offset\}/)
  assert.match(page, /has_next: Boolean\(apiPagination\.has_next\)/)
  assert.match(page, /has_prev: Boolean\(apiPagination\.has_prev\)/)
  assert.doesNotMatch(callers, /\/suppliers[^'"\n]*\blimit=/)
  assert.doesNotMatch(callers, /get\(['"]\/suppliers['"][^\n]{0,160}\ball\b/)
})

test('supplier payment phone list exposes canonical pagination fields', () => {
  const controller = read('src/controllers/supplier-payment.controller.js')
  const route = read('src/routes/supplier-payments.js')
  const service = read('src/services/supplier-payment.service.js')
  const page = read('../frontend/src/views/payments/SupplierPhonePaymentsView.vue')
  assert.match(controller, /page_size/)
  assert.match(service, /page_size/)
  assert.match(service, /total_pages:/)
  assert.match(service, /has_next:/)
  assert.match(service, /has_prev:/)
  assert.match(service, /p\.inventory_time/)
  assert.match(service, /LEFT JOIN sales sale ON sale\.id = p\.sale_id/)
  assert.match(service, /LEFT JOIN brands br ON p\.brand_id = br\.id/)
  assert.doesNotMatch(`${route}\n${controller}\n${service}\n${page}`, /\b(?:limit|totalPages|hasNextPage|hasPrevPage|purchase_date)\b/)
  assert.match(service, /FOR UPDATE/)
  assert.match(service, /beginTransaction\(\)/)
  assert.match(service, /phone\.status === 'supplier_proxy'/)
  assert.match(page, /inventory_time\?: string \| null/)
  assert.match(page, /pagination\.has_next = Boolean/)
  assert.match(page, /pagination\.has_prev = Boolean/)
})

test('attendance pagination uses canonical fields and passes page options to repository', () => {
  const controller = read('src/controllers/attendance.controller.js')
  const repository = read('src/repositories/attendance.repository.js')
  const service = read('src/services/attendance.service.js')
  const accessControl = read('src/services/access-control.service.js')
  const salaryController = read('src/controllers/salary-record.controller.js')
  const permissionMapping = read('src/config/permission-mapping.js')
  const capabilities = read('src/config/module-permission-capabilities.json')
  const page = read('../frontend/src/views/attendance/AttendanceView.vue')
  const salaryPage = read('../frontend/src/views/salary/SalaryView.vue')
  assert.match(controller, /page_size/)
  assert.doesNotMatch(controller, /req\.query\.limit/)
  assert.match(controller, /ATTENDANCE_WRITE_FIELDS/)
  assert.match(controller, /selectAttendanceWriteFields\(req\.body\)/)
  assert.doesNotMatch(controller, /\.\.\.req\.body/)
  assert.match(controller, /const \{ status, approval_note \} = req\.body/)
  assert.match(controller, /scopeInfo\.isAdmin[\s\S]{0,160}: userId/)
  assert.match(controller, /filters\.employee_id = scopedEmployeeId/)
  assert.doesNotMatch(repository, /options\.limit/)
  assert.match(repository, /page_size: limitInt/)
  assert.match(repository, /total_pages: Math\.ceil/)
  assert.match(repository, /has_next:/)
  assert.match(repository, /has_prev:/)
  assert.match(page, /page_size: 20/)
  assert.match(page, /pagination\.page_size/)
  assert.match(page, /myPagination\.page_size/)
  assert.doesNotMatch(page, /pagination\.size|myPagination\.size/)
  assert.doesNotMatch(page, /limit: 1000/)
  assert.match(read('../frontend/src/api/attendance.ts'), /\{ status, approval_note \}/)
  assert.doesNotMatch(`${service}\n${page}`, /\b(?:absent_days|absent_reason)\b/)
  assert.doesNotMatch(service, /base_salary \|\| 3000|\|\| 20|\|\| 100|baseSalary \/ 174/)
  assert.match(accessControl, /const canViewAll = isAdminRole \|\| allPermissions\.some/)
  assert.match(accessControl, /allModuleKeys: \['attendance_attendanceview'\]/)
  assert.match(accessControl, /ownModuleKeys: \['attendance_myattendanceview', 'attendance_attendanceview'\]/)
  assert.match(accessControl, /allModuleKeys: \['salary_salaryrecordsview'\]/)
  assert.match(accessControl, /ownModuleKeys: \['salary_mysalaryview', 'salary_salaryrecordsview'\]/)
  assert.match(salaryController, /resolveScopedTargetId\(scopeInfo, userId, employee_id\)/)
  assert.match(salaryController, /filters\.status = 'paid'/)
  assert.match(page, /v-if="canViewAllAttendance"/)
  assert.match(page, /authStore\.hasPermission\('attendance:view:all'\)/)
  assert.match(salaryPage, /const canViewTeamSalaryRecords = computed\(\(\) => canViewSalaryRecords\.value\)/)
  assert.match(permissionMapping, /'attendance:view:all': \['attendance_attendanceview:view'\]/)
  assert.match(permissionMapping, /'attendance:view:own': \['attendance_attendanceview:view:own', 'attendance_myattendanceview:view'\]/)
  assert.match(permissionMapping, /'salary-records:view:all': \['salary_salaryrecordsview:view'\]/)
  assert.match(permissionMapping, /'salary-records:view:own': \['salary_mysalaryview:view'\]/)
  assert.match(capabilities, /"attendance_attendanceview": \["view", "create", "edit", "delete", "approve"\]/)
  assert.match(capabilities, /"attendance_myattendanceview": \["view", "create"\]/)
})

test('subsidy uses canonical pagination and handler fields without runtime schema migration', () => {
  const route = read('src/routes/subsidy.js')
  const protectedPhotoUrl = read('src/utils/subsidy-protected-photo-url.js')
  const page = read('../frontend/src/views/subsidy/SubsidyView.vue')
  const list = read('../frontend/src/views/subsidy/components/SubsidyListSection.vue')
  const applyDialog = read('../frontend/src/views/subsidy/components/SubsidyApplyDialog.vue')
  const editDialog = read('../frontend/src/views/subsidy/components/SubsidyEditDialog.vue')
  const detailDialog = read('../frontend/src/views/subsidy/components/SubsidyDetailDialog.vue')
  const photoDialog = read('../frontend/src/views/subsidy/components/SubsidyPhotoManageDialog.vue')
  const moduleFields = read('../frontend/src/config/moduleFields.js')
  const fieldPermissions = read('../frontend/src/composables/useFieldPermissions.ts')
  const permissionMapping = read('src/config/permission-mapping.js')
  const unifiedAuth = read('src/middleware/unified-auth.js')
  const masking = read('src/services/data-masking.service.js')
  const cache = read('src/middleware/cache.js')
  const permissionRoute = read('src/routes/permission-management.js')
  const roleFieldPermissionsController = read('src/controllers/role-field-permissions.controller.js')
  const roleFieldPermissionsService = read('src/services/role-field-permissions.service.js')
  const subsidyStatsService = read('src/services/subsidy-stats.service.js')
  const subsidyListController = read('src/controllers/subsidy-list.controller.js')
  const subsidyListService = read('src/services/subsidy-list.service.js')
  const subsidyListRepository = read('src/repositories/subsidy-list.repository.js')
  const subsidyExportService = read('src/services/subsidy-export.service.js')
  const subsidyExportFile = read('src/utils/subsidy-export-file.js')
  const capabilities = read('src/config/module-permission-capabilities.json')
  const sources = `${route}\n${page}\n${list}\n${applyDialog}\n${editDialog}\n${detailDialog}\n${photoDialog}`

  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('subsidy:view'\), cacheMiddleware\(\{ ttl: CACHE_TTL\.SHORT \}\), subsidyListController\.list\.bind\(subsidyListController\)\)/)
  assert.match(subsidyListService, /query\.page_size \|\| 20/)
  assert.match(subsidyListService, /page_size: pageSize/)
  assert.match(subsidyListService, /total_pages: totalPages/)
  assert.match(subsidyListService, /has_next: page < totalPages/)
  assert.match(subsidyListService, /has_prev: page > 1/)
  assert.match(subsidyListRepository, /LIMIT \? OFFSET \?/)
  assert.match(subsidyListController, /获取国补列表成功/)
  assert.match(sources, /has_different_handler/)
  assert.match(sources, /handler_info/)
  assert.match(sources, /handler_name/)
  assert.match(sources, /handler_phone/)
  assert.match(sources, /handler_idcard/)
  assert.match(capabilities, /"subsidy_subsidyview": \["view", "create", "edit", "delete", "approve", "arrival", "upload", "export"\]/)
  assert.match(permissionMapping, /'subsidy:arrival': \['subsidy_subsidyview:arrival', 'subsidy:arrival'\]/)
  assert.match(permissionMapping, /'subsidy:upload': \['subsidy_subsidyview:upload', 'subsidy:upload'\]/)
  assert.match(unifiedAuth, /'arrival'/)
  assert.match(unifiedAuth, /'upload'/)
  assert.match(route, /router\.put\('\/:id\/audit', unifiedAuth, requirePermission\('subsidy:approve'\)/)
  assert.match(route, /router\.put\('\/:id\/confirm-arrival', unifiedAuth, requirePermission\('subsidy:arrival'\)/)
  assert.match(route, /router\.get\('\/:id\/photos', unifiedAuth, requireSubsidyUpload/)
  assert.match(route, /router\.put\('\/:id\/photos', unifiedAuth, requireSubsidyUpload/)
  assert.match(route, /router\.post\('\/upload\/photo', unifiedAuth, requireSubsidyUpload/)
  assert.match(protectedPhotoUrl, /createPrivateFileUrl\(\{/)
  assert.match(route, /verifyPrivateFileAccess\(\{/)
  assert.match(protectedPhotoUrl, /namespace: 'subsidy-file'/)
  assert.doesNotMatch(route, /req\.query\.token|verifyToken/)
  assert.match(route, /requirePermission\('subsidy:export'\)/)
  assert.match(route, /subsidyExportController\.exportExcel\.bind\(subsidyExportController\)/)
  assert.match(subsidyListService, /maskDataList\(formatted, userId, 'subsidy_subsidyview'\)/)
  assert.match(subsidyExportService, /buildExportFile\(items, hiddenFields\)/)
  assert.match(subsidyExportFile, /exportColumns\.filter\(\(\[fieldId\]\) => !hiddenFields\.has\(fieldId\)\)/)
  assert.match(subsidyStatsService, /hiddenFields\.has\('stats\.amount_progress'\)/)
  assert.match(route, /rejectHiddenSubsidyWriteFields/)
  assert.match(masking, /config\.hidden_fields/)
  assert.match(masking, /phone_brand/)
  assert.match(cache, /req\.user\?\.id \|\| 'anonymous'/)
  assert.match(permissionRoute, /router\.put\('\/field-permissions\/:role_id', requirePermission\('permissions:admin'\), roleFieldPermissionsController\.update\.bind\(roleFieldPermissionsController\)\)/)
  assert.match(roleFieldPermissionsController, /this\.service\.saveForRole\(roleId, moduleKey, fieldConfig, req\)/)
  assert.match(roleFieldPermissionsService, /await connection\.commit\(\)[\s\S]*permissionLogs\.logPermissionOperation/)
  assert.match(fieldPermissions, /Some callers still use a short page key/)
  assert.match(fieldPermissions, /getNormalizedModuleKeys\(configuredKey\)/)
  assert.match(page, /const SUBSIDY_FIELD_MODULE_KEY = 'subsidy_subsidyview'/)
  assert.match(page, /searchableFields\.forEach/)
  assert.match(fieldPermissions, /export const shouldShowActionColumn/)
  assert.match(fieldPermissions, /fieldVisible \|\| actionPermissions\.some\(Boolean\)/)
  assert.match(page, /const canShowActions = computed\(\(\) => shouldShowActionColumn/)
  assert.match(page, /canViewField\('actions'\),\s*\[canEdit\.value, canDelete\.value\]/)
  assert.match(page, /key: 'apply_time',[\s\S]{0,180}shouldShowActionColumn\(fieldVisibility\.value\.apply_time, \[canApprove\.value\]\)/)
  assert.match(page, /key: 'arrival_time',[\s\S]{0,180}shouldShowActionColumn\(fieldVisibility\.value\.arrival_time, \[canArrival\.value\]\)/)
  assert.match(page, /\{ key: 'actions', label: '操作', visible: canShowActions\.value \}/)
  assert.match(page, /\{ key: 'subsidy_photos', label: '国补照片', visible: fieldVisibility\.value\.subsidy_photos \|\| canUpload\.value \}/)
  assert.match(page, /const SUBSIDY_PHOTO_CACHE_TTL_MS = 5 \* 60 \* 1000/)
  assert.match(page, /useCachedRequest\([\s\S]{0,300}unifiedApi\.get(?:<[^>]+>)?\(photoEndpoint, \{[\s\S]{0,160}useCache: false,[\s\S]{0,160}SUBSIDY_PHOTO_CACHE_TTL_MS[\s\S]{0,100}useStale: false/)
  assert.match(page, /const preloadPhotoManageDialog = \(item: NationalSubsidyRecord\)/)
  assert.match(page, /@preload-photo-manage="preloadPhotoManageDialog"/)
  assert.match(list, /@pointerenter="emit\('preload-photo-manage', row\)"/)
  assert.match(page, /showLoading,[\s\S]{0,40}showError: showLoading/)
  assert.match(photoDialog, /<AsyncImage[\s\S]{0,180}mode="lazy"/)
  const applyTimeColumn = list.slice(
    list.indexOf('column.key === \'apply_time\''),
    list.indexOf('column.key === \'arrival_time\'')
  )
  const arrivalTimeColumn = list.slice(
    list.indexOf('column.key === \'arrival_time\''),
    list.indexOf('column.key === \'actions\'')
  )
  const operationColumnStart = list.indexOf('column.key === \'actions\'')
  const operationColumn = list.slice(operationColumnStart, list.indexOf('</el-table>', operationColumnStart))
  assert.match(applyTimeColumn, /v-else-if="canApprove"[\s\S]*emit\('audit', row\)/)
  assert.match(arrivalTimeColumn, /v-else-if="canArrival"[\s\S]*emit\('confirm-arrival', row\)/)
  assert.doesNotMatch(operationColumn, /canApprove|canArrival|emit\('audit'|emit\('confirm-arrival'/)
  assert.match(operationColumn, /v-if="canEdit"/)
  assert.match(operationColumn, /v-if="canDelete"/)
  const mobileWorkflowStart = list.indexOf('class="mobile-workflow-fields"')
  const mobileWorkflow = list.slice(mobileWorkflowStart, list.indexOf('class="mobile-card-actions"', mobileWorkflowStart))
  assert.match(mobileWorkflow, /fieldVisibility\.apply_time \|\| canApprove[\s\S]*emit\('audit', item\)/)
  assert.match(mobileWorkflow, /fieldVisibility\.arrival_time \|\| canArrival[\s\S]*emit\('confirm-arrival', item\)/)
  assert.doesNotMatch(list, /v-memo=/)
  assert.doesNotMatch(sources, /fieldVisibility\.(?:storeName|salesmanName|saleTime|customerName|customerPhone|customerIdcard|serialNumber|salePrice|subsidyAmount|subsidyRate|subsidyCalcPrice|applyTime|arrivalTime|subsidyPhotos)/)
  assert.match(photoDialog, /@click="downloadToolbarPhotos"/)
  assert.match(photoDialog, /v-if="canUpload"[\s\S]{0,180}@click="deleteToolbarPhotos"/)
  assert.match(photoDialog, /if \(!canUpload\.value\) \{\s+globalNotifications\.warning\('您没有图片上传权限'\)/)
  assert.match(editDialog, /v-if="canViewField\('apply_time'\) \|\| canApprove \|\| canViewField\('arrival_time'\) \|\| canArrival"/)
  assert.match(editDialog, /v-if="canApprove"\s+label="提交时间"/)
  assert.match(editDialog, /v-if="canArrival"\s+label="到账时间"/)
  assert.match(editDialog, /if \(canApprove\.value\) \{\s+payload\.apply_time/)
  assert.match(editDialog, /if \(canArrival\.value\) \{\s+payload\.arrival_time/)
  assert.doesNotMatch(editDialog, /canViewField\('apply_time'\) && canApprove/)
  assert.doesNotMatch(editDialog, /canViewField\('arrival_time'\) && canArrival/)
  assert.match(applyDialog, /v-if="canViewField\('subsidy_calc_price'\) \|\| canViewField\('subsidy_photos'\) \|\| canUpload"/)
  assert.match(applyDialog, /<el-upload\s+v-if="canUpload"/)
  assert.doesNotMatch(applyDialog, /canViewField\('subsidy_photos'\) && canUpload/)
  for (const fieldId of [
    'store_info.store_name', 'sales_info.salesman_name', 'customer_info.customer_idcard',
    'device_info.serial_number', 'price_info.subsidy_rate', 'price_info.subsidy_calc_price',
    'subsidy_info.subsidy_photos', 'handler_info.handler_name', 'handler_info.handler_phone',
    'handler_info.handler_idcard', 'time_info.sale_time', 'system_info.operations'
  ]) {
    assert.ok(moduleFields.includes(`id: '${fieldId}'`), `subsidy 字段登记缺少 ${fieldId}`)
  }
  assert.doesNotMatch(route, /req\.query\.limit/)
  assert.doesNotMatch(sources, /\b(?:hasDifferentHandler|handlerInfo|handlerName|handlerPhone|handlerIdcard)\s*[:.=?]/)
  assert.doesNotMatch(route, /CREATE TABLE IF NOT EXISTS national_subsidies|ALTER TABLE national_subsidies/)
})

test('field-aware action columns use field-or-action visibility without hiding authorized buttons', () => {
  const actionColumnFiles = [
    '../frontend/src/views/brands/BrandsView.vue',
    '../frontend/src/views/models/ModelsView.vue',
    '../frontend/src/views/colors/ColorsView.vue',
    '../frontend/src/views/memories/MemoriesView.vue',
    '../frontend/src/views/employees/EmployeesView.vue',
    '../frontend/src/views/suppliers/SuppliersView.vue',
    '../frontend/src/views/stores/StoresView.vue',
    '../frontend/src/views/customers/CustomersView.vue',
    '../frontend/src/views/payments/SupplierPhonePaymentsView.vue',
    '../frontend/src/views/preorders/PreordersView.vue',
    '../frontend/src/views/repairs/RepairsView.vue',
    '../frontend/src/views/attendance/AttendanceView.vue',
    '../frontend/src/views/menu/MenuManagementView.vue',
    '../frontend/src/views/query/QueryView.vue',
    '../frontend/src/views/subsidy/SubsidyView.vue',
    '../frontend/src/views/H5-admin/page/orders.vue',
    '../frontend/src/views/price-list/page/SyncLogView.vue',
    '../frontend/src/views/sales/page/SalesGridView.vue',
    '../frontend/src/views/sales/page/SalesTableView.vue',
    '../frontend/src/views/salary/page/SalaryAttendanceListDialog.vue',
    '../frontend/src/views/salary/page/SalaryEmployeesTab.vue',
    '../frontend/src/views/salary/page/SalaryMyRecordsTab.vue',
    '../frontend/src/views/salary/page/SalaryPayoutTab.vue',
    '../frontend/src/views/salary/page/SalaryTemplatesTab.vue',
    '../frontend/src/views/permissions/PermissionsView.vue',
    '../frontend/src/views/permissions/page/ModuleManagementView.vue',
    '../frontend/src/views/inventory/InventoryView.vue'
  ]

  for (const file of actionColumnFiles) {
    assert.match(read(file), /shouldShowActionColumn/, `${file} 未使用统一操作列可见性规则`)
  }

  const payment = read('../frontend/src/views/payments/SupplierPhonePaymentsView.vue')
  assert.doesNotMatch(payment, /can(?:Create|View|Edit|Delete)Payment && canViewPaymentField\('actions'\)/)
  assert.match(payment, /const showPaymentTimeColumn = computed\(\(\) => \{[\s\S]{0,260}shouldShowActionColumn\([\s\S]{0,120}canViewPaymentField\('payment_time'\),\s*\[canCreatePayment\.value\]/)
  assert.match(payment, /v-(?:else-)?if="canCreatePayment && row\.payment_status === 'unpaid'"[\s\S]{0,260}handleSinglePayment\(row\)/)
  const paymentOperationStart = payment.indexOf('v-if="showPaymentActionField"')
  const paymentOperation = payment.slice(paymentOperationStart, payment.indexOf('<template #empty>', paymentOperationStart))
  assert.doesNotMatch(paymentOperation, /handleSinglePayment|canCreatePayment/)

  const attendance = read('../frontend/src/views/attendance/AttendanceView.vue')
  assert.match(attendance, /const showAttendanceStatusColumn = computed\(\(\) => shouldShowActionColumn\([\s\S]{0,180}\[canApprove\.value\]/)
  const attendanceStatusStart = attendance.indexOf('v-if="showAttendanceStatusColumn"')
  const attendanceStatus = attendance.slice(attendanceStatusStart, attendance.indexOf('v-if="showAttendanceApprovalColumn"', attendanceStatusStart))
  assert.match(attendanceStatus, /canApprove && row\.status === 'pending'[\s\S]{0,500}handleApprove\(row\)/)
  const attendanceOperationStart = attendance.indexOf('v-if="showAttendanceActionField"')
  const attendanceOperation = attendance.slice(attendanceOperationStart, attendance.indexOf('</el-table>', attendanceOperationStart))
  assert.doesNotMatch(attendanceOperation, /canApprove|handleApprove/)

  const salaryPayout = read('../frontend/src/views/salary/page/SalaryPayoutTab.vue')
  assert.match(salaryPayout, /const showStatusColumn = computed\(\(\) => shouldShowActionColumn\([\s\S]*?\[\]\s*\)\)/)
  const salaryStatusStart = salaryPayout.indexOf('v-if="showStatusColumn"')
  const salaryStatus = salaryPayout.slice(salaryStatusStart, salaryPayout.indexOf("canViewField('salary_salaryrecordsview', 'paid_at')", salaryStatusStart))
  assert.match(salaryStatus, /canViewField\('salary_salaryrecordsview', 'salary_status'\)/)
  assert.doesNotMatch(salaryStatus, /emit\('(recalculate|settle)'/)
  const salaryOperationStart = salaryPayout.indexOf('v-if="!isMobile && showActionColumn"')
  const salaryOperation = salaryPayout.slice(salaryOperationStart, salaryPayout.indexOf('</el-table>', salaryOperationStart))
  assert.match(salaryOperation, /v-if="canCreate"[\s\S]{0,320}emit\('recalculate', row\) : emit\('settle', row\)/)

  const salesGrid = read('../frontend/src/views/sales/page/SalesGridView.vue')
  assert.doesNotMatch(salesGrid, /can(?:Create|Edit|Delete) && canViewField\('actions'\)/)

  const roles = read('../frontend/src/views/permissions/page/RolesPage.vue')
  const userRoles = read('../frontend/src/views/permissions/page/UserRolesPage.vue')
  const storeBindings = read('../frontend/src/views/permissions/page/StoreBindingsPage.vue')
  for (const page of [roles, userRoles, storeBindings]) {
    assert.match(page, /v-if="ctx\.showPermissionsActionField"/)
  }
  assert.doesNotMatch(roles, /您没有(?:编辑|删除)角色的权限/)
})

test('H5 admin order list exposes canonical pagination fields', () => {
  const route = read('src/routes/sales-management.js')
  const controller = read('src/controllers/sales-management.controller.js')
  const legacyRoute = read('src/routes/shop.js')
  const shopController = read('src/controllers/shop-management.controller.js')
  const publicService = read('src/services/shop-public.service.js')
  const shopService = read('src/services/shop.service.js')
  const adminStart = controller.indexOf('async list(req, res)')
  const adminEnd = controller.indexOf('async detail(req, res)', adminStart)
  const adminList = controller.slice(adminStart, adminEnd)
  const legacyStart = shopController.indexOf('async getOrders(req, res)')
  const legacyEnd = shopController.indexOf('async getOrderDetail(req, res)', legacyStart)
  const legacyList = shopController.slice(legacyStart, legacyEnd)
  const publicListStart = publicService.indexOf('async getH5OrdersList')
  const publicListEnd = publicService.indexOf('async getH5OrderDetail', publicListStart)
  const publicList = publicService.slice(publicListStart, publicListEnd)
  const shopListStart = shopService.indexOf('async getOrders')
  const shopListEnd = shopService.indexOf('async getOrderDetail', shopListStart)
  const shopList = shopService.slice(shopListStart, shopListEnd)

  for (const source of [adminList, legacyList, publicList, shopList]) {
    assert.match(source, /page_size/)
    assert.match(source, /total_pages/)
    assert.match(source, /has_next/)
    assert.match(source, /has_prev/)
    assert.doesNotMatch(source, /req\.query\.limit|\bstartDate\b|\bendDate\b|\blimit\s*[:=,}]/)
  }
  assert.match(adminList, /start_date/)
  assert.match(adminList, /end_date/)
  assert.match(route, /router\.get\('\/h5-orders', requireAnyPermission\(H5_ORDER_VIEW_PERMISSIONS\), salesManagementController\.list\.bind\(salesManagementController\)\)/)
  const legacyRouteStart = legacyRoute.indexOf("router.get('/orders'")
  const legacyRouteEnd = legacyRoute.indexOf("router.get('/orders/:id'", legacyRouteStart)
  const legacyListRoute = legacyRoute.slice(legacyRouteStart, legacyRouteEnd)
  assert.match(legacyListRoute, /requireAnyPermission\(H5_ORDER_VIEW_PERMISSIONS\)/)
  assert.match(legacyListRoute, /shopManagementController\.getOrders\.bind\(shopManagementController\)/)
  assert.match(legacyList, /start_date/)
  assert.match(legacyList, /end_date/)
  assert.doesNotMatch(`${publicList}\n${shopList}`, /SELECT\s+(?:o\.)?\*/)
  assert.doesNotMatch(`${publicService}\n${shopService}`, /confirmed_by|confirmed_at/)
})

test('H5 customer order lookup exposes canonical pagination fields', () => {
  const route = read('src/routes/shop-public.js')
  const controller = read('src/controllers/shop-public-catalog.controller.js')
  const service = read('src/services/shop-public.service.js')
  const rateLimit = read('src/middleware/rate-limit.js')
  const api = read('../frontend/src/api/shop-public.ts')
  const myOrders = read('../frontend/src/views/H5-mobile/page/MyOrders.vue')
  const orderQuery = read('../frontend/src/views/H5-mobile/page/OrderQuery.vue')
  const routeStart = route.indexOf("router.get('/orders/phone/:customer_phone'")
  const routeEnd = route.indexOf("router.put('/orders/:id/status'", routeStart)
  const handler = route.slice(routeStart, routeEnd)
  const serviceStart = service.indexOf('async getOrdersByPhone')
  const serviceEnd = service.indexOf('async updateOrderStatus', serviceStart)
  const method = service.slice(serviceStart, serviceEnd)

  assert.ok(routeStart >= 0, '公开订单手机号查询路由不存在')
  assert.match(handler, /shopPublicCatalogController\.getOrdersByPhone\.bind\(shopPublicCatalogController\)/)
  assert.match(read('src/services/data-import-history.service.js'), /query\.page_size/)
  assert.match(controller, /customer_phone/)
  assert.match(controller, /customer_name/)
  assert.match(controller, /this\.sendPaginated\(res, result, '获取订单列表成功'\)/)
  assert.match(handler, /publicLookupRateLimit,\s*publicOrderPhoneLookupRateLimit/)
  assert.match(rateLimit, /const publicOrderPhoneLookupRateLimit = rateLimit\(\{[\s\S]*?windowMs: 15 \* 60 \* 1000,[\s\S]*?max: 10,[\s\S]*?req\.params\?\.customer_phone/)
  assert.doesNotMatch(handler, /req\.query\.limit|ApiResponse\.paginated/)
  assert.match(method, /\{ page, page_size, customer_name \}/)
  assert.doesNotMatch(method, /SELECT\s+(?:oi\.)?\*/)
  assert.match(api, /page_size\?: number/)
  assert.match(api, /customer_name\?: string/)
  assert.doesNotMatch(api, /\n\s+limit: pageSize/)
  assert.doesNotMatch(api, /getOrdersByPhone\(phone:/)
  assert.doesNotMatch(myOrders, /\n\s+name: name\.value|\n\s+phone: phone\.value/)
  assert.doesNotMatch(orderQuery, /\n\s+name: form\.values\.name|\n\s+phone: form\.values\.phone/)
  assert.match(myOrders, /customer_name: customer_name\.value/)
  assert.match(orderQuery, /customer_name: form\.values\.customer_name/)
})

test('H5 public product lists use canonical page_size at API and page boundaries', () => {
  const route = read('src/routes/shop-public.js')
  const controller = read('src/controllers/shop-public-catalog.controller.js')
  const service = read('src/services/shop-public.service.js')
  const page = read('../frontend/src/views/H5-mobile/page/ProductList.vue')
  const api = read('../frontend/src/api/shop-public.ts')
  for (const endpoint of ["router.get('/products'", "router.get('/products/aggregate'", "router.get('/products/search/:keyword'"]) {
    const start = route.indexOf(endpoint)
    assert.ok(start >= 0, `公开商品接口不存在: ${endpoint}`)
    const next = route.indexOf('router.get(', start + endpoint.length)
    const handler = route.slice(start, next > start ? next : undefined)
    assert.match(handler, /shopPublicCatalogController\.(?:getProducts|getAggregatedProducts|searchProducts)\.bind\(shopPublicCatalogController\)/)
  }
  assert.match(controller, /sendPaginated\(res, result, message\)[\s\S]*total_pages: result\.total_pages/)
  assert.match(controller, /sendPaginated\(res, result, message\)[\s\S]*has_next: result\.has_next/)
  assert.match(controller, /sendPaginated\(res, result, message\)[\s\S]*has_prev: result\.has_prev/)
  assert.match(controller, /normalizePublicPagination/)
  assert.match(controller, /page_size/)
  assert.match(controller, /this\.sendPaginated\(res, result/)
  assert.doesNotMatch(controller, /req\.query\.limit|ApiResponse\.paginated|result\.limit/)
  for (const methodName of ['getProducts', 'getNewProductsFromTemplates', 'searchProducts', 'getAggregatedProducts', 'getUsedProducts']) {
    const start = service.indexOf(`async ${methodName}`)
    const next = service.indexOf('\n  async ', start + 1)
    const method = service.slice(start, next > start ? next : undefined)
    assert.ok(start >= 0, `公开商品服务方法不存在: ${methodName}`)
    assert.match(method, /page_size/)
    assert.doesNotMatch(method, /\blimit\b|totalPages|hasNextPage|hasPrevPage/)
  }
  assert.match(service, /LEFT JOIN colors c ON p\.color_id = c\.id/)
  assert.match(service, /LEFT JOIN memories mem ON p\.memory_id = mem\.id/)
  assert.match(service, /c\.id as color_id/)
  assert.match(service, /mem\.id as memory_id/)
  assert.match(page, /const page_size = 20/)
  assert.match(page, /page_size,/)
  assert.match(page, /response\.page_size/)
  assert.match(api, /page_size: number/)
  assert.match(api, /total_pages/)
  assert.doesNotMatch(api, /pagination\.limit|record\.limit|pagination\.totalPages|pagination\.hasNextPage|pagination\.hasPrevPage/)
})

test('salary template pagination reads options.page_size and binds template_id', () => {
  const controller = read('src/controllers/salary-template.controller.js')
  const recordController = read('src/controllers/salary-record.controller.js')
  const repository = read('src/repositories/salary-template.repository.js')
  const api = read('../frontend/src/api/salary-template.ts')
  assert.match(controller, /page_size/)
  assert.match(controller, /const \{ template_id \} = req\.body/)
  assert.match(repository, /page_size/)
  assert.match(repository, /page_size: limitNum/)
  assert.match(repository, /total_pages:/)
  assert.match(repository, /has_next:/)
  assert.match(repository, /has_prev:/)
  assert.match(api, /page_size\?: number/)
  assert.match(api, /template_id: templateId/)
  assert.doesNotMatch(api, /\{ templateId \}/)
  assert.doesNotMatch(controller, /req\.query\.limit|req\.body\?\.templateId/)
  assert.doesNotMatch(recordController, /\blimit\b/)
})

test('salary template queries use columns present in the live schema', () => {
  const repository = read('src/repositories/salary-template.repository.js')
  const api = read('../frontend/src/api/salary-template.ts')
  for (const field of [
    'commission_new_fixed',
    'commission_used_fixed',
    'rest_days',
    'auto_raise_rule',
    'is_default'
  ]) {
    assert.match(repository, new RegExp(`'${field}'`))
  }
  for (const field of [
    'leave_daily_deduction',
    'absent_daily_deduction',
    'salary_cycle_days',
    'social_insurance_rate',
    'tax_rate',
    'created_by'
  ]) {
    assert.doesNotMatch(repository, new RegExp(`'${field}'`), `工资模板 SQL 仍读取不存在的 ${field}`)
    assert.doesNotMatch(api, new RegExp(`\\b${field}\\b`), `工资模板 API 类型仍声明不存在的 ${field}`)
  }
})

test('salary template default and active operations use the live schema', () => {
  const repository = read('src/repositories/salary-template.repository.js')
  assert.match(repository, /setAsDefault\(id\)/)
  assert.match(repository, /beginTransaction\(\)/)
  assert.match(repository, /UPDATE \$\{this\.tableName\} SET is_default = 0/)
  assert.match(repository, /SET is_default = 1 WHERE id = \?/)
  assert.match(repository, /WHERE is_active = 1/)
})

test('permission management lists expose canonical pagination and log date fields', () => {
  const management = read('src/routes/permission-management.js')
  const usersListController = read('src/controllers/permission-users-list.controller.js')
  const usersListService = read('src/services/permission-users-list.service.js')
  const usersListRepository = read('src/repositories/permission-users-list.repository.js')
  const logs = read('src/controllers/permission-logs.controller.js')
  const logsService = read('src/services/permission-logs.service.js')
  const logsRepository = read('src/repositories/permission-logs.repository.js')
  const userStoreController = read('src/services/user-store.service.js')
  const modules = read('src/routes/module-management.js')
  const moduleManagementController = read('src/controllers/module-management.controller.js')
  const moduleManagementRepository = read('src/repositories/module-management.repository.js')
  const rolePermissionsService = read('src/services/role-permissions.service.js')
  const moduleScanner = read('src/services/module-scanner.service.js')
  const menuLinker = read('src/services/menu-module-linker.service.js')
  const page = read('../frontend/src/views/permissions/PermissionsView.vue')
  const logsPage = read('../frontend/src/views/permissions/page/LogsPage.vue')
  const modulePage = read('../frontend/src/views/permissions/page/ModuleManagementView.vue')
  assert.match(management, /router\.get\('\/users-with-roles', requirePermission\('permissions:admin'\), permissionUsersListController\.list\.bind/)
  assert.match(usersListController, /this\.service\.list\(req\.query\)/)
  assert.match(usersListService, /PERMISSION_LIST_DEFAULT_PAGE_SIZE/)
  assert.match(usersListService, /PERMISSION_LIST_MAX_PAGE_SIZE/)
  assert.match(usersListService, /page_size: pageSize/)
  assert.match(usersListService, /total_pages: Math\.ceil/)
  assert.match(usersListService, /has_next:/)
  assert.match(usersListService, /has_prev:/)
  assert.match(usersListRepository, /LIMIT \? OFFSET \?/)
  assert.doesNotMatch(management, /req\.query\.page_size \?\? req\.query\.limit/)
  assert.match(logs, /page_size/)
  assert.match(logsRepository, /LIMIT \? OFFSET \?/)
  assert.match(logsRepository, /\.\.\.params, pageSize, offset/)
  assert.match(logs, /start_date/)
  assert.match(logs, /end_date/)
  assert.match(logsService, /created_at >= \?/)
  assert.match(logsService, /created_at <= \?/)
  assert.match(logs, /total_pages:/)
  assert.doesNotMatch(logs, /page_size \?\? size|req\.query\.startDate|req\.query\.endDate/)
  assert.doesNotMatch(logs, /targetType|targetId|targetName|permission\.moduleKey|permission\.permissionType/)
  assert.doesNotMatch(userStoreController, /req\.body\?\.(?:userId|storeIds|isPrimary|replaceExisting)/)
  assert.match(userStoreController, /body\?\.user_id/)
  assert.match(userStoreController, /body\?\.store_ids/)
  assert.match(moduleManagementController, /const \{ module_key: moduleKey \} = req\.body/)
  assert.match(moduleManagementController, /const \{ module_keys: moduleKeys \} = req\.body/)
  assert.match(moduleManagementController, /const \{ name, is_custom: isCustom = true \} = req\.body/)
  assert.doesNotMatch(modules, /const \{ (?:moduleKey|moduleKeys|menuId|isActive|isCustom)/)
  assert.doesNotMatch(modules, /rolePermissions:|oldName:|newName:|isCustomName:|originalName:/)
  assert.doesNotMatch(moduleScanner, /moduleKey:|isNewModule:|isCustomName:|lastModified:/)
  assert.doesNotMatch(menuLinker, /menuId:|moduleKey:|moduleId:|totalMenus:|linkRate:|notFound:/)
  assert.doesNotMatch(logsPage, /\.moduleKey|\.permissionType|logsPagination\.size/)
  assert.doesNotMatch(modulePage, /\.pageSize|\.isCustom|\.isActive|\.currentName|\.originalName/)
  assert.match(page, /page_size/)
  assert.match(page, /start_date:/)
  assert.match(page, /end_date:/)
  assert.doesNotMatch(page, /params\.append\('limit'/)
  assert.match(page, /stats\.total_roles/)
  assert.doesNotMatch(page, /stats\.totalRoles/)
  assert.match(modules, /moduleManagementController\.overviewStats\.bind/)
  assert.match(moduleManagementController, /this\.service\.getOverviewStats\(\)/)
  assert.match(moduleManagementRepository, /total_modules: totalModules\.total/)
  assert.match(moduleManagementRepository, /total_permissions: totalPermissions\.total/)
  assert.match(moduleManagementRepository, /total_roles: totalRoles\.total/)
  assert.match(moduleManagementRepository, /active_users: activeUsers\.total/)
  assert.doesNotMatch(moduleManagementRepository, /totalModules:/)
  assert.doesNotMatch(moduleManagementRepository, /totalPermissions:/)
  assert.doesNotMatch(moduleManagementRepository, /totalRoles:/)
  assert.doesNotMatch(moduleManagementRepository, /activeUsers:/)
  assert.match(rolePermissionsService, /total_modules: resultModules\.length/)
  assert.doesNotMatch(management, /total_modules: modules\.length/)
  assert.match(page, /meta\.total_modules/)
  assert.doesNotMatch(page, /meta\.totalModules/)
  assert.doesNotMatch(page, /Pagination\.size/)
  assert.match(page, /userSearchForm\.role_id/)
  assert.match(page, /role_ids: selectedUserRoleIds\.value/)
  assert.match(page, /field_config:/)
  assert.doesNotMatch(logs, /\n\s+size: sizeNum/)
})

test('user-store routes preserve per-operation permissions and delegate to controller', () => {
  const route = read('src/routes/user-stores.js')
  const controller = read('src/services/user-store.service.js')
  assert.match(route, /router\.get\('\/user\/:user_id', unifiedAuth, requirePermission\('users:view'\), userStoreController\.getUserStores\.bind/)
  assert.match(route, /router\.get\('\/store\/:store_id', unifiedAuth, requirePermission\('stores:view'\), userStoreController\.getStoreUsers\.bind/)
  assert.equal((route.match(/requireAnyPermission\(\['users:edit', 'permissions:admin'\]\)/g) || []).length, 4)
  assert.doesNotMatch(route, /async\s*\(/)
  assert.match(controller, /replace_existing \?\? false/)
  assert.match(controller, /assignedBy = this\.getActorId\(actor\)/)
  assert.match(controller, /logStoreBindingChange\(context, userId, previousStores, currentStores/)
})

test('permissions contract retires removed API aliases without runtime compatibility', () => {
  const registry = JSON.parse(read('../config/field-contracts.json'))
  const contract = registry.contracts.permissions

  assert.deepEqual(contract.legacy, [])
  for (const field of [
    'limit', 'roleId', 'startDate', 'endDate', 'size', 'userId', 'storeIds',
    'moduleKey', 'moduleKeys', 'permissionType', 'fieldConfig', 'isActive',
    'isCustom', 'targetType', 'targetId', 'targetName', 'hiddenFields', 'editableFields'
  ]) {
    assert.ok(contract.retired.includes(field), `permissions 未登记已退役字段 ${field}`)
  }
  assert.equal(registry.legacyBoundarySources.permissions, undefined)
})

test('users contract uses canonical pagination and explicit public columns', () => {
  const route = read('src/routes/users.js')
  const controller = read('src/services/user-management.service.js')
  const repository = read('src/repositories/user.repository.js')
  const api = read('../frontend/src/api/user.ts')
  const queryModal = read('../frontend/src/components/query/QueryEditModal.vue')
  const registry = JSON.parse(read('../config/field-contracts.json'))
  const contract = registry.contracts.users

  assert.deepEqual(contract.legacy, [])
  for (const field of ['limit', 'totalPages', 'hasNextPage', 'hasPrevPage', 'group_name']) {
    assert.ok(contract.retired.includes(field), `users 未登记已退役字段 ${field}`)
  }
  assert.equal(registry.legacyBoundarySources.users, undefined)
  assert.match(route, /userController\.list\.bind\(userController\)/)
  assert.match(controller, /const \{ page = 1, page_size, role, status = '1' \} = query/)
  assert.match(controller, /page_size: pageSizeInt/)
  assert.match(controller, /total_pages: result\.pagination\.total_pages/)
  assert.match(controller, /has_next: result\.pagination\.has_next/)
  assert.match(controller, /has_prev: result\.pagination\.has_prev/)
  assert.match(route, /userController\.profile\.bind\(userController\)/)
  assert.match(controller, /data: userProfile, message: '获取用户档案成功'/)
  assert.match(route, /userController\.getById\.bind\(userController\)/)
  assert.match(controller, /data: user, message: '获取用户详情成功'/)
  assert.match(read('src/repositories/user-mutation.repository.js'), /USER_PUBLIC_COLUMNS/)
  assert.doesNotMatch(route, /SELECT \* FROM users|req\.query\.limit|\n\s+limit:/)
  assert.match(repository, /Number\.parseInt\(page_size, 10\)/)
  assert.match(repository, /u\.email, u\.store_id/)
  assert.match(repository, /GROUP_CONCAT\(r\.name ORDER BY r\.id SEPARATOR ', '\) as role/)
  assert.match(repository, /INNER JOIN roles filter_r/)
  assert.doesNotMatch(repository, /INNER JOIN roles r ON ur\.role_id/)
  assert.match(repository, /page_size: normalizedPageSize/)
  assert.match(repository, /total_pages/)
  assert.match(repository, /has_next/)
  assert.match(repository, /has_prev/)
  assert.doesNotMatch(repository, /SELECT\s+u\.\*/)
  assert.doesNotMatch(repository, /SELECT\s+\*\s+FROM\s+users/i)
  assert.doesNotMatch(repository, /\bu\.role\b|\bu\.group_name\b/)
  assert.doesNotMatch(route, /\bu\.role\b|\bu\.group_name\b|\bgroup_name\b/)
  assert.match(route, /router\.post\('\/', unifiedAuth, requirePermission\('users:create'\), userController\.create\.bind\(userController\)\)/)
  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('users:edit'\), userController\.update\.bind\(userController\)\)/)
  assert.doesNotMatch(route, /router\.(?:post|put)\([^\n]*async\s*\(/)
  assert.match(api, /page_size\?: number/)
  assert.match(api, /total_pages: number/)
  assert.doesNotMatch(api, /\blimit\??:|totalPages|hasNextPage|hasPrevPage/)
  assert.doesNotMatch(queryModal, /\/users\/employees\?limit=/)
})

test('reminders contract uses canonical options and explicit response columns', () => {
  const route = read('src/routes/reminders.js')
  const controller = read('src/controllers/reminder.controller.js')
  const service = read('src/services/reminder.service.js')
  const page = read('../frontend/src/views/reminders/ReminderView.vue')
  const registry = JSON.parse(read('../config/field-contracts.json'))
  const contract = registry.contracts.reminders

  assert.deepEqual(contract.legacy, [])
  for (const field of ['limit', 'totalPages']) {
    assert.ok(contract.retired.includes(field), `reminders 未登记已退役字段 ${field}`)
  }
  assert.equal(registry.legacyBoundarySources.reminders, undefined)
  assert.match(controller, /page_size: req\.query\.page_size/)
  assert.match(controller, /type_id: req\.query\.type_id/)
  assert.match(controller, /user_id: req\.user\.id/)
  assert.match(controller, /can_manage: this\.canManage\(req\)/)
  assert.doesNotMatch(controller, /req\.query\.limit|pageSize:|typeId:|userId:|canManage:/)
  assert.match(service, /async list\(\{ page = 1, page_size = 20, keyword = '', search_fields = \['title', 'content'\], status = '', type_id = '', user_id = null, can_manage = false \}/)
  assert.match(service, /async getById\(id, \{ user_id = null, can_manage = true \}/)
  assert.match(service, /REMINDER_SELECT_COLUMNS/)
  assert.match(service, /REMINDER_ALIASED_COLUMNS/)
  assert.match(service, /REMINDER_TYPE_COLUMNS/)
  assert.doesNotMatch(service, /SELECT\s+\*|SELECT\s+r\.\*/i)
  assert.doesNotMatch(service, /\.\.\.rule|r\.repeat_rule,rt\.name/)
  assert.match(service, /page_size: page_size_number/)
  assert.match(service, /total_pages,/)
  assert.match(service, /has_next: page_number < total_pages/)
  assert.match(service, /has_prev: page_number > 1/)
  assert.match(page, /page_size:\s*pagination\.page_size/)
  assert.doesNotMatch(page, /params:\{[^}]*\blimit:/)
  assert.match(page, /remote-method="searchReminderUsers"/)
  assert.match(page, /const loadUsers = async \(keyword = ''\)/)
  assert.match(page, /api\.get<ReminderUser\[]>\('\/reminders\/users'/)
  assert.match(page, /keyword:\s*keyword\.trim\(\) \|\| undefined,\s*page:\s*1,\s*page_size:\s*20/)
  assert.match(page, /const selectedIds = new Set\(form\.target_user_ids\)/)
  assert.match(page, /\.\.\.selected\.filter\(user => !results\.some\(item => item\.id === user\.id\)\)/)
  assert.doesNotMatch(page, /\bas any\b|:\s*any\b|<any>/)
  assert.match(controller, /REMINDER_FIELD_MODULE_KEY = 'reminders_reminderview'/)
  assert.match(controller, /maskPayloadWithPermissions/)
  assert.match(controller, /rejectHiddenWrites/)
  assert.match(controller, /code: 'FIELD_PERMISSION_DENIED'/)
  assert.match(route, /reminderController\.rejectHiddenWrites/)
  assert.match(service, /allowed_search_fields/)
  assert.match(page, /pickVisibleReminderFields/)
  assert.match(page, /shouldShowActionColumn/)
  assert.match(read('../frontend/src/components/ReminderHost.vue'), /canViewReminderField\('recipient_status'\)/)
  assert.match(read('../frontend/src/config/moduleFields.js'), /execution_info\.recipient_status/)
})

test('shared experience contract controls fields and uses canonical pagination', () => {
  const route = read('src/routes/shared.js')
  const controller = read('src/controllers/shared.controller.js')
  const service = read('src/services/shared.service.js')
  const page = read('../frontend/src/views/shared/SharedView.vue')
  const helper = read('../frontend/src/views/shared/shared-field-permissions.ts')
  const registry = JSON.parse(read('../config/field-contracts.json'))
  const contract = registry.contracts.shared

  assert.deepEqual(contract.legacy, [])
  for (const field of ['limit', 'totalPages', 'hasNextPage', 'hasPrevPage']) {
    assert.ok(contract.retired.includes(field), `shared 未登记已退役字段 ${field}`)
  }
  assert.equal(registry.legacyBoundarySources.shared, undefined)
  assert.match(controller, /SHARED_FIELD_MODULE_KEY = 'shared_sharedview'/)
  assert.match(controller, /maskPayloadWithPermissions/)
  assert.match(route, /sharedController\.rejectHiddenWrites/)
  assert.match(route, /sharedController\.requireVisibleField/)
  assert.match(controller, /search_fields/)
  assert.match(controller, /code: 'FIELD_PERMISSION_DENIED'/)
  assert.match(service, /async list\(userId, \{ page = 1, page_size = 12, keyword = '', search_fields/)
  assert.doesNotMatch(service, /SELECT\s+p\.\*/i)
  assert.match(service, /page_size: page_size_int/)
  assert.match(service, /total_pages/)
  assert.match(service, /has_next/)
  assert.match(service, /has_prev/)
  assert.match(page, /pagination\.page_size/)
  assert.doesNotMatch(page, /pagination\.limit|page:pagination\.page,limit:/)
  assert.match(page, /pickVisibleSharedFields/)
  assert.match(page, /showPostActionColumn/)
  assert.match(helper, /post_info\.attachments/)
})

test('role field permission keys migrate transactionally to registered modules', () => {
  const migration = read('scripts/migrate-role-field-module-keys.js')
  const route = read('src/routes/permission-management.js')
  const roleFieldPermissionsController = read('src/controllers/role-field-permissions.controller.js')
  const roleFieldPermissionsService = read('src/services/role-field-permissions.service.js')
  const normalizer = read('src/utils/field-permission-normalizer.js')
  const migrationNormalizer = read('scripts/field-permission-migration-normalizer.js')
  const configMigration = read('scripts/migrate-role-field-config-json.js')

  assert.match(migration, /process\.argv\.includes\('--execute'\)/)
  assert.match(migration, /beginTransaction\(\)/)
  assert.match(migration, /connection\.rollback\(\)/)
  assert.match(migration, /unmatched_after/)
  assert.match(migration, /query: 'query_queryview'/)
  assert.match(migration, /subsidy: 'subsidy_subsidyview'/)
  assert.match(migrationNormalizer, /'time_info\.Inventorytime': 'time_info\.inventory_time'/)
  assert.match(migrationNormalizer, /'basic_info\.purchase_price': 'basic_info\.purchase_cost'/)
  assert.doesNotMatch(normalizer, /Inventorytime|purchase_price|hiddenFields|editableFields/)
  assert.match(configMigration, /process\.argv\.includes\('--execute'\)/)
  assert.match(configMigration, /beginTransaction\(\)/)
  assert.match(configMigration, /connection\.rollback\(\)/)
  assert.doesNotMatch(configMigration, /\b(?:DELETE|DROP|TRUNCATE|INSERT)\b/)
  assert.doesNotMatch(route, /shortModuleKey/)
  assert.doesNotMatch(route, /req\.body\?\.moduleKey/)
  assert.doesNotMatch(route, /req\.body\?\.fieldConfig/)
  assert.match(route, /router\.put\('\/field-permissions\/:role_id', requirePermission\('permissions:admin'\), roleFieldPermissionsController\.update\.bind\(roleFieldPermissionsController\)\)/)
  assert.match(roleFieldPermissionsController, /this\.service\.saveForRole\(roleId, moduleKey, fieldConfig, req\)/)
  assert.match(roleFieldPermissionsService, /'模块不存在或已停用'/)
})

test('H5 public product errors use safe server responses', () => {
  const controller = read('src/controllers/shop-public-catalog.controller.js')
  for (const message of ['获取商品列表失败', '获取聚合商品列表失败', '搜索商品失败']) {
    assert.match(controller, new RegExp(`this\\.response\\.serverError\\(res, '${message}', error\\)`))
  }
})
