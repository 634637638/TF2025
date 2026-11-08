'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const ScreenLockController = require('../src/controllers/screen-lock.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('屏幕锁路由保留认证和设置编辑权限并委托 controller', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/screen-lock.js'), 'utf8')
  assert.match(route, /router\.get\('\/', unifiedAuth, screenLockController\.getSettings\.bind/)
  assert.match(route, /router\.post\('\/', unifiedAuth, requirePermission\('system:edit'\), screenLockController\.updateSettings\.bind/)
  assert.match(route, /router\.post\('\/verify', unifiedAuth, screenLockController\.verifyLoginPassword\.bind/)
  assert.match(route, /router\.post\('\/upload\/screen-lock',[\s\S]*?requirePermission\('system:edit'\),\s*upload\.single\('file'\),\s*screenLockController\.uploadBackgroundFile\.bind/)
  assert.match(route, /router\.delete\('\/upload\/screen-lock\/:filename',[\s\S]*?requirePermission\('system:delete'\),\s*screenLockController\.deleteBackgroundFile\.bind/)
  assert.match(route, /router\.get\('\/query-users', unifiedAuth, requirePermission\('system:edit'\), screenLockController\.listQueryUsers\.bind/)
  assert.match(route, /router\.post\('\/query-users', unifiedAuth, requirePermission\('system:edit'\), screenLockController\.createQueryUser\.bind/)
  assert.match(route, /router\.put\('\/query-users\/:id', unifiedAuth, requirePermission\('system:edit'\), screenLockController\.updateQueryUser\.bind/)
  assert.match(route, /router\.delete\('\/query-users\/:id', unifiedAuth, requirePermission\('system:delete'\), screenLockController\.deleteQueryUser\.bind/)
  assert.doesNotMatch(route, /passwordLength|user: req\.user/)
})

test('屏幕锁设置接口保持读取和保存响应，并校验背景类型', async () => {
  let saved
  const controller = new ScreenLockController({
    settingsService: {
      async load() { return { backgroundType: 'image', imageUrl: '/uploads/bg.png' } },
      async save(settings) { saved = settings; return true }
    },
    logger: { error() {} }
  })
  const loaded = createResponse()
  await controller.getSettings({}, loaded)
  assert.deepEqual(loaded.body, {
    success: true,
    data: { backgroundType: 'image', imageUrl: '/uploads/bg.png' },
    message: '获取屏幕锁定设置成功'
  })

  const invalid = createResponse()
  await controller.updateSettings({ body: { backgroundType: 'iframe' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(saved, undefined)

  const updated = createResponse()
  await controller.updateSettings({ body: { backgroundType: 'video', title: '  Locked  ' } }, updated)
  assert.deepEqual(saved, {
    backgroundType: 'video', imageUrl: '', videoUrl: '', title: 'Locked', message: '请输入密码解锁'
  })
  assert.deepEqual(updated.body.data, saved)
  assert.equal(updated.body.message, '屏幕锁定设置保存成功')
})

test('屏幕锁登录密码校验覆盖缺失、离线、用户缺失和密码错误', async () => {
  const calls = []
  const controller = new ScreenLockController({
    getDatabase: () => ({ id: 'db' }),
    isConnected: () => true,
    repository: { async findUserPassword(db, userId) { calls.push([db.id, userId]); return null } },
    passwordVerifier: async () => false,
    logger: { debug() {}, error() {} }
  })
  const missingPassword = createResponse()
  await controller.verifyLoginPassword({ body: {}, user: { id: 4 } }, missingPassword)
  assert.equal(missingPassword.statusCode, 400)
  assert.equal(missingPassword.body.error.code, 'MISSING_PASSWORD')

  const noDatabase = new ScreenLockController({
    getDatabase: () => ({}), isConnected: () => false, logger: { debug() {}, error() {} }
  })
  const offline = createResponse()
  await noDatabase.verifyLoginPassword({ body: { password: 'pw' }, user: { id: 4 } }, offline)
  assert.equal(offline.statusCode, 500)
  assert.equal(offline.body.error.code, 'DATABASE_ERROR')

  const missingUser = createResponse()
  await controller.verifyLoginPassword({ body: { password: 'pw' }, user: { sub: 4 } }, missingUser)
  assert.equal(missingUser.statusCode, 400)
  assert.equal(missingUser.body.error.code, 'USER_NOT_FOUND')
  assert.deepEqual(calls, [['db', 4]])
})

test('屏幕锁登录密码匹配成功，且数据库异常返回原错误结构', async () => {
  const controller = new ScreenLockController({
    getDatabase: () => ({}),
    isConnected: () => true,
    repository: { async findUserPassword() { return { password: 'hash' } } },
    passwordVerifier: async (password, hash) => password === 'correct' && hash === 'hash',
    logger: { debug() {}, error() {} }
  })
  const success = createResponse()
  await controller.verifyLoginPassword({ body: { password: 'correct' }, user: { userId: 10 } }, success)
  assert.deepEqual(success.body, { success: true, message: '密码验证成功' })

  const invalid = createResponse()
  await controller.verifyLoginPassword({ body: { password: 'wrong' }, user: { id: 10 } }, invalid)
  assert.equal(invalid.statusCode, 401)
  assert.equal(invalid.body.error.code, 'INVALID_PASSWORD')

  const failedController = new ScreenLockController({
    getDatabase: () => ({}), isConnected: () => true,
    repository: { async findUserPassword() { throw new Error('query failed') } },
    logger: { debug() {}, error() {} }
  })
  const failed = createResponse()
  await failedController.verifyLoginPassword({ body: { password: 'pw' }, user: { id: 10 } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body.error, { code: 'INTERNAL_ERROR', message: 'query failed' })
})

test('查询用户列表脱敏密码并在所有路径释放连接', async () => {
  let released = 0
  const controller = new ScreenLockController({
    getDatabase: () => ({ async getConnection() { return { release() { released += 1 } } } }),
    repository: { async listQueryUsers() { return [{ id: 1, name: 'query', password: 'hash' }] } },
    response: {
      success(_res, message, data) { _res.body = { message, ...data }; return _res },
      serverError() {}
    },
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.listQueryUsers({}, response)
  assert.deepEqual(response.body, {
    message: '获取密码列表成功', total: 1,
    data: [{ id: 1, name: 'query', password: '******' }]
  })
  assert.equal(released, 1)
})

test('查询用户新增、更新和删除保留密码哈希、字段白名单和权限外层界限', async () => {
  const calls = []
  let released = 0
  const connection = { release() { released += 1 } }
  const controller = new ScreenLockController({
    getDatabase: () => ({ async getConnection() { return connection } }),
    repository: {
      async createQueryUser(_connection, values) { calls.push(['create', values]); return 14 },
      async updateQueryUser(_connection, id, fields, values) { calls.push(['update', id, fields, values]) },
      async deleteQueryUser(_connection, id) { calls.push(['delete', id]) }
    },
    passwordHasher: async (password, rounds) => `${rounds}:${password}`,
    response: { success(_res, message, data) { _res.body = { message, data }; return _res }, serverError() {} },
    logger: { debug() {}, error() {} }
  })
  const created = createResponse()
  await controller.createQueryUser({
    body: { name: 'reader', password: 'entered-value', remarks: 'notes' }, user: { id: 6 }
  }, created)
  assert.deepEqual(calls[0], ['create', {
    name: 'reader', password: '10:entered-value', remarks: 'notes', createdBy: 6
  }])
  assert.equal(created.body.message, '添加用户成功')

  const missing = createResponse()
  await controller.createQueryUser({ body: { name: 'reader' }, user: { id: 6 } }, missing)
  assert.equal(missing.statusCode, 400)

  const noUpdate = createResponse()
  await controller.updateQueryUser({ params: { id: '14' }, body: {} }, noUpdate)
  assert.equal(noUpdate.statusCode, 400)

  await controller.updateQueryUser({
    params: { id: '14' }, body: { name: 'new', password: '', is_active: 0, remarks: 'changed' }
  }, createResponse())
  assert.deepEqual(calls[1], ['update', '14', ['name = ?', 'is_active = ?', 'remarks = ?'], ['new', 0, 'changed']])
  await controller.deleteQueryUser({ params: { id: '14' } }, createResponse())
  assert.deepEqual(calls[2], ['delete', '14'])
  assert.equal(released, 4)
})

test('免登录库存查询只签发匹配的启用用户令牌，并释放连接', async () => {
  let released = 0
  const calls = []
  const controller = new ScreenLockController({
    getDatabase: () => ({ async getConnection() { return { release() { released += 1 } } } }),
    repository: { async listActiveQueryUsers() { return [
      { id: 1, name: 'first', password: 'hash-1' },
      { id: 2, name: 'second', password: 'hash-2' }
    ] } },
    passwordVerifier: async (password, hash) => { calls.push(hash); return hash === 'hash-2' && password === 'pw' },
    createQueryToken: user => `signed-${user.id}`,
    logger: { debug() {}, error() {} }
  })
  const response = createResponse()
  await controller.verifyInventoryQueryPassword({ body: { password: 'pw' } }, response)
  assert.deepEqual(calls, ['hash-1', 'hash-2'])
  assert.deepEqual(response.body.data, { userName: 'second', queryToken: 'signed-2', expiresIn: 600 })
  assert.equal(released, 1)

  const missing = createResponse()
  await controller.verifyInventoryQueryPassword({ body: {} }, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(released, 1)
})

test('背景文件上传校验签名、构造公开字段并在失败时清理文件', async () => {
  const removed = []
  const controller = new ScreenLockController({
    validateFileSignature: async (_file, kinds) => { assert.deepEqual(kinds, ['image', 'video']); return true },
    uploadUrl: (...segments) => `/${segments.join('/')}`,
    removeFiles: async files => removed.push(...files),
    logger: { error() {} }
  })
  const success = createResponse()
  const file = {
    filename: 'screen-lock-image-1.png', originalname: 'background.png', size: 123,
    mimetype: 'image/png', path: '/uploads/screen-lock/background.png'
  }
  await controller.uploadBackgroundFile({ file }, success)
  assert.deepEqual(success.body, {
    success: true,
    data: {
      filename: 'screen-lock-image-1.png', originalName: 'background.png', size: 123,
      url: '/screen-lock/screen-lock-image-1.png', type: 'image'
    },
    message: '图片上传成功'
  })
  assert.equal(removed.length, 0)

  const invalidController = new ScreenLockController({
    validateFileSignature: async () => false,
    removeFiles: async files => removed.push(...files),
    logger: { error() {} }
  })
  const invalid = createResponse()
  await invalidController.uploadBackgroundFile({ file }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.error.code, 'INVALID_FILE_CONTENT')
  assert.equal(removed.at(-1), file)

  const missing = createResponse()
  await controller.uploadBackgroundFile({}, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.error.code, 'NO_FILE')
})

test('背景文件删除拒绝路径穿越并区分不存在、成功和 I/O 错误', async () => {
  const removedPaths = []
  const controller = new ScreenLockController({
    uploadDirectory: (...segments) => `/uploads/${segments.join('/')}`,
    fileSystem: { async unlink(filePath) {
      removedPaths.push(filePath)
      if (filePath.endsWith('missing.png')) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      if (filePath.endsWith('error.png')) throw new Error('io error')
    } },
    logger: { error() {} }
  })
  const traversal = createResponse()
  await controller.deleteBackgroundFile({ params: { filename: '../private.png' } }, traversal)
  assert.equal(traversal.statusCode, 400)
  assert.equal(removedPaths.length, 0)

  const missing = createResponse()
  await controller.deleteBackgroundFile({ params: { filename: 'missing.png' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.error.code, 'FILE_NOT_FOUND')

  const deleted = createResponse()
  await controller.deleteBackgroundFile({ params: { filename: 'background.png' } }, deleted)
  assert.deepEqual(deleted.body, { success: true, message: '文件删除成功' })
  assert.equal(removedPaths.at(-1), '/uploads/screen-lock/background.png')

  const failed = createResponse()
  await controller.deleteBackgroundFile({ params: { filename: 'error.png' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.error.code, 'INTERNAL_ERROR')
})
