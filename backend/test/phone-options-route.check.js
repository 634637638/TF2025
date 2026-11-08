const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('入库选项 service 保持正式选项和历史库存补充格式', async () => {
  const PhoneOptionService = require('../src/services/phone-option.service')
  const service = new PhoneOptionService({
    async getOptionRows() {
      return {
        colors: [{ id: 1, name: '黑色', sort_order: 2 }],
        memories: [{ id: 2, size: 128, sort_order: 1 }],
        brands: [{ id: 3, name: '品牌', sort_order: 1, status: 1 }],
        models: [{ id: 4, name: '型号', brand_id: 3, sort_order: 1, status: 1 }],
        actualModels: [{ id: 5, model: '历史型号', brand_id: 3, sort_order: 5 }],
        actualBrands: [{ id: 6, brand: '历史品牌', sort_order: 6 }],
        actualColors: [{ id: 7, color: '历史颜色', sort_order: 7 }],
        actualMemories: [{ id: 8, memory: 256, sort_order: 8 }],
        purchaseNumbers: [{ purchase_number: 900 }],
        conditions: [{ quality_grade: '九成新' }],
        stores: [{ id: 9, name: '门店', sort_order: 1 }]
      }
    }
  })

  const options = await service.getPhoneOptions()
  assert.deepEqual(options.colors, [
    { id: 1, name: '黑色', sort_order: 2, status: 1 },
    { id: 7, name: '历史颜色', sort_order: 7, status: 1 }
  ])
  assert.deepEqual(options.memories, [
    { id: 2, size: '128', sort_order: 1 },
    { id: 8, size: '256', sort_order: 8 }
  ])
  assert.equal(options.models[1].name, '历史型号')
  assert.equal(options.brands[1].name, '历史品牌')
  assert.deepEqual(options.purchaseNumbers, ['900'])
  assert.deepEqual(options.conditions, ['九成新'])
  assert.deepEqual(options.newConditions, [
    { value: 1, label: '全新' },
    { value: 0, label: '二手' }
  ])
})

test('入库选项 repository 保留全部只读查询', async () => {
  const PhoneOptionRepository = require('../src/repositories/phone-option.repository')
  const queries = []
  const repository = new PhoneOptionRepository({
    async execute(query) {
      queries.push(query)
      return [[], []]
    }
  })

  const result = await repository.getOptionRows()
  assert.equal(queries.length, 11)
  assert.match(queries[0], /FROM colors[\s\S]*WHERE status = 1/)
  assert.match(queries[3], /INNER JOIN brands/)
  assert.match(queries[4], /FROM phones p[\s\S]*LEFT JOIN models/)
  assert.match(queries[8], /purchase_number/)
  assert.match(queries[9], /quality_grade/)
  assert.match(queries[10], /FROM stores/)
  assert.deepEqual(Object.keys(result), [
    'colors', 'memories', 'brands', 'models', 'actualModels', 'actualBrands',
    'actualColors', 'actualMemories', 'purchaseNumbers', 'conditions', 'stores'
  ])
})

test('入库选项 controller 保留数据库未连接和成功响应', async () => {
  const PhoneOptionController = require('../src/controllers/phone-option.controller')
  const response = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
  const disconnectedController = new PhoneOptionController({
    service: {},
    checkDatabaseConnection: () => false
  })

  await disconnectedController.getPhoneOptions({}, response)
  assert.equal(response.statusCode, 500)
  assert.equal(response.body.success, false)

  const expected = { colors: [], memories: [], brands: [], models: [] }
  const connectedController = new PhoneOptionController({
    service: { getPhoneOptions: async () => expected },
    checkDatabaseConnection: () => true
  })
  await connectedController.getPhoneOptions({}, response)
  assert.equal(response.body.success, true)
  assert.equal(response.body.message, '获取手机选项成功')
  assert.deepEqual(response.body.data, expected)
})

test('入库选项 route 保留全局认证和 accessories 查看/创建权限', () => {
  const routeSource = fs.readFileSync(path.join(root, 'src/routes/options.js'), 'utf8')

  assert.match(routeSource, /router\.use\(unifiedAuth\)/)
  assert.match(routeSource, /router\.get\('\/phone-options',\s*requireAnyPermission\(\['accessories:view', 'accessories:create'\]\),\s*phoneOptionController\.getPhoneOptions\.bind\(phoneOptionController\)\)/)
})
