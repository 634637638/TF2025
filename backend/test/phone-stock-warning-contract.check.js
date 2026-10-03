const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

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
