const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('报价页在库密码接口不使用应用层限流，前端只阻止并发重复提交', () => {
  const limiter = read('backend/src/middleware/rate-limit.js')
  const route = read('backend/src/routes/screen-lock.js')
  const frontend = read('frontend/src/views/price-list/page/PublicPriceQuery.vue')

  assert.doesNotMatch(limiter, /inventoryQueryPasswordRateLimit/)
  assert.match(route, /router\.post\('\/verify-inventory-query', async \(req, res\) =>/)
  assert.doesNotMatch(route, /verify-inventory-query',\s*(?:authRateLimit|\w*RateLimit)/)
  assert.match(frontend, /if \(searchSubmitting\.value \|\| loading\.value\) return/)
})

test('在库查询密码错误是预期业务拒绝，不触发员工登录态恢复或 API 故障日志', () => {
  const api = read('frontend/src/utils/unified-api.ts')

  assert.match(api, /error\.response\?\.status === 401[\s\S]*?normalizeApiPath\(requestConfig\?\.url \|\| ''\) === '\/screen-lock\/verify-inventory-query'/)
  assert.match(api, /if \(isInvalidInventoryQueryPassword\)[\s\S]*?recordPerformance[\s\S]*?throw error/)
  assert.ok(api.indexOf('if (isInvalidInventoryQueryPassword)') < api.indexOf('// 错误日志'))
})
