const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const repoRoot = path.resolve(root, '..')
const servicePath = path.join(root, 'src/services/reference-options.service.js')

test('表单基础选项由公共服务提供且商城兼容入口已删除', () => {
  const service = require(servicePath)
  assert.equal(typeof service.listTemplateReferenceOptions, 'function')

  const preordersRoute = fs.readFileSync(path.join(root, 'src/routes/preorders.js'), 'utf8')
  const shopRoute = fs.readFileSync(path.join(root, 'src/routes/shop.js'), 'utf8')
  for (const resource of ['brands', 'models', 'colors', 'memories']) {
    assert.match(preordersRoute, new RegExp(`listTemplateReferenceOptions\\('${resource}'`))
  }
  assert.doesNotMatch(shopRoute, /\/base-data\/(?:brands|models|colors|memories)/)
  assert.doesNotMatch(shopRoute, /listTemplateReferenceOptions/)
})

test('商城模板基础选项调用统一资源路由', () => {
  const referenceOptions = fs.readFileSync(path.join(repoRoot, 'frontend/src/services/reference-options.ts'), 'utf8')
  const baseDataApi = fs.readFileSync(path.join(repoRoot, 'frontend/src/api/base-data.ts'), 'utf8')

  assert.match(referenceOptions, /export const getTemplateBrands[\s\S]*?'\/brands\?all=true'/)
  assert.match(referenceOptions, /export const getModels = \(options: ModelOptionsParams = \{\}\)/)
  assert.match(referenceOptions, /export const getTemplateColors = getCachedColors/)
  assert.match(referenceOptions, /export const getTemplateMemories = getCachedMemories/)
  assert.doesNotMatch(referenceOptions, /\/shop\/base-data\//)
  assert.match(baseDataApi, /getTemplateBrands/)
})

test('品牌型号联动只使用规范型号资源接口', () => {
  const referenceOptions = fs.readFileSync(path.join(repoRoot, 'frontend/src/services/reference-options.ts'), 'utf8')
  const modelsRoute = fs.readFileSync(path.join(root, 'src/routes/models.js'), 'utf8')
  const queryRoute = fs.readFileSync(path.join(root, 'src/routes/query.js'), 'utf8')
  const brandsRoute = fs.readFileSync(path.join(root, 'src/routes/brands.js'), 'utf8')
  const routesIndex = fs.readFileSync(path.join(root, 'src/routes/index.js'), 'utf8')

  assert.match(referenceOptions, /params\.set\('all', 'true'\)/)
  assert.match(referenceOptions, /params\.set\('brand_id', String\(options\.brandId\)\.trim\(\)\)/)
  assert.match(referenceOptions, /if \(options\.activeOnly\) params\.set\('active_only', 'true'\)/)
  assert.match(referenceOptions, /const url = `\/models\$\{query \? `\?\$\{query\}` : ''\}`/)
  assert.doesNotMatch(referenceOptions, /\/query\/models|`\/brands\/\$\{[^}]+\}\/models`/)

  assert.match(modelsRoute, /requireAnyPermission\(\['models:view', 'brands:view'/)
  assert.match(modelsRoute, /'query:view'/)
  assert.match(modelsRoute, /active_only === 'true'[\s\S]{0,220}listModelsByBrand\(/)
  assert.doesNotMatch(queryRoute, /router\.get\(\s*['"]\/models['"]/)
  assert.doesNotMatch(brandsRoute, /router\.get\(\s*['"]\/:brandId\/models['"]/)
  assert.doesNotMatch(routesIndex, /router\.get\(\s*['"]\/phones\/(?:brands|models|colors|memories)['"]/)
})

test('型号和基础选项查询没有重复 SQL 实现', () => {
  const service = require(servicePath)
  assert.equal(typeof service.listModelsByBrand, 'function')

  const serviceSource = fs.readFileSync(servicePath, 'utf8')
  const queryRepository = fs.readFileSync(path.join(root, 'src/repositories/query.repository.js'), 'utf8')
  assert.match(serviceSource, /SELECT id FROM brands WHERE name = \? LIMIT 1/)
  assert.match(serviceSource, /includeNullStatus = false/)
  assert.match(serviceSource, /\(status = 1 OR status IS NULL\)/)
  assert.doesNotMatch(queryRepository, /listModelsByBrand/)
  assert.match(queryRepository, /listActiveReferenceOptions\('brands', \{ includeNullStatus: true \}\)/)
  assert.match(queryRepository, /listActiveReferenceOptions\('colors', \{ includeNullStatus: true \}\)/)
  assert.match(queryRepository, /listActiveReferenceOptions\('memories', \{ includeNullStatus: true \}\)/)
})

test('库存预警保留专用权限和响应契约并复用公共查询', () => {
  const warningRoute = fs.readFileSync(path.join(root, 'src/routes/phone-stock-warnings.js'), 'utf8')
  const warningService = fs.readFileSync(path.join(root, 'src/services/phone-stock-warning.service.js'), 'utf8')
  const warningRepository = fs.readFileSync(path.join(root, 'src/repositories/phone-stock-warning.repository.js'), 'utf8')

  assert.match(warningRoute, /router\.get\('\/models', unifiedAuth, requirePermission\('system:view'\)/)
  for (const resource of ['brands', 'colors', 'memories']) {
    assert.match(warningService, new RegExp(`listActiveReferenceOptions\\('${resource}'\\)`))
  }
  assert.match(warningService, /listModelsByBrand\(\{ brand_id: brandId, activeOnly: true \}\)/)
  assert.doesNotMatch(warningRepository, /FROM (?:models|brands|colors|memories) WHERE/)
})
