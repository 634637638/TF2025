'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const GuideAdminController = require('../src/controllers/guide-admin.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('导航管理 routes 保留逐项权限和认证并委托全部 handler', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/guide.js'), 'utf8')

  assert.match(route, /adminRouter\.use\(unifiedAuth\)/)
  assert.match(route, /requirePermission\('guide:create'\), guideAdminController\.createLink\.bind/)
  assert.match(route, /requirePermission\('guide:upload'\), guideAdminController\.uploadFile\.bind/)
  assert.match(route, /requirePermission\('guide:view'\), guideAdminController\.previewUploadedFile\.bind/)
  assert.equal((route.match(/guideAdminController\.[A-Za-z]+\.bind\(guideAdminController\)/g) || []).length, 15)
  assert.doesNotMatch(route, /async\s*\(/)
})

test('导航链接创建先提升本人草稿并保存规范化 payload', async () => {
  const calls = []
  const controller = new GuideAdminController({
    service: {
      async createLink(userId, categoryId, payload) {
        calls.push({ userId, categoryId, payload })
        return { id: 12, ...payload }
      }
    },
    logger: { error() {} },
    draftUrlCheck: value => value === '/uploads/guide/draft_7_photo.jpg',
    async promoteDraft() { return { fileUrl: '/uploads/guide/final_photo.jpg', promoted: true } },
    async removeDraft() {}
  })
  const response = createResponse()

  await controller.createLink({
    user: { id: 7 },
    params: { id: '4' },
    body: { link_type: 'file', file_url: '/uploads/guide/draft_7_photo.jpg', title: '资料' }
  }, response)

  assert.equal(calls[0].userId, 7)
  assert.equal(calls[0].categoryId, 4)
  assert.equal(calls[0].payload.file_url, '/uploads/guide/final_photo.jpg')
  assert.equal(response.statusCode, 201)
  assert.equal(response.body.data.id, 12)
})

test('导航链接保存失败时清理刚提升文件并返回错误', async () => {
  const removed = []
  const controller = new GuideAdminController({
    service: { async createLink() { throw new Error('保存失败') } },
    logger: { error() {} },
    uploadDir: '/uploads/guide',
    draftUrlCheck: () => true,
    async promoteDraft() { return { fileUrl: '/uploads/guide/final_photo.jpg', promoted: true } },
    async removeDraft() {},
    uploadPathFromUrl: () => '/uploads/guide/final_photo.jpg',
    filesystem: {
      existsSync() { return true },
      unlinkSync(filePath) { removed.push(filePath) }
    }
  })
  const response = createResponse()

  await controller.createLink({
    user: { id: 7 },
    params: { id: '4' },
    body: { link_type: 'file', file_url: '/uploads/guide/draft_photo.jpg' }
  }, response)

  assert.deepEqual(removed, ['/uploads/guide/final_photo.jpg'])
  assert.equal(response.statusCode, 500)
  assert.equal(response.body.message, '服务器内部错误，请稍后重试')
})

test('导航签名附件拒绝上传目录之外的路径', async () => {
  const controller = new GuideAdminController({
    service: {
      async getLinkStorage() {
        return { link_type: 'file', file_url: '/uploads/guide/asset.pdf', file_mime: 'application/pdf', is_enabled: 1 }
      }
    },
    uploadDir: '/uploads/guide',
    uploadPathFromUrl: () => '/uploads/private/asset.pdf',
    filesystem: { existsSync() { return true } }
  })
  const response = {
    status(code) { this.statusCode = code; return this },
    end() { this.ended = true; return this },
    set() { assert.fail('越界路径不得设置文件响应头') },
    sendFile() { assert.fail('越界路径不得发送文件') }
  }

  await controller.previewLink({ params: { id: '12' } }, response)

  assert.equal(response.statusCode, 404)
  assert.equal(response.ended, true)
})
