import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { resolve } from 'node:path'

const entry = resolve(import.meta.dirname, '../src/utils/download-response.ts')

const loadDownloadResponseModule = async () => {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    write: false
  })
  const source = result.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const { extractBlobResponse } = await loadDownloadResponseModule()

test('下载响应接受 200 文件 Blob', () => {
  const image = new Blob(['jpeg-data'], { type: 'image/jpeg' })
  assert.equal(extractBlobResponse({ status: 200, data: image }), image)
  assert.equal(extractBlobResponse(image), image)
})

for (const status of [401, 403, 404, 500]) {
  test(`下载响应拒绝 ${status} 错误内容`, () => {
    const errorPayload = new Blob([JSON.stringify({ success: false, message: '请求失败' })], {
      type: 'application/json'
    })
    assert.throws(
      () => extractBlobResponse({ status, data: errorPayload }),
      new RegExp(String(status))
    )
  })
}

test('下载响应拒绝伪装成 200 的 JSON 或 HTML 错误体', () => {
  assert.throws(
    () => extractBlobResponse(new Blob(['{"success":false}'], { type: 'application/json' })),
    /错误内容/
  )
  assert.throws(
    () => extractBlobResponse(new Blob(['<html>error</html>'], { type: 'text/html' })),
    /错误内容/
  )
})

test('下载响应拒绝缺失 Blob 的无效响应', () => {
  assert.throws(() => extractBlobResponse({ status: 200, data: { message: 'error' } }), /不是有效文件/)
})
