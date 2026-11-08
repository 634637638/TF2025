const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const backendRoot = path.resolve(__dirname, '..')

test('健康检查路由委托 controller 并保持无认证端点', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/index.js'), 'utf8')

  assert.match(route, /router\.get\('\/live', healthController\.liveness\.bind\(healthController\)\)/)
  assert.match(route, /router\.get\('\/health', healthController\.readiness\.bind\(healthController\)\)/)
  assert.doesNotMatch(route, /router\.get\('\/(?:live|health)',[^\n]*unifiedAuth/)
})

test('健康检查 controller 保留存活与 readiness handler 的返回值', async () => {
  const HealthController = require('../src/controllers/health.controller')
  const calls = []
  const controller = new HealthController({
    liveness(req, res) {
      calls.push(['liveness', req, res])
      return 'live-result'
    },
    async readiness(req, res) {
      calls.push(['readiness', req, res])
      return 'ready-result'
    }
  })
  const request = {}
  const response = {}

  assert.equal(controller.liveness(request, response), 'live-result')
  assert.equal(await controller.readiness(request, response), 'ready-result')
  assert.deepEqual(calls, [
    ['liveness', request, response],
    ['readiness', request, response]
  ])
})
