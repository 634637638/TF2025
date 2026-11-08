'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const XLSX = require('xlsx')
const PriceListManagementService = require('../src/services/price-list-management.service')
const { PAGINATION } = require('../src/config/constants')

function createService(query, methods = {}) {
  const pool = { query }
  return new PriceListManagementService({
    database: () => pool,
    priceService: () => ({ setDatabase() {}, ...methods }),
    restartScheduler: async () => {}
  })
}

test('价目维护拒绝空历史 ID，非空批量 ID 通过绑定值传递', async () => {
  const calls = []
  const service = createService(async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 2 }] })
  await assert.rejects(service.batchDeletePriceHistory({ historyIds: [] }, { id: 7 }), error => error.statusCode === 400)
  assert.equal(calls.length, 0)
  const ids = [1, '2) OR 1=1']
  const result = await service.batchDeletePriceHistory({ historyIds: ids }, { id: 7 })
  assert.equal(result.message, '成功删除 2 条记录')
  assert.deepEqual(calls[0].params, [...ids, 7])
  assert.match(calls[0].sql, /id IN \(\?,\?\) AND price_list_id = \?/)
  assert.equal(calls[0].sql.includes(ids[1]), false)
})

test('价目同步日志不存在时拒绝删除，清空仍使用原有 TRUNCATE', async () => {
  const calls = []
  const service = createService(async sql => { calls.push(sql); return [[]] })
  await assert.rejects(service.deleteSyncLog({ id: 7 }), error => error.statusCode === 404)
  assert.equal(calls.length, 1)
  await service.clearSyncLogs()
  assert.equal(calls[1], 'TRUNCATE TABLE price_sync_log')
})

test('全部来源同步保持执行顺序、共同批次和成功失败汇总', async () => {
  const calls = []
  const service = createService(async () => [[{ id: 2 }, { id: 5 }]], {
    async executeSync(...args) {
      calls.push(args)
      return calls.length === 1 ? { success: true, data: { total: 3, success: 2, failed: 1 } } : { success: false, message: 'source failed' }
    }
  })
  const result = await service.triggerSync({}, { configId: 'all' }, { id: 7 })
  assert.deepEqual(calls.map(args => args.slice(0, 3)), [[2, 'manual', 7], [5, 'manual', 7]])
  assert.equal(calls[0][3].syncBatchId, calls[1][3].syncBatchId)
  assert.equal(calls[0][3].syncTime, calls[1][3].syncTime)
  assert.equal(result.data.total, 3)
  assert.equal(result.data.success, 2)
  assert.equal(result.data.failed, 2)
})

test('价目导入在 service 校验行并规范化金额与状态，保持逐行汇总', async () => {
  const payloads = []
  const service = createService(async () => [[]], { async upsertPriceItem(payload, sourceId, options) {
    payloads.push({ payload, sourceId, options })
    return { success: true }
  } })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { 品牌: ' 苹果 ', 型号: ' iPhone 16 ', 零售价: '1,234', 批发价: '20%', 显示状态: '显示' },
    { 品牌: '', 型号: '缺品牌' }
  ]), '报价')
  const result = await service.importPriceList({ buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) })
  assert.equal(result.data.imported, 1)
  assert.equal(result.data.failed, 1)
  assert.match(result.data.errors[0], /第 3 行缺少品牌或型号/)
  assert.equal(payloads[0].payload.brand_name, '苹果')
  assert.equal(payloads[0].payload.retail_price, 1234)
  assert.equal(payloads[0].payload.wholesale_price, 20)
  assert.equal(payloads[0].payload.show_price, 1)
  assert.deepEqual(payloads[0].options, { allowCreate: true, isManualEdit: true, changeReason: 'import' })
})

test('价目导出在 service 生成工作簿并保留查询范围和列字段', async () => {
  let filters
  const service = createService(async () => [[]], { async getPriceList(query) {
    filters = query
    return { success: true, data: { list: [{ brand_name: '苹果', model_number: 'iPhone 16', retail_price: 12 }] } }
  } })
  const result = await service.exportPriceList({ brand_name: '苹果' })
  assert.deepEqual(filters, { brand_name: '苹果', page: PAGINATION.DEFAULT_PAGE, limit: PAGINATION.DEFAULT_LIMIT })
  assert.match(result.filename, /^报价管理_\d{4}-\d{2}-\d{2}\.xlsx$/)
  const workbook = XLSX.read(result.buffer, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['报价管理'])
  assert.equal(rows[0]['品牌'], '苹果')
  assert.equal(rows[0]['零售价'], 12)
})
