const assert = require('node:assert/strict')
const { randomBytes, randomInt } = require('node:crypto')
const { withRollbackConnection } = require('./rollback-connection')

const FIXTURE_TABLES = [
  'brands', 'models', 'colors', 'memories', 'suppliers', 'stores',
  'users', 'roles', 'user_roles', 'phones', 'attendance_records', 'invoice_sequences'
]

/** 使用已迁移的隔离库；测试不代替迁移，不容许非事务表破坏清理语义。 */
async function assertFixtureSchema(pool) {
  const [tables] = await pool.query(
    `SELECT TABLE_NAME AS table_name, ENGINE AS engine FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name IN (${FIXTURE_TABLES.map(() => '?').join(', ')})`,
    FIXTURE_TABLES
  )
  for (const name of FIXTURE_TABLES) {
    const table = tables.find(item => item.table_name === name)
    assert.ok(table, `隔离测试库缺少 ${name}，请先应用当前数据库结构`)
    assert.equal(table.engine, 'InnoDB', `${name} 必须使用 InnoDB 才能执行回滚测试`)
  }
  // 服务的建表/补列逻辑应在部署迁移中完成，不能在测试事务中触发隐式提交。
  const [columns] = await pool.query('SHOW COLUMNS FROM phones')
  for (const name of ['payment_remarks', 'payment_batch_id']) {
    assert.ok(columns.some(column => column.Field === name), `隔离测试库 phones 缺少 ${name}，请先完成迁移`)
  }
}

async function createDatabaseFixtures(pool, fixture) {
  fixture.tag = `qa_${randomBytes(6).toString('hex')}`
  await withRollbackConnection(pool, async connection => {
    const insert = async (sql, values) => {
      const [result] = await connection.execute(sql, values)
      return result.insertId
    }
    fixture.brandId = await insert('INSERT INTO brands (name, status, sort_order) VALUES (?, 1, 0)', [fixture.tag])
    fixture.modelId = await insert('INSERT INTO models (brand_id, name, status, sort_order) VALUES (?, ?, 1, 0)', [fixture.brandId, fixture.tag])
    fixture.colorId = await insert('INSERT INTO colors (name, status, sort_order) VALUES (?, 1, 0)', [fixture.tag])
    fixture.memoryId = await insert('INSERT INTO memories (size, status, sort_order) VALUES (?, 1, 0)', [`${randomInt(10000, 100000)}GB`])
    fixture.supplierId = await insert('INSERT INTO suppliers (name, status, sort_order) VALUES (?, 1, 0)', [fixture.tag])
    fixture.storeId = await insert('INSERT INTO stores (name, status, sort_order) VALUES (?, 1, 0)', [fixture.tag])
    // 禁用登录的合成密码，不复制业务账户或客户隐私数据。
    fixture.userId = await insert(
      'INSERT INTO users (username, name, password, store_id, status) VALUES (?, ?, ?, ?, 1)',
      [fixture.tag, fixture.tag, '!disabled-database-fixture', fixture.storeId]
    )
    fixture.roleId = await insert('INSERT INTO roles (name, code, description) VALUES (?, ?, ?)', [fixture.tag, fixture.tag, '隔离回归测试合成角色'])
    await connection.execute('INSERT INTO user_roles (user_id, role_id, assigned_at, created_at) VALUES (?, ?, NOW(), NOW())', [fixture.userId, fixture.roleId])
    fixture.phoneId = await insert(
      `INSERT INTO phones (
         brand_id, model_id, color_id, memory_id, supplier_id, store_id, inventory_operator_id,
         imei, serial_number, status, purchase_cost, is_new, payment_status, inventory_time
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_stock', 100, 1, 'unpaid', NOW())`,
      [fixture.brandId, fixture.modelId, fixture.colorId, fixture.memoryId, fixture.supplierId,
        fixture.storeId, fixture.userId, `9${randomInt(1000000, 10000000)}${randomInt(1000000, 10000000)}`, fixture.tag]
    )
    fixture.attendanceId = await insert(
      `INSERT INTO attendance_records (
         employee_id, record_date, record_type, monthly_leave_days, status, created_by
       ) VALUES (?, '2099-12-30', 'monthly_leave', 1, 'approved', ?)`,
      [fixture.userId, fixture.userId]
    )
    const [[count]] = await connection.query("SELECT COUNT(*) AS total FROM sales WHERE invoice_number LIKE '20991231%XS'")
    assert.equal(Number(count.total), 0, '单号回归保留日期已有销售数据，请使用干净的隔离测试库')
    const [sequence] = await connection.execute(
      "INSERT IGNORE INTO invoice_sequences (sequence_date, type_suffix, current_sequence) VALUES ('20991231', 'XS', 0)"
    )
    fixture.createdSequence = sequence.affectedRows === 1
    // 列表仓储使用连接池的其他连接，提交合成样本后才能验证实际查询。
    await connection.commit()
  })
}

async function deleteDatabaseFixtures(pool, fixture) {
  await withRollbackConnection(pool, async connection => {
    // 按外键依赖逆序删除，只删除本轮记录的主键，不清表、不重置 AUTO_INCREMENT。
    const deletions = [
      ['DELETE FROM attendance_records WHERE id = ?', fixture.attendanceId],
      ['DELETE FROM phones WHERE id = ?', fixture.phoneId],
      ['DELETE FROM user_roles WHERE user_id = ?', fixture.userId],
      ['DELETE FROM users WHERE id = ?', fixture.userId],
      ['DELETE FROM roles WHERE id = ?', fixture.roleId],
      ['DELETE FROM stores WHERE id = ?', fixture.storeId],
      ['DELETE FROM suppliers WHERE id = ?', fixture.supplierId],
      ['DELETE FROM memories WHERE id = ?', fixture.memoryId],
      ['DELETE FROM colors WHERE id = ?', fixture.colorId],
      ['DELETE FROM models WHERE id = ?', fixture.modelId],
      ['DELETE FROM brands WHERE id = ?', fixture.brandId]
    ]
    for (const [sql, id] of deletions) {
      if (id !== undefined) await connection.execute(sql, [id])
    }
    if (fixture.createdSequence) {
      await connection.execute("DELETE FROM invoice_sequences WHERE sequence_date = '20991231' AND type_suffix = 'XS'")
    }
    await connection.commit()
  })
}

/** 已备份且明确授权的业务库模式只选择既有样本，不提交合成用户、门店或考勤。 */
async function loadLiveDatabaseSamples(pool, fixture) {
  const [triggers] = await pool.query(
    `SELECT TRIGGER_NAME FROM information_schema.triggers
     WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE IN ('phones', 'invoice_sequences')`
  )
  assert.equal(triggers.length, 0, '业务库写入表存在触发器，需先核对副作用，停止本次测试')
  const queries = [
    ['userId', 'SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id ORDER BY u.id LIMIT 1'],
    ['brandId', "SELECT id FROM brands WHERE name IS NOT NULL AND name <> '' ORDER BY id LIMIT 1"],
    ['modelId', "SELECT m.id FROM models m JOIN brands b ON b.id = m.brand_id WHERE m.name IS NOT NULL AND m.name <> '' ORDER BY m.id LIMIT 1"],
    ['colorId', "SELECT id FROM colors WHERE name IS NOT NULL AND name <> '' ORDER BY id LIMIT 1"],
    ['memoryId', "SELECT id FROM memories WHERE size IS NOT NULL AND size <> '' ORDER BY id LIMIT 1"],
    ['supplierId', "SELECT id FROM suppliers WHERE name IS NOT NULL AND name <> '' ORDER BY id LIMIT 1"],
    ['phoneId', "SELECT p.id FROM phones p JOIN suppliers s ON s.id = p.supplier_id WHERE p.status <> 'supplier_proxy' ORDER BY p.id LIMIT 1"],
    ['attendanceId', 'SELECT id FROM attendance_records ORDER BY id LIMIT 1']
  ]
  for (const [key, sql] of queries) {
    const [[sample]] = await pool.query(sql)
    assert.ok(sample, `业务库缺少 ${key} 查询样本，不能空跑通过`)
    fixture[key] = sample.id
  }
  const [[sales]] = await pool.query("SELECT COUNT(*) AS total FROM sales WHERE invoice_number LIKE '20991231%XS'")
  assert.equal(Number(sales.total), 0, '业务库的单号测试日期已有销售数据，停止测试')
  const [sequences] = await pool.query("SELECT current_sequence FROM invoice_sequences WHERE sequence_date = '20991231' AND type_suffix = 'XS'")
  assert.equal(sequences.length, 1, '业务库缺少既有测试日期序列行；本模式不自动补建')
  fixture.sequenceBefore = Number(sequences[0].current_sequence)
  fixture.inventoryTag = `qa_live_${randomBytes(8).toString('hex')}`
}

async function prepareLiveTransaction(connection) {
  // 只作用于测试连接，减少空日期范围锁对在线销售插入的影响，不改服务器或业务连接配置。
  await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED')
  // 沿用服务器锁等待预算；云端 8 个事务各生成 20 号时，过短的测试覆盖会误报超时。
}

async function exerciseLiveInventoryRollback(pool, fixture) {
  await withRollbackConnection(pool, async connection => {
    const [inserted] = await connection.execute(
      "INSERT INTO phones (imei, serial_number, status, purchase_cost, is_new) VALUES (?, ?, 'in_stock', 100, 1)",
      [fixture.inventoryTag, fixture.inventoryTag]
    )
    fixture.transientPhoneId = inserted.insertId
    const [[before]] = await connection.query('SELECT status FROM phones WHERE id = ?', [fixture.transientPhoneId])
    assert.equal(before.status, 'in_stock')
    const [updated] = await connection.execute("UPDATE phones SET status = 'sold' WHERE id = ? AND status = 'in_stock'", [fixture.transientPhoneId])
    assert.equal(updated.affectedRows, 1)
    const [[after]] = await connection.query('SELECT status FROM phones WHERE id = ?', [fixture.transientPhoneId])
    assert.equal(after.status, 'sold')
    // 不提交；公共资源管理器在正常、断言失败和异常路径都执行回滚。
  }, prepareLiveTransaction)
  const [[remaining]] = await pool.query('SELECT COUNT(*) AS total FROM phones WHERE imei = ? OR serial_number = ?', [fixture.inventoryTag, fixture.inventoryTag])
  assert.equal(Number(remaining.total), 0, '库存事务回滚后仍存在本轮临时设备')
}

async function verifyLiveDatabaseCleanup(pool, fixture) {
  const [[remaining]] = await pool.query('SELECT COUNT(*) AS total FROM phones WHERE imei = ? OR serial_number = ?', [fixture.inventoryTag, fixture.inventoryTag])
  assert.equal(Number(remaining.total), 0, '业务库存在本轮临时设备残留')
  const [sequences] = await pool.query("SELECT current_sequence FROM invoice_sequences WHERE sequence_date = '20991231' AND type_suffix = 'XS'")
  assert.equal(sequences.length, 1)
  assert.equal(Number(sequences[0].current_sequence), fixture.sequenceBefore, '单号事务未恢复原序列值')
  const [[sales]] = await pool.query("SELECT COUNT(*) AS total FROM sales WHERE invoice_number LIKE '20991231%XS'")
  assert.equal(Number(sales.total), 0, '单号测试日期出现销售记录')
  return { temporaryPhones: 0, sequenceUnchanged: true, testDateSales: 0 }
}

module.exports = {
  assertFixtureSchema, createDatabaseFixtures, deleteDatabaseFixtures,
  loadLiveDatabaseSamples, prepareLiveTransaction, exerciseLiveInventoryRollback, verifyLiveDatabaseCleanup
}
