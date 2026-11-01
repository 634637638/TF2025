'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

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

test('phone edits convert transaction types atomically and regenerate the type suffix', () => {
  const start = phonesRoute.indexOf("router.put('/:id'")
  const handler = phonesRoute.slice(start)

  assert.match(handler, /ensureInvoiceSequenceTable\(connection\)/)
  assert.match(handler, /beginTransaction\(\)/)
  assert.match(handler, /SELECT status FROM phones WHERE id = \? FOR UPDATE/)
  assert.match(handler, /sold:\s*'retail'/)
  assert.match(handler, /peer_transfer:\s*'wholesale'/)
  assert.match(handler, /supplier_proxy:\s*'supplier_proxy'/)
  assert.match(handler, /generateInvoiceNumber\(\s*targetSaleType/)
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

  assert.match(quickSale, /<el-form-item label="状态" prop="status">/)
  for (const label of ['已售', '调货', '划拨']) assert.match(quickSale, new RegExp(`label="${label}"`))
  assert.match(quickSale, /v-if="formData\.status !== 'supplier_proxy'"\s+label="入库价格"/)
  assert.match(quickSale, /v-if="formData\.status !== 'supplier_proxy'"\s+:label=/)
  assert.match(quickSaleHelpers, /status: formData\.status \|\| 'sold'/)
})
