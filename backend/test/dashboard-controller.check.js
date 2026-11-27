const test = require('node:test')
const assert = require('node:assert/strict')

const createResponse = () => ({
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value
  },
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
  assert.match(route, /router\.get\('\/my-monthly-stats', unifiedAuth, requirePermission\('dashboard:view'\), dashboardController\.getMyMonthlyStats\.bind/)
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

test('仪表盘返回在库成色、手机销售额及台数与跨年客户新增统计，并保留总计', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const DashboardReadService = require('../src/services/dashboard-read.service')
  const calls = []
  const results = [
    [{ count: 2 }], [{ count: 3 }],
    [{ count: '54', current_month_count: '0', previous_month_count: '12' }],
    [{ count: '5', new_count: '4', used_count: '0' }],
    [{ amount: '48.25', new_amount: '32.5', used_amount: '10.75', new_count: '5', used_count: '2' }],
    [{ count: 6, amount: '20.5' }], [{ id: 7, accessory_name: '配件' }]
  ]
  const readService = new DashboardReadService({
    connected: () => true,
    now: () => '2027-01-01',
    getFields: async (userId, moduleKey) => {
      assert.equal(userId, 7)
      assert.equal(moduleKey, 'dashboard_dashboardview')
      return { hiddenFields: [] }
    },
    database: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return [results[calls.length - 1]]
      }
    })
  })
  const controller = new DashboardController({ readService })
  const response = createResponse()
  await controller.getDashboardData({ user: { id: 7, store_ids: [2] } }, response)
  assert.equal(calls.length, 7)
  assert.deepEqual(calls[2].params, ['2026-12-01 00:00:00', '2027-01-01 00:00:00', '2027-01-01 00:00:00', '2027-01-02 00:00:00'])
  assert.deepEqual(calls[4].params, ['2027-01-01 00:00:00', '2027-01-02 00:00:00', 2])
  assert.deepEqual(calls[5].params, calls[4].params)
  assert.equal(response.headers['Cache-Control'], 'private, no-store')
  assert.deepEqual(response.body.data.stats, {
    users: 2, accessories: 3,
    customers: 54, customerGrowth: { current_month: 0, previous_month: 12 },
    phones: { in_stock: 5, new_count: 4, used_count: 0 },
    todaySales: 6, todaySalesAmount: 68.75,
    todayPhoneSales: { new_amount: 32.5, used_amount: 10.75, new_count: 5, used_count: 2 }
  })
  assert.equal(response.body.data.recentSales[0].accessory_name, '配件')
})

test('仪表盘隐藏的统计卡片及其明细不查询也不返回', async () => {
  const DashboardReadService = require('../src/services/dashboard-read.service')
  const readService = new DashboardReadService({
    connected: () => true,
    getFields: async () => ({ hiddenFields: ['stats.today_sales', 'stats.total_customers', 'stats.total_products'] }),
    repository: {
      countUsers: async () => [[{ count: 2 }]],
      countAccessories: async () => [[{ count: 3 }]]
    }
  })
  assert.deepEqual(await readService.getDashboardData({ id: 7 }), {
    stats: { users: 2, accessories: 3 }, recentSales: []
  })
})

test('活动流使用门店范围，合并当天销售、每类最多十条，并遮蔽源字段', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const DashboardReadService = require('../src/services/dashboard-read.service')
  const calls = []
  const rows = (id, type, extra = {}) => Array.from({ length: 10 }, (_, index) => ({
    id: `${id}-${index}`, activity_type: type, icon: 'cart', occurred_at: `2026-11-26 12:${10 + index}:00`, ...extra
  }))
  const readService = new DashboardReadService({
    connected: () => true,
    now: () => '2026-11-26',
    permissionCheck: async (_actor, permission) => permission !== 'preorders:view',
    getFields: async (_id, moduleKey) => ({ hiddenFields: moduleKey === 'sales_salesview' ? ['sale.operator_id'] : [] }),
    repository: {
      async phoneSaleActivities(...args) { calls.push(args); return [rows('phone-sale', 'sales', { operator_name: '不可见', model_name: 'iPhone' })] },
      async accessorySaleActivities() { return [rows('accessory-sale', 'sales', { operator_name: '张三', quantity: 2, accessory_name: '保护壳' })] },
      async inventoryActivities() { return [rows('inventory', 'inventory', { brand_name: '苹果', model_name: '18promax', color_name: '白色', memory_size: '512GB' })] },
      async repairActivities() { return [rows('repair', 'repair', { event_label: '创建维修单' })] },
      async subsidyActivities() { return [rows('subsidy', 'subsidy', { event_label: '新增国补' })] }
    }
  })
  const controller = new DashboardController({ readService })
  const response = createResponse()
  await controller.getActivities({ user: { id: 7, store_ids: [2] } }, response)
  const activities = response.body.data
  assert.equal(activities.length, 40)
  assert.equal(activities.filter(item => item.type === 'sales').length, 10)
  const inventoryActivity = activities.find(item => item.type === 'inventory')
  assert.equal(inventoryActivity.description, '到货：苹果 18promax')
  assert.equal(inventoryActivity.detail, '白色 · 512GB')
  assert.ok(activities.some(item => item.description === '张三销售2件保护壳'))
  assert.ok(activities.some(item => item.description === '员工销售一台iPhone'))
  assert.equal(JSON.stringify(activities).includes('不可见'), false)
  assert.ok(activities.every((item, index) => index === 0 || activities[index - 1].occurred_at >= item.occurred_at))
  assert.deepEqual(calls[0], [10, { allStores: false, requestedStoreId: null, storeIds: [2] }, '2026-11-26 00:00:00', '2026-11-27 00:00:00'])
  assert.equal(response.body.message, '获取最近活动成功')
})

test('活动流不会使用隐藏的国补提交时间或关联销售时间', async () => {
  const DashboardReadService = require('../src/services/dashboard-read.service')
  for (const hiddenField of ['time_info.apply_time', 'time_info.sale_time']) {
    const service = new DashboardReadService({
      connected: () => true,
      permissionCheck: async (_actor, permission) => permission === 'subsidy:view',
      getFields: async (_userId, moduleKey) => ({
        hiddenFields: moduleKey === 'subsidy_subsidyview' ? [hiddenField] : []
      }),
      repository: {}
    })
    assert.deepEqual(await service.getActivities({ id: 7 }), [])
  }
})

test('国补和预定活动显示客户与设备规格，并遵守各自字段权限', async () => {
  const DashboardReadService = require('../src/services/dashboard-read.service')
  const activities = [
    {
      id: 'subsidy-1', activity_type: 'subsidy', event_label: '国补申报', icon: 'file',
      customer_name: '张三', model_name: 'iPhone 17', color_name: '白色', memory_size: '256GB',
      occurred_at: '2026-11-27 10:00:00'
    },
    {
      id: 'preorder-1', activity_type: 'preorder', event_label: '新增预定', icon: 'calendar',
      customer_name: '李四', model_name: '18promax', color_name: '红色', memory_size: '128GB',
      occurred_at: '2026-11-27 09:00:00'
    }
  ]
  const hiddenByModule = new Map()
  const service = new DashboardReadService({
    connected: () => true,
    permissionCheck: async () => true,
    getFields: async (_userId, moduleKey) => ({ hiddenFields: hiddenByModule.get(moduleKey) || [] }),
    repository: Object.fromEntries([
      'phoneSaleActivities', 'accessorySaleActivities', 'inventoryActivities', 'repairActivities'
    ].map(method => [method, async () => [[]]]).concat([
      ['subsidyActivities', async () => [activities.slice(0, 1)]],
      ['preorderActivities', async () => [activities.slice(1)]]
    ]))
  })

  const visible = await service.getActivities({ id: 7 })
  assert.equal(visible.find(item => item.type === 'subsidy').description, '张三国补iPhone 17 白色 256GB 一台')
  assert.equal(visible.find(item => item.type === 'preorder').description, '李四预定了一台18promax 红色 128GB')

  hiddenByModule.set('subsidy_subsidyview', ['customer_info.customer_name', 'device_info.color'])
  hiddenByModule.set('preorders_preordersview', ['customer_info.customer_name', 'product_info.memory_size'])
  const masked = await service.getActivities({ id: 7 })
  assert.equal(masked.find(item => item.type === 'subsidy').description, '客户国补iPhone 17 256GB 一台')
  assert.equal(masked.find(item => item.type === 'preorder').description, '客户预定了一台18promax 红色')
})

test('月度卡片绑定会话本人，字段隐藏时跳过对应服务', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const DashboardReadService = require('../src/services/dashboard-read.service')
  const hiddenFields = []
  const calls = []
  const sales = { phone_count: 2, new_count: 2, used_count: 0, allocation_count: 1, transfer_count: 3, goods_quantity: 8 }
  const attendance = { leave_days: 1, unpaid_leave_days: 0.5, overtime_hours: 3 }
  const readService = new DashboardReadService({
    connected: () => true,
    now: () => '2026-11-26',
    getFields: async () => ({ hiddenFields }),
    repository: {
      async monthlySales(...args) {
        calls.push(args)
        return [[Object.fromEntries(Object.entries(sales).map(([key, value]) => [key, String(value)]))]]
      }
    },
    salary: { async calculateSalary(...args) { calls.push(args); return { commission_amount: 123.45, base_salary: 9999 } } },
    attendance: {
      async getMonthlyActivityWithAmounts(...args) {
        calls.push(args)
        return { activity: attendance, amounts: { leave_deduction: 150, overtime_pay: 90, count: 2 } }
      },
      async getMonthlyActivity(...args) {
        calls.push(['activity-only', ...args])
        return attendance
      }
    }
  })
  const controller = new DashboardController({ readService })
  const req = { user: { id: 7 }, query: { employee_id: 99 } }
  const response = createResponse()
  await controller.getMyMonthlyStats(req, response)
  assert.deepEqual(response.body.data, {
    sales: { ...sales, commission: 123.45 },
    attendance: { ...attendance, leave_deduction: 150, overtime_pay: 90 }
  })
  assert.deepEqual(calls, [[7, '2026-11-01', '2026-11-27'], [7, '2026-11-01', '2026-11-30'], [7, '2026-11-01', '2026-11-30']])

  calls.length = 0
  hiddenFields.push('stats.monthly_attendance_amounts')
  await controller.getMyMonthlyStats(req, response)
  assert.deepEqual(response.body.data.attendance, attendance)
  assert.deepEqual(calls.filter(([type]) => type === 'activity-only'), [['activity-only', 7, '2026-11-01', '2026-11-30']])

  calls.length = 0
  hiddenFields.push('stats.monthly_commission', 'stats.monthly_attendance')
  await controller.getMyMonthlyStats(req, response)
  assert.deepEqual(response.body.data, { sales: { ...sales, commission: null }, attendance: null })
  assert.deepEqual(calls, [[7, '2026-11-01', '2026-11-27']])

  calls.length = 0
  hiddenFields.push('stats.monthly_sales')
  await controller.getMyMonthlyStats(req, response)
  assert.deepEqual(response.body.data, { sales: null, attendance: null })
  assert.deepEqual(calls, [])
})

test('仪表盘 controller 保持 warning 参数、成功数据和错误响应', async () => {
  const DashboardController = require('../src/controllers/dashboard.controller')
  const calls = []
  const controller = new DashboardController({
    dashboardService: {
      async getComprehensiveWarnings(filters, actor) {
        calls.push(['comprehensive', filters, actor])
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
  const actor = { id: 7 }
  await controller.getComprehensiveWarnings({ query: { phone_threshold: '4', page_size: '12' }, user: actor }, success)
  assert.deepEqual(calls[0], ['comprehensive', { phone_threshold: '4', page_size: '12' }, actor])
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
