const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const backendRoot = path.resolve(__dirname, '..')
const frontendRoot = path.resolve(backendRoot, '..', 'frontend')

test('前端错误上报路由使用统一认证并持久化到专用表', () => {
  const routeSource = fs.readFileSync(path.join(backendRoot, 'src/routes/frontend-error-logs.js'), 'utf8')
  const repositorySource = fs.readFileSync(path.join(backendRoot, 'src/repositories/frontend-error-log.repository.js'), 'utf8')
  const controllerSource = fs.readFileSync(path.join(backendRoot, 'src/controllers/frontend-error-log.controller.js'), 'utf8')
  const serviceSource = fs.readFileSync(path.join(backendRoot, 'src/services/frontend-error-log.service.js'), 'utf8')
  const routesIndex = fs.readFileSync(path.join(backendRoot, 'src/routes/index.js'), 'utf8')
  const appSource = fs.readFileSync(path.join(backendRoot, 'src/app.js'), 'utf8')

  assert.match(routeSource, /router\.post\('\/errors', unifiedAuth, frontendErrorLogRateLimit, frontendErrorLogController\.report\.bind\(frontendErrorLogController\)\)/)
  assert.match(repositorySource, /INSERT INTO frontend_error_logs/)
  assert.match(controllerSource, /const userId = Number\(req\.user\?\.id\)/)
  assert.match(controllerSource, /this\.service\.submitReport\(req\.body, userId, req\.requestId\)/)
  assert.match(serviceSource, /this\.repository\.insertBatch\(\{ userId, \.\.\.report \}\)/)
  assert.doesNotMatch(controllerSource, /repositories\/frontend-error-log\.repository/)
  assert.match(repositorySource, /VALUES \$\{errors\.map\(\(\) => rowSql\)\.join\(', '\)\}/)
  assert.match(routesIndex, /router\.use\('\/logs', frontendErrorLogRoutes\)/)
  assert.match(appSource, /await ensureFrontendErrorLogSchema\(\)/)
})

test('错误日志脱敏会移除令牌和密码', () => {
  const { redactValue, normalizeError } = require('../src/services/frontend-error-log.service')
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

test('错误日志 service prepares sanitized reports and persists them through the repository', async () => {
  const FrontendErrorLogService = require('../src/services/frontend-error-log.service')
  let persisted
  const service = new FrontendErrorLogService({
    repository: {
      async insertBatch(report) {
        persisted = report
      }
    }
  })

  const result = await service.submitReport({
    error: { message: 'request failed with Bearer sensitive.token', count: 2 },
    sessionId: 'session-1'
  }, 12)

  assert.deepEqual(result, { accepted: 1 })
  assert.equal(persisted.userId, 12)
  assert.equal(persisted.sessionId, 'session-1')
  assert.equal(persisted.errors[0].message, 'request failed with Bearer [REDACTED]')
})

test('前端错误上报受生产环境约束并指向统一接口', () => {
  const loggerSource = fs.readFileSync(path.join(frontendRoot, 'src/utils/error-logger.ts'), 'utf8')
  // 结构检查只固定构建环境入口，具体开关/触发行为由前端行为测试验证。
  assert.match(loggerSource, /import\.meta\.env\.PROD/)
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

  const boundarySource = fs.readFileSync(path.join(frontendRoot, 'src/utils/error-boundary.ts'), 'utf8')
  assert.doesNotMatch(boundarySource, /\bfetch\s*\(|\benableReporting\b|\breportingEndpoint\b/)
  assert.match(mainSource, /onError:\s*\(error\)\s*=>\s*\{[\s\S]*globalErrorLogger\.logError\(/)
  assert.match(unifiedApiSource, /globalErrorLogger\.logError\(/)
})
