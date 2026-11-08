'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SalesManagementController = require('../src/controllers/sales-management.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('H5 销售管理路由保留认证和读写权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales-management.js'), 'utf8')
  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.equal((route.match(/requireAnyPermission\(H5_ORDER_VIEW_PERMISSIONS\)/g) || []).length, 3)
  assert.equal((route.match(/requireAnyPermission\(H5_ORDER_EDIT_PERMISSIONS\)/g) || []).length, 5)
  assert.equal((route.match(/salesManagementController\.[a-z]+\.bind\(salesManagementController\)/g) || []).length, 8)
  assert.doesNotMatch(route, /async\s*\(req,\s*res\)/)
})

test('H5 订单列表绑定规范筛选分页并保持响应结构', async () => {
  let received
  const controller = new SalesManagementController({
    service: { async getH5OrdersList(options) {
      received = options
      return {
        data: [{ id: 4 }], page: 2, page_size: 100, total: 201,
        total_pages: 3, has_next: true, has_prev: true
      }
    } },
    logger: { debug() {}, error() {} },
    now: () => Date.parse('2026-11-07T12:00:00Z')
  })
  const response = createResponse()
  await controller.list({
    query: {
      page: '2', page_size: '500', status: 'paid', customer_name: '张',
      customer_phone: '123', order_number: 'H5-1', start_date: '2026-11-01',
      end_date: '2026-11-07', sort: 'created_at', order: 'desc'
    },
    path: '/h5-orders'
  }, response)

  assert.deepEqual(received, {
    page: 2, page_size: 100, status: 'paid', customer_name: '张',
    customer_phone: '123', order_number: 'H5-1', start_date: '2026-11-01',
    end_date: '2026-11-07', sort: 'created_at', order: 'desc'
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.pagination, {
    page: 2, page_size: 100, total: 201, total_pages: 3, has_next: true, has_prev: true
  })
  assert.equal(response.body.timestamp, '2026-11-07T12:00:00.000Z')
})

test('H5 订单审核和发货把当前用户及输入原样交给业务服务', async () => {
  const calls = []
  const controller = new SalesManagementController({
    service: {
      async confirmH5Order(...args) { calls.push(['confirm', ...args]); return { id: '12' } },
      async rejectH5Order(...args) { calls.push(['reject', ...args]); return { id: '12' } },
      async shipH5Order(...args) { calls.push(['ship', ...args]); return { id: '12' } },
      async completeH5Order(...args) { calls.push(['complete', ...args]); return { id: '12' } },
      async cancelH5Order(...args) { calls.push(['cancel', ...args]); return { id: '12' } }
    },
    logger: { error() {} }
  })
  const req = { params: { id: '12' }, user: { id: 7 }, body: { remarks: '核验', reason: '重复', tracking_number: 'SF1', shipping_company: '顺丰' } }
  for (const method of ['confirm', 'reject', 'ship', 'complete', 'cancel']) await controller[method](req, createResponse())

  assert.deepEqual(calls, [
    ['confirm', '12', 7, '核验'],
    ['reject', '12', 7, '重复'],
    ['ship', '12', { tracking_number: 'SF1', shipping_company: '顺丰', remarks: '核验', shipped_by: 7 }],
    ['complete', '12', 7, '核验'],
    ['cancel', '12', 7, '重复']
  ])
})

test('H5 订单拒绝仍要求原因且缺失订单仍返回 not found', async () => {
  const controller = new SalesManagementController({
    service: {
      async rejectH5Order() { assert.fail('缺少拒绝原因时不能调用服务') },
      async getH5OrderDetail() { return null }
    },
    logger: { error() {} }
  })
  const missingReason = createResponse()
  await controller.reject({ params: { id: '12' }, user: { id: 7 }, body: {} }, missingReason)
  assert.equal(missingReason.statusCode, 400)

  const missingOrder = createResponse()
  await controller.detail({ params: { id: '404' } }, missingOrder)
  assert.equal(missingOrder.statusCode, 404)
})
