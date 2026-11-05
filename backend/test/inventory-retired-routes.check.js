const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const inventoryRoute = fs.readFileSync(
  path.resolve(__dirname, '../src/routes/inventory.js'),
  'utf8'
)

test('retired inventory placeholders are removed instead of returning 410 or 501', () => {
  for (const oldPath of [
    '/:id/movements',
    '/:id/stock-in',
    '/:id/stock-out',
    '/:id/reserve',
    '/:id/unreserve',
    '/:id/adjust',
    '/stock-in'
  ]) {
    assert.doesNotMatch(
      inventoryRoute,
      new RegExp(`router\\.(?:get|post|put)\\(\\s*['"]${oldPath.replaceAll('/', '\\/')}['"]`)
    )
  }

  assert.doesNotMatch(inventoryRoute, /retiredInventoryEndpoint|migrationId|暂未实现|真实流程暂未实现|, 501\)/)
})
