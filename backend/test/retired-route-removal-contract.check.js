const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const routeSources = [
  'backend/src/routes/analytics.js',
  'backend/src/routes/attendance.js',
  'backend/src/routes/brands.js',
  'backend/src/routes/csrf.js',
  'backend/src/routes/index.js',
  'backend/src/routes/inventory.js',
  'backend/src/routes/query.js',
  'backend/src/routes/salary-records.js',
  'backend/src/routes/shop.js'
].map(read).join('\n')

test('弃用和兼容路由基础设施已经移除且禁止恢复', () => {
  assert.doesNotMatch(routeSources, /deprecatedRoute|compatibilityRoute|migrationId|compatibilityId/)
  assert.equal(fs.existsSync(path.join(root, 'backend/src/middleware/deprecated-route.js')), false)
  assert.equal(fs.existsSync(path.join(root, 'backend/src/middleware/compatibility-route.js')), false)
  assert.equal(fs.existsSync(path.join(root, 'backend/scripts/audit-deprecated-routes.js')), false)

  const backendPackage = JSON.parse(read('backend/package.json'))
  assert.equal(backendPackage.scripts['audit:deprecated-routes'], undefined)
})

test('28 个历史接口已经从路由注册中移除', () => {
  const analytics = read('backend/src/routes/analytics.js')
  const attendance = read('backend/src/routes/attendance.js')
  const brands = read('backend/src/routes/brands.js')
  const csrf = read('backend/src/routes/csrf.js')
  const index = read('backend/src/routes/index.js')
  const inventory = read('backend/src/routes/inventory.js')
  const query = read('backend/src/routes/query.js')
  const salary = read('backend/src/routes/salary-records.js')
  const shop = read('backend/src/routes/shop.js')

  assert.doesNotMatch(index, /router\.use\(['"]\/operators['"]|require\(['"]\.\/operators['"]\)/)
  assert.doesNotMatch(analytics, /router\.get\(\s*['"]\/sales-trends['"]/)
  assert.doesNotMatch(csrf, /router\.get\(\s*['"]\/csrf-token['"]/)
  assert.doesNotMatch(attendance, /router\.get\(\s*['"]\/my['"]/)
  assert.doesNotMatch(salary, /router\.get\(\s*['"]\/my['"]/)
  assert.doesNotMatch(query, /router\.get\(\s*['"]\/models['"]/)
  assert.doesNotMatch(brands, /router\.get\(\s*['"]\/:brandId\/models['"]/)

  for (const oldPath of [
    '/phones/brands',
    '/phones/models',
    '/phones/colors',
    '/phones/memories'
  ]) assert.doesNotMatch(index, new RegExp(`router\\.get\\(\\s*['"]${oldPath.replaceAll('/', '\\/')}['"]`))

  for (const oldPath of [
    '/:id/movements',
    '/:id/stock-in',
    '/:id/stock-out',
    '/:id/reserve',
    '/:id/unreserve',
    '/:id/adjust',
    '/stock-in'
  ]) assert.doesNotMatch(inventory, new RegExp(`router\\.(?:get|post|put)\\(\\s*['"]${oldPath.replaceAll('/', '\\/')}['"]`))

  assert.doesNotMatch(shop, /router\.(?:get|post|put|delete)\(\s*['"]\/base-data\//)
  assert.doesNotMatch(shop, /router\.get\(\s*['"]\/phones\/:id\/images['"]/)
  assert.doesNotMatch(shop, /router\.put\(\s*['"]\/images\/:id\/primary['"]/)
  assert.doesNotMatch(shop, /router\.delete\(\s*['"]\/images\/:id['"]/)
  assert.doesNotMatch(shop, /router\.post\(\s*['"]\/upload-phone-image['"]/)
  assert.doesNotMatch(shop, /router\.get\(\s*['"]\/products\/:id\/images['"]/)
  assert.doesNotMatch(shop, /router\.put\(\s*['"]\/products\/:id\/images\/reorder['"]/)
})

test('本站前端使用规范接口且正式媒体删除入口保留', () => {
  const frontendRoot = path.join(root, 'frontend/src')
  const frontendSource = []
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (/\.(?:ts|vue|js)$/.test(entry.name)) frontendSource.push(fs.readFileSync(entryPath, 'utf8'))
    }
  }
  visit(frontendRoot)
  const source = frontendSource.join('\n')

  for (const oldPath of [
    '/query/models',
    '/phones/brands',
    '/phones/models',
    '/phones/colors',
    '/phones/memories',
    '/shop/base-data/',
    '/shop/phones/',
    '/shop/images/',
    '/shop/upload-phone-image',
    '/attendance/my',
    '/salary-records/my',
    '/analytics/sales-trends',
    '/csrf/csrf-token'
  ]) assert.equal(source.includes(oldPath), false, `前端仍引用旧接口：${oldPath}`)

  assert.match(source, /\/users\/operators/)
  assert.match(source, /\/brands\?all=true/)
  assert.match(source, /\/models/)
  assert.match(source, /\/phones\/\$\{[^}]+\}\/images\/reorder/)

  const shop = read('backend/src/routes/shop.js')
  assert.match(shop, /router\.delete\(['"]\/products\/:id\/images['"]/)
})
