'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const CustomerController = require('../src/controllers/customer.controller')

const response = {
  success(res, data, message, status, extra) {
    res.body = { success: true, data, message, status, ...extra }
    return res
  },
  badRequest(res, message) {
    res.statusCode = 400
    res.body = { success: false, message }
    return res
  },
  notFound(res, message) {
    res.statusCode = 404
    res.body = { success: false, message }
    return res
  },
  serverError(res, message, error) {
    res.statusCode = 500
    res.body = { success: false, message, error }
    return res
  },
  created(res, message, data) {
    res.statusCode = 201
    res.body = { success: true, message, data }
    return res
  },
  error(res, message, status) {
    res.statusCode = status
    res.body = { success: false, message }
    return res
  }
}

const makeResponse = () => ({})

test('客户搜索保留手机号精确匹配、短关键词空结果和分页契约', async () => {
  const phoneLookups = []
  const searchCalls = []
  const controller = new CustomerController({
    repository: { async findByPhone(phone) { phoneLookups.push(phone); return { id: 3 } } },
    searchCustomers: async options => {
      searchCalls.push(options)
      return { records: [{ id: 4 }], pagination: { page: 2, page_size: 5, total: 6 } }
    },
    response
  })

  const byPhone = makeResponse()
  await controller.search({ query: { phone: '13800000000' } }, byPhone)
  assert.deepEqual(phoneLookups, ['13800000000'])
  assert.deepEqual(byPhone.body.data, [{ id: 3 }])

  const shortKeyword = makeResponse()
  await controller.search({ query: { keyword: 'a' } }, shortKeyword)
  assert.deepEqual(shortKeyword.body.data, [])
  assert.equal(searchCalls.length, 0)

  const searched = makeResponse()
  await controller.search({ query: { keyword: '测试', page: '2', page_size: '5' } }, searched)
  assert.deepEqual(searchCalls, [{
    keyword: '测试',
    page: '2',
    page_size: '5',
    fields: ['id', 'name', 'phone', 'email', 'apple_id', 'member_number', 'vip_level', 'created_at'],
    search_fields: ['name', 'phone', 'email', 'member_number']
  }])
  assert.deepEqual(searched.body.data, [{ id: 4 }])
  assert.deepEqual(searched.body.pagination, { page: 2, page_size: 5, total: 6 })
  assert.equal(searched.body.message, '搜索客户成功')
})

test('客户积分配置保留读取、范围校验和保存参数契约', async () => {
  const saveCalls = []
  const controller = new CustomerController({
    loadPointsConfig: async () => ({ enabled: true }),
    persistPointsConfig: async config => { saveCalls.push(config); return config },
    response
  })

  const loaded = makeResponse()
  await controller.getPointsConfig({}, loaded)
  assert.deepEqual(loaded.body.data, { enabled: true })

  const missingCondition = makeResponse()
  await controller.savePointsConfig({ body: { enabled: true, include_new: false, include_used: false } }, missingCondition)
  assert.equal(missingCondition.statusCode, 400)
  assert.equal(saveCalls.length, 0)

  const invalidNewRate = makeResponse()
  await controller.savePointsConfig({ body: { include_new: true, new_points_per_100: 101 } }, invalidNewRate)
  assert.equal(invalidNewRate.statusCode, 400)
  assert.equal(invalidNewRate.body.message, '全新积分必须是1到100之间的整数')

  const invalidUsedRate = makeResponse()
  await controller.savePointsConfig({ body: { include_used: true, used_points_per_100: 0 } }, invalidUsedRate)
  assert.equal(invalidUsedRate.statusCode, 400)
  assert.equal(invalidUsedRate.body.message, '二手积分必须是1到100之间的整数')

  const saved = makeResponse()
  await controller.savePointsConfig({
    body: { enabled: false, include_new: true, include_used: true, new_points_per_100: '3', used_points_per_100: '4' }
  }, saved)
  assert.deepEqual(saveCalls, [{
    enabled: false,
    include_new: true,
    include_used: true,
    new_points_per_100: 3,
    used_points_per_100: 4
  }])
  assert.equal(saved.body.message, '积分设置保存成功')
})

test('客户搜索和积分配置路由保留服务端权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  assert.ok(route.includes("router.get('/search', unifiedAuth, requirePermission('customers:view'), customerController.search.bind(customerController))"))
  assert.ok(route.includes("router.get('/points-config', unifiedAuth, requirePermission('customers:view'), customerController.getPointsConfig.bind(customerController))"))
  assert.ok(route.includes("router.put('/points-config', unifiedAuth, requirePermission('customers:manage'), customerController.savePointsConfig.bind(customerController))"))
})

test('客户列表 controller 保留分页上限、规范筛选与查看权限', async () => {
  const calls = []
  const controller = new CustomerController({
    repository: {
      async listCustomers(options) {
        calls.push(options)
        return { customers: [{ id: 3 }], total: 101 }
      }
    },
    response
  })
  const res = makeResponse()
  await controller.list({
    query: {
      page: '2', page_size: '500', customer_type: 'enterprise', status: '',
      search_fields: 'name,phone', search: 'Test', register_date_start: '2026-11-01',
      register_date_end: '2026-11-07', sort_by: 'name', sort_order: 'asc'
    }
  }, res)

  assert.deepEqual(calls, [{
    page: 2,
    page_size: 100,
    sort_by: 'name',
    sort_order: 'asc',
    filters: {
      customer_type: 'enterprise',
      vip_level: undefined,
      gender: undefined,
      city: undefined,
      province: undefined,
      search: 'Test',
      search_fields: 'name,phone',
      register_date_start: '2026-11-01',
      register_date_end: '2026-11-07',
      status: ''
    }
  }])
  assert.deepEqual(res.body.data.pagination, {
    page: 2,
    page_size: 100,
    total: 101,
    total_pages: 2,
    has_next: false,
    has_prev: true
  })

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  assert.ok(route.includes("router.get('/', unifiedAuth, requirePermission('customers:view'), customerController.list.bind(customerController))"))
})

test('customer repository preserves list filters, status semantics, search whitelist and sortable field safety', async () => {
  const CustomerRepository = require('../src/repositories/customer.repository')
  const queries = []
  const repository = new CustomerRepository()
  repository.executeQuery = async (sql, params) => {
    queries.push({ sql, params })
    return queries.length === 1 ? [{ id: 3 }] : [{ total: 1 }]
  }

  const result = await repository.listCustomers({
    page: 2,
    page_size: 10,
    sort_by: 'name; DROP TABLE customers',
    sort_order: 'asc',
    filters: {
      customer_type: 'enterprise',
      vip_level: 'gold',
      gender: 'female',
      city: '杭州',
      province: '浙江',
      search: 'Test',
      search_fields: 'name,phone,unsafe',
      register_date_start: '2026-11-01',
      register_date_end: '2026-11-07',
      status: ''
    }
  })

  assert.deepEqual(result, { customers: [{ id: 3 }], total: 1 })
  assert.deepEqual(queries[0].params, [
    'enterprise', 'gold', 'female', '%杭州%', '%浙江%',
    '2026-11-01 00:00:00', '2026-11-07 23:59:59',
    '%Test%', '%Test%', 10, 10
  ])
  assert.match(queries[0].sql, /ORDER BY c\.id ASC/)
  assert.doesNotMatch(queries[0].sql, /unsafe|DROP TABLE/)
  assert.doesNotMatch(queries[0].sql, /c\.status = \?/)
  assert.match(queries[0].sql, /COALESCE\(sales_total\.total_amount, 0\) as total_spent/)
  assert.deepEqual(queries[1].params, queries[0].params.slice(0, -2))

  queries.length = 0
  await repository.listCustomers({ page: 1, page_size: 20, sort_by: 'id', sort_order: 'desc', filters: {} })
  assert.deepEqual(queries[0].params, [1, 20, 0])
  assert.match(queries[0].sql, /c\.status = \?/)
})

test('customer delete controller retains delete result, not-found and route permission', async () => {
  const deletedIds = []
  const controller = new CustomerController({
    repository: { async delete(id) { deletedIds.push(id); return { affectedRows: 1 } } },
    response
  })
  const res = makeResponse()
  await controller.remove({ params: { id: '15tail' } }, res)
  assert.deepEqual(deletedIds, [15])
  assert.deepEqual(res.body.data, { id: 15, deleted: true })

  const missing = new CustomerController({ repository: { async delete() { return { affectedRows: 0 } } }, response })
  const notFound = makeResponse()
  await missing.remove({ params: { id: '404' } }, notFound)
  assert.equal(notFound.statusCode, 404)

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  assert.ok(route.includes("router.delete('/:id', unifiedAuth, requirePermission('customers:delete'), customerController.remove.bind(customerController))"))
})

test('客户创建 controller 保留字段校验、重复检查、会员号和创建响应', async () => {
  const lookups = []
  const creates = []
  const controller = new CustomerController({
    repository: {
      async findByPhone(phone) { lookups.push(phone); return null },
      async createCustomerProfile(data, memberNumber) {
        creates.push({ data, memberNumber })
        return { id: 6, ...data, member_number: memberNumber }
      }
    },
    createMemberNumber: async () => 'TF000006',
    response,
    logger: { error() {} }
  })

  const missing = makeResponse()
  await controller.create({ body: { name: '客户' } }, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(lookups.length, 0)

  const badPhone = makeResponse()
  await controller.create({ body: { name: '客户', phone: '123' } }, badPhone)
  assert.equal(badPhone.statusCode, 400)

  const invalidApple = makeResponse()
  await controller.create({ body: { name: '客户', phone: '13800000000', apple_id: '中文账号' } }, invalidApple)
  assert.equal(invalidApple.statusCode, 400)
  assert.equal(creates.length, 0)

  const created = makeResponse()
  await controller.create({ body: {
    name: '客户', phone: '13800000000', email: 'a@example.com', apple_id: 'apple@example.com',
    address: '杭州', customer_type: 'enterprise'
  } }, created)
  assert.deepEqual(lookups, ['13800000000', '13800000000'])
  assert.deepEqual(creates, [{
    memberNumber: 'TF000006',
    data: {
      name: '客户', gender: null, phone: '13800000000', email: 'a@example.com', birthday: null,
      id_card: null, address: '杭州', city: '', province: '', customer_type: 'enterprise',
      remarks: '', wechat: null, qq: null, apple_id: 'apple@example.com'
    }
  }])
  assert.equal(created.statusCode, 201)
  assert.equal(created.body.data.member_number, 'TF000006')

  const duplicate = new CustomerController({
    repository: { async findByPhone() { return { id: 4 } } },
    createMemberNumber: async () => assert.fail('duplicate must not allocate a member number'),
    response
  })
  const duplicateResponse = makeResponse()
  await duplicate.create({ body: { name: '客户', phone: '13800000000' } }, duplicateResponse)
  assert.equal(duplicateResponse.statusCode, 400)
  assert.equal(duplicateResponse.body.message, '手机号已存在')
})

test('客户更新 controller 保留格式校验、动态字段过滤、密码哈希和重复手机号错误', async () => {
  const calls = []
  const controller = new CustomerController({
    repository: {
      async findCustomerById(id) {
        calls.push(['find', id])
        return calls.some(call => call[0] === 'update') ? { id, phone: '13800000000', name: '更新后' } : { id, phone: '13800000000' }
      },
      async findByPhone(phone) { calls.push(['phone', phone]); return null },
      async getCustomerColumns() {
        return new Set(['name', 'phone', 'balance', 'points', 'password', 'updated_at'])
      },
      async update(id, data) { calls.push(['update', id, data]); return { affectedRows: 1 } }
    },
    passwordHasher: async (password, rounds) => `${rounds}:${password}`,
    response,
    logger: { error() {} }
  })

  const shortPassword = makeResponse()
  await controller.update({ params: { id: '8' }, body: { password: 'short' } }, shortPassword)
  assert.equal(shortPassword.statusCode, 400)

  const res = makeResponse()
  await controller.update({ params: { id: '8' }, body: {
    name: '更新后', phone: '13900000000', balance: '12.5', points: '7', password: 'long-enough',
    tags: ['vip'], blacklist: false
  } }, res)
  const updateCall = calls.find(call => call[0] === 'update')
  assert.equal(updateCall[1], 8)
  assert.equal(updateCall[2].password, '10:long-enough')
  assert.equal(updateCall[2].balance, 12.5)
  assert.equal(updateCall[2].points, 7)
  assert.equal(updateCall[2].blacklist, undefined)
  assert.equal(updateCall[2].tags, undefined)
  assert.ok(updateCall[2].updated_at instanceof Date)
  assert.equal(res.body.message, '客户信息更新成功')

  const duplicate = new CustomerController({
    repository: {
      async findCustomerById() { return { id: 8, phone: '13800000000' } },
      async findByPhone() { return { id: 9 } }
    },
    response
  })
  const duplicateResponse = makeResponse()
  await duplicate.update({ params: { id: '8' }, body: { phone: '13900000000' } }, duplicateResponse)
  assert.equal(duplicateResponse.statusCode, 400)
  assert.equal(duplicateResponse.body.message, '手机号已存在')
})

test('客户创建与更新 route 保留原服务端认证和权限链', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  assert.ok(route.includes("router.post('/', unifiedAuth, requireCustomerCreatePermissionForBusinessFlow, customerController.create.bind(customerController))"))
  assert.ok(route.includes("router.put('/:id', unifiedAuth, requirePermission('customers:edit'), customerController.update.bind(customerController))"))
  assert.ok(route.includes("router.post('/:id/purchases', unifiedAuth, requirePermission('customers:edit'), customerController.rejectPurchaseCreation.bind(customerController))"))
  const res = makeResponse()
  const controller = new CustomerController({ response })
  controller.rejectPurchaseCreation({}, res)
  assert.equal(res.statusCode, 501)
  assert.equal(res.body.message, '消费记录请通过销售交易接口创建')
})

test('customer repository creates explicit profile fields and reads only schema column names', async () => {
  const CustomerRepository = require('../src/repositories/customer.repository')
  const calls = []
  const repository = new CustomerRepository()
  repository.executePrepared = async (sql, params) => {
    calls.push({ sql, params })
    return calls.length === 1 ? [{ insertId: 6 }] : [[{ id: 6, name: '客户' }]]
  }
  repository.executeQuery = async sql => {
    assert.equal(sql, 'SHOW COLUMNS FROM customers')
    return [{ Field: 'id' }, { Field: 'name' }, { Extra: 'ignored' }]
  }

  assert.deepEqual(await repository.createCustomerProfile({
    name: '客户', gender: null, phone: '13800000000', email: null, birthday: null, id_card: null,
    address: '', city: '', province: '', customer_type: 'individual', remarks: '', wechat: null,
    qq: null, apple_id: null
  }, 'TF000006'), { id: 6, name: '客户' })
  assert.deepEqual(calls[0].params, [
    '客户', null, '13800000000', null, null, null, '', '', '', 'individual', '', null, null, null, 'TF000006'
  ])
  assert.match(calls[0].sql, /status, member_number, created_at, updated_at/)
  assert.deepEqual(await repository.getCustomerColumns(), new Set(['id', 'name']))
})

test('客户详情和 VIP 更新保留字段、白名单、404 与路由权限', async () => {
  const calls = []
  const controller = new CustomerController({
    repository: {
      async findCustomerById(id) { calls.push(['findCustomerById', id]); return { id, name: '客户' } },
      async updateVipLevel(id, level) { calls.push(['updateVipLevel', id, level]); return { id, vip_level: level } }
    },
    response
  })
  const detail = makeResponse()
  await controller.getById({ params: { id: '12tail' } }, detail)
  assert.deepEqual(calls[0], ['findCustomerById', 12])
  assert.deepEqual(detail.body.data, { id: 12, name: '客户' })

  const invalid = makeResponse()
  await controller.updateVipLevel({ params: { id: '12' }, body: { vip_level: 'diamond' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(calls, [['findCustomerById', 12]])

  const updated = makeResponse()
  await controller.updateVipLevel({ params: { id: '12' }, body: { vip_level: 'gold' } }, updated)
  assert.deepEqual(calls[1], ['updateVipLevel', '12', 'gold'])
  assert.equal(updated.body.message, 'VIP等级更新成功')

  const missing = new CustomerController({
    repository: { async updateVipLevel() { return null } },
    response
  })
  const notFound = makeResponse()
  await missing.updateVipLevel({ params: { id: '404' }, body: { vip_level: 'normal' } }, notFound)
  assert.equal(notFound.statusCode, 404)

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  assert.ok(route.includes("router.get('/:id', unifiedAuth, requirePermission('customers:view'), customerController.getById.bind(customerController))"))
  assert.ok(route.includes("router.patch('/:id/vip-level', unifiedAuth, requirePermission('customers:manage'), customerController.updateVipLevel.bind(customerController))"))
})

test('客户消费记录 controller 保留页码上限、字段格式和客户查看权限', async () => {
  const calls = []
  const controller = new CustomerController({
    repository: {
      async getCustomerPurchases(id, filters) {
        calls.push({ id, filters })
        return {
          total: 21,
          purchases: [{
            phone_id: 9,
            imei: 'imei',
            brand: null,
            model: 'Phone X',
            color: '黑色',
            memory: null,
            purchase_cost: '100',
            sale_price: '150',
            is_new: 1,
            salesperson_name: null,
            sale_created_at: '2026-11-01 10:00:00'
          }]
        }
      }
    },
    response
  })
  const res = makeResponse()
  await controller.getPurchases({
    params: { id: '12tail' },
    query: { page: '3', page_size: '500', start_date: '2026-11-01', end_date: '2026-11-07' }
  }, res)

  assert.deepEqual(calls, [{
    id: 12,
    filters: { start_date: '2026-11-01', end_date: '2026-11-07', page_size: 100, offset: 200 }
  }])
  assert.deepEqual(res.body.data, {
    purchases: [{
      id: 9,
      phone_id: 9,
      imei: 'imei',
      serial_number: undefined,
      brand: '-',
      model: 'Phone X',
      color: '黑色',
      memory: '-',
      purchase_cost: 100,
      sale_price: 150,
      profit: 50,
      sale_time: undefined,
      is_new: '全新',
      payment_method: '-',
      salesperson: '-',
      created_at: '2026-11-01 10:00:00'
    }],
    pagination: {
      page: 3,
      page_size: 100,
      total: 21,
      total_pages: 1,
      has_next: false,
      has_prev: true
    }
  })

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  assert.ok(route.includes("router.get('/:id/purchases', unifiedAuth, requirePermission('customers:view'), customerController.getPurchases.bind(customerController))"))
})

test('客户消费记录 repository binds date filters and uses consistent sale count filters', async () => {
  const CustomerRepository = require('../src/repositories/customer.repository')
  const queries = []
  const repository = new CustomerRepository()
  repository.executeQuery = async (sql, params) => {
    queries.push({ sql, params })
    return queries.length === 1
      ? [{ phone_id: 9 }]
      : [{ total: '1' }]
  }

  const result = await repository.getCustomerPurchases(12, {
    start_date: '2026-11-01',
    end_date: '2026-11-07',
    page_size: 20,
    offset: 40
  })

  assert.deepEqual(result, { purchases: [{ phone_id: 9 }], total: '1' })
  assert.deepEqual(queries.map(query => query.params), [
    [12, '2026-11-01 00:00:00', '2026-11-07 23:59:59', 20, 40],
    [12, '2026-11-01 00:00:00', '2026-11-07 23:59:59']
  ])
  assert.match(queries[0].sql, /ORDER BY s\.sale_time DESC, s\.id DESC/)
  assert.match(queries[0].sql, /LIMIT \? OFFSET \?/)
  assert.match(queries[1].sql, /INNER JOIN phones p ON s\.phone_id = p\.id/)
})

test('customer repository VIP update binds level and ID and reads only public response fields', async () => {
  const CustomerRepository = require('../src/repositories/customer.repository')
  const queries = []
  const repository = new CustomerRepository()
  repository.executeQuery = async (sql, params) => {
    queries.push({ sql, params })
    return queries.length === 1
      ? [{ affectedRows: 1 }]
      : [{ id: 12, name: '客户', vip_level: 'gold' }]
  }

  const customer = await repository.updateVipLevel('12', 'gold')

  assert.deepEqual(customer, { id: 12, name: '客户', vip_level: 'gold' })
  assert.deepEqual(queries.map(query => query.params), [['gold', '12'], ['12']])
  assert.match(queries[0].sql, /WHERE id = \? AND status = 1/)
  assert.match(queries[1].sql, /SELECT id, name, phone, customer_type, vip_level, status, updated_at/)
})

test('customer statistics repository preserves filters, status semantics and canonical fields', async () => {
  const CustomerRepository = require('../src/repositories/customer.repository')
  const queries = []
  const repository = new CustomerRepository()
  repository.executeQuery = async (sql, params) => {
    queries.push({ sql, params })
    const values = [
      [{ total: 12 }],
      [{ active: 4 }],
      [{ new_customers: 2 }],
      [{ premium: 3 }]
    ]
    return values[queries.length - 1]
  }

  const stats = await repository.getStatistics({
    customer_type: 'individual',
    search: 'Lin',
    search_fields: 'name,unsafe,phone',
    status: ''
  })

  assert.deepEqual(stats, {
    total_customers: 12,
    active_customers: 4,
    new_customers: 2,
    premium_customers: 3
  })
  assert.equal(queries.length, 4)
  for (const query of queries) {
    assert.deepEqual(query.params, ['individual', '%Lin%', '%Lin%'])
    assert.match(query.sql, /c\.name LIKE \? OR c\.phone LIKE \?/)
    assert.doesNotMatch(query.sql, /unsafe/)
    assert.doesNotMatch(query.sql, /c\.status = \?/)
  }

  queries.length = 0
  repository.executeQuery = async (sql, params) => {
    queries.push({ sql, params })
    return [{ total: 1, active: 0, new_customers: 0, premium: 0 }]
  }
  await repository.getStatistics()
  assert.deepEqual(queries[0].params, [1])
  assert.match(queries[0].sql, /WHERE c\.status = \?/)
})

test('customer statistics overview binds trimmed dates and maps demographic rows', async () => {
  const CustomerRepository = require('../src/repositories/customer.repository')
  const queries = []
  const repository = new CustomerRepository()
  repository.executeQuery = async (sql, params) => {
    queries.push({ sql, params })
    if (queries.length === 1) return [{ total: '8', individuals: '5', business: '3', gold_vip: '2', male: '4', total_revenue: '900', avg_revenue: '112.5' }]
    if (queries.length === 2) return [{ city: 'unknown', count: '2' }, { city: '杭州', count: '6' }]
    return [{ province: '浙江', count: '8' }]
  }

  const result = await repository.getStatisticsOverview({ start_date: ' 2026-01-02 ', end_date: '2026-01-31' })

  assert.deepEqual(result, {
    total: 8,
    individuals: 5,
    business: 3,
    by_vip_level: { normal: 0, silver: 0, gold: 2, platinum: 0 },
    by_gender: { male: 4, female: 0, unknown: 0 },
    blacklisted: 0,
    total_revenue: 900,
    avg_revenue: 112.5,
    new_customers: 0,
    by_city: { unknown: 2, 杭州: 6 },
    by_province: { 浙江: 8 }
  })
  assert.equal(queries.length, 3)
  for (const query of queries) {
    assert.deepEqual(query.params, ['2026-01-02 00:00:00', '2026-01-31 23:59:59'])
    assert.match(query.sql, /c\.status = 1/)
  }
})

test('customer statistics routes keep view permission and delegate to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/customers.js'), 'utf8')
  assert.ok(route.includes("router.get('/stats', unifiedAuth, requirePermission('customers:view'), customerController.getStatistics.bind(customerController))"))
  assert.ok(route.includes("router.get('/stats/overview', unifiedAuth, requirePermission('customers:view'), customerController.getStatisticsOverview.bind(customerController))"))
})
