'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const XLSX = require('xlsx')
const Controller = require('../src/controllers/subsidy-export.controller')
const Service = require('../src/services/subsidy-export.service')
const Repository = require('../src/repositories/subsidy-export.repository')
const buildExportFile = require('../src/utils/subsidy-export-file')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

test('subsidy Excel export route preserves authentication, export permission and controller delegation', () => {
  assert.match(routeSource, /router\.get\('\/export\/excel', unifiedAuth, requirePermission\('subsidy:export'\), subsidyExportController\.exportExcel\.bind\(subsidyExportController\)\)/)
})

test('subsidy export controller preserves file headers, body and error response', async () => {
  const logged = []
  const file = { filename: '国补管理_2026-11-08.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('xlsx'), total: 2 }
  const controller = new Controller({
    service: { async export(input) { assert.deepEqual(input, { userId: 4, query: { store_id: '2' } }); return file } },
    logger: { error(...args) { logged.push(args) } }
  })
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    send(body) { this.body = body; return this }
  }
  await controller.exportExcel({ user: { id: 4 }, query: { store_id: '2' } }, response)
  assert.deepEqual(response.headers, {
    'Content-Type': file.mimeType,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    'X-Export-Total': '2'
  })
  assert.equal(response.body, file.buffer)

  const failure = {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
  const failingController = new Controller({
    service: { async export() { throw new Error('database unavailable') } },
    logger: { error(...args) { logged.push(args) } }
  })
  await failingController.exportExcel({ user: { id: 4 }, query: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '导出国补数据失败', error: 'database unavailable' })
  assert.equal(logged.length, 1)
})

test('subsidy export service applies safe sort and preserves filters, field permissions and handler normalization', async () => {
  const calls = []
  const service = new Service({
    repository: { async listForExport(input) {
      calls.push(['query', input])
      return [{ id: 3, has_different_handler: 1 }]
    } },
    masking: { async getUserFieldPermissions(userId, moduleKey) {
      calls.push(['permissions', userId, moduleKey])
      return { hiddenFields: ['customer_info.customer_phone'] }
    } },
    buildExportFile(items, hiddenFields) {
      calls.push(['file', items, hiddenFields])
      return { total: items.length }
    }
  })
  const result = await service.export({
    userId: 9,
    query: { store_id: '2', sort_by: 'sale_time DESC; DROP TABLE users', sort_order: 'ASC' }
  })
  assert.deepEqual(result, { total: 1 })
  assert.deepEqual(calls[0], ['query', {
    whereConditions: ['1=1', 'store_id = ?'],
    queryParams: ['2'],
    sortField: 'sale_time',
    sortDirection: 'ASC'
  }])
  assert.deepEqual(calls[1], ['permissions', 9, 'subsidy_subsidyview'])
  assert.deepEqual(calls[2][1], [{ id: 3, has_different_handler: true }])
  assert.deepEqual([...calls[2][2]], ['customer_info.customer_phone'])
})

test('subsidy export repository executes the filtered date-formatted query with bound values', async () => {
  let call
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      call = { sql, params }
      return [[{ id: 1 }]]
    }
  }) })
  assert.deepEqual(await repository.listForExport({
    whereConditions: ['1=1', 'store_id = ?'],
    queryParams: ['5'],
    sortField: 'sale_time',
    sortDirection: 'ASC'
  }), [{ id: 1 }])
  assert.deepEqual(call.params, ['5'])
  assert.match(call.sql, /DATE_FORMAT\(sale_time, '%Y-%m-%d'\) as sale_time/)
  assert.match(call.sql, /WHERE 1=1 AND store_id = \?\s+ORDER BY sale_time ASC/)
})

test('subsidy export workbook keeps visible columns, localized values and attachment total', () => {
  const file = buildExportFile([{
    customer_name: '客户',
    customer_phone: '13800000000',
    phone_brand: '品牌',
    sale_price: '2999.50',
    subsidy_rate: '15',
    subsidy_photos: '["a", "b"]',
    has_different_handler: true,
    apply_time: '2026-11-08'
  }], new Set(['customer_info.customer_phone']))
  const workbook = XLSX.read(file.buffer, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['国补管理'], { header: 1 })
  assert.equal(workbook.SheetNames[0], '国补管理')
  assert.ok(rows[0].includes('客户姓名'))
  assert.ok(!rows[0].includes('客户电话'))
  assert.equal(rows[1][rows[0].indexOf('当前状态')], '已提交')
  assert.equal(rows[1][rows[0].indexOf('照片数量')], 2)
  assert.equal(file.total, 1)
  assert.match(file.filename, /^国补管理_\d{4}-\d{2}-\d{2}\.xlsx$/)
})
