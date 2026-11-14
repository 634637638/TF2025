'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const CustomerAddressService = require('../src/services/customer-address.service')
const { COLUMNS } = require('../src/config/customer-address')
const { migrate, rollback } = require('../scripts/migrate-customer-address')
const FieldAccessService = require('../src/services/field-access.service')
const createFieldAccessMiddleware = require('../src/middleware/field-access')

const selection = { province: '11', city: '市辖区', district: '东城区', town: '东华门街道', village: '多福巷社区居委会' }

test('五级地址独立存储、原地址备份和跨层级验证，历史空字段不触发迁移', async () => {
  const service = new CustomerAddressService({ repository: { getCustomerColumns: async () => new Set(Object.keys(COLUMNS)) } })
  const prepared = await service.prepare(selection, { address: '东城区 旧门牌' })
  assert.deepEqual(prepared, { district: selection.district, town: selection.town, village: selection.village,
    region_version: '2023-06-30', legacy_address: '东城区 旧门牌' })
  assert.equal((await service.prepare({ ...selection, city: '北京市' })).district, '东城区')
  await assert.rejects(service.prepare({ ...selection, province: '44' }), { statusCode: 400 })
  await assert.rejects(service.prepare({ ...selection, town: '伪造乡镇' }), { statusCode: 400 })
  await assert.rejects(service.prepare({ ...selection, village: [] }), { statusCode: 400 })
  assert.deepEqual(await service.prepare({ district: '', town: '', village: '' }, { address: '不能识别的历史地址' }), {})
  const notReady = new CustomerAddressService({ repository: { getCustomerColumns: async () => new Set(['address']) } })
  await assert.rejects(notReady.prepare(selection), { statusCode: 409, code: 'ADDRESS_SCHEMA_REQUIRED' })
})

test('变更上级自动清除未提交的下级，旧备份不覆盖且读响应不泄露原地址', async () => {
  const repository = {
    getCustomerColumns: async () => new Set(Object.keys(COLUMNS)),
    getCustomerAddressFields: async () => [{ id: 1, district: '东城区', town: null, village: null, region_version: '2023-06-30', legacy_address: '原始地址' }]
  }
  const service = new CustomerAddressService({ repository })
  const previous = { ...selection, region_version: '2023-06-30', address: '门牌', legacy_address: '原始地址' }
  const changed = await service.prepare({ district: '西城区' }, previous)
  assert.equal(changed.district, '西城区')
  assert.equal(changed.town, null)
  assert.equal(changed.village, null)
  assert.equal(Object.hasOwn(changed, 'legacy_address'), false)
  const [visible] = await service.enrich([{ id: 1, address: '门牌' }])
  assert.equal(visible.town, '')
  assert.equal(Object.hasOwn(visible, 'legacy_address'), false)
})

test('公共字段中间件拒绝隐藏地址写入、递归脱敏，权限失败不放行业务', async () => {
  const masking = { getUserFieldPermissions: async (_id, _module, options) => {
    assert.equal(options.strict, true)
    return { hiddenFields: ['customer.town'] }
  }, filterSensitiveFields: rows => rows }
  const fields = createFieldAccessMiddleware(new FieldAccessService({ moduleKey: 'customers_customersview', strict: true,
    responseKeys: { 'customer.town': ['town', 'address'] }, masking })).protectFields({ town: 'customer.town' })
  const response = () => ({ status(code) { this.statusCode = code; return this }, json(payload) { this.payload = payload; return this } })
  const denied = response()
  await fields({ user: { id: 1 }, body: { town: '' } }, denied, () => assert.fail('不能放行隐藏字段'))
  assert.equal(denied.statusCode, 403)
  const allowed = response()
  await fields({ user: { id: 1 }, body: {} }, allowed, () => allowed.json({ data: [{ town: '隐藏', address: '隐藏', id: 1 }] }))
  assert.deepEqual(allowed.payload.data, [{ town: null, address: null, id: 1 }])
  masking.getUserFieldPermissions = async () => { throw new Error('权限服务不可用') }
  let error
  await fields({ user: { id: 1 }, body: {} }, response(), caught => { error = caught })
  assert.match(error.message, /不可用/)
})

test('地址迁移预览零写入、备份校验、幂等及有数据禁止回滚，全部为数据库替身', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-address-migration-'))
  t.after(() => fs.rm(temporary, { recursive: true, force: true }))
  const columns = new Map([['id', { COLUMN_NAME: 'id', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO' }]])
  const writes = []
  let used = 0
  const db = { async execute(sql) {
    if (sql.includes('information_schema.COLUMNS')) return [[...columns.values()]]
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]]
    if (sql.includes('RELEASE_LOCK')) return [[]]
    if (sql.includes('SELECT DATABASE')) return [[{ name: 'unit_address_contract' }]]
    if (sql.includes('SELECT COUNT')) return [[{ count: used }]]
    writes.push(sql)
    for (const [, name] of sql.matchAll(/ADD COLUMN (\w+)/g)) columns.set(name, { COLUMN_NAME: name, COLUMN_TYPE: COLUMNS[name].split(' ')[0], IS_NULLABLE: 'YES' })
    for (const [, name] of sql.matchAll(/DROP COLUMN (\w+)/g)) columns.delete(name)
    return [{}]
  } }
  assert.equal((await migrate(db)).missing.length, 5)
  assert.deepEqual(writes, [])
  const applied = await migrate(db, { apply: true, backupDirectory: temporary })
  assert.equal(applied.added.length, 5)
  assert.equal((await fs.stat(applied.backup)).mode & 0o777, 0o600)
  assert.equal((await migrate(db, { apply: true, backupDirectory: temporary })).applied, false)
  assert.equal(writes.length, 1)
  await assert.rejects(rollback(db, applied.backup), /维护窗口/)
  used = 1
  await assert.rejects(rollback(db, applied.backup, { maintenanceConfirmed: true }), /已有业务数据/)
  assert.equal(writes.length, 1)
  used = 0
  assert.equal((await rollback(db, applied.backup, { maintenanceConfirmed: true })).rolledBack, true)
  assert.equal(columns.size, 1)
  await fs.writeFile(applied.backup, '{}')
  await assert.rejects(rollback(db, applied.backup, { maintenanceConfirmed: true }), /备份无效/)
})
