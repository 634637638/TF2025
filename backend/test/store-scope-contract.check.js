'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('comprehensive query rejects manually selected stores outside the user scope', () => {
  const controller = read('src/controllers/query.controller.js')

  assert.match(controller, /const getRequestedStoreId = \(value\) =>/)
  assert.match(controller, /const validateRequestedStoreScope = \(req, res\) =>/)
  assert.match(controller, /if \(isSuperAdmin\(req\.user\)\) return null/)
  assert.match(controller, /!userStoreIds\.includes\(requestedStoreId\)/)
  assert.match(controller, /无权查询该门店数据/)
  assert.equal((controller.match(/validateRequestedStoreScope\(req, res\)/g) || []).length, 3)
})

test('strict store options remain separate from inventory and sales store access', () => {
  const storesRoute = read('src/routes/stores.js')
  const referenceOptions = read('../frontend/src/services/reference-options.ts')
  const queryController = read('src/controllers/query.controller.js')

  assert.match(storesRoute, /strict_scope/)
  assert.match(storesRoute, /if \(strictStoreScope && !isSuperAdmin\(req\.user\)\)/)
  assert.match(referenceOptions, /strictScope \? '\/stores\?all=true&strict_scope=true' : '\/stores\?all=true'/)
  assert.match(queryController, /storeIds: userStoreIds/)
})
