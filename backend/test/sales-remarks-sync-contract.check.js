'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const route = fs.readFileSync(
  path.join(__dirname, '../src/routes/sales.js'),
  'utf8'
)
const phoneUpdateService = fs.readFileSync(
  path.join(__dirname, '../src/services/phone-update.service.js'),
  'utf8'
)

test('sales checkout uses one final remark for phones and sales records', () => {
  const service = fs.readFileSync(
    path.join(__dirname, '../src/services/sales-phone.service.js'),
    'utf8'
  )
  const repository = fs.readFileSync(
    path.join(__dirname, '../src/repositories/sales-phone.repository.js'),
    'utf8'
  )

  assert.match(route, /router\.post\('\/phone',[\s\S]*salesPhoneController\.sell\.bind/)
  assert.match(repository, /p\.remarks/)
  assert.match(repository, /FOR UPDATE/)
  assert.match(service, /final_remarks:/)
  assert.match(service, /hasRemarksField = Object\.prototype\.hasOwnProperty\.call\(body, 'remarks'\)/)
  assert.match(service, /shouldApplyRequestedRemarks = hasRemarksField && \(!isBatchSale \|\| requestedRemarks !== ''\)/)
  assert.match(service, /const requestedRemarks = String\(remarks \?\? ''\)\.trim\(\)/)
  assert.match(service, /remarks: phone\.final_remarks/)
  assert.match(service, /currentPhone\.supplier_id/)
  assert.match(repository, /remarks = \?,/)
  assert.doesNotMatch(repository, /remarks = COALESCE\(NULLIF\(TRIM\(\?\), ''\), remarks\)/)
})

test('phone editing keeps the canonical remark and synchronizes sales records', () => {
  const handler = phoneUpdateService

  assert.match(handler, /const finalNotes = valueOrCurrent\(remarks, currentPhone\.remarks\) \?\? ''/)
  assert.match(handler, /remarks = \?/)
  assert.match(handler, /this\.repository\.updateSale\(/)
})
