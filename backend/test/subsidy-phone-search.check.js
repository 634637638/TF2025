'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('补贴设备搜索 controller 保留认证权限、缓存和原响应状态', async () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')
  assert.match(route, /router\.get\('\/search-phones\/:identifier', unifiedAuth, requirePermission\('subsidy:view'\), cacheMiddleware\(\{ ttl: CACHE_TTL\.SHORT \}\), subsidyPhoneSearchController\.search\.bind\(subsidyPhoneSearchController\)\)/)

  const SubsidyPhoneSearchController = require('../src/controllers/subsidy-phone-search.controller')
  const logger = { info() {}, error() {} }
  const service = { async search(identifier) { return identifier === 'empty' ? [] : [{ phone_id: 3 }] } }
  const controller = new SubsidyPhoneSearchController({ service, logger })
  const response = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })

  const invalid = response()
  await controller.search({ params: { identifier: '  ' }, method: 'GET', originalUrl: '/subsidy/search-phones/%20%20' }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: '请输入IMEI或序列号' })

  const missing = response()
  await controller.search({ params: { identifier: 'empty' }, method: 'GET', originalUrl: '/subsidy/search-phones/empty' }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '未找到匹配的设备' })

  const success = response()
  await controller.search({ params: { identifier: 'abc' }, method: 'GET', originalUrl: '/subsidy/search-phones/abc' }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '找到 1 个匹配设备',
    data: [{ phone_id: 3 }]
  })

  const failedController = new SubsidyPhoneSearchController({
    service: { async search() { throw new Error('query failed') } },
    logger
  })
  const failed = response()
  await failedController.search({ params: { identifier: 'abc' }, method: 'GET', originalUrl: '/subsidy/search-phones/abc' }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, { success: false, message: '搜索失败', error: 'query failed' })
})

test('补贴设备搜索 service 合并最新客户、国补状态并计算申请资格', async () => {
  const SubsidyPhoneSearchService = require('../src/services/subsidy-phone-search.service')
  const calls = []
  const progress = []
  const service = new SubsidyPhoneSearchService({
    repository: {
      async findSoldPhones(pattern) {
        calls.push(['phones', pattern])
        return [
          { phone_id: 1, is_new: 1, sale_price: '6000', imei: 'A' },
          { phone_id: 2, is_new: 0, sale_price: '3000', imei: 'B' },
          { phone_id: 3, is_new: 1, sale_price: '7000', imei: 'C' }
        ]
      },
      async findRelatedData(ids) {
        calls.push(['related', ids])
        return {
          latestSales: [{ phone_id: 1, customer_name: '客户', customer_phone: '13800000000' }],
          subsidyRecords: [{ phone_id: 3, apply_status: 'approved', subsidy_amount: 600 }]
        }
      }
    }
  })

  const result = await service.search(' abc ', (label, details) => progress.push([label, details]))
  assert.deepEqual(calls, [['phones', '%abc%'], ['related', [1, 2, 3]]])
  assert.equal(result[0].sale_price, 6000)
  assert.equal(result[0].customer_name, '客户')
  assert.equal(result[0].can_apply_subsidy, true)
  assert.equal(result[0].reason, '符合条件')
  assert.equal(result[1].can_apply_subsidy, false)
  assert.equal(result[1].reason, '仅全新机可申请')
  assert.equal(result[2].has_subsidy, true)
  assert.equal(result[2].subsidy_status, 'approved')
  assert.equal(result[2].reason, '已记录国补资料')
  assert.deepEqual(progress.map(([label]) => label), ['phones query completed', 'related data queries completed'])
})

test('补贴设备搜索 repository 使用参数化匹配与关联 ID 查询', async () => {
  const SubsidyPhoneSearchRepository = require('../src/repositories/subsidy-phone-search.repository')
  const queries = []
  const rows = [{ phone_id: 1 }]
  const repository = new SubsidyPhoneSearchRepository({
    getDb: () => ({
      async execute(sql, params) {
        queries.push({ sql, params })
        return [rows, []]
      }
    })
  })

  assert.deepEqual(await repository.findSoldPhones('%123%'), rows)
  assert.deepEqual(await repository.findRelatedData([1, 2]), { latestSales: rows, subsidyRecords: rows })
  assert.deepEqual(queries[0].params, ['%123%', '%123%'])
  assert.deepEqual(queries.slice(1).map(query => query.params), [[1, 2], [1, 2]])
  assert.ok(queries[1].sql.includes('MAX(created_at)'))
  assert.ok(queries[2].sql.includes('FROM national_subsidies'))
})
