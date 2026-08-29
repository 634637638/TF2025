'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'config/field-contracts.json'), 'utf8'));
const contracts = registry.contracts;

test('field contracts declare canonical and legacy names separately', () => {
  for (const [name, contract] of Object.entries(contracts)) {
    assert.ok(Array.isArray(contract.canonical) && contract.canonical.length > 0, `${name} 缺少规范字段`);
    assert.equal(new Set(contract.canonical).size, contract.canonical.length, `${name} 规范字段重复`);
    assert.equal(new Set(contract.legacy || []).size, (contract.legacy || []).length, `${name} 旧字段重复`);
    for (const field of contract.legacy || []) {
      assert.ok(!contract.canonical.includes(field), `${name} 同时把 ${field} 声明为新旧字段`);
    }
  }
});

test('stock-in retires request, response and pagination aliases after read-only verification', () => {
  const contract = contracts['stock-in'];

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'stock_in_date', 'notes', 'purchase_price', 'limit', 'pages', 'productType',
    'brandId', 'storeId', 'supplierId', 'startDate', 'endDate', 'todayStockIn',
    'totalItems', 'totalValue', 'settledCount', 'unit_cost', 'total_cost',
    'note', 'created_at', 'updated_at', 'actualOperatorName'
  ]) {
    assert.ok(contract.retired.includes(field), `stock-in 未退役 ${field}`);
  }
  for (const field of [
    'purchase_cost', 'inventory_time', 'remarks', 'payment_status', 'page_size',
    'total_pages', 'has_next', 'has_prev', 'today_stock_in', 'total_items',
    'total_value', 'settled_count', 'unsettled_count', 'unknown_payment_count'
  ]) {
    assert.ok(contract.canonical.includes(field), `stock-in 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources['stock-in'], undefined);
  assert.ok(registry.auditSources['stock-in'].includes('frontend/src/components/StockInDetailModal.vue'));
  assert.ok(registry.auditSources['stock-in'].includes('frontend/src/types/inventory.ts'));
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.purchase_records, 986);
  assert.equal(contract.verification.legacy_physical_columns, 0);
  assert.equal(contract.verification.missing_purchase_cost, 71);
  assert.equal(contract.verification.missing_inventory_time, 0);
  assert.equal(contract.verification.missing_relations, 0);
  assert.equal(contract.verification.duplicate_in_stock_imeis, 0);
  assert.equal(contract.verification.paid_records, 767);
  assert.equal(contract.verification.unpaid_records, 219);
  assert.equal(contract.verification.explicit_list_and_stats_queries, 'passed');
  assert.equal(contract.verification.canonical_inventory_time_sorting, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('salary contracts retire request and response aliases after migration', () => {
  const recordContract = contracts['salary-records'];
  const templateContract = contracts['salary-templates'];

  assert.deepEqual(recordContract.legacy, []);
  assert.deepEqual(recordContract.retired, ['salestime', 'limit', 'totalPages', 'hasNext', 'hasPrev']);
  assert.deepEqual(templateContract.legacy, []);
  assert.deepEqual(templateContract.retired, ['limit', 'totalPages', 'hasNext', 'hasPrev', 'templateId']);
  assert.equal(registry.legacyBoundarySources['salary-records'], undefined);
  assert.equal(registry.legacyBoundarySources['salary-templates'], undefined);
  for (const field of ['page_size', 'total_pages', 'has_next', 'has_prev', 'sale_time']) {
    assert.ok(recordContract.canonical.includes(field), `salary-records 缺少 ${field}`);
  }
  for (const field of ['page_size', 'total_pages', 'has_next', 'has_prev', 'template_id']) {
    assert.ok(templateContract.canonical.includes(field), `salary-templates 缺少 ${field}`);
  }
});

test('brands contract retires legacy pagination after read-only database verification', () => {
  const contract = contracts.brands;

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['limit', 'pages']);
  for (const field of ['page_size', 'total_pages', 'has_next', 'has_prev']) {
    assert.ok(contract.canonical.includes(field), `brands 缺少 ${field} 规范字段`);
    assert.ok(contract.responseFields.includes(field), `brands 缺少 ${field} 响应字段`);
  }
  assert.equal(contract.database_verification, 'completed');
  assert.equal(contract.verification.explicit_column_query, 'passed');
  assert.equal(contract.verification.name_suggestion_search, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('models contract retires aliases absent from the live schema', () => {
  const contract = contracts.models;

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['limit', 'pages', 'sortBy', 'sortOrder', 'is_active', 'series']);
  for (const field of [
    'brand_id', 'brand_name', 'status', 'sort_order', 'page_size',
    'total_pages', 'has_next', 'has_prev', 'related_brands', 'by_brand', 'newest_model'
  ]) {
    assert.ok(contract.canonical.includes(field), `models 缺少 ${field} 规范字段`);
  }
  assert.equal(contract.canonical.includes('series'), false);
  assert.equal(contract.database_verification, 'completed');
  assert.equal(contract.verification.brand_relation_integrity, 'passed');
  assert.equal(contract.verification.canonical_sorting, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('colors contract retires aliases and unsupported live-schema fields', () => {
  const contract = contracts.colors;

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, [
    'limit', 'pages', 'sortBy', 'sortOrder', 'is_active', 'search',
    'brand_id', 'category', 'is_premium', 'hex_code', 'relatedPhones'
  ]);
  for (const field of [
    'name', 'status', 'sort_order', 'page_size', 'total_pages',
    'has_next', 'has_prev', 'active', 'inactive', 'related_phones'
  ]) {
    assert.ok(contract.canonical.includes(field), `colors 缺少 ${field} 规范字段`);
  }
  for (const field of ['brand_id', 'category', 'is_premium', 'is_active', 'hex_code']) {
    assert.equal(contract.canonical.includes(field), false, `colors 不应声明不存在的字段 ${field}`);
  }
  assert.equal(contract.database_verification, 'completed');
  assert.equal(contract.verification.explicit_column_query, 'passed');
  assert.equal(contract.verification.canonical_sorting, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('memories contract retires aliases and fabricated response fields', () => {
  const contract = contracts.memories;

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'limit', 'pages', 'sortBy', 'sortOrder', 'is_active', 'search',
    'name', 'display_name', 'price_multiplier', 'bySize', 'avgSortOrder', 'newestMemory'
  ]) {
    assert.ok(contract.retired.includes(field), `memories 未退役 ${field}`);
  }
  for (const field of [
    'size', 'storage_size', 'storage_unit', 'is_combo', 'status', 'sort_order',
    'page_size', 'total_pages', 'has_next', 'has_prev', 'related_phones'
  ]) {
    assert.ok(contract.canonical.includes(field), `memories 缺少 ${field} 规范字段`);
  }
  assert.equal(contract.database_verification, 'completed');
  assert.equal(contract.verification.size_parsing, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('suppliers contract retires pagination aliases after live-schema verification', () => {
  const contract = contracts.suppliers;

  assert.deepEqual(contract.legacy, []);
  for (const field of ['limit', 'pages', 'totalPages', 'hasNextPage', 'hasPrevPage', 'accounts']) {
    assert.ok(contract.retired.includes(field), `suppliers 未退役 ${field}`);
  }
  for (const field of [
    'page_size', 'total_pages', 'has_next', 'has_prev', 'sort_by', 'sort_order',
    'accessories_count', 'accessories_total_cost', 'phones_count', 'phones_total_cost'
  ]) {
    assert.ok(contract.canonical.includes(field), `suppliers 缺少 ${field} 规范字段`);
  }
  assert.equal(contract.database_verification, 'completed');
  assert.equal(contract.verification.explicit_column_query, 'passed');
  assert.equal(contract.verification.relation_aggregates, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('attendance contract has no runtime compatibility after read-only database verification', () => {
  const contract = contracts.attendance;

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'limit', 'totalPages', 'hasNext', 'hasPrev', 'monthlyLimit', 'totalQuota',
    'lastMonth', 'currentMonth', 'leaveDays', 'overtimeHours', 'absent_days', 'absent_reason', 'note'
  ]) {
    assert.ok(contract.retired.includes(field), `attendance 未退役 ${field}`);
  }
  for (const field of [
    'employee_id', 'record_date', 'record_type', 'leave_days', 'overtime_hours',
    'monthly_leave_days', 'monthly_limit', 'total_quota', 'last_month',
    'current_month', 'page_size', 'total_pages', 'has_next', 'has_prev'
  ]) {
    assert.ok(contract.canonical.includes(field), `attendance 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources.attendance, undefined);
  assert.ok(registry.auditSources.attendance.includes('frontend/src/config/moduleFields.js'));
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.explicit_column_query, 'passed');
  assert.equal(contract.verification.employee_date_status_filters, 'passed');
  assert.equal(contract.verification.canonical_pagination, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('subsidy contract retires pagination and handler aliases after read-only verification', () => {
  const contract = contracts.subsidy;

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'limit', 'current', 'pageSize', 'totalPages', 'hasNextPage', 'hasPrevPage',
    'hasDifferentHandler', 'handlerInfo'
  ]) {
    assert.ok(contract.retired.includes(field), `subsidy 未退役 ${field}`);
  }
  for (const field of [
    'page_size', 'total_pages', 'has_next', 'has_prev', 'has_different_handler',
    'handler_info', 'handler_name', 'handler_phone', 'handler_idcard', 'subsidy_calc_price'
  ]) {
    assert.ok(contract.canonical.includes(field), `subsidy 缺少 ${field} 规范字段`);
  }
  for (const field of [
    'page_size', 'total_pages', 'has_next', 'has_prev', 'has_different_handler',
    'handler_info', 'handler_name', 'handler_phone', 'handler_idcard'
  ]) {
    assert.ok(contract.responseFields.includes(field), `subsidy 缺少 ${field} 响应字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources.subsidy, undefined);
  for (const source of [
    'backend/src/routes/subsidy.js',
    'backend/src/services/dataMaskingService.js',
    'frontend/src/composables/useFieldPermissions.ts',
    'frontend/src/config/moduleFields.js',
    'frontend/src/views/subsidy/SubsidyView.vue',
    'frontend/src/views/subsidy/components/SubsidyListSection.vue',
    'frontend/src/views/subsidy/components/SubsidyApplyDialog.vue',
    'frontend/src/views/subsidy/components/SubsidyEditDialog.vue',
    'frontend/src/views/subsidy/components/SubsidyDetailDialog.vue',
    'frontend/src/views/subsidy/components/SubsidyPhotoManageDialog.vue'
  ]) {
    assert.ok(registry.auditSources.subsidy.includes(source), `subsidy 未登记审计文件 ${source}`);
  }
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.column_count, 31);
  assert.equal(contract.verification.row_count, 491);
  assert.equal(contract.verification.handler_records, 165);
  assert.equal(contract.verification.relation_integrity, 'passed');
  assert.equal(contract.verification.canonical_pagination, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('H5 admin orders retire request aliases after read-only database verification', () => {
  const contract = contracts['h5-orders'];

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['limit', 'startDate', 'endDate']);
  for (const field of [
    'page_size', 'start_date', 'end_date', 'total_pages', 'has_next', 'has_prev',
    'order_number', 'customer_name', 'customer_phone', 'cancel_reason', 'item_count'
  ]) {
    assert.ok(contract.canonical.includes(field), `h5-orders 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources['h5-orders'], undefined);
  for (const source of [
    'backend/src/routes/sales-management.js',
    'backend/src/routes/shop.js',
    'backend/src/services/shop-public.service.js',
    'backend/src/services/shop.service.js',
    'frontend/src/views/H5-admin/page/orders.vue',
    'frontend/src/api/shop.ts'
  ]) {
    assert.ok(registry.auditSources['h5-orders'].includes(source), `h5-orders 未登记审计文件 ${source}`);
  }
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.order_column_count, 14);
  assert.equal(contract.verification.item_column_count, 8);
  assert.equal(contract.verification.order_count, 16);
  assert.equal(contract.verification.item_count, 16);
  assert.equal(contract.verification.relation_integrity, 'passed');
  assert.equal(contract.verification.canonical_status_date_pagination, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('H5 customer orders retire public lookup aliases after read-only verification', () => {
  const contract = contracts['h5-customer-orders'];

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['limit']);
  assert.deepEqual(contract.retiredEndpointParameters, ['phone', 'name']);
  for (const field of [
    'customer_phone', 'customer_name', 'page_size', 'total_pages', 'has_next',
    'has_prev', 'order_number', 'status', 'items'
  ]) {
    assert.ok(contract.canonical.includes(field), `h5-customer-orders 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources['h5-customer-orders'], undefined);
  for (const source of [
    'backend/src/routes/shop-public.js',
    'backend/src/services/shop-public.service.js',
    'frontend/src/api/shop-public.ts',
    'frontend/src/views/H5-mobile/page/MyOrders.vue',
    'frontend/src/views/H5-mobile/page/OrderQuery.vue'
  ]) {
    assert.ok(registry.auditSources['h5-customer-orders'].includes(source), `h5-customer-orders 未登记审计文件 ${source}`);
  }
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.order_count, 16);
  assert.equal(contract.verification.valid_identity_rows, 16);
  assert.equal(contract.verification.sample_identity_match_count, 2);
  assert.equal(contract.verification.identity_filter, 'passed');
  assert.equal(contract.verification.canonical_pagination, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('H5 public products retire pagination aliases after read-only verification', () => {
  const contract = contracts['h5-public-products'];

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['limit', 'totalPages', 'hasNextPage', 'hasPrevPage']);
  for (const field of [
    'page_size', 'total_pages', 'has_next', 'has_prev', 'brand_id', 'model_id',
    'color_id', 'memory_id', 'sale_price', 'total_stock', 'main_image'
  ]) {
    assert.ok(contract.canonical.includes(field), `h5-public-products 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources['h5-public-products'], undefined);
  assert.ok(registry.auditSources['h5-public-products'].includes('backend/src/services/shop-public.service.js'));
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.in_stock_count, 86);
  assert.equal(contract.verification.published_template_count, 62);
  assert.equal(contract.verification.visible_used_count, 13);
  assert.equal(contract.verification.aggregate_count, 75);
  assert.equal(contract.verification.canonical_list_pagination, 'passed');
  assert.equal(contract.verification.canonical_aggregate_pagination, 'passed');
  assert.equal(contract.verification.canonical_search_pagination, 'passed');
  assert.equal(contract.verification.search_ids_complete, true);
  assert.equal(contract.verification.write_operations, 0);
});

test('H5 sold products retire image and sale-time aliases after read-only verification', () => {
  const contract = contracts['h5-sold-products'];

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['sale_date', 'salestime', 'imageIds']);
  for (const field of [
    'id', 'phone_id', 'imei', 'brand', 'model', 'color', 'memory', 'sale_time',
    'image_count', 'image_ids', 'image_url', 'image_type', 'is_primary',
    'sort_order', 'uploaded_by', 'page_size', 'total_pages'
  ]) {
    assert.ok(contract.canonical.includes(field), `h5-sold-products 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources['h5-sold-products'], undefined);
  for (const source of [
    'backend/src/routes/shop.js',
    'backend/src/services/shop.service.js',
    'frontend/src/types/h5.ts',
    'frontend/src/views/H5-admin/page/SoldProductsView.vue',
    'frontend/src/views/query/QueryView.vue'
  ]) {
    assert.ok(registry.auditSources['h5-sold-products'].includes(source), `h5-sold-products 未登记审计文件 ${source}`);
  }
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.sold_products_with_images, 92);
  assert.equal(contract.verification.image_rows, 781);
  assert.equal(contract.verification.missing_sale_time, 0);
  assert.equal(contract.verification.orphan_images, 9);
  assert.equal(contract.verification.canonical_time_sorting, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('H5 customer sales retire legacy time fields after read-only verification', () => {
  const contract = contracts['h5-customer-sales'];

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['sale_date', 'salestime']);
  for (const field of [
    'id', 'invoice_number', 'sale_time', 'sale_price', 'payment_method',
    'store_name', 'operator_name', 'imei', 'serial_number', 'product_name',
    'brand_name', 'model_name', 'color_name', 'profit', 'is_new'
  ]) {
    assert.ok(contract.canonical.includes(field), `h5-customer-sales 缺少 ${field} 规范字段`);
    assert.ok(contract.responseFields.includes(field), `h5-customer-sales 缺少 ${field} 响应字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources['h5-customer-sales'], undefined);
  assert.ok(registry.auditSources['h5-customer-sales'].includes('frontend/src/api/auth.ts'));
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.sales_count, 15471);
  assert.equal(contract.verification.customer_linked_sales, 15471);
  assert.equal(contract.verification.missing_effective_sale_time, 0);
  assert.equal(contract.verification.orphan_customer_sales, 0);
  assert.equal(contract.verification.canonical_time_sorting, 'passed');
  assert.equal(contract.verification.explicit_response_mapping, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('sales contract retires request and response aliases after read-only verification', () => {
  const contract = contracts.sales;

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'purchase_price', 'Inventorytime', 'purchase_date', 'inbound_date',
    'salestime', 'sale_date', 'cost', 'limit', 'date_start', 'date_end'
  ]) {
    assert.ok(contract.retired.includes(field), `sales 未退役 ${field}`);
  }
  assert.deepEqual(contract.retiredEndpointParameters, ['price', 'date']);
  for (const field of ['purchase_cost', 'inventory_time', 'sale_time', 'page_size', 'total_pages', 'has_next', 'has_prev']) {
    assert.ok(contract.canonical.includes(field), `sales 缺少 ${field} 规范字段`);
    assert.ok(contract.responseFields.includes(field), `sales 缺少 ${field} 响应字段`);
  }
  for (const field of ['start_date', 'end_date']) {
    assert.ok(contract.canonical.includes(field), `sales 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources.sales, undefined);
  for (const source of [
    'frontend/src/views/sales/sales-phone-helpers.ts',
    'frontend/src/views/sales/useSalesCheckout.ts',
    'frontend/src/views/sales/useSalesInventorySummary.ts',
    'frontend/src/views/sales/page/SalesTableView.vue'
  ]) {
    assert.ok(registry.auditSources.sales.includes(source), `sales 未登记审计文件 ${source}`);
  }
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.in_stock_count, 86);
  assert.equal(contract.verification.sales_count, 15471);
  assert.equal(contract.verification.inventory_relation_integrity, 'passed');
  assert.equal(contract.verification.sales_relation_integrity, 'passed');
  assert.equal(contract.verification.missing_sale_time, 0);
  assert.equal(contract.verification.sale_time_sorting, 'passed');
  assert.equal(contract.verification.repository_read_queries, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('preorder CRUD no longer references removed database columns', () => {
  const source = fs.readFileSync(path.join(root, 'backend/src/routes/preorders.js'), 'utf8');
  const form = fs.readFileSync(path.join(root, 'frontend/src/views/preorders/page/PreorderFormModal.vue'), 'utf8');
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'config/field-contracts.json'), 'utf8'));
  for (const field of ['expected_price', 'advance_payment', 'deposit', 'customer_name', 'customer_phone']) {
    assert.doesNotMatch(source, new RegExp(`\\bp\\.${field}\\b`), `预定 CRUD 仍读取 ${field}`);
  }
  assert.deepEqual(registry.contracts.preorders.legacy, []);
  assert.equal(registry.legacyBoundarySources.preorders, undefined);
  assert.equal(registry.contracts.preorders.database_verification, 'completed_read_only');
  assert.equal(registry.contracts.preorders.verification.write_operations, 0);
  assert.doesNotMatch(form, /params:\s*\{[^}]*\blimit:/s);
});

test('repairs contract has no runtime compatibility after read-only database verification', () => {
  const contract = contracts.repairs;

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'brand', 'model', 'repair_cost', 'fault_description', 'remark',
    'limit', 'totalPages', 'monthlyRevenue'
  ]) {
    assert.ok(contract.retired.includes(field), `repairs 未退役 ${field}`);
  }
  for (const field of [
    'customer_id', 'brand_id', 'phone_model', 'problem_description',
    'estimated_cost', 'actual_cost', 'technician_id', 'remarks', 'status',
    'page_size', 'total_pages', 'has_next', 'has_prev', 'monthly_revenue'
  ]) {
    assert.ok(contract.canonical.includes(field), `repairs 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources.repairs, undefined);
  assert.ok(registry.auditSources.repairs.includes('frontend/src/views/repairs/RepairsView.vue'));
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.legacy_physical_columns, 0);
  assert.equal(contract.verification.relation_integrity, 'passed');
  assert.equal(contract.verification.canonical_pagination, 'passed');
  assert.equal(contract.verification.write_operations, 0);
});

test('data-check contract retires request and response aliases after read-only verification', () => {
  const contract = contracts['data-check'];

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'primaryId', 'duplicateIds', 'mergeGroups', 'duplicateCount', 'duplicateGroups',
    'isDuplicateRows', 'isEmpty', 'mergedIds', 'mergedCount', 'currentPage', 'pageSize'
  ]) {
    assert.ok(contract.retired.includes(field), `data-check 未退役 ${field}`);
  }
  for (const field of [
    'primary_id', 'duplicate_ids', 'merge_groups', 'duplicate_groups',
    'duplicate_count', 'is_duplicate_rows', 'is_empty', 'merged_ids', 'merged_count'
  ]) {
    assert.ok(contract.canonical.includes(field), `data-check 缺少 ${field} 规范字段`);
  }
  assert.deepEqual(registry.legacyBoundarySources['data-check'], undefined);
  assert.ok(registry.auditSources['data-check'].includes('backend/src/services/data-check.service.js'));
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.checked_tables, 8);
  assert.equal(contract.verification.write_operations, 0);
});

test('inventory analytics contract covers canonical filters and response fields', () => {
  const contract = contracts.analytics;
  for (const field of ['store_id', 'supplier_id']) {
    assert.ok(contract.canonical.includes(field), `analytics 缺少 ${field} 规范筛选字段`);
  }
  for (const field of [
    'total_products', 'total_value', 'inventory_health', 'category_analysis',
    'supplier_analysis', 'current_stock', 'reorder_point', 'unit_cost',
    'stock_status', 'sale_price', 'sale_time', 'last_sale_time', 'supplier_count'
  ]) {
    assert.ok(contract.responseFields.includes(field), `analytics 缺少 ${field} 响应字段`);
  }

  const source = fs.readFileSync(path.join(root, 'backend/src/routes/analytics.js'), 'utf8');
  assert.match(source, /req\.query\.store_id/);
  assert.match(source, /req\.query\.supplier_id/);
  assert.match(source, /getModelStockWarnings\(undefined, limitValue, \{ storeId, supplierId \}\)/);
});

test('accessories contract uses canonical money, pagination and filter fields', () => {
  const contract = contracts.accessories;
  for (const field of [
    'page',
    'page_size',
    'total_pages',
    'purchase_cost',
    'sale_price',
    'start_date',
    'end_date',
    'low_stock_only'
  ]) {
    assert.ok(contract.canonical.includes(field), `accessories 缺少 ${field} 规范字段`);
  }
  for (const field of ['purchase_cost', 'sale_price', 'inventory_time', 'total_amount', 'stock_status']) {
    assert.ok(contract.responseFields.includes(field), `accessories 缺少 ${field} 响应字段`);
  }

  const route = fs.readFileSync(path.join(root, 'backend/src/routes/accessories.js'), 'utf8');
  const repository = fs.readFileSync(path.join(root, 'backend/src/repositories/accessory.repository.js'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'frontend/src/views/accessories/AccessoriesView.vue'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'frontend/src/components/AccessoryStockInModal.vue'), 'utf8');

  assert.match(route, /purchase_cost: body\.purchase_cost,/);
  assert.match(route, /sale_price: body\.sale_price,/);
  assert.match(route, /page_size: req\.query\.page_size,/);
  assert.match(route, /start_date: req\.query\.start_date,/);
  assert.doesNotMatch(route, /purchase_price|selling_price|pageSize|startDate|endDate|lowStockOnly/);
  assert.match(repository, /a\.purchase_cost/);
  assert.match(repository, /a\.sale_price/);
  assert.doesNotMatch(repository, /SELECT\s+a\.\*/);
  assert.match(view, /row\.purchase_cost/);
  assert.match(view, /row\.sale_price/);
  assert.match(modal, /formData\.purchase_cost/);
  assert.match(modal, /formData\.sale_price/);
  assert.doesNotMatch(view, /row\.purchase_price|row\.selling_price/);
  assert.doesNotMatch(modal, /formData\.purchase_price|formData\.selling_price/);
});

test('accessory physical migration is rename-only and rejects partial schemas', () => {
  const migration = fs.readFileSync(path.join(root, 'backend/scripts/migrate-accessory-columns.js'), 'utf8');

  assert.match(migration, /RENAME COLUMN/);
  assert.match(migration, /--execute/);
  assert.match(migration, /partially migrated schema state/);
  assert.doesNotMatch(migration, /\b(DROP|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(migration, /\b(INSERT|UPDATE)\s+(INTO\s+)?(accessories|accessory_stock_in)/i);
});

test('phone and sales physical migration is registered and rename-only', () => {
  const migration = fs.readFileSync(path.join(root, 'backend/scripts/migrate-phone-sales-columns.js'), 'utf8');
  const physicalMigrations = JSON.parse(fs.readFileSync(path.join(root, 'config/field-contracts.json'), 'utf8')).physicalMigrations;

  assert.equal(physicalMigrations['phones-sales-columns'].status, 'completed');
  assert.equal(physicalMigrations['phones-sales-columns'].database_verification, 'completed');
  for (const mapping of [
    ['Inventorytime', 'inventory_time'],
    ['salestime', 'sale_time'],
    ['price', 'sale_price'],
    ['cost', 'purchase_cost'],
    ['sale_date', 'sale_time']
  ]) {
    assert.match(migration, new RegExp(`from: '${mapping[0]}'`));
    assert.match(migration, new RegExp(`to: '${mapping[1]}'`));
  }
  assert.match(migration, /RENAME COLUMN/);
  assert.match(migration, /assertSameSnapshot/);
  assert.doesNotMatch(migration, /\b(DROP|DELETE|TRUNCATE)\b/i);
});

test('database-wide physical field audit is registered and keeps price history semantics', () => {
  const contractFile = JSON.parse(fs.readFileSync(path.join(root, 'config/field-contracts.json'), 'utf8'));
  const audit = contractFile.physicalFieldAudit['database-wide-snake-case'];
  const auditScript = fs.readFileSync(path.join(root, 'backend/scripts/check-physical-field-contract.js'), 'utf8');
  const priceListService = fs.readFileSync(path.join(root, 'backend/src/services/price-list.service.js'), 'utf8');

  assert.equal(audit.database_verification, 'completed');
  assert.equal(audit.result.legacy_candidate_columns, 0);
  assert.equal(audit.result.uppercase_or_camel_case_columns, 0);
  assert.deepEqual(audit.excluded_canonical_fields, [
    {
      table: 'price_history',
      column: 'cost_price',
      reason: '价格历史表独立的进货价字段，与 phones.purchase_cost 不是同一业务契约，不执行重命名'
    }
  ]);
  assert.match(auditScript, /SHOW TABLES/);
  assert.match(auditScript, /SHOW COLUMNS FROM \?\?/);
  assert.doesNotMatch(auditScript, /\b(ALTER|DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/i);
  assert.match(priceListService, /FROM price_history/);
  assert.match(priceListService, /cost_price/);
});

test('wholesale-transfer retires aliases after database verification', () => {
  const contract = contracts['wholesale-transfer'];
  for (const field of [
    'sale_time',
    'purchase_cost',
    'wholesale_price',
    'page',
    'page_size',
    'total_pages',
    'has_next',
    'has_prev'
  ]) {
    assert.ok(contract.canonical.includes(field), `wholesale-transfer 缺少 ${field} 规范字段`);
  }
  for (const field of [
    'sale_time',
    'wholesale_price',
    'purchase_cost',
    'profit',
    'total_count',
    'total_amount',
    'total_profit',
    'page_size',
    'total_pages',
    'has_next',
    'has_prev'
  ]) {
    assert.ok(contract.responseFields.includes(field), `wholesale-transfer 缺少 ${field} 响应字段`);
  }
  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retired, ['sale_date', 'limit', 'totalPages', 'hasNextPage', 'hasPrevPage']);
  assert.equal(contract.database_verification, 'completed_after_data_migration');
  assert.equal(contract.verification.transfer_sales, 335);
  assert.equal(contract.verification.missing_relations, 0);
  assert.equal(contract.verification.supplier_proxy_amount_policy, 'all_zero');
  assert.equal(contract.verification.supplier_proxy_sale_price_total, '0.00');
  assert.equal(contract.verification.supplier_proxy_purchase_cost_total, '0.00');
  assert.equal(contract.verification.migration_updated_phone_rows, 231);
  assert.equal(contract.verification.migration_updated_sale_rows, 229);

  const controller = fs.readFileSync(path.join(root, 'backend/src/controllers/transfer.controller.js'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'backend/src/routes/transfers.js'), 'utf8');
  const service = fs.readFileSync(path.join(root, 'backend/src/services/transfer.service.js'), 'utf8');
  const helpers = fs.readFileSync(path.join(root, 'frontend/src/components/wholesale/helpers.ts'), 'utf8');
  const types = fs.readFileSync(path.join(root, 'frontend/src/components/wholesale/types.ts'), 'utf8');
  const modal = fs.readFileSync(path.join(root, 'frontend/src/components/WholesaleModal.vue'), 'utf8');
  const summary = fs.readFileSync(path.join(root, 'frontend/src/components/wholesale/WholesalePhoneSummarySection.vue'), 'utf8');

  assert.match(controller, /parseInt\(req\.query\.page_size, 10\)/);
  assert.doesNotMatch(controller, /sale_date|req\.query\.limit/);
  assert.doesNotMatch(controller, /sales_salesview|LEGACY_TRANSFER_PERMISSION_MAP/);
  assert.match(routes, /requirePermission\('sales:wholesale', 'business'\)/);
  assert.match(routes, /requirePermission\('sales:proxy-transfer', 'business'\)/);
  assert.match(controller, /ApiResponse\.success\(res, '查询成功', result\.data, 200/);
  assert.match(service, /page_size = 20/);
  assert.match(service, /page_size: pageSize/);
  assert.match(service, /total_pages:/);
  assert.match(service, /has_next:/);
  assert.match(service, /has_prev:/);
  assert.doesNotMatch(service, /totalPages:/);
  assert.doesNotMatch(service, /proxy_supplier_id|generateRecordNumber|Date\.now\(\)\.toString\(\)\.slice/);
  assert.match(service, /p\.supplier_id/);
  assert.match(service, /ORDER BY s\.sale_time DESC, s\.id DESC/);
  assert.match(service, /SAVEPOINT wholesale_phone/);
  assert.match(service, /SAVEPOINT proxy_phone/);
  assert.doesNotMatch(helpers, /editCost|wholesalePrice|\blimit\s*:/);
  assert.doesNotMatch(types, /editCost|wholesalePrice/);
  assert.doesNotMatch(modal, /editCost|wholesalePrice/);
  assert.doesNotMatch(summary, /editCost|wholesalePrice/);
  assert.match(helpers, /purchase_cost:/);
  assert.match(helpers, /wholesale_price:/);
  assert.match(summary, /v-model="phone\.purchase_cost"/);
  assert.match(summary, /v-model="phone\.wholesale_price"/);
});

test('sales analytics uses canonical filters and snake_case response groups', () => {
  const contract = contracts.analytics;
  for (const field of ['total_sales', 'total_orders', 'average_order_value', 'top_products', 'sales_by_store', 'sales_by_period', 'revenue_forecast', 'sales_count', 'sales_amount', 'margin_rate', 'avg_price']) {
    assert.ok(contract.responseFields.includes(field), `analytics 缺少 ${field} 销售响应字段`);
  }
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/analytics.js'), 'utf8');
  assert.match(route, /req\.query\.start_date/);
  assert.match(route, /req\.query\.end_date/);
  assert.doesNotMatch(route, /req\.query\.startDate|req\.query\.endDate/);
  assert.match(route, /top_products:/);
  assert.match(route, /sales_by_store:/);
  assert.match(route, /sales_by_period:/);
  assert.match(route, /sales_count:/);
  assert.doesNotMatch(route, /topProducts:\s*topProducts\[0\]/);
});

test('profit analytics routes and page use canonical filter names', () => {
  const contract = contracts.analytics;
  for (const field of ['total_revenue', 'total_cost', 'gross_profit', 'total_sales_count']) {
    assert.ok(contract.responseFields.includes(field), `analytics 缺少 ${field} 利润响应字段`);
  }
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/analytics.js'), 'utf8');
  assert.match(route, /const startDate = req\.query\.start_date/);
  assert.match(route, /const storeId = req\.query\.store_id/);
  assert.doesNotMatch(route, /req\.query\.startDate|req\.query\.endDate|req\.query\.storeId/);
  const page = fs.readFileSync(path.join(root, 'frontend/src/views/analytics/page/ProfitAnalytics.vue'), 'utf8');
  assert.doesNotMatch(page, /params\.startDate\s*=/);
  assert.doesNotMatch(page, /params\.endDate\s*=/);
  assert.doesNotMatch(page, /params\.storeId\s*=/);
  assert.match(page, /params\.start_date/);
  assert.match(page, /params\.store_id/);
});

test('employee analytics applies canonical date/store filters and avoids fake fallback data', () => {
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/analytics.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'frontend/src/views/analytics/page/EmployeeAnalytics.vue'), 'utf8');
  assert.match(route, /router\.get\('\/employees\/detail'/);
  assert.match(route, /const startDate = req\.query\.start_date/);
  assert.match(route, /router\.get\('\/attendance\/summary'/);
  assert.match(route, /req\.query\.store_id/);
  assert.doesNotMatch(route, /req\.query\.startDate|req\.query\.endDate|req\.query\.storeId/);
  assert.doesNotMatch(page, /\{ value: 5, name: '管理员' \}/);
  assert.doesNotMatch(page, /\{ value: 8, name: '销售主管' \}/);
});

test('transfer analytics sends the same canonical filters for current and comparison ranges', () => {
  const page = fs.readFileSync(path.join(root, 'frontend/src/views/analytics/page/TransferAnalytics.vue'), 'utf8');
  assert.match(page, /start_date:/);
  assert.match(page, /end_date:/);
  assert.match(page, /currentParams\.store_id/);
  assert.match(page, /lastParams\.store_id/);
  assert.doesNotMatch(page, /currentParams\.startDate/);
  assert.doesNotMatch(page, /currentParams\.endDate/);
  assert.doesNotMatch(page, /currentParams\.storeId/);
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/analytics.js'), 'utf8');
  assert.match(route, /transfer_count:/);
  assert.match(route, /wholesale_product_ranks:/);
  assert.match(route, /store_distribution:/);
  assert.doesNotMatch(route, /transfer:\s*\{\s*transferCount/);
});

test('analytics overview keeps canonical filters and normalizes option responses', () => {
  const page = fs.readFileSync(path.join(root, 'frontend/src/views/analytics/AnalyticsView.vue'), 'utf8');
  const contract = contracts.analytics;
  for (const field of ['start_date', 'end_date', 'store_id', 'supplier_id']) {
    assert.ok(contract.canonical.includes(field), `analytics 缺少 ${field} 规范筛选字段`);
    assert.match(page, new RegExp(`${field}:`));
  }
  assert.match(page, /extractResponseData<any\[\]>/);
  assert.match(page, /String\(s\.id\) === String\(filterStoreId\.value\)/);
  assert.match(page, /String\(s\.id\) === String\(filterSupplierId\.value\)/);
  assert.doesNotMatch(page, /sortOptionsByOrder\(response\.data\)/);
  assert.doesNotMatch(page, /startDate:\s*filterStartDate/);
  assert.doesNotMatch(page, /storeId:\s*filterStoreId/);
});

test('customer analytics list carries canonical filters without duplicate pagination fields', () => {
  const page = fs.readFileSync(path.join(root, 'frontend/src/views/analytics/page/CustomerAnalytics.vue'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/analytics.js'), 'utf8');
  assert.match(page, /customerParams\.start_date/);
  assert.match(page, /customerParams\.end_date/);
  assert.match(page, /customerParams\.store_id/);
  assert.doesNotMatch(page, /page_size:\s*customerPageSize\.value,\s*page_size:/);
  assert.match(route, /router\.get\('\/customers\/high-value'/);
  assert.match(route, /req\.query\.start_date/);
  assert.match(route, /req\.query\.store_id/);
  assert.doesNotMatch(route, /req\.query\.startDate|req\.query\.endDate|req\.query\.storeId/);
  assert.match(route, /db\.query\(customersQuery, \[\.\.\.saleParams, \.\.\.searchParams\]\)/);
});

test('query sorting exposes canonical time and price fields at the API boundary', () => {
  const service = fs.readFileSync(path.join(root, 'backend/src/services/query.service.js'), 'utf8');
  const repository = fs.readFileSync(path.join(root, 'backend/src/repositories/query.repository.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'backend/src/controllers/query.controller.js'), 'utf8');
  assert.match(service, /sort_field: .*'sale_time'/);
  assert.match(service, /\['business_time', 'inventory_time', 'sale_time', 'brand', 'model', 'sale_price', 'purchase_cost'\]/);
  assert.match(repository, /inventory_time: 'p\.inventory_time'/);
  assert.match(repository, /sale_time: 'p\.sale_time'/);
  assert.match(repository, /purchase_cost: 'p\.purchase_cost'/);
  assert.match(controller, /\{ value: 'inventory_time', label: '入库时间' \}/);
  assert.match(controller, /\{ value: 'sale_time', label: '销售时间' \}/);
  assert.doesNotMatch(controller, /\{ value: 'purchase_date', label: '入库时间' \}/);
  assert.doesNotMatch(controller, /\{ value: 'sale_date', label: '销售时间' \}/);
  assert.deepEqual(contracts.query.legacy, []);
  assert.equal(registry.legacyBoundarySources.query, undefined);
  assert.equal(contracts.query.database_verification, 'completed_read_only');
  assert.equal(contracts.query.verification.legacy_response_keys, 0);
  assert.equal(contracts.query.verification.null_amounts_preserved, true);
  assert.equal(contracts.query.verification.supplier_proxy_zero_preserved, true);
  assert.equal(contracts.query.verification.write_operations, 0);
});

test('customers uses canonical filters, statistics and purchase history fields', () => {
  const contract = contracts.customers;
  for (const field of [
    'customer_type',
    'vip_level',
    'gender',
    'search',
    'search_fields',
    'status',
    'register_date_start',
    'register_date_end',
    'sort_by',
    'sort_order',
    'page_size',
    'total_pages',
    'total_customers',
    'active_customers',
    'new_customers',
    'premium_customers',
    'purchase_cost',
    'sale_price',
    'sale_time'
  ]) {
    assert.ok(contract.canonical.includes(field), `customers 缺少 ${field} 规范字段`);
  }

  const route = fs.readFileSync(path.join(root, 'backend/src/routes/customers.js'), 'utf8');
  const repository = fs.readFileSync(path.join(root, 'backend/src/repositories/customer.repository.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'frontend/src/views/customers/CustomersView.vue'), 'utf8');

  assert.equal(contract.legacy.length, 0);
  for (const field of ['limit', 'purchase_price', 'sale_date', 'salestime', 'totalCustomers']) {
    assert.ok(contract.retired.includes(field), `customers 未登记已退役字段 ${field}`);
  }
  assert.doesNotMatch(route, /req\.query\.limit/);
  assert.match(route, /register_date_start/);
  assert.match(route, /register_date_end/);
  assert.match(route, /total_customers/);
  assert.match(route, /active_customers/);
  assert.match(route, /new_customers/);
  assert.match(route, /premium_customers/);
  assert.match(route, /s\.purchase_cost/);
  assert.match(route, /s\.sale_price/);
  assert.match(route, /s\.sale_time/);
  assert.match(route, /ORDER BY s\.sale_time DESC, s\.id DESC/);
  assert.match(route, /LIMIT \? OFFSET \?/);
  assert.match(route, /p\.sale_price === null \? null : Number\(p\.sale_price\)/);
  assert.doesNotMatch(route, /purchase_cost: parseFloat\(p\.purchase_cost\) \|\| 0/);
  assert.match(repository, /page_size/);
  assert.match(repository, /register_date_start/);
  assert.match(repository, /register_date_end/);
  assert.match(repository, /total_pages:/);
  assert.doesNotMatch(repository, /SELECT\s+\*/);
  assert.match(page, /stats\.total_customers/);
  assert.match(page, /stats\.active_customers/);
  assert.match(page, /stats\.new_customers/);
  assert.match(page, /stats\.premium_customers/);
  assert.doesNotMatch(page, /stats\.totalCustomers|stats\.activeCustomers|stats\.newCustomers|stats\.premiumCustomers/);
  assert.doesNotMatch(page, /pagination\.limit|pagination\.pageSize|purchase\.sale_date|purchase\.purchase_price/);
  assert.match(page, /purchase\.sale_price == null \? '-'/);
});

test('dashboard warnings retire request and response aliases after read-only verification', () => {
  const contract = contracts['dashboard-warnings'];

  assert.deepEqual(contract.legacy, []);
  for (const field of [
    'limit', 'sale_date', 'salestime', 'purchase_date', 'last_purchase_date',
    'phoneThreshold', 'avgDailySales', 'isBelowAverage', 'noRecent',
    'totalWarnings', 'hasWarnings'
  ]) {
    assert.ok(contract.retired.includes(field), `dashboard-warnings 未退役 ${field}`);
  }
  assert.equal(registry.legacyBoundarySources['dashboard-warnings'], undefined);
  assert.ok(registry.auditSources['dashboard-warnings'].includes('frontend/src/components/InventoryWarnings.vue'));
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.phone_warning_rows, 10);
  assert.equal(contract.verification.model_warning_rows, 10);
  assert.equal(contract.verification.legacy_response_keys, 0);
  assert.equal(contract.verification.legacy_physical_columns, 0);
  assert.equal(contract.verification.write_operations, 0);
});

test('quick-sale retires endpoint aliases after read-only verification', () => {
  const contract = contracts['quick-sale'];

  assert.deepEqual(contract.legacy, []);
  assert.deepEqual(contract.retiredEndpointParameters, [
    'brand', 'model', 'color', 'memory', 'purchase_price',
    'stock_in_date', 'sale_date', 'operator_id', 'customer_idcard'
  ]);
  assert.equal(registry.legacyBoundarySources['quick-sale'], undefined);
  assert.equal(contract.database_verification, 'completed_read_only');
  assert.equal(contract.verification.quick_sale_phones, 77);
  assert.equal(contract.verification.linked_sales, 77);
  assert.equal(contract.verification.missing_relations, 0);
  assert.equal(contract.verification.cost_mismatches, 0);
  assert.equal(contract.verification.price_mismatches, 0);
  assert.equal(contract.verification.write_operations, 0);
});
