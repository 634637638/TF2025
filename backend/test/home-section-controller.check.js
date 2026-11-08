'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const HomeSectionController = require('../src/controllers/home-section.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('首页推荐 routes 保留公开访问边界和管理权限并全部委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/home-sections.js'), 'utf8')

  assert.match(route, /router\.get\('\/public\/home\/sections', homeSectionController\.getActiveSections\.bind/)
  assert.match(route, /router\.get\('\/home\/sections', unifiedAuth, requirePermission\('home-sections:view'\), homeSectionController\.getAllSections\.bind/)
  assert.match(route, /router\.post\('\/home\/sections', unifiedAuth, requirePermission\('home-sections:create'\), homeSectionController\.createSection\.bind/)
  assert.match(route, /router\.put\('\/home\/sections\/:id', unifiedAuth, requirePermission\('home-sections:edit'\), homeSectionController\.updateSection\.bind/)
  assert.match(route, /router\.delete\('\/home\/sections\/:id', unifiedAuth, requirePermission\('home-sections:delete'\), homeSectionController\.deleteSection\.bind/)
  assert.equal((route.match(/homeSectionController\.[A-Za-z]+\.bind\(homeSectionController\)/g) || []).length, 12)
  assert.doesNotMatch(route, /async\s*\(/)
})

test('首页推荐 controller 透传服务参数并保持成功响应格式', async () => {
  const calls = []
  const service = {
    async createSection(body) { calls.push(['createSection', body]); return { id: 3 } },
    async updateProductSort(productId, sortOrder) { calls.push(['updateProductSort', productId, sortOrder]) },
    async searchProducts(keyword, type) { calls.push(['searchProducts', keyword, type]); return [{ id: 9 }] }
  }
  const controller = new HomeSectionController({ service, logger: { error() {}, warn() {} } })

  const createResult = createResponse()
  const createBody = { name: '首页精选' }
  await controller.createSection({ body: createBody }, createResult)
  assert.deepEqual(createResult.body, { success: true, data: { id: 3 }, message: '创建成功' })

  const sortResponse = createResponse()
  await controller.updateProductSort({ params: { productId: '9' }, body: { sort_order: 2 } }, sortResponse)
  assert.deepEqual(sortResponse.body, { success: true, message: '更新排序成功' })

  const searchResponse = createResponse()
  await controller.searchProducts({ query: { keyword: 'phone', type: 'new' } }, searchResponse)
  assert.deepEqual(searchResponse.body, { success: true, data: [{ id: 9 }] })
  assert.deepEqual(calls, [
    ['createSection', createBody],
    ['updateProductSort', '9', 2],
    ['searchProducts', 'phone', 'new']
  ])
})

test('公开推荐表缺失时返回原有空列表降级结果', async () => {
  const warnings = []
  const controller = new HomeSectionController({
    service: { async getActiveSections() { throw Object.assign(new Error('missing table'), { code: 'ER_NO_SUCH_TABLE' }) } },
    logger: { error() {}, warn(message) { warnings.push(message) } }
  })
  const response = createResponse()

  await controller.getActiveSections({}, response)

  assert.equal(response.statusCode, undefined)
  assert.deepEqual(response.body, {
    success: true,
    data: [],
    message: '推荐区域未初始化'
  })
  assert.equal(warnings.length, 1)
})

test('首页推荐操作错误继续返回对应安全错误消息', async () => {
  const errors = []
  const controller = new HomeSectionController({
    service: { async createSection() { throw new Error('服务错误详情') } },
    logger: { error(...args) { errors.push(args) }, warn() {} }
  })
  const response = createResponse()

  await controller.createSection({ body: {} }, response)

  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, { success: false, message: '服务错误详情' })
  assert.equal(errors.length, 1)

  const fallbackController = new HomeSectionController({
    service: { async createSection() { throw new Error() } },
    logger: { error() {}, warn() {} }
  })
  const fallbackResponse = createResponse()
  await fallbackController.createSection({ body: {} }, fallbackResponse)
  assert.deepEqual(fallbackResponse.body, { success: false, message: '创建失败' })
})
