const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('手机媒体统一路由复用唯一控制器实现', () => {
  const phones = read('backend/src/routes/phones.js')
  const shop = read('backend/src/routes/shop.js')
  const controller = read('backend/src/controllers/phone-media.controller.js')

  for (const handler of ['list', 'setPrimary', 'remove', 'reorder']) {
    assert.match(phones, new RegExp(`phoneMediaController\\.${handler}`))
    assert.match(shop, new RegExp(`phoneMediaController\\.${handler}`))
  }

  assert.match(shop, /migrationId: 'shop-phone-images-to-phones'/)
  assert.match(shop, /migrationId: 'shop-phone-image-primary-to-phones'/)
  assert.match(shop, /migrationId: 'shop-phone-image-delete-to-phones'/)
  assert.match(shop, /migrationId: 'shop-phone-media-upload-to-phones'/)
  assert.match(controller, /req\.body\.imageIds \?\? req\.body\.image_ids/)
})

test('仓库内手机媒体读写调用使用 canonical phones 路由', () => {
  const queryView = read('frontend/src/views/query/QueryView.vue')
  const soldProductsView = read('frontend/src/views/H5-admin/page/SoldProductsView.vue')
  const shopApi = read('frontend/src/api/shop.ts')

  for (const source of [queryView, soldProductsView, shopApi]) {
    assert.doesNotMatch(source, /\/shop\/phones\/[^'"`]*\/images/)
    assert.doesNotMatch(source, /\/shop\/images\//)
    assert.doesNotMatch(source, /\/shop\/upload-phone-image/)
  }

  assert.match(queryView, /\/phones\/\$\{selectedPhoneId\.value\}\/images/)
  assert.match(soldProductsView, /\/phones\/\$\{product\.id\}\/images/)
})

test('不同上传入口复用同一媒体归档和数据库持久化函数', () => {
  const phones = read('backend/src/routes/phones.js')
  const shop = read('backend/src/routes/shop.js')
  const controller = read('backend/src/controllers/phone-media.controller.js')

  assert.equal((phones.match(/phoneMediaController\.saveUploadedMedia/g) || []).length, 2)
  assert.match(shop, /phoneMediaController\.saveUploadedMedia/)
  assert.match(controller, /archivePhoneMediaUpload/)
  assert.match(controller, /shopService\.addPhoneImage/)
})
