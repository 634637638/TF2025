'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const DataImportController = require('../src/controllers/data-import.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('导入进度和活跃任务路由保留权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/data-import.js'), 'utf8')
  assert.match(route, /router\.get\('\/progress\/:import_id', requirePermission\('data-import:view'\), dataImportController\.progress\.bind\(dataImportController\)\)/)
  assert.match(route, /router\.get\('\/active-tasks', requirePermission\('permissions:admin'\), dataImportController\.activeTasks\.bind\(dataImportController\)\)/)
  assert.match(route, /router\.get\('\/history', requirePermission\('data-import:view'\), dataImportController\.history\.bind\(dataImportController\)\)/)
  assert.match(route, /router\.delete\('\/history\/:id', requirePermission\('data-import:delete'\), dataImportController\.removeHistory\.bind\(dataImportController\)\)/)
  assert.match(route, /router\.delete\('\/progress\/:import_id', requirePermission\('permissions:admin'\), dataImportController\.clearProgress\.bind\(dataImportController\)\)/)
})

test('导入进度 controller 返回运行中、完成和初始化状态', async () => {
  const progressController = new DataImportController({
    service: {
      getImportProgress: id => id === 'running-1' ? { progress: 65, status: 'processing' } : null,
      getImportHistory: () => [{
        import_id: 22, user: 'importer', total: '10', imported: '8', errors: '2',
        status: 'completed', timestamp: '2026-11-07T00:00:00Z'
      }]
    },
    logger: { debug() {}, error() {} }
  })

  const running = createResponse()
  await progressController.progress({ params: { import_id: 'running-1' } }, running)
  assert.equal(running.body.message, '获取导入进度成功')
  assert.deepEqual(running.body.data, { import_id: 'running-1', progress: 65, status: 'processing' })

  const completed = createResponse()
  await progressController.progress({ params: { import_id: '22' } }, completed)
  assert.equal(completed.body.message, '导入已完成')
  assert.deepEqual(completed.body.data, {
    status: 'completed', progress: 100, message: '导入已完成', import_id: '22',
    user_id: null, user_name: 'importer', strategy: undefined, file_name: null,
    total_records: 10, processed: 0, imported: 8, updated: 0, skipped: 0,
    error_count: 2, error_message: null, start_time: '2026-11-07T00:00:00Z',
    end_time: null, duration_ms: null, created_at: '2026-11-07T00:00:00Z',
    updated_at: null
  })

  const initializing = createResponse()
  await progressController.progress({ params: { import_id: 'pending' } }, initializing)
  assert.equal(initializing.body.message, '导入任务正在初始化')
  assert.deepEqual(initializing.body.data, {
    status: 'processing', progress: 0,
    message: '导入任务正在初始化，请稍后...', import_id: 'pending'
  })
})

test('活跃任务 controller 只返回公开进度字段并统一处理服务异常', async () => {
  const controller = new DataImportController({
    service: {
      getActiveTasks: () => [{
        import_id: 12, progress: 30, age_minutes: 2, timestamp: 123, file_path: '/private/path'
      }]
    },
    logger: { debug() {}, error() {} }
  })
  const response = createResponse()
  await controller.activeTasks({}, response)
  assert.deepEqual(response.body.data, {
    count: 1,
    tasks: [{ import_id: '12', progress: 30, age_minutes: 2, timestamp: 123 }]
  })
  assert.equal('file_path' in response.body.data.tasks[0], false)

  const failingController = new DataImportController({
    service: { getActiveTasks() { throw new Error('service failed') } },
    logger: { debug() {}, error() {} }
  })
  const failed = createResponse()
  await failingController.activeTasks({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '获取活跃任务失败，请稍后重试')
})

test('导入历史 controller 绑定筛选与分页参数并限制每页上限', async () => {
  const calls = []
  const controller = new DataImportController({
    service: {},
    logger: { error() {} }
  })
  const connection = {
    async execute(query, values) {
      calls.push({ query, values })
      return query.includes('COUNT(*)')
        ? [[{ total: 205 }], []]
        : [[{ id: 8, import_id: 'task-8', status: 'completed' }], []]
    }
  }
  const response = createResponse()
  await controller.history({
    app: { get: key => key === 'db' ? connection : undefined },
    query: { page: '2', page_size: '5000', status: 'completed', strategy: 'merge', user_id: '7' }
  }, response)

  assert.deepEqual(calls[0].values, ['completed', 'merge', '7'])
  assert.deepEqual(calls[1].values, ['completed', 'merge', '7', 100, 100])
  assert.match(calls[1].query, /LIMIT \? OFFSET \?/)
  assert.equal(response.body.message, '获取导入历史成功')
  assert.deepEqual(response.body.pagination, {
    page: 2, page_size: 100, total: 205, total_pages: 3, has_next: true, has_prev: true
  })

  const unavailable = createResponse()
  await controller.history({ app: { get: () => null }, query: {} }, unavailable)
  assert.equal(unavailable.statusCode, 500)
  assert.equal(unavailable.body.message, '数据库连接不可用')
})

test('删除导入历史 controller 校验 ID、存在性并参数化删除', async () => {
  const calls = []
  const controller = new DataImportController({
    service: {},
    logger: { debug() {}, error() {} }
  })
  const connection = {
    async execute(query, values) {
      calls.push({ query, values })
      return query.startsWith('SELECT') ? [[{ id: 9 }], []] : [{ affectedRows: 1 }, []]
    }
  }
  const app = { get: () => connection }

  const invalid = createResponse()
  await controller.removeHistory({ app, params: { id: 'invalid' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(calls.length, 0)

  const removed = createResponse()
  await controller.removeHistory({ app, params: { id: '9' } }, removed)
  assert.equal(removed.body.message, '删除成功')
  assert.deepEqual(removed.body.data, { id: '9' })
  assert.deepEqual(calls.map(call => call.values), [['9'], ['9']])

  const missingController = new DataImportController({
    service: {},
    logger: { debug() {}, error() {} }
  })
  const missing = createResponse()
  await missingController.removeHistory({
    app: { get: () => ({ async execute() { return [[], []] } }) },
    params: { id: '10' }
  }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '记录不存在')
})

test('清理导入进度 controller 委托服务并保持响应及异常处理', async () => {
  let clearedId
  const controller = new DataImportController({
    service: { clearProgress: id => { clearedId = id } },
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.clearProgress({ params: { import_id: 'task-4' } }, response)
  assert.equal(clearedId, 'task-4')
  assert.deepEqual(response.body, {
    success: true,
    message: '清理导入进度成功',
    data: { import_id: 'task-4' }
  })

  const failing = new DataImportController({
    service: { clearProgress() { throw new Error('clear failed') } },
    logger: { error() {} }
  })
  const failed = createResponse()
  await failing.clearProgress({ params: { import_id: 'task-4' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '清理导入进度失败，请稍后重试')
})

test('上传 controller 校验文件、返回预览并绑定当前用户令牌', async () => {
  const calls = []
  const controller = new DataImportController({
    service: {},
    fileService: {
      validateUploadedFile: filePath => `/safe/${path.basename(filePath)}`,
      register: (...args) => calls.push(args)
    },
    readSpreadsheet: filePath => {
      assert.equal(filePath, '/safe/upload-1.xlsx')
      return { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }
    },
    sheetToJson: () => Array.from({ length: 12 }, (_, index) => ({ name: `row-${index}` })),
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.upload({
    file: { path: '/uploads/import/upload-1.xlsx', originalname: 'source.xlsx', size: 120 },
    user: { userId: 19 }
  }, response)

  assert.equal(response.body.data.file_token, 'upload-1.xlsx')
  assert.equal(response.body.data.total_rows, 12)
  assert.equal(response.body.data.preview_data.length, 10)
  assert.deepEqual(calls, [['upload-1.xlsx', 19]])
})

test('上传解析失败后删除临时文件并返回兼容错误', async () => {
  const removed = []
  const controller = new DataImportController({
    service: {},
    fileService: { validateUploadedFile: () => '/safe/upload.xlsx', register() {} },
    readSpreadsheet: () => { throw new Error('invalid workbook') },
    fileSystem: { existsSync: filePath => filePath === '/uploads/import/upload.xlsx', unlinkSync: filePath => removed.push(filePath) },
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.upload({ file: { path: '/uploads/import/upload.xlsx' }, user: { id: 3 } }, response)
  assert.equal(response.statusCode, 500)
  assert.equal(response.body.message, '上传文件失败，请检查文件格式后重试')
  assert.deepEqual(removed, ['/uploads/import/upload.xlsx'])
})

test('文件清理与分析都按登录用户解析令牌', async () => {
  const calls = []
  const controller = new DataImportController({
    service: { async analyzeData(filePath, options) { calls.push(['analyze', filePath, options]); return { total: 1 } } },
    fileService: {
      resolve: (token, userId) => { calls.push(['resolve', token, userId]); return '/safe/import.xlsx' },
      remove: token => calls.push(['remove', token])
    },
    fileSystem: { existsSync: () => true, unlinkSync: filePath => calls.push(['unlink', filePath]) },
    logger: { error() {} }
  })
  const cleaned = createResponse()
  await controller.cleanupFile({ body: { file_token: 'import.xlsx' }, user: { sub: 8 } }, cleaned)
  assert.deepEqual(calls.slice(0, 3), [
    ['resolve', 'import.xlsx', 8], ['unlink', '/safe/import.xlsx'], ['remove', 'import.xlsx']
  ])
  const analyzed = createResponse()
  await controller.analyze({ body: { file_token: 'import.xlsx', options: { mode: 'safe' } }, user: { id: 8 } }, analyzed)
  assert.deepEqual(calls.slice(3), [
    ['resolve', 'import.xlsx', 8], ['analyze', '/safe/import.xlsx', { mode: 'safe' }]
  ])
  assert.deepEqual(analyzed.body.data, { total: 1 })
})

test('导入校验策略、生成服务端任务 ID 并在后台任务结束后清理文件', async () => {
  const calls = []
  const controller = new DataImportController({
    service: {
      updateProgress: (...args) => calls.push(['progress', ...args]),
      getImportProgress: () => ({ progress: 0 }),
      importData: async (...args) => { calls.push(['import', ...args]) }
    },
    fileService: {
      resolve: (token, userId) => { calls.push(['resolve', token, userId]); return '/safe/import.xlsx' },
      remove: token => calls.push(['remove-token', token])
    },
    createImportId: () => 'server-task-id',
    fileSystem: { existsSync: filePath => filePath === '/safe/import.xlsx', unlinkSync: filePath => calls.push(['unlink', filePath]) },
    logger: { debug() {}, error() {}, warn() {} }
  })
  const invalid = createResponse()
  await controller.startImport({ body: { file_token: 'import.xlsx', options: { strategy: 'unknown' } }, user: { id: 8 } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(calls.slice(0, 2), [['resolve', 'import.xlsx', 8], ['remove-token', 'import.xlsx']])
  assert.equal(calls.some(call => call[0] === 'import'), false)

  calls.length = 0
  const started = createResponse()
  await controller.startImport({ body: { file_token: 'import.xlsx', options: { strategy: 'merge' } }, user: { id: 8 } }, started)
  assert.deepEqual(started.body, {
    success: true,
    message: '导入任务已启动',
    data: { import_id: 'server-task-id', strategy: 'merge' }
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(calls.some(call => call[0] === 'progress' && call[1] === 'server-task-id'))
  assert.ok(calls.some(call => call[0] === 'import' && call[1] === '/safe/import.xlsx' && call[2].import_id === 'server-task-id'))
  assert.ok(calls.some(call => call[0] === 'unlink' && call[1] === '/safe/import.xlsx'))
})
