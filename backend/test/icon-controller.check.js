'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const IconController = require('../src/controllers/icon.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('本地图标读取路由按原路径委托 controller 并保留特殊路径顺序', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/icons.js'), 'utf8')
  assert.match(route, /router\.get\('\/', iconController\.list\.bind\(iconController\)\)/)
  assert.match(route, /router\.get\('\/by-class', iconController\.byClass\.bind\(iconController\)\)/)
  assert.match(route, /router\.get\('\/categories', iconController\.categories\.bind\(iconController\)\)/)
  assert.match(route, /router\.get\('\/search\/online', unifiedAuth, requirePermission\('menus:view'\), iconifyRateLimit, iconController\.searchOnline\.bind\(iconController\)\)/)
  assert.match(route, /router\.get\('\/preview', unifiedAuth, requirePermission\('menus:view'\), iconifyRateLimit, iconController\.preview\.bind\(iconController\)\)/)
  assert.match(route, /router\.get\('\/collections', unifiedAuth, requirePermission\('menus:view'\), iconifyRateLimit, iconController\.collections\.bind\(iconController\)\)/)
  assert.match(route, /router\.get\('\/collection\/:prefix', unifiedAuth, requirePermission\('menus:view'\), iconifyRateLimit, iconController\.collection\.bind\(iconController\)\)/)
  assert.match(route, /router\.get\('\/:id', iconController\.getById\.bind\(iconController\)\)/)
  assert.ok(route.indexOf("router.get('/by-class'") < route.indexOf("router.get('/:id'"))
  assert.ok(route.indexOf("router.get('/categories'") < route.indexOf("router.get('/:id'"))
})

test('批量预览按集合读取 JSON，正确转换尺寸和别名，不写数据库且部分失败可恢复', async () => {
  const urls = []
  const controller = new IconController({
    getDatabase: () => { throw new Error('预览禁止连接数据库') },
    fetchIconifyJson: async url => {
      urls.push(url)
      if (url.includes('/mdi.json')) throw new Error('rate limited')
      return { prefix: 'lucide', width: 24, height: 24, icons: { phone: { body: '<path d="M1 2L3 4"/>' } }, aliases: { 'phone-flipped': { parent: 'phone', hFlip: true } } }
    },
    logger: { warn() {}, error() {} }
  })
  const response = createResponse()
  await controller.preview({ query: { names: 'lucide:phone,lucide:phone-flipped,mdi:phone,lucide:phone' } }, response)
  assert.deepEqual(urls.sort(), ['https://api.iconify.design/lucide.json?icons=phone,phone-flipped', 'https://api.iconify.design/mdi.json?icons=phone'])
  assert.equal(response.body.data.length, 3)
  assert.match(response.body.data[0].svg, /viewBox="0 0 24 24"/)
  assert.match(response.body.data[0].svg, /<path/)
  assert.match(response.body.data[1].svg, /transform=/)
  assert.equal(response.body.data[2].svg, null)
})

test('批量预览拒绝空值、超量和任意外部地址，不向上游发请求', async () => {
  const controller = new IconController({ fetchIconifyJson: async () => { throw new Error('不应请求上游') }, logger: { error() {} } })
  for (const names of ['', 'https://evil.test/a', 'lucide:../phone', Array(25).fill('lucide:phone').join(',')]) {
    const response = createResponse()
    await controller.preview({ query: { names } }, response)
    assert.equal(response.statusCode, 400)
  }
})

test('写入路由委托 controller 并保留权限边界', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/icons.js'), 'utf8')
  for (const [verb, endpoint, permission, handler] of [
    ['post', '/cache', 'menus:view', 'cache'],
    ['post', '/cleanup', 'menus:edit', 'cleanup'],
    ['delete', '/:id', 'menus:edit', 'remove']
  ]) {
    assert.ok(route.includes(`router.${verb}('${endpoint}', unifiedAuth, requirePermission('${permission}'), iconController.${handler}.bind(iconController))`))
  }
})

test('缓存图标校验字段、清理 SVG 并参数化写入', async () => {
  const queries = []
  const controller = new IconController({
    getDatabase: () => ({ async execute(sql, values) {
      queries.push({ sql, values })
      return sql.includes('SELECT id, class') ? [[{ id: 7 }]] : [{}]
    } }),
    ensureIconSchema: async () => {},
    fetchIconifySvg: async () => '<svg>safe</svg>',
    logger: { warn() {}, error() {} }
  })
  const invalid = createResponse()
  await controller.cache({ body: { class: 'fa-home', name: 'Home', category: 'menu', tags: 'x'.repeat(501) } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(queries.length, 0)

  const response = createResponse()
  await controller.cache({ body: { class: 'iconify lucide:home', name: 'Home', category: 'menu', svg: '<script>x</script>' } }, response)
  assert.equal(response.body.data.id, 7)
  assert.equal(queries.length, 3)
  const write = queries.find(query => query.sql.includes('INSERT INTO icons'))
  assert.match(write.sql, /ON DUPLICATE KEY UPDATE/)
  assert.ok(!write.sql.includes('lucide:home'))
  assert.deepEqual(write.values, ['iconify lucide:home', 'Home', 'menu', null, null, '<svg>safe</svg>', 'lucide:home', 'iconify', 1])
})

test('在线图标下载失败或返回非 SVG 时拒绝保存，不写无效记录或覆盖原记录', async () => {
  for (const mode of ['error', 'invalid']) {
    let writes = 0
    const controller = new IconController({
      getDatabase: () => ({}), ensureIconSchema: async () => {},
      repository: { findByClass: async () => null, upsert: async () => { writes++ } },
      fetchIconifySvg: async () => { if (mode === 'error') throw new Error('timeout'); return '<html>error</html>' },
      logger: { warn() {}, error() {} }
    })
    const result = createResponse()
    await controller.cache({ body: { class: 'iconify lucide:home', name: '首页', category: 'menu' } }, result)
    assert.equal(result.statusCode, 502)
    assert.equal(result.body.success, false)
    assert.equal(writes, 0)
  }
})

test('已保存的有效图标可直接复用本地 SVG，离线时无需重新下载', async () => {
  const saved = { class: 'iconify lucide:home', svg: '<svg><path d="M0 0"/></svg>', is_valid: 1 }
  let downloaded = false
  let written
  const controller = new IconController({
    getDatabase: () => ({}), ensureIconSchema: async () => {},
    repository: { findByClass: async () => saved, upsert: async (_pool, icon) => { written = icon } },
    fetchIconifySvg: async () => { downloaded = true; throw new Error('offline') },
    logger: { warn() {}, error() {} }
  })
  const result = createResponse()
  await controller.cache({ body: { class: saved.class, name: '首页', category: 'menu' } }, result)
  assert.equal(result.body.success, true)
  assert.equal(written.svg, saved.svg)
  assert.equal(written.isValid, 1)
  assert.equal(downloaded, false)
})

test('清理图标仅删除未被菜单引用的无效项', async () => {
  let sql
  const controller = new IconController({
    getDatabase: () => ({ async execute(query) { sql = query; return [{ affectedRows: 2 }] } }),
    ensureIconSchema: async () => {},
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.cleanup({}, response)
  assert.match(sql, /LEFT JOIN menus m ON/)
  assert.match(sql, /WHERE m\.id IS NULL/)
  assert.deepEqual(response.body.data, { deletedCount: 2 })
})

test('删除图标拒绝无效 ID 和被菜单引用的图标', async () => {
  const queries = []
  const controller = new IconController({
    getDatabase: () => ({ async execute(sql, values) {
      queries.push({ sql, values })
      if (sql.includes('FROM icons WHERE id')) return [[{ id: 7, class: 'fa-home' }]]
      if (sql.includes('COUNT(*)')) return [[{ total: 1 }]]
      return [{ affectedRows: 1 }]
    } }),
    ensureIconSchema: async () => {},
    logger: { error() {} }
  })
  const invalid = createResponse()
  await controller.remove({ params: { id: 'bad' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(queries.length, 0)
  const occupied = createResponse()
  await controller.remove({ params: { id: '7' } }, occupied)
  assert.equal(occupied.statusCode, 409)
  assert.equal(queries.filter(({ sql }) => sql.startsWith('DELETE')).length, 0)
  assert.deepEqual(queries[1].values, ['fa-home'])
})

test('删除图标保留不存在、成功删除和数据库异常响应', async () => {
  const calls = []
  let mode = 'missing'
  const controller = new IconController({
    getDatabase: () => ({ async execute(sql, values) {
      calls.push({ sql, values })
      if (mode === 'error') throw new Error('db unavailable')
      if (sql.includes('FROM icons WHERE id')) {
        return mode === 'missing' ? [[]] : [[{ id: 9, class: 'fa-star', name: 'Star' }]]
      }
      if (sql.includes('COUNT(*)')) return [[{ total: 0 }]]
      return [{ affectedRows: 1 }]
    } }),
    ensureIconSchema: async () => {},
    logger: { error() {} }
  })
  const missing = createResponse()
  await controller.remove({ params: { id: '9' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(calls.length, 1)

  mode = 'found'
  const removed = createResponse()
  await controller.remove({ params: { id: '9' } }, removed)
  assert.equal(removed.body.message, '图标已删除')
  assert.deepEqual(removed.body.data, { id: 9, class: 'fa-star', name: 'Star' })
  assert.equal(calls.at(-1).sql, 'DELETE FROM icons WHERE id = ?')
  assert.deepEqual(calls.at(-1).values, [9])

  mode = 'error'
  const failed = createResponse()
  await controller.remove({ params: { id: '9' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '删除图标失败')
})

test('图标列表 controller 保留搜索筛选、有效状态、分页上限和响应字段', async () => {
  const formatted = []
  const executed = []
  let initializedPool
  const icons = [{ id: 4, class: 'fa-home' }]
  const pool = {
    format(query, values) {
      formatted.push({ query, values })
      return query
    },
    async execute(query) {
      executed.push(query)
      return query.includes('COUNT(*)') ? [[{ total: 4 }], []] : [icons, []]
    }
  }
  const controller = new IconController({
    getDatabase: () => pool,
    ensureIconSchema: async value => { initializedPool = value },
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.list({
    query: { limit: '500', page: '2', category: 'navigation', search: 'home', offset: '1' }
  }, response)

  assert.equal(initializedPool, pool)
  assert.deepEqual(formatted.map(item => item.values), [
    ['navigation', '%home%', '%home%', '%home%', '%home%', '%home%', 100, 1],
    ['navigation', '%home%', '%home%', '%home%', '%home%', '%home%']
  ])
  assert.match(formatted[0].query, /is_valid IS NULL OR is_valid = 1/)
  assert.equal(executed.length, 2)
  assert.equal(response.body.message, '图标数据获取成功')
  assert.deepEqual(response.body.data, icons)
  assert.equal(response.body.total, 4)
  assert.equal(response.body.page, 2)
  assert.equal(response.body.limit, 100)
  assert.equal(response.body.hasMore, true)
})

test('图标按 class 校验空值并保留不存在和读取失败响应', async () => {
  let databaseCalls = 0
  const controller = new IconController({
    getDatabase: () => {
      databaseCalls += 1
      return { async execute() { return [[], []] } }
    },
    ensureIconSchema: async () => {},
    logger: { error() {} }
  })
  const missingClass = createResponse()
  await controller.byClass({ query: { class: '  ' } }, missingClass)
  assert.equal(missingClass.statusCode, 400)
  assert.equal(databaseCalls, 0)

  const notFound = createResponse()
  await controller.byClass({ query: { class: 'fa-missing' } }, notFound)
  assert.equal(notFound.statusCode, 404)
  assert.equal(notFound.body.message, '图标不存在')

  const optional = createResponse()
  await controller.byClass({ query: { class: 'iconify lucide:missing', optional: '1' } }, optional)
  assert.equal(optional.statusCode, undefined)
  assert.equal(optional.body.success, true)
  assert.equal(optional.body.data, null)

  const failingController = new IconController({
    getDatabase: () => ({ async execute() { throw new Error('query failed') } }),
    ensureIconSchema: async () => {},
    logger: { error() {} }
  })
  const failed = createResponse()
  await failingController.byClass({ query: { class: 'fa-home' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '图标获取失败')
  assert.equal(failed.body.error, 'query failed')
})

test('图标分类和 ID 查询保持规范响应及 404', async () => {
  const calls = []
  const controller = new IconController({
    getDatabase: () => ({
      async execute(query, values) {
        calls.push({ query, values })
        if (query.includes('DISTINCT category')) return [[{ category: 'navigation' }, { category: 'system' }], []]
        if (values[0] === '5') return [[{ id: 5, class: 'fa-home' }], []]
        return [[], []]
      }
    }),
    ensureIconSchema: async () => {},
    logger: { error() {} }
  })
  const categories = createResponse()
  await controller.categories({}, categories)
  assert.deepEqual(categories.body.data, ['navigation', 'system'])
  assert.equal(categories.body.total, 2)

  const found = createResponse()
  await controller.getById({ params: { id: '5' } }, found)
  assert.equal(found.body.data.id, 5)
  assert.deepEqual(calls[1].values, ['5'])

  const missing = createResponse()
  await controller.getById({ params: { id: '6' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '图标不存在')
})

test('Iconify 集合 controller 排序和映射集合元信息', async () => {
  let requestedUrl
  const controller = new IconController({
    fetchIconifyJson: async url => {
      requestedUrl = url
      return {
        small: { name: 'Small Set', total: 2, samples: ['one'], license: 'MIT' },
        large: { name: 'Large Set', total: 8, author: 'Author' }
      }
    },
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.collections({}, response)

  assert.equal(requestedUrl, 'https://api.iconify.design/collections')
  assert.deepEqual(response.body.data, [
    { prefix: 'large', name: 'Large Set', total: 8, author: 'Author', samples: [], license: 'unknown' },
    { prefix: 'small', name: 'Small Set', total: 2, author: 'Unknown', samples: ['one'], license: 'MIT' }
  ])
  assert.equal(response.body.total, 2)
  assert.equal(response.body.message, '获取到 2 个图标集合')
})

test('Iconify 集合详情校验前缀、限制数量并构造前端字段', async () => {
  let requestedUrl
  const controller = new IconController({
    fetchIconifyJson: async url => {
      requestedUrl = url
      return { name: 'Material Symbols', total: 1200, icons: ['home-outline', 'settings', 'person'] }
    },
    logger: { error() {} }
  })
  const invalid = createResponse()
  await controller.collection({ params: { prefix: '../bad' }, query: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(requestedUrl, undefined)

  const response = createResponse()
  await controller.collection({ params: { prefix: 'material-symbols' }, query: { limit: '2' } }, response)
  assert.equal(requestedUrl, 'https://api.iconify.design/collection?prefix=material-symbols')
  assert.deepEqual(response.body.data, [
    {
      id: 'material-symbols-0', class: 'iconify material-symbols:home-outline',
      name: 'home outline', category: 'material-symbols', description: 'material-symbols 图标',
      tags: 'material-symbols', source: 'online', iconifyName: 'material-symbols:home-outline'
    },
    {
      id: 'material-symbols-1', class: 'iconify material-symbols:settings',
      name: 'settings', category: 'material-symbols', description: 'material-symbols 图标',
      tags: 'material-symbols', source: 'online', iconifyName: 'material-symbols:settings'
    }
  ])
  assert.equal(response.body.total, 2)
  assert.deepEqual(response.body.collection, { prefix: 'material-symbols', name: 'Material Symbols', total: 1200 })
})

test('Iconify 集合接口保留上限和上游错误响应', async () => {
  let fetchedLimit
  const controller = new IconController({
    fetchIconifyJson: async url => {
      if (url.endsWith('/collections')) throw new Error('upstream failed')
      fetchedLimit = url
      return { icons: Array.from({ length: 501 }, (_, index) => `icon-${index}`) }
    },
    logger: { error() {} }
  })
  const failed = createResponse()
  await controller.collections({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '获取集合列表失败')
  assert.equal(failed.body.error, 'upstream failed')

  const capped = createResponse()
  await controller.collection({ params: { prefix: 'test-set' }, query: { limit: '1000' } }, capped)
  assert.equal(fetchedLimit, 'https://api.iconify.design/collection?prefix=test-set')
  assert.equal(capped.body.data.length, 500)
  assert.equal(capped.body.collection.total, 500)
})

test('Iconify 在线搜索保留关键词翻译、去重、集合信息和查询上限', async () => {
  const requestedUrls = []
  const controller = new IconController({
    defaultSearchLimit: 25,
    translateKeywords: query => {
      assert.equal(query, '手机')
      return ['mobile', 'phone']
    },
    fetchIconifyJson: async url => {
      requestedUrls.push(url)
      return requestedUrls.length === 1
        ? { icons: ['mdi:cellphone', 'lucide:phone'], collections: { mdi: { name: 'Material', total: 2 } } }
        : { icons: ['lucide:phone', 'tabler:device-mobile'], collections: { tabler: { name: 'Tabler' } } }
    },
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.searchOnline({ query: { query: ' 手机 ', limit: '3', prefix: 'lucide' } }, response)

  assert.deepEqual(requestedUrls, [
    'https://api.iconify.design/search?query=mobile&limit=3&prefix=lucide',
    'https://api.iconify.design/search?query=phone&limit=3&prefix=lucide'
  ])
  assert.deepEqual(response.body.data.map(icon => icon.iconifyName), [
    'mdi:cellphone', 'lucide:phone', 'tabler:device-mobile'
  ])
  assert.deepEqual(response.body.collections, [
    { prefix: 'mdi', name: 'Material', total: 2 },
    { prefix: 'tabler', name: 'Tabler', total: 0 }
  ])
  assert.equal(response.body.total, 3)
  assert.equal(response.body.source, 'online')
})

test('Iconify 在线搜索校验空词、长度、前缀并处理空结果和上游异常', async () => {
  let fetchCount = 0
  const controller = new IconController({
    fetchIconifyJson: async () => {
      fetchCount += 1
      return { icons: [] }
    },
    logger: { error() {} }
  })
  const empty = createResponse()
  await controller.searchOnline({ query: {} }, empty)
  assert.equal(empty.body.message, '请提供搜索关键词')

  const tooLong = createResponse()
  await controller.searchOnline({ query: { query: 'x'.repeat(101) } }, tooLong)
  assert.equal(tooLong.statusCode, 400)
  assert.equal(tooLong.body.message, '搜索关键词不能超过100个字符')

  const invalidPrefix = createResponse()
  await controller.searchOnline({ query: { query: 'phone', prefix: '../invalid' } }, invalidPrefix)
  assert.equal(invalidPrefix.statusCode, 400)
  assert.equal(fetchCount, 0)

  const noMatches = createResponse()
  await controller.searchOnline({ query: { query: 'phone' } }, noMatches)
  assert.equal(noMatches.body.message, '未找到匹配的图标')
  assert.equal(noMatches.body.source, 'online')

  const failingController = new IconController({
    fetchIconifyJson: async () => { throw new Error('Iconify unavailable') },
    logger: { error() {} }
  })
  const failed = createResponse()
  await failingController.searchOnline({ query: { query: 'phone' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '在线搜索失败')
  assert.equal(failed.body.error, 'Iconify unavailable')
  assert.equal(failed.body.source, 'online')
})
