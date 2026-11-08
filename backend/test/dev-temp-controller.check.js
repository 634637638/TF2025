const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const backendRoot = path.resolve(__dirname, '..')

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

test('开发临时 controller 保持用户名校验和提升管理员响应', async () => {
  const DevTempController = require('../src/controllers/dev-temp.controller')
  const usernames = []
  const controller = new DevTempController({
    async makeAdmin(username) {
      usernames.push(username)
    }
  })
  const invalidResponse = createResponse()

  await controller.makeAdmin({ body: {} }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  assert.deepEqual(invalidResponse.body, { success: false, message: '请提供用户名' })
  assert.deepEqual(usernames, [])

  const successResponse = createResponse()
  await controller.makeAdmin({ body: { username: 'employee' } }, successResponse)
  assert.deepEqual(successResponse.body, {
    success: true,
    message: '用户 employee 已设置为管理员，请重新登录'
  })
  assert.deepEqual(usernames, ['employee'])
})

test('开发首页迁移失败返回固定错误，不泄露内部异常', async () => {
  const DevTempController = require('../src/controllers/dev-temp.controller')
  const controller = new DevTempController({
    async migrateHomeSections() {
      throw new Error('database detail')
    }
  })
  const response = createResponse()

  await controller.migrateHomeSections({}, response)

  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, { success: false, message: '迁移失败' })
})

test('开发临时 service 参数化更新用户名并执行首页表迁移后读取结果', async () => {
  const DevTempService = require('../src/services/dev-temp.service')
  const queries = []
  const database = {
    async query(sql, values) {
      queries.push({ sql, values })
      if (sql === 'SELECT * FROM H5_home_sections') return [[{ id: 3, title: 'Home' }]]
      return [{ affectedRows: 1 }]
    }
  }
  const service = new DevTempService({
    database: { getDatabase: () => database },
    fileSystem: { readFileSync: () => 'CREATE TABLE H5_home_sections (id INT)' }
  })

  await service.makeAdmin('employee')
  const sections = await service.migrateHomeSections()

  assert.deepEqual(queries, [
    { sql: "UPDATE users SET role = 'admin' WHERE username = ?", values: ['employee'] },
    { sql: 'CREATE TABLE H5_home_sections (id INT)', values: undefined },
    { sql: 'SELECT * FROM H5_home_sections', values: undefined }
  ])
  assert.deepEqual(sections, [{ id: 3, title: 'Home' }])
})

test('开发临时路由保留认证、管理员权限、审计和 controller 委托', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/index.js'), 'utf8')

  assert.match(route, /router\.post\('\/temp\/make-admin', unifiedAuth, requirePermission\('permissions:admin'\), auditDevTempRoute\('make_admin'\), devTempController\.makeAdmin\.bind\(devTempController\)\)/)
  assert.match(route, /router\.post\('\/temp\/migrate-home-sections', unifiedAuth, requirePermission\('permissions:admin'\), auditDevTempRoute\('migrate_home_sections'\), devTempController\.migrateHomeSections\.bind\(devTempController\)\)/)
})
