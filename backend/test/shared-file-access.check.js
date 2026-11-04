'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  createSharedFileUrl,
  storageUrlFromSharedFileUrl,
  verifySharedFileAccess
} = require('../src/utils/shared-file-access')

const backendRoot = path.resolve(__dirname, '..')
const sourceKey = 'shared-file-test-signing-key-at-least-32-characters'
const nowSeconds = 1_800_000_000

function parseSignedUrl(url) {
  const parsed = new URL(url, 'https://example.test')
  return {
    filename: decodeURIComponent(parsed.pathname.split('/').pop()),
    userId: parsed.searchParams.get('user'),
    expires: parsed.searchParams.get('expires'),
    signature: parsed.searchParams.get('signature')
  }
}

test('分享附件签名绑定文件、用户与过期时间且不包含登录 Token', () => {
  const url = createSharedFileUrl('/uploads/shared/7_document.pdf', 7, { nowSeconds, sourceKey })
  assert.match(url, /^\/api\/shared\/files\/7_document\.pdf\?user=7&expires=/)
  assert.doesNotMatch(url, /[?&]token=/)

  const signed = parseSignedUrl(url)
  assert.equal(verifySharedFileAccess(signed, { nowSeconds, sourceKey }), true)
  assert.equal(verifySharedFileAccess({ ...signed, filename: '8_document.pdf' }, { nowSeconds, sourceKey }), false)
  assert.equal(verifySharedFileAccess({ ...signed, userId: 8 }, { nowSeconds, sourceKey }), false)
  assert.equal(verifySharedFileAccess({ ...signed, expires: Number(signed.expires) + 1 }, { nowSeconds, sourceKey }), false)
  assert.equal(verifySharedFileAccess(signed, { nowSeconds: Number(signed.expires) + 1, sourceKey }), false)
})

test('分享附件签名不能超过服务端最大有效期', () => {
  const url = createSharedFileUrl('/uploads/shared/7_image.jpg', 7, {
    nowSeconds,
    ttlSeconds: 60 * 60,
    sourceKey
  })
  const signed = parseSignedUrl(url)
  assert.equal(Number(signed.expires) - nowSeconds, 10 * 60)
  assert.equal(verifySharedFileAccess(signed, { nowSeconds, sourceKey }), true)
})

test('临时签名 URL 可规范化回持久化存储路径', () => {
  const url = createSharedFileUrl('/uploads/shared/7_image.jpg', 7, { nowSeconds, sourceKey })
  assert.equal(storageUrlFromSharedFileUrl(url), '/uploads/shared/7_image.jpg')
  assert.equal(storageUrlFromSharedFileUrl('/uploads/shared/7_image.jpg'), '/uploads/shared/7_image.jpg')
  assert.equal(storageUrlFromSharedFileUrl('/api/shared/files/../secret'), '')
})

test('分享附件路由移除查询串登录 Token 并保留访问与响应安全检查', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/shared.js'), 'utf8')
  const view = fs.readFileSync(path.join(backendRoot, '../frontend/src/views/shared/SharedView.vue'), 'utf8')
  const service = fs.readFileSync(path.join(backendRoot, 'src/services/shared.service.js'), 'utf8')

  assert.doesNotMatch(route, /req\.query\.token|rawToken/)
  assert.doesNotMatch(view, /\?token=|authStore\.token/)
  assert.match(route, /verifySharedFileAccess/)
  assert.match(route, /canAccessAttachment\(rawUrl, userId\)/)
  assert.match(route, /Cache-Control', 'private, no-store'/)
  assert.match(route, /X-Content-Type-Options', 'nosniff'/)
  assert.match(route, /Cross-Origin-Resource-Policy', 'same-origin'/)
  assert.match(route, /storage_url: storageUrl/)
  assert.match(service, /storageUrlFromSharedFileUrl/)
})
