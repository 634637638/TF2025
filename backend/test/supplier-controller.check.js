'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SupplierController = require('../src/controllers/supplier.controller')

const createResponse = () => ({
  headers: {},
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  setHeader(name, value) { this.headers[name] = value; return this },
  send(body) { this.body = body; return this }
})

test('供应商 routes 保留统一认证和八条原权限并全部委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/suppliers.js'), 'utf8')

  assert.match(route, /router\.use\(unifiedAuth\)/)
  for (const [method, endpoint, permission, handler] of [
    ['get', '/', 'suppliers:view', 'list'],
    ['get', '/stats', 'suppliers:view', 'stats'],
    ['get', '/export', 'suppliers:export', 'export'],
    ['put', '/batch/reorder', 'suppliers:edit', 'reorder'],
    ['post', '/', 'suppliers:create', 'create'],
    ['put', '/:id', 'suppliers:edit', 'update'],
    ['delete', '/:id', 'suppliers:delete', 'remove'],
    ['get', '/:id', 'suppliers:view', 'detail']
  ]) {
    const escapedPath = endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(route, new RegExp(`router\\.${method}\\('${escapedPath}', requirePermission\\('${permission}'\\), supplierController\\.${handler}\\.bind\\(supplierController\\)\\)`))
  }
  assert.equal((route.match(/supplierController\.[A-Za-z]+\.bind\(supplierController\)/g) || []).length, 8)
  assert.doesNotMatch(route, /async\s*\(/)
})

test('供应商列表使用规范分页、状态校验、安全排序和格式化字段', async () => {
  const calls = []
  const rows = [{
    id: '4', name: ' 供应商A ', contact: null, phone: '123', address: null,
    bank_info: null, tax_number: null, status: '1', sort_order: '2', remarks: null,
    created_at: '2026-11-07T00:00:00.000Z', updated_at: null
  }]
  const controller = new SupplierController({
    connected: () => true,
    database: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return sql.includes('COUNT(*)') ? [[{ total: '21' }]] : [rows]
      }
    }),
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.list({ query: { page: '2', page_size: '10', name: ' A ', status: '1', sort_by: 'name', sort_order: 'DESC' } }, response)

  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].params, ['%A%', 1])
  assert.match(calls[0].sql, /ORDER BY name DESC, sort_order ASC, id ASC LIMIT 10 OFFSET 10/)
  assert.deepEqual(response.body.data[0], {
    id: 4, name: '供应商A', contact: null, phone: '123', address: null, bank_info: null,
    tax_number: null, status: 1, sort_order: 2, remarks: null,
    created_at: '2026-11-07T00:00:00.000Z', updated_at: null
  })
  assert.deepEqual(response.body.pagination, {
    page: 2, page_size: 10, total: 21, total_pages: 3, has_next: true, has_prev: true
  })

  const invalidResponse = createResponse()
  await controller.stats({ query: { status: '2' } }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  assert.equal(invalidResponse.body.message, '供应商状态只能是0或1')
})

test('供应商排序事务失败时回滚并释放连接', async () => {
  const events = []
  let writeCount = 0
  const controller = new SupplierController({
    connected: () => true,
    database: () => ({ async getConnection() { return {
      async beginTransaction() { events.push('begin') },
      async execute() {
        writeCount += 1
        if (writeCount === 2) throw new Error('write failed')
      },
      async commit() { events.push('commit') },
      async rollback() { events.push('rollback') },
      release() { events.push('release') }
    } } }),
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.reorder({ body: { items: [{ id: 1, sort_order: 1 }, { id: 2, sort_order: 2 }] } }, response)

  assert.equal(response.statusCode, 500)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('供应商删除先检查关联商品，CSV 导出安全转义并输出 BOM', async () => {
  const calls = []
  const controller = new SupplierController({
    connected: () => true,
    database: () => ({ async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM accessories WHERE supplier_id')) return [[{ count: '2' }]]
      if (sql.includes('FROM phones WHERE supplier_id')) return [[{ count: '0' }]]
      if (sql.includes('SELECT id, name')) return [[{ id: 1, name: '甲,"乙', contact: null, phone: null, address: null, bank_info: null, tax_number: null, status: 1, sort_order: 0, remarks: null, created_at: null, updated_at: null }]]
      return [{ affectedRows: 1 }]
    } }),
    logger: { error() {} }
  })
  const deleteResponse = createResponse()

  await controller.remove({ params: { id: '8' } }, deleteResponse)
  assert.equal(deleteResponse.statusCode, 409)
  assert.equal(calls.some(call => call.sql.startsWith('DELETE FROM suppliers')), false)

  const exportResponse = createResponse()
  await controller.export({ query: {} }, exportResponse)
  assert.equal(exportResponse.headers['Content-Type'], 'text/csv; charset=utf-8')
  assert.match(exportResponse.body, /^\uFEFFID,供应商名称/)
  assert.match(exportResponse.body, /"甲,""乙"/)
})
