'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeReturnStockInfo } = require('../src/services/return-stock-validation')
const QueryMutationService = require('../src/services/query-mutation.service')
const QueryRepository = require('../src/repositories/query.repository')
const QueryService = require('../src/services/query.service')
const QueryController = require('../src/controllers/query.controller')
const { migrate, COLUMNS } = require('../scripts/migrate-return-stock-details')
const log = require('../src/utils/log')

log.error = () => {}
const details = {
  return_reason: '客户退货', return_type: '申请换货', handle_method: '返厂维修',
  refund_amount: 1200.5, refund_method: 'cash', refund_channel: null, reversal_date: '2026-11-08T09:30', remarks: '保留原始配件'
}
const scope = { allStores: false, storeIds: [3] }

test('退库类型仅允许退货处理、申请换货，备注不覆盖其他字段', () => {
  for (const type of ['退货处理', '申请换货']) {
    assert.deepEqual(normalizeReturnStockInfo({ ...details, return_type: type }), {
      ...details, return_type: type, reversal_date: '2026-11-08 09:30:00'
    })
  }
  for (const type of ['整单退库', '部分退库', '换货']) {
    assert.throws(() => normalizeReturnStockInfo({ ...details, return_type: type }), /退库类型/)
  }
})

test('退库四个选择框必选，金额和时间必填，0元正常保存', () => {
  for (const field of ['return_reason', 'return_type', 'handle_method', 'refund_method', 'refund_amount', 'reversal_date']) {
    for (const value of [null, '', undefined]) {
      assert.throws(() => normalizeReturnStockInfo({ ...details, [field]: value }), { statusCode: 400 })
    }
  }
  assert.equal(normalizeReturnStockInfo({ ...details, refund_amount: 0 }).refund_amount, 0)
})

test('退款方式使用全局现金、移动支付、银行卡编码，并保留原路退回', () => {
  for (const method of ['cash', 'mobile', 'bank_card', '原路退回']) {
    const channel = require('../src/config/payment-methods.json').channels[method]?.[0]?.value || null
    assert.equal(normalizeReturnStockInfo({ ...details, refund_method: method, refund_channel: channel }).refund_method, method)
    assert.equal(normalizeReturnStockInfo({ refund_method: method, refund_channel: channel }, { partial: true }).refund_method, method)
  }
  for (const method of ['现金退款', '现金支付', '移动支付', '银行卡', '银行转账', '支付宝', '微信支付', 'wechat', 'alipay', 'bank_transfer', 'subsidy_card']) {
    assert.throws(() => normalizeReturnStockInfo({ ...details, refund_method: method }), { statusCode: 400 })
  }
})

test('退款渠道从全局配置校验，移动及银行卡必选，方式与渠道不能错配', () => {
  const paymentOptions = require('../src/config/payment-methods.json')
  for (const [method, channels] of Object.entries(paymentOptions.channels)) {
    if (method === 'subsidy_card') continue
    for (const channel of channels) {
      const result = normalizeReturnStockInfo({ ...details, refund_method: method, refund_channel: channel.value })
      assert.equal(result.refund_channel, channel.value)
    }
    for (const channel of ['', null, 'invalid']) assert.throws(() => normalizeReturnStockInfo({ ...details, refund_method: method, refund_channel: channel }), /退款渠道/)
  }
  for (const [method, channel] of [['mobile', 'bank_transfer'], ['bank_card', 'wechat'], ['cash', 'alipay'], ['原路退回', 'wechat']]) {
    assert.throws(() => normalizeReturnStockInfo({ ...details, refund_method: method, refund_channel: channel }), /退款渠道/)
  }
  assert.throws(() => normalizeReturnStockInfo({ refund_channel: 'wechat' }, { partial: true }), /同时提交退款方式/)
  assert.deepEqual(normalizeReturnStockInfo({ refund_method: 'cash' }, { partial: true }), { refund_method: 'cash', refund_channel: null })
  paymentOptions.channels.mobile.push({ label: '新增移动渠道', value: 'new_mobile_channel' })
  try {
    assert.equal(normalizeReturnStockInfo({ ...details, refund_method: 'mobile', refund_channel: 'new_mobile_channel' }).refund_channel, 'new_mobile_channel')
  } finally { paymentOptions.channels.mobile.pop() }
})

test('金额拒绝负值、非数、超范围和三位小数，日期拒绝不存在日期及空值', () => {
  for (const value of [-1, NaN, Infinity, true, [], {}, 100000000, '12.345', '1e3', '0x10', '12元', '12\n', ' ']) {
    assert.throws(() => normalizeReturnStockInfo({ ...details, refund_amount: value }), /退款金额/)
  }
  for (const value of ['2026-02-30T12:00', '2026-11-08T25:00', '错误日期']) {
    assert.throws(() => normalizeReturnStockInfo({ ...details, reversal_date: value }), /退库时间/)
  }
  assert.equal(normalizeReturnStockInfo({ ...details, reversal_date: '2026-11-08T01:30:00Z' }).reversal_date, '2026-11-08 09:30:00')
  assert.equal(normalizeReturnStockInfo({ ...details, refund_amount: 0.29 }).refund_amount, 0.29)
})

test('退库编辑拒绝部分解析的销售员ID及非法姓名、备注，空关联与合法标点保留', async () => {
  const service = new QueryService()
  let saved
  service.queryRepository = { async updateReturnGoodsRecord(id, fields) { saved = { id, fields } } }
  for (const payload of [{ original_sale_operator_id: '2abc' }, { original_sale_operator_id: '1e3' },
    { original_sale_operator_id: false }, { original_sale_operator_name: {} }, { original_sale_operator_name: '张\n三' },
    { remarks: 'a\u0000b' }]) {
    await assert.rejects(service.updateReturnGoodsRecord(1, payload), { statusCode: 400 })
    assert.equal(saved, undefined)
  }
  await service.updateReturnGoodsRecord(1, { original_sale_operator_id: null, original_sale_operator_name: null })
  assert.deepEqual(saved.fields, { original_sale_operator_id: null, original_sale_operator_name: null })
  await service.updateReturnGoodsRecord(1, { original_sale_operator_id: '2', original_sale_operator_name: "Anne·张 O'Neil" })
  assert.deepEqual(saved.fields, { original_sale_operator_id: 2, original_sale_operator_name: "Anne·张 O'Neil" })
})

test('缺失字段在租借连接与积分冲回之前即返回400', async () => {
  let calls = 0
  const service = new QueryMutationService({ repository: { withConnection() { calls++ } } })
  await assert.rejects(service.returnToStock(1, 2, {}), { statusCode: 400 })
  assert.equal(calls, 0)
})

test('零售、批发、划拨撤销共用积分入口、完整日志与同一事务，选择不分支执行报废', async () => {
  for (const status of ['sold', 'peer_transfer', 'supplier_proxy']) {
    const events = []
    const connection = {
      async beginTransaction() { events.push('begin') },
      async commit() { events.push('commit') },
      async rollback() { events.push('rollback') }
    }
    const repository = {
      async withConnection(action) { return action(connection) },
      async lockPhoneForReturn(conn) { assert.equal(conn, connection); return [[{ status, store_id: 3 }]] },
      async lockLatestSaleForReturn() { return [[{ id: 21, customer_id: 8 }]] },
      async deleteSaleById() { events.push('delete-sale'); return [{ affectedRows: 1 }] },
      async restoreReturnedPhone() { events.push('restore'); return [{ affectedRows: 1 }] },
      async insertReversalLog(conn, ...args) {
        assert.equal(conn, connection)
        assert.equal(args[2], status)
        assert.deepEqual(args.at(-1), normalizeReturnStockInfo({ ...details, handle_method: '报废处理' }))
        events.push('log')
      }
    }
    const service = new QueryMutationService({ repository, reversePoints: async ({ executor, saleId }) => {
      assert.equal(executor, connection)
      assert.equal(saleId, 21)
      events.push('points')
    } })
    await service.returnToStock(12, 7, { ...details, handle_method: '报废处理' }, scope)
    assert.deepEqual(events, ['begin', 'points', 'delete-sale', 'restore', 'log', 'commit'])
  }
})

test('积分或明细日志写入失败都回滚，不提交', async () => {
  for (const failure of ['points', 'log']) {
    const events = []
    const connection = {
      async beginTransaction() {}, async commit() { events.push('commit') }, async rollback() { events.push('rollback') }
    }
    const repository = {
      async withConnection(action) { return action(connection) },
      async lockPhoneForReturn() { return [[{ status: 'sold', store_id: 3 }]] },
      async lockLatestSaleForReturn() { return [[{ id: 21 }]] },
      async deleteSaleById() { return [{ affectedRows: 1 }] },
      async restoreReturnedPhone() { return [{ affectedRows: 1 }] },
      async insertReversalLog() { throw new Error('log-failed') }
    }
    const service = new QueryMutationService({ repository, reversePoints: async () => {
      if (failure === 'points') throw new Error('points-failed')
    } })
    await assert.rejects(service.returnToStock(12, 7, details, scope), new RegExp(`${failure}-failed`))
    assert.deepEqual(events, ['rollback'])
  }
})

test('仓储插入显式保存选择时间、独立备注和退款0元，不使用NOW替换业务时间', async () => {
  const repository = new QueryRepository()
  let inserted
  await repository.insertReversalLog({ async execute(sql, values) { inserted = { sql, values } } },
    12, 21, 'sold', 8, 5, '销售员', 7, normalizeReturnStockInfo({ ...details, refund_amount: 0, refund_method: 'mobile', refund_channel: 'alipay' }))
  assert.equal(inserted.values[7], '2026-11-08 09:30:00')
  assert.equal(inserted.values[8], '保留原始配件')
  assert.equal(inserted.values[12], 0)
  assert.equal(inserted.values[13], 'mobile')
  assert.equal(inserted.values[14], 'alipay')
  assert.equal((inserted.sql.match(/\?/g) || []).length, inserted.values.length)
})

test('查询、搜索与编辑覆盖结构化明细，部分编辑不擦除原信息', async () => {
  const repository = new QueryRepository()
  const queries = []
  repository.withConnection = action => action({
    async execute() {}, async beginTransaction() {}, async rollback() {},
    async query(sql, params) {
    queries.push({ sql, params })
    assert.equal((sql.match(/\?/g) || []).length, params.length)
    if (sql.includes('SELECT COUNT(*) AS total ')) return [[{ total: 1 }]]
    if (sql.includes('AS total_records')) return [[{ total_records: 1 }]]
    for (const [name] of COLUMNS) assert.ok(sql.includes(`srl.${name}`))
    return [[{ id: 1, ...normalizeReturnStockInfo(details) }]]
  } })
  const result = await repository.getReturnGoodsRecords({ keyword: '申请换货', start_date: '2026-11-01' }, scope)
  assert.equal(result.data[0].return_type, '申请换货')
  assert.equal(result.pagination.total, 1)
  assert.equal(queries.length, 3)

  const service = new QueryService()
  service.queryRepository = { async updateReturnGoodsRecord(id, fields, storeScope) {
    assert.equal(id, 1)
    assert.deepEqual(fields, { remarks: '仅改备注' })
    assert.deepEqual(storeScope, scope)
  } }
  await service.updateReturnGoodsRecord(1, { remarks: '仅改备注' }, scope)
  await assert.rejects(service.updateReturnGoodsRecord(1, { refund_method: '' }, scope), { statusCode: 400 })
})

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })

test('退库记录字段权限在服务端脱敏，隐藏退款字段不能通过编辑请求写入', async () => {
  const controller = new QueryController({
    service: { async getReturnGoodsRecords() { return { message: '查询成功', data: [{ id: 1, ...details, collection_amount: 12, refund_method: 'mobile', refund_channel: 'wechat' }], pagination: { total: 1 }, stats: { total_records: 1 } } } },
    masking: {
      async getUserFieldPermissions(userId, moduleKey) {
        assert.equal(moduleKey, 'system_returngoods')
        return { hiddenFields: ['record.refund_amount', 'record.refund_method'] }
      },
      filterSensitiveFields(rows) { return rows }
    }
  })
  const req = { user: { id: 1, is_admin: true }, query: {} }
  const res = response()
  await controller.getReturnGoodsRecords(req, res)
  assert.equal(res.body.data[0].refund_amount, null)
  assert.equal(res.body.data[0].collection_amount, null)
  assert.equal(res.body.data[0].refund_method, null)
  assert.equal(res.body.data[0].refund_channel, null)
  assert.equal(res.body.data[0].return_type, '申请换货')
  assert.equal(res.body.pagination.stats.total_records, 1)
  const denied = response()
  await controller.rejectHiddenReturnGoodsWrites()({ ...req, body: { refund_amount: 0 } }, denied, () => assert.fail('隐藏字段不应放行'))
  assert.equal(denied.statusCode, 403)
  const channelDenied = response()
  await controller.rejectHiddenReturnGoodsWrites()({ ...req, body: { refund_channel: 'wechat' } }, channelDenied, () => assert.fail('隐藏渠道不应放行'))
  assert.equal(channelDenied.statusCode, 403)
})

test('退库请求缺必填时控制器返回400及业务错误码', async () => {
  const controller = new QueryController()
  const res = response()
  await controller.returnToStock({ user: { id: 1, is_admin: true }, params: { id: 12 }, body: {} }, res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.code, 'INVALID_RETURN_STOCK')
})

test('迁移默认只预览、重复执行幂等、有明细拒绝回滚且不回填历史', async () => {
  let applied = false
  const writes = []
  const db = { async execute(sql) {
    if (sql.includes('information_schema')) return [[
      { COLUMN_NAME: 'reversal_date' }, { COLUMN_NAME: 'created_at' },
      ...(applied ? COLUMNS.map(([COLUMN_NAME, COLUMN_TYPE]) => ({ COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE: 'YES' })) : [])
    ]]
    if (sql.includes('COUNT(*)')) return [[{ total: 1 }]]
    writes.push(sql)
    applied = true
    return [{}]
  } }
  assert.equal((await migrate(db)).status, 'dry_run')
  assert.equal(writes.length, 0)
  assert.equal((await migrate(db, { apply: true })).status, 'migrated_and_verified')
  assert.equal((await migrate(db, { apply: true })).status, 'already_ready')
  assert.equal(writes.length, 1)
  assert.match(writes[0], /^ALTER TABLE/)
  await assert.rejects(migrate(db, { rollback: true }), /拒绝删除字段/)
  assert.equal(writes.length, 1)
})


test('联合手机退库与旧日志共用分页、统计和搜索；双门店范围及原手机快照保留', async () => {
  const repository = new QueryRepository(), events = [], reads = []
  const rows = [
    { id: 'aftersale:1:6', record_source: 'sales_aftersale', original_sale_id: 21, refund_amount: '0', collection_amount: '20' },
    { id: '1', record_source: 'legacy', original_sale_id: 20, refund_amount: '10' }
  ]
  repository.withConnection = action => action({
    async execute(sql) { assert.match(sql, /REPEATABLE READ, READ ONLY/); events.push('readonly') },
    async beginTransaction() { events.push('begin') },
    async rollback() { events.push('rollback') },
    async query(sql, params) {
      events.push('read'); reads.push({ sql, params })
      assert.equal((sql.match(/\?/g) || []).length, params.length)
      assert.match(sql, /UNION ALL/)
      assert.match(sql, /a.operation_type = 'phone_return'/)
      assert.match(sql, /a.original_store_id IN \(\?\)/)
      assert.match(sql, /a.store_id IN \(\?\)/)
      assert.match(sql, /i.item_type = 'phone'/)
      assert.match(sql, /i.order_id = a.order_id/)
      assert.match(sql, /JSON_EXTRACT\(i.snapshot, '\$.imei'\)/)
      assert.match(sql, /DATE\(r.reversal_date\) >= \?/)
      assert.match(sql, /DATE\(r.reversal_date\) <= \?/)
      assert.deepEqual(params.slice(0, 3), [3, 3, 3])
      assert.deepEqual(params.slice(3, 19), Array(16).fill('%退货%'))
      if (sql.includes('SELECT COUNT(*) AS total ')) return [[{ total: 2 }]]
      if (sql.includes('AS total_records')) return [[{ total_records: 2, total_phones: 1, total_days: 1 }]]
      assert.deepEqual(params.slice(-2), [1, 1])
      return [rows]
    }
  })
  const result = await repository.getReturnGoodsRecords({ page: 2, page_size: 1, keyword: '退货', start_date: '2026-11-01', end_date: '2026-11-14' }, scope)
  assert.equal(result.data[0].id, 'aftersale:1:6')
  assert.equal(result.data[1].id, 1)
  assert.equal(result.data[0].collection_amount, '20')
  assert.equal(result.pagination.total, 2)
  assert.equal(result.pagination.has_prev, true)
  assert.deepEqual(result.stats, { total_records: 2, total_phones: 1, total_days: 1 })
  assert.deepEqual(events, ['readonly', 'begin', 'read', 'read', 'read', 'rollback'])
  assert.equal(reads.length, 3)
})

test('售后来源ID、畸形ID不能到达旧编辑删除SQL，合法旧ID正常保留', async () => {
  const service = new QueryService(), calls = []
  service.queryRepository = {
    async updateReturnGoodsRecord(id) { calls.push(['update', id]) },
    async deleteReturnGoodsRecord(id) { calls.push(['delete', id]) }
  }
  for (const id of ['aftersale:1:6', '1abc', '1e3', '1 OR 1=1', -1, 0, null, true, {}]) {
    await assert.rejects(service.updateReturnGoodsRecord(id, { remarks: '不应保存' }, scope), { statusCode: 400 })
    await assert.rejects(service.deleteReturnGoodsRecord(id, scope), { statusCode: 400 })
  }
  assert.equal(calls.length, 0)
  await service.updateReturnGoodsRecord('1', { remarks: '保留旧日志编辑' }, scope)
  await service.deleteReturnGoodsRecord('1', scope)
  assert.deepEqual(calls, [['update', 1], ['delete', 1]])
  const controller = new QueryController({ service })
  for (const action of ['updateReturnGoodsRecord', 'deleteReturnGoodsRecord']) {
    const res = response()
    await controller[action]({ user: { id: 1, is_admin: true }, params: { id: 'aftersale:1:6' }, body: {}, query: {} }, res)
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.code, 'RETURN_GOODS_READ_ONLY')
  }
})

test('售后结构缺失明确拒绝，读取异常回滚不提交、不吞成空记录', async () => {
  for (const code of ['ER_NO_SUCH_TABLE', 'READ_FAILED']) {
    const repository = new QueryRepository(), events = []
    repository.withConnection = action => action({
      async execute() {}, async beginTransaction() {}, async rollback() { events.push('rollback') },
      async query() { throw Object.assign(new Error('模拟读取失败'), { code }) }
    })
    if (code === 'ER_NO_SUCH_TABLE') {
      const service = new QueryService(); service.queryRepository = repository
      const controller = new QueryController({ service }), res = response()
      await controller.getReturnGoodsRecords({ user: { id: 1, is_admin: true }, query: {} }, res)
      assert.equal(res.statusCode, 409)
      assert.equal(res.body.code, 'CHECKOUT_RETURN_NOT_READY')
    } else await assert.rejects(repository.getReturnGoodsRecords({}, scope), /模拟读取失败/)
    assert.deepEqual(events, ['rollback'])
  }
})
