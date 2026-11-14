'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryController = require('../src/controllers/accessory.controller')
const actor = { id: 7, store_id: 2, store_ids: [2, 3] }
function fixture() {
  let value = '3'
  const calls = []
  const stores = [{ id: 2, name: '店A', status: 1 }, { id: 3, name: '店B', status: 1 }, { id: 4, name: '停用店', status: 0 }]
  const repository = {
    async getEntryOptions({ storeScope }) {
      calls.push(storeScope)
      return { stores: stores.filter(store => storeScope.allStores || storeScope.storeIds.includes(store.id)) }
    },
    async getReference(id) { return stores.find(store => store.id === id) },
    async getInventoryLocations(id, scope) { calls.push({ id, scope }); return [{ store_id: 2, store_name: '店A', quantity: 7 }] }
  }
  const settingsRepository = {
    async getSettingByKey(key) { assert.equal(key, 'accessory_warehouse_store_id'); return { value } },
    async upsertSetting(key, next, type) { assert.equal(key, 'accessory_warehouse_store_id'); assert.equal(type, 'string'); value = next; calls.push({ value }) }
  }
  return { calls, stores, repository, setValue: next => { value = next }, service: new AccessoryService({ repository, settingsRepository }) }
}
test('总仓复用统一设置，只返回授权启用门店；入库默认总仓不可越权', async () => {
  const context = fixture()
  assert.equal((await context.service.getSettings(actor)).warehouse_store_id, 3)
  assert.equal((await context.service.getEntryOptions(actor)).default_store_id, 3)
  context.setValue('4')
  assert.equal((await context.service.getSettings({ ...actor, store_ids: [2, 3, 4] })).warehouse_store_id, null)
  assert.equal((await context.service.getEntryOptions(actor)).default_store_id, null)
  context.setValue('3')
  assert.equal((await context.service.getSettings({ id: 7, store_id: 2 })).warehouse_store_id, null)
  assert.equal((await context.service.getEntryOptions({ id: 7, store_id: 2 })).default_store_id, null)
})
test('保存总仓支持授权任意启用店和清空；未知、停用、越权及非法载荷不得写入', async () => {
  const context = fixture()
  assert.equal((await context.service.saveSettings(actor, { warehouse_store_id: '2' })).warehouse_store_id, 2)
  assert.equal((await context.service.saveSettings(actor, { warehouse_store_id: null })).warehouse_store_id, null)
  const before = context.calls.filter(call => Object.hasOwn(call, 'value')).length
  for (const data of [{}, { warehouse_store_id: -1 }, { warehouse_store_id: 1.5 }, { warehouse_store_id: 2, other: true }]) {
    await assert.rejects(context.service.saveSettings(actor, data), { code: 'VALIDATION_ERROR' })
  }
  await assert.rejects(context.service.saveSettings(actor, { warehouse_store_id: 99 }), { code: 'STORE_SCOPE_DENIED' })
  await assert.rejects(context.service.saveSettings({ ...actor, store_ids: [2, 3, 4] }, { warehouse_store_id: 4 }), { code: 'INVALID_REFERENCE' })
  await assert.rejects(context.service.saveSettings({ ...actor, store_ids: [2, 3, 9] }, { warehouse_store_id: 9 }), { code: 'INVALID_REFERENCE' })
  assert.equal(context.calls.filter(call => Object.hasOwn(call, 'value')).length, before)
})
test('库存位置查询要求认证并传递实际门店范围和商品ID', async () => {
  const context = fixture()
  await assert.rejects(context.service.getInventoryLocations(null, 5))
  await assert.rejects(context.service.getInventoryLocations(actor, 'bad'), { code: 'VALIDATION_ERROR' })
  assert.equal((await context.service.getInventoryLocations(actor, '5'))[0].quantity, 7)
  assert.deepEqual(context.calls.at(-1), { id: 5, scope: { allStores: false, requestedStoreId: null, storeIds: [2, 3] } })
})
test('设置和店铺库存响应统一遮蔽门店与数量；控制器转交认证用户', async () => {
  const calls = []
  const controller = new AccessoryController({
    service: { async getInventoryLocations(user, id) { calls.push({ user, id }); return [{ store_id: 2, store_name: '店A', quantity: 7 }] } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: ['stock_info.distribution', 'stock_info.total_quantity', 'stock_info.total_stock'] } }, filterSensitiveFields: rows => rows },
    response: { success(res, data) { calls.push(data) }, error() { assert.fail('unexpected error') } }
  })
  await controller.getStock({ user: actor, params: { id: '5' } }, {})
  assert.deepEqual(calls[0], { user: actor, id: '5' })
  assert.equal(calls[1].stores, null)
  assert.equal(calls[1].total_stock, null)
  const masked = await controller.mask({ user: actor }, { warehouse_store_id: 3, default_store_id: 3, stores: [] })
  assert.deepEqual(masked, { warehouse_store_id: null, default_store_id: null, stores: null })
})
