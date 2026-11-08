'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const DatabaseConnectionController = require('../src/controllers/database-connection.controller')

const responseHelper = {
  success(res, data, message) {
    res.body = { success: true, data, message: message || '操作成功' }
    return res
  },
  error(res, message, status, code) {
    res.statusCode = status
    res.body = { success: false, message, code }
    return res
  }
}

const createResponse = () => ({})

test('数据库连接探测执行 SELECT 1 并同步连接状态', async () => {
  let query
  const connectionStates = []
  const controller = new DatabaseConnectionController({
    database: () => ({
      async execute(sql) {
        query = sql
      }
    }),
    setDatabaseConnected: state => connectionStates.push(state),
    response: responseHelper
  })
  const response = createResponse()

  await controller.testConnection({}, response)

  assert.equal(query, 'SELECT 1')
  assert.deepEqual(connectionStates, [true])
  assert.deepEqual(response.body, { success: true, data: null, message: '数据库连接成功' })
})

test('数据库连接探测失败时置为断开并沿用错误码响应', async () => {
  const connectionStates = []
  const controller = new DatabaseConnectionController({
    database: () => ({
      async execute() {
        const error = new Error('offline')
        error.code = 'ECONNREFUSED'
        throw error
      }
    }),
    setDatabaseConnected: state => connectionStates.push(state),
    response: responseHelper,
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.testConnection({}, response)

  assert.deepEqual(connectionStates, [false])
  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, { success: false, message: '数据库连接失败', code: 'ECONNREFUSED' })
})

test('数据库状态及重连保留连接结果、重试参数和响应', async () => {
  let connectArgs
  const controller = new DatabaseConnectionController({
    isDatabaseConnected: () => false,
    connect: async (...args) => {
      connectArgs = args
      return true
    },
    response: responseHelper
  })
  const statusResponse = createResponse()
  controller.getStatus({}, statusResponse)
  assert.deepEqual(statusResponse.body, { success: true, data: { connected: false }, message: '操作成功' })

  const reconnectResponse = createResponse()
  await controller.reconnect({}, reconnectResponse)
  assert.deepEqual(connectArgs, [3, 2000])
  assert.deepEqual(reconnectResponse.body, { success: true, data: null, message: '数据库重连成功' })
})

test('系统连接路由保留原权限并委托 controller', () => {
  const routePath = path.join(__dirname, '../src/routes/system.js')
  const route = fs.readFileSync(routePath, 'utf8')

  assert.match(route, /router\.get\('\/test-db-connection', unifiedAuth, requirePermission\('system:view'\), databaseConnectionController\.testConnection\.bind\(databaseConnectionController\)\)/)
  assert.match(route, /router\.get\('\/db-status', unifiedAuth, requirePermission\('system:view'\), databaseConnectionController\.getStatus\.bind\(databaseConnectionController\)\)/)
  assert.match(route, /router\.post\('\/reconnect-db', unifiedAuth, requirePermission\('system:edit'\), databaseConnectionController\.reconnect\.bind\(databaseConnectionController\)\)/)
})
