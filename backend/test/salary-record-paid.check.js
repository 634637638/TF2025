'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const SalaryRecordRepository = require('../src/repositories/salary-record.repository')
const singleton = require('../src/services/salary-record.service')
const SalaryRecordService = singleton.constructor
const { applyGoods, calculatedSalary, cents } = require('../src/utils/salary-goods-amounts')
const SettlementService = require('../src/services/salary-goods-settlement.service')
const SettlementRepository = require('../src/repositories/salary-goods-settlement.repository')

const period = { employee_id: 7, period_start: '2026-10-01', period_end: '2026-10-31' }
const original = (overrides = {}) => ({ id: 15, ...period, base_salary: 2000, commission_amount: 80,
  commission_detail: '[{"sale_id":81,"amount":80}]', net_salary: 2080, status: 'approved', paid_at: null,
  payment_method: 'cash', created_by: 9, ...overrides })
const harness = (initial = original(), entries = null) => {
  let record = initial && structuredClone(initial), nextId = 16, failAt = null, claims = []
  const calls = [], queries = [], repository = new SalaryRecordRepository({ columnExists: async () => true })
  const emptyPlan = data => ({ version: 1, employee_id: Number(data.employee_id), period_start: data.period_start, period_end: data.period_end,
    through: data.through, earned_cents: 0, reversal_cents: 0, net_cents: 0, legacy_item_count: 0, entries: [] })
  if (record && record.status !== 'paid' && !record.paid_at) record = { ...record, ...applyGoods(record, emptyPlan({ ...record, through: '2026-11-13 15:00:00' })) }
  const fail = name => { calls.push(name); if (failAt === name) throw new Error(`failure:${name}`) }
  const connection = {
    async beginTransaction() { fail('begin'); this.before = structuredClone(record); this.claimsBefore = structuredClone(claims) },
    async commit() { fail('commit') },
    async rollback() { calls.push('rollback'); record = this.before; claims = this.claimsBefore },
    release() { calls.push('release') },
    async execute(sql, params) {
      const text = sql.replace(/\s+/g, ' ').trim()
      queries.push({ sql: text, params })
      if (text.startsWith('SET TRANSACTION')) { fail('isolation'); return [{}] }
      fail('query')
      if (text.startsWith('INSERT INTO salary_goods_settlements')) {
        if (claims.length && failAt === 'second-claim') throw new Error('second-claim')
        const [employee_id, salary_record_id, original_salary_record_id, source_key, source_hash, amount_cents, source_snapshot, created_at] = params
        assert.equal(claims.some(row => row.source_key === source_key), false)
        claims.push({ id: claims.length + 1, employee_id, salary_record_id, original_salary_record_id, source_key,
          source_hash, amount_cents, source_snapshot, created_at })
        return [{ affectedRows: 1 }]
      }
      if (text.includes('FROM salary_goods_settlements l LEFT JOIN')) return [claims.filter(row => row.id > params[2]).slice(0, params[3])]
      if (text.includes('FROM salary_goods_settlements WHERE source_key IN')) return [claims.filter(row => params.includes(row.source_key))]
      if (text.includes('FROM salary_records sr') && text.includes('EXISTS')) return [[record].filter(row => row && row.id > params[2])]
      if (/^SELECT/.test(text)) {
        if (/FOR UPDATE$/.test(text)) {
          calls.push('lock')
          if (/FROM users/.test(text)) return [[...(text.includes('salary_records') ? record ? [{ id: record.employee_id }] : [] : [{ id: params[0] }])]]
          if (/WHERE id = \?/.test(text)) return [[record].filter(row => row && Number(row.id) === Number(params[0]))]
        }
        return [[record].filter(Boolean).map(row => structuredClone(row))]
      }
      if (/^INSERT/.test(text)) {
        const fields = text.match(/\(([^)]+)\)/)[1].split(', ')
        record = { id: nextId++, ...Object.fromEntries(fields.map((field, index) => [field, params[index]])) }
        return [{ insertId: record.id, affectedRows: 1 }]
      }
      assert.match(text, /paid_at IS NULL/)
      if (!record || record.status === 'paid' || record.paid_at) return [{ affectedRows: 0 }]
      if (/^DELETE/.test(text)) { record = null; return [{ affectedRows: 1 }] }
      if (/status = 'paid'/.test(text)) {
        assert.match(text, /WHERE id = \? AND status = 'approved'/)
        if (record.status !== 'approved') return [{ affectedRows: 0 }]
        Object.assign(record, { status: 'paid', paid_at: params[0], payment_method: params[1] })
      } else if (/SET status = 'approved'/.test(text)) record.status = 'approved'
      else {
        assert.match(text, /status IS NULL OR status <> 'paid'/)
        const fields = text.match(/SET (.+) WHERE/)[1].split(', ').map(field => field.split(' = ')[0])
        Object.assign(record, Object.fromEntries(fields.map((field, index) => [field, params[index]])))
      }
      return [{ affectedRows: 1, changedRows: 1 }]
    }
  }
  repository.getConnection = () => ({ getConnection: async () => { calls.push('acquire'); return connection } })
  repository.executeQuery = async () => [record].filter(Boolean).map(row => structuredClone(row))
  const calculator = { async calculateSalary() { calls.push('calculate'); return original({ id: undefined, net_salary: 2400, commission_amount: 400, commission_detail: 'new-detail' }) } }
  const goods = entries ? new SettlementService({ repository: new SettlementRepository(), tableExists: async () => true,
    columnExists: async () => true, sources: { async readSources(conn, employeeId, through) {
      assert.equal(conn, connection); assert.equal(employeeId, 7)
      return { ...emptyPlan({ ...period, through }), entries: structuredClone(entries),
        earned_cents: entries.filter(row => row.kind === 'sale').reduce((total, row) => total + row.amount_cents, 0),
        reversal_cents: entries.filter(row => row.kind === 'return').reduce((total, row) => total - row.amount_cents, 0),
        net_cents: entries.reduce((total, row) => total + row.amount_cents, 0) }
    } } }) : { async prepare(_conn, data) { return emptyPlan(data) }, async confirm(_conn, row) { return JSON.parse(row.goods_commission_snapshot) },
    async append() { calls.push('claim') } }
  const service = new SalaryRecordService({ repository, calculator, goods, now: () => '2026-11-13 15:00:01' })
  return { service, repository, calculator, connection, calls, queries, get claims() { return claims },
    get record() { return record }, set record(row) { record = row }, fail(name) { failAt = name } }
}
const code = expected => error => error.code === expected && error.statusCode >= 400 && error.statusCode < 500

for (const [name, run] of [
  ['编辑', service => service.updateSalaryRecord(15, { net_salary: 1 })],
  ['删除', service => service.deleteSalaryRecord(15)],
  ['审批', service => service.approveSalaryRecord(15, 9)],
  ['重算保存', service => service.saveCalculatedSalary(period, 9)],
  ['重复创建周期', service => service.createSalaryRecord(period, 9)]
]) {
  test(`已发工资拒绝${name}，保留金额、原单明细、付款时间及方式`, async () => {
    const h = harness(original({ status: 'paid', paid_at: '2026-11-01 09:00:00' })), before = structuredClone(h.record)
    await assert.rejects(run(h.service), code('SALARY_RECORD_PAID'))
    assert.deepEqual(h.record, before)
    assert.equal(h.queries.some(query => /^(UPDATE|DELETE|INSERT)/.test(query.sql)), false)
    if (['重算保存', '重复创建周期'].includes(name)) assert.equal(h.calls.includes('calculate'), false)
    else assert.deepEqual(h.calls.slice(-2), ['rollback', 'release'])
  })
}

test('首次发放来自公共北京时间，重复请求保留首次事实且不再更新', async () => {
  const h = harness(), first = await h.service.markAsPaid(15, { payment_method: 'wechat' })
  assert.equal(first.paid_at, '2026-11-13 15:00:01'); assert.equal(first.payment_method, 'wechat')
  const replay = await h.service.markAsPaid(15, { payment_method: 'bank_transfer' })
  assert.deepEqual(replay, first)
  assert.equal(h.queries.filter(query => /^UPDATE/.test(query.sql)).length, 1)
  assert.equal(h.calls.filter(call => call === 'commit').length, 2)
  assert.equal(h.calls.filter(call => call === 'release').length, 2)
  assert.ok(h.queries.filter(query => /^SELECT/.test(query.sql)).every(query => /FOR UPDATE$/.test(query.sql)))
})

test('状态异常但有发放时间同样保护；草稿、无效支付方式不发放', async () => {
  for (const action of [service => service.updateSalaryRecord(15, { net_salary: 1 }), service => service.deleteSalaryRecord(15), service => service.markAsPaid(15)]) {
    const h = harness(original({ paid_at: '2026-11-01 09:00:00' }))
    await assert.rejects(action(h.service), code('SALARY_RECORD_PAID'))
  }
  const draft = harness(original({ status: 'draft' }))
  await assert.rejects(draft.service.markAsPaid(15), code('SALARY_STATUS_CONFLICT'))
  const invalid = harness()
  await assert.rejects(invalid.service.markAsPaid(15, { payment_method: 'fake-payment' }), code('SALARY_RECORD_INVALID'))
})

test('重算期间已发放，事务内重新锁读后拒绝覆盖', async () => {
  const h = harness(), before = original({ status: 'paid', paid_at: '2026-11-01 09:00:00' })
  h.calculator.calculateSalary = async () => { h.record = structuredClone(before); return original({ net_salary: 1 }) }
  await assert.rejects(h.service.saveCalculatedSalary(period, 9), code('SALARY_RECORD_PAID'))
  assert.deepEqual(h.record, before)
  assert.ok(h.queries.some(query => /FROM users.*FOR UPDATE/.test(query.sql)))
  assert.ok(h.queries.some(query => /employee_id = \? AND period_start = \? AND period_end = \?.*FOR UPDATE/.test(query.sql)))
  assert.deepEqual(h.calls.slice(-2), ['rollback', 'release'])
})

test('考勤审批重算跳过已发，计算途中发放也不影响考勤审批', async () => {
  const h = harness(original({ status: 'paid' }))
  assert.equal(await h.service.recalculateExistingSalaryForPeriod(7, period.period_start, period.period_end, 9), null)
  assert.equal(h.calls.includes('calculate'), false)
  h.record = original()
  h.calculator.calculateSalary = async () => { h.record = original({ status: 'paid' }); return original({ net_salary: 1 }) }
  assert.equal(await h.service.recalculateExistingSalaryForAttendanceRecord({ employee_id: 7, record_date: '2026-10-20', record_type: 'leave' }, 9), null)
  assert.equal(h.record.net_salary, 2080)
  assert.deepEqual(h.calls.slice(-2), ['commit', 'release'])
})

test('未发工资仍可审批、编辑及删除，员工和周期不可改写', async () => {
  const h = harness(original({ status: 'pending' }))
  assert.equal(await h.service.approveSalaryRecord(15, 9), true)
  assert.equal(await h.service.approveSalaryRecord(15, 9), true)
  for (const input of [{ employee_id: 8 }, { period_start: '2026-09-01' }, { period_end: '2026-12-01' }]) {
    await assert.rejects(h.service.updateSalaryRecord(15, input), code('SALARY_PERIOD_CONFLICT'))
  }
  const result = await h.service.updateSalaryRecord(15, { net_salary: 2200, created_by: 888, injected: 'blocked' })
  assert.equal(result.affectedRows, 1); assert.equal(h.record.net_salary, 2200); assert.equal(h.record.created_by, 9)
  assert.equal(h.record.injected, undefined)
  await assert.rejects(h.service.updateSalaryRecord(15, { injected: 'blocked' }), code('SALARY_RECORD_INVALID'))
  await h.service.deleteSalaryRecord(15)
  assert.equal(h.record, null)
})

test('首次创建锁员工和周期，同周期重复提交不产生第二笔；不修改请求对象', async () => {
  const h = harness(null), input = original({ id: undefined })
  const before = structuredClone(input), created = await h.service.createSalaryRecord(input, 22)
  assert.equal(created.data.created_by, 22); assert.equal(h.record.id, 16)
  assert.deepEqual(input, before)
  await assert.rejects(h.service.createSalaryRecord(input, 22), code('SALARY_PERIOD_CONFLICT'))
  assert.equal(h.queries.filter(query => /^INSERT/.test(query.sql)).length, 1)
  const locked = h.queries.filter(query => /FOR UPDATE$/.test(query.sql))
  assert.deepEqual(locked[0].params, [7])
  assert.deepEqual(locked[1].params, [7, '2026-10-01', '2026-10-31'])
})

test('未发工资重算保留创建人和审批状态，采用最新计算金额与明细', async () => {
  const h = harness()
  const updated = await h.service.saveCalculatedSalary(period, 22)
  assert.equal(updated.data.net_salary, 2400)
  assert.equal(h.record.commission_detail, 'new-detail'); assert.equal(h.record.created_by, 9); assert.equal(h.record.status, 'approved')
})

test('批量重算独立报告成功、跳过已发和实际失败，不把失败当作跳过', async () => {
  const h = harness()
  h.repository.activeEmployeeIds = async () => [{ id: 7 }, { id: 8 }, { id: 9 }]
  h.service.saveCalculatedSalary = async data => {
    if (data.employee_id === 8) throw Object.assign(new Error('paid'), { code: 'SALARY_RECORD_PAID' })
    if (data.employee_id === 9) throw new Error('计算配置缺失')
  }
  assert.deepEqual(await h.service.bulkRecalculateByPeriod(period.period_start, period.period_end, 22), {
    total: 3, recalculated: 1, skipped_paid: 1, errors: [{ employee_id: 9, message: '计算配置缺失' }]
  })
})

for (const failure of ['isolation', 'begin', 'query', 'commit']) test(`事务${failure}失败释放同一连接，写入失败回滚`, async () => {
  const h = harness(); h.fail(failure)
  await assert.rejects(h.service.markAsPaid(15), new RegExp(`failure:${failure}`))
  assert.equal(h.calls.at(-1), 'release')
  if (['query', 'commit'].includes(failure)) { assert.equal(h.calls.at(-2), 'rollback'); assert.equal(h.record.status, 'approved') }
  else assert.equal(h.calls.includes('rollback'), false)
})

test('无效编号/日期拒绝，缺失记录和重复周期给出业务错误', async () => {
  const h = harness(null)
  await assert.rejects(h.service.markAsPaid(1), code('NOT_FOUND'))
  await assert.rejects(h.service.deleteSalaryRecord('1 OR 1'), code('SALARY_RECORD_INVALID'))
  for (const input of [{ ...period, period_start: '2026-02-30' }, { ...period, employee_id: true }, { ...period, period_end: '2026-09-01' }]) {
    await assert.rejects(h.service.createSalaryRecord(input, 9), code('SALARY_RECORD_INVALID'))
  }
  h.repository.lockPeriodRecords = async () => [original(), original({ id: 16 })]
  await assert.rejects(h.service.createSalaryRecord(period, 9), code('SALARY_PERIOD_CONFLICT'))
})

test('工资写入控制器映射409、404、400及错误码，不把业务冲突误报500', async t => {
  const Controller = require('../src/controllers/salary-record.controller').constructor
  const controller = new Controller({ masking: { async getUserFieldPermissions() { return { hiddenFields: [] } }, filterSensitiveFields: rows => rows } })
  for (const [method, args, status, errorCode] of [
    ['updateSalaryRecord', { params: { id: 15 }, body: {} }, 409, 'SALARY_RECORD_PAID'],
    ['deleteSalaryRecord', { params: { id: 15 } }, 404, 'NOT_FOUND'],
    ['saveCalculatedSalary', { body: {}, user: { userId: 9 } }, 400, 'SALARY_RECORD_INVALID'],
    ['markAsPaid', { params: { id: 15 }, body: {} }, 409, 'SALARY_STATUS_CONFLICT']
  ]) {
    const mock = t.mock.method(singleton, method, async () => { throw Object.assign(new Error('业务拒绝'), { statusCode: status, code: errorCode }) })
    const res = { status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
    await controller[method](args, res)
    assert.equal(res.statusCode, status); assert.equal(res.body.code, errorCode); assert.equal(res.body.message, '业务拒绝')
    mock.mock.restore()
  }
})

const earned = (patch = {}) => ({ employee_id: 7, salary_template_id: 4, order_id: 10, order_item_id: 50, accessory_sale_id: 20,
  source_key: 'goods_sale:50', kind: 'sale', original_source_key: null, aftersale_id: null, aftersale_item_id: null,
  quantity: 3, business_time: '2026-10-20 12:00:00', recorded_at: '2026-10-20 12:01:00', amount_cents: 1000,
  reason: 'earned', source_hash: 'a'.repeat(64), ...patch })
const reversed = () => earned({ source_key: 'goods_return:100', kind: 'return', original_source_key: 'goods_sale:50',
  aftersale_id: 300, aftersale_item_id: 100, quantity: 1, business_time: '2026-10-21 10:00:00',
  recorded_at: '2026-10-21 10:00:01', amount_cents: -334, source_hash: 'b'.repeat(64) })

test('正式保存与首次发放复用真实核销编排，商品净额只加一次，重复发放不追加', async () => {
  const h = harness(null, [earned(), reversed()])
  const preview = await h.service.calculateSalary(7, period.period_start, period.period_end)
  assert.equal(preview.commission_amount, 406.66); assert.equal(preview.net_salary, 2406.66)
  assert.equal(preview.goods_commission.earned_amount, 10); assert.equal(preview.goods_commission.reversal_amount, 3.34)
  assert.equal('goods_commission_snapshot' in preview, false); assert.doesNotMatch(JSON.stringify(preview), /source_hash|source_key|salary_basis/)
  assert.equal(h.claims.length, 0)
  const saved = await h.service.saveCalculatedSalary({ ...period, expected_calculation_version: preview.calculation_version }, 9)
  assert.equal(saved.data.net_salary, 2406.66); assert.equal(h.claims.length, 0)
  const paid = await h.service.markAsPaid(saved.data.id, { expected_calculation_version: saved.data.calculation_version })
  assert.equal(paid.net_salary, 2406.66); assert.equal(h.claims.length, 2)
  assert.equal(h.claims[1].original_salary_record_id, saved.data.id)
  assert.deepEqual(await h.service.markAsPaid(saved.data.id), paid)
  assert.equal(h.claims.length, 2)
  const locked = h.queries.filter(row => /FOR UPDATE$/.test(row.sql))
  assert.match(locked[0].sql, /FROM users/)
})

test('手工提成与商品净额独立，保存和状态编辑不重复加；商品扣回可使提成为负数', async () => {
  const h = harness(null, [earned(), reversed()])
  const created = await h.service.createSalaryRecord({ ...period, commission_amount: 100 }, 9)
  assert.equal(created.data.commission_amount, 106.66); assert.equal(created.data.net_salary, 2106.66)
  const edited = await h.service.updateSalaryRecord(created.data.id, { commission_amount: 50,
    expected_calculation_version: created.data.calculation_version })
  assert.equal(edited.data.commission_amount, 56.66); assert.equal(edited.data.net_salary, 2056.66)
  const again = await h.service.updateSalaryRecord(created.data.id, { status: 'approved' })
  assert.equal(again.data.net_salary, 2056.66)
  assert.equal(h.claims.length, 0)
  assert.equal(cents(-3.34), -334)
})

test('预览到保存、保存到发放之间来源变化均409，不静默替换金额；旧版本编辑拒绝', async () => {
  const entries = [earned()], h = harness(null, entries)
  const preview = await h.service.calculateSalary(7, period.period_start, period.period_end)
  entries.push(reversed())
  await assert.rejects(h.service.saveCalculatedSalary({ ...period, expected_calculation_version: preview.calculation_version }, 9), code('SALARY_GOODS_RECALCULATION_REQUIRED'))
  assert.equal(h.record, null)
  const saved = await h.service.saveCalculatedSalary(period, 9)
  await assert.rejects(h.service.updateSalaryRecord(saved.data.id, { commission_amount: 1, expected_calculation_version: preview.calculation_version }), code('SALARY_GOODS_RECALCULATION_REQUIRED'))
  entries[0].source_hash = 'c'.repeat(64)
  await assert.rejects(h.service.markAsPaid(saved.data.id), code('SALARY_GOODS_RECALCULATION_REQUIRED'))
  assert.equal(h.record.status, 'approved'); assert.equal(h.claims.length, 0)
})

test('核销第二行写入失败时，已发状态与第一行一起回滚，重试才正式发放', async () => {
  const h = harness(null, [earned(), reversed()])
  const saved = await h.service.saveCalculatedSalary(period, 9)
  const before = structuredClone(h.record)
  h.fail('second-claim')
  await assert.rejects(h.service.markAsPaid(saved.data.id), /second-claim/)
  assert.deepEqual(h.record, before); assert.deepEqual(h.claims, [])
  h.fail(null)
  await h.service.markAsPaid(saved.data.id)
  assert.equal(h.record.status, 'paid'); assert.equal(h.claims.length, 2)
})

test('外部不能伪造已发状态或商品凭据；发放前工资金额篡改同样拒绝', async () => {
  const h = harness(null, [earned()])
  for (const patch of [{ status: 'paid' }, { paid_at: '2026-11-01 10:00:00' }, { goods_commission: {} },
    { goods_commission_snapshot: '{}' }, { calculation_version: 'x' }]) {
    await assert.rejects(h.service.createSalaryRecord({ ...period, ...patch }, 9), error => error.statusCode === 400 || error.code === 'SALARY_PAYMENT_REQUIRED')
  }
  assert.equal(h.record, null)
  const saved = await h.service.saveCalculatedSalary(period, 9)
  h.record.net_salary += 1
  await assert.rejects(h.service.markAsPaid(saved.data.id), code('SALARY_GOODS_SETTLEMENT_CONFLICT'))
  assert.equal(h.claims.length, 0)
})

test('服务器公式先按分舍入各组成再汇总，不能将合法日薪小数误判为非法手工金额', () => {
  const result = calculatedSalary({ ...original(), commission_amount: 1.005, leave_deduction: 2000 / 31,
    overtime_pay: 2.345, other_bonus: 0.01 })
  assert.equal(result.commission_amount, 1.01); assert.equal(result.leave_deduction, 64.52)
  assert.equal(result.net_salary, 1938.85)
  assert.throws(() => cents(1.001), { code: 'SALARY_GOODS_SETTLEMENT_CONFLICT' })
})

test('后期核销重核已发真实金额，原工资被改后不能把完整来源账视为正常', async () => {
  const h = harness(null, [earned()])
  const saved = await h.service.saveCalculatedSalary(period, 9)
  await h.service.markAsPaid(saved.data.id)
  const claims = structuredClone(h.claims)
  h.record.commission_amount += 1
  await assert.rejects(h.service.goods.prepare(h.connection, { ...period, through: '2026-11-13 15:00:02' }), code('SALARY_GOODS_SETTLEMENT_CONFLICT'))
  assert.deepEqual(h.claims, claims)
})

test('字段权限在写入前读取，摘要随提成字段递归遮蔽，本人只读使用本人模块', async () => {
  const Controller = require('../src/controllers/salary-record.controller').constructor
  let writes = 0
  const modules = [], mask = { async getUserFieldPermissions(_id, module, options) {
    modules.push(module); assert.equal(options.strict, true); return { hiddenFields: ['salary.commission_amount'] }
  }, filterSensitiveFields: rows => rows }
  const h = harness(null, [earned()]), saved = (await h.service.saveCalculatedSalary(period, 9)).data
  const controller = new Controller({ masking: mask, service: {
    async getSalaryRecords() { return { records: [{ ...saved, status: 'paid' }] } },
    async updateSalaryRecord() { writes++; return { data: saved } }
  } })
  controller.getSalaryScope = async () => ({ isAdmin: false })
  const response = () => ({ status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } })
  const read = response()
  await controller.getSalaryRecords({ user: { id: 7 }, query: {} }, read)
  assert.equal(read.body.data.records[0].goods_commission, null)
  assert.equal(read.body.data.records[0].commission_amount, null)
  assert.equal(modules[0], 'salary_mysalaryview')
  const denied = response()
  await controller.updateSalaryRecord({ user: { id: 9 }, params: { id: 16 }, body: { commission_amount: 5 } }, denied)
  assert.equal(denied.statusCode, 403); assert.equal(writes, 0)
  const allowed = response()
  await controller.updateSalaryRecord({ user: { id: 9 }, params: { id: 16 }, body: { status: 'approved' } }, allowed)
  assert.equal(allowed.body.data.data.goods_commission, null); assert.equal(writes, 1)
  mask.getUserFieldPermissions = async () => { throw new Error('permission unavailable') }
  const failed = response()
  await controller.updateSalaryRecord({ user: { id: 9 }, params: { id: 16 }, body: {} }, failed)
  assert.equal(failed.statusCode, 500); assert.equal(writes, 1)
})

test('重算保存按锁定后的存在状态核对create或edit权限，拒绝时不写工资', async () => {
  const Controller = require('../src/controllers/salary-record.controller').constructor
  for (const existing of [false, true]) {
    const h = harness(existing ? original() : null, []), actions = []
    const controller = new Controller({ service: h.service, masking: {
      async getUserFieldPermissions() { return { hiddenFields: [] } }, filterSensitiveFields: rows => rows
    }, async hasPermission(_user, module, action, connection) {
      assert.equal(module, 'salary_salaryrecordsview'); assert.equal(typeof connection.execute, 'function')
      actions.push(action); return false
    } })
    const before = structuredClone(h.record), res = { status(value) { this.statusCode = value; return this }, json(body) { this.body = body; return this } }
    await controller.saveCalculatedSalary({ body: period, user: { id: 9 } }, res)
    assert.equal(res.statusCode, 403); assert.deepEqual(actions, [existing ? 'edit' : 'create'])
    assert.deepEqual(h.record, before); assert.equal(h.claims.length, 0)
    assert.equal(h.queries.some(row => /^(UPDATE|INSERT)/.test(row.sql)), false)
  }
})

test('手工金额非法精度、非数值及伪状态在事务前拒绝，不由数据库隐式转换', async () => {
  const h = harness(null)
  for (const value of [true, null, {}, [], '100元', '1e3', 1.001, Infinity, 100000000]) {
    await assert.rejects(h.service.createSalaryRecord({ ...period, commission_amount: value }, 9), code('SALARY_RECORD_INVALID'))
  }
  await assert.rejects(h.service.createSalaryRecord({ ...period, status: 'fake' }, 9), code('SALARY_RECORD_INVALID'))
  assert.equal(h.calls.length, 0)
})
