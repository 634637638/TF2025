const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const PhoneStockWarningController = require('../src/controllers/phone-stock-warning.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('库存预警唯一约束包含库存类型', () => {
  const schema = fs.readFileSync(path.join(root, 'src/utils/phone-stock-warning-schema.js'), 'utf8')

  assert.match(schema, /brand_id,model_id,color_id,memory_id,is_new/)
  assert.match(schema, /unique_brand_model_color_memory_condition/)
  assert.match(schema, /DROP INDEX/)
})

test('库存预警重复配置返回业务错误而不是 500', () => {
  const service = fs.readFileSync(path.join(root, 'src/services/phone-stock-warning.service.js'), 'utf8')

  assert.match(service, /error\?\.code === 'ER_DUP_ENTRY'/)
  assert.match(service, /库存类型的预警配置已存在/)
})

test('库存预警写入和查询都使用 is_new 条件', () => {
  const repository = fs.readFileSync(path.join(root, 'src/repositories/phone-stock-warning.repository.js'), 'utf8')

  assert.match(repository, /AND is_new = \?/)
  assert.match(repository, /\(brand_id, model_id, color_id, memory_id, is_new, min_stock/)
})

test('库存预警路由保留权限并全部委托给 controller', () => {
  const route = fs.readFileSync(path.join(root, 'src/routes/phone-stock-warnings.js'), 'utf8')
  const expected = [
    "router.get('/configs', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getAllConfigs.bind(phoneStockWarningController))",
    "router.get('/threshold', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getThreshold.bind(phoneStockWarningController))",
    "router.post('/configs', unifiedAuth, requirePermission('system:edit'), phoneStockWarningController.createConfig.bind(phoneStockWarningController))",
    "router.put('/configs/:id', unifiedAuth, requirePermission('system:edit'), phoneStockWarningController.updateConfig.bind(phoneStockWarningController))",
    "router.delete('/configs/:id', unifiedAuth, requirePermission('system:delete'), phoneStockWarningController.removeConfig.bind(phoneStockWarningController))",
    "router.patch('/configs/:id/toggle', unifiedAuth, requirePermission('system:edit'), phoneStockWarningController.toggle.bind(phoneStockWarningController))",
    "router.get('/brands', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getBrands.bind(phoneStockWarningController))",
    "router.get('/models', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getModels.bind(phoneStockWarningController))",
    "router.get('/colors', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getColors.bind(phoneStockWarningController))",
    "router.get('/memories', unifiedAuth, requirePermission('system:view'), phoneStockWarningController.getMemories.bind(phoneStockWarningController))"
  ]
  for (const declaration of expected) assert.ok(route.includes(declaration), declaration)
  assert.doesNotMatch(route, /async\s*\(req,\s*res\)/)
})

test('库存预警 controller 保留输入校验、服务参数和统一响应', async () => {
  const calls = []
  const controller = new PhoneStockWarningController({
    service: {
      async getWarningThreshold(...args) { calls.push(['threshold', ...args]); return { success: true, message: 'ok', data: { threshold: 4 } } },
      async updateConfig(...args) { calls.push(['update', ...args]); return { success: true, message: 'ok', data: { id: 12 } } },
      async toggleWarning(...args) { calls.push(['toggle', ...args]); return { success: true, message: 'ok', data: { id: 12, enabled: true } } },
      async getModelsByBrand(...args) { calls.push(['models', ...args]); return { success: true, message: 'ok', data: [] } }
    }
  })

  const missingBrand = createResponse()
  await controller.getThreshold({ query: {} }, missingBrand)
  assert.equal(missingBrand.statusCode, 400)
  const threshold = createResponse()
  await controller.getThreshold({ query: { brand_id: '8', model_id: '3' } }, threshold)
  assert.deepEqual(calls[0], ['threshold', 8, 3])
  assert.deepEqual(threshold.body.data, { threshold: 4 })

  const invalidId = createResponse()
  await controller.updateConfig({ params: { id: 'x' }, user: { id: 7 }, body: {} }, invalidId)
  assert.equal(invalidId.statusCode, 400)
  const invalidToggle = createResponse()
  await controller.toggle({ params: { id: '12' }, user: { id: 7 }, body: { enabled: 'true' } }, invalidToggle)
  assert.equal(invalidToggle.statusCode, 400)

  const updated = createResponse()
  await controller.updateConfig({ params: { id: '12' }, user: { id: 7 }, body: { min_stock: 4 } }, updated)
  assert.deepEqual(calls[1], ['update', 7, 12, { min_stock: 4 }])

  const toggled = createResponse()
  await controller.toggle({ params: { id: '12' }, user: { id: 7 }, body: { enabled: true } }, toggled)
  assert.deepEqual(calls[2], ['toggle', 7, 12, true])

  const modelsMissingBrand = createResponse()
  await controller.getModels({ query: {} }, modelsMissingBrand)
  assert.equal(modelsMissingBrand.statusCode, 400)
  const models = createResponse()
  await controller.getModels({ query: { brand_id: '8' } }, models)
  assert.deepEqual(calls[3], ['models', 8])
})
