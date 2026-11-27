'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { requirePermission } = require('../src/middleware/unified-auth')
const PhoneMutationAccessService = require('../src/services/phone-mutation-access.service')
const { hasGoodsPermission } = require('../src/utils/goods-permission')
const CustomerMutationAccessService = require('../src/services/customer-mutation-access.service')

const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
const check = async (actor, permission) => {
  let allowed = false
  await requirePermission(permission)({ user: actor }, response(), () => { allowed = true })
  return allowed
}
const actor = (...permissions) => ({ id: 7, store_ids: [1, 2], permissions })

test('工资路由放行后撤权或复核故障，列表和详情均在读取字段与工资前拒绝', async () => {
  const Controller = require('../src/controllers/salary-record.controller').constructor
  const router = require('../src/routes/salary-records')
  for (const path of ['/', '/:id']) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods.get).route
    const req = { user: actor('salary-records:view'), query: {}, params: { id: 1 } }
    let passed = false
    await route.stack[0].handle(req, response(), () => { passed = true })
    assert.equal(passed, true)
    for (const failure of ['revoked', 'unavailable']) {
      const controller = new Controller({ service: {
        async getSalaryRecords() { assert.fail('不得读取工资列表') },
        async getSalaryRecordById() { assert.fail('不得读取工资详情') }
      } })
      controller.fieldContext = async () => assert.fail('不得继续读取字段配置')
      let resolveScope
      controller.getSalaryScope = () => new Promise(resolve => { resolveScope = resolve })
      const res = response()
      const pending = controller[path === '/' ? 'getSalaryRecords' : 'getSalaryRecordById'](req, res)
      req.user.permissions = []
      resolveScope(failure === 'revoked' ? { canView: false, isAdmin: false } : null)
      await pending
      assert.equal(res.statusCode, 403)
      assert.equal(res.body.data, undefined)
    }
  }
})

test('工资本人查询强制自身已发范围，团队查询保留全量和指定员工过滤', async () => {
  const Controller = require('../src/controllers/salary-record.controller').constructor
  for (const [scope, query, expected] of [
    [{ canView: true, isAdmin: false }, { employee_id: 8, status: 'pending' }, { employee_id: 7, status: 'paid' }],
    [{ canView: true, isAdmin: true }, {}, {}],
    [{ canView: true, isAdmin: true }, { employee_id: 8, status: 'pending' }, { employee_id: 8, status: 'pending' }]
  ]) {
    const controller = new Controller({ service: { async getSalaryRecords(filters) {
      assert.deepEqual(filters, expected)
      return { records: [] }
    } } })
    controller.getSalaryScope = async () => scope
    controller.fieldContext = async () => value => value
    const res = response()
    await controller.getSalaryRecords({ user: actor(), query }, res)
    assert.equal(res.statusCode, 200)
  }
})

test('启用工资模板仅允许模板查看或工资计算，登录、母页面和本人工资不能替代', async () => {
  const route = require('../src/routes/salary-templates').stack.find(layer => layer.route?.path === '/active').route
  for (const permission of ['customers:view', 'salary:view', 'salary:manage', 'employees:edit', 'salary_mysalaryview:view',
    'salary-templates:menu_view', 'salary-templates:view', 'salary-records:view']) {
    const res = response()
    let passed = false
    await route.stack[0].handle({ user: actor(permission) }, res, () => { passed = true })
    assert.equal(passed, ['salary-templates:view', 'salary-records:view'].includes(permission), permission)
    if (!passed) assert.equal(res.statusCode, 403)
  }
})

test('员工及旧用户创建编辑均独立检查工资模板绑定，包括null清除；普通资料不受影响', async () => {
  const EmployeeService = require('../src/services/employee-mutation.service')
  const UserService = require('../src/services/user-mutation.service')
  for (const legacy of [false, true]) {
    const writes = []
    const repository = legacy ? {
      async findByUsername() { return [[]] },
      async findById() { return [[{ id: 8 }]] },
      async create(_db, values) { writes.push(values); return [{ insertId: 8 }] },
      async update(_db, ...args) { writes.push(args) },
      async selectPublicUser() { return { id: 8 } }
    } : {
      async findByUsername() { return null }, async findId() { return { id: 8 } },
      async insertEmployee(input) { writes.push(input) },
      async findCreatedEmployee() { return { id: 8 } },
      async findUpdatedEmployee() { return { id: 8 } },
      async updateEmployee(...args) { writes.push(args) }
    }
    const connection = { async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }
    const service = legacy
      ? new UserService({ permissionCheck: check, repository, database: () => ({ async getConnection() { return connection } }), passwordHasher: async () => 'hashed' })
      : new EmployeeService({ permissionCheck: check, repository, hashPassword: async () => 'hashed' })
    service.roleAssignment.assertAccountAccess = async () => {}
    const create = (data, user) => legacy ? service.create(data, user) : service.createEmployee(data, user)
    const update = (data, user) => legacy ? service.update(8, data, user) : service.updateEmployee(8, data, user)
    const ordinary = actor(legacy ? 'users:edit' : 'employees:edit')
    for (const salary_template_id of [3, null]) {
      await assert.rejects(create({ username: 'isolated', name: '员工', password: 'isolated-test-value', salary_template_id }, ordinary), { statusCode: 403 })
      await assert.rejects(update({ salary_template_id }, ordinary), { statusCode: 403 })
    }
    assert.equal(writes.length, 0)
    await update({ name: '正常修改' }, ordinary)
    const authorized = actor('salary-templates:edit')
    await create({ username: 'isolated', name: '员工', password: 'isolated-test-value', salary_template_id: 3 }, authorized)
    await update({ salary_template_id: null }, authorized)
    assert.equal(writes.length, 3)
  }
})

test('客户新增和编辑互不替代，业务查看或写入不能绕过客户路由', async () => {
  const router = require('../src/routes/customers')
  const guard = (method, path) => router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack[1].handle
  const invoke = async (middleware, permissions) => {
    let allowed = false
    const res = response()
    await middleware({ user: actor(...permissions) }, res, () => { allowed = true })
    return { allowed, status: res.statusCode }
  }
  for (const permission of ['sales:view', 'sales:sell', 'sales:create', 'sales:edit', 'inventory:edit', 'query:edit', 'customers:view', 'customers:menu_view', 'customers:manage']) {
    assert.deepEqual(await invoke(guard('post', '/'), [permission]), { allowed: false, status: 403 }, permission)
  }
  assert.equal((await invoke(guard('post', '/'), ['customers:create'])).allowed, true)
  assert.equal((await invoke(guard('get', '/'), ['customers:create'])).status, 403)
  assert.equal((await invoke(guard('put', '/:id'), ['customers:create'])).status, 403)
  assert.equal((await invoke(guard('put', '/:id'), ['customers:edit'])).allowed, true)
  assert.equal((await invoke(guard('post', '/'), ['customers:edit'])).status, 403)
})

test('业务客户候选检索不要求客户管理查看，也不授予客户新增', async () => {
  const router = require('../src/routes/sales')
  const guard = router.stack.find(layer => layer.route?.path === '/customers').route.stack[1].handle
  for (const permission of ['sales:view', 'sales:sell', 'inventory:sell', 'sales:wholesale', 'sales:proxy-transfer', 'query:edit', 'accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift', 'preorders:create', 'preorders:edit']) {
    let allowed = false
    await guard({ user: actor(permission) }, response(), () => { allowed = true })
    assert.equal(allowed, true, permission)
    assert.equal(await check(actor(permission), 'customers:create'), false)
    assert.equal(await check(actor(permission), 'customers:view'), false)
  }
  const denied = response()
  await guard({ user: actor('sales:menu_view') }, denied, () => assert.fail('菜单不能授予客户检索'))
  assert.equal(denied.statusCode, 403)
})

test('真实销售客户解析只关联已有资料；新增和变化姓名或Apple ID分别鉴权', async () => {
  const SalesPhoneService = require('../src/services/sales-phone.service')
  const CustomerAccess = require('../src/services/customer-mutation-access.service')
  let existing = { id: 9, name: '原姓名', apple_id: 'old@example.test' }
  const writes = []
  const service = new SalesPhoneService({
    repository: {
      async findCustomerByPhone() { return existing },
      async updateCustomer(_db, input) { writes.push(['edit', input]) },
      async createCustomer(_db, input) { writes.push(['create', input]); return 10 }
    },
    customerAccess: new CustomerAccess({ permissionCheck: check }),
    createMemberNumber: async () => 'MEMBER-ISOLATED'
  })
  const saleOnly = actor('sales:sell')
  assert.equal(await service.resolveCustomer({}, { name: '原姓名', phone: '13800000000' }, saleOnly), 9)
  assert.equal(writes.length, 0)
  await assert.rejects(service.resolveCustomer({}, { name: '新姓名', phone: '13800000000' }, saleOnly), { statusCode: 403 })
  await assert.rejects(service.resolveCustomer({}, { name: '原姓名', phone: '13800000000', apple_id: 'new@example.test' }, saleOnly), { statusCode: 403 })
  await service.resolveCustomer({}, { name: '新姓名', phone: '13800000000' }, actor('sales:sell', 'customers:edit'))
  assert.equal(writes.length, 1)
  existing = null
  await assert.rejects(service.resolveCustomer({}, { name: '新客户', phone: '13800000000' }, saleOnly), { statusCode: 403 })
  await assert.rejects(service.resolveCustomer({}, { name: '新客户', phone: '13800000000' }, actor('customers:edit')), { statusCode: 403 })
  assert.equal(writes.length, 1)
  assert.equal(await service.resolveCustomer({}, { name: '新客户', phone: '13800000000' }, actor('sales:sell', 'customers:create')), 10)
  assert.equal(writes[1][0], 'create')
})

test('快速出库内部新建和改名不能绕过客户权限，失败回滚且不写客户', async () => {
  const InventoryService = require('../src/services/inventory.service')
  for (const existing of [null, { id: 9, name: '原姓名' }]) {
    const events = []
    const connection = {
      async beginTransaction() { events.push('begin') },
      async rollback() { events.push('rollback') },
      async commit() { assert.fail('不能提交') }
    }
    const service = new InventoryService({
      customerAccess: new CustomerMutationAccessService({ permissionCheck: check }),
      repository: {
        async withConnection(run) { try { return await run(connection) } finally { events.push('release') } },
        async validateQuickSaleReferences() { return true },
        async findCustomer() { return existing },
        async createCustomer() { assert.fail('不能新增客户') },
        async updateCustomer() { assert.fail('不能修改客户') }
      },
      prepareInvoiceNumberTransaction: async () => {},
      validateImei: () => ({ valid: true, normalizedImei: '123456789012345', normalizedSerialNumber: 'TESTSERIAL' })
    })
    await assert.rejects(service.quickSale({
      brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, supplier_id: 5, store_id: 1,
      imei: '123456789012345', serial_number: 'TESTSERIAL', purchase_cost: 80, sale_price: 100,
      customer_name: '新姓名', customer_phone: '13800000000', sale_operator_id: 7, payment_method: 'cash'
    }, actor('inventory:sell')), { statusCode: 403 })
    assert.deepEqual(events, ['begin', 'rollback', 'release'])
  }
})

test('设备编辑内部修改客户先检查客户编辑，无权时设备更新也回滚', async () => {
  const PhoneUpdateService = require('../src/services/phone-update.service')
  let phoneUpdated = false
  const events = []
  const connection = {
    async execute() { return [[]] },
    async beginTransaction() { events.push('begin') },
    async rollback() { phoneUpdated = false; events.push('rollback') },
    async commit() { assert.fail('不能提交') }
  }
  const service = new PhoneUpdateService({
    customerAccess: new CustomerMutationAccessService({ permissionCheck: check }),
    repository: {
      async withConnection(run) { try { return await run(connection) } finally { events.push('release') } },
      async getPhoneForUpdate() { return { id: 11, status: 'sold', brand_id: 1, model_id: 2, color_id: 3, memory_id: 4,
        store_id: 1, imei: '123456789012345', serial_number: 'TESTSERIAL', is_new: 1 } },
      async findDuplicateImei() { return [] },
      async lockPhoneStatus() { return { status: 'sold' } },
      async updatePhone() { phoneUpdated = true },
      async findCustomerById() { return { id: 9, name: '原姓名', phone: '13800000000' } },
      async updateCustomer() { assert.fail('不能修改客户') }
    },
    access: new PhoneMutationAccessService({ permissionCheck: check, fields: () => ({ async getDeniedWrite() { return null } }) })
  })
  await assert.rejects(service.update({ params: { id: 11 }, user: actor('query:edit'),
    body: { customer_id: 9, customer_phone: '13800000000', customer_name: '新姓名' } }), { statusCode: 403 })
  assert.equal(phoneUpdated, false)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('真实统一鉴权区分菜单、页面、本人数据及管理动作', async () => {
  for (const module of ['stores', 'users', 'query', 'customers', 'preorders', 'price-list', 'sync-logs', 'marketing', 'git', 'backup', 'dashboard', 'system']) {
    const user = actor(`${module}:menu_view`)
    assert.equal(await check(user, `${module}:view`), false, module)
  }
  assert.equal(await check(actor('employees_employeesview:view'), 'users:view'), false)
  assert.equal(await check(actor('salary_mysalaryview:view'), 'salary:view'), false)
  assert.equal(await check(actor('salary_mysalaryview:view'), 'salary-records:view'), false)
  for (const module of ['customers_customersview', 'salary_salaryview', 'h5_admin_h5adminview']) {
    assert.equal(await check(actor(`${module}:manage`), 'permissions:admin'), false)
  }
  for (const action of ['create', 'edit', 'delete', 'approve', 'pay']) {
    assert.equal(await check(actor(`salary_salaryview:${action}`), `salary-records:${action}`), false)
  }
})

test('商品档案新增、入库、销售及摘要互不代替', async () => {
  const catalog = actor('accessories_accessoriesview:create')
  assert.equal(await check(catalog, 'accessories:create'), true)
  assert.equal(await check(catalog, 'accessories:stock-in'), false)
  assert.equal(await hasGoodsPermission(catalog, 'create', check), false)
  for (const action of ['stock-in', 'sell']) {
    const user = actor(`accessories_accessoriesview:${action}`)
    assert.equal(await check(user, `accessories:${action}`), true)
    assert.equal(await check(user, 'accessories:create'), false)
  }
  for (const permission of ['dashboard_dashboardview:goods-warning', 'payments_supplierphonepaymentsview:return-check']) {
    assert.equal(await check(actor(permission), 'accessories:view'), false)
  }
})

test('考勤团队查看加本人申请不能替他人新增，明确团队新增才能创建他人记录', async t => {
  const Controller = require('../src/controllers/attendance.controller').constructor
  const service = require('../src/services/attendance.service')
  const writes = []
  t.mock.method(service, 'createAttendanceRecord', async input => { writes.push(input); return input })
  const controller = new Controller({ permissionCheck: check })
  controller.getAttendanceScope = async () => ({ canView: true, isAdmin: true })
  const own = actor('attendance_attendanceview:view', 'attendance_myattendanceview:create')
  assert.equal(await check(own, 'attendance:create'), true)
  const denied = response()
  await controller.createAttendanceRecord({ user: own, body: { employee_id: 8 } }, denied)
  assert.equal(denied.statusCode, 403)
  assert.equal(writes.length, 0)
  const self = response()
  await controller.createAttendanceRecord({ user: own, body: { employee_id: 7 } }, self)
  assert.equal(self.statusCode, 201)
  assert.equal(writes[0].employee_id, 7)
  const team = response()
  await controller.createAttendanceRecord({ user: actor('attendance_attendanceview:view', 'attendance_attendanceview:create'), body: { employee_id: 8 } }, team)
  assert.equal(team.statusCode, 201)
  assert.equal(writes[1].employee_id, 8)
  const approved = response()
  await controller.createAttendanceRecord({ user: own, body: { employee_id: 7, status: 'approved' } }, approved)
  assert.equal(approved.statusCode, 403)
  assert.equal(writes.length, 2)
})

test('员工编辑不能修改真实角色，也不能修改权限管理员账户', async () => {
  const EmployeeMutationService = require('../src/services/employee-mutation.service')
  const service = new EmployeeMutationService({ permissionCheck: check, repository: {
    async findId() { return { id: 8 } },
    async updateEmployee() { assert.fail('禁止写入') }
  } })
  await assert.rejects(service.updateEmployee(8, { role_ids: [1], name: '员工' }, actor('employees_employeesview:edit')), { statusCode: 403 })
  service.roleAssignment.permissionCheck = async (user, permission) => user.id === 8 && permission === 'permissions:admin'
  await assert.rejects(service.updateEmployee(8, { password: 'isolated-test-value' }, actor('employees_employeesview:edit')), { statusCode: 403 })
})

test('手机通用写入核验原状态、原门店、目标门店及被隐藏字段', async () => {
  const fields = () => ({ async getDeniedWrite(_id, body, map) { return body.purchase_cost !== undefined ? map.purchase_cost : null } })
  const access = new PhoneMutationAccessService({ permissionCheck: check, fields })
  const phone = { store_id: 1, status: 'in_stock', remarks: '原备注', purchase_cost: 10 }
  const inventory = actor('inventory_inventoryview:edit', 'inventory_inventoryview:delete')
  await access.authorize(inventory, phone, 'edit', { remarks: '新备注' })
  await assert.rejects(access.authorize(inventory, { ...phone, status: 'sold' }, 'edit', { remarks: '新备注' }), { statusCode: 403 })
  await assert.rejects(access.authorize(inventory, { ...phone, status: 'sold' }, 'delete'), { statusCode: 403 })
  await assert.rejects(access.authorize(inventory, phone, 'edit', { sale_price: 100 }), { statusCode: 403 })
  await assert.rejects(access.authorize(inventory, phone, 'edit', { purchase_cost: 11 }), { code: 'FIELD_PERMISSION_DENIED' })
  await assert.rejects(access.authorize(inventory, { ...phone, store_id: 3 }, 'edit', {}), { statusCode: 403 })
  await assert.rejects(access.authorize(inventory, phone, 'edit', { store_id: 3 }), { statusCode: 403 })
  await access.authorize(actor('query_queryview:edit'), { ...phone, status: 'sold' }, 'edit', { remarks: '新备注' })
  await access.authorize(actor('sales_salesview:edit'), { ...phone, status: 'sold' }, 'edit', { remarks: '新备注' })
})

test('商城子模块、导入和模块管理接口使用真实独立动作', async () => {
  for (const [grants, required, expected] of [
    [['h5_admin_h5adminview:view'], 'h5-config:view', false],
    [['sales_salesview:view'], 'h5-orders:view', false],
    [['inventory_inventoryview:edit'], 'h5-templates:delete', false],
    [['h5_admin_ordersview:edit'], 'h5-orders:edit', true],
    [['data_optimization_dataoptimizationview:edit'], 'data-import:execute', false],
    [['data_optimization_dataimporttab:import'], 'data-import:execute', true],
    [['permissions_modulemanagementview:view'], 'module-management:view', true],
    [['permissions_modulemanagementview:edit'], 'permissions:admin', false]
  ]) assert.equal(await check(actor(...grants), required), expected, `${grants} → ${required}`)
})


test('旧用户接口不能绕过角色管理授权，资料编辑也不能接管权限管理员账户', async () => {
  const UserController = require('../src/controllers/user.controller')
  const UserMutationService = require('../src/services/user-mutation.service')
  const UserRoleAssignmentService = require('../src/services/user-role-assignment.service')
  const events = []
  const permissionCheck = async (user, permission) => check(
    Number(user?.id) === 99 ? { ...user, permissions: ['permissions:admin'] } : user,
    permission
  )
  const roleAssignment = new UserRoleAssignmentService({ permissionCheck })
  const mutationService = new UserMutationService({
    roleAssignment,
    database: () => { events.push('database'); throw new Error('拒绝后不得访问持久层') }
  })
  const controller = new UserController({ mutationService, isConnected: () => true, getDatabase: () => ({}), logger: { error() {} } })
  for (const body of [{ role_ids: [1] }, { role_id: 1 }, { role: '管理员' }, { role_ids: [] }]) {
    for (const method of ['create', 'update']) {
      const res = response()
      await controller[method]({ params: { id: 8 }, body: { username: 'isolated', password: 'isolated-password', ...body }, user: actor('users:create', 'users:edit') }, res)
      assert.equal(res.statusCode, 403, `${method}:${JSON.stringify(body)}`)
    }
  }
  for (const [method, body] of [['update', { name: '接管' }], ['update', { password: 'isolated-password' }], ['remove', {}], ['toggle', {}]]) {
    const res = response()
    await controller[method]({ params: { id: 99 }, body, user: actor('users:edit', 'users:delete') }, res)
    assert.equal(res.statusCode, 403, method)
  }
  assert.deepEqual(events, [])
  // 明确授权可通过公共账户保护；普通资料编辑不要求角色管理。
  await roleAssignment.assertAccountAccess(8, actor('users:edit'))
  await roleAssignment.assertAccountAccess(99, actor('permissions:admin'))
  await mutationService.assertRoleRequest({ name: '普通资料' }, actor('users:edit'))
  await assert.rejects(roleAssignment.assign({ userId: 8, roleIds: [1], requestContext: { user: actor('users:edit') } }), { statusCode: 403 })
})

test('库存替代编辑核验原门店、目标门店、交易状态与只读字段；拒绝时零写入', async () => {
  const Service = require('../src/services/inventory.service')
  const FieldAccessService = require('../src/services/field-access.service')
  const masking = require('../src/services/data-masking.service')
  for (const scenario of ['source', 'target', 'sold', 'peer_transfer', 'supplier_proxy', 'readonly', 'allowed']) {
    const events = []
    const permissions = { hiddenFields: [], readonlyFields: scenario === 'readonly' ? ['price_info.purchase_cost'] : [] }
    const fields = new FieldAccessService({ moduleKey: 'inventory_inventoryview', masking: {
      async getUserFieldPermissions() { return permissions }, filterSensitiveFields: masking.filterSensitiveFields.bind(masking)
    } })
    const access = new PhoneMutationAccessService({ permissionCheck: check, fields: () => fields })
    const connection = { async beginTransaction() {}, async rollback() { events.push('rollback') }, async commit() { events.push('commit') } }
    const service = new Service({ access, fields, repository: {
      withConnection: run => run(connection),
      async findForUpdate() { return { id: 1, store_id: scenario === 'source' ? 3 : 1, status: ['sold', 'peer_transfer', 'supplier_proxy'].includes(scenario) ? scenario : 'in_stock', purchase_cost: 10 } },
      async updatePhone(_connection, _id, fields) { events.push('write'); assert.equal(fields.purchase_cost, 20); assert.equal(fields.sale_price, undefined); return { query: true, affectedRows: 1 } },
      async referenceExists() { return true }, async updatedPhone() { return { id: 1, purchase_cost: 20 } }
    } })
    const request = { purchase_cost: 20, ...(scenario === 'target' ? { store_id: 3 } : {}) }
    const run = () => service.update(1, request, actor('inventory:edit'))
    if (scenario === 'allowed') { assert.equal((await run()).purchase_cost, 20); assert.deepEqual(events, ['write', 'commit']) }
    else { await assert.rejects(run(), { statusCode: 403 }); assert.deepEqual(events, ['rollback']) }
  }
})

test('库存替代列表、详情、删除、汇总均传递当前身份，外店在读取或写入前拒绝', async () => {
  const Controller = require('../src/controllers/inventory.controller')
  const user = actor('inventory:view')
  const calls = []
  const controller = new Controller({ service: Object.fromEntries(['list', 'detail', 'update', 'remove', 'overview', 'stats'].map(method =>
    [method, async (...args) => { assert.equal(args.at(-1), user); calls.push(method); throw Object.assign(new Error('外店'), { statusCode: 403 }) }])) })
  for (const method of ['list', 'detail', 'update', 'remove', 'overview', 'stats']) {
    const res = response()
    await controller[method]({ user, query: {}, params: { id: 1 }, body: {} }, res)
    assert.equal(res.statusCode, 403)
  }
  assert.equal(calls.length, 6)
})

test('综合查询列表、详情、导出使用同一脱敏入口，字段读取故障不生成导出', async () => {
  const Controller = require('../src/controllers/query.controller')
  const source = require('../src/services/data-masking.service')
  const original = { id: 1, purchase_cost: 300, '基本信息': { purchase_cost: 300 } }
  let fail = false
  let exports = 0
  const masking = {
    async maskDataList(data, id, module) {
      assert.equal(id, 7); assert.equal(module, 'query_queryview')
      if (fail) throw new Error('字段读取故障')
      return source.filterSensitiveFields(data, { hiddenFields: ['basic_info.purchase_cost'] })
    },
    async maskDataItem(item, id, module) { return (await this.maskDataList([item], id, module))[0] }
  }
  const controller = new Controller({ masking, service: {
    async validateQueryFilters() {},
    async getComprehensiveQuery(_filters, store, stores, all) {
      assert.equal(store, null); assert.deepEqual(stores, [1, 2]); assert.equal(all, false)
      return { message: '查询成功', data: [structuredClone(original)], pagination: { total: 1, page: 1, page_size: 10 } }
    },
    buildExcelExport(data) { exports++; assert.equal(data[0].purchase_cost, null); return { filename: 'test.xlsx', mimeType: 'test', total: 1, buffer: Buffer.from('isolated') } }
  } })
  const req = { user: actor('query:view'), query: {}, params: { id: 1 } }
  for (const method of ['getComprehensiveQuery', 'getPhoneDetail', 'exportToExcel']) {
    const res = { ...response(), setHeader() {}, send(data) { this.sent = data } }
    await controller[method](req, res)
    if (method !== 'exportToExcel') {
      const data = Array.isArray(res.body.data) ? res.body.data[0] : res.body.data
      assert.equal(data.purchase_cost, null)
      assert.equal(data['基本信息'].purchase_cost, null)
    }
  }
  fail = true
  for (const method of ['getComprehensiveQuery', 'getPhoneDetail', 'exportToExcel']) {
    const res = { ...response(), setHeader() { assert.fail('失败时不得生成文件') }, send() { assert.fail('失败时不得发送文件') } }
    await controller[method](req, res)
    assert.equal(res.statusCode, 500)
    assert.equal(res.body.data, undefined)
  }
  assert.equal(exports, 1)
})

test('综合查询统计隐藏成本和收入派生汇总；字段读取故障在查询前拒绝', async () => {
  const Controller = require('../src/controllers/query.controller')
  const source = require('../src/services/data-masking.service')
  let fail = false
  let reads = 0
  const controller = new Controller({ masking: {
    async getUserFieldPermissions() {
      if (fail) throw new Error('隔离字段读取故障')
      return { hiddenFields: ['basic_info.purchase_cost', 'basic_info.sale_price'] }
    }, filterSensitiveFields: source.filterSensitiveFields.bind(source)
  }, service: { async getStatistics() { reads++; return { message: '查询成功', data: { total_phones: 2, total_purchase_cost: 100, total_sales_revenue: 200 } } } } })
  const req = { user: actor('query:view'), query: {} }
  const success = response()
  await controller.getStatistics(req, success)
  assert.deepEqual(success.body.data, { total_phones: 2, total_purchase_cost: null, total_sales_revenue: null })
  fail = true
  const denied = response()
  await controller.getStatistics(req, denied)
  assert.equal(denied.statusCode, 500)
  assert.equal(denied.body.data, undefined)
  assert.equal(reads, 1)
})

test('综合查询按字段权限分别遮蔽手机概览，调货和划拨由同一个开关控制', async () => {
  const Controller = require('../src/controllers/query.controller')
  const source = require('../src/services/data-masking.service')
  const stats = {
    total_phones: 10, in_stock_count: 3, in_stock_new_count: 1, in_stock_used_count: 2,
    sold_count: 4, peer_transfer_count: 2, supplier_proxy_count: 1, new_count: 7, used_count: 3
  }
  for (const [field, keys] of [
    ['stats.total_phones', ['total_phones']],
    ['stats.in_stock_count', ['in_stock_count', 'in_stock_new_count', 'in_stock_used_count']],
    ['stats.sold_count', ['sold_count']],
    ['stats.transfer_counts', ['peer_transfer_count', 'supplier_proxy_count']],
    ['stats.new_count', ['new_count']],
    ['stats.used_count', ['used_count']]
  ]) {
    const controller = new Controller({ masking: {
      async getUserFieldPermissions() { return { hiddenFields: [field] } },
      filterSensitiveFields: source.filterSensitiveFields.bind(source)
    }, service: { async getStatistics() { return { message: '查询成功', data: stats } } } })
    const res = response()
    await controller.getStatistics({ user: actor('query:view'), query: {} }, res)
    for (const [key, value] of Object.entries(stats)) {
      assert.equal(res.body.data[key], keys.includes(key) ? null : value, `${field} 对 ${key} 的可见性`)
    }
  }
})
