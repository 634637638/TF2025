const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const priceListController = require('../src/controllers/price-list.controller')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

const read = relativePath => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

test('价目表 iPhone 16 查询 controller 保留结果和数据库错误响应', async () => {
  const records = [{ model_number: 'iPhone 16', is_collect: 1 }]
  const queryCalls = []
  const req = {
    app: {
      get(name) {
        assert.equal(name, 'db')
        return {
          async query(sql, params) {
            queryCalls.push({ sql, params })
            return [records, []]
          }
        }
      }
    }
  }
  const response = createResponse()

  await priceListController.checkIphone16(req, response)
  assert.deepEqual(response.body, {
    success: true,
    message: '找到 1 条iPhone 16记录',
    data: records
  })
  assert.equal(queryCalls.length, 1)
  assert.match(queryCalls[0].sql, /WHERE m\.name = 'iPhone 16'/)
  assert.equal(queryCalls[0].params, undefined)

  const failureResponse = createResponse()
  await priceListController.checkIphone16({
    app: { get: () => ({ query: async () => { throw new Error('database unavailable') } }) }
  }, failureResponse)
  assert.equal(failureResponse.statusCode, 500)
  assert.deepEqual(failureResponse.body, { success: false, message: 'database unavailable' })
})

test('价目表 iPhone 16 采集状态 controller 保留默认值、绑定参数和更新结果', async () => {
  const inputs = [undefined, 0]
  for (const requestedValue of inputs) {
    const queryCalls = []
    const records = [{ id: 12, model_number: 'iPhone 16', is_collect: requestedValue ?? 1 }]
    const req = {
      body: requestedValue === undefined ? {} : { is_collect: requestedValue },
      app: {
        get: () => ({
          async query(sql, params) {
            queryCalls.push({ sql, params })
            if (sql.includes('UPDATE price_list')) return [{ affectedRows: 2 }, []]
            return [records, []]
          }
        })
      }
    }
    const response = createResponse()

    await priceListController.updateIphone16Collection(req, response)
    const effectiveValue = requestedValue ?? 1
    assert.deepEqual(queryCalls[0].params, [effectiveValue])
    assert.equal(queryCalls.length, 2)
    assert.equal(response.body.message, `已更新 2 条iPhone 16记录的采集状态为 ${effectiveValue}`)
    assert.deepEqual(response.body.data, records)
  }
})

test('价目表遗留接口 route 仅委托 controller 并保留原权限', () => {
  const route = read('src/routes/price-list.js')

  assert.match(route, /router\.post\('\/migrate', unifiedAuth, requirePermission\('price-list:edit'\), priceListController\.acknowledgeMigration\)/)
  assert.match(route, /router\.get\('\/check-iphone16', unifiedAuth, requirePermission\('price-list:view'\), priceListController\.checkIphone16\)/)
  assert.match(route, /router\.post\('\/update-iphone16-is-collect', unifiedAuth, requirePermission\('price-list:edit'\), priceListController\.updateIphone16Collection\)/)
  assert.doesNotMatch(route, /router\.(?:get|post)\('\/(?:check-iphone16|update-iphone16-is-collect|migrate)'[^\n]*async \(req, res\)/)
})
