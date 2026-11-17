'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const ShopService = require('../src/services/shop.service')
const Repository = require('../src/repositories/phone-product.repository')
const { createPhoneResourceAccess } = require('../src/middleware/phone-resource-access')

test('手机素材校验门店及图片归属，通过前不执行上传或写入', async () => {
  const reads = []
  const service = new ShopService({ phoneProducts: {
    async getResource(phoneId, imageId) {
      reads.push([phoneId, imageId])
      return imageId === 'other' ? null : { id: 5, store_id: 2 }
    }
  } })
  const middleware = createPhoneResourceAccess(service)
  const invoke = async (stores, imageId) => {
    let continued = false
    const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    await middleware({ user: { id: 7, store_ids: stores }, params: { id: '5', imageId } }, res, () => { continued = true })
    return { res, continued }
  }
  assert.equal((await invoke([2], '9')).continued, true)
  const denied = await invoke([1], '9')
  assert.equal(denied.continued, false)
  assert.equal(denied.res.code, 403)
  const foreignImage = await invoke([2], 'other')
  assert.equal(foreignImage.continued, false)
  assert.equal(foreignImage.res.code, 404)
  assert.deepEqual(reads, [['5', '9'], ['5', '9'], ['5', 'other']])
})

test('图片资源查询同时约束设备与图片，不允许通过其他设备图片 ID 访问', async () => {
  const calls = []
  const repo = new Repository(() => ({ async query(sql, params) { calls.push({ sql, params }); return [[]] } }))
  assert.equal(await repo.getResource(5, 9), null)
  assert.match(calls[0].sql, /i\.id = \? AND i\.phone_id = p\.id/)
  assert.deepEqual(calls[0].params, [5, 9])
})
