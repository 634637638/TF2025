'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const route = fs.readFileSync(
  path.join(__dirname, '../src/routes/sales.js'),
  'utf8'
)
const phonesRoute = fs.readFileSync(
  path.join(__dirname, '../src/routes/phones.js'),
  'utf8'
)

test('sales checkout uses one final remark for phones and sales records', () => {
  const start = route.indexOf("router.post('/phone'")
  const end = route.indexOf("router.post('/batch'")
  const handler = route.slice(start, end > start ? end : undefined)

  assert.ok(start >= 0, '销售出库路由不存在')
  assert.match(handler, /p\.remarks/)
  assert.match(handler, /FOR UPDATE/)
  assert.match(handler, /final_remarks:/)
  assert.match(handler, /hasRemarksField = Object\.prototype\.hasOwnProperty\.call\(req\.body, 'remarks'\)/)
  assert.match(handler, /shouldApplyRequestedRemarks = hasRemarksField && \(!isBatchSale \|\| requestedRemarks !== ''\)/)
  assert.match(handler, /const requestedRemarks = String\(remarks \?\? ''\)\.trim\(\)/)
  assert.match(handler, /finalizedPhonesToSell\[0\]\.final_remarks/)
  assert.match(handler, /phone\.final_remarks/)
  assert.match(handler, /supplierIdMap\.get\(phone\.phone_id\)/)
  assert.match(handler, /remarks = \?,/)
  assert.doesNotMatch(handler, /remarks = COALESCE\(NULLIF\(TRIM\(\?\), ''\), remarks\)/)
})

test('phone editing keeps the canonical remark and synchronizes sales records', () => {
  const start = phonesRoute.indexOf("router.put('/:id'")
  const handler = phonesRoute.slice(start)

  assert.match(handler, /const finalNotes = valueOrCurrent\(remarks, currentPhone\.remarks\) \?\? ''/)
  assert.match(handler, /remarks = \?/)
  assert.match(handler, /UPDATE sales SET \$\{updateSalesFields\.join\(', '\)\} WHERE phone_id = \?/)
})
