const test = require('node:test')
const assert = require('node:assert/strict')
const { parseRepairInput } = require('../src/utils/repair-input')
const { parseRentalInput } = require('../src/utils/rental-input')

const invalidNumbers = ['12abc', '12元', '1e3', '0x10', '12\n', ' ', true, false, [], {}, null, '', NaN, Infinity]
const failSideEffect = () => assert.fail('非法输入不能触发仓储、哈希、媒体或结构检查')
const repository = new Proxy({}, { get: () => failSideEffect })

test('员工新增和编辑复用完整姓名、电话、邮箱、状态、ID及角色规则；拒绝前无查询或哈希', async () => {
  const Service = require('../src/services/employee-mutation.service')
  const service = new Service({ repository, hashPassword: failSideEffect })
  const valid = { username: 'employee', name: "Anne·张 O'Neil", password: ' unchanged ', role_ids: [1] }
  const invalid = [
    { name: '123' }, { name: '张\n三' }, { name: '张'.repeat(51) }, { username: {} },
    { password: [] }, { phone: '138中00138000' }, { phone: 13800138000 }, { email: ['a@example.com'] },
    { status: 2 }, { salary_template_id: '1e3' }, { hire_date: [] },
    ...[true, '1e3', '0x10', [1], {}, 1.1].map(value => ({ role_ids: [value] }))
  ]
  for (const patch of invalid) {
    await assert.rejects(service.createEmployee({ ...valid, ...patch }), { statusCode: 400 })
    await assert.rejects(service.updateEmployee('1', patch), { statusCode: 400 })
  }
  for (const id of invalidNumbers) {
    await assert.rejects(service.updateEmployee(id, { name: '张三' }), { statusCode: 400 })
    await assert.rejects(service.deleteEmployee(id, 1), { statusCode: 400 })
  }
  for (const status of [...invalidNumbers, 2, -1]) await assert.rejects(service.updateEmployeeStatus(1, status, 2), { statusCode: 400 })
})

test('维修创建和编辑在媒体及引用查询之前拒绝非法类型、长度、金额和ID，兼容现场编码', async () => {
  const CreateService = require('../src/services/repair-create.service')
  const UpdateService = require('../src/services/repair-update.service')
  const options = { repository, parseId: Number, parseMoney: Number, validateMedia: failSideEffect, moveMedia: failSideEffect, rollbackMedia: failSideEffect,
    removeMedia: failSideEffect, parseStoredMedia: failSideEffect, normalizeMedia: failSideEffect }
  const create = new CreateService(options)
  const update = new UpdateService(options)
  const base = { customer_id: 1, phone_model: '手工型号 Model X', problem_description: '换屏幕、故障\n描述' }
  for (const patch of [{ phone_model: {} }, { problem_description: [] }, { imei: 1234 }, { serial_number: 'a\nb' },
    { phone_model: 'M'.repeat(101) }, { remarks: 'a\u0000b' }, { actual_cost: '1.001' },
    ...invalidNumbers.filter(value => value !== null && value !== '').map(brand_id => ({ brand_id }))]) {
    await assert.rejects(create.create({ ...base, ...patch }, { id: 1 }), { statusCode: 400 })
    await assert.rejects(update.update(1, patch, { id: 1 }), { statusCode: 400 })
  }
  const input = parseRepairInput({ ...base, imei: '现场-待检', serial_number: 'SN 历史记录', actual_cost: '0' }, { create: true })
  assert.equal(input.actual_cost, 0)
  assert.equal(input.imei, '现场-待检')
})

test('租赁新增与编辑的金额、期数、状态和ID在结构检查、事务及积分之前拒绝', async () => {
  const CreateService = require('../src/services/rental-create.service')
  const UpdateService = require('../src/services/rental-update.service')
  const options = { repository, ensureSchema: failSideEffect, reconcilePoints: failSideEffect }
  const create = new CreateService(options), update = new UpdateService(options)
  const base = { customer_id: 1, phone_id: 2, billing_mode: 'buyout', sale_price: 1000, down_payment: 0, monthly_rent: 10, term_months: 1,
    start_date: '2026-11-13', sale_operator_id: 1, sale_store_id: 1, sale_payment_method: 'cash' }
  for (const patch of [...invalidNumbers.map(sale_price => ({ sale_price })), { purchase_cost: '1.001' }, { sale_price: -1 },
    { sale_store_id: true }, { customer_id: [] }, { term_months: '1e1' }, { term_months: 13 }, { monitoring_lock: 'false' }, { remarks: {} }]) {
    await assert.rejects(create.create({ body: { ...base, ...patch }, operatorId: 1 }), { statusCode: 400 })
    await assert.rejects(update.update({ id: 1, body: patch, isAdministrator: true }), { statusCode: 400 })
  }
  const input = parseRentalInput({ sale_price: '12.02', down_payment: '0', term_months: '12', monitoring_lock: false })
  assert.deepEqual(input, { sale_price: 12.02, down_payment: 0, term_months: 12, monitoring_lock: false })
})

test('租赁还款拒绝伪装金额和非法期次数组，归还拒绝非法ID，不开启事务', async () => {
  const ScheduleService = require('../src/services/rental-schedule.service')
  const FinishService = require('../src/services/rental-finish.service')
  const options = { repository, ensureSchema: failSideEffect, databaseProvider: failSideEffect }
  const schedule = new ScheduleService(options), finish = new FinishService(options)
  for (const amount of [...invalidNumbers, 0, -1, '1.001']) await assert.rejects(schedule.recordPayment(1, { amount }, 1), { statusCode: 400 })
  for (const period_numbers of [true, {}, [], [true], ['1e1'], [0], [1.1], [1, '2abc']]) await assert.rejects(schedule.recordPayment(1, { period_numbers }, 1), { statusCode: 400 })
  for (const id of invalidNumbers) await assert.rejects(finish.finish(id), { statusCode: 400 })
})
