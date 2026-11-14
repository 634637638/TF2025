'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const XLSX = require('xlsx')

// 独立临时上传根目录；测试不使用业务文件或真实数据库。
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-import-input-'))
const originalUploadPath = process.env.UPLOAD_PATH
process.env.UPLOAD_PATH = temporary
const DataImportService = require('../src/services/data-import.service')
if (originalUploadPath === undefined) delete process.env.UPLOAD_PATH
else process.env.UPLOAD_PATH = originalUploadPath
test.after(() => fs.rmSync(temporary, { recursive: true, force: true }))

const createService = t => {
  const service = new DataImportService()
  t.after(() => clearInterval(service.cleanupTimer))
  service.getOrCreate = async () => null
  service.getOrCreateUser = async () => null
  service.getOrCreateCustomer = async () => { throw new Error('非法输入不应创建客户') }
  return service
}
const maps = () => Object.fromEntries(['brands', 'models', 'colors', 'memories', 'suppliers', 'stores', 'customers', 'users'].map(key => [key, new Map()]))

for (const strategy of ['skip', 'smart', 'overwrite', 'merge', 'replace_all']) {
  test(`${strategy} 在任何 SQL/客户写入前拒绝非法金额`, async t => {
    const service = createService(t)
    for (const field of ['入库价', '销售价']) {
      for (const value of ['12元', '12abc', '1e3', '0x10', '12\n', '1.234', -1, true, {}, [], Infinity]) {
        let calls = 0
        const connection = { async execute() { calls++; throw new Error('不应执行 SQL') } }
        await assert.rejects(service.importRow(connection, { IMEI: '123456789012345', 手机号: '13800138000', [field]: value }, maps(), strategy), new RegExp(field))
        assert.equal(calls, 0)
      }
    }
  })
}

test('新增保留合法零、文本金额及空值', async t => {
  const service = createService(t)
  for (const [input, expected] of [[0, 0], ['0.00', 0], [' 12.50 ', 12.5], ['', null], [null, null]]) {
    let inserted
    const connection = { async execute(sql, values) {
      if (sql.includes('INSERT INTO phones')) { inserted = values; return [{ insertId: 1 }] }
      return [[]]
    } }
    const result = await service.importRow(connection, { IMEI: '123456789012345', 入库价: input, 销售价: input }, maps(), 'skip')
    assert.equal(result.status, 'imported')
    assert.deepEqual(inserted.slice(11, 13), [expected, expected])
  }
})

test('合并空金额保持旧值，显式零金额参与更新', async t => {
  const service = createService(t)
  for (const [value, updatesAmount] of [['', false], [null, false], [0, true], ['12.50', true]]) {
    let update
    const connection = { async execute(sql, values) {
      if (sql.includes('UPDATE phones')) { update = { sql, values }; return [{}] }
      return [[{ id: 1, imei: '123456789012345', serial_number: null }]]
    } }
    await service.importRow(connection, { IMEI: '123456789012345', 入库价: value, 销售价: value }, maps(), 'merge')
    assert.equal(Boolean(update?.sql.includes('purchase_cost = ?')), updatesAmount)
    assert.equal(Boolean(update?.sql.includes('sale_price = ?')), updatesAmount)
    if (updatesAmount) assert.deepEqual(update.values.slice(0, 2), [Number(value), Number(value)])
  }
})

test('完全替换在任何清空、单号结构或事务操作前预检整份表格', async t => {
  const service = createService(t)
  const directory = path.join(temporary, 'import')
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, 'invalid.xlsx')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { IMEI: '123456789012345', 入库价: '12.50' },
    { IMEI: '123456789012346', 入库价: '12元' }
  ]), '数据')
  XLSX.writeFile(workbook, file)
  const events = []
  service.getPool = () => ({ async getConnection() { return {
    async execute() { events.push('sql'); throw new Error('不应执行 SQL') },
    async beginTransaction() { events.push('begin') },
    release() { events.push('release') }
  } } })
  await assert.rejects(service.importData(file, { strategy: 'replace_all' }), /第 3 行.*入库价/)
  assert.deepEqual(events, ['release'])
})

test('导入姓名、手机号和编码在查询及写入前复用公共校验', async t => {
  const service = createService(t)
  const row = { IMEI: '123456789012345', 客户姓名: "阿不都·O'Connor", 手机号: '+86 138-0013-8000' }
  for (const change of [
    { 客户姓名: '1234' }, { 客户姓名: '姓名\n' }, { 手机号: '138a00138000' }, { 手机号: true },
    { 序列号: 123456 }, { IMEI: '中文设备', 序列号: '中文设备' }, { 序列号: 'ABCD--1' },
    { IMEI: '123456789012345abc' }, { 供应商: {} }, { 型号: '型号\n' }
  ]) {
    let calls = 0
    await assert.rejects(service.importRow({ async execute() { calls++; return [[]] } }, { ...row, ...change }, maps(), 'skip'))
    assert.equal(calls, 0)
  }
  let queryParams
  const connection = { async execute(_sql, values) {
    queryParams = values
    return [[{ id: 1, imei: row.IMEI }]]
  } }
  let customerRow
  service.getOrCreateCustomer = async (_connection, value) => { customerRow = value; return 1 }
  await service.importRow(connection, { ...row, IMEI: 123456789012345 }, maps(), 'skip')
  assert.deepEqual(queryParams, ['', row.IMEI])
  assert.equal(customerRow['手机号'], '13800138000')
  assert.equal(customerRow['客户姓名'], row['客户姓名'])
})

test('分析无效表格返回行号与字段错误，不执行数据库语句', async t => {
  const service = createService(t)
  const directory = path.join(temporary, 'import')
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, 'invalid-analysis.xlsx')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ IMEI: '123456789012345', 手机号: '138a00138000' }]), '数据')
  XLSX.writeFile(workbook, file)
  const events = []
  service.getPool = () => ({ async getConnection() { return {
    async execute() { events.push('sql'); throw new Error('不应查询') },
    release() { events.push('release') }
  } } })
  await assert.rejects(service.analyzeData(file), error => error.statusCode === 400 && error.code === 'IMPORT_INPUT_INVALID' && /第 2 行.*手机号/.test(error.message))
  assert.deepEqual(events, ['release'])
})
