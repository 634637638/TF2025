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

test('模块管理 route 保留统一认证与管理员权限并委托 controller', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/system-management.js'), 'utf8')
  for (const [method, routePath, action] of [
    ['post', '/init-module-management', 'initModuleManagement'],
    ['get', '/verify-module-management', 'verifyModuleManagement'],
    ['post', '/sync-modules', 'syncModules'],
    ['get', '/sync-logs', 'getSyncLogs']
  ]) {
    assert.match(route, new RegExp(`router\\.${method}\\('${routePath}',\\s*requirePermission\\('permissions:admin'\\),\\s*systemManagementController\\.${action}\\.bind`))
  }
  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.doesNotMatch(route, /async\s*\(/)
})

test('模块管理 controller 验证表结构并总是释放连接', async () => {
  const SystemManagementController = require('../src/controllers/system-management.controller')
  const calls = []
  let released = false
  const controller = new SystemManagementController({
    database: () => ({
      async getConnection() {
        return {
          async execute(sql) {
            calls.push(sql)
            if (sql.includes('INFORMATION_SCHEMA')) {
              return [[{ TABLE_NAME: 'modules' }, { TABLE_NAME: 'roles' }, { TABLE_NAME: 'role_permissions' }, { TABLE_NAME: 'module_sync_log' }]]
            }
            if (sql.includes('COUNT(*)') && sql.includes('modules')) return [[{ count: 3 }]]
            return [[{ count: 7 }]]
          },
          release() {
            released = true
          }
        }
      }
    })
  })
  const response = createResponse()
  await controller.verifyModuleManagement({}, response)
  assert.equal(response.body.success, true)
  assert.equal(response.body.data.moduleCount, 3)
  assert.equal(response.body.data.permissionCount, 7)
  assert.equal(released, true)
  assert.equal(calls.length, 3)
})

test('模块同步和空日志接口保持原响应契约', async () => {
  const SystemManagementController = require('../src/controllers/system-management.controller')
  const controller = new SystemManagementController({
    scannerFactory: () => ({ async syncAllModules() { return { total: 4, success: 3, errors: 1 } } })
  })
  const syncResponse = createResponse()
  await controller.syncModules({}, syncResponse)
  assert.deepEqual(syncResponse.body, {
    success: true,
    message: '模块同步完成',
    data: { total: 4, success: 3, errors: 1 }
  })

  const logsResponse = createResponse()
  await controller.getSyncLogs({ query: { page: '2', limit: '5' } }, logsResponse)
  assert.deepEqual(logsResponse.body, {
    success: true,
    message: '获取同步日志成功',
    data: { logs: [], pagination: { page: 2, limit: 5, total: 0, pages: 0 } }
  })
})
