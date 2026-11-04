'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { runInNewContext } = require('node:vm')
const { formatLocalDate } = require('../src/utils/time')
const { generateInvoiceNumber, prepareInvoiceNumberTransaction } = require('../src/utils/invoice-number')

const root = path.resolve(__dirname, '..')
const phonesRoute = fs.readFileSync(path.join(root, 'src/routes/phones.js'), 'utf8')
const inventoryRoute = fs.readFileSync(path.join(root, 'src/routes/inventory.js'), 'utf8')
const quickSale = fs.readFileSync(
  path.join(root, '../frontend/src/components/query/QuickSaleModal.vue'),
  'utf8'
)
const quickSaleHelpers = fs.readFileSync(
  path.join(root, '../frontend/src/components/query/quick-sale/helpers.ts'),
  'utf8'
)

// 运行实际销售联动分支，以不同的手机/销售记录 ID 验证 SQL 归属，不连接数据库。
const existingSaleUpdateStart = phonesRoute.indexOf('const existingSale = existingSales[0]')
const existingSaleUpdateEnd = phonesRoute.indexOf('    if (synchronizedSaleId)', existingSaleUpdateStart)
const existingSaleUpdate = phonesRoute
  .slice(existingSaleUpdateStart, existingSaleUpdateEnd)
  .replace(/\n\s*}\s*$/, '')

const simulateExistingSaleUpdate = async (saleType, options = {}) => {
  const originalSuffix = saleType === 'retail' ? 'XS' : saleType === 'supplier_proxy' ? 'HB' : 'PF'
  const originalNumber = `202610270001${originalSuffix}`
  const records = [
    { id: 901, phone_id: 61, sale_type: saleType, invoice_number: options.missingInvoice ? null : originalNumber, sale_time: options.oldSaleTime || '2026-10-27 10:52:35', created_at: '2026-10-27 10:52:35' },
    { id: 61, phone_id: 808, sale_type: 'retail', invoice_number: '202610270002XS', sale_time: '2026-10-27 09:00:00' }
  ]
  const untouched = { ...records[1] }
  const generated = []
  const statements = []
  const connection = {
    execute: async (sql, values) => {
      if (/CREATE TABLE IF NOT EXISTS invoice_sequences/.test(sql)) return [{}]
      if (/INSERT (?:IGNORE )?INTO invoice_sequences/.test(sql)) return [{ affectedRows: 1 }]
      if (/SELECT current_sequence[\s\S]+FROM invoice_sequences[\s\S]+FOR UPDATE/.test(sql)) return [[{ current_sequence: 0 }]]
      if (/SELECT invoice_number FROM sales/.test(sql)) {
        assert.match(sql, /FOR UPDATE/)
        const [date, suffix] = values[0].split('%')
        const occupied = options.occupiedSequences || [1, 2, 3, 4, 5, 6]
        return [occupied.map(sequence => ({
          invoice_number: `${date}${String(sequence).padStart(4, '0')}${suffix}`
        }))]
      }
      if (/UPDATE invoice_sequences/.test(sql)) return [{ affectedRows: 1 }]
      statements.push({ sql, values: [...values] })
      assert.match(sql, /^UPDATE sales SET .+ WHERE id = \?$/)
      const record = records.find(item => item.id === values.at(-1))
      assert.ok(record, '更新目标必须为已查询到的销售记录')
      let index = 0
      for (const assignment of sql.slice('UPDATE sales SET '.length).split(' WHERE id = ?')[0].split(', ')) {
        if (assignment === 'updated_at = NOW()') {
          record.updated_at = '模拟数据库保存时间'
        } else {
          const column = assignment.split(' = ')[0]
          record[column] = values[index++]
        }
      }
      assert.equal(index, values.length - 1)
      return [{ affectedRows: 1 }]
    }
  }
  await prepareInvoiceNumberTransaction(connection)
  const requestedSaleTime = options.omitSaleTime
    ? undefined
    : options.saleTime || '2026-11-01'
  const context = {
    id: 61,
    existingSales: [{ ...records[0] }],
    connection,
    sale_time: requestedSaleTime,
    effectiveSaleTime: requestedSaleTime || records[0].sale_time,
    formatLocalDate,
    isTransactionTypeChange: Boolean(options.convert),
    targetSaleType: 'wholesale',
    finalCustomerId: null,
    saleOperatorId: null,
    effectiveStoreId: null,
    effectiveSalePrice: null,
    effectivePurchaseCost: null,
    finalNotes: '保留备注',
    generateInvoiceNumber: async (...args) => {
      generated.push(args)
      return generateInvoiceNumber(...args)
    },
    log: { debug: () => {}, info: () => {} }
  }
  await runInNewContext(`(async () => { ${existingSaleUpdate} })()`, context)
  return { records, untouched, generated, statements, originalNumber }
}

for (const saleType of ['retail', 'wholesale', 'peer_transfer', 'supplier_proxy']) {
  test(`${saleType} date edits regenerate the linked sale invoice without updating another phone`, async () => {
    const result = await simulateExistingSaleUpdate(saleType)
    assert.equal(result.records[0].sale_time, '2026-11-01')
    const suffix = saleType === 'retail' ? 'XS' : saleType === 'supplier_proxy' ? 'HB' : 'PF'
    assert.equal(result.records[0].invoice_number, `202611010007${suffix}`)
    assert.equal(result.generated.length, 1)
    assert.equal(result.records[0].created_at, '2026-10-27 10:52:35')
    assert.equal(result.records[0].updated_at, '模拟数据库保存时间')
    assert.deepEqual(result.records[1], result.untouched, '不能把手机 ID 当作销售记录 ID 修改其他单据')
    assert.equal(result.statements[0].values.at(-1), 901)
  })
}

for (const saleTime of ['2026-10-27', '2026-10-27 18:00:00']) {
  test(`saving the same sale date (${saleTime}) preserves the invoice and does not consume a sequence`, async () => {
    const result = await simulateExistingSaleUpdate('retail', { saleTime })
    assert.equal(result.records[0].invoice_number, result.originalNumber)
    assert.equal(result.generated.length, 0)
  })
}

test('omitting sale_time while editing remarks does not regenerate the invoice', async () => {
  const result = await simulateExistingSaleUpdate('retail', { omitSaleTime: true })
  assert.equal(result.records[0].invoice_number, result.originalNumber)
  assert.equal(result.generated.length, 0)
})

test('saving again after a date change does not regenerate the invoice a second time', async () => {
  const result = await simulateExistingSaleUpdate('retail', { oldSaleTime: '2026-11-01 00:00:00' })
  assert.equal(result.generated.length, 0)
})

test('historical missing invoices use the shared sequence generator', async () => {
  const result = await simulateExistingSaleUpdate('retail', { missingInvoice: true })
  assert.equal(result.records[0].invoice_number, '202611010007XS')
  assert.equal(result.generated.length, 1)
})

test('a date edit fills a vacant target-date invoice instead of appending after its maximum', async () => {
  const result = await simulateExistingSaleUpdate('retail', { occupiedSequences: [1, 3, 4, 10] })
  assert.equal(result.records[0].invoice_number, '202611010002XS')
  assert.deepEqual(result.records[1], result.untouched)
})

test('changing transaction type regenerates the linked sale invoice using the selected sale date', async () => {
  const result = await simulateExistingSaleUpdate('retail', { convert: true })
  assert.equal(result.records[0].sale_type, 'wholesale')
  assert.equal(result.records[0].invoice_number, '202611010007PF')
  assert.equal(result.generated.length, 1)
  assert.equal(result.generated[0][0], 'wholesale')
  assert.equal(result.generated[0][2], '2026-11-01')
  assert.deepEqual(result.records[1], result.untouched)
})

test('phone edits convert transaction types atomically and regenerate the type suffix', () => {
  const start = phonesRoute.indexOf("router.put('/:id'")
  const handler = phonesRoute.slice(start)

  assert.match(handler, /prepareInvoiceNumberTransaction\(connection\)/)
  assert.match(handler, /beginTransaction\(\)/)
  assert.match(handler, /SELECT status FROM phones WHERE id = \? FOR UPDATE/)
  assert.match(handler, /sold:\s*'retail'/)
  assert.match(handler, /peer_transfer:\s*'wholesale'/)
  assert.match(handler, /supplier_proxy:\s*'supplier_proxy'/)
  assert.match(handler, /generateInvoiceNumber\(\s*invoiceSaleType/)
  assert.ok(handler.includes("updateSalesFields.push('sale_type = ?', 'invoice_number = ?')"))
  assert.match(handler, /WHERE id = \?/)
  assert.match(handler, /await connection\.commit\(\)/)
  assert.match(handler, /await connection\.rollback\(\)/)
})

test('conversion keeps payment history untouched', () => {
  const start = phonesRoute.indexOf("router.put('/:id'")
  const handler = phonesRoute.slice(start)

  assert.doesNotMatch(handler, /先完成退款或冲正后再转为划拨/)
  assert.doesNotMatch(handler, /DELETE FROM payment_records/)
  assert.ok(handler.includes("updateSalesFields.push('sale_type = ?', 'invoice_number = ?')"))
})

test('transaction conversion and quick sale require permissions for the target type', () => {
  const phoneEditHandler = phonesRoute.slice(phonesRoute.indexOf("router.put('/:id'"))

  assert.match(phoneEditHandler, /sales:sell/)
  assert.match(phoneEditHandler, /sales:wholesale/)
  assert.match(phoneEditHandler, /sales:proxy-transfer/)
  assert.match(phoneEditHandler, /hasUnifiedPermission\(req\.user, requiredPermission\[0\], requiredPermission\[1\]\)/)
  assert.match(inventoryRoute, /sold: \['inventory:sell', 'system'\]/)
  assert.match(inventoryRoute, /peer_transfer: \['sales:wholesale', 'business'\]/)
  assert.match(inventoryRoute, /supplier_proxy: \['sales:proxy-transfer', 'business'\]/)
})

test('quick sale supports retail, wholesale and supplier proxy with canonical invoice types', () => {
  const start = inventoryRoute.indexOf("router.post('/quick-sale'")
  const handler = inventoryRoute.slice(start)

  assert.match(handler, /status = 'sold'/)
  assert.match(handler, /peer_transfer: \{ saleType: 'wholesale', phoneStatus: 'peer_transfer', invoiceType: 'wholesale' \}/)
  assert.match(handler, /supplier_proxy: \{ saleType: 'supplier_proxy', phoneStatus: 'supplier_proxy', invoiceType: 'supplier_proxy' \}/)
  assert.match(handler, /generateInvoiceNumber\(transactionConfig\.invoiceType/)
  assert.match(handler, /UPDATE phones SET sale_id = \?,/)

  assert.match(quickSale, /<el-form-item\s+label="状态"\s+prop="status"\s*>/)
  for (const label of ['已售', '调货', '划拨']) assert.match(quickSale, new RegExp(`label="${label}"`))
  assert.match(quickSale, /v-if="formData\.status !== 'supplier_proxy'"\s+label="入库价格"/)
  assert.match(quickSale, /v-if="formData\.status !== 'supplier_proxy'"\s+:label=/)
  assert.match(quickSaleHelpers, /status: formData\.status \|\| 'sold'/)
})
