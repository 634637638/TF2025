'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { connectToDatabase, getDatabase, closeDatabase } = require('../src/config/database');
const { generateInvoiceNumber } = require('../src/utils/invoice-number');
const UserRepository = require('../src/repositories/user.repository');
const SupplierRepository = require('../src/repositories/supplier.repository');
const AttendanceRepository = require('../src/repositories/attendance.repository');
const supplierPaymentService = require('../src/services/supplier-payment.service');

// 真实数据库测试默认跳过，避免普通 CI 或开发机改动业务库。
// 运行方式：RUN_DB_TESTS=true npm --prefix backend test
const enabled = process.env.RUN_DB_TESTS === 'true';

test('invoice numbers remain unique under concurrent transactions', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  const testDate = '2099-12-31';
  const sequenceDate = '20991231';
  const connections = await Promise.all(
    Array.from({ length: 8 }, () => pool.getConnection())
  );

  try {
    const numbers = await Promise.all(connections.map(async connection => {
      await connection.beginTransaction();
      try {
        const number = await generateInvoiceNumber('retail', connection, testDate);
        await connection.commit();
        return number;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }));

    assert.equal(new Set(numbers).size, numbers.length);
    assert.ok(numbers.every(number => /^20991231\d{4}XS$/.test(number)));
  } finally {
    for (const connection of connections) connection.release();
    await pool.execute(
      'DELETE FROM invoice_sequences WHERE sequence_date = ? AND type_suffix = ?',
      [sequenceDate, 'XS']
    );
    await closeDatabase();
  }
});

test('inventory status writes roll back cleanly', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  const connection = await pool.getConnection();
  try {
    const [[phone]] = await connection.query(
      "SELECT id, status FROM phones WHERE status = 'in_stock' ORDER BY id LIMIT 1"
    );
    if (!phone) {
      return;
    }

    await connection.beginTransaction();
    await connection.execute(
      "UPDATE phones SET status = 'sold' WHERE id = ? AND status = 'in_stock'",
      [phone.id]
    );
    const [[updated]] = await connection.query(
      'SELECT status FROM phones WHERE id = ? FOR UPDATE',
      [phone.id]
    );
    assert.equal(updated.status, 'sold');
    await connection.rollback();

    const [[restored]] = await connection.query(
      'SELECT status FROM phones WHERE id = ?',
      [phone.id]
    );
    assert.equal(restored.status, phone.status);
  } finally {
    connection.release();
    await closeDatabase();
  }
});

test('analytics customer and sales trend queries execute against the live schema', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const [customers] = await pool.query(`
      SELECT c.id, c.name, c.phone, c.created_at,
             COUNT(s.id) AS orders_count,
             COALESCE(SUM(s.sale_price), 0) AS total_amount
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.status = 1
      GROUP BY c.id, c.name, c.phone, c.created_at
      HAVING COALESCE(SUM(s.sale_price), 0) > 0
      ORDER BY total_amount DESC
      LIMIT 20 OFFSET 0
    `);
    assert.ok(Array.isArray(customers));

    const [trends] = await pool.query(`
      SELECT DATE_FORMAT(s.sale_time, '%Y-%m') AS period,
             SUM(CASE WHEN p.is_new = 1 THEN 1 ELSE 0 END) AS new_count,
             SUM(CASE WHEN p.is_new = 0 OR p.is_new IS NULL THEN 1 ELSE 0 END) AS used_count
      FROM sales s
      INNER JOIN phones p ON p.id = s.phone_id
      WHERE s.status = 'completed'
        AND s.sale_time >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY DATE_FORMAT(s.sale_time, '%Y-%m')
      ORDER BY period ASC
    `);
    assert.ok(Array.isArray(trends));
  } finally {
    await closeDatabase();
  }
});

test('user list uses canonical pagination and live role/status filters', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const [[sample]] = await pool.query(`
      SELECT r.name AS role, u.status
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON r.id = ur.role_id
      ORDER BY u.id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于用户角色筛选验证的记录');

    const repository = new UserRepository();
    const result = await repository.getUsers(
      { role: sample.role, status: sample.status },
      { page: 1, page_size: 5, offset: 0 }
    );

    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.page_size, 5);
    assert.ok(Number.isFinite(Number(result.pagination.total)));
    assert.ok(Number.isFinite(result.pagination.total_pages));
    assert.equal(typeof result.pagination.has_next, 'boolean');
    assert.equal(typeof result.pagination.has_prev, 'boolean');
    assert.ok(result.data.length > 0, '角色和状态筛选未返回样本用户');
    for (const user of result.data) {
      assert.equal(Object.hasOwn(user, 'password'), false);
      assert.ok(Object.hasOwn(user, 'role'));
      assert.ok(Object.hasOwn(user, 'store_id'));
    }
  } finally {
    await closeDatabase();
  }
});

test('employee list uses canonical role relations and pagination', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const [column_rows] = await pool.query('SHOW COLUMNS FROM users');
    const live_columns = new Set(column_rows.map(column => column.Field));
    assert.equal(live_columns.has('role'), false, 'users 不应继续存在 role 物理列');
    for (const column of [
      'id', 'username', 'name', 'phone', 'email', 'salary_template_id',
      'status', 'last_login', 'created_at', 'updated_at', 'hire_date'
    ]) {
      assert.equal(live_columns.has(column), true, `users 缺少字段 ${column}`);
    }

    const page = 1;
    const page_size = 5;
    const status = 1;
    const offset = (page - 1) * page_size;
    const [employees] = await pool.query(`
      SELECT u.id, u.username, u.name, u.phone, u.email,
             u.salary_template_id, u.status, u.last_login,
             u.created_at, u.updated_at, u.hire_date,
             GROUP_CONCAT(DISTINCT r.name ORDER BY r.id SEPARATOR ', ') AS role_names,
             GROUP_CONCAT(DISTINCT r.id ORDER BY r.id SEPARATOR ',') AS role_ids
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.status = ?
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ${page_size} OFFSET ${offset}
    `, [status]);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM users WHERE status = ?',
      [status]
    );
    const [[orphan_count]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM user_roles ur
      LEFT JOIN users u ON u.id = ur.user_id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id IS NULL OR r.id IS NULL
    `);

    assert.ok(Array.isArray(employees));
    assert.ok(employees.length <= page_size);
    assert.ok(Number.isFinite(Number(count.total)));
    assert.equal(Number(orphan_count.total), 0, 'user_roles 存在无效用户或角色引用');
    for (const employee of employees) {
      assert.equal(Object.hasOwn(employee, 'password'), false);
      assert.equal(Object.hasOwn(employee, 'role'), false);
      assert.ok(Object.hasOwn(employee, 'role_names'));
      assert.ok(Object.hasOwn(employee, 'role_ids'));
    }
  } finally {
    await closeDatabase();
  }
});

test('store list uses explicit live columns and canonical pagination', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const page = 1;
    const page_size = 5;
    const status = 1;
    const offset = (page - 1) * page_size;
    const [stores] = await pool.query(`
      SELECT s.id, s.name, s.location, s.phone, s.manager_id, s.status,
             s.sort_order, s.created_at, s.updated_at, u.name AS manager_name
      FROM stores s
      LEFT JOIN users u ON u.id = s.manager_id
      WHERE s.status = ?
      ORDER BY s.sort_order ASC, s.id DESC
      LIMIT ${page_size} OFFSET ${offset}
    `, [status]);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM stores WHERE status = ?',
      [status]
    );

    assert.ok(Array.isArray(stores));
    assert.ok(stores.length <= page_size);
    assert.ok(Number.isFinite(Number(count.total)));
    for (const store of stores) {
      assert.equal(Object.hasOwn(store, 'password'), false);
      assert.ok(Object.hasOwn(store, 'manager_id'));
      assert.ok(Object.hasOwn(store, 'sort_order'));
    }
  } finally {
    await closeDatabase();
  }
});

test('reminder list uses explicit live columns and canonical pagination', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const expected_columns = [
      'id', 'type_id', 'title', 'content', 'priority', 'target_mode',
      'target_user_ids', 'repeat_rule', 'start_at', 'remind_before_days',
      'status', 'created_by', 'created_at', 'updated_at'
    ];
    const [column_rows] = await pool.query('SHOW COLUMNS FROM reminders');
    const live_columns = new Set(column_rows.map(column => column.Field));
    for (const column of expected_columns) {
      assert.equal(live_columns.has(column), true, `reminders 缺少字段 ${column}`);
    }

    const page = 1;
    const page_size = 5;
    const offset = (page - 1) * page_size;
    const [reminders] = await pool.query(`
      SELECT r.id, r.type_id, r.title, r.content, r.priority, r.target_mode,
             r.target_user_ids, r.repeat_rule, r.start_at, r.remind_before_days,
             r.status, r.created_by, r.created_at, r.updated_at,
             rt.name AS type_name, rt.color AS type_color,
             creator.name AS creator_name,
             COUNT(CASE WHEN rr.status = 'completed' THEN 1 END) AS completed_count,
             COUNT(CASE WHEN rr.status = 'ignored' THEN 1 END) AS ignored_count,
             MIN(CASE WHEN rr.scheduled_at >= NOW() THEN rr.scheduled_at END) AS next_occurrence_at
      FROM reminders r
      LEFT JOIN reminder_types rt ON rt.id = r.type_id
      LEFT JOIN users creator ON creator.id = r.created_by
      LEFT JOIN reminder_records rr ON rr.reminder_id = r.id
      WHERE r.status != 'archived'
      GROUP BY r.id
      ORDER BY r.status = 'active' DESC, r.created_at DESC
      LIMIT ${page_size} OFFSET ${offset}
    `);
    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS total FROM reminders WHERE status != 'archived'"
    );
    const total = Number(count.total);
    const total_pages = Math.ceil(total / page_size);

    assert.ok(Array.isArray(reminders));
    assert.ok(reminders.length <= page_size);
    assert.ok(Number.isFinite(total));
    assert.ok(Number.isFinite(total_pages));
    for (const reminder of reminders) {
      assert.equal(Object.hasOwn(reminder, 'password'), false);
      assert.ok(Object.hasOwn(reminder, 'type_id'));
      assert.ok(Object.hasOwn(reminder, 'repeat_rule'));
    }
  } finally {
    await closeDatabase();
  }
});

test('brand list uses explicit live columns and canonical pagination', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const expected_columns = [
      'id', 'name', 'status', 'sort_order', 'created_at', 'updated_at'
    ];
    const [column_rows] = await pool.query('SHOW COLUMNS FROM brands');
    const live_columns = new Set(column_rows.map(column => column.Field));
    for (const column of expected_columns) {
      assert.equal(live_columns.has(column), true, `brands 缺少字段 ${column}`);
    }

    const [[sample]] = await pool.query(`
      SELECT id, name, status
      FROM brands
      WHERE name IS NOT NULL AND name <> ''
      ORDER BY id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于品牌筛选验证的记录');

    const page = 1;
    const page_size = 5;
    const offset = (page - 1) * page_size;
    const search_name = String(sample.name);
    const [brands] = await pool.query(`
      SELECT id, name, status, sort_order, created_at, updated_at
      FROM brands
      WHERE status = ? AND name LIKE ?
      ORDER BY sort_order ASC, name ASC, id ASC
      LIMIT ${page_size} OFFSET ${offset}
    `, [sample.status, `%${search_name}%`]);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM brands WHERE status = ? AND name LIKE ?',
      [sample.status, `%${search_name}%`]
    );
    const [suggestions] = await pool.query(`
      SELECT DISTINCT name
      FROM brands
      WHERE name LIKE ?
      ORDER BY name ASC
      LIMIT 5
    `, [`%${search_name}%`]);

    const total = Number(count.total);
    const total_pages = Math.ceil(total / page_size);
    const pagination = {
      page,
      page_size,
      total,
      total_pages,
      has_next: page < total_pages,
      has_prev: page > 1
    };

    assert.ok(brands.length > 0, '品牌名称和状态筛选未返回样本记录');
    assert.ok(brands.length <= page_size);
    assert.ok(suggestions.some(brand => brand.name === sample.name));
    assert.ok(Number.isFinite(pagination.total));
    assert.ok(Number.isFinite(pagination.total_pages));
    assert.equal(typeof pagination.has_next, 'boolean');
    assert.equal(typeof pagination.has_prev, 'boolean');
    for (const brand of brands) {
      assert.deepEqual(Object.keys(brand), expected_columns);
    }
  } finally {
    await closeDatabase();
  }
});

test('model list uses live columns, canonical filters and brand relations', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const expected_columns = [
      'id', 'brand_id', 'name', 'status', 'sort_order', 'created_at', 'updated_at'
    ];
    const [column_rows] = await pool.query('SHOW COLUMNS FROM models');
    const live_columns = column_rows.map(column => column.Field);
    assert.deepEqual(live_columns, expected_columns);
    assert.equal(live_columns.includes('series'), false);
    assert.equal(live_columns.includes('is_active'), false);

    const [[sample]] = await pool.query(`
      SELECT m.id, m.brand_id, m.name, m.status, b.name AS brand_name
      FROM models m
      INNER JOIN brands b ON b.id = m.brand_id
      WHERE m.name IS NOT NULL AND m.name <> ''
      ORDER BY m.id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于型号筛选验证的记录');

    const page = 1;
    const page_size = 5;
    const offset = (page - 1) * page_size;
    const [models] = await pool.query(`
      SELECT m.id, m.brand_id, m.name, m.status, m.sort_order,
             m.created_at, m.updated_at, b.name AS brand_name
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE m.brand_id = ? AND m.status = ?
      ORDER BY m.sort_order ASC, m.name ASC, m.id ASC
      LIMIT ${page_size} OFFSET ${offset}
    `, [sample.brand_id, sample.status]);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM models WHERE brand_id = ? AND status = ?',
      [sample.brand_id, sample.status]
    );
    const [[name_match]] = await pool.query(
      'SELECT id FROM models WHERE brand_id = ? AND status = ? AND name LIKE ? LIMIT 1',
      [sample.brand_id, sample.status, `%${sample.name}%`]
    );
    const [[orphan_count]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE b.id IS NULL
    `);

    const total = Number(count.total);
    const total_pages = Math.ceil(total / page_size);
    const pagination = {
      page,
      page_size,
      total,
      total_pages,
      has_next: page < total_pages,
      has_prev: page > 1
    };

    assert.ok(models.length > 0, '型号品牌和状态筛选未返回样本记录');
    assert.ok(models.length <= page_size);
    assert.ok(name_match, '型号名称筛选未返回样本记录');
    assert.equal(Number(orphan_count.total), 0, 'models 存在无效 brand_id');
    assert.ok(Number.isFinite(pagination.total));
    assert.ok(Number.isFinite(pagination.total_pages));
    assert.equal(typeof pagination.has_next, 'boolean');
    assert.equal(typeof pagination.has_prev, 'boolean');
    for (const model of models) {
      assert.deepEqual(Object.keys(model), [...expected_columns, 'brand_name']);
      assert.equal(typeof model.brand_name, 'string');
    }
  } finally {
    await closeDatabase();
  }
});

test('color list uses live columns, canonical filters and pagination', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const expected_columns = [
      'id', 'name', 'status', 'sort_order', 'created_at', 'updated_at'
    ];
    const [column_rows] = await pool.query('SHOW COLUMNS FROM colors');
    const live_columns = column_rows.map(column => column.Field);
    assert.deepEqual(live_columns, expected_columns);
    for (const unsupported_column of ['brand_id', 'category', 'is_premium', 'is_active', 'hex_code']) {
      assert.equal(live_columns.includes(unsupported_column), false);
    }

    const [[sample]] = await pool.query(`
      SELECT id, name, status
      FROM colors
      WHERE name IS NOT NULL AND name <> ''
      ORDER BY id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于颜色筛选验证的记录');

    const page = 1;
    const page_size = 5;
    const offset = (page - 1) * page_size;
    const [colors] = await pool.query(`
      SELECT id, name, status, sort_order, created_at, updated_at
      FROM colors
      WHERE status = ? AND name LIKE ?
      ORDER BY sort_order ASC, name ASC, id ASC
      LIMIT ${page_size} OFFSET ${offset}
    `, [sample.status, `%${sample.name}%`]);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM colors WHERE status = ? AND name LIKE ?',
      [sample.status, `%${sample.name}%`]
    );
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status <> 1 OR status IS NULL THEN 1 ELSE 0 END) AS inactive
      FROM colors
    `);

    const total = Number(count.total);
    const total_pages = Math.ceil(total / page_size);
    const pagination = {
      page,
      page_size,
      total,
      total_pages,
      has_next: page < total_pages,
      has_prev: page > 1
    };

    assert.ok(colors.length > 0, '颜色名称和状态筛选未返回样本记录');
    assert.ok(colors.length <= page_size);
    assert.equal(Number(stats.total), Number(stats.active) + Number(stats.inactive));
    assert.ok(Number.isFinite(pagination.total));
    assert.ok(Number.isFinite(pagination.total_pages));
    assert.equal(typeof pagination.has_next, 'boolean');
    assert.equal(typeof pagination.has_prev, 'boolean');
    for (const color of colors) {
      assert.deepEqual(Object.keys(color), expected_columns);
    }
  } finally {
    await closeDatabase();
  }
});

test('memory list uses live columns, canonical filters and size formats', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const expected_columns = [
      'id', 'size', 'status', 'sort_order', 'created_at', 'updated_at'
    ];
    const [column_rows] = await pool.query('SHOW COLUMNS FROM memories');
    const live_columns = column_rows.map(column => column.Field);
    assert.deepEqual(live_columns, expected_columns);
    assert.equal(live_columns.includes('is_active'), false);
    assert.equal(live_columns.includes('storage_unit'), false);

    const [[sample]] = await pool.query(`
      SELECT id, size, status
      FROM memories
      WHERE size IS NOT NULL AND size <> ''
      ORDER BY id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于内存筛选验证的记录');

    const page = 1;
    const page_size = 5;
    const offset = (page - 1) * page_size;
    const [memories] = await pool.query(`
      SELECT id, size, status, sort_order, created_at, updated_at
      FROM memories
      WHERE status = ? AND size LIKE ?
      ORDER BY sort_order ASC, size ASC, id ASC
      LIMIT ${page_size} OFFSET ${offset}
    `, [sample.status, `%${sample.size}%`]);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM memories WHERE status = ? AND size LIKE ?',
      [sample.status, `%${sample.size}%`]
    );
    const [all_sizes] = await pool.query('SELECT id, size FROM memories ORDER BY id');

    const total = Number(count.total);
    const total_pages = Math.ceil(total / page_size);
    const pagination = {
      page,
      page_size,
      total,
      total_pages,
      has_next: page < total_pages,
      has_prev: page > 1
    };

    assert.ok(memories.length > 0, '内存规格和状态筛选未返回样本记录');
    assert.ok(memories.length <= page_size);
    assert.ok(
      all_sizes.every(memory => /^\d+(?:\+\d+)?[A-Za-z]+$/.test(String(memory.size || ''))),
      'memories 存在无法规范解析的 size'
    );
    assert.ok(Number.isFinite(pagination.total));
    assert.ok(Number.isFinite(pagination.total_pages));
    assert.equal(typeof pagination.has_next, 'boolean');
    assert.equal(typeof pagination.has_prev, 'boolean');
    for (const memory of memories) {
      assert.deepEqual(Object.keys(memory), expected_columns);
    }
  } finally {
    await closeDatabase();
  }
});

test('supplier list uses live columns, canonical pagination and real aggregates', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const expected_columns = [
      'id', 'name', 'contact', 'phone', 'address', 'bank_info', 'tax_number',
      'status', 'remarks', 'created_at', 'updated_at', 'sort_order'
    ];
    const [column_rows] = await pool.query('SHOW COLUMNS FROM suppliers');
    const live_columns = column_rows.map(column => column.Field);
    assert.deepEqual(live_columns, expected_columns);

    const [[account_table]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'supplier_accounts'
    `);
    assert.equal(Number(account_table.total), 0, '不存在的 supplier_accounts 不应作为响应数据源');

    const [[sample]] = await pool.query(`
      SELECT id, name, status
      FROM suppliers
      WHERE name IS NOT NULL AND name <> ''
      ORDER BY id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于供应商筛选验证的记录');

    const page = 1;
    const page_size = 5;
    const offset = (page - 1) * page_size;
    const [suppliers] = await pool.query(`
      SELECT id, name, contact, phone, address, bank_info, tax_number,
             status, remarks, created_at, updated_at, sort_order
      FROM suppliers
      WHERE status = ? AND name LIKE ?
      ORDER BY sort_order ASC, name ASC, id ASC
      LIMIT ${page_size} OFFSET ${offset}
    `, [sample.status, `%${sample.name}%`]);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS total FROM suppliers WHERE status = ? AND name LIKE ?',
      [sample.status, `%${sample.name}%`]
    );
    const [[accessory_stats]] = await pool.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(purchase_cost), 0) AS total_cost
      FROM accessories
      WHERE supplier_id = ?
    `, [sample.id]);
    const [[phone_stats]] = await pool.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(purchase_cost), 0) AS total_cost
      FROM phones
      WHERE supplier_id = ?
    `, [sample.id]);

    const total = Number(count.total);
    const total_pages = Math.ceil(total / page_size);
    const pagination = {
      page,
      page_size,
      total,
      total_pages,
      has_next: page < total_pages,
      has_prev: page > 1
    };
    const repository = new SupplierRepository();
    const repository_result = await repository.getSuppliersWithPagination({
      page,
      page_size,
      name: sample.name,
      status: sample.status
    }, {
      sort_by: 'sort_order',
      sort_order: 'asc'
    });
    const repository_detail = await repository.getSupplierById(sample.id);

    assert.ok(suppliers.length > 0, '供应商名称和状态筛选未返回样本记录');
    assert.ok(suppliers.length <= page_size);
    assert.ok(Number.isFinite(Number(accessory_stats.count)));
    assert.ok(Number.isFinite(Number(accessory_stats.total_cost)));
    assert.ok(Number.isFinite(Number(phone_stats.count)));
    assert.ok(Number.isFinite(Number(phone_stats.total_cost)));
    assert.equal(typeof pagination.has_next, 'boolean');
    assert.equal(typeof pagination.has_prev, 'boolean');
    assert.equal(repository_result.pagination.page_size, page_size);
    assert.equal(typeof repository_result.pagination.has_next, 'boolean');
    assert.ok(repository_result.suppliers.length > 0);
    assert.ok(repository_detail);
    assert.equal(Object.hasOwn(repository_detail, 'accounts'), false);
    assert.ok(Number.isFinite(repository_detail.stats.accessories_total_cost));
    assert.ok(Number.isFinite(repository_detail.stats.phones_total_cost));
    for (const supplier of suppliers) {
      assert.deepEqual(Object.keys(supplier), expected_columns);
    }
  } finally {
    await closeDatabase();
  }
});

test('supplier payment list uses live phone fields and canonical filters', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const [phone_columns] = await pool.query('SHOW COLUMNS FROM phones');
    const live_columns = new Set(phone_columns.map(column => column.Field));
    for (const column of [
      'supplier_id', 'store_id', 'sale_id', 'purchase_cost', 'sale_price',
      'inventory_time', 'sale_time', 'payment_status', 'payment_time',
      'payment_method', 'payment_operator_id'
    ]) {
      assert.equal(live_columns.has(column), true, `phones 缺少字段 ${column}`);
    }
    assert.equal(live_columns.has('purchase_date'), false);

    const [[sample]] = await pool.query(`
      SELECT id, supplier_id, payment_status, status
      FROM phones
      WHERE supplier_id IS NOT NULL AND status <> 'supplier_proxy'
      ORDER BY id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于供应商付款验证的手机');

    const result = await supplierPaymentService.getPhones({
      supplier_id: sample.supplier_id,
      payment_status: 'all',
      sale_status: 'all',
      page: 1,
      page_size: 5
    });
    assert.ok(Array.isArray(result.phones));
    assert.ok(result.phones.length > 0);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.page_size, 5);
    assert.equal(typeof result.pagination.has_next, 'boolean');
    assert.equal(typeof result.pagination.has_prev, 'boolean');
    for (const phone of result.phones) {
      assert.equal(Object.hasOwn(phone, 'purchase_date'), false);
      assert.ok(Object.hasOwn(phone, 'inventory_time'));
      assert.ok(Object.hasOwn(phone, 'purchase_cost'));
      assert.ok(['paid', 'unpaid'].includes(phone.payment_status));
    }

    const paidResult = await supplierPaymentService.getPhones({
      supplier_id: sample.supplier_id,
      payment_status: 'paid',
      sale_status: 'all',
      page: 1,
      page_size: 5
    });
    assert.ok(paidResult.phones.every(phone => phone.payment_status === 'paid'));
    const unpaidResult = await supplierPaymentService.getPhones({
      supplier_id: sample.supplier_id,
      payment_status: 'unpaid',
      sale_status: 'all',
      page: 1,
      page_size: 5
    });
    assert.ok(unpaidResult.phones.every(phone => phone.payment_status === 'unpaid'));
  } finally {
    await closeDatabase();
  }
});

test('attendance list uses live fields and canonical scoped filters', { skip: !enabled }, async () => {
  const connected = await connectToDatabase(1, 0);
  assert.equal(connected, true, '数据库连接失败');

  const pool = getDatabase();
  try {
    const [column_rows] = await pool.query('SHOW COLUMNS FROM attendance_records');
    const live_columns = new Set(column_rows.map(column => column.Field));
    for (const column of [
      'id', 'employee_id', 'record_date', 'record_type', 'leave_type',
      'leave_days', 'leave_reason', 'overtime_hours', 'overtime_reason',
      'monthly_leave_days', 'status', 'approval_note', 'approved_by',
      'approved_at', 'created_by', 'created_at', 'updated_at'
    ]) {
      assert.equal(live_columns.has(column), true, `attendance_records 缺少字段 ${column}`);
    }
    assert.equal(live_columns.has('absent_days'), false);
    assert.equal(live_columns.has('absent_reason'), false);

    const [[sample]] = await pool.query(`
      SELECT employee_id,
             DATE_FORMAT(record_date, '%Y-%m-%d') AS record_date,
             record_type,
             status
      FROM attendance_records
      ORDER BY id
      LIMIT 1
    `);
    assert.ok(sample, '真实数据库中没有可用于考勤筛选验证的记录');

    const repository = new AttendanceRepository();
    const result = await repository.getAttendanceRecordsWithPagination({
      employee_id: sample.employee_id,
      record_type: sample.record_type,
      status: sample.status,
      start_date: sample.record_date,
      end_date: sample.record_date
    }, {
      page: 1,
      page_size: 5
    });

    assert.ok(result.records.length > 0, '员工、类型、状态和日期筛选未返回样本考勤');
    assert.ok(result.records.length <= 5);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.page_size, 5);
    assert.ok(Number.isFinite(Number(result.pagination.total)));
    assert.ok(Number.isFinite(result.pagination.total_pages));
    assert.equal(typeof result.pagination.has_next, 'boolean');
    assert.equal(typeof result.pagination.has_prev, 'boolean');
    for (const record of result.records) {
      assert.equal(Number(record.employee_id), Number(sample.employee_id));
      assert.equal(record.record_type, sample.record_type);
      assert.equal(record.status, sample.status);
      assert.equal(record.record_date, sample.record_date);
      assert.equal(Object.hasOwn(record, 'absent_days'), false);
      assert.equal(Object.hasOwn(record, 'absent_reason'), false);
    }
  } finally {
    await closeDatabase();
  }
});
