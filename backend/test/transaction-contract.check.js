'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('employee role assignment validates IDs and uses a transaction', () => {
  const source = read('src/routes/employees.js');
  const handler = source.slice(source.indexOf("router.post('/:id/roles'"));

  assert.match(handler, /beginTransaction\(\)/);
  assert.match(handler, /commit\(\)/);
  assert.match(handler, /rollback\(\)/);
  assert.match(handler, /roleIds\.map\(\(\) => '\(\?, \?, NOW\(\)\)'\)/);
  assert.match(handler, /roleParams/);
});

test('permission-management role assignment validates IDs and rolls back failures', () => {
  const source = read('src/routes/permission-management.js');
  const handler = source.slice(source.indexOf("router.put('/users/:id/roles'"));

  assert.match(handler, /beginTransaction\(\)/);
  assert.match(handler, /commit\(\)/);
  assert.match(handler, /rollback\(\)/);
  assert.match(handler, /normalizedRoleIds\.map\(\(\) => '\?'\)/);
  assert.match(handler, /normalizedRoleIds\s*\n?\s*\)/);
});

test('sales trend route keeps both canonical and legacy paths', () => {
  const source = read('src/routes/analytics.js');
  assert.match(source, /router\.get\(\[\s*['"]\/sales\/trends['"]\s*,\s*['"]\/sales-trends['"]\s*\]/);
  assert.match(source, /db\.execute\(\`[\s\S]*FROM sales s[\s\S]*INNER JOIN phones p/);
});

test('sales inventory checks lock rows and update only in-stock devices', () => {
  const source = read('src/routes/sales.js');
  const start = source.indexOf("router.post('/phone'");
  const end = source.indexOf("router.post('/batch'");
  const handler = source.slice(start, end > start ? end : undefined);

  assert.ok(start >= 0, '手机销售路由不存在');
  assert.match(handler, /WHERE p\.id IN \(\$\{phoneIds\.map\(\(\) => '\?'\)\.join\(','\)\}\)/);
  assert.match(handler, /FOR UPDATE/);
  assert.match(handler, /WHERE id = \? AND status = 'in_stock'/);
  assert.match(handler, /beginTransaction\(\)/);
  assert.match(handler, /commit\(\)/);
  assert.match(handler, /rollback\(\)/);
});

test('available sales inventory uses bounded canonical pagination and safe errors', () => {
  const route = read('src/routes/sales.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/sales/SalesView.vue'), 'utf8');
  const start = route.indexOf("router.get('/phones/available'");
  const end = route.indexOf("router.get('/phones/available/export'");
  const handler = route.slice(start, end > start ? end : undefined);

  assert.match(handler, /page_size/);
  assert.match(handler, /String\(page_size \?\? 100\)/);
  assert.doesNotMatch(handler, /legacyLimit|req\.query\.limit|limit:/);
  assert.match(handler, /requestedPageSize < 1 \|\| requestedPageSize > 500/);
  assert.match(handler, /page_size: limitNum/);
  assert.match(handler, /total_pages:/);
  assert.match(handler, /has_next:/);
  assert.match(handler, /ApiResponse\.serverError\(res, '获取可销售设备列表失败', error\)/);
  assert.match(view, /params\.page_size = pagination\.page_size/);
  assert.doesNotMatch(view, /params\.limit = pagination\./);
});

test('sales inventory detail uses canonical page_size and inventory_time', () => {
  const route = read('src/routes/sales.js');
  const start = route.indexOf("router.get('/inventory-detail'");
  const handler = route.slice(start);

  assert.match(handler, /page_size/);
  assert.match(handler, /String\(page_size \?\? 500\)/);
  assert.doesNotMatch(handler, /legacyLimit|req\.query\.limit|limit:/);
  assert.match(handler, /pageSize < 1 \|\| pageSize > 500/);
  assert.match(handler, /p\.inventory_time AS inventory_time/);
  assert.match(handler, /queryParams\.push\(pageSize\)/);
  assert.match(handler, /ApiResponse\.serverError\(res, '获取库存明细失败', error\)/);
});

test('sales inventory summary validates canonical date and store filters', () => {
  const route = read('src/routes/sales.js');
  const start = route.indexOf("router.get('/inventory-summary'");
  const end = route.indexOf("router.get('/inventory-detail'");
  const handler = route.slice(start, end > start ? end : undefined);

  assert.match(handler, /start_date/);
  assert.match(handler, /end_date/);
  assert.match(handler, /String\(start_date \?\? ''\)/);
  assert.match(handler, /String\(end_date \?\? ''\)/);
  assert.doesNotMatch(handler, /legacyDateStart|legacyDateEnd|date_start:|date_end:/);
  assert.match(handler, /Number\.parseInt\(String\(store_id\)/);
  assert.match(handler, /开始日期不能晚于结束日期/);
  assert.match(handler, /ApiResponse\.serverError\(res, '获取库存统计失败', error\)/);
});

test('high-value customer report uses a compatible read query', () => {
  const source = read('src/routes/analytics.js');
  const start = source.indexOf("router.get('/customers/high-value'");
  const end = source.indexOf("router.get('/customers/:id/detail'");
  const handler = source.slice(start, end);

  assert.ok(start >= 0 && end > start, '高价值客户路由不存在');
  assert.match(handler, /db\.query\(customersQuery, \[\.\.\.saleParams, \.\.\.searchParams\]\)/);
  assert.match(handler, /db\.query\(countQuery, \[\.\.\.saleParams, \.\.\.searchParams\]\)/);
});

test('rate-limit audit creates its table idempotently', () => {
  const source = read('src/middleware/rate-limit.js');
  const appSource = read('src/app.js');
  assert.match(source, /CREATE TABLE IF NOT EXISTS rate_limit_logs/);
  assert.match(source, /ensureRateLimitLogTable\(database\)/);
  assert.match(appSource, /await ensureRateLimitLogTable\(getDatabase\(\)\)/);
});

test('phone update contract exposes canonical time and cost fields', () => {
  const source = read('src/routes/phones.js');
  const editModal = fs.readFileSync(path.join(root, '../frontend/src/components/query/QueryEditModal.vue'), 'utf8');
  assert.match(source, /inventory_time/);
  assert.match(source, /sale_time/);
  assert.match(source, /purchase_cost/);
  assert.match(source, /inventory_time: phone\.inventory_time \|\| null/);
  assert.match(source, /sale_time: phone\.sale_time \|\| null/);
  assert.doesNotMatch(source, /\bInventorytime\b|\bsalestime\b|\bstock_in_date\b/);
  assert.match(editModal, /formData\.purchase_cost/);
  assert.match(editModal, /formData\.inventory_time/);
  assert.match(editModal, /formData\.sale_time/);
  assert.doesNotMatch(editModal, /formData\.purchase_price/);
  assert.doesNotMatch(editModal, /formData\.Inventorytime/);
  assert.doesNotMatch(editModal, /formData\.salestime/);
});

test('phone edits require canonical database IDs', () => {
  const source = read('src/routes/phones.js');
  const start = source.indexOf("router.put('/:id'");
  const end = source.indexOf("router.delete(");
  const handler = source.slice(start, end > start ? end : undefined);

  assert.ok(start >= 0 && end > start, '手机编辑路由不存在');
  assert.match(handler, /const effectiveBrandId = valueOrCurrent\(brand_id, currentPhone\.brand_id\)/);
  assert.match(handler, /const effectiveModelId = valueOrCurrent\(model_id, currentPhone\.model_id\)/);
  assert.match(handler, /const effectiveColorId = valueOrCurrent\(color_id, currentPhone\.color_id\)/);
  assert.match(handler, /const effectiveMemoryId = valueOrCurrent\(memory_id, currentPhone\.memory_id\)/);
  assert.match(handler, /const brandId = Number\(effectiveBrandId\)/);
  assert.match(handler, /const modelId = Number\(effectiveModelId\)/);
  assert.match(handler, /const colorId = Number\(effectiveColorId\)/);
  assert.match(handler, /const memoryId = Number\(effectiveMemoryId\)/);
  assert.match(handler, /every\(Number\.isInteger\)/);
  assert.doesNotMatch(handler, /SELECT id FROM (?:brands|models|colors|memories) WHERE (?:name|size) = \?/);
});

test('stock-in accepts only canonical inventory fields', () => {
  const route = read('src/routes/stock-in.js');
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/helpers.ts'), 'utf8');
  const payloadBuilder = frontend.slice(frontend.indexOf('export const buildStockInSubmitPayload'));
  const createStart = route.indexOf("router.post('/', unifiedAuth");
  const updateStart = route.indexOf("router.put('/:id'");
  const createHandler = route.slice(createStart, updateStart);

  assert.ok(createStart >= 0 && updateStart > createStart);
  assert.match(createHandler, /const inventoryTime = inventory_time/);
  assert.match(createHandler, /const finalRemarks = remarks \?\? ''/);
  assert.match(createHandler, /total_amount: products\.reduce\([\s\S]*product\.purchase_cost/);
  assert.match(createHandler, /inventory_time: inventoryTime/);
  assert.match(createHandler, /operator_name: actualOperatorName/);
  assert.match(createHandler, /is_new: condition === '全新' \? 1 : 0/);
  assert.match(createHandler, /product\.is_new\]\)/);
  assert.doesNotMatch(createHandler, /stock_in_date|purchase_price|\bnotes\b|\n\s+actualOperatorName,/);
  assert.match(payloadBuilder, /inventory_time: formData\.inventory_time/);
  assert.match(payloadBuilder, /purchase_cost: phone\.purchase_cost/);
  assert.match(payloadBuilder, /remarks: formData\.remarks/);
  assert.doesNotMatch(payloadBuilder, /stock_in_date:/);
  assert.doesNotMatch(payloadBuilder, /purchase_price:/);
  assert.doesNotMatch(payloadBuilder, /notes:\s*formData\.remarks/);
});

test('stock-in page uses canonical cost and inventory time fields', () => {
  const helpers = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/helpers.ts'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/types.ts'), 'utf8');
  const basic = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/StockInBasicInfoSection.vue'), 'utf8');
  const list = fs.readFileSync(path.join(root, '../frontend/src/components/stock-in/StockInPhoneListSection.vue'), 'utf8');
  const modal = fs.readFileSync(path.join(root, '../frontend/src/components/StockInModal.vue'), 'utf8');

  for (const source of [helpers, types, basic, list, modal]) {
    assert.doesNotMatch(source, /purchase_price/);
    assert.doesNotMatch(source, /stock_in_date/);
    assert.doesNotMatch(source, /Inventorytime/);
  }
  assert.match(helpers, /purchase_cost/);
  assert.match(helpers, /inventory_time/);
  assert.match(list, /phones\.\$\{index\}\.purchase_cost/);
  assert.match(basic, /formData\.inventory_time/);
});

test('rental API enforces canonical payload and field-permission contracts', () => {
  const source = read('src/routes/rentals.js');
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/rentals/rental-payload.ts'), 'utf8');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/rentals/RentalsView.vue'), 'utf8');
  const fieldPermissions = fs.readFileSync(path.join(root, '../frontend/src/views/rentals/rental-field-permissions.ts'), 'utf8');
  const moduleFields = fs.readFileSync(path.join(root, '../frontend/src/config/moduleFields.js'), 'utf8');
  for (const field of ['customer_id', 'phone_id', 'billing_mode', 'sale_price', 'start_date', 'remarks']) {
    assert.match(frontend, new RegExp(`${field}:`), `租赁 payload 缺少 ${field}`);
  }
  assert.match(source, /router\.post\('\/'/);
  assert.match(source, /const billingMode = req\.body\?\.billing_mode/);
  assert.match(source, /const salePrice = Number\(req\.body\?\.sale_price/);
  assert.match(source, /const startDate = String\(req\.body\?\.start_date/);
  assert.match(source, /RENTAL_FIELD_MODULE_KEY = 'rentals_rentalsview'/);
  assert.match(source, /rejectHiddenRentalWriteFields/);
  assert.match(source, /maskRentalList\(rows, req\)/);
  assert.match(source, /rentalUpdates\.join\(','\)/);
  assert.match(source, /req\.query\.page_size/);
  assert.match(source, /total_pages: totalPages/);
  assert.match(source, /has_next: page < totalPages/);
  assert.match(source, /has_prev: page > 1/);
  assert.doesNotMatch(source, /SELECT \* FROM rentals/);
  assert.match(source, /SELECT id,status,billing_mode,phone_id,unit_price,start_date/);
  assert.doesNotMatch(source, /req\.query\.limit|hasMore|pagination: \{ page, limit/);
  assert.match(view, /pickVisibleRentalFields\(rawPayload,rentalPayloadFieldMap\)/);
  assert.match(view, /v-model:page-size="pagination\.page_size"/);
  assert.match(view, /showPaymentColumn/);
  assert.match(view, /showStatusColumn/);
  assert.match(fieldPermissions, /purchase_cost: 'price_info\.purchase_cost'/);
  assert.match(moduleFields, /id: 'price_info\.purchase_cost', name: '入库价格'/);
});

test('quick-sale accepts canonical IDs, prices, times and operator fields', () => {
  const route = read('src/routes/inventory.js');
  const handler = route.slice(route.indexOf("router.post('/quick-sale'"), route.indexOf("// 添加根路由"));
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/components/query/quick-sale/helpers.ts'), 'utf8');
  const modal = fs.readFileSync(path.join(root, '../frontend/src/components/query/QuickSaleModal.vue'), 'utf8');
  const queryView = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8');
  const payload = frontend.slice(frontend.indexOf('export const buildQuickSaleSubmitPayload'));

  for (const field of ['brand_id', 'model_id', 'color_id', 'memory_id', 'purchase_cost', 'inventory_time', 'sale_time', 'sale_operator_id']) {
    assert.match(payload, new RegExp(`${field}:`), `快速出库 payload 缺少 ${field}`);
  }
  assert.doesNotMatch(handler, /\bbrand\b|\bmodel\b|\bcolor\b|\bmemory\b|purchase_price|stock_in_date|sale_date|customer_idcard/);
  assert.match(handler, /Number\.isInteger\(id\)/);
  assert.match(handler, /normalizeDateTime\(inventory_time, false\)/);
  assert.match(handler, /normalizeDateTime\(sale_time, false\)/);
  assert.match(handler, /purchaseCost, salePrice/);
  assert.doesNotMatch(handler, /purchaseCost \|\||salePrice \|\||sale_price \|\| 0/);
  assert.match(handler, /apple_id/);
  assert.match(handler, /payment_channel/);
  assert.match(frontend, /purchase_cost:/);
  assert.match(frontend, /inventory_time:/);
  assert.match(frontend, /sale_time:/);
  assert.doesNotMatch(frontend, /purchase_price/);
  assert.doesNotMatch(frontend, /stock_in_date/);
  assert.doesNotMatch(frontend, /sale_date/);
  assert.match(frontend, /payment_channel:/);
  assert.match(modal, /:value="brand\.id"/);
  assert.match(modal, /:value="model\.id"/);
  assert.match(modal, /:value="color\.id"/);
  assert.match(modal, /:value="memory\.id"/);
  assert.doesNotMatch(queryView, /editModalOptions\.brands = \['Apple'/);
});

test('field contract registry has an auditable source mapping for every module', () => {
  const contractPath = path.resolve(root, '../config/field-contracts.json');
  const registry = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const contracts = registry.contracts || {};
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
  ];

  for (const moduleName of requiredModules) {
    assert.ok(contracts[moduleName], `缺少 ${moduleName} 字段契约`);
    assert.ok(Array.isArray(contracts[moduleName].canonical), `${moduleName} canonical 未登记`);
    assert.ok(Array.isArray(registry.auditSources?.[moduleName]), `${moduleName} 审计源文件未登记`);
    assert.ok(registry.auditSources[moduleName].length > 0, `${moduleName} 审计源文件为空`);
  }
  assert.equal(registry.version, 1);
  assert.match(registry.policy, /canonical/);
});

test('query module uses canonical page_size and safe controller errors', () => {
  const controller = read('src/controllers/query.controller.js');
  const service = read('src/services/query.service.js');
  const repository = read('src/repositories/query.repository.js');
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8');

  assert.match(service, /page_size: parseInt\(processArrayParam\(filters\.page_size\)\)/);
  assert.match(service, /const pageSize = filters\.page_size/);
  assert.match(repository, /parseInt\(page_size, 10/);
  assert.match(repository, /page_size: normalizedLimit/);
  assert.doesNotMatch(service, /filters\.limit/);
  assert.doesNotMatch(repository, /filters\.limit|page_size \?\? limit/);
  assert.match(controller, /ApiResponse\.serverError\(res, '综合查询失败', error\)/);
  assert.match(controller, /page_size: PAGINATION\.DEFAULT_LIMIT/);
  assert.match(frontend, /page_size: 100/);
  assert.match(frontend, /page_size=10000/);
  assert.doesNotMatch(frontend, /brands: \['Apple'/);
});

test('accessory writes use an explicit canonical payload', () => {
  const route = read('src/routes/accessories.js');
  const payload = fs.readFileSync(path.join(root, '../frontend/src/components/accessory-payload.ts'), 'utf8');
  const stockInStart = route.indexOf("router.post('/stock-in'");
  const sellStart = route.indexOf("router.post('/sell'");
  const stockInHandler = route.slice(stockInStart, sellStart);
  const sellHandler = route.slice(sellStart);

  assert.ok(stockInStart >= 0 && sellStart > stockInStart);
  assert.doesNotMatch(stockInHandler, /\.\.\.req\.body/);
  assert.doesNotMatch(sellHandler, /\.\.\.req\.body/);
  for (const field of ['purchase_cost', 'sale_price', 'total_quantity', 'distribution', 'remarks']) {
    assert.match(payload, new RegExp(`${field}:`), `配件 payload 缺少 ${field}`);
  }
  assert.match(route, /purchase_cost: body\.purchase_cost/);
  assert.match(route, /sale_price: body\.sale_price/);
  assert.doesNotMatch(route, /purchase_price|selling_price/);
  assert.match(read('src/repositories/accessory.repository.js'), /a\.purchase_cost/);
  assert.match(read('src/repositories/accessory.repository.js'), /a\.sale_price/);
  assert.doesNotMatch(read('src/repositories/accessory.repository.js'), /SELECT\s+ast\.\*/);
});

test('accessory field controls cover reads, filters and writes', () => {
  const route = read('src/routes/accessories.js');
  const fields = fs.readFileSync(path.join(root, '../frontend/src/config/moduleFields.js'), 'utf8');
  const helper = fs.readFileSync(path.join(root, '../frontend/src/components/accessory-field-permissions.ts'), 'utf8');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/accessories/AccessoriesView.vue'), 'utf8');
  const form = fs.readFileSync(path.join(root, '../frontend/src/components/AccessoryStockInModal.vue'), 'utf8');

  assert.match(route, /ACCESSORY_FIELD_MODULE_KEY = 'accessories_accessoriesview'/);
  assert.match(route, /maskAccessoryPayloadWithPermissions/);
  assert.match(route, /rejectHiddenAccessoryWrites/);
  assert.match(route, /rejectHiddenAccessorySellWrites/);
  assert.match(route, /rejectHiddenAccessoryQueries/);
  assert.match(route, /code: 'FIELD_PERMISSION_DENIED'/);
  assert.match(route, /search_fields: searchFields/);
  assert.match(helper, /pickVisibleAccessoryFields/);
  assert.match(form, /pickVisibleAccessoryFields\(buildAccessoryStockInPayload/);
  assert.match(view, /canViewAccessoryField\('profit'\)/);
  assert.match(view, /canViewAccessoryField\('remaining_stock'\)/);
  for (const fieldId of ['price_info.profit', 'stock_info.remaining_stock', 'stock_info.distribution', 'system_info.operations']) {
    assert.match(fields, new RegExp(fieldId.replace('.', '\\.')));
  }
});

test('wholesale transfer accepts canonical sale_time only', () => {
  const controller = read('src/controllers/transfer.controller.js');
  const service = read('src/services/transfer.service.js');
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/helpers.ts'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/types.ts'), 'utf8');

  assert.match(controller, /sale_time[\s\S]*this\.transferService\.wholesaleToPeer/);
  assert.doesNotMatch(controller, /sale_date|normalizedSaleTime/);
  assert.match(service, /normalizeDateTime\(sale_time, true\)/);
  assert.match(frontend, /payload\.sale_time = options\.formData\.sale_time/);
  assert.doesNotMatch(frontend, /payload\.sale_date/);
  assert.doesNotMatch(types, /sale_date\??:/);
});

test('wholesale transfer zeroes proxy amounts and rolls back each failed phone', () => {
  const service = read('src/services/transfer.service.js');
  const migration = fs.readFileSync(path.join(root, 'scripts/zero-supplier-proxy-amounts.js'), 'utf8');
  const proxyStart = service.indexOf('async proxyTransferForSupplier');
  const recordsStart = service.indexOf('async getWholesaleRecords');
  const proxyMethod = service.slice(proxyStart, recordsStart);

  assert.ok(proxyStart >= 0 && recordsStart > proxyStart);
  assert.match(proxyMethod, /const proxy_price = 0/);
  assert.match(proxyMethod, /const final_purchase_cost = 0/);
  assert.match(proxyMethod, /status = 'supplier_proxy',[\s\S]*purchase_cost = \?[\s\S]*sale_price = \?[\s\S]*wholesale_price = \?/);
  assert.doesNotMatch(proxyMethod, /phone\.purchase_cost|requested_proxy_price/);
  assert.match(proxyMethod, /SAVEPOINT proxy_phone/);
  assert.match(proxyMethod, /ROLLBACK TO SAVEPOINT proxy_phone/);
  assert.match(service, /FOR UPDATE/);
  assert.doesNotMatch(service, /proxy_supplier_id/);
  assert.match(migration, /beginTransaction\(\)/);
  assert.match(migration, /WHERE status = 'supplier_proxy'/);
  assert.match(migration, /WHERE sale_type = 'supplier_proxy'/);
  assert.match(migration, /SET purchase_cost = 0,[\s\S]*sale_price = 0,[\s\S]*wholesale_price = 0/);
  assert.match(migration, /assertZeroed\(after\)/);
  assert.match(migration, /await db\.rollback\(\)/);
});

test('wholesale page uses canonical inventory cost and time fields', () => {
  const helpers = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/helpers.ts'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/types.ts'), 'utf8');
  const summary = fs.readFileSync(path.join(root, '../frontend/src/components/wholesale/WholesalePhoneSummarySection.vue'), 'utf8');

  assert.match(helpers, /phone\.purchase_cost/);
  assert.match(summary, /phone\.inventory_time/);
  assert.doesNotMatch(helpers, /phone\.purchase_price/);
  assert.doesNotMatch(types, /purchase_price\??:/);
  assert.doesNotMatch(types, /Inventorytime\??:/);
  assert.doesNotMatch(summary, /phone\.Inventorytime/);
});

test('query contract matches the implemented pagination and filter names', () => {
  const service = read('src/services/query.service.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts.query;

  for (const field of ['page', 'page_size', 'search_term', 'brand', 'model', 'color', 'memory', 'start_date', 'end_date']) {
    assert.ok(contract.canonical.includes(field), `查询契约缺少 ${field}`);
    assert.match(service, new RegExp(`\\b${field}\\b`), `查询服务未使用 ${field}`);
    assert.match(view, new RegExp(`\\b${field}\\b`), `查询页面未使用 ${field}`);
  }
  assert.ok(!contract.canonical.includes('limit'));
  assert.ok(!contract.canonical.includes('search'));
  assert.deepEqual(contract.legacy, []);
  for (const field of ['limit', 'purchase_price', 'Inventorytime', 'salestime', 'sale_date']) {
    assert.ok(contract.retired.includes(field), `查询契约未退役 ${field}`);
  }
});

test('phone option data requires authentication and accessory permission', () => {
  const route = read('src/routes/options.js');
  assert.match(route, /router\.use\(unifiedAuth\)/);
  assert.match(route, /router\.get\('\/phone-options', requireAnyPermission\(\['accessories:view', 'accessories:create'\]\)/);
});

test('query responses use canonical snake_case sections and fields', () => {
  const service = read('src/services/query.service.js');
  const repository = read('src/repositories/query.repository.js');
  const start = service.indexOf('// 格式化返回数据');
  const end = service.indexOf('return {', start);
  const formatter = service.slice(start, end > start ? end : undefined);

  for (const section of ['basic_info', 'supplier_info', 'store_info', 'price_info', 'time_info', 'customer_info', 'operator_info', 'sale_info']) {
    assert.match(formatter, new RegExp(`${section}:`), `查询响应缺少 ${section}`);
  }
  for (const field of ['purchase_cost', 'inventory_time', 'sale_time']) {
    assert.match(formatter, new RegExp(`\\b${field}\\b`), `查询响应缺少 ${field}`);
  }
  assert.doesNotMatch(formatter, /价格信息:\s*\{/);
  assert.doesNotMatch(formatter, /时间信息:\s*\{/);
  assert.match(formatter, /purchase_cost: item\.purchase_cost === null \? null : Number\(item\.purchase_cost\)/);
  assert.match(formatter, /sale_price: item\.sale_price === null \? null : Number\(item\.sale_price\)/);
  assert.doesNotMatch(formatter, /purchase_cost: item\.purchase_cost \?\? 0/);
  const optionsErrorStart = repository.indexOf("log.error('获取查询选项数据失败:'");
  const optionsErrorHandler = repository.slice(optionsErrorStart, optionsErrorStart + 180);
  assert.match(optionsErrorHandler, /throw error/);
  assert.doesNotMatch(optionsErrorHandler, /suppliers:\s*\[\]/);
});

test('query page keeps canonical price and time fields after response normalization', () => {
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/index.ts'), 'utf8');

  assert.match(view, /价格信息: \{[\s\S]*purchase_cost:/);
  assert.match(view, /时间信息: \{[\s\S]*inventory_time:/);
  assert.match(view, /时间信息: \{[\s\S]*sale_time:/);
  assert.match(view, /basic_info\.purchase_cost/);
  assert.match(view, /time_info\.inventory_time/);
  assert.match(view, /time_info\.sale_time/);
  assert.match(types, /purchase_cost\?: number/);
  assert.match(types, /inventory_time\?: string/);
  assert.match(types, /sale_time\?: string/);
  assert.doesNotMatch(view, /item\.价格信息\?\.purchase_price/);
  assert.doesNotMatch(view, /item\.时间信息\?\.Inventorytime/);
  assert.doesNotMatch(view, /item\.时间信息\?\.salestime/);
  assert.doesNotMatch(view, /purchase_price|Inventorytime|salestime|sale_date/);
});

test('query detail content uses canonical field permission ids', () => {
  const detail = fs.readFileSync(path.join(root, '../frontend/src/components/query/QueryDetailContent.vue'), 'utf8');
  const moduleFields = fs.readFileSync(path.join(root, '../frontend/src/config/moduleFields.js'), 'utf8');
  const permissionComposable = fs.readFileSync(path.join(root, '../frontend/src/composables/useFieldPermissions.ts'), 'utf8');

  for (const field of ['basic_info.purchase_cost', 'time_info.inventory_time', 'time_info.sale_time']) {
    assert.match(detail, new RegExp(field.replace('.', '\\.')), `详情弹窗缺少规范权限字段 ${field}`);
    assert.match(moduleFields, new RegExp(`id: '${field.replace('.', '\\.')}'`), `字段配置缺少规范权限字段 ${field}`);
  }
  assert.doesNotMatch(detail, /basic_info\.purchase_price|time_info\.Inventorytime|time_info\.salestime/);
  assert.match(permissionComposable, /hidden_fields/);
  assert.match(permissionComposable, /editable_fields/);
  assert.doesNotMatch(permissionComposable, /basic_info\.purchase_price|time_info\.Inventorytime|time_info\.salestime|price_info\.purchase_price/);
});

test('field permissions use the canonical endpoint and snake_case response fields', () => {
  const route = read('src/routes/permission-management.js');
  const composable = fs.readFileSync(path.join(root, '../frontend/src/composables/useFieldPermissions.ts'), 'utf8');
  const directive = fs.readFileSync(path.join(root, '../frontend/src/directives/permission.ts'), 'utf8');
  const activeSource = `${composable}\n${directive}`;

  assert.match(composable, /\/permissions\/user-field-permissions/);
  assert.match(route, /hidden_fields: new Set\(\)/);
  assert.match(route, /editable_fields: new Set\(\)/);
  assert.match(route, /editable_fields = Array\.from/);
  assert.doesNotMatch(activeSource, /\/fields\/permissions|\/field-permissions\//);
  assert.doesNotMatch(
    activeSource,
    /\b(?:permissionLevel|hiddenFields|editableFields)\b/
  );
});

test('sales page and extracted modules use canonical fields without runtime compatibility', () => {
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/sales/SalesView.vue'), 'utf8');
  const phoneHelpers = fs.readFileSync(path.join(root, '../frontend/src/views/sales/sales-phone-helpers.ts'), 'utf8');
  const checkout = fs.readFileSync(path.join(root, '../frontend/src/views/sales/useSalesCheckout.ts'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/views/sales/types.ts'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts.sales;
  const route = read('src/routes/sales.js');
  const controller = read('src/controllers/sale.controller.js');
  const repository = read('src/repositories/sale.repository.js');

  for (const field of ['purchase_cost', 'inventory_time', 'sale_time']) {
    assert.ok(contract.canonical.includes(field), `销售契约缺少 ${field}`);
    assert.match(`${view}\n${phoneHelpers}\n${checkout}`, new RegExp(`\\b${field}\\b`), `销售模块未使用 ${field}`);
  }
  assert.match(phoneHelpers, /export const normalizeSalesPhone =/);
  assert.doesNotMatch(view, /record\.purchase_price|record\.Inventorytime|record\.salestime/);
  assert.match(checkout, /sale_time: saleForm\.sale_time/);
  assert.match(checkout, /sale_time: batchSaleForm\.sale_time/);
  assert.match(checkout, /sale_price: parseFloat\(saleForm\.sale_price\)/);
  assert.doesNotMatch(checkout, /\bprice: parseFloat/);
  assert.doesNotMatch(view, /phone\.(?:purchase_price|Inventorytime|inbound_date|cost)\b/);
  assert.doesNotMatch(route, /legacy(?:SalePrice|SaleDate|Price|Limit|DateStart|DateEnd)/);
  assert.doesNotMatch(route, /date_start:|date_end:|sale_date:|limit: legacyLimit|price: legacy/);
  assert.doesNotMatch(route, /TEMP_\$\{Date\.now\(\)\}|临时客户/);
  assert.match(route, /normalizeDateTime\(sale_time, false\)/);
  assert.doesNotMatch(controller, /req\.query\.limit|legacySaleDate|legacyPrice/);
  assert.doesNotMatch(controller, /ApiResponse\.paginated/);
  assert.match(controller, /page_size: result\.pagination\.page_size/);
  assert.doesNotMatch(repository, /ph\.created_at|ph\.updated_at/);
  assert.match(repository, /ORDER BY ph\.inventory_time DESC/);
  assert.match(repository, /const total = Number\(countResult\[0\]\?\.total \?\? 0\)/);
  assert.match(types, /inventory_time\?: string/);
  assert.doesNotMatch(types, /Inventorytime\?:/);
});

test('data import exposes controlled file tokens and server-owned task IDs', () => {
  const route = read('src/routes/data-import.js');
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/api/data-optimization.ts'), 'utf8');

  assert.match(route, /file_token:/);
  assert.match(route, /path\.basename\(req\.file\.path\)/);
  assert.match(route, /resolveFileToken/);
  assert.match(route, /crypto\.randomUUID\(\)/);
  assert.match(route, /import_id:/);
  assert.match(route, /req\.body\.file_token/);
  assert.match(route, /req\.query\.page_size/);
  assert.doesNotMatch(route, /filePath|req\.query\.limit|req\.query\.pageSize/);
  assert.match(frontend, /file_token: fileToken/);
  assert.match(frontend, /file_token: fileToken/);
  assert.match(frontend, /user_id\?: number/);
  assert.doesNotMatch(frontend, /filePath/);
  assert.doesNotMatch(frontend, /Date\.now\(\)/);
});

test('data import analysis and history responses use canonical snake_case fields', () => {
  const service = read('src/services/data-import.service.js');
  const route = read('src/routes/data-import.js');
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/data-optimization/page/DataImportTab.vue'), 'utf8');

  assert.match(service, /toCanonicalAnalysis\(analysis\)/);
  assert.match(service, /new_records:/);
  assert.match(service, /duplicate_records:/);
  assert.match(service, /existing_record:/);
  assert.match(service, /has_sale:/);
  assert.match(route, /total_records:/);
  assert.match(route, /error_count:/);
  assert.match(route, /total_pages:/);
  assert.doesNotMatch(frontend, /analysisResult\.newRecords/);
  assert.doesNotMatch(frontend, /analysisResult\.duplicateRecords/);
  assert.doesNotMatch(frontend, /dup\.existingRecord/);
  assert.doesNotMatch(frontend, /dup\.rowIndex/);
});

test('data import analysis does not fabricate progress percentages', () => {
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/views/data-optimization/page/DataImportTab.vue'), 'utf8');
  assert.match(frontend, /:indeterminate="analyzing"/);
  assert.doesNotMatch(frontend, /analyzeProgressTimer/);
  assert.doesNotMatch(frontend, /正在分析数据\.\.\. \$\{analyzeProgress\.value\}%/);
});

test('salary list pagination is bounded before reaching SQL LIMIT/OFFSET', () => {
  const controller = read('src/controllers/salary-record.controller.js');
  const repository = read('src/repositories/salary-record.repository.js');
  const listStart = repository.indexOf('async getSalaryRecordsWithPagination');
  const listEnd = repository.indexOf('async getSalaryRecordById');
  const listRepository = repository.slice(listStart, listEnd);
  assert.match(controller, /pageSizeValue/);
  assert.match(controller, /page_size: Number\.isSafeInteger\(pageSizeValue\)/);
  assert.match(listRepository, /const safePageSize = Math\.min\(100, Math\.max\(1/);
  assert.match(listRepository, /LIMIT \$\{safePageSize\} OFFSET \$\{offset\}/);
  assert.match(listRepository, /page_size: safePageSize/);
  assert.match(listRepository, /total_pages:/);
  assert.match(listRepository, /has_next:/);
  assert.match(listRepository, /has_prev:/);
  assert.doesNotMatch(listRepository, /LIMIT \$\{parseInt\(limit\)\}/);
});

test('inventory edit form uses canonical inventory_time internally', () => {
  const view = [
    fs.readFileSync(path.join(root, '../frontend/src/views/inventory/InventoryView.vue'), 'utf8'),
    fs.readFileSync(path.join(root, '../frontend/src/views/inventory/page/InventoryEditDialog.vue'), 'utf8')
  ].join('\n');
  assert.match(view, /v-model="editForm\.inventory_time"/);
  assert.match(view, /inventory_time: editForm\.inventory_time/);
  assert.match(view, /\{ key: 'purchase_cost', label: '入库价格' \}/);
  assert.match(view, /\{ key: 'inventory_time', label: '入库时间' \}/);
  assert.doesNotMatch(view, /v-model="editForm\.Inventorytime"/);
});

test('inventory detail modal reads canonical cost and time fields', () => {
  const modal = fs.readFileSync(path.join(root, '../frontend/src/components/InventoryDetailModal.vue'), 'utf8');
  assert.match(modal, /canViewField\('purchase_cost'\)/);
  assert.match(modal, /canViewField\('inventory_time'\)/);
  assert.match(modal, /props\.item\?\.purchase_cost/);
  assert.match(modal, /props\.item\?\.inventory_time/);
  assert.doesNotMatch(modal, /props\.item\?\.purchase_price/);
  assert.doesNotMatch(modal, /props\.item\?\.Inventorytime/);
});

test('price list inventory detail normalizes inventory_time at the response boundary', () => {
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/price-list/PriceListView.vue'), 'utf8');
  assert.match(view, /prop="inventory_time"/);
  assert.match(view, /formatInventoryDate\(row\.inventory_time\)/);
  assert.match(view, /const normalizePriceListInventory =/);
  assert.match(view, /inventory_time: item\.inventory_time \?\? null/);
  assert.match(view, /calculateInventoryDays\(item\.inventory_time\)/);
  assert.doesNotMatch(view, /\bInventorytime\b/);
});

test('analytics trend and high-value endpoints use canonical query names', () => {
  const route = read('src/routes/analytics.js');
  const index = read('src/routes/index.js');
  const frontend = fs.readFileSync(path.join(root, '../frontend/src/api/analytics.ts'), 'utf8');

  assert.match(index, /router\.use\(['"]\/analytics['"], analyticsRoutes\)/);
  assert.match(route, /req\.query\.start_date/);
  assert.match(route, /req\.query\.end_date/);
  assert.match(route, /req\.query\.page_size/);
  assert.match(route, /req\.query\.search_term/);
  assert.doesNotMatch(route, /req\.query\.startDate|req\.query\.endDate|req\.query\.pageSize|req\.query\.search\b/);
  assert.match(frontend, /start_date\?: string/);
  assert.match(frontend, /end_date\?: string/);
  assert.match(frontend, /page_size\?: number/);
});

test('customer analytics page and response contract use canonical snake_case fields', () => {
  const route = read('src/routes/analytics.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/CustomerAnalytics.vue'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/analytics.ts'), 'utf8');

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
    assert.match(route, new RegExp(`${field}`), `客户分析后端缺少 ${field}`);
  }
  assert.match(view, /params\.start_date = props\.startDate/);
  assert.match(view, /params\.end_date = props\.endDate/);
  assert.match(view, /params\.store_id = storeId/);
  assert.match(view, /data\.total_customers/);
  assert.doesNotMatch(view, /data\.totalCustomers/);
  assert.doesNotMatch(view, /data\.activeRate/);
  assert.match(types, /total_customers: number/);
  assert.match(types, /customer_segments: CustomerSegment\[\]/);
});

test('employee analytics page sends canonical date and store filters', () => {
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/analytics.ts'), 'utf8');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/EmployeeAnalytics.vue'), 'utf8');

  assert.match(api, /getEmployeeAnalytics\(params\?: \{[\s\S]*start_date\?: string[\s\S]*end_date\?: string[\s\S]*store_id\?/);
  assert.match(api, /getAttendanceSummary\(params\?: \{[\s\S]*start_date\?: string[\s\S]*end_date\?: string[\s\S]*store_id\?/);
  assert.match(view, /params\.start_date = props\.startDate/);
  assert.match(view, /params\.end_date = props\.endDate/);
  assert.match(view, /params\.store_id = props\.storeId/);
  assert.doesNotMatch(view, /params\.startDate\s*=/);
  assert.doesNotMatch(view, /params\.endDate\s*=/);
  assert.doesNotMatch(view, /params\.storeId\s*=/);
});

test('analytics pages use canonical pagination and date request fields', () => {
  const employee = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/EmployeeAnalytics.vue'), 'utf8');
  const inventory = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/InventoryAnalytics.vue'), 'utf8');
  const sales = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/SalesAnalytics.vue'), 'utf8');
  const profit = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/ProfitAnalytics.vue'), 'utf8');
  const route = read('src/routes/analytics.js');

  assert.match(employee, /page_size: 20/);
  assert.doesNotMatch(employee, /limit: 20/);
  assert.match(inventory, /page_size: 200/);
  assert.match(inventory, /page_size: 10/);
  assert.doesNotMatch(inventory, /limit: (?:200|10)/);
  assert.match(sales, /params: \{ start_date: startDate, end_date: endDate \}/);
  assert.match(sales, /params: \{ store_id: store\.id \}/);
  assert.match(sales, /page_size: 10/);
  assert.match(profit, /\{ page_size: 10 \}/);
  assert.doesNotMatch(profit, /\{ limit: 10 \}/);
  assert.match(route, /const pageSize = req\.query\.page_size/);
  assert.match(route, /const storeId = req\.query\.store_id/);
  assert.doesNotMatch(route, /req\.query\.limit|req\.query\.storeId/);
  assert.match(route, /LIMIT \$\{pageSizeNum\}/);
});

test('inventory analytics recent sales use canonical time fields', () => {
  const route = read('src/routes/analytics.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/analytics/page/InventoryAnalytics.vue'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/analytics.ts'), 'utf8');

  assert.match(route, /last_sale_time: null/);
  assert.match(route, /sale_time: row\.saleDate/);
  assert.match(view, /prop="last_sale_time"/);
  assert.match(view, /prop="sale_time"/);
  assert.match(view, /latestRecord\?\.sale_time/);
  assert.match(types, /last_sale_time: string \| null/);
  assert.match(types, /sale_time: string/);
  assert.doesNotMatch(view, /last_sale_date|scope\.row\.sale_date|latestRecord\?\.sale_date/);
});

test('analytics inventory filters use validated bound parameters', () => {
  const route = read('src/routes/analytics.js');
  const inventory = route.slice(route.indexOf("router.get('/inventory'"), route.indexOf("router.get('/inventory/recent-sold'"));
  const recentSold = route.slice(route.indexOf("router.get('/inventory/recent-sold'"), route.indexOf("router.get('/inventory/value'"));
  assert.match(inventory, /parseOptionalInt\(req\.query\.store_id\)/);
  assert.match(inventory, /parseOptionalInt\(req\.query\.supplier_id\)/);
  assert.match(inventory, /AND p\.supplier_id = \?/);
  assert.doesNotMatch(inventory, /supplier_id = \$\{parseInt/);
  assert.match(recentSold, /AND p\.store_id = \?/);
  assert.match(recentSold, /Math\.min\(100, Math\.max\(1/);
  assert.doesNotMatch(recentSold, /store_id = \$\{parseInt/);
});

test('employee analytics store filter uses canonical validated parameters', () => {
  const route = read('src/routes/analytics.js');
  const start = route.indexOf("router.get('/employees/detail'");
  const end = route.indexOf("router.get('/employees/", start + 1);
  const handler = route.slice(start, end > start ? end : start + 7000);
  assert.match(handler, /parseOptionalInt\(req\.query\.store_id\)/);
  assert.match(handler, /AND store_id = \?/);
  assert.doesNotMatch(handler, /store_id = \$\{parseInt/);
  assert.match(handler, /\.\.\.phoneStoreParams/);
});

test('transfer analytics validates dates and binds all range filters', () => {
  const route = read('src/routes/analytics.js');
  const start = route.indexOf("router.get('/transfers-and-allocations'");
  const end = route.indexOf("router.get('/employees/detail'");
  const handler = route.slice(start, end);
  assert.match(handler, /parseOptionalDate\(requestedStartDate\)/);
  assert.match(handler, /parseOptionalDate\(requestedEndDate\)/);
  assert.match(handler, /DATE\(p\.wholesale_date\) >= \?/);
  assert.match(handler, /DATE\(p\.inventory_time\) >= \?/);
  assert.doesNotMatch(handler, /DATE\(p\.wholesale_date\).*\$\{startStr\}/);
  assert.doesNotMatch(handler, /store_id = \$\{parseInt/);
  assert.match(handler, /db\.execute\(trendQuery, \[\.\.\.rangeAndStoreParams, \.\.\.rangeAndStoreParams\]\)/);
});

test('salary responses use an explicit field allowlist', () => {
  const repository = read('src/repositories/salary-record.repository.js');
  const contracts = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8'));
  const responseFields = contracts.contracts['salary-records'].recordResponseFields;

  assert.ok(Array.isArray(responseFields) && responseFields.length > 0);
  assert.match(repository, /const RESPONSE_FIELDS = \[/);
  assert.match(repository, /const RESPONSE_SELECT = RESPONSE_FIELDS\.map/);
  assert.doesNotMatch(repository, /sr\.\*/);
  assert.doesNotMatch(repository, /SELECT \* FROM/);
  for (const field of responseFields) assert.match(repository, new RegExp(`\\b${field}\\b`));
});

test('salary employee sales details expose canonical sale_time', () => {
  const service = read('src/services/salary-record.service.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/salary/SalaryView.vue'), 'utf8');
  const employeeSalesDialog = fs.readFileSync(path.join(root, '../frontend/src/views/salary/page/SalaryEmployeeSalesDetailDialog.vue'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['salary-records'];

  assert.ok(contract.canonical.includes('sale_time'));
  assert.match(service, /p\.sale_time as sale_time/);
  assert.match(service, /shouldExcludeSaleByLeave\(row\.sale_time/);
  assert.match(employeeSalesDialog, /formatSaleTime\(row\.sale_time\)/);
  assert.doesNotMatch(`${view}\n${employeeSalesDialog}`, /item\.salestime/);
  assert.match(view, /v-model:page-size="myPagination\.page_size"/);
  assert.doesNotMatch(view, /myPagination\.size/);
});

test('customer purchase history exposes canonical cost and sale time fields', () => {
  const route = read('src/routes/customers.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/customers/CustomersView.vue'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts.customers;

  for (const field of ['purchase_cost', 'sale_price', 'sale_time', 'profit']) {
    assert.ok(contract.canonical.includes(field));
    assert.match(route, new RegExp(`\\b${field}\\b`));
  }
  assert.match(route, /s\.sale_time/);
  assert.match(route, /s\.purchase_cost/);
  assert.match(route, /s\.sale_price/);
  assert.match(route, /sale_time: p\.sale_time/);
  assert.match(route, /p\.sale_price === null \? null : Number\(p\.sale_price\)/);
  assert.match(view, /formatDate\(purchase\.sale_time\)/);
  assert.doesNotMatch(view, /purchase\.sale_date/);
  assert.doesNotMatch(view, /purchase_price\?:/);
});

test('H5 sold products uses canonical fields without runtime aliases or fake values', () => {
  const route = read('src/routes/shop.js');
  const service = read('src/services/shop.service.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/H5-admin/page/SoldProductsView.vue'), 'utf8');
  const queryView = fs.readFileSync(path.join(root, '../frontend/src/views/query/QueryView.vue'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/h5.ts'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['h5-sold-products'];

  assert.ok(contract.canonical.includes('sale_time'));
  assert.deepEqual(contract.legacy, []);
  assert.ok(contract.retired.includes('sale_date'));
  assert.ok(contract.retired.includes('salestime'));
  assert.ok(contract.retired.includes('imageIds'));
  assert.match(route, /p\.sale_time AS sale_time/);
  assert.match(route, /SELECT id, phone_id, image_url, image_type, is_primary, sort_order, uploaded_by FROM H5_images/);
  assert.match(route, /shopService\.reorderPhoneImages\(id, image_ids\)/);
  assert.doesNotMatch(route, /req\.body\.imageIds|\bimageIds\b/);
  assert.doesNotMatch(route, /COALESCE\(b\.name, '未知品牌'\)|COALESCE\(m\.name, '未知型号'\)/);
  assert.match(service, /async reorderPhoneImages\(phoneId, image_ids\)/);
  assert.match(service, /await connection\.beginTransaction\(\)/);
  assert.match(service, /await connection\.commit\(\)/);
  assert.match(service, /await connection\.rollback\(\)/);
  assert.doesNotMatch(service, /\bimageIds\b/);
  assert.match(queryView, /\{ image_ids \}/);
  assert.doesNotMatch(queryView, /\bimageIds\b/);
  assert.match(view, /formatDate\(product\.sale_time\)/);
  assert.match(view, /api\.get<SoldProduct\[]>\('\/shop\/sold-products'\)/);
  assert.match(view, /pagination\.page_size/);
  assert.match(view, /total_pages/);
  assert.doesNotMatch(view, /product\.sale_date|product\.salestime/);
  assert.match(types, /sale_time: string \| null/);
  assert.doesNotMatch(types, /sale_date: string/);
  assert.doesNotMatch(view, /currentPage|pageSize|totalPages/);
});

test('H5 customer sales exposes canonical sale_time', () => {
  const route = read('src/routes/shop-public.js');
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/auth.ts'), 'utf8');
  const view = fs.readFileSync(path.join(root, '../frontend/src/views/H5-mobile/page/MyCenter.vue'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['h5-customer-sales'];

  assert.ok(contract.canonical.includes('sale_time'));
  assert.match(route, /COALESCE\(s\.sale_time, p\.sale_time\) as sale_time/);
  assert.match(route, /sale_time: sale\.sale_time/);
  assert.match(route, /sale_price: sale\.sale_price (?:== null \? null : Number\(sale\.sale_price\)|=== null \|\| sale\.sale_price === undefined \? null : Number\(sale\.sale_price\))/);
  assert.doesNotMatch(route, /store_name: sale\.store_name \|\| '未知店铺'/);
  assert.doesNotMatch(route, /CASE WHEN p\.is_new = 1 THEN '全新' ELSE '二手' END as is_new/);
  assert.match(api, /export interface H5CustomerSale/);
  assert.match(api, /getUserSales\(\): Promise<H5CustomerSale\[\]>/);
  assert.match(view, /ref<H5CustomerSale\[\]>\(\[\]\)/);
  assert.match(view, /formatDate\(record\.sale_time\)/);
  assert.doesNotMatch(view, /record\.sale_date/);
  assert.doesNotMatch(view, /purchaseRecords = ref<any\[\]>/);
  assert.match(route, /ApiResponse\.serverError\(res, '获取用户销售记录失败', error\)/);
});

test('comprehensive dashboard warnings use canonical sale and inventory times', () => {
  const route = read('src/routes/dashboard.js');
  const service = read('src/services/dashboard.service.js');
  const repository = read('src/repositories/dashboard.repository.js');
  const view = fs.readFileSync(path.join(root, '../frontend/src/components/ComprehensiveWarnings.vue'), 'utf8');
  const inventoryWarnings = fs.readFileSync(path.join(root, '../frontend/src/components/InventoryWarnings.vue'), 'utf8');
  const contract = JSON.parse(fs.readFileSync(path.join(root, '../config/field-contracts.json'), 'utf8')).contracts['dashboard-warnings'];

  for (const field of ['sale_time', 'inventory_time', 'last_inventory_time', 'avg_daily_sales', 'is_below_average', 'no_recent', 'total_warnings', 'has_warnings']) {
    assert.ok(contract.canonical.includes(field));
    assert.ok(contract.responseFields.includes(field));
    assert.match(repository, new RegExp(`\\b${field}\\b`));
  }
  assert.match(repository, /DATE\(p\.sale_time\) as sale_time/);
  assert.match(repository, /DATE\(p\.inventory_time\) as inventory_time/);
  assert.match(repository, /MAX\(p\.inventory_time\) as last_inventory_time/);
  assert.match(repository, /avg_daily_sales:/);
  assert.match(repository, /is_below_average:/);
  assert.match(repository, /no_recent:/);
  assert.match(repository, /total_warnings:/);
  assert.deepEqual(contract.legacy, []);
  assert.ok(contract.retired.includes('limit'));
  assert.doesNotMatch(route, /phoneThreshold|req\.query\.limit|page_size: page_size \?\? limit/);
  assert.match(service, /page_size = 10/);
  assert.match(service, /parseInt\(page_size\)/);
  assert.match(route, /getPhoneStockWarnings\(\{[\s\S]*page_size[\s\S]*\}\)/);
  assert.match(route, /getModelStockWarnings\(\{[\s\S]*page_size[\s\S]*\}\)/);
  assert.match(service, /getPhoneStockWarnings\(thresholdNum, pageSizeNum\)/);
  assert.match(service, /getModelStockWarnings\(thresholdNum, pageSizeNum\)/);
  assert.match(repository, /page_size = 10/);
  assert.doesNotMatch(repository, /getPhoneStockWarnings\(phone_threshold, limit\)/);
  assert.doesNotMatch(repository, /getModelStockWarnings\(phone_threshold, limit\)/);
  assert.match(repository, /has_warnings:/);
  assert.match(view, /item\.sale_time/);
  assert.match(view, /prop="last_inventory_time"/);
  assert.doesNotMatch(view, /item\.sale_date|last_purchase_date/);
  assert.match(inventoryWarnings, /data\.summary\?\.has_warnings/);
  assert.match(inventoryWarnings, /data\.summary\?\.total_warnings/);
  assert.doesNotMatch(inventoryWarnings, /hasWarnings|totalWarnings/);
});

test('phone list exposes canonical cost, time and condition fields', () => {
  const route = read('src/routes/phones.js');
  assert.match(route, /p\.purchase_cost/);
  assert.match(route, /inventory_time: phone\.inventory_time/);
  assert.match(route, /sale_time: phone\.sale_time/);
  assert.match(route, /condition: Number\(phone\.is_new\) === 1 \? 'new' : 'used'/);
  assert.doesNotMatch(route, /const \{ Inventorytime, salestime, \.\.\.canonicalPhone \} = phone/);
  assert.doesNotMatch(route, /inventory_time: Inventorytime/);
  assert.doesNotMatch(route, /purchase_price: phone\.purchase_cost/);
});

test('stock-in list and detail expose canonical response fields', () => {
  const route = read('src/routes/stock-in.js');
  const readHandlers = route.slice(0, route.indexOf("router.post('/', unifiedAuth"));
  const updateHandler = route.slice(route.indexOf("router.put('/:id'"), route.indexOf("router.delete('/:id'"));
  const detail = fs.readFileSync(path.join(root, '../frontend/src/components/StockInDetailModal.vue'), 'utf8');
  const types = fs.readFileSync(path.join(root, '../frontend/src/types/inventory.ts'), 'utf8');
  assert.match(route, /p\.purchase_cost/);
  assert.match(route, /inventory_time: record\.inventory_time/);
  assert.match(route, /purchase_cost: record\.purchase_cost/);
  assert.match(route, /condition: Number\(record\.is_new\) === 1 \? 'new' : 'used'/);
  assert.match(route, /const page_size = Math\.min\(200/);
  assert.match(route, /p\.inventory_time >= \?/);
  assert.match(route, /if \(brand_id\)/);
  assert.match(route, /page_size,/);
  assert.match(route, /total_pages: Math\.ceil\(total \/ page_size\)/);
  assert.match(route, /connection\.query\(query, \[\.\.\.params, page_size, offset\]\)/);
  assert.match(route, /is_settled: record\.payment_status === 'paid' \? 1 : 0/);
  assert.match(route, /today_stock_in: Number\(stats\.today_stock_in\)/);
  assert.match(route, /unknown_payment_count: Number\(stats\.unknown_payment_count\)/);
  assert.doesNotMatch(readHandlers, /FROM inventory|使用默认值|p\.created_at/);
  assert.doesNotMatch(readHandlers, /\blimit\b|\bpages\b|productType|brandIdParam|storeIdParam|supplierIdParam|startDateParam|endDateParam/);
  assert.doesNotMatch(updateHandler, /updated_at/);
  assert.match(updateHandler, /if \(updateData\.inventory_time !== undefined\)[\s\S]*inventory_time = \?/);
  assert.doesNotMatch(route, /SELECT \* FROM phones/);
  assert.match(route, /b\.name as brand_name/);
  assert.match(route, /GROUP BY b\.id, b\.name/);
  assert.match(detail, /record\.inventory_time/);
  assert.match(detail, /record\.purchase_cost/);
  assert.match(detail, /record\.remarks/);
  assert.doesNotMatch(detail, /record\.(?:created_at|updated_at|unit_cost|total_cost|note)\b/);
  assert.match(types, /page_size: number/);
  assert.match(types, /total_pages: number/);
});

test('quick-sale inventory list exposes canonical fields and pagination', () => {
  const route = read('src/routes/inventory.js');
  assert.match(route, /p\.inventory_time AS inventory_time/);
  assert.match(route, /p\.sale_time AS sale_time/);
  assert.match(route, /purchase_cost: parseFloat\(item\.purchase_cost\)/);
  assert.doesNotMatch(route, /purchase_price: parseFloat\(item\.purchase_price\)/);
  assert.match(route, /condition: Number\(item\.is_new\) === 1 \? 'new' : 'used'/);
  assert.match(route, /page: validPage/);
  assert.match(route, /page_size: validLimit/);
});

test('wholesale records expose sale_time and count uses all filters', () => {
  const service = read('src/services/transfer.service.js');
  assert.match(service, /s\.sale_time as sale_time/);
  assert.match(service, /pool\.query\(countQuery, whereParams\)/);
  assert.doesNotMatch(service, /whereParams\.slice\(0, -2\)/);
});

test('preorder mutation paths avoid SELECT * and accept canonical date filters', () => {
  const route = read('src/routes/preorders.js');
  const schema = read('src/utils/preorder-schema.js');
  assert.match(route, /const PREORDER_CORE_FIELDS = \[/);
  assert.match(route, /const PREORDER_RESPONSE_FIELDS = \[/);
  assert.doesNotMatch(route, /(?:SELECT|,)\s*p\.\*/);
  assert.doesNotMatch(route, /SELECT \* FROM preorders/);
  assert.match(route, /req\.query\.start_date/);
  assert.match(route, /req\.query\.end_date/);
  assert.doesNotMatch(route, /req\.query\.(?:startDate|endDate|limit)/);
  assert.doesNotMatch(schema, /\b(?:ALTER|DROP|INSERT|UPDATE|DELETE)\b/i);
  assert.match(schema, /missingColumns/);
});

test('preorder edit form sends customer_id instead of retired customer snapshot fields', () => {
  const form = read('../frontend/src/views/preorders/page/PreorderFormModal.vue');
  const editBlock = form.slice(form.indexOf('const handleEditSubmit'));
  assert.match(editBlock, /customer_id: customerId/);
  assert.doesNotMatch(editBlock, /customer_name:/);
  assert.doesNotMatch(editBlock, /customer_phone:/);
  assert.doesNotMatch(form, /params:\s*\{[^}]*\blimit:/s);
  assert.match(form, /params:\s*\{\s*search: keyword, page_size: 10/);
});

test('repair routes use canonical fields and never migrate schema during requests', () => {
  const route = read('src/routes/repairs.js');
  const view = read('../frontend/src/views/repairs/RepairsView.vue');
  const api = read('../frontend/src/api/repairs.ts');
  const schemaBlock = route.slice(route.indexOf('const ensureRepairsSchema'), route.indexOf('const getDb'));

  assert.match(schemaBlock, /SHOW COLUMNS FROM repairs/);
  assert.match(schemaBlock, /missingColumns/);
  assert.doesNotMatch(schemaBlock, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(route, /req\.query\.limit/);
  assert.match(route, /req\.query\.page_size/);
  assert.match(route, /page_size,/);
  assert.match(route, /total_pages,/);
  assert.match(route, /has_next:/);
  assert.match(route, /has_prev:/);
  assert.doesNotMatch(view, /\b(?:monthlyRevenue|totalPages|pageSize)\b/);
  assert.match(view, /stats\.monthly_revenue/);
  assert.match(view, /pagination\.page_size/);
  assert.match(api, /RepairOrderFilters/);
});

test('store list exposes canonical snake_case pagination metadata', () => {
  const route = read('src/routes/stores.js');
  const view = read('../frontend/src/views/stores/StoresView.vue');
  const registry = JSON.parse(read('../config/field-contracts.json'));
  assert.match(route, /page_size = PAGINATION\.DEFAULT_LIMIT/);
  assert.doesNotMatch(route, /req\.query\.limit/);
  assert.match(route, /page_size: pageSize/);
  assert.match(route, /total_pages: Math\.ceil/);
  assert.match(route, /has_next:/);
  assert.match(route, /has_prev:/);
  assert.match(route, /with_manager:/);
  assert.match(route, /router\.put\('\/:id\(\\\\d\+\)'/);
  assert.match(route, /const \{ name, address, phone, manager_id/);
  assert.doesNotMatch(route, /SELECT\s+(?:s\.)?\*/);
  assert.doesNotMatch(route, /pagination:\s*\{[^}]*\blimit:/s);
  assert.match(view, /pagination\.page_size/);
  assert.match(view, /pagination\.total_pages/);
  assert.match(view, /manager_id: storeForm\.manager_id/);
  assert.doesNotMatch(view, /pagination\.(?:limit|pages)/);
  assert.deepEqual(registry.contracts.stores.legacy, []);
  for (const field of ['limit', 'pages', 'hasNext', 'hasPrev']) {
    assert.ok(registry.contracts.stores.retired.includes(field), `stores 未登记已退役字段 ${field}`);
  }
  assert.equal(registry.legacyBoundarySources.stores, undefined);
});

test('employee list exposes canonical snake_case pagination metadata', () => {
  const route = read('src/routes/employees.js');
  const page = read('../frontend/src/views/employees/EmployeesView.vue');
  const types = read('../frontend/src/types/employee.ts');
  const registry = JSON.parse(read('../config/field-contracts.json'));
  const contract = registry.contracts.employees;

  assert.deepEqual(contract.legacy, []);
  for (const field of ['limit', 'current', 'pageSize', 'pages', 'role_id', 'confirmPassword']) {
    assert.ok(contract.retired.includes(field), `employees 未登记已退役字段 ${field}`);
  }
  assert.equal(registry.legacyBoundarySources.employees, undefined);
  assert.match(route, /req\.query\.page_size \?\? PAGINATION\.DEFAULT_LIMIT/);
  assert.doesNotMatch(route, /req\.query\.limit/);
  assert.match(route, /page_size,/);
  assert.match(route, /total_pages,/);
  assert.match(route, /has_next: page < total_pages/);
  assert.match(route, /has_prev: page > 1/);
  assert.match(route, /as role_names/);
  assert.match(route, /employees\.map\(formatEmployeeRoles\)/);
  assert.doesNotMatch(route, /SELECT\s+\*/i);
  assert.doesNotMatch(route, /\brole_id,\s*\n\s*role_ids\b/);
  assert.doesNotMatch(route, /pagination:\s*\{[^}]*\bpageSize:/s);
  assert.match(page, /const page = ref\(1\)/);
  assert.match(page, /const page_size = ref\(10\)/);
  assert.match(page, /confirm_password/);
  assert.doesNotMatch(page, /confirmPassword|currentPage|pageSize|employee\.roles\b/);
  assert.doesNotMatch(page, /role:\s*employeeForm\.value\.role|role:\s*employee\.role/);
  assert.match(types, /role_ids: number\[\]/);
  assert.match(types, /page_size: number/);
  assert.match(types, /total_pages: number/);
  assert.doesNotMatch(types, /confirmPassword|role_ids\?: string/);
});

test('preorder list uses canonical page_size pagination at the API boundary', () => {
  const route = read('src/routes/preorders.js');
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/preorder.ts'), 'utf8');
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/preorders/PreordersView.vue'), 'utf8');

  assert.match(route, /req\.query\.page_size/);
  assert.doesNotMatch(route, /req\.query\.limit/);
  assert.match(route, /page_size: parsedPageSize/);
  assert.match(route, /total_pages:/);
  assert.match(route, /has_next:/);
  assert.match(route, /has_prev:/);
  assert.match(api, /page_size\?: number/);
  assert.doesNotMatch(api, /limit\?: number/);
  assert.match(page, /page_size: pagination\.page_size/);
  assert.doesNotMatch(page, /limit: pagination\.limit/);
});

test('preorder creation preserves remarks, used condition and locks auto-matched stock', () => {
  const route = read('src/routes/preorders.js');

  assert.match(route, /expected_arrival,\s*\n\s*remarks/);
  assert.match(route, /normalizedCondition/);
  assert.doesNotMatch(route, /is_new \|\| 1/);
  assert.match(route, /LIMIT 1\s*\n\s*FOR UPDATE/);
  assert.match(route, /remarks \|\| null/);
  assert.doesNotMatch(route, /finalRemarks|_remarks/);
  assert.doesNotMatch(route, /product_name,\s*\n\s*CASE\s*\n\s*p\.deposit_amount/);
});

test('preorder field controls cover business data, forms, responses and semantic actions', () => {
  const page = read('../frontend/src/views/preorders/PreordersView.vue');
  const form = read('../frontend/src/views/preorders/page/PreorderFormModal.vue');
  const matchModal = read('../frontend/src/views/preorders/page/MatchPreorderModal.vue');
  const fieldMap = read('../frontend/src/views/preorders/preorder-field-permissions.ts');
  const moduleFields = read('../frontend/src/config/moduleFields.js');
  const route = read('src/routes/preorders.js');

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
    assert.match(moduleFields, new RegExp(`id: '${fieldId.replace('.', '\\.')}'`), `预定字段配置缺少 ${fieldId}`);
    assert.match(fieldMap, new RegExp(`'${fieldId.replace('.', '\\.')}'`), `预定字段映射缺少 ${fieldId}`);
  }

  for (const field of [
    'preorder_number', 'supplier_name', 'store_name', 'customer_name', 'customer_phone',
    'brand_name', 'model_name', 'color_name', 'memory_size', 'is_new', 'imei',
    'deposit_amount', 'total_price', 'actual_price', 'remaining_amount', 'status',
    'created_at', 'matched_time', 'delivered_time', 'operator_name'
  ]) {
    assert.match(page, new RegExp(`canViewPreorderField\\('${field}'\\)|show[A-Za-z]+${field.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('')}Field`), `预定列表缺少 ${field} 字段控制`);
  }

  assert.match(form, /pickVisiblePreorderFields/);
  assert.match(form, /canSubmitVisibleFields/);
  assert.doesNotMatch(form, /preorder_date|预定日期:/);
  assert.match(matchModal, /getVisibleProductName/);
  assert.match(matchModal, /canViewPreorderField\('matchable_sale_price'\)/);

  const pendingOperationStart = page.indexOf('v-if="showPendingActionField"');
  const pendingOperation = page.slice(pendingOperationStart, page.indexOf('</el-table-column>', pendingOperationStart));
  assert.match(pendingOperation, /editPreorder/);
  assert.doesNotMatch(pendingOperation, /openMatchModal|cancelPreorder/);
  const matchedOperationStart = page.indexOf('v-if="showMatchedActionField"');
  const matchedOperation = page.slice(matchedOperationStart, page.indexOf('</el-table-column>', matchedOperationStart));
  assert.doesNotMatch(matchedOperation, /openMatchModal|deliverPreorder|cancelMatchedPreorder|restorePreorder/);
  assert.match(page, /v-if="showMatchedStatusField"[\s\S]{0,1300}cancelMatchedPreorder\(row\)[\s\S]{0,700}restorePreorder\(row\)/);
  assert.match(page, /v-if="showMatchedTimeField"[\s\S]{0,700}openMatchModal\(row\)/);
  assert.match(page, /v-if="showMatchedDeliveryField"[\s\S]{0,700}deliverPreorder\(row\)/);

  assert.match(route, /const PREORDER_WRITE_FIELD_IDS =/);
  assert.match(route, /rejectHiddenPreorderWriteFields/);
  assert.match(route, /maskPreorderList\(records, req\)/);
  assert.match(route, /maskPreorderItem\(records\[0\], req\)/);
  assert.doesNotMatch(route, /p\.purchase_cost,[\s\S]{0,120}p\.is_new/);
});

test('data-check merge payloads use canonical snake_case IDs', () => {
  const controller = read('src/controllers/data-check.controller.js');
  const service = read('src/services/data-check.service.js');
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/data-optimization.ts'), 'utf8');
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/data-optimization/page/DataCheckTab.vue'), 'utf8');

  assert.match(controller, /primary_id/);
  assert.match(controller, /duplicate_ids/);
  assert.match(controller, /merge_groups/);
  assert.match(api, /primary_id: number/);
  assert.match(api, /duplicate_ids: number\[\]/);
  assert.match(api, /merge_groups:/);
  assert.doesNotMatch(api, /primaryId: number/);
  assert.doesNotMatch(api, /duplicateIds: number\[\]/);
  assert.match(page, /primary_id: group\.primary\.id/);
  assert.match(page, /merge_groups: merge_groups/);
  for (const source of [controller, service, page]) {
    assert.doesNotMatch(source, /\b(?:primaryId|duplicateIds|mergeGroups|duplicateCount|duplicateGroups|isDuplicateRows|isEmpty)\b/);
  }
  assert.match(service, /duplicate_groups:/);
  assert.match(service, /is_duplicate_rows:/);
  assert.match(service, /merged_ids:/);
  assert.doesNotMatch(controller, /error\.code === 'ER_NO_SUCH_TABLE'/);
});

test('customer lists and purchase history use canonical page_size pagination', () => {
  const route = read('src/routes/customers.js');
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/customers/CustomersView.vue'), 'utf8');

  assert.match(route, /page_size/);
  assert.match(route, /page_size: finalPageSize/);
  assert.match(route, /total_pages:/);
  assert.match(route, /has_next:/);
  assert.match(route, /has_prev:/);
  assert.doesNotMatch(route, /req\.query\.limit/);
  assert.match(route, /ORDER BY s\.sale_time DESC, s\.id DESC/);
  assert.match(route, /s\.purchase_cost/);
  assert.match(route, /s\.sale_price/);
  assert.match(route, /LIMIT \? OFFSET \?/);
  assert.match(page, /page_size: pagination\.page_size/);
  assert.match(page, /page_size: purchasesPagination\.value\.page_size/);
  assert.doesNotMatch(page, /limit: pagination\.pageSize/);
  assert.doesNotMatch(page, /purchasesPagination\.value\.limit/);
});

test('customer stats expose canonical snake_case response fields', () => {
  const route = read('src/routes/customers.js');
  const page = fs.readFileSync(path.join(root, '../frontend/src/views/customers/CustomersView.vue'), 'utf8');
  for (const field of ['total_customers', 'active_customers', 'new_customers', 'premium_customers']) {
    assert.match(route, new RegExp(field));
  }
  assert.match(page, /data\.total_customers/);
  assert.doesNotMatch(page, /data\.totalCustomers|data\.activeCustomers|data\.newCustomers|data\.premiumCustomers/);
  assert.doesNotMatch(route, /ApiResponse\.success\(res, \{\s*totalCustomers/);
});

test('analytics API client declarations use canonical snake_case parameters', () => {
  const api = fs.readFileSync(path.join(root, '../frontend/src/api/analytics.ts'), 'utf8');
  for (const field of ['start_date', 'end_date', 'store_id', 'category_id', 'product_id', 'page_size']) {
    assert.match(api, new RegExp(`${field}`), `analytics API 缺少 ${field}`);
  }
  for (const field of ['startDate', 'endDate', 'storeId', 'categoryId', 'productId']) {
    assert.doesNotMatch(api, new RegExp(`\\b${field}\\b`), `analytics API 仍声明旧字段 ${field}`);
  }
});

test('brand list removes legacy pagination and wildcard response queries', () => {
  const brands = read('src/routes/brands.js');
  const controller = read('src/controllers/brand.controller.js');
  const service = read('src/services/brand.service.js');
  const repository = read('src/repositories/brand.repository.js');
  const page = read('../frontend/src/views/brands/BrandsView.vue');
  const callers = [
    read('../frontend/src/composables/useBrandModels.ts'),
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/price-list/PriceListView.vue')
  ];

  for (const source of [brands, controller, service, repository]) {
    assert.doesNotMatch(source, /req\.query\.limit|\blimit\s*:/);
    assert.doesNotMatch(source, /\btotalPages\s*:|\bhasNextPage\s*:|\bhasPrevPage\s*:/);
  }
  for (const source of [brands, repository]) {
    assert.doesNotMatch(source, /SELECT\s+(?:[a-z]+\.)?\*/i);
  }
  assert.match(brands, /page_size = PAGINATION\.DEFAULT_LIMIT/);
  assert.match(brands, /page_size: pageSizeNum/);
  assert.match(brands, /const total_pages = Math\.ceil/);
  assert.match(brands, /has_next: pageNum < total_pages/);
  assert.match(brands, /has_prev: pageNum > 1/);
  assert.match(page, /page_size: Number\(apiPagination\.page_size\)/);
  assert.doesNotMatch(page, /apiPagination\.limit/);
  for (const caller of callers) {
    assert.doesNotMatch(caller, /\/brands\?[^'"\n]*\blimit=/);
  }
});

test('model routes and callers use canonical fields and explicit response columns', () => {
  const route = read('src/routes/models.js');
  const page = read('../frontend/src/views/models/ModelsView.vue');
  const stockIn = read('../frontend/src/components/stock-in/helpers.ts');
  const queryEdit = read('../frontend/src/components/query/QueryEditModal.vue');
  const priceList = read('../frontend/src/views/price-list/PriceListView.vue');
  const inventory = read('../frontend/src/views/inventory/InventoryView.vue');
  const remoteSearchStart = inventory.indexOf('const remoteSearchModel');
  const remoteSearchEnd = inventory.indexOf('\nconst ', remoteSearchStart + 1);
  const remoteSearch = inventory.slice(remoteSearchStart, remoteSearchEnd);

  assert.doesNotMatch(route, /req\.query\.(?:limit|sortBy|sortOrder)|\bis_active\b|\bseries\b/);
  assert.doesNotMatch(route, /SELECT\s+(?:[a-z]+\.)?\*/i);
  assert.match(route, /page_size = PAGINATION\.DEFAULT_LIMIT/);
  assert.match(route, /sort_by/);
  assert.match(route, /sort_order/);
  assert.match(route, /page_size: pageSizeNum/);
  assert.match(route, /total_pages/);
  assert.match(route, /has_next: pageNum < total_pages/);
  assert.match(route, /has_prev: pageNum > 1/);
  assert.match(route, /if \(sort_order !== undefined\)[\s\S]*updateFields\.push\('sort_order = \?'\)/);
  assert.ok(
    route.indexOf("router.get('/stats/overview'") < route.indexOf("router.get('/:id'"),
    '型号统计静态路由必须位于动态详情路由之前'
  );

  assert.doesNotMatch(page, /\.is_active\b|paginationData\.limit|paginationData\.pages/);
  for (const caller of [stockIn, queryEdit, priceList]) {
    assert.doesNotMatch(caller, /\/models\?[^'"\n]*\blimit=/);
  }
  assert.match(remoteSearch, /params\.append\('name', query\.trim\(\)\)/);
  assert.match(remoteSearch, /params\.append\('page_size', '50'\)/);
  assert.doesNotMatch(remoteSearch, /params\.append\('(?:search|limit)'/);
});

test('color routes and callers use live columns and canonical fields', () => {
  const colors = read('src/routes/colors.js');
  const page = read('../frontend/src/views/colors/ColorsView.vue');
  const callers = [
    read('../frontend/src/composables/useBrandModels.ts'),
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/price-list/PriceListView.vue')
  ];

  assert.doesNotMatch(colors, /req\.query\.(?:limit|sortBy|sortOrder)|\bis_active\b|\bsearch\b|\bbrand_id\b|\bcategory\b|\bis_premium\b/);
  assert.doesNotMatch(colors, /SELECT\s+(?:[a-z]+\.)?\*/i);
  assert.doesNotMatch(colors, /\/categories\/list/);
  assert.match(colors, /page_size = PAGINATION\.DEFAULT_LIMIT/);
  assert.match(colors, /page_size: pageSizeNum/);
  assert.match(colors, /const total_pages = Math\.ceil/);
  assert.match(colors, /has_next: pageNum < total_pages/);
  assert.match(colors, /has_prev: pageNum > 1/);
  assert.match(colors, /related_phones/);

  assert.doesNotMatch(page, /\.is_active\b|\.hex_code\b|relatedPhones|\.\.\.apiPagination/);
  assert.match(page, /page_size: Number\(apiPagination\.page_size\)/);
  assert.match(page, /related_phones: Number\(data\.related_phones\)/);
  for (const caller of callers) {
    assert.doesNotMatch(caller, /\/colors\?[^'"\n]*\b(?:limit|sortBy|sortOrder)=/);
  }
});

test('memory routes and callers use live columns and canonical fields', () => {
  const memories = read('src/routes/memories.js');
  const page = read('../frontend/src/views/memories/MemoriesView.vue');
  const callers = [
    read('../frontend/src/composables/useBrandModels.ts'),
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/price-list/PriceListView.vue')
  ];

  assert.doesNotMatch(memories, /req\.query\.(?:limit|sortBy|sortOrder)|\bis_active\b|\bsearch\b/);
  assert.doesNotMatch(memories, /SELECT\s+(?:[a-z]+\.)?\*/i);
  assert.doesNotMatch(memories, /price_multiplier|\/units\/list|\/init-missing|missingMemories/);
  assert.match(memories, /page_size = PAGINATION\.DEFAULT_LIMIT/);
  assert.match(memories, /sort_by/);
  assert.match(memories, /sort_order/);
  assert.match(memories, /page_size: pageSizeNum/);
  assert.match(memories, /const total_pages = Math\.ceil/);
  assert.match(memories, /has_next: pageNum < total_pages/);
  assert.match(memories, /has_prev: pageNum > 1/);

  assert.doesNotMatch(page, /\.is_active\b|relatedPhones|\.\.\.apiPagination|params\.(?:search|is_active)/);
  assert.match(page, /page_size: Number\(apiPagination\.page_size\)/);
  assert.match(page, /related_phones: Number\(data\.related_phones\)/);
  for (const caller of callers) {
    assert.doesNotMatch(caller, /\/memories\?[^'"\n]*\b(?:limit|sortBy|sortOrder)=/);
  }
  assert.doesNotMatch(callers[2], /memories:\s*\['64GB'|colors:\s*\['黑色'/);
  assert.doesNotMatch(callers[3], /options\.memories\s*=\s*\['64GB'|options\.brands\s*=\s*\['苹果'/);
});

test('supplier module uses canonical fields and explicit live-schema queries', () => {
  const route = read('src/routes/suppliers.js');
  const controller = read('src/controllers/supplier.controller.js');
  const service = read('src/services/supplier.service.js');
  const repository = read('src/repositories/supplier.repository.js');
  const page = read('../frontend/src/views/suppliers/SuppliersView.vue');
  const callers = [
    read('../frontend/src/components/stock-in/helpers.ts'),
    read('../frontend/src/components/query/QueryEditModal.vue'),
    read('../frontend/src/views/inventory/InventoryView.vue'),
    read('../frontend/src/components/AccessoryStockInModal.vue'),
    read('../frontend/src/components/wholesale/helpers.ts'),
    read('../frontend/src/views/analytics/AnalyticsView.vue')
  ].join('\n');

  for (const source of [route, controller, service, repository, page]) {
    assert.doesNotMatch(source, /\b(?:totalPages|hasNextPage|hasPrevPage|supplier_accounts)\b/);
  }
  assert.doesNotMatch(route, /validateQueryParams|ApiResponse\.paginated|migrate-sort-order/);
  assert.doesNotMatch(route, /SELECT\s+(?:[a-z]+\.)?\*/i);
  assert.doesNotMatch(repository, /SELECT\s+(?:[a-z]+\.)?\*/i);
  assert.match(route, /page_size = DEFAULT_PAGE_SIZE/);
  assert.match(route, /total_pages = Math\.ceil/);
  assert.match(route, /has_next: pageNum < total_pages/);
  assert.match(route, /has_prev: pageNum > 1/);
  assert.match(route, /COALESCE\(SUM\(purchase_cost\), 0\)/);
  assert.match(repository, /page_size: validPageSize/);
  assert.match(page, /has_next: Boolean\(apiPagination\.has_next\)/);
  assert.match(page, /has_prev: Boolean\(apiPagination\.has_prev\)/);
  assert.doesNotMatch(callers, /\/suppliers[^'"\n]*\blimit=/);
  assert.doesNotMatch(callers, /get\(['"]\/suppliers['"][^\n]{0,160}\ball\b/);
});

test('supplier payment phone list exposes canonical pagination fields', () => {
  const controller = read('src/controllers/supplier-payment.controller.js');
  const route = read('src/routes/supplier-payments.js');
  const service = read('src/services/supplier-payment.service.js');
  const page = read('../frontend/src/views/payments/SupplierPhonePaymentsView.vue');
  assert.match(controller, /page_size/);
  assert.match(service, /page_size/);
  assert.match(service, /total_pages:/);
  assert.match(service, /has_next:/);
  assert.match(service, /has_prev:/);
  assert.match(service, /p\.inventory_time/);
  assert.match(service, /LEFT JOIN sales sale ON sale\.id = p\.sale_id/);
  assert.match(service, /LEFT JOIN brands br ON p\.brand_id = br\.id/);
  assert.doesNotMatch(`${route}\n${controller}\n${service}\n${page}`, /\b(?:limit|totalPages|hasNextPage|hasPrevPage|purchase_date)\b/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /beginTransaction\(\)/);
  assert.match(service, /phone\.status === 'supplier_proxy'/);
  assert.match(page, /inventory_time\?: string \| null/);
  assert.match(page, /pagination\.has_next = Boolean/);
  assert.match(page, /pagination\.has_prev = Boolean/);
});

test('attendance pagination uses canonical fields and passes page options to repository', () => {
  const controller = read('src/controllers/attendance.controller.js');
  const repository = read('src/repositories/attendance.repository.js');
  const service = read('src/services/attendance.service.js');
  const accessControl = read('src/services/accessControl.service.js');
  const salaryController = read('src/controllers/salary-record.controller.js');
  const permissionMapping = read('src/config/permission-mapping.js');
  const capabilities = read('src/config/module-permission-capabilities.json');
  const page = read('../frontend/src/views/attendance/AttendanceView.vue');
  const salaryPage = read('../frontend/src/views/salary/SalaryView.vue');
  assert.match(controller, /page_size/);
  assert.doesNotMatch(controller, /req\.query\.limit/);
  assert.match(controller, /ATTENDANCE_WRITE_FIELDS/);
  assert.match(controller, /selectAttendanceWriteFields\(req\.body\)/);
  assert.doesNotMatch(controller, /\.\.\.req\.body/);
  assert.match(controller, /const \{ status, approval_note \} = req\.body/);
  assert.match(controller, /scopeInfo\.isAdmin[\s\S]{0,160}: userId/);
  assert.match(controller, /filters\.employee_id = scopedEmployeeId/);
  assert.doesNotMatch(repository, /options\.limit/);
  assert.match(repository, /page_size: limitInt/);
  assert.match(repository, /total_pages: Math\.ceil/);
  assert.match(repository, /has_next:/);
  assert.match(repository, /has_prev:/);
  assert.match(page, /page_size: 20/);
  assert.match(page, /pagination\.page_size/);
  assert.match(page, /myPagination\.page_size/);
  assert.doesNotMatch(page, /pagination\.size|myPagination\.size/);
  assert.doesNotMatch(page, /limit: 1000/);
  assert.match(read('../frontend/src/api/attendance.ts'), /\{ status, approval_note \}/);
  assert.doesNotMatch(`${service}\n${page}`, /\b(?:absent_days|absent_reason)\b/);
  assert.doesNotMatch(service, /base_salary \|\| 3000|\|\| 20|\|\| 100|baseSalary \/ 174/);
  assert.match(accessControl, /const canViewAll = isAdminRole \|\| allPermissions\.some/);
  assert.match(accessControl, /allModuleKeys: \['attendance_attendanceview'\]/);
  assert.match(accessControl, /ownModuleKeys: \['attendance_myattendanceview', 'attendance_attendanceview'\]/);
  assert.match(accessControl, /allModuleKeys: \['salary_salaryrecordsview'\]/);
  assert.match(accessControl, /ownModuleKeys: \['salary_mysalaryview', 'salary_salaryrecordsview'\]/);
  assert.match(salaryController, /resolveScopedTargetId\(scopeInfo, userId, employee_id\)/);
  assert.match(salaryController, /filters\.status = 'paid'/);
  assert.match(page, /v-if="canViewAllAttendance"/);
  assert.match(page, /authStore\.hasPermission\('attendance:view:all'\)/);
  assert.match(salaryPage, /const canViewTeamSalaryRecords = computed\(\(\) => canViewSalaryRecords\.value\)/);
  assert.match(permissionMapping, /'attendance:view:all': \['attendance_attendanceview:view'\]/);
  assert.match(permissionMapping, /'attendance:view:own': \['attendance_attendanceview:view:own', 'attendance_myattendanceview:view'\]/);
  assert.match(permissionMapping, /'salary-records:view:all': \['salary_salaryrecordsview:view'\]/);
  assert.match(permissionMapping, /'salary-records:view:own': \['salary_mysalaryview:view'\]/);
  assert.match(capabilities, /"attendance_attendanceview": \["view", "create", "edit", "delete", "approve"\]/);
  assert.match(capabilities, /"attendance_myattendanceview": \["view", "create"\]/);
});

test('subsidy uses canonical pagination and handler fields without runtime schema migration', () => {
  const route = read('src/routes/subsidy.js');
  const page = read('../frontend/src/views/subsidy/SubsidyView.vue');
  const list = read('../frontend/src/views/subsidy/components/SubsidyListSection.vue');
  const applyDialog = read('../frontend/src/views/subsidy/components/SubsidyApplyDialog.vue');
  const editDialog = read('../frontend/src/views/subsidy/components/SubsidyEditDialog.vue');
  const detailDialog = read('../frontend/src/views/subsidy/components/SubsidyDetailDialog.vue');
  const photoDialog = read('../frontend/src/views/subsidy/components/SubsidyPhotoManageDialog.vue');
  const moduleFields = read('../frontend/src/config/moduleFields.js');
  const fieldPermissions = read('../frontend/src/composables/useFieldPermissions.ts');
  const permissionMapping = read('src/config/permission-mapping.js');
  const unifiedAuth = read('src/middleware/unified-auth.js');
  const masking = read('src/services/dataMaskingService.js');
  const cache = read('src/middleware/cache.js');
  const permissionRoute = read('src/routes/permission-management.js');
  const capabilities = read('src/config/module-permission-capabilities.json');
  const sources = `${route}\n${page}\n${list}\n${applyDialog}\n${editDialog}\n${detailDialog}\n${photoDialog}`;

  assert.match(route, /req\.query\.page_size \|\| 20/);
  assert.match(route, /page_size: limitNum/);
  assert.match(route, /const total_pages = Math\.ceil\(total \/ limitNum\)/);
  assert.match(route, /\n\s+total_pages,/);
  assert.match(route, /has_next: page < total_pages/);
  assert.match(route, /has_prev: page > 1/);
  assert.match(sources, /has_different_handler/);
  assert.match(sources, /handler_info/);
  assert.match(sources, /handler_name/);
  assert.match(sources, /handler_phone/);
  assert.match(sources, /handler_idcard/);
  assert.match(capabilities, /"subsidy_subsidyview": \["view", "create", "edit", "delete", "approve", "arrival", "upload", "export"\]/);
  assert.match(permissionMapping, /'subsidy:arrival': \['subsidy_subsidyview:arrival', 'subsidy:arrival'\]/);
  assert.match(permissionMapping, /'subsidy:upload': \['subsidy_subsidyview:upload', 'subsidy:upload'\]/);
  assert.match(unifiedAuth, /'arrival'/);
  assert.match(unifiedAuth, /'upload'/);
  assert.match(route, /router\.put\('\/:id\/audit', unifiedAuth, requirePermission\('subsidy:approve'\)/);
  assert.match(route, /router\.put\('\/:id\/confirm-arrival', unifiedAuth, requirePermission\('subsidy:arrival'\)/);
  assert.match(route, /router\.get\('\/:id\/photos', unifiedAuth, requireSubsidyUpload/);
  assert.match(route, /router\.put\('\/:id\/photos', unifiedAuth, requireSubsidyUpload/);
  assert.match(route, /router\.post\('\/upload\/photo', unifiedAuth, requireSubsidyUpload/);
  assert.match(route, /requireVisibleSubsidyPhotosOrUpload/);
  assert.doesNotMatch(route, /requireVisibleSubsidyPhotosWhenPresent/);
  assert.match(route, /requirePermission\('subsidy:export'\)/);
  assert.match(route, /maskSubsidyList\(formattedSubsidies, req\)/);
  assert.match(route, /buildSubsidyExportFile\([\s\S]*hiddenFields\)/);
  assert.match(route, /hiddenFields\.has\('stats\.amount_progress'\)/);
  assert.match(route, /rejectHiddenSubsidyWriteFields/);
  assert.match(masking, /config\.hidden_fields/);
  assert.match(masking, /phone_brand/);
  assert.match(cache, /req\.user\?\.id \|\| 'anonymous'/);
  assert.match(permissionRoute, /await connection\.commit\(\)\s+clearCache\(\)/);
  assert.match(fieldPermissions, /Some callers still use a short page key/);
  assert.match(fieldPermissions, /getNormalizedModuleKeys\(configuredKey\)/);
  assert.match(page, /const SUBSIDY_FIELD_MODULE_KEY = 'subsidy_subsidyview'/);
  assert.match(page, /searchableFields\.forEach/);
  assert.match(fieldPermissions, /export const shouldShowActionColumn/);
  assert.match(fieldPermissions, /fieldVisible \|\| actionPermissions\.some\(Boolean\)/);
  assert.match(page, /const canShowActions = computed\(\(\) => shouldShowActionColumn/);
  assert.match(page, /canViewField\('actions'\),\s*\[canEdit\.value, canDelete\.value\]/);
  assert.match(page, /key: 'apply_time',[\s\S]{0,180}shouldShowActionColumn\(fieldVisibility\.value\.apply_time, \[canApprove\.value\]\)/);
  assert.match(page, /key: 'arrival_time',[\s\S]{0,180}shouldShowActionColumn\(fieldVisibility\.value\.arrival_time, \[canArrival\.value\]\)/);
  assert.match(page, /\{ key: 'actions', label: '操作', visible: canShowActions\.value \}/);
  assert.match(page, /\{ key: 'subsidy_photos', label: '国补照片', visible: fieldVisibility\.value\.subsidy_photos \|\| canUpload\.value \}/);
  assert.match(page, /unifiedApi\.get\(`\/subsidy\/\$\{item\.id\}\/photos`\)/);
  const applyTimeColumn = list.slice(
    list.indexOf(`column.key === 'apply_time'`),
    list.indexOf(`column.key === 'arrival_time'`)
  );
  const arrivalTimeColumn = list.slice(
    list.indexOf(`column.key === 'arrival_time'`),
    list.indexOf(`column.key === 'actions'`)
  );
  const operationColumnStart = list.indexOf(`column.key === 'actions'`);
  const operationColumn = list.slice(operationColumnStart, list.indexOf('</el-table>', operationColumnStart));
  assert.match(applyTimeColumn, /v-else-if="canApprove"[\s\S]*emit\('audit', row\)/);
  assert.match(arrivalTimeColumn, /v-else-if="canArrival"[\s\S]*emit\('confirm-arrival', row\)/);
  assert.doesNotMatch(operationColumn, /canApprove|canArrival|emit\('audit'|emit\('confirm-arrival'/);
  assert.match(operationColumn, /v-if="canEdit"/);
  assert.match(operationColumn, /v-if="canDelete"/);
  const mobileWorkflowStart = list.indexOf('class="mobile-workflow-fields"');
  const mobileWorkflow = list.slice(mobileWorkflowStart, list.indexOf('class="mobile-card-actions"', mobileWorkflowStart));
  assert.match(mobileWorkflow, /fieldVisibility\.apply_time \|\| canApprove[\s\S]*emit\('audit', item\)/);
  assert.match(mobileWorkflow, /fieldVisibility\.arrival_time \|\| canArrival[\s\S]*emit\('confirm-arrival', item\)/);
  assert.doesNotMatch(list, /v-memo=/);
  assert.doesNotMatch(sources, /fieldVisibility\.(?:storeName|salesmanName|saleTime|customerName|customerPhone|customerIdcard|serialNumber|salePrice|subsidyAmount|subsidyRate|subsidyCalcPrice|applyTime|arrivalTime|subsidyPhotos)/);
  assert.match(photoDialog, /@click="downloadToolbarPhotos"/);
  assert.match(photoDialog, /v-if="canUpload"[\s\S]{0,180}@click="deleteToolbarPhotos"/);
  assert.match(photoDialog, /if \(!canUpload\.value\) \{\s+ElMessage\.warning\('您没有图片上传权限'\)/);
  assert.match(editDialog, /v-if="canViewField\('apply_time'\) \|\| canApprove \|\| canViewField\('arrival_time'\) \|\| canArrival"/);
  assert.match(editDialog, /v-if="canApprove"\s+label="提交时间"/);
  assert.match(editDialog, /v-if="canArrival"\s+label="到账时间"/);
  assert.match(editDialog, /if \(canApprove\.value\) \{\s+payload\.apply_time/);
  assert.match(editDialog, /if \(canArrival\.value\) \{\s+payload\.arrival_time/);
  assert.doesNotMatch(editDialog, /canViewField\('apply_time'\) && canApprove/);
  assert.doesNotMatch(editDialog, /canViewField\('arrival_time'\) && canArrival/);
  assert.match(applyDialog, /v-if="canViewField\('subsidy_calc_price'\) \|\| canViewField\('subsidy_photos'\) \|\| canUpload"/);
  assert.match(applyDialog, /<el-upload\s+v-if="canUpload"/);
  assert.doesNotMatch(applyDialog, /canViewField\('subsidy_photos'\) && canUpload/);
  for (const fieldId of [
    'store_info.store_name', 'sales_info.salesman_name', 'customer_info.customer_idcard',
    'device_info.serial_number', 'price_info.subsidy_rate', 'price_info.subsidy_calc_price',
    'subsidy_info.subsidy_photos', 'handler_info.handler_name', 'handler_info.handler_phone',
    'handler_info.handler_idcard', 'time_info.sale_time', 'system_info.operations'
  ]) {
    assert.ok(moduleFields.includes(`id: '${fieldId}'`), `subsidy 字段登记缺少 ${fieldId}`);
  }
  assert.doesNotMatch(route, /req\.query\.limit/);
  assert.doesNotMatch(sources, /\b(?:hasDifferentHandler|handlerInfo|handlerName|handlerPhone|handlerIdcard)\s*[:.=?]/);
  assert.doesNotMatch(route, /CREATE TABLE IF NOT EXISTS national_subsidies|ALTER TABLE national_subsidies/);
});

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
  ];

  for (const file of actionColumnFiles) {
    assert.match(read(file), /shouldShowActionColumn/, `${file} 未使用统一操作列可见性规则`);
  }

  const payment = read('../frontend/src/views/payments/SupplierPhonePaymentsView.vue');
  assert.doesNotMatch(payment, /can(?:Create|View|Edit|Delete)Payment && canViewPaymentField\('actions'\)/);
  assert.match(payment, /const showPaymentStatusField = computed\(\(\) => \{[\s\S]{0,220}canViewPaymentField\('payment_status'\),\s*\[canCreatePayment\.value\]/);
  assert.match(payment, /v-(?:else-)?if="canCreatePayment && row\.payment_status === 'unpaid'"[\s\S]{0,260}handleSinglePayment\(row\)/);
  const paymentOperationStart = payment.indexOf('v-if="showPaymentActionField"');
  const paymentOperation = payment.slice(paymentOperationStart, payment.indexOf('<template #empty>', paymentOperationStart));
  assert.doesNotMatch(paymentOperation, /handleSinglePayment|canCreatePayment/);

  const attendance = read('../frontend/src/views/attendance/AttendanceView.vue');
  assert.match(attendance, /const showAttendanceStatusColumn = computed\(\(\) => shouldShowActionColumn\([\s\S]{0,180}\[canApprove\.value\]/);
  const attendanceStatusStart = attendance.indexOf('v-if="showAttendanceStatusColumn"');
  const attendanceStatus = attendance.slice(attendanceStatusStart, attendance.indexOf('v-if="showAttendanceApprovalColumn"', attendanceStatusStart));
  assert.match(attendanceStatus, /canApprove && row\.status === 'pending'[\s\S]{0,500}handleApprove\(row\)/);
  const attendanceOperationStart = attendance.indexOf('v-if="showAttendanceActionField"');
  const attendanceOperation = attendance.slice(attendanceOperationStart, attendance.indexOf('</el-table>', attendanceOperationStart));
  assert.doesNotMatch(attendanceOperation, /canApprove|handleApprove/);

  const salaryPayout = read('../frontend/src/views/salary/page/SalaryPayoutTab.vue');
  assert.match(salaryPayout, /const showStatusColumn = computed\(\(\) => shouldShowActionColumn\([\s\S]{0,180}\[props\.canCreate\]/);
  const salaryStatusStart = salaryPayout.indexOf('v-if="showStatusColumn"');
  const salaryStatus = salaryPayout.slice(salaryStatusStart, salaryPayout.indexOf("canViewField('salary_salaryrecordsview', 'paid_at')", salaryStatusStart));
  assert.match(salaryStatus, /v-if="canCreate"[\s\S]{0,320}emit\('recalculate', row\) : emit\('settle', row\)/);
  const salaryOperationStart = salaryPayout.indexOf('v-if="!isMobile && showActionColumn"');
  const salaryOperation = salaryPayout.slice(salaryOperationStart, salaryPayout.indexOf('</el-table>', salaryOperationStart));
  assert.doesNotMatch(salaryOperation, /canCreate|emit\('settle'|emit\('recalculate'/);

  const salesGrid = read('../frontend/src/views/sales/page/SalesGridView.vue');
  assert.doesNotMatch(salesGrid, /can(?:Create|Edit|Delete) && canViewField\('actions'\)/);

  const roles = read('../frontend/src/views/permissions/page/RolesPage.vue');
  const userRoles = read('../frontend/src/views/permissions/page/UserRolesPage.vue');
  const storeBindings = read('../frontend/src/views/permissions/page/StoreBindingsPage.vue');
  for (const page of [roles, userRoles, storeBindings]) {
    assert.match(page, /v-if="ctx\.showPermissionsActionField"/);
  }
  assert.doesNotMatch(roles, /您没有(?:编辑|删除)角色的权限/);
});

test('H5 admin order list exposes canonical pagination fields', () => {
  const route = read('src/routes/sales-management.js');
  const legacyRoute = read('src/routes/shop.js');
  const publicService = read('src/services/shop-public.service.js');
  const shopService = read('src/services/shop.service.js');
  const adminStart = route.indexOf("router.get('/h5-orders'");
  const adminEnd = route.indexOf("router.get('/h5-orders/:id'", adminStart);
  const adminList = route.slice(adminStart, adminEnd);
  const legacyStart = legacyRoute.indexOf("router.get('/orders'");
  const legacyEnd = legacyRoute.indexOf("router.get('/orders/:id'", legacyStart);
  const legacyList = legacyRoute.slice(legacyStart, legacyEnd);
  const publicListStart = publicService.indexOf('async getH5OrdersList');
  const publicListEnd = publicService.indexOf('async getH5OrderDetail', publicListStart);
  const publicList = publicService.slice(publicListStart, publicListEnd);
  const shopListStart = shopService.indexOf('async getOrders');
  const shopListEnd = shopService.indexOf('async getOrderDetail', shopListStart);
  const shopList = shopService.slice(shopListStart, shopListEnd);

  for (const source of [adminList, legacyList, publicList, shopList]) {
    assert.match(source, /page_size/);
    assert.match(source, /total_pages/);
    assert.match(source, /has_next/);
    assert.match(source, /has_prev/);
    assert.doesNotMatch(source, /req\.query\.limit|\bstartDate\b|\bendDate\b|\blimit\s*[:=,}]/);
  }
  assert.match(adminList, /start_date/);
  assert.match(adminList, /end_date/);
  assert.match(legacyList, /start_date/);
  assert.match(legacyList, /end_date/);
  assert.doesNotMatch(`${publicList}\n${shopList}`, /SELECT\s+(?:o\.)?\*/);
  assert.doesNotMatch(`${publicService}\n${shopService}`, /confirmed_by|confirmed_at/);
});

test('H5 customer order lookup exposes canonical pagination fields', () => {
  const route = read('src/routes/shop-public.js');
  const service = read('src/services/shop-public.service.js');
  const api = read('../frontend/src/api/shop-public.ts');
  const myOrders = read('../frontend/src/views/H5-mobile/page/MyOrders.vue');
  const orderQuery = read('../frontend/src/views/H5-mobile/page/OrderQuery.vue');
  const routeStart = route.indexOf("router.get('/orders/phone/:customer_phone'");
  const routeEnd = route.indexOf("router.put('/orders/:id/status'", routeStart);
  const handler = route.slice(routeStart, routeEnd);
  const serviceStart = service.indexOf('async getOrdersByPhone');
  const serviceEnd = service.indexOf('async updateOrderStatus', serviceStart);
  const method = service.slice(serviceStart, serviceEnd);

  assert.ok(routeStart >= 0, '公开订单手机号查询路由不存在');
  assert.match(handler, /req\.query\.page_size/);
  assert.match(handler, /customer_phone/);
  assert.match(handler, /customer_name/);
  assert.match(handler, /page_size: result\.page_size/);
  assert.match(handler, /total_pages: result\.total_pages/);
  assert.match(handler, /has_next: result\.has_next/);
  assert.match(handler, /has_prev: result\.has_prev/);
  assert.doesNotMatch(handler, /req\.query\.limit|ApiResponse\.paginated/);
  assert.match(method, /\{ page, page_size, customer_name \}/);
  assert.doesNotMatch(method, /SELECT\s+(?:oi\.)?\*/);
  assert.match(api, /page_size\?: number/);
  assert.match(api, /customer_name\?: string/);
  assert.doesNotMatch(api, /\n\s+limit: pageSize/);
  assert.doesNotMatch(api, /getOrdersByPhone\(phone:/);
  assert.doesNotMatch(myOrders, /\n\s+name: name\.value|\n\s+phone: phone\.value/);
  assert.doesNotMatch(orderQuery, /\n\s+name: form\.values\.name|\n\s+phone: form\.values\.phone/);
  assert.match(myOrders, /customer_name: customer_name\.value/);
  assert.match(orderQuery, /customer_name: form\.values\.customer_name/);
});

test('H5 public product lists use canonical page_size at API and page boundaries', () => {
  const route = read('src/routes/shop-public.js');
  const service = read('src/services/shop-public.service.js');
  const page = read('../frontend/src/views/H5-mobile/page/ProductList.vue');
  const api = read('../frontend/src/api/shop-public.ts');
  for (const endpoint of ["router.get('/products'", "router.get('/products/aggregate'", "router.get('/products/search/:keyword'"]) {
    const start = route.indexOf(endpoint);
    assert.ok(start >= 0, `公开商品接口不存在: ${endpoint}`);
    const next = route.indexOf('router.get(', start + endpoint.length);
    const handler = route.slice(start, next > start ? next : undefined);
    assert.match(handler, /page_size/);
    assert.match(handler, /sendPublicPaginated/);
    assert.doesNotMatch(handler, /req\.query\.limit|ApiResponse\.paginated|result\.limit/);
  }
  assert.match(route, /const sendPublicPaginated[\s\S]*total_pages: result\.total_pages/);
  assert.match(route, /const sendPublicPaginated[\s\S]*has_next: result\.has_next/);
  assert.match(route, /const sendPublicPaginated[\s\S]*has_prev: result\.has_prev/);
  for (const methodName of ['getProducts', 'getNewProductsFromTemplates', 'searchProducts', 'getAggregatedProducts', 'getUsedProducts']) {
    const start = service.indexOf(`async ${methodName}`);
    const next = service.indexOf('\n  async ', start + 1);
    const method = service.slice(start, next > start ? next : undefined);
    assert.ok(start >= 0, `公开商品服务方法不存在: ${methodName}`);
    assert.match(method, /page_size/);
    assert.doesNotMatch(method, /\blimit\b|totalPages|hasNextPage|hasPrevPage/);
  }
  assert.match(service, /LEFT JOIN colors c ON p\.color_id = c\.id/);
  assert.match(service, /LEFT JOIN memories mem ON p\.memory_id = mem\.id/);
  assert.match(service, /c\.id as color_id/);
  assert.match(service, /mem\.id as memory_id/);
  assert.match(page, /const page_size = 20/);
  assert.match(page, /page_size,/);
  assert.match(page, /response\.page_size/);
  assert.match(api, /page_size: number/);
  assert.match(api, /total_pages/);
  assert.doesNotMatch(api, /pagination\.limit|record\.limit|pagination\.totalPages|pagination\.hasNextPage|pagination\.hasPrevPage/);
});

test('salary template pagination reads options.page_size and binds template_id', () => {
  const controller = read('src/controllers/salary-template.controller.js');
  const recordController = read('src/controllers/salary-record.controller.js');
  const repository = read('src/repositories/salary-template.repository.js');
  const api = read('../frontend/src/api/salary-template.ts');
  assert.match(controller, /page_size/);
  assert.match(controller, /const \{ template_id \} = req\.body/);
  assert.match(repository, /page_size/);
  assert.match(repository, /page_size: limitNum/);
  assert.match(repository, /total_pages:/);
  assert.match(repository, /has_next:/);
  assert.match(repository, /has_prev:/);
  assert.match(api, /page_size\?: number/);
  assert.match(api, /template_id: templateId/);
  assert.doesNotMatch(api, /\{ templateId \}/);
  assert.doesNotMatch(controller, /req\.query\.limit|req\.body\?\.templateId/);
  assert.doesNotMatch(recordController, /\blimit\b/);
});

test('salary template queries use columns present in the live schema', () => {
  const repository = read('src/repositories/salary-template.repository.js');
  const api = read('../frontend/src/api/salary-template.ts');
  for (const field of [
    'commission_new_fixed',
    'commission_used_fixed',
    'rest_days',
    'auto_raise_rule',
    'is_default'
  ]) {
    assert.match(repository, new RegExp(`'${field}'`));
  }
  for (const field of [
    'leave_daily_deduction',
    'absent_daily_deduction',
    'salary_cycle_days',
    'social_insurance_rate',
    'tax_rate',
    'created_by'
  ]) {
    assert.doesNotMatch(repository, new RegExp(`'${field}'`), `工资模板 SQL 仍读取不存在的 ${field}`);
    assert.doesNotMatch(api, new RegExp(`\\b${field}\\b`), `工资模板 API 类型仍声明不存在的 ${field}`);
  }
});

test('salary template default and active operations use the live schema', () => {
  const repository = read('src/repositories/salary-template.repository.js');
  assert.match(repository, /setAsDefault\(id\)/);
  assert.match(repository, /beginTransaction\(\)/);
  assert.match(repository, /UPDATE \$\{this\.tableName\} SET is_default = 0/);
  assert.match(repository, /SET is_default = 1 WHERE id = \?/);
  assert.match(repository, /WHERE is_active = 1/);
});

test('permission management lists expose canonical pagination and log date fields', () => {
  const management = read('src/routes/permission-management.js');
  const logs = read('src/routes/permission-logs.js');
  const userStores = read('src/routes/user-stores.js');
  const modules = read('src/routes/module-management.js');
  const moduleScanner = read('src/services/moduleScanner_simple.js');
  const menuLinker = read('src/services/menuModuleLinker.js');
  const page = read('../frontend/src/views/permissions/PermissionsView.vue');
  const logsPage = read('../frontend/src/views/permissions/page/LogsPage.vue');
  const modulePage = read('../frontend/src/views/permissions/page/ModuleManagementView.vue');
  assert.match(management, /Number\.parseInt\(req\.query\.page_size, 10\)/);
  assert.doesNotMatch(management, /req\.query\.page_size \?\? req\.query\.limit/);
  assert.match(management, /page_size: limit/);
  assert.match(management, /total_pages: Math\.ceil/);
  assert.match(management, /has_next:/);
  assert.match(management, /has_prev:/);
  assert.match(logs, /page_size/);
  assert.match(logs, /start_date/);
  assert.match(logs, /end_date/);
  assert.match(logs, /total_pages:/);
  assert.doesNotMatch(logs, /page_size \?\? size|req\.query\.startDate|req\.query\.endDate/);
  assert.doesNotMatch(logs, /targetType|targetId|targetName|permission\.moduleKey|permission\.permissionType/);
  assert.doesNotMatch(userStores, /req\.body\?\.(?:userId|storeIds|isPrimary|replaceExisting)/);
  assert.match(userStores, /req\.body\?\.user_id/);
  assert.match(userStores, /req\.body\?\.store_ids/);
  assert.match(modules, /const \{ module_key \} = req\.body/);
  assert.match(modules, /const \{ module_keys \} = req\.body/);
  assert.match(modules, /const \{ name, is_custom = true \} = req\.body/);
  assert.doesNotMatch(modules, /const \{ (?:moduleKey|moduleKeys|menuId|isActive|isCustom)/);
  assert.doesNotMatch(modules, /rolePermissions:|oldName:|newName:|isCustomName:|originalName:/);
  assert.doesNotMatch(moduleScanner, /moduleKey:|isNewModule:|isCustomName:|lastModified:/);
  assert.doesNotMatch(menuLinker, /menuId:|moduleKey:|moduleId:|totalMenus:|linkRate:|notFound:/);
  assert.doesNotMatch(logsPage, /\.moduleKey|\.permissionType|logsPagination\.size/);
  assert.doesNotMatch(modulePage, /\.pageSize|\.isCustom|\.isActive|\.currentName|\.originalName/);
  assert.match(page, /page_size/);
  assert.match(page, /start_date:/);
  assert.match(page, /end_date:/);
  assert.doesNotMatch(page, /params\.append\('limit'/);
  assert.match(page, /stats\.total_roles/);
  assert.doesNotMatch(page, /stats\.totalRoles/);
  assert.match(modules, /total_modules:/);
  assert.match(modules, /total_permissions:/);
  assert.match(modules, /total_roles:/);
  assert.match(modules, /active_users:/);
  assert.doesNotMatch(modules, /totalModules:/);
  assert.doesNotMatch(modules, /totalPermissions:/);
  assert.doesNotMatch(modules, /totalRoles:/);
  assert.doesNotMatch(modules, /activeUsers:/);
  assert.match(management, /total_modules: modules\.length/);
  assert.doesNotMatch(management, /totalModules: modules\.length/);
  assert.match(page, /meta\.total_modules/);
  assert.doesNotMatch(page, /meta\.totalModules/);
  assert.doesNotMatch(page, /Pagination\.size/);
  assert.match(page, /userSearchForm\.role_id/);
  assert.match(page, /role_ids: selectedUserRoleIds\.value/);
  assert.match(page, /field_config:/);
  assert.doesNotMatch(logs, /\n\s+size: sizeNum/);
});

test('permissions contract retires removed API aliases without runtime compatibility', () => {
  const registry = JSON.parse(read('../config/field-contracts.json'));
  const contract = registry.contracts.permissions;

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'limit', 'roleId', 'startDate', 'endDate', 'size', 'userId', 'storeIds',
    'moduleKey', 'moduleKeys', 'permissionType', 'fieldConfig', 'isActive',
    'isCustom', 'targetType', 'targetId', 'targetName', 'hiddenFields', 'editableFields'
  ]) {
    assert.ok(contract.retired.includes(field), `permissions 未登记已退役字段 ${field}`);
  }
  assert.equal(registry.legacyBoundarySources.permissions, undefined);
});

test('users contract uses canonical pagination and explicit public columns', () => {
  const route = read('src/routes/users.js');
  const repository = read('src/repositories/user.repository.js');
  const api = read('../frontend/src/api/user.ts');
  const queryModal = read('../frontend/src/components/query/QueryEditModal.vue');
  const registry = JSON.parse(read('../config/field-contracts.json'));
  const contract = registry.contracts.users;

  assert.deepEqual(contract.legacy, []);
  for (const field of ['limit', 'totalPages', 'hasNextPage', 'hasPrevPage', 'group_name']) {
    assert.ok(contract.retired.includes(field), `users 未登记已退役字段 ${field}`);
  }
  assert.equal(registry.legacyBoundarySources.users, undefined);
  assert.match(route, /const \{ page = 1, page_size, role, status = '1' \} = req\.query/);
  assert.match(route, /page_size: pageSizeInt/);
  assert.match(route, /total_pages: result\.pagination\.total_pages/);
  assert.match(route, /has_next: result\.pagination\.has_next/);
  assert.match(route, /has_prev: result\.pagination\.has_prev/);
  assert.match(route, /ApiResponse\.success\(res, user, '获取用户详情成功'\)/);
  assert.match(route, /USER_PUBLIC_COLUMNS/);
  assert.doesNotMatch(route, /SELECT \* FROM users|req\.query\.limit|\n\s+limit:/);
  assert.match(repository, /Number\.parseInt\(page_size, 10\)/);
  assert.match(repository, /u\.email, u\.store_id/);
  assert.match(repository, /GROUP_CONCAT\(r\.name ORDER BY r\.id SEPARATOR ', '\) as role/);
  assert.match(repository, /INNER JOIN roles filter_r/);
  assert.doesNotMatch(repository, /INNER JOIN roles r ON ur\.role_id/);
  assert.match(repository, /page_size: normalizedPageSize/);
  assert.match(repository, /total_pages/);
  assert.match(repository, /has_next/);
  assert.match(repository, /has_prev/);
  assert.doesNotMatch(repository, /SELECT\s+u\.\*/);
  assert.doesNotMatch(repository, /SELECT\s+\*\s+FROM\s+users/i);
  assert.doesNotMatch(repository, /\bu\.role\b|\bu\.group_name\b/);
  assert.doesNotMatch(route, /\bu\.role\b|\bu\.group_name\b|\bgroup_name\b/);
  assert.match(route, /beginTransaction\(\)/);
  assert.match(route, /INSERT INTO user_roles/);
  assert.match(route, /role_ids/);
  assert.match(api, /page_size\?: number/);
  assert.match(api, /total_pages: number/);
  assert.doesNotMatch(api, /\blimit\??:|totalPages|hasNextPage|hasPrevPage/);
  assert.doesNotMatch(queryModal, /\/users\/employees\?limit=/);
});

test('reminders contract uses canonical options and explicit response columns', () => {
  const route = read('src/routes/reminders.js');
  const service = read('src/services/reminder.service.js');
  const page = read('../frontend/src/views/reminders/ReminderView.vue');
  const registry = JSON.parse(read('../config/field-contracts.json'));
  const contract = registry.contracts.reminders;

  assert.deepEqual(contract.legacy, []);
  for (const field of ['limit', 'totalPages']) {
    assert.ok(contract.retired.includes(field), `reminders 未登记已退役字段 ${field}`);
  }
  assert.equal(registry.legacyBoundarySources.reminders, undefined);
  assert.match(route, /page_size: req\.query\.page_size/);
  assert.match(route, /type_id: req\.query\.type_id/);
  assert.match(route, /user_id: req\.user\.id/);
  assert.match(route, /can_manage: canManageReminders\(req\)/);
  assert.doesNotMatch(route, /req\.query\.limit|pageSize:|typeId:|userId:|canManage:/);
  assert.match(service, /async list\(\{ page = 1, page_size = 20, keyword = '', search_fields = \['title', 'content'\], status = '', type_id = '', user_id = null, can_manage = false \}/);
  assert.match(service, /async getById\(id, \{ user_id = null, can_manage = true \}/);
  assert.match(service, /REMINDER_SELECT_COLUMNS/);
  assert.match(service, /REMINDER_ALIASED_COLUMNS/);
  assert.match(service, /REMINDER_TYPE_COLUMNS/);
  assert.doesNotMatch(service, /SELECT\s+\*|SELECT\s+r\.\*/i);
  assert.doesNotMatch(service, /\.\.\.rule|r\.repeat_rule,rt\.name/);
  assert.match(service, /page_size: page_size_number/);
  assert.match(service, /total_pages,/);
  assert.match(service, /has_next: page_number < total_pages/);
  assert.match(service, /has_prev: page_number > 1/);
  assert.match(page, /page_size:pagination\.page_size/);
  assert.doesNotMatch(page, /params:\{[^}]*\blimit:/);
  assert.match(route, /REMINDER_FIELD_MODULE_KEY = 'reminders_reminderview'/);
  assert.match(route, /maskReminderPayloadWithPermissions/);
  assert.match(route, /rejectHiddenReminderWrites/);
  assert.match(route, /code: 'FIELD_PERMISSION_DENIED'/);
  assert.match(service, /allowed_search_fields/);
  assert.match(page, /pickVisibleReminderFields/);
  assert.match(page, /shouldShowActionColumn/);
  assert.match(read('../frontend/src/components/ReminderHost.vue'), /canViewReminderField\('recipient_status'\)/);
  assert.match(read('../frontend/src/config/moduleFields.js'), /execution_info\.recipient_status/);
});

test('shared experience contract controls fields and uses canonical pagination', () => {
  const route = read('src/routes/shared.js');
  const service = read('src/services/shared.service.js');
  const page = read('../frontend/src/views/shared/SharedView.vue');
  const helper = read('../frontend/src/views/shared/shared-field-permissions.ts');
  const registry = JSON.parse(read('../config/field-contracts.json'));
  const contract = registry.contracts.shared;

  assert.deepEqual(contract.legacy, []);
  for (const field of ['limit', 'totalPages', 'hasNextPage', 'hasPrevPage']) {
    assert.ok(contract.retired.includes(field), `shared 未登记已退役字段 ${field}`);
  }
  assert.equal(registry.legacyBoundarySources.shared, undefined);
  assert.match(route, /SHARED_FIELD_MODULE_KEY = 'shared_sharedview'/);
  assert.match(route, /maskSharedPayloadWithPermissions/);
  assert.match(route, /rejectHiddenSharedWrites/);
  assert.match(route, /requireVisibleSharedField/);
  assert.match(route, /search_fields/);
  assert.match(route, /code: 'FIELD_PERMISSION_DENIED'/);
  assert.match(service, /async list\(userId, \{ page = 1, page_size = 12, keyword = '', search_fields/);
  assert.doesNotMatch(service, /SELECT\s+p\.\*/i);
  assert.match(service, /page_size: page_size_int/);
  assert.match(service, /total_pages/);
  assert.match(service, /has_next/);
  assert.match(service, /has_prev/);
  assert.match(page, /pagination\.page_size/);
  assert.doesNotMatch(page, /pagination\.limit|page:pagination\.page,limit:/);
  assert.match(page, /pickVisibleSharedFields/);
  assert.match(page, /showPostActionColumn/);
  assert.match(helper, /post_info\.attachments/);
});

test('role field permission keys migrate transactionally to registered modules', () => {
  const migration = read('scripts/migrate-role-field-module-keys.js');
  const route = read('src/routes/permission-management.js');
  const normalizer = read('src/utils/field-permission-normalizer.js');
  const migrationNormalizer = read('scripts/field-permission-migration-normalizer.js');
  const configMigration = read('scripts/migrate-role-field-config-json.js');

  assert.match(migration, /process\.argv\.includes\('--execute'\)/);
  assert.match(migration, /beginTransaction\(\)/);
  assert.match(migration, /connection\.rollback\(\)/);
  assert.match(migration, /unmatched_after/);
  assert.match(migration, /query: 'query_queryview'/);
  assert.match(migration, /subsidy: 'subsidy_subsidyview'/);
  assert.match(migrationNormalizer, /'time_info\.Inventorytime': 'time_info\.inventory_time'/);
  assert.match(migrationNormalizer, /'basic_info\.purchase_price': 'basic_info\.purchase_cost'/);
  assert.doesNotMatch(normalizer, /Inventorytime|purchase_price|hiddenFields|editableFields/);
  assert.match(configMigration, /process\.argv\.includes\('--execute'\)/);
  assert.match(configMigration, /beginTransaction\(\)/);
  assert.match(configMigration, /connection\.rollback\(\)/);
  assert.doesNotMatch(configMigration, /\b(?:DELETE|DROP|TRUNCATE|INSERT)\b/);
  assert.doesNotMatch(route, /shortModuleKey/);
  assert.doesNotMatch(route, /req\.body\?\.moduleKey/);
  assert.doesNotMatch(route, /req\.body\?\.fieldConfig/);
  assert.match(route, /message: '模块不存在或已停用'/);
});

test('H5 public product errors use safe server responses', () => {
  const route = read('src/routes/shop-public.js');
  for (const message of ['获取商品列表失败', '获取聚合商品列表失败', '搜索商品失败']) {
    assert.match(route, new RegExp(`ApiResponse\\.serverError\\(res, '${message}', error\\)`));
  }
});
