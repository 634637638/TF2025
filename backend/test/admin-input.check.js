'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const XLSX = require('xlsx')
const { parsePriceInput } = require('../src/utils/price-input')

const invalidNumbers = ['12abc', '12元', '1e3', '0x10', '12\n', ' ', true, false, [], {}, NaN, Infinity]
const failSideEffect = () => assert.fail('非法输入不得访问数据库、执行哈希或修改缓存')
const repository = new Proxy({}, { get: () => failSideEffect })

test('H5购物车新增、修改和删除复用完整整数与唯一设备数量规则，非法请求不触及业务库', async t => {
  const Controller = require('../src/controllers/shop-public-catalog.controller')
  const Service = require('../src/services/shop-public.service')
  const database = require('../src/config/database')
  t.mock.method(database, 'getDatabase', failSideEffect)
  const service = new Service()
  const controller = new Controller({ service })
  const cartId = `cart_${'a'.repeat(32)}`
  const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  for (const value of [...invalidNumbers, '', null, '1e0', '0x1', '1.0']) {
    const added = response(), updated = response(), removed = response()
    await controller.addToCart({ body: { cartId, phoneId: value } }, added)
    await controller.updateCartItem({ params: { id: value }, body: { cartId, quantity: 1 } }, updated)
    await controller.removeCartItem({ params: { id: value }, query: { cartId } }, removed)
    for (const res of [added, updated, removed]) assert.equal(res.statusCode, 400)
    await assert.rejects(service.addToCart(cartId, value, 1), { statusCode: 400 })
    await assert.rejects(service.updateCartItem(cartId, value, 1), { statusCode: 400 })
    await assert.rejects(service.removeFromCart(cartId, value), { statusCode: 400 })
  }
  for (const quantity of [...invalidNumbers, null, 0, 2, '1e0', '0x1', '1.1']) {
    const res = response()
    await controller.addToCart({ body: { cartId, phoneId: 1, quantity } }, res)
    assert.equal(res.statusCode, 400)
    await assert.rejects(service.updateCartItem(cartId, 1, quantity), { statusCode: 400 })
  }
})

test('分享置顶拒绝字符串false和非法ID；明确false或0会取消置顶，失败在结构检查之前返回400', async t => {
  const database = require('../src/config/database')
  const calls = []
  t.mock.method(database, 'getDatabase', () => ({ async query(sql, values) { calls.push(values); return [{ affectedRows: 1 }] } }))
  const path = require.resolve('../src/services/shared.service')
  const previous = require.cache[path]
  delete require.cache[path]
  const service = require(path)
  t.after(() => { if (previous) require.cache[path] = previous; else delete require.cache[path] })
  let ensured = 0
  t.mock.method(service, 'ensure', async () => { ensured++ })
  const Controller = require('../src/controllers/shared.controller')
  const controller = new Controller({ service })
  for (const payload of [{ id: '1e3', pinned: true }, { id: '2abc', pinned: true }, { id: '1', pinned: 'false' },
    { id: '1', pinned: {} }, { id: '1' }]) {
    const res = { status(code) { this.statusCode = code; return this }, json() { return this } }
    await controller.pin({ params: { id: payload.id }, body: { pinned: payload.pinned }, user: { id: 2 } }, res)
    assert.equal(res.statusCode, 400)
    assert.equal(ensured, 0)
    assert.equal(calls.length, 0)
  }
  for (const pinned of [false, 0, '0', true, 1, '1']) await service.pin('1', pinned, 2)
  assert.deepEqual(calls, [[0, 1], [0, 1], [0, 1], [1, 1], [1, 1], [1, 1]])
})

test('考勤管理员员工ID必须完整，普通员工不能通过伪造ID修改目标', async (t) => {
  const controller = require('../src/controllers/attendance.controller')
  const service = require('../src/services/attendance.service')
  const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  let admin = true
  t.mock.method(controller, 'getAttendanceScope', async () => ({ canView: true, isAdmin: admin }))
  t.mock.method(service, 'createAttendanceRecord', async input => input)
  for (const employee_id of invalidNumbers) {
    const res = response()
    await controller.createAttendanceRecord({ user: { id: 2 }, body: { employee_id } }, res)
    assert.equal(res.statusCode, 400)
  }
  const valid = response()
  await controller.createAttendanceRecord({ user: { id: 2 }, body: { employee_id: '3' } }, valid)
  assert.equal(valid.statusCode, 201)
  assert.equal(valid.body.data.employee_id, 3)
  admin = false
  const own = response()
  await controller.createAttendanceRecord({ user: { id: 2 }, body: { employee_id: '3abc' } }, own)
  assert.equal(own.statusCode, 201)
  assert.equal(own.body.data.employee_id, 2)
})

test('用户写入在查询和哈希之前拒绝非法姓名、角色、联系方式、状态及关联 ID', async () => {
  const Service = require('../src/services/user-mutation.service')
  const service = new Service({ repository, database: failSideEffect, passwordHasher: failSideEffect })
  const base = { username: 'test-user', password: ' unchanged ', name: '张三' }
  for (const patch of [{ username: [] }, { password: {} }, { name: '123' }, { name: '张\n三' }, { name: '张'.repeat(51) },
    { phone: 13800138000 }, { phone: '138x00138000' }, { email: [] }, { salary_template_id: '2元' },
    ...invalidNumbers.map(status => ({ status })), ...invalidNumbers.map(store_id => ({ store_id })),
    ...invalidNumbers.map(role_id => ({ role_id }))]) {
    await assert.rejects(service.create({ ...base, ...patch }), { statusCode: 400 })
    await assert.rejects(service.update('1', patch), { statusCode: 400 })
  }
})

test('库存预警新增与编辑严格限制整数、状态、布尔值及数组，失败无仓储调用', async () => {
  const Service = require('../src/services/phone-stock-warning.service')
  const service = new Service()
  service.repository = repository
  for (const patch of [...invalidNumbers.map(min_stock => ({ min_stock })), { min_stock: 1.1 }, { min_stock: 101 },
    { brand_id: true }, { model_id: '2abc' }, { color_ids: [1, '2abc'] }, { memory_ids: [false] },
    { condition_values: [1, 0.5] }, { status: 2 }, { warning_enabled: 'false' }, { remarks: {} }, { config_name: 'a\nb' }]) {
    const created = await service.createConfig(1, { brand_id: 1, model_id: 1, ...patch })
    const updated = await service.updateConfig(1, '1', patch)
    assert.equal(created.statusCode, 400, JSON.stringify(patch))
    assert.equal(updated.statusCode, 400, JSON.stringify(patch))
  }
  for (const id of invalidNumbers) {
    assert.equal((await service.deleteConfig(1, id)).statusCode, 400)
    assert.equal((await service.toggleWarning(1, id, true)).statusCode, 400)
  }
})

test('待办及类型写入在结构检查之前拒绝伪装数字、非法文本和接收人', async (t) => {
  const service = require('../src/services/reminder.service')
  t.mock.method(service, 'ensure', failSideEffect)
  for (const payload of [...invalidNumbers.map(interval_value => ({ interval_value })), { interval_value: 0 },
    { title: {} }, { title: 'a\nb' }, { content: 'a\u0000b' }, { target_user_ids: [1, '2abc'] },
    { weekdays: [true] }, { weekdays: [8] }, { occurrence_limit: '1e3', end_type: 'count' }]) {
    await assert.rejects(service.create(1, payload), { statusCode: 400 })
    await assert.rejects(service.update('1', 1, payload), { statusCode: 400 })
  }
  for (const payload of [{ name: {} }, { name: 'a\nb' }, { sort_order: 1.5 }, { default_remind_days: '12天' }, { color: ['#ffffff'] }]) {
    await assert.rejects(service.createType(payload), { statusCode: 400 })
    await assert.rejects(service.updateType('1', payload), { statusCode: 400 })
  }
})

test('待办控制器拒绝科学计数 ID 和字符串 false，不误开启事项类型', async () => {
  const Controller = require('../src/controllers/reminder.controller')
  const controller = new Controller({ service: repository, logger: { error() {} } })
  const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  for (const [id, is_active] of [['1e3', true], ['1', 'false'], ['1', {}]]) {
    const res = response()
    await controller.toggleType({ params: { id }, body: { is_active } }, res)
    assert.equal(res.statusCode, 400)
  }
})

test('供应商付款在供应商查询之前拒绝非法金额、ID 和备注', async (t) => {
  const SupplierRepository = require('../src/repositories/supplier.repository')
  const service = require('../src/services/payment.service')
  t.mock.method(SupplierRepository.prototype, 'getSupplierById', failSideEffect)
  for (const patch of [...invalidNumbers.map(payment_amount => ({ payment_amount })), { payment_amount: '1.001' },
    { payment_amount: 0 }, { supplier_id: true }, { settlement_id: '1abc' }, { notes: [] }]) {
    await assert.rejects(service.createPayment({ supplier_id: 1, payment_amount: 10, ...patch }), { statusCode: 400 })
  }
})

test('合法付款复用已实例化供应商仓储，金额零头和备注原文保持', async (t) => {
  const SupplierRepository = require('../src/repositories/supplier.repository')
  const payments = require('../src/repositories/payment.repository')
  const service = require('../src/services/payment.service')
  const calls = []
  t.mock.method(SupplierRepository.prototype, 'getSupplierById', async id => { calls.push(['supplier', id]); return { id } })
  t.mock.method(service, 'generatePaymentNo', async () => 'PAY-EXAMPLE')
  t.mock.method(payments, 'create', async data => { calls.push(['create', data]); return 7 })
  t.mock.method(payments, 'findById', async id => ({ id }))
  assert.deepEqual(await service.createPayment({ supplier_id: '1', payment_amount: '0.01', notes: '合法备注\n第二行' }), { id: 7 })
  assert.deepEqual(calls[0], ['supplier', 1])
  assert.equal(calls[1][1].payment_amount, 0.01)
  assert.equal(calls[1][1].notes, '合法备注\n第二行')
})

test('菜单新增、编辑、启停及排序在结构和数据库访问之前拒绝非法输入', async () => {
  const Service = require('../src/services/menu.service')
  const service = Object.create(Service.prototype)
  service.db = repository
  for (const patch of [{ name: [] }, { name: 'a\nb' }, { url: {} }, { sort_order: '2abc' }, { sort_order: 1.1 },
    { is_active: 'false' }, { module_id: '1e3' }, { parent_id: true }, { menu_type: {} }]) {
    for (const result of [await service.createMenu({ name: '测试菜单', ...patch }), await service.updateMenu('1', patch)]) {
      assert.equal(result.success, false)
      assert.equal(result.code, 'VALIDATION_ERROR')
    }
  }
  for (const value of invalidNumbers) {
    if (typeof value !== 'boolean') assert.equal((await service.updateMenuStatus('1', value)).code, 'VALIDATION_ERROR')
    assert.equal((await service.updateMenuSort([{ id: 1, sort_order: 0 }, { id: 2, sort_order: value }])).code, 'VALIDATION_ERROR')
  }
})

test('菜单 Excel 整份预检拒绝非法状态、ID 和文本，不能先写前面的合法行', async (t) => {
  const spreadsheets = require('../src/utils/spreadsheet-security')
  let rows
  t.mock.method(spreadsheets, 'validateSpreadsheetFile', () => '/__tf_input_not_created.xlsx')
  t.mock.method(spreadsheets, 'readSpreadsheetFileSafe', () => ({ SheetNames: ['menus'], Sheets: { menus: {} } }))
  t.mock.method(spreadsheets, 'sheetToJsonSafe', () => rows)
  const modulePath = require.resolve('../src/services/menu.service')
  delete require.cache[modulePath]
  t.after(() => { delete require.cache[modulePath] })
  const Service = require(modulePath)
  const service = Object.create(Service.prototype)
  service.db = { async execute(sql) { assert.match(sql, /^SELECT /); return [[]] } }
  for (const patch of [{ 状态: 'maybe' }, { 状态: '启用\n' }, { ID: '1e3' }, { 父级ID: true },
    { 菜单名称: 'a\nb' }, { 菜单名称: 123 }, { 路径: [] }, { 排序: '2abc' }, { 模块ID: '1元' }]) {
    rows = [{ 菜单名称: '先合法', 状态: '启用' }, { 菜单名称: '后非法', ...patch }]
    const result = await service.importMenus({ path: '/__tf_input_not_created.xlsx' })
    assert.equal(result.success, false)
    assert.equal(result.code, 'INVALID_FILE')
  }
})

test('菜单停用 false 和合法零排序不会当作空值或真值', async () => {
  const Service = require('../src/services/menu.service')
  const service = Object.create(Service.prototype)
  const calls = []
  service.db = { async execute(sql, params) { calls.push([sql, params]); return sql.startsWith('SELECT') ? [[{ id: 1 }]] : [{ affectedRows: 1 }] } }
  assert.equal((await service.updateMenuStatus('1', false)).success, true)
  assert.deepEqual(calls[1][1], [0, 1])
  assert.equal(service.validateMenuData({ name: '菜单', sort_order: 0, is_active: false }).data.is_active, 0)
})

test('角色名称、描述、编码和 ID 的非法类型在仓储、结构检查及审计之前拒绝', async () => {
  const Service = require('../src/services/permission-role-management.service')
  const service = new Service({ repository, inspectColumn: failSideEffect, audit: repository })
  for (const patch of [{ name: {} }, { name: 'a\nb' }, { description: [] }, { description: 'a\u0000b' }, { code: {} }]) {
    await assert.rejects(service.create({ name: '角色', description: '合法描述', ...patch }, {}), { statusCode: 400 })
    await assert.rejects(service.update('1', { name: '角色', description: '合法描述', ...patch }, {}), { statusCode: 400 })
  }
  for (const id of invalidNumbers) {
    await assert.rejects(service.remove(id, {}), { statusCode: 400 })
    await assert.rejects(service.updateStatus(id, { is_active: '1' }, {}), { statusCode: 400 })
  }
  assert.deepEqual(service.validateNameAndDescription(' 角色 ', ' 描述\n第二行 '), { name: '角色', description: '描述\n第二行' })
})

test('系统配置按声明类型验证且批量整份预检，第二项非法时第一项也不写入', async (t) => {
  const Repository = require('../src/repositories/system-settings.repository')
  const service = require('../src/services/system-settings.service')
  const calls = []
  t.mock.method(Repository.prototype, 'upsertSetting', async (...args) => { calls.push(args); return { success: true } })
  for (const value of [...invalidNumbers, '', null]) {
    await assert.rejects(service.updateSetting('amount', value, 'number'), { statusCode: 400 })
    await assert.rejects(service.batchUpdateSettings([{ key: 'valid', value: '合法文本' }, { key: 'amount', value, type: 'number' }]), { statusCode: 400 })
  }
  for (const value of [[], {}, 'truthy', 'true\n']) await assert.rejects(service.updateSetting('enabled', value, 'boolean'), { statusCode: 400 })
  await assert.rejects(service.updateSetting('json', '{broken', 'json'), { statusCode: 400 })
  await assert.rejects(service.updateSetting('text', [], 'string'), { statusCode: 400 })
  assert.equal(calls.length, 0)
  await service.batchUpdateSettings([
    { key: 'amount', value: '0', type: 'number' }, { key: 'enabled', value: false, type: 'boolean' },
    { key: 'json', value: { list: ['合法中文'] }, type: 'json' }, { key: 'text', value: '多行\n原文' }
  ])
  assert.deepEqual(calls, [['amount', 0, 'number'], ['enabled', 'false', 'boolean'], ['json', { list: ['合法中文'] }, 'json'], ['text', '多行\n原文', 'string']])
})

test('手工价目拒绝非法数值、精度、数量和文本，数据库初始化也不触发', async () => {
  const Service = require('../src/services/price-list-management.service')
  const service = new Service({ database: failSideEffect, priceService: failSideEffect })
  const base = { brand_name: '苹果', model_number: 'iPhone 16' }
  for (const patch of [...invalidNumbers.map(retail_price => ({ retail_price })), { wholesale_price: '20%' },
    { wholesale_price: '1.001' }, { stock_quantity: 1.5 }, { stock_quantity: '10台' }, { status: 2 },
    { brand_name: {} }, { model_number: 'a\nb' }, { color_name: [] }]) {
    await assert.rejects(service.upsertPriceItem({ ...base, ...patch }), { statusCode: 400 })
  }
  assert.deepEqual(parsePriceInput({ ...base, retail_price: '0', wholesale_price: null, stock_quantity: '0' }),
    { ...base, retail_price: 0, wholesale_price: null, stock_quantity: 0 })
  assert.equal(parsePriceInput({ ...base, retail_price: '1,234.50' }, { spreadsheet: true }).retail_price, 1234.5)
})

test('价目 Excel 不再删除百分号、混输文字或舍入金额，非法行不调用 upsert', async () => {
  const Service = require('../src/services/price-list-management.service')
  const payloads = []
  const service = new Service({ database: () => ({}), priceService: () => ({ setDatabase() {}, async upsertPriceItem(payload) {
    payloads.push(payload)
    return { success: true }
  } }) })
  const invalid = ['20%', '12元', '12abc', '1e3', '0x10', '12\n', true, '1.001', '-1']
  const rows = invalid.map(value => ({ 品牌: '苹果', 型号: 'iPhone', 批发价: value }))
  rows.push({ 品牌: '苹果', 型号: 'iPhone', 批发价: '1,234.50', 库存数量: 0, 状态: '停用' })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '价目')
  const result = await service.importPriceList({ buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) })
  assert.equal(result.data.failed, invalid.length)
  assert.equal(result.data.imported, 1)
  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].wholesale_price, 1234.5)
  assert.equal(payloads[0].stock_quantity, 0)
  assert.equal(payloads[0].status, 0)
  assert.equal(result.data.errors.some(error => error.includes('12abc')), false)
})
