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

test('仪表盘 warning 路由保留权限并委托 controller，其他两个旧 handler 留在原处', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/dashboard.js'), 'utf8')
  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('dashboard:view'\), dashboardController\.getDashboardData\.bind/)
  assert.match(route, /router\.get\('\/activities', unifiedAuth, requirePermission\('dashboard:view'\), dashboardController\.getActivities\.bind/)
  for (const [routePath, method] of [
    ['/warnings/comprehensive', 'getComprehensiveWarnings'],
    ['/warnings/phones', 'getPhoneStockWarnings'],
    ['/warnings/models', 'getModelStockWarnings'],
    ['/warnings/sales', 'getSalesWarnings'],
    ['/warnings/purchases', 'getPurchaseWarnings']
  ]) {
    assert.match(route, new RegExp(`router\\.get\\('${routePath.replaceAll('/', '\\/')}', unifiedAuth, requirePermission\\('dashboard:view'\\), dashboardController\\.${method}\\.bind`))
  }
  assert.doesNotMatch(route, /async\s*\(/)
})

test('仪表盘数据库离线时仍返回 token 用户信息', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const controller = new DashboardController({ connected: () => false })
  const response = createResponse()
  await controller.getDashboardData({
    user: { id: 9, username: 'employee', name: '员工', role: 'sales' }
  }, response)
  assert.equal(response.body.data.user.id, 9)
  assert.equal(response.body.data.user.phone, '')
  assert.equal(response.body.data.user.role, 'sales')
})

test('仪表盘数据库统计保持手机库存、销售合计和最近销售响应', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const calls = []
  const results = [
    [{ count: 2 }], [{ count: 3 }], [{ count: 4 }], [{ count: 5 }],
    [{ amount: 10 }], [{ amount: 20 }], [{ amount: 30 }],
    [{ id: 1, sale_price: 10, sale_time: '2026-11-01', status: 'sold' }],
    [{ id: 2, phone_id: 3, sale_price: 30, sale_time: '2026-11-01', sale_type: 'wholesale' }],
    [{ count: 6 }], [{ id: 7, accessory_name: '配件' }]
  ]
  const controller = new DashboardController({
    connected: () => true,
    database: () => ({
      async execute(sql) {
        calls.push(sql)
        return [results[calls.length - 1]]
      }
    })
  })
  const response = createResponse()
  await controller.getDashboardData({ user: {} }, response)
  assert.equal(calls.length, 11)
  assert.equal(response.body.data.stats.todaySalesAmount, 60)
  assert.deepEqual(response.body.data.stats.phones, { in_stock: 5 })
  assert.equal(response.body.data.stats.todaySales, 6)
  assert.equal(response.body.data.recentSales[0].accessory_name, '配件')
})

test('活动流合并销售、客户、入库和维修来源并按时间返回最新八条', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const controller = new DashboardController({
    connected: () => true,
    database: () => ({
      async execute(sql) {
        if (sql.includes("CONCAT('phone-sale-'")) {
          return [[{ id: 'phone-sale-1', activity_type: 'sales', icon: 'cart', brand_name: '品牌', model_name: '型号', occurred_at: '2026-11-02T00:00:00Z' }]]
        }
        if (sql.includes("CONCAT('accessory-sale-'")) {
          return [[{ id: 'accessory-sale-2', activity_type: 'sales', icon: 'bag', accessory_name: '配件', occurred_at: '2026-11-04T00:00:00Z' }]]
        }
        if (sql.includes("CONCAT('customer-'")) {
          return [[{ id: 'customer-3', activity_type: 'customer', icon: 'user', customer_name: '新客户', occurred_at: '2026-11-03T00:00:00Z' }]]
        }
        if (sql.includes("CONCAT('phone-inventory-'")) {
          return [[{ id: 'phone-inventory-4', activity_type: 'inventory', icon: 'box', brand_name: '品牌', model_name: '新机', occurred_at: '2026-11-01T00:00:00Z' }]]
        }
        return [[{ id: 'repair-created-5', activity_type: 'repair', icon: 'tools', event_label: '创建维修单', brand_name: '品牌', model_name: '维修机', occurred_at: '2026-11-05T00:00:00Z' }]]
      }
    })
  })
  const response = createResponse()
  await controller.getActivities({}, response)
  assert.equal(response.body.data.length, 5)
  assert.equal(response.body.data[0].id, 'repair-created-5')
  assert.equal(response.body.data[0].description, '创建维修单：品牌 维修机')
  assert.equal(response.body.data[1].description, '完成配件销售：配件')
  assert.equal(response.body.message, '获取最近活动成功')
})

test('仪表盘 controller 保持 warning 参数、成功数据和错误响应', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const calls = []
  const controller = new DashboardController({
    dashboardService: {
      async getComprehensiveWarnings(filters) {
        calls.push(['comprehensive', filters])
        return { success: true, data: { total_warnings: 2 } }
      },
      async getPhoneStockWarnings(filters) {
        calls.push(['phones', filters])
        return { success: false, message: '限制数量必须在1-100之间' }
      },
      async getSalesWarnings() {
        throw new Error('database failure')
      }
    }
  })

  const success = createResponse()
  await controller.getComprehensiveWarnings({ query: { phone_threshold: '4', page_size: '12' } }, success)
  assert.deepEqual(calls[0], ['comprehensive', { phone_threshold: '4', page_size: '12' }])
  assert.deepEqual(success.body.data, { total_warnings: 2 })

  const invalid = createResponse()
  await controller.getPhoneStockWarnings({ query: { threshold: '2', page_size: '101' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '限制数量必须在1-100之间')

  const failed = createResponse()
  await controller.getSalesWarnings({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})
