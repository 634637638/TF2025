const test = require('node:test')
const assert = require('node:assert/strict')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('错误上报 controller 保留登录校验、批次校验和成功响应', async () => {
  const FrontendErrorLogController = require('../src/controllers/frontend-error-log.controller')
  const FrontendErrorLogService = require('../src/services/frontend-error-log.service')
  let insertBatchArgs
  const service = new FrontendErrorLogService({
    repository: {
      async insertBatch(report) {
        insertBatchArgs = report
      }
    }
  })
  const controller = new FrontendErrorLogController({ service })
  const unauthorized = createResponse()

  await controller.report({ body: {}, user: {} }, unauthorized)
  assert.equal(unauthorized.statusCode, 401)
  assert.deepEqual(unauthorized.body, { success: false, message: '登录状态无效' })

  const invalidBatch = createResponse()
  await controller.report({
    body: { errors: Array.from({ length: 51 }, () => ({ message: 'failure' })) },
    user: { id: 12 }
  }, invalidBatch)
  assert.equal(invalidBatch.statusCode, 400)
  assert.deepEqual(invalidBatch.body, { success: false, message: '单次最多上报 50 条错误' })
  assert.equal(insertBatchArgs, undefined)

  const success = createResponse()
  await controller.report({
    body: { error: { message: 'failure', timestamp: 1000 }, sessionId: 'session-1' },
    user: { id: 12 }
  }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '错误日志上报成功',
    data: { accepted: 1 }
  })
  assert.equal(insertBatchArgs.userId, 12)
  assert.equal(insertBatchArgs.sessionId, 'session-1')
  assert.equal(insertBatchArgs.errors.length, 1)
})

test('错误日志 repository 绑定业务值并保留批量幂等写入', async () => {
  const FrontendErrorLogRepository = require('../src/repositories/frontend-error-log.repository')
  let executedQuery
  let executedValues
  const repository = new FrontendErrorLogRepository({
    async execute(query, values) {
      executedQuery = query
      executedValues = values
    }
  })
  const error = {
    errorKey: 'key-value',
    level: 'high',
    errorType: 'javascript',
    message: 'message-value',
    stack: null,
    context: null,
    component: null,
    action: null,
    tags: '[]',
    occurredAt: new Date(1000),
    count: 1,
    pageUrl: null,
    userAgent: null
  }

  await repository.insertBatch({
    userId: 12,
    sessionId: 'session-value',
    environment: null,
    sessionData: null,
    errors: [error]
  })

  assert.match(executedQuery, /INSERT INTO frontend_error_logs/)
  assert.match(executedQuery, /ON DUPLICATE KEY UPDATE/)
  assert.equal(executedQuery.includes('message-value'), false)
  assert.equal(executedValues.length, 17)
  assert.equal(executedValues[0], 'key-value')
  assert.equal(executedValues[1], 12)
  assert.equal(executedValues[5], 'message-value')
})
