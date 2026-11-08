'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ShopPublicMarketingController = require('../src/controllers/shop-public-marketing.controller')
const ShopPublicService = require('../src/services/shop-public.service')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('public marketing lexicon route delegates without adding authentication', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/shop-public.js'), 'utf8')
  assert.match(route, /router\.get\('\/marketing\/lexicon', shopPublicMarketingController\.getLexicon\.bind\(shopPublicMarketingController\)\)/)
  assert.match(route, /router\.post\('\/marketing\/generate', publicMarketingRateLimit, shopPublicMarketingController\.generate\.bind\(shopPublicMarketingController\)\)/)
})

test('marketing lexicon controller preserves the unified response and service result', async () => {
  const data = { modeLexicon: {}, source: 'empty' }
  const controller = new ShopPublicMarketingController({
    service: { async getMarketingLexicon() { return { data, message: '营销词库为空，请先在后台配置' } } }
  })
  const res = response()

  await controller.getLexicon({}, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.equal(res.body.message, '营销词库为空，请先在后台配置')
  assert.deepEqual(res.body.data, data)
})

test('marketing lexicon service normalizes stored data and applies established limits', async () => {
  const lines = Array.from({ length: 205 }, (_, index) => ` line ${index} `)
  const service = new ShopPublicService({
    systemSettingsService: {
      async getSettingByKey(key) {
        assert.equal(key, 'marketing_lexicon')
        return { value: {
          subsidyEnabled: true,
          colorEnabled: 1,
          modeLexicon: { opening: { lines, nightLines: lines, salesTalks: lines } },
          typeLexicon: { warm: { lines: [' hi ', '', 3] } },
          contextLexicon: {
            holiday: [' Spring ', '', 'Day'],
            weather: { sunny: [' bright ', null] },
            timeSegment: { morning: [' early ', ''] }
          },
          eventLexicon: { solarTerms: { spring: [' arrive ', ''] } },
          updatedAt: '2026-01-02T03:04:05.000Z'
        } }
      }
    }
  })

  const result = await service.getMarketingLexicon()

  assert.equal(result.message, '获取营销词库成功')
  assert.equal(result.data.subsidyEnabled, true)
  assert.equal(result.data.colorEnabled, false)
  assert.equal(result.data.modeLexicon.opening.lines.length, 200)
  assert.equal(result.data.modeLexicon.opening.nightLines.length, 100)
  assert.equal(result.data.modeLexicon.opening.salesTalks.length, 200)
  assert.deepEqual(result.data.typeLexicon.warm.lines, ['hi', '3'])
  assert.deepEqual(result.data.contextLexicon.holiday, { all: ['Spring', 'Day'] })
  assert.deepEqual(result.data.contextLexicon.weather, { sunny: ['bright', 'null'] })
  assert.deepEqual(result.data.contextLexicon.timeSegment, { morning: ['early'] })
  assert.deepEqual(result.data.eventLexicon, {
    solarTerms: { spring: ['arrive'] },
    traditionalHolidays: {},
    historicalDays: {}
  })
  assert.equal(result.data.updatedAt, '2026-01-02T03:04:05.000Z')
  assert.equal(result.data.source, 'database')
})

test('marketing lexicon service returns distinct empty and read-failure fallbacks', async () => {
  const warnings = []
  const options = {
    now: () => new Date('2026-11-07T00:00:00.000Z'),
    logger: { warn(...args) { warnings.push(args) } }
  }
  const emptyService = new ShopPublicService({
    ...options,
    systemSettingsService: { async getSettingByKey() { return null } }
  })
  const empty = await emptyService.getMarketingLexicon()
  assert.equal(empty.message, '营销词库为空，请先在后台配置')
  assert.equal(empty.data.source, 'empty')
  assert.equal(empty.data.updatedAt, '2026-11-07T00:00:00.000Z')

  const failedService = new ShopPublicService({
    ...options,
    systemSettingsService: { async getSettingByKey() { throw new Error('settings unavailable') } }
  })
  const failed = await failedService.getMarketingLexicon()
  assert.equal(failed.message, '获取营销词库成功')
  assert.equal(failed.data.source, 'empty')
  assert.equal(failed.data.updatedAt, '2026-11-07T00:00:00.000Z')
  assert.equal(warnings.length, 1)
  assert.deepEqual(warnings[0], ['营销词库读取失败，返回空词库:', 'settings unavailable'])
})

test('marketing generation service preserves provider request, prompt and normalized suggestions', async () => {
  const calls = []
  const service = new ShopPublicService({
    systemSettingsService: {
      async getSettingByKey(key) {
        assert.equal(key, 'marketing_generation_config')
        return { value: {
          enabled: true,
          provider: 'openai',
          endpoint: 'https://provider.example/generate',
          apiKey: 'test-api-key',
          model: 'copy-model',
          timeoutMs: 7000,
          temperature: 0.4,
          maxTokens: 900,
          headers: { 'X-Request-Source': 'shop' }
        } }
      }
    },
    fetcher: async (...args) => {
      calls.push(args)
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '```json\n[{"title":"精选","text":" 优选商品 ","tone":"自然","tags":[1]},"第二条","多余"]\n```' } }] }
        }
      }
    }
  })

  const result = await service.generateMarketingCopy({
    mode: 'opening', count: 2, condition: 'sunny', product: { model: 'phone' }, context: { city: 'Hangzhou' }, types: ['warm']
  })

  assert.equal(result.message, '在线文案生成成功')
  assert.equal(result.data.source, 'online')
  assert.deepEqual(result.data.suggestions, [
    { id: 'online-0', title: '精选', tone: '自然', text: '优选商品', tags: ['1'] },
    { id: 'online-1', title: '🌐在线灵感', tone: '在线生成', text: '第二条', tags: ['在线生成'] }
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'https://provider.example/generate')
  assert.equal(calls[0][1].method, 'POST')
  assert.equal(calls[0][1].headers.Authorization, 'Bearer test-api-key')
  assert.equal(calls[0][1].headers['X-Request-Source'], 'shop')
  assert.equal(typeof calls[0][1].signal.addEventListener, 'function')
  const payload = JSON.parse(calls[0][1].body)
  assert.equal(payload.model, 'copy-model')
  assert.equal(payload.temperature, 0.4)
  assert.equal(payload.max_tokens, 900)
  assert.match(payload.messages[0].content, /只返回 JSON 数组/)
  assert.deepEqual(JSON.parse(payload.messages[1].content), {
    mode: 'opening', condition: 'sunny', product: { model: 'phone' },
    context: { city: 'Hangzhou' }, types: ['warm'], count: 2
  })
})

test('marketing generation fallback covers disabled providers and unavailable upstreams', async () => {
  const warnings = []
  let fetchCalls = 0
  const options = {
    logger: { warn(...args) { warnings.push(args) } },
    fetcher: async () => { fetchCalls += 1; throw new Error('upstream unavailable') }
  }
  const disabled = new ShopPublicService({
    ...options,
    systemSettingsService: { async getSettingByKey() { return { value: { enabled: false } } } }
  })
  assert.deepEqual(await disabled.generateMarketingCopy({}), {
    data: { suggestions: [], source: 'local-fallback' },
    message: '在线生成未启用'
  })
  assert.equal(fetchCalls, 0)

  const enabled = new ShopPublicService({
    ...options,
    systemSettingsService: {
      async getSettingByKey() {
        return { value: { enabled: true, provider: 'ollama', endpoint: 'http://localhost:11434/api/chat' } }
      }
    }
  })
  assert.deepEqual(await enabled.generateMarketingCopy({}), {
    data: { suggestions: [], source: 'local-fallback' },
    message: '在线生成不可用，已使用本地文案'
  })
  assert.equal(fetchCalls, 1)
  assert.deepEqual(warnings, [['在线营销文案生成失败，回退本地生成:', 'upstream unavailable']])
})

test('marketing controller maps generated service results to the established response', async () => {
  const data = { suggestions: [], source: 'local-fallback' }
  const controller = new ShopPublicMarketingController({
    service: { async generateMarketingCopy(input) {
      assert.deepEqual(input, { mode: 'night' })
      return { data, message: '在线生成未启用' }
    } }
  })
  const res = response()

  await controller.generate({ body: { mode: 'night' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.equal(res.body.message, '在线生成未启用')
  assert.deepEqual(res.body.data, data)
})
