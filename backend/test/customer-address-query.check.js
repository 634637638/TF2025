'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const XLSX = require('xlsx')
const CustomerManagementService = require('../src/services/customer-management.service')
const CustomerRepository = require('../src/repositories/customer.repository')
const CustomerExportService = require('../src/services/customer-export.service')
const { service: customerFields } = require('../src/services/customer-field-access.service')

test('新版列表搜索按结构能力展开地区；隐藏地址和单独地区均不能通过搜索推断', async () => {
  const captured = []
  const service = new CustomerManagementService({
    repository: { listCustomers: async options => { captured.push(options); return { customers: [], total: 0 } } },
    addresses: { capabilities: async () => ({ ready: true }), enrich: async rows => rows }
  })
  await service.list({ search: '乡镇', search_fields: 'address', include_address_levels: '1' })
  assert.equal(captured[0].filters.search_fields, 'address,district,town,village')
  await service.list({ search: '乡镇', search_fields: 'address,town', include_address_levels: '1' }, { hiddenFields: ['customer.town'] })
  assert.equal(captured[1].filters.search_fields, '__none__')
  await assert.rejects(service.list({ province: '11' }, { hiddenFields: ['customer.province'] }), { statusCode: 403 })
  const repository = new CustomerRepository()
  const sql = []
  repository.executeQuery = async (query, params) => { sql.push([query, params]); return query.includes('COUNT(*) as total') ? [{ total: 0 }] : [] }
  await repository.listCustomers(captured[0])
  assert.ok(sql[0][0].includes('c.town LIKE ?'))
  assert.ok(sql[0][1].includes('%乡镇%'))
  await repository.listCustomers(captured[1])
  assert.ok(sql[2][0].includes('1 = 0'))
  assert.equal(sql[2][0].includes('c.town LIKE ?'), false)
})

test('单条详情返回独立字段，不返回内部旧地址备份', async () => {
  const service = new CustomerManagementService({
    repository: { findCustomerById: async () => ({ id: 1, address: '门牌' }) },
    addresses: { enrich: async rows => rows.map(row => ({ ...row, district: '东城区', town: '东华门街道' })) }
  })
  assert.equal((await service.getById({ id: '1' })).data.town, '东华门街道')
})

test('二进制客户导出分页、过滤与地址字段权限一致，公式文本不执行', async () => {
  const captured = []
  const customers = { list: async (query, permissions) => {
    captured.push([query, permissions])
    return { data: { customers: [{ name: '=1+1', phone: '不应导出', town: '不可见乡镇', address: '包含隐藏乡镇' }], pagination: { total: 101, has_next: query.page === 1 } } }
  } }
  const permissions = { hiddenFields: ['customer.town', 'customer.phone'] }
  const buffer = await new CustomerExportService({ customers }).export({ keyword: '筛选', status: '' }, permissions)
  const sheet = XLSX.read(buffer, { type: 'buffer' }).Sheets['客户']
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  assert.equal(captured.length, 2)
  assert.equal(captured[0][0].search, '筛选')
  assert.equal(captured[1][0].status, '')
  assert.equal(captured[0][1], permissions)
  assert.equal(JSON.stringify(rows).includes('不可见'), false)
  assert.equal(JSON.stringify(rows).includes('包含隐藏'), false)
  assert.equal(rows[0].includes('电话'), false)
  const nameColumn = rows[0].indexOf('姓名')
  const cell = sheet[XLSX.utils.encode_cell({ r: 1, c: nameColumn })]
  assert.equal(cell.t, 's')
  assert.equal(cell.v, '=1+1')
  assert.equal(cell.f, undefined)
  await assert.rejects(new CustomerExportService({ customers }).export({}, undefined), { statusCode: 403 })
})

test('隐藏详细地址时多层响应和导出前脱敏不会泄露独立层级', () => {
  const masked = customerFields.maskPayload({ data: [{ town: '某乡', district: '某县', address: '地址', legacy_address: '历史地址' }] }, { hiddenFields: ['customer.address'] })
  assert.ok(Object.values(masked.data[0]).every(value => value === null))
})
