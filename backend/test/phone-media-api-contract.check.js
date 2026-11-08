const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('手机媒体只保留 canonical phones 路由并复用唯一控制器实现', () => {
  const phones = read('backend/src/routes/phones.js')
  const shop = read('backend/src/routes/shop.js')
  const controller = read('backend/src/controllers/phone-media.controller.js')

  for (const handler of ['list', 'setPrimary', 'remove', 'reorder']) {
    assert.match(phones, new RegExp(`phoneMediaController\\.${handler}`))
    assert.doesNotMatch(shop, new RegExp(`phoneMediaController\\.${handler}`))
  }

  assert.match(phones, /router\.post\('\/:id\/upload-image',\s*unifiedAuth,\s*requireAnyPermission\(PHONE_MEDIA_UPLOAD_PERMISSIONS\),\s*upload\.single\('image'\),\s*phoneMediaController\.uploadImage\s*\)/)
  assert.match(phones, /router\.post\('\/:id\/upload-video',\s*unifiedAuth,\s*requireAnyPermission\(PHONE_MEDIA_UPLOAD_PERMISSIONS\),\s*videoUpload\.single\('video'\),\s*phoneMediaController\.uploadVideo\s*\)/)

  assert.doesNotMatch(shop, /migrationId|compatibilityId/)
  assert.doesNotMatch(shop, /router\.get\(\s*['"]\/phones\/:id\/images['"]/)
  assert.doesNotMatch(shop, /router\.put\(\s*['"]\/images\/:id\/primary['"]/)
  assert.doesNotMatch(shop, /router\.delete\(\s*['"]\/images\/:id['"]/)
  assert.doesNotMatch(shop, /router\.post\(\s*['"]\/upload-phone-image['"]/)
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

test('canonical phones 上传入口复用同一媒体归档和数据库持久化函数', () => {
  const shop = read('backend/src/routes/shop.js')
  const controller = read('backend/src/controllers/phone-media.controller.js')

  assert.doesNotMatch(shop, /phoneMediaController\.saveUploadedMedia/)
  assert.doesNotMatch(shop, /router\.post\(\s*['"]\/upload-phone-image['"]/)
  assert.match(controller, /archivePhoneMediaUpload/)
  assert.match(controller, /shopService\.addPhoneImage/)
  assert.match(controller, /saveMedia\(\{[\s\S]*phoneId: req\.params\.id/)
})
