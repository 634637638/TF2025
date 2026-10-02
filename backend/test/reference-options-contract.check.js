const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const servicePath = path.join(root, 'src/services/reference-options.service.js')
const shopRoutePath = path.join(root, 'src/routes/shop.js')
const queryRepositoryPath = path.join(root, 'src/repositories/query.repository.js')
const brandsRoutePath = path.join(root, 'src/routes/brands.js')

test('模板基础选项查询由公共服务提供', () => {
  const service = require(servicePath)
  assert.equal(typeof service.listTemplateReferenceOptions, 'function')

  const routeSource = fs.readFileSync(shopRoutePath, 'utf8')
  const start = routeSource.indexOf("router.get('/base-data/brands'")
  const end = routeSource.indexOf("router.post('/upload-phone-image'")
  assert.ok(start >= 0 && end > start, '未找到模板基础选项兼容路由区间')

  const compatibilityBlock = routeSource.slice(start, end)
  assert.match(compatibilityBlock, /listTemplateReferenceOptions\('brands'\)/)
  assert.match(compatibilityBlock, /listTemplateReferenceOptions\('models'/)
  assert.match(compatibilityBlock, /listTemplateReferenceOptions\('colors'\)/)
  assert.match(compatibilityBlock, /listTemplateReferenceOptions\('memories'\)/)
  assert.match(compatibilityBlock, /shop-base-data-brands-to-brands/)
  assert.match(compatibilityBlock, /shop-base-data-models-to-models/)
  assert.match(compatibilityBlock, /shop-base-data-colors-to-colors/)
  assert.match(compatibilityBlock, /shop-base-data-memories-to-memories/)
  assert.doesNotMatch(compatibilityBlock, /SELECT\s+id\s*,\s*(?:name|size)/i)
})

test('商城模板基础选项调用统一资源路由', () => {
  const root = path.resolve(__dirname, '..', '..')
  const referenceOptions = fs.readFileSync(path.join(root, 'frontend/src/services/reference-options.ts'), 'utf8')
  const baseDataApi = fs.readFileSync(path.join(root, 'frontend/src/api/base-data.ts'), 'utf8')

  assert.match(referenceOptions, /export const getTemplateBrands[\s\S]*?'\/brands\?all=true'/)
  assert.match(referenceOptions, /export const getModels = \(options: ModelOptionsParams = \{\}\)/)
  assert.match(referenceOptions, /const all = options\.all \?\? \(options\.page === undefined && options\.pageSize === undefined\)/)
  assert.match(referenceOptions, /export const getTemplateColors = getCachedColors/)
  assert.match(referenceOptions, /export const getTemplateMemories = getCachedMemories/)
  assert.doesNotMatch(referenceOptions, /\/shop\/base-data\//)
  assert.match(baseDataApi, /getTemplateBrands/)
})

test('品牌型号联动改用唯一型号资源接口，旧路径只转发', () => {
  const root = path.resolve(__dirname, '..', '..')
  const referenceOptions = fs.readFileSync(path.join(root, 'frontend/src/services/reference-options.ts'), 'utf8')
  const modelsRoute = fs.readFileSync(path.join(root, 'backend/src/routes/models.js'), 'utf8')
  const queryRoute = fs.readFileSync(path.join(root, 'backend/src/routes/query.js'), 'utf8')
  const phonesRoute = fs.readFileSync(path.join(root, 'backend/src/routes/phones.js'), 'utf8')
  const routesIndex = fs.readFileSync(path.join(root, 'backend/src/routes/index.js'), 'utf8')

  assert.match(referenceOptions, /params\.set\('all', 'true'\)/)
  assert.match(referenceOptions, /params\.set\('brand_id', String\(options\.brandId\)\.trim\(\)\)/)
  assert.doesNotMatch(referenceOptions, /`\/brands\/\$\{[^}]+\}\/models`/)
  assert.match(modelsRoute, /requireAnyPermission\(\['models:view', 'brands:view'/)
  assert.match(modelsRoute, /'query:view'/)
  assert.match(modelsRoute, /active_only === 'true'[\s\S]{0,220}listModelsByBrand\(/)
  assert.match(referenceOptions, /if \(options\.activeOnly\) params\.set\('active_only', 'true'\)/)
  assert.match(referenceOptions, /const url = `\/models\$\{query \? `\?\$\{query\}` : ''\}`/)
  assert.match(referenceOptions, /return cachedGet<ReferenceRecord\[]>\(url, url\)/)
  assert.doesNotMatch(referenceOptions, /getCachedModelsByBrand|getCachedModelsForBrand|getCachedModels\s*=|getTemplateModels/)
  assert.doesNotMatch(referenceOptions, /\/query\/models/)
  assert.match(queryRoute, /query-models-to-models/)
  assert.match(modelsRoute, /if \(!\/\^\\d\+\$\/\.test\(String\(brand_id\)\)\)/)
  assert.doesNotMatch(phonesRoute, /router\.get\('\/(?:brands|models|colors|memories)'/)
  assert.match(routesIndex, /router\.get\('\/phones\/brands'/)
  assert.match(routesIndex, /router\.get\('\/phones\/models'/)
  assert.match(routesIndex, /router\.get\('\/phones\/colors'/)
  assert.match(routesIndex, /router\.get\('\/phones\/memories'/)
  assert.match(routesIndex, /forwardPhoneReferenceRoute\(\{ target: '\/brands'/)
  assert.match(routesIndex, /forwardPhoneReferenceRoute\([\s\S]{0,180}target: '\/models'/)
  assert.match(routesIndex, /forwardPhoneReferenceRoute\(\{ target: '\/colors'/)
  assert.match(routesIndex, /forwardPhoneReferenceRoute\(\{ target: '\/memories'/)
})

test('综合查询和品牌联动共享公共型号查询实现', () => {
  const service = require(servicePath)
  assert.equal(typeof service.listModelsByBrand, 'function')

  const queryRepository = fs.readFileSync(queryRepositoryPath, 'utf8')
  const brandsRoute = fs.readFileSync(brandsRoutePath, 'utf8')
  assert.match(queryRepository, /listModelsByBrand\(\{ brand_id, name, include_id, activeOnly: true \}\)/)
  assert.match(brandsRoute, /brand-models-to-models/)
  assert.match(brandsRoute, /listModelsByBrand\(\{[\s\S]*?brand_id: req\.params\.brandId[\s\S]*?activeOnly: false/)
  assert.doesNotMatch(brandsRoute, /req\.url\s*=\s*`\/\?\$\{params\.toString\(\)\}`/)
  const serviceSource = fs.readFileSync(servicePath, 'utf8')
  assert.match(serviceSource, /SELECT id FROM brands WHERE name = \? LIMIT 1/)
  assert.match(serviceSource, /includeNullStatus = false/)
  assert.match(serviceSource, /\(status = 1 OR status IS NULL\)/)
  const modelQuery = serviceSource.slice(
    serviceSource.indexOf('const listModelsByBrand'),
    serviceSource.indexOf('/**\n * 模板管理基础选项')
  )
  assert.match(modelQuery, /ORDER BY \$\{orderSql\}/)
  const resultQuery = modelQuery.slice(modelQuery.indexOf('const [rows] = await'))
  assert.doesNotMatch(resultQuery, /LIMIT\s+\d+/)
  assert.doesNotMatch(queryRepository, /SELECT m\.id, m\.name, m\.brand_id, m\.sort_order, b\.name AS brand_name/)
  assert.match(queryRepository, /listActiveReferenceOptions\('brands', \{ includeNullStatus: true \}\)/)
  assert.match(queryRepository, /listActiveReferenceOptions\('colors', \{ includeNullStatus: true \}\)/)
  assert.match(queryRepository, /listActiveReferenceOptions\('memories', \{ includeNullStatus: true \}\)/)
  assert.doesNotMatch(queryRepository, /db\.query\('SELECT id, (?:name|size as name), sort_order FROM (?:brands|colors|memories)/)
})

test('库存预警保留专用权限和响应契约，但复用公共型号查询', () => {
  const warningRoute = fs.readFileSync(path.join(root, 'src/routes/phone-stock-warnings.js'), 'utf8')
  const warningService = fs.readFileSync(path.join(root, 'src/services/phone-stock-warning.service.js'), 'utf8')
  const warningRepository = fs.readFileSync(path.join(root, 'src/repositories/phone-stock-warning.repository.js'), 'utf8')

  assert.match(warningRoute, /router\.get\('\/models', unifiedAuth, requirePermission\('system:view'\)/)
  for (const resource of ['brands', 'colors', 'memories']) {
    assert.match(warningService, new RegExp(`listActiveReferenceOptions\\('${resource}'\\)`))
  }
  assert.match(warningService, /listModelsByBrand\(\{ brand_id: brandId, activeOnly: true \}\)/)
  assert.match(warningService, /id: Number\(model\.id\),[\s\S]*name: String\(model\.name \|\| ''\)\.trim\(\)/)
  assert.doesNotMatch(warningRepository, /FROM (?:models|brands|colors|memories) WHERE/)
  assert.doesNotMatch(warningService, /getActive(?:ModelsByBrand|Brands|Colors|Memories)/)
})

test('预订单选项复用公共基础资料查询并保留门店专属过滤', () => {
  const preorderRoute = fs.readFileSync(path.join(root, 'src/routes/preorders.js'), 'utf8')
  const optionsStart = preorderRoute.indexOf("router.get('/options'")
  const optionsEnd = preorderRoute.indexOf("router.get('/matchable'", optionsStart)
  const optionsRoute = preorderRoute.slice(optionsStart, optionsEnd)

  for (const resource of ['brands', 'models', 'colors', 'memories']) {
    assert.match(optionsRoute, new RegExp(`listTemplateReferenceOptions\\('${resource}'\\)`))
  }
  assert.match(optionsRoute, /SELECT id, name, sort_order FROM stores WHERE status = 1/)
  assert.match(optionsRoute, /return ApiResponse\.success\(res, \{ stores, brands, models, colors, memories \}\)/)
})
