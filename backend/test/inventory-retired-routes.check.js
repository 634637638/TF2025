const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const inventoryRoute = fs.readFileSync(
  path.resolve(__dirname, '../src/routes/inventory.js'),
  'utf8'
)

test('retired inventory placeholders return 410 instead of unimplemented 501 responses', () => {
  const retiredRouteIds = [
    'inventory-movements-unimplemented',
    'inventory-item-stock-in-to-stock-in',
    'inventory-item-stock-out-unimplemented',
    'inventory-item-reserve-unimplemented',
    'inventory-item-unreserve-unimplemented',
    'inventory-item-adjust-unimplemented',
    'inventory-stock-in-to-stock-in'
  ]

  assert.match(inventoryRoute, /const retiredInventoryEndpoint = message =>/)
  assert.match(inventoryRoute, /ApiResponse\.error\(res, message, 410\)/)
  assert.doesNotMatch(inventoryRoute, /暂未实现|真实流程暂未实现|, 501\)/)

  for (const routeId of retiredRouteIds) {
    assert.match(inventoryRoute, new RegExp(`migrationId: '${routeId}'`))
  }
})
