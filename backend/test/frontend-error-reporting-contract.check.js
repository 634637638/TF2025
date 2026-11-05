const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const backendRoot = path.resolve(__dirname, '..')
const frontendRoot = path.resolve(backendRoot, '..', 'frontend')

test('前端错误上报路由使用统一认证并持久化到专用表', () => {
  const routeSource = fs.readFileSync(path.join(backendRoot, 'src/routes/frontend-error-logs.js'), 'utf8')
  const routesIndex = fs.readFileSync(path.join(backendRoot, 'src/routes/index.js'), 'utf8')
  const appSource = fs.readFileSync(path.join(backendRoot, 'src/app.js'), 'utf8')

  assert.match(routeSource, /router\.post\('\/errors', unifiedAuth/)
  assert.match(routeSource, /INSERT INTO frontend_error_logs/)
  assert.match(routeSource, /const userId = Number\(req\.user\?\.id\)/)
  assert.match(routeSource, /require\('\.\.\/utils\/sensitive-data'\)/)
  assert.match(routesIndex, /router\.use\('\/logs', frontendErrorLogRoutes\)/)
  assert.match(appSource, /await ensureFrontendErrorLogSchema\(\)/)
})

test('错误日志脱敏会移除令牌和密码', () => {
  const { redactValue, normalizeError } = require('../src/routes/frontend-error-logs')
  const redacted = redactValue({
    password: 'secret',
    nested: { authorization: 'Bearer abc.def', url: '/x?access_token=raw-token' }
  })

  assert.equal(redacted.password, '[REDACTED]')
  assert.equal(redacted.nested.authorization, '[REDACTED]')
  assert.match(redacted.nested.url, /access_token=\[REDACTED\]/)

  const normalized = normalizeError({
    id: 'err-1',
    level: 'critical',
    type: 'vue',
    message: 'render failed',
    timestamp: Date.now()
  }, 0)
  assert.equal(normalized.level, 'critical')
  assert.equal(normalized.errorType, 'vue')
})

test('前端错误上报配置已启用并指向统一接口', () => {
  const loggerSource = fs.readFileSync(path.join(frontendRoot, 'src/utils/error-logger.ts'), 'utf8')
  assert.match(loggerSource, /enabled: true/)
  assert.match(loggerSource, /endpoint: '\/logs\/errors'/)
  assert.doesNotMatch(loggerSource, /endpoint: '\/api\/logs\/errors'/)
})

test('普通日志工具不维护私有服务端上报实现', () => {
  const loggerSource = fs.readFileSync(path.join(frontendRoot, 'src/utils/logger.ts'), 'utf8')

  assert.doesNotMatch(loggerSource, /sendToServer/)
  assert.doesNotMatch(loggerSource, /fetch\s*\(/)
  assert.doesNotMatch(loggerSource, /\/api\/logs/)
  assert.doesNotMatch(loggerSource, /enableFileLog/)
})

test('全局错误边界和统一请求层共用 globalErrorLogger', () => {
  const mainSource = fs.readFileSync(path.join(frontendRoot, 'src/main.ts'), 'utf8')
  const unifiedApiSource = fs.readFileSync(path.join(frontendRoot, 'src/utils/unified-api.ts'), 'utf8')

  assert.match(mainSource, /enableReporting:\s*false/)
  assert.match(mainSource, /onError:\s*\(error\)\s*=>\s*\{[\s\S]*globalErrorLogger\.logError\(/)
  assert.match(unifiedApiSource, /globalErrorLogger\.logError\(/)
})
