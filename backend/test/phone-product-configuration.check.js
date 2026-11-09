'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const PhoneProductRepository = require('../src/repositories/phone-product.repository')
const ShopService = require('../src/services/shop.service')
const db = require('../src/config/database')

test('新机配置复用匹配模板预览，默认上架但保留显式下架', async () => {
  const calls = []
  const template = { id: 8, template_name: '新机模板', images: [] }
  const phone = { is_new: 1, brand_id: 2, model_id: 3, color_id: 4, is_published: null }
  const service = new ShopService({ phoneProducts: {
    async getConfiguration(id) { calls.push(id); return phone },
    async getTemplatePreview(row) { assert.equal(row, phone); return template }
  } })
  assert.deepEqual(await service.getPhoneH5Product(12), { ...phone, is_published: 1, template })
  phone.is_published = 0
  assert.equal((await service.getPhoneH5Product(12)).is_published, 0)
  assert.deepEqual(calls, [12, 12])
})

test('二手机及不存在的设备不查询新机模板', async () => {
  const service = new ShopService({ phoneProducts: {
    async getConfiguration(id) { return id === 12 ? { is_new: 0, is_published: 0 } : null },
    async getTemplatePreview() { assert.fail('不应查询模板') }
  } })
  assert.deepEqual(await service.getPhoneH5Product(12), { is_new: 0, is_published: 0, template: null })
  assert.equal(await service.getPhoneH5Product(404), null)
})

test('模板查询使用参数绑定、启用条件及稳定顺序，仅返回模板资料和媒体', async () => {
  const calls = []
  const repository = new PhoneProductRepository(() => ({
    async query(sql, params) {
      calls.push({ sql, params })
      return [calls.length === 1 ? [{ id: 8, template_name: '统一模板' }] : [{ id: 9, image_url: '/template.jpg' }]]
    }
  }))
  const preview = await repository.getTemplatePreview({ brand_id: 2, model_id: 3, color_id: 4 })
  assert.deepEqual(calls[0].params, [2, 3, 4])
  assert.match(calls[0].sql, /is_active = TRUE/)
  assert.match(calls[0].sql, /ORDER BY id ASC LIMIT 1/)
  assert.deepEqual(calls[1].params, [8])
  assert.deepEqual(preview.images, [{ id: 9, image_url: '/template.jpg' }])
})

test('验机资料与显式下架单条更新，旧调用省略状态时不会重新上架', async t => {
  const writes = []
  t.mock.method(db, 'getDatabase', () => ({
    async query(sql, params) {
      if (sql.includes('SELECT id')) return [[{ id: 1 }]]
      writes.push({ sql, params })
      return [{ affectedRows: 1 }]
    }
  }))
  const service = new ShopService()
  const inspection = { condition_grade: '靓机', battery_status: '90', screen_condition: 'original',
    system_version: '', model_version: '', warranty_date: null, is_warranty_expired: false, sale_price: 100 }
  await service.saveProductInspection(12, { ...inspection, is_published: 0 })
  await service.saveProductInspection(12, inspection)
  assert.equal(writes.length, 2)
  assert.match(writes[0].sql, /is_published = COALESCE\(\?, is_published\)/)
  assert.deepEqual(writes[0].params.slice(-2), [0, 12])
  assert.deepEqual(writes[1].params.slice(-2), [null, 12])
})
