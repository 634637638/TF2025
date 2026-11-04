'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { runInNewContext } = require('node:vm')
const {
  prepareInvoiceNumberTransaction,
  generateInvoiceNumber,
  generateInvoiceNumberForDate
} = require('../src/utils/invoice-number')
const { formatBeijingDate } = require('../src/utils/time')

const number = (sequence, date = '20261102', suffix = 'XS') =>
  `${date}${String(sequence).padStart(4, '0')}${suffix}`

// 模拟数据库的事务、日期/类型行锁和当前读；绝不连接或写入云端业务库。
function createDatabase(initial = [], highWater = 0) {
  const committed = new Set(initial)
  const lockTails = new Map()
  const sequences = new Map()
  function connect() {
    let active = false
    let added = new Set()
    let removed = new Set()
    const releases = new Map()
    const sequenceWrites = new Map()
    const view = () => new Set([...committed, ...added].filter(value => !removed.has(value)))
    const finish = () => {
      active = false
      for (const release of releases.values()) release()
      releases.clear()
    }
    return {
      async beginTransaction() {
        assert.equal(active, false)
        active = true
        added = new Set()
        removed = new Set()
        sequenceWrites.clear()
      },
      async execute(sql, params = []) {
        if (/CREATE TABLE/.test(sql)) {
          assert.equal(active, false, 'DDL 必须在事务前完成')
          return [{}]
        }
        assert.equal(active, true, '号码必须在业务事务内分配')
        if (/INSERT (?:IGNORE )?INTO invoice_sequences/.test(sql)) {
          const key = params.join(':')
          if (!releases.has(key)) {
            const previous = lockTails.get(key) || Promise.resolve()
            let release
            lockTails.set(key, new Promise(resolve => { release = resolve }))
            await previous
            releases.set(key, release)
          }
          sequenceWrites.set(key, sequences.get(key) || highWater)
          return [{ affectedRows: 1 }]
        }
        if (/SELECT current_sequence[\s\S]+FROM invoice_sequences[\s\S]+FOR UPDATE/.test(sql)) {
          assert.ok(releases.has(params.join(':')))
          return [[{ current_sequence: sequenceWrites.get(params.join(':')) || highWater }]]
        }
        if (/SELECT invoice_number FROM sales/.test(sql)) {
          assert.match(sql, /FOR UPDATE/, '必须读取最新提交记录，不能使用旧快照')
          const [date, suffix] = params[0].split('%')
          assert.ok(releases.has(`${date}:${suffix}`), '先锁定日期/类型再读取占用号码')
          return [[...view()].filter(value => value.startsWith(date) && value.endsWith(suffix))
            .map(invoice_number => ({ invoice_number }))]
        }
        if (/UPDATE invoice_sequences/.test(sql)) {
          const [sequence, date, suffix] = params
          const key = `${date}:${suffix}`
          assert.ok(releases.has(key))
          sequenceWrites.set(key, Math.max(sequenceWrites.get(key), sequence))
          return [{ affectedRows: 1 }]
        }
        throw new Error(`测试不允许未知 SQL: ${sql}`)
      },
      insertSale(invoice) {
        assert.equal(active, true)
        assert.equal(view().has(invoice), false, '不能插入重复单号')
        removed.delete(invoice)
        added.add(invoice)
      },
      moveSale(from, to) {
        assert.ok(view().has(from))
        removed.add(from)
        added.delete(from)
        this.insertSale(to)
      },
      savepoint() {
        const savedAdded = new Set(added)
        const savedRemoved = new Set(removed)
        return () => { added = savedAdded; removed = savedRemoved }
      },
      async commit() {
        for (const value of removed) committed.delete(value)
        for (const value of added) committed.add(value)
        for (const [key, value] of sequenceWrites) sequences.set(key, value)
        finish()
      },
      async rollback() { finish() }
    }
  }
  return { committed, sequences, connect }
}

async function begin(database) {
  const connection = database.connect()
  await prepareInvoiceNumberTransaction(connection)
  await connection.beginTransaction()
  return connection
}

async function sell(database, date = '2026-11-02', type = 'retail') {
  const connection = await begin(database)
  try {
    const invoice = await generateInvoiceNumber(type, connection, date)
    connection.insertSale(invoice)
    await connection.commit()
    return invoice
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

test('new sales fill the smallest vacant number without renumbering existing invoices', async () => {
  const existing = [1, 2, 4, 6, 7, 8, 9, 10].map(value => number(value))
  const database = createDatabase(existing, 100)
  assert.equal(await sell(database), number(3))
  assert.equal(await sell(database), number(5))
  assert.equal(await sell(database), number(11))
  for (const invoice of existing) assert.ok(database.committed.has(invoice))
  assert.equal(database.sequences.get('20261102:XS'), 100, '高水位不阻止补空号')
})

test('moving a sale to another date frees its old number for the next new sale', async () => {
  const database = createDatabase([1, 2, 3].map(value => number(value)))
  const edit = await begin(database)
  const moved = await generateInvoiceNumber('retail', edit, '2026-11-01')
  edit.moveSale(number(2), moved)
  await edit.commit()
  assert.equal(moved, number(1, '20261101'))
  assert.equal(await sell(database), number(2))
  assert.ok(database.committed.has(number(3)), '其他销售单据不能被重排')
})

test('a vacated last number is reused even when the sequence high water is larger', async () => {
  const database = createDatabase([number(1), number(2)], 10)
  assert.equal(await sell(database), number(3))
})

test('historical invoices seed the audit high water without preventing gap filling', async () => {
  const database = createDatabase([number(10)])
  assert.equal(await sell(database), number(1))
  assert.equal(database.sequences.get('20261102:XS'), 10)
})

test('dates and invoice suffixes are isolated; wholesale and peer transfer share PF', async () => {
  const database = createDatabase([number(1)])
  assert.equal(await sell(database, '2026-11-01'), number(1, '20261101'))
  assert.equal(await sell(database, '2026-11-02', 'wholesale'), number(1, '20261102', 'PF'))
  assert.equal(await sell(database, '2026-11-02', 'peer_transfer'), number(2, '20261102', 'PF'))
  assert.equal(await sell(database, '2026-11-02', 'supplier_proxy'), number(1, '20261102', 'HB'))
  assert.equal(await sell(database, '2026-11-02', 'batch_item'), number(2))
})

test('batch allocation reserves numbers before sale rows are inserted', async () => {
  const database = createDatabase([number(1), number(3)])
  const connection = await begin(database)
  const invoices = []
  for (let index = 0; index < 20; index += 1) {
    invoices.push(await generateInvoiceNumber('retail', connection, '2026-11-02'))
  }
  assert.equal(new Set(invoices).size, 20)
  assert.equal(invoices[0], number(2))
  assert.equal(invoices[1], number(4))
  for (const invoice of invoices) connection.insertSale(invoice)
  await connection.commit()
  assert.equal(database.committed.size, 22)
})

test('concurrent committed sales do not receive duplicate gap numbers', async () => {
  const database = createDatabase([number(1), number(3), number(10)])
  const invoices = await Promise.all(Array.from({ length: 8 }, () => sell(database)))
  assert.equal(new Set(invoices).size, 8)
  assert.deepEqual(new Set(invoices), new Set([2, 4, 5, 6, 7, 8, 9, 11].map(value => number(value))))
  assert.equal(database.committed.size, 11)
})

test('parallel allocations on the same connection reserve distinct numbers', async () => {
  const connection = await begin(createDatabase([number(1), number(3)]))
  const invoices = await Promise.all(Array.from({ length: 8 }, () =>
    generateInvoiceNumber('retail', connection, '2026-11-02')))
  assert.equal(new Set(invoices).size, 8)
  assert.deepEqual(invoices, [2, 4, 5, 6, 7, 8, 9, 10].map(value => number(value)))
  await connection.rollback()
})

test('a waiting allocator sees the previous transaction commit, rather than an old snapshot', async () => {
  const database = createDatabase([number(1), number(3)])
  const first = await begin(database)
  const second = await begin(database)
  assert.equal(await generateInvoiceNumber('retail', first, '2026-11-02'), number(2))
  let settled = false
  const waiting = generateInvoiceNumber('retail', second, '2026-11-02').then(invoice => {
    settled = true
    return invoice
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false, '第二个事务应等待同一天同类型的锁')
  first.insertSale(number(2))
  await first.commit()
  assert.equal(await waiting, number(4))
  await second.rollback()
})

test('rollback releases the gap for another transaction', async () => {
  const database = createDatabase([number(1), number(3)])
  const connection = await begin(database)
  assert.equal(await generateInvoiceNumber('retail', connection, '2026-11-02'), number(2))
  connection.insertSale(number(2))
  await connection.rollback()
  assert.equal(await sell(database), number(2))
})

test('reused connections clear reservations from the previous transaction', async () => {
  const database = createDatabase()
  const connection = await begin(database)
  assert.equal(await generateInvoiceNumber('retail', connection, '2026-11-02'), number(1))
  await connection.rollback()
  await prepareInvoiceNumberTransaction(connection)
  await connection.beginTransaction()
  assert.equal(await generateInvoiceNumber('retail', connection, '2026-11-02'), number(1))
  await connection.rollback()
})

test('a failed batch item stays reserved until the batch ends and is reusable by the next operation', async () => {
  const database = createDatabase()
  const connection = await begin(database)
  const rollbackToSavepoint = connection.savepoint()
  const failed = await generateInvoiceNumber('retail', connection, '2026-11-02')
  connection.insertSale(failed)
  rollbackToSavepoint()
  const succeeded = await generateInvoiceNumber('retail', connection, '2026-11-02')
  assert.equal(succeeded, number(2))
  connection.insertSale(succeeded)
  await connection.commit()
  assert.equal(await sell(database), number(1))
})

test('a waiting allocator can reuse an allocation that is rolled back', async () => {
  const database = createDatabase()
  const first = await begin(database)
  const second = await begin(database)
  assert.equal(await generateInvoiceNumber('retail', first, '2026-11-02'), number(1))
  const waiting = generateInvoiceNumber('retail', second, '2026-11-02')
  await first.rollback()
  assert.equal(await waiting, number(1))
  await second.rollback()
})

test('four digit exhaustion fails without returning an invalid five digit invoice', async () => {
  const database = createDatabase(Array.from({ length: 9999 }, (_, index) => number(index + 1)))
  const connection = await begin(database)
  await assert.rejects(generateInvoiceNumber('retail', connection, '2026-11-02'), /四位单据号已用完/)
  await connection.rollback()
})

test('generation requires explicit transaction preparation and a connection', async () => {
  await assert.rejects(generateInvoiceNumber('retail', null, '2026-11-02'), /需要数据库连接/)
  await assert.rejects(generateInvoiceNumber('retail', {}, '2026-11-02'), /prepareInvoiceNumberTransaction/)
})

for (const date of ['invalid', '2026-02-30', '2026-13-01']) {
  test(`invalid sale date ${date} is rejected`, async () => {
    const connection = await begin(createDatabase())
    await assert.rejects(generateInvoiceNumber('retail', connection, date), /销售日期无效/)
    await connection.rollback()
  })
}

test('business dates and zoned instants use the common Beijing date tools', () => {
  assert.equal(generateInvoiceNumberForDate('2026-11-02', 1), number(1))
  assert.equal(generateInvoiceNumberForDate('2026-11-02 00:00:00', 1), number(1))
  assert.equal(generateInvoiceNumberForDate('2026-11-01T18:00:00Z', 1), number(1))
  assert.equal(generateInvoiceNumberForDate(new Date('2026-11-01T18:00:00Z'), 1), number(1))
  assert.equal(formatBeijingDate(new Date('2026-11-01T15:59:59Z')), '2026-11-01')
  assert.equal(formatBeijingDate(new Date('2026-11-01T16:00:00Z')), '2026-11-02')
  assert.equal(formatBeijingDate('invalid'), '')
})

test('all shared-generator callers prepare the same transaction before allocating', () => {
  const root = path.resolve(__dirname, '..')
  for (const file of [
    'src/routes/sales.js', 'src/routes/phones.js', 'src/routes/inventory.js',
    'src/routes/rentals.js', 'src/services/transfer.service.js',
    'src/services/sale.service.js', 'src/services/data-import.service.js',
    'scripts/backfill-sale-invoice-numbers.js'
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /await prepareInvoiceNumberTransaction\((\w+)\)\s+await \1\.beginTransaction\(\)/, file)
    assert.match(source, /generateInvoiceNumber\(/, file)
  }
})

test('data import writes every imported sale through the shared invoice generator', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/services/data-import.service.js'), 'utf8')
  assert.match(source, /await prepareInvoiceNumberTransaction\(connection\)\s+await connection\.beginTransaction\(\)/)
  assert.match(source, /async syncImportedSale[\s\S]*?generateInvoiceNumber\('retail', connection, saleTime\)/)
  assert.match(source, /INSERT INTO sales[\s\S]{0,260}invoice_number/)
  assert.doesNotMatch(source, /INSERT INTO sales \(phone_id, customer_id, sale_time, operator_id/)
})

test('wholesale requests cannot bypass the shared generator with a manual invoice number', () => {
  const root = path.resolve(__dirname, '../..')
  const form = fs.readFileSync(path.join(root, 'frontend/src/components/wholesale/WholesalePartySection.vue'), 'utf8')
  const helpers = fs.readFileSync(path.join(root, 'frontend/src/components/wholesale/helpers.ts'), 'utf8')
  const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/transfer.controller.js'), 'utf8')
  const service = fs.readFileSync(path.join(__dirname, '../src/services/transfer.service.js'), 'utf8')
  assert.doesNotMatch(form, /prop="invoice_number"/)
  assert.doesNotMatch(helpers, /payload\.invoice_number/)
  assert.doesNotMatch(controller, /invoice_number,\s*\/\/ 发票号/)
  assert.match(service, /const finalInvoiceNumber = await generateInvoiceNumber\('wholesale', connection, saleTimeStr\)/)
})

test('invoice constraint migration is preview-first and protects every non-empty invoice number', () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/migrate-sale-invoice-constraints.js'), 'utf8')
  assert.match(source, /process\.argv\.includes\('--apply'\)/)
  assert.match(source, /\^\[0-9\]\{12\}\(XS\|PF\|HB\)\$/)
  assert.match(source, /GENERATED ALWAYS AS/)
  assert.match(source, /ADD UNIQUE INDEX \$\{CANONICAL_UNIQUE_INDEX\} \(\$\{GENERATED_COLUMN\}\)/)
  assert.match(source, /ADD UNIQUE INDEX \$\{FULL_UNIQUE_INDEX\} \(invoice_number\)/)
  assert.match(source, /invoice_number IS NOT NULL AND TRIM\(invoice_number\) <> ''/)
  assert.match(source, /blocked_by_duplicates/)
})

test('invoice integrity repair is preview-first, transactional and date-aware', () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/repair-duplicate-sale-invoice-numbers.js'), 'utf8')
  assert.match(source, /process\.argv\.includes\('--apply'\)/)
  assert.match(source, /await prepareInvoiceNumberTransaction\(db\)\s+await db\.beginTransaction\(\)/)
  assert.match(source, /SET invoice_number = CASE id/)
  assert.match(source, /ON DUPLICATE KEY UPDATE current_sequence = GREATEST/)
  assert.match(source, /LEFT\(invoice_number, 8\) <> DATE_FORMAT\(sale_time, '%Y%m%d'\)/)
  assert.match(source, /LEGACY_INVOICE_PATTERN/)
  assert.match(source, /\(id = \? AND invoice_number = \?\)/)
  assert.match(source, /await db\.rollback\(\)/)
  assert.match(source, /remaining_duplicate_groups: 0/)
  assert.match(source, /remaining_misaligned_rows: 0/)
  assert.match(source, /remaining_legacy_rows: 0/)
})

for (const failUpdate of [false, true]) {
  test(`the compatibility sales service keeps numbering and sale writes in one transaction (failure=${failUpdate})`, async () => {
    const database = createDatabase([number(1), number(3)])
    const connection = database.connect()
    const execute = connection.execute.bind(connection)
    connection.execute = async (sql, params) => /SELECT status FROM phones/.test(sql)
      ? [[{ status: 'in_stock' }]]
      : execute(sql, params)
    let released = false
    connection.release = () => { released = true }
    let saved
    class SaleRepository {
      async findPhoneByImei() { return { id: 61, purchase_cost: 3000 } }
      async createSale(data, transaction) {
        assert.equal(transaction, connection)
        saved = data
        connection.insertSale(data.invoice_number)
        return 901
      }
      async updatePhoneStatusToSold(phoneId, saleId, customerId, operatorId, price, cost, transaction, saleTime) {
        assert.equal(transaction, connection)
        assert.equal(phoneId, 61)
        assert.equal(saleId, 901)
        assert.equal(saleTime, '2026-11-02 00:00:00')
        if (failUpdate) throw new Error('模拟设备更新失败')
        return true
      }
      async getSaleRecordById() { return saved }
    }
    const module = { exports: {} }
    const dependencies = {
      '../repositories/sale.repository': SaleRepository,
      '../repositories/customer.repository': class {},
      '../utils/log': { debug() {}, error() {} },
      '../config/database': { getDatabase: () => ({ getConnection: async () => connection }) },
      '../utils/time': require('../src/utils/time'),
      '../utils/invoice-number': require('../src/utils/invoice-number')
    }
    const source = fs.readFileSync(path.join(__dirname, '../src/services/sale.service.js'), 'utf8')
    runInNewContext(source, {
      module,
      require: name => {
        assert.ok(Object.hasOwn(dependencies, name), `禁止加载非测试依赖 ${name}`)
        return dependencies[name]
      }
    })
    const service = new module.exports()
    const result = service.sellPhone({
      phone_id: 61, customer_id: 1, operator_id: 1,
      sale_price: 3500, sale_time: '2026-11-02',
      invoice_number: 'MANUAL-INVOICE-MUST-BE-IGNORED'
    })
    if (failUpdate) {
      await assert.rejects(result, /模拟设备更新失败/)
      assert.equal(database.committed.has(number(2)), false)
      assert.equal(await sell(database), number(2), '失败销售不能永久占用空号')
    } else {
      assert.equal((await result).data.sale.invoice_number, number(2))
      assert.equal(database.committed.has(number(2)), true)
    }
    assert.equal(released, true)
  })
}
