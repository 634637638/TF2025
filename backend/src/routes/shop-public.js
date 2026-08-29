/**
 * H5商城公开API路由 - 用户端（无需认证）
 * 功能：商品展示、购物车、下单、订单查询、用户认证
 */

const express = require('express')
const router = express.Router()
const ApiResponse = require('../utils/response')
const ShopPublicService = require('../services/shop-public.service')
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const db = require('../config/database')
const { generateMemberNumber } = require('../utils/member-number')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const {
  publicAuthRateLimit,
  publicOrderRateLimit,
  publicLookupRateLimit,
  publicMarketingRateLimit
} = require('../middleware/rate-limit')
const { createOrderAccessToken, verifyOrderAccessToken } = require('../utils/order-access')
const log = require('../utils/log')
const SystemSettingsService = require('../services/system-settings.service')
const { isValidIdCard } = require('../utils/security-enhanced')

const shopPublicService = new ShopPublicService()
const normalizeCartId = value => {
  const cartId = String(value || '').trim()
  return /^cart_[a-f0-9]{32}$/.test(cartId) ? cartId : ''
}

const normalizePublicPagination = query => {
  const page = Math.max(1, Number.parseInt(String(query?.page ?? 1), 10) || 1)
  const page_size = Math.min(100, Math.max(1, Number.parseInt(String(query?.page_size ?? 20), 10) || 20))
  return { page, page_size }
}

const sendPublicPaginated = (res, result, message) => res.status(200).json({
  success: true,
  message,
  data: result.data,
  pagination: {
    page: result.page,
    page_size: result.page_size,
    total: result.total,
    total_pages: result.total_pages,
    has_next: result.has_next,
    has_prev: result.has_prev
  },
  timestamp: new Date().toISOString()
})

// ============================================================================
// 商城配置公开 API
// ============================================================================

/**
 * 获取商城公开配置
 * GET /api/public/shop/config
 * 说明：只返回用户端需要的配置信息
 */
router.get('/shop/config', async (req, res) => {
  try {
    const config = await shopPublicService.getPublicConfig()
    ApiResponse.success(res, config, '获取配置成功')
  } catch (error) {
    log.error('获取商城配置失败:', error)
    ApiResponse.error(res, error.message || '获取配置失败', 500)
  }
})

/**
 * 获取启用的轮播图
 * GET /api/public/shop/banners
 */
router.get('/shop/banners', async (req, res) => {
  try {
    const banners = await shopPublicService.getActiveBanners()
    ApiResponse.success(res, banners, '获取轮播图成功')
  } catch (error) {
    log.error('获取轮播图失败:', error)
    ApiResponse.error(res, error.message || '获取轮播图失败', 500)
  }
})

// ============================================================================
// 商品展示 API
// ============================================================================

/**
 * 获取商品列表
 * GET /api/public/products
 * 参数：page, page_size, brand_id, model_id, is_new, search, sort
 */
router.get('/products', async (req, res) => {
  try {
    const { page, page_size } = normalizePublicPagination(req.query)
    const {
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new,
      search,
      sort = 'created_at',
      order = 'DESC'
    } = req.query

    // 调试日志
    log.debug('[API /public/products] 请求参数:', {
      page,
      page_size,
      brand_id,
      model_id,
      is_new,
      is_new_type: typeof is_new,
      sort,
      order
    })

    const parsed_is_new = is_new !== undefined ? (is_new === 'true' || is_new === true || is_new === '1' || is_new === 1) : null
    log.debug('[API /public/products] 解析后的 is_new:', parsed_is_new, typeof parsed_is_new)

    const result = await shopPublicService.getProducts({
      page,
      page_size,
      brand_id: brand_id ? parseInt(brand_id) : null,
      model_id: model_id ? parseInt(model_id) : null,
      color_id: color_id ? parseInt(color_id) : null,
      memory_id: memory_id ? parseInt(memory_id) : null,
      is_new: parsed_is_new,
      search,
      sort,
      order
    })

    log.debug('[API /public/products] 查询结果:', {
      total: result.total,
      count: result.data?.length || 0,
      page: result.page
    })

    sendPublicPaginated(res, result, '获取商品列表成功')
  } catch (error) {
    log.error('[API /public/products] 获取商品列表失败:', error)
    ApiResponse.serverError(res, '获取商品列表失败', error)
  }
})

// ============================================================================
// 聚合商品 API（按品牌+型号+颜色聚合）
// 注意：这些路由必须在 /products/:id 之前定义
// ============================================================================

/**
 * 获取聚合商品列表
 * GET /api/public/products/aggregate
 * 参数：page, page_size, brand_id, model_id, is_new, color_id
 * 说明：返回按品牌+型号+颜色聚合的商品，每个商品包含可选的内存规格
 */
router.get('/products/aggregate', async (req, res) => {
  try {
    const { page, page_size } = normalizePublicPagination(req.query)
    const {
      brand_id,
      model_id,
      is_new,
      color_id,
      search
    } = req.query

    log.debug('[API /public/products/aggregate] 请求参数:', {
      page,
      page_size,
      brand_id,
      model_id,
      is_new,
      color_id,
      search
    })

    const parsed_is_new = is_new !== undefined ? (is_new === 'true' || is_new === true || is_new === '1' || is_new === 1) : null

    const result = await shopPublicService.getAggregatedProducts({
      page,
      page_size,
      brand_id: brand_id !== undefined ? parseInt(brand_id) : null,
      model_id: model_id !== undefined ? parseInt(model_id) : null,
      color_id: color_id !== undefined ? parseInt(color_id) : null,
      is_new: parsed_is_new,
      search
    })

    log.debug('[API /public/products/aggregate] 查询结果:', {
      total: result.total,
      count: result.data?.length || 0,
      page: result.page
    })

    sendPublicPaginated(res, result, '获取聚合商品列表成功')
  } catch (error) {
    log.error('[API /public/products/aggregate] 获取聚合商品列表失败:', error)
    ApiResponse.serverError(res, '获取聚合商品列表失败', error)
  }
})

/**
 * 获取聚合商品的库存分布
 * GET /api/public/products/stock/distribution
 * 参数：brand_id, model_id, color_id, memory_id, is_new
 * 说明：返回指定规格组合在各店铺的库存分布
 */
router.get('/products/stock/distribution', async (req, res) => {
  try {
    const {
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new
    } = req.query

    if (!brand_id || !model_id || !color_id || !memory_id || is_new === undefined) {
      return ApiResponse.badRequest(res, '缺少必要参数')
    }

    log.debug('[API /public/products/stock/distribution] 请求参数:', {
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new
    })

    const result = await shopPublicService.getProductStockDistribution(
      parseInt(brand_id),
      parseInt(model_id),
      parseInt(color_id),
      parseInt(memory_id),
      is_new === 'true' || is_new === true
    )

    ApiResponse.success(res, result, '获取库存分布成功')
  } catch (error) {
    log.error('[API /public/products/stock/distribution] 获取库存分布失败:', error)
    ApiResponse.error(res, error.message || '获取库存分布失败', 500)
  }
})

// ============================================================================
// 单个商品详情 API
// ============================================================================

/**
 * 获取商品详情
 * GET /api/public/products/:id
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params
    const product = await shopPublicService.getProductDetail(id)

    if (!product) {
      return ApiResponse.notFound(res, '商品不存在')
    }

    ApiResponse.success(res, product, '获取商品详情成功')
  } catch (error) {
    log.error('获取商品详情失败:', error)
    ApiResponse.error(res, error.message || '获取商品详情失败', 500)
  }
})

/**
 * 获取商品图片
 * GET /api/public/products/:id/images
 */
router.get('/products/:id/images', async (req, res) => {
  try {
    const { id } = req.params
    const images = await shopPublicService.getProductImages(id)
    ApiResponse.success(res, images, '获取商品图片成功')
  } catch (error) {
    log.error('[API /public/products/:id/images] 获取商品图片失败:', error)
    ApiResponse.error(res, error.message || '获取商品图片失败', 500)
  }
})

/**
 * 获取聚合商品的库存分布
 * GET /api/public/products/stock/distribution
 * 参数：brand_id, model_id, color_id, memory_id, is_new
 * 说明：返回指定规格组合在各店铺的库存分布
 */

/**
 * 搜索商品（智能搜索）
 * GET /api/public/products/search/:keyword
 */
router.get('/products/search/:keyword', async (req, res) => {
  try {
    const { keyword } = req.params
    const { page, page_size } = normalizePublicPagination(req.query)

    const result = await shopPublicService.searchProducts(keyword, {
      page,
      page_size
    })

    sendPublicPaginated(res, result, '搜索成功')
  } catch (error) {
    log.error('搜索商品失败:', error)
    ApiResponse.serverError(res, '搜索商品失败', error)
  }
})

/**
 * 获取模板下的商品列表
 * GET /api/public/templates/:id/phones
 */
router.get('/templates/:id/phones', async (req, res) => {
  try {
    const { id } = req.params
    const result = await shopPublicService.getTemplatePhones(id)

    if (!result) {
      return ApiResponse.notFound(res, '模板不存在')
    }

    ApiResponse.success(res, result.phones, '获取商品列表成功')
  } catch (error) {
    log.error('获取模板商品失败:', error)
    ApiResponse.error(res, error.message || '获取模板商品失败', 500)
  }
})

// ============================================================================
// 分类数据 API
// ============================================================================

/**
 * 获取品牌列表
 * GET /api/public/brands
 * 参数：include_empty (可选，是否包含没有商品的品牌)
 */
router.get('/brands', async (req, res) => {
  try {
    const { include_empty } = req.query
    const brands = await shopPublicService.getBrands(include_empty === 'true')
    ApiResponse.success(res, brands, '获取品牌列表成功')
  } catch (error) {
    log.error('获取品牌列表失败:', error)
    ApiResponse.error(res, error.message || '获取品牌列表失败', 500)
  }
})

/**
 * 获取型号列表
 * GET /api/public/models
 * 参数：brand_id (可选，筛选指定品牌的型号)
 *       include_empty (可选，是否包含没有商品的型号)
 */
router.get('/models', async (req, res) => {
  try {
    const { brand_id, include_empty } = req.query
    const models = await shopPublicService.getModels(
      brand_id ? parseInt(brand_id) : null,
      include_empty === 'true'
    )
    ApiResponse.success(res, models, '获取型号列表成功')
  } catch (error) {
    log.error('获取型号列表失败:', error)
    ApiResponse.error(res, error.message || '获取型号列表失败', 500)
  }
})

/**
 * 获取颜色列表
 * GET /api/public/colors
 * 参数：include_empty (可选，是否包含没有商品的颜色)
 */
router.get('/colors', async (req, res) => {
  try {
    const { include_empty } = req.query
    const colors = await shopPublicService.getColors(include_empty === 'true')
    ApiResponse.success(res, colors, '获取颜色列表成功')
  } catch (error) {
    log.error('获取颜色列表失败:', error)
    ApiResponse.error(res, error.message || '获取颜色列表失败', 500)
  }
})

/**
 * 获取内存列表
 * GET /api/public/memories
 */
router.get('/memories', async (req, res) => {
  try {
    const memories = await shopPublicService.getMemories()
    ApiResponse.success(res, memories, '获取内存列表成功')
  } catch (error) {
    log.error('获取内存列表失败:', error)
    ApiResponse.error(res, error.message || '获取内存列表失败', 500)
  }
})

/**
 * 获取营销文案词库
 * GET /api/public/marketing/lexicon
 * 只返回数据库中保存的词库；未配置时返回空词库，不注入内置文案。
 */
router.get('/marketing/lexicon', async (req, res) => {
  const fallback = {
    modeLexicon: {},
    subsidyEnabled: false,
    colorEnabled: false,
    weatherEnabled: false,
    solarTermEnabled: false,
    typeLexicon: {},
    contextLexicon: { holiday: [], solarTerm: [], weather: [], timeSegment: {}, color: {}, subsidy: {} },
    eventLexicon: { solarTerms: {}, traditionalHolidays: {}, historicalDays: {} },
    updatedAt: new Date().toISOString(),
    source: 'empty'
  }

  try {
    const databaseSetting = await SystemSettingsService.getSettingByKey('marketing_lexicon')
    const databaseLexicon = databaseSetting?.value
    if (databaseLexicon && typeof databaseLexicon === 'object') {
      const typeLexicon = databaseLexicon.typeLexicon && typeof databaseLexicon.typeLexicon === 'object'
        ? Object.fromEntries(Object.entries(databaseLexicon.typeLexicon).map(([key, value]) => [
          key,
          {
            lines: Array.isArray(value?.lines) ? value.lines.map(item => String(item).trim()).filter(Boolean).slice(0, 200) : []
          }
        ]))
        : undefined
      const normalizeContextCategory = (value) => Array.isArray(value)
        ? { all: value.map(item => String(item).trim()).filter(Boolean).slice(0, 100) }
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, values]) => [
            key,
            Array.isArray(values) ? values.map(item => String(item).trim()).filter(Boolean).slice(0, 100) : []
          ]))
          : {}
      const contextLexicon = databaseLexicon.contextLexicon && typeof databaseLexicon.contextLexicon === 'object'
        ? {
          holiday: normalizeContextCategory(databaseLexicon.contextLexicon.holiday),
          solarTerm: normalizeContextCategory(databaseLexicon.contextLexicon.solarTerm),
          weather: normalizeContextCategory(databaseLexicon.contextLexicon.weather),
          timeSegment: databaseLexicon.contextLexicon.timeSegment && typeof databaseLexicon.contextLexicon.timeSegment === 'object'
            ? Object.fromEntries(Object.entries(databaseLexicon.contextLexicon.timeSegment).map(([key, values]) => [
              key,
              Array.isArray(values) ? values.map(item => String(item).trim()).filter(Boolean).slice(0, 100) : []
            ]))
            : {},
          color: normalizeContextCategory(databaseLexicon.contextLexicon.color),
          subsidy: normalizeContextCategory(databaseLexicon.contextLexicon.subsidy)
        }
        : undefined
      const eventLexicon = databaseLexicon.eventLexicon && typeof databaseLexicon.eventLexicon === 'object'
        ? Object.fromEntries(['solarTerms', 'traditionalHolidays', 'historicalDays'].map(category => [
          category,
          databaseLexicon.eventLexicon[category] && typeof databaseLexicon.eventLexicon[category] === 'object'
            ? Object.fromEntries(Object.entries(databaseLexicon.eventLexicon[category]).map(([key, values]) => [
              key,
              Array.isArray(values) ? values.map(item => String(item).trim()).filter(Boolean).slice(0, 100) : []
            ]))
            : {}
        ]))
        : undefined
      return ApiResponse.success(res, {
        subsidyEnabled: databaseLexicon.subsidyEnabled === true,
        colorEnabled: databaseLexicon.colorEnabled === true,
        weatherEnabled: databaseLexicon.weatherEnabled === true,
        solarTermEnabled: databaseLexicon.solarTermEnabled === true,
        modeLexicon: databaseLexicon.modeLexicon && typeof databaseLexicon.modeLexicon === 'object'
          ? Object.fromEntries(Object.entries(databaseLexicon.modeLexicon).map(([mode, value]) => [
            mode,
            {
              lines: Array.isArray(value?.lines) ? value.lines.map(item => String(item).trim()).filter(Boolean).slice(0, 200) : [],
              nightLines: Array.isArray(value?.nightLines) ? value.nightLines.map(item => String(item).trim()).filter(Boolean).slice(0, 100) : [],
              salesTalks: Array.isArray(value?.salesTalks) ? value.salesTalks.map(item => String(item).trim()).filter(Boolean).slice(0, 200) : []
            }
          ]))
          : {},
        ...(typeLexicon ? { typeLexicon } : {}),
        ...(contextLexicon ? { contextLexicon } : {}),
        ...(eventLexicon ? { eventLexicon } : {}),
        updatedAt: databaseLexicon.updatedAt || new Date().toISOString(),
        source: 'database'
      }, '获取营销词库成功')
    }

    return ApiResponse.success(res, fallback, '营销词库为空，请先在后台配置')
  } catch (error) {
    log.warn('营销词库读取失败，返回空词库:', error.message)
    return ApiResponse.success(res, fallback, '获取营销词库成功')
  }
})

/**
 * 在线营销文案生成（可选）
 * POST /api/public/marketing/generate
 *
 * 在线接口由后台配置保存，前端只提交生成上下文，不接触密钥。
 * 未启用或接口不可用时返回空结果，由前端继续使用本地生成。
 */
router.post('/marketing/generate', publicMarketingRateLimit, async (req, res) => {
  const fallback = { suggestions: [], source: 'local-fallback' }

  try {
    const setting = await SystemSettingsService.getSettingByKey('marketing_generation_config')
    const config = setting?.value || {}
    const localProvider = ['ollama', 'localai'].includes(String(config.provider || '').toLowerCase())
    if (!config.enabled || !config.endpoint || (!localProvider && !config.apiKey)) {
      return ApiResponse.success(res, fallback, '在线生成未启用')
    }

    const mode = String(req.body?.mode || 'opening')
    const count = Math.max(1, Math.min(8, Number(req.body?.count) || 4))
    const controller = new AbortController()
    const timeoutMs = Math.max(3000, Math.min(20000, Number(config.timeoutMs) || 10000))
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const systemPrompt = String(config.systemPrompt || [
      '你是手机门店朋友圈文案编辑。',
      '必须严格围绕当前模式和文案类型写作。',
      '文案简洁、大气、自然，不堆地点、节气名称、标签或无关参数。',
      '不要把“可爱、高冷、抒情”等类型词生硬贴到商品上，要通过句式和语气体现。',
      '只返回 JSON 数组，每项包含 title、text、tone；不要 Markdown，不要解释。'
    ].join('\n'))
    const userPrompt = JSON.stringify({
      mode,
      condition: req.body?.condition,
      product: req.body?.product || {},
      context: req.body?.context || {},
      types: req.body?.types || [],
      count
    }, null, 2)

    try {
      const response = await fetch(String(config.endpoint), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          ...(config.headers && typeof config.headers === 'object' ? config.headers : {})
        },
        body: JSON.stringify({
          model: String(config.model || ''),
          temperature: Number(config.temperature) || 0.8,
          max_tokens: Number(config.maxTokens) || 1200,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`在线生成接口响应异常: ${response.status}`)
      }

      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content
        || payload?.choices?.[0]?.text
        || payload?.output_text
        || payload?.data?.content
        || ''
      let parsed = content
      if (typeof content === 'string') {
        const normalized = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        try {
          parsed = JSON.parse(normalized)
        } catch {
          parsed = normalized.split(/\n+/).map(text => text.replace(/^\s*\d+[.、)]\s*/, '').trim()).filter(Boolean)
        }
      }

      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.suggestions)
          ? parsed.suggestions
          : []
      const suggestions = items
        .map((item, index) => {
          if (typeof item === 'string') {
            return {
              id: `online-${index}`,
              title: '🌐在线灵感',
              tone: '在线生成',
              text: item.trim(),
              tags: ['在线生成']
            }
          }
          return {
            id: `online-${index}`,
            title: String(item?.title || '🌐在线灵感').trim(),
            tone: String(item?.tone || '在线生成').trim(),
            text: String(item?.text || item?.content || '').trim(),
            tags: Array.isArray(item?.tags) ? item.tags.map(tag => String(tag)) : ['在线生成']
          }
        })
        .filter(item => item.text)
        .slice(0, count)

      return ApiResponse.success(res, {
        suggestions,
        source: 'online'
      }, '在线文案生成成功')
    } finally {
      clearTimeout(timer)
    }
  } catch (error) {
    log.warn('在线营销文案生成失败，回退本地生成:', error.message)
    return ApiResponse.success(res, fallback, '在线生成不可用，已使用本地文案')
  }
})

// ============================================================================
// 购物车 API
// ============================================================================

/**
 * 获取购物车
 * GET /api/public/cart/:cartId
 */
router.get('/cart/:cartId', publicLookupRateLimit, async (req, res) => {
  try {
    const cartId = normalizeCartId(req.params.cartId)
    if (!cartId) return ApiResponse.badRequest(res, '购物车标识无效')
    const cart = await shopPublicService.getCart(cartId)
    ApiResponse.success(res, cart, '获取购物车成功')
  } catch (error) {
    log.error('获取购物车失败:', error)
    ApiResponse.error(res, error.message || '获取购物车失败', 500)
  }
})

/**
 * 添加商品到购物车
 * POST /api/public/cart/add
 * body: { cartId, phoneId, quantity }
 */
router.post('/cart/add', publicOrderRateLimit, async (req, res) => {
  try {
    const cartId = normalizeCartId(req.body?.cartId)
    const phoneId = Number(req.body?.phoneId)
    const quantity = Number(req.body?.quantity ?? 1)

    if (!cartId || !Number.isInteger(phoneId) || phoneId <= 0 || quantity !== 1) {
      return ApiResponse.badRequest(res, '购物车商品或数量不正确')
    }

    await shopPublicService.addToCart(cartId, phoneId, quantity)
    ApiResponse.success(res, null, '添加到购物车成功')
  } catch (error) {
    log.error('添加到购物车失败:', error)
    ApiResponse.error(res, error.message || '添加到购物车失败', 500)
  }
})

/**
 * 更新购物车商品数量
 * PUT /api/public/cart/:id
 * body: { quantity }
 */
router.put('/cart/:id', publicOrderRateLimit, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const quantity = Number(req.body?.quantity)
    const cartId = normalizeCartId(req.body?.cartId)

    if (!Number.isInteger(id) || id <= 0 || !cartId || quantity !== 1) {
      return ApiResponse.badRequest(res, '购物车商品或数量不正确')
    }

    await shopPublicService.updateCartItem(cartId, id, quantity)
    ApiResponse.success(res, null, '更新购物车成功')
  } catch (error) {
    log.error('更新购物车失败:', error)
    ApiResponse.error(res, error.message || '更新购物车失败', 500)
  }
})

/**
 * 删除购物车商品
 * DELETE /api/public/cart/:id
 */
router.delete('/cart/:id', publicOrderRateLimit, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const cartId = normalizeCartId(req.query.cartId)
    if (!Number.isInteger(id) || id <= 0 || !cartId) {
      return ApiResponse.badRequest(res, '购物车商品标识无效')
    }
    await shopPublicService.removeFromCart(cartId, id)
    ApiResponse.success(res, null, '删除成功')
  } catch (error) {
    log.error('删除购物车商品失败:', error)
    ApiResponse.error(res, error.message || '删除失败', 500)
  }
})

/**
 * 清空购物车
 * DELETE /api/public/cart/:cartId/clear
 */
router.delete('/cart/:cartId/clear', publicOrderRateLimit, async (req, res) => {
  try {
    const cartId = normalizeCartId(req.params.cartId)
    if (!cartId) return ApiResponse.badRequest(res, '购物车标识无效')
    await shopPublicService.clearCart(cartId)
    ApiResponse.success(res, null, '清空购物车成功')
  } catch (error) {
    log.error('清空购物车失败:', error)
    ApiResponse.error(res, error.message || '清空购物车失败', 500)
  }
})

// ============================================================================
// 订单 API
// ============================================================================

/**
 * 创建订单
 * POST /api/public/orders/create
 * body: { customerName, customerPhone, customerAddress, items, paymentMethod, remarks }
 * items: [{ phoneId, quantity }, ...]
 */
router.post('/orders/create', publicOrderRateLimit, async (req, res) => {
  try {
    const orderData = req.body && typeof req.body === 'object' ? req.body : {}
    const customerName = String(orderData.customerName || '').trim()
    const customerPhone = String(orderData.customerPhone || '').replace(/\D/g, '')
    const customerAddress = String(orderData.customerAddress || '').trim()
    const remarks = String(orderData.remarks || '').trim()
    const cartId = orderData.cartId ? normalizeCartId(orderData.cartId) : ''

    // 验证必要参数
    if (customerName.length < 2 || customerName.length > 50 || !/^1[3-9]\d{9}$/.test(customerPhone)) {
      return ApiResponse.badRequest(res, '请填写正确的联系人姓名和手机号')
    }

    if (customerAddress.length > 500 || remarks.length > 1000) {
      return ApiResponse.badRequest(res, '地址或备注内容过长')
    }

    if (orderData.cartId && !cartId) {
      return ApiResponse.badRequest(res, '购物车标识无效')
    }

    if (!Array.isArray(orderData.items) || orderData.items.length === 0 || orderData.items.length > 100) {
      return ApiResponse.badRequest(res, '请选择商品')
    }

    const normalizedItems = orderData.items.map(item => ({
      phoneId: Number(item?.phoneId),
      quantity: Number(item?.quantity)
    }))
    const hasInvalidItem = normalizedItems.some(item =>
      !Number.isInteger(item.phoneId)
      || item.phoneId <= 0
      || item.quantity !== 1
    )
    const uniquePhoneIds = new Set(normalizedItems.map(item => item.phoneId))
    if (hasInvalidItem || uniquePhoneIds.size !== normalizedItems.length) {
      return ApiResponse.badRequest(res, '商品或购买数量不正确')
    }

    const order = await shopPublicService.createOrder({
      ...orderData,
      customerName,
      customerPhone,
      customerAddress,
      remarks,
      cartId: cartId || undefined,
      items: normalizedItems
    })
    const accessToken = createOrderAccessToken({
      id: order.orderId,
      orderNumber: order.orderNumber,
      customerPhone
    })
    ApiResponse.created(res, '下单成功', { ...order, accessToken })
  } catch (error) {
    log.error('创建订单失败:', error)
    ApiResponse.error(res, error.message || '创建订单失败', 500)
  }
})

/**
 * 用户确认支付（用户端）
 * POST /api/public/orders/:orderNumber/confirm-payment
 */
router.post('/orders/:orderNumber/confirm-payment', publicOrderRateLimit, async (req, res) => {
  try {
    const { orderNumber } = req.params

    const order = await shopPublicService.getOrderByNumber(orderNumber)
    if (!order || !verifyOrderAccessToken(req.body?.access_token, order)) {
      return ApiResponse.unauthorized(res, '订单访问凭证无效或已过期')
    }

    const result = await shopPublicService.confirmUserPayment(orderNumber)

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在')
    }

    ApiResponse.success(res, result, '支付确认成功，订单状态已更新')
  } catch (error) {
    log.error('确认支付失败:', error)
    ApiResponse.error(res, error.message || '确认支付失败', 500)
  }
})

/**
 * 根据订单号查询订单
 * GET /api/public/orders/:orderNumber
 */
router.get('/orders/:orderNumber', publicLookupRateLimit, async (req, res) => {
  try {
    const { orderNumber } = req.params
    const order = await shopPublicService.getOrderByNumber(orderNumber)

    if (!order) {
      return ApiResponse.notFound(res, '订单不存在')
    }

    const accessToken = req.headers['x-order-access-token'] || req.query.access_token
    if (!verifyOrderAccessToken(accessToken, order)) {
      return ApiResponse.unauthorized(res, '订单访问凭证无效或已过期')
    }

    ApiResponse.success(res, { ...order, access_token: accessToken }, '获取订单成功')
  } catch (error) {
    log.error('获取订单失败:', error)
    ApiResponse.error(res, error.message || '获取订单失败', 500)
  }
})

/**
 * 根据手机号查询订单列表
 * GET /api/public/orders/phone/:phone
 */
router.get('/orders/phone/:customer_phone', publicLookupRateLimit, async (req, res) => {
  try {
    const customer_phone = String(req.params.customer_phone || '').replace(/\D/g, '')
    const { page = 1, customer_name = '' } = req.query
    const normalizedCustomerName = String(customer_name).trim()
    if (!/^1[3-9]\d{9}$/.test(customer_phone) || normalizedCustomerName.length < 2 || normalizedCustomerName.length > 50) {
      return ApiResponse.badRequest(res, '请输入正确的手机号和下单姓名')
    }

    const normalizedPage = Math.max(1, Number.parseInt(String(page), 10) || 1)
    const normalizedPageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.page_size), 10) || 10))

    const result = await shopPublicService.getOrdersByPhone(customer_phone, {
      page: normalizedPage,
      page_size: normalizedPageSize,
      customer_name: normalizedCustomerName
    })

    res.status(200).json({
      success: true,
      message: '获取订单列表成功',
      data: result.data,
      pagination: {
        page: result.page,
        page_size: result.page_size,
        total: result.total,
        total_pages: result.total_pages,
        has_next: result.has_next,
        has_prev: result.has_prev
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    log.error('获取订单列表失败:', error)
    ApiResponse.serverError(res, '获取订单列表失败', error)
  }
})

/**
 * 修改订单状态
 * PUT /api/public/orders/:id/status
 * 需要管理员权限
 */
router.put('/orders/:id/status', unifiedAuth, requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status) {
      return ApiResponse.badRequest(res, '缺少状态参数')
    }

    // 验证状态值
    const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return ApiResponse.badRequest(res, '无效的状态值')
    }

    const result = await shopPublicService.updateOrderStatus(id, status)

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在')
    }

    ApiResponse.success(res, result, '修改订单状态成功')
  } catch (error) {
    log.error('修改订单状态失败:', error)
    ApiResponse.error(res, error.message || '修改订单状态失败', 500)
  }
})

/**
 * 用户取消订单
 * PUT /api/public/orders/:id/cancel
 * 用户可以取消自己的待支付订单
 */
router.put('/orders/:id/cancel', publicOrderRateLimit, async (req, res) => {
  try {
    const { id } = req.params
    const { reason, access_token: accessToken } = req.body // 可选：取消原因

    // 获取订单信息
    const [orders] = await db.getDatabase().query(
      'SELECT id, order_number, customer_phone, status, expires_at FROM H5_orders WHERE id = ?',
      [id]
    )

    if (orders.length === 0) {
      return ApiResponse.notFound(res, '订单不存在')
    }

    const order = orders[0]

    if (!verifyOrderAccessToken(accessToken, order)) {
      return ApiResponse.unauthorized(res, '订单访问凭证无效或已过期')
    }

    // 检查订单状态：只有待支付订单可以取消
    if (order.status !== 'pending') {
      return ApiResponse.badRequest(res, `订单状态为 ${order.status}，无法取消`)
    }

    // 检查订单是否已过期
    if (order.expires_at && new Date(order.expires_at) < new Date()) {
      return ApiResponse.badRequest(res, '订单已过期，系统将自动取消')
    }

    // 取消订单
    await db.getDatabase().query(
      `UPDATE H5_orders
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancel_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [reason || '用户主动取消', id]
    )

    ApiResponse.success(res, { id, orderNumber: order.order_number }, '订单已取消')
  } catch (error) {
    log.error('取消订单失败:', error)
    ApiResponse.error(res, error.message || '取消订单失败', 500)
  }
})

// ============================================================================
// 用户认证 API
// ============================================================================

/**
 * 用户注册
 * POST /api/public/auth/register
 */
router.post('/auth/register', publicAuthRateLimit, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const phone = String(req.body?.phone || '').trim()
    const password = String(req.body?.password || '')

    // 验证必填字段
    if (name.length < 2 || name.length > 50 || !phone || !password) {
      return ApiResponse.badRequest(res, '请填写完整信息')
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return ApiResponse.badRequest(res, '请输入正确的手机号')
    }

    // 验证密码长度
    if (password.length < 6 || password.length > 128) {
      return ApiResponse.badRequest(res, '密码长度应为6至128位')
    }

    // 检查手机号是否已注册
    const [existingUsers] = await db.getDatabase().query(
      'SELECT id FROM customers WHERE phone = ?',
      [phone]
    )

    if (existingUsers.length > 0) {
      return ApiResponse.error(res, '该手机号已注册', 400)
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 生成会员号
    let memberNumber
    try {
      memberNumber = await generateMemberNumber({ db })
    } catch (error) {
      log.error('生成会员号失败:', error)
      memberNumber = `TF${String(Date.now() % 1000000).padStart(6, '0')}`
    }

    // 创建用户（标记为H5用户）
    const [result] = await db.getDatabase().query(
      `INSERT INTO customers (name, phone, password, member_number, source, status, created_at)
       VALUES (?, ?, ?, ?, 'H5用户', 1, NOW())`,
      [name, phone, hashedPassword, memberNumber]
    )

    // 生成 Token
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天

    await db.getDatabase().query(
      `INSERT INTO customer_tokens (customer_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [result.insertId, token, expiresAt]
    )

    // 返回用户信息和 Token
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, avatar, member_number FROM customers WHERE id = ?',
      [result.insertId]
    )

    ApiResponse.success(res, {
      token,
      user: users[0]
    }, '注册成功')
  } catch (error) {
    log.error('注册失败:', error)
    ApiResponse.error(res, error.message || '注册失败', 500)
  }
})

/**
 * 用户登录
 * POST /api/public/auth/login
 */
router.post('/auth/login', publicAuthRateLimit, async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim()
    const password = String(req.body?.password || '')

    // 验证必填字段
    if (!phone || !password) {
      return ApiResponse.badRequest(res, '请输入手机号和密码')
    }

    if (!/^1[3-9]\d{9}$/.test(phone) || password.length > 128) {
      return ApiResponse.badRequest(res, '手机号或密码格式不正确')
    }

    // 查找用户
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, password FROM customers WHERE phone = ?',
      [phone]
    )

    if (users.length === 0) {
      return ApiResponse.error(res, '用户不存在', 404)
    }

    const user = users[0]

    // 检查是否有密码
    if (!user.password) {
      return ApiResponse.error(res, '该账户未设置密码，请联系管理员重置密码', 403)
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return ApiResponse.error(res, '密码错误', 401)
    }

    // 生成 Token
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天

    await db.getDatabase().query(
      `INSERT INTO customer_tokens (customer_id, token, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token = ?, expires_at = ?`,
      [user.id, token, expiresAt, token, expiresAt]
    )

    // 返回用户信息和 Token
    const [userInfos] = await db.getDatabase().query(
      'SELECT id, name, phone, avatar, member_number FROM customers WHERE id = ?',
      [user.id]
    )

    ApiResponse.success(res, {
      token,
      user: userInfos[0]
    }, '登录成功')
  } catch (error) {
    log.error('登录失败:', error)
    ApiResponse.error(res, error.message || '登录失败', 500)
  }
})

/**
 * 获取当前用户信息
 * GET /api/public/auth/me
 */
router.get('/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录')
    }

    // 验证 Token
    const [tokens] = await db.getDatabase().query(
      `SELECT customer_id, expires_at FROM customer_tokens
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    )

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期')
    }

    const customerId = tokens[0].customer_id

    // 获取用户信息（包含会员号）
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, avatar, member_number FROM customers WHERE id = ?',
      [customerId]
    )

    if (users.length === 0) {
      return ApiResponse.notFound(res, '用户不存在')
    }

    ApiResponse.success(res, users[0], '获取用户信息成功')
  } catch (error) {
    log.error('获取用户信息失败:', error)
    ApiResponse.error(res, error.message || '获取用户信息失败', 500)
  }
})

/**
 * 获取用户订单（通过手机号）
 * GET /api/public/auth/orders
 */
router.get('/auth/orders', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录')
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT ct.customer_id, c.phone FROM customer_tokens ct
       INNER JOIN customers c ON ct.customer_id = c.id
       WHERE ct.token = ? AND ct.expires_at > NOW()`,
      [token]
    )

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期')
    }

    const userPhone = tokens[0].phone

    // 获取订单（H5_orders 表）
    const [orders] = await db.getDatabase().query(
      `SELECT * FROM H5_orders
       WHERE customer_phone = ?
       ORDER BY created_at DESC`,
      [userPhone]
    )

    // 如果没有订单，直接返回空数组
    if (orders.length === 0) {
      return ApiResponse.success(res, [], '获取订单成功')
    }

    // 提取所有订单ID
    const orderIds = orders.map(o => o.id)

    // 批量获取所有订单的商品信息（一次查询，避免 N+1）
    const [allItems] = await db.getDatabase().query(`
      SELECT
        oi.*,
        CASE
          WHEN p.is_new = 1 THEN (
            SELECT image_url FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id AND nt.model_id = p.model_id AND nt.color_id = p.color_id
            ORDER BY ni.is_primary DESC, ni.sort_order ASC
            LIMIT 1
          )
          ELSE (
            SELECT image_url FROM H5_images WHERE phone_id = oi.phone_id AND is_primary = TRUE LIMIT 1
          )
        END as image_url
      FROM H5_order_items oi
      LEFT JOIN phones p ON oi.phone_id = p.id
      WHERE oi.order_id IN (?)
    `, [orderIds])

    // 在内存中按订单ID分组商品
    const itemsByOrder = {}
    allItems.forEach(item => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = []
      }
      itemsByOrder[item.order_id].push(item)
    })

    // 组装订单和商品信息
    const ordersWithItems = orders.map(order => {
      const items = itemsByOrder[order.id] || []

      // 解析 phone_info JSON 并添加到每个商品项
      const processedItems = items.map(item => {
        let phoneInfo = {}
        try {
          phoneInfo = typeof item.phone_info === 'string' ? JSON.parse(item.phone_info) : item.phone_info
        } catch (e) {
          log.error('解析 phone_info 失败:', e)
        }

        // 生成商品名称
        const productName = `${phoneInfo.brand || ''} ${phoneInfo.model || ''} ${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim()

        return {
          ...item,
          phone_info: phoneInfo,
          product_name: productName,
          specs: `${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim()
        }
      })

      return {
        ...order,
        access_token: createOrderAccessToken(order),
        items: processedItems
      }
    })

    ApiResponse.success(res, ordersWithItems, '获取订单成功')
  } catch (error) {
    log.error('获取用户订单失败:', error)
    ApiResponse.error(res, error.message || '获取用户订单失败', 500)
  }
})

/**
 * 获取用户销售记录（通过 customer_id）
 * GET /api/public/auth/sales
 */
router.get('/auth/sales', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录')
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT ct.customer_id, c.id as customer_id, c.phone FROM customer_tokens ct
       INNER JOIN customers c ON ct.customer_id = c.id
       WHERE ct.token = ? AND ct.expires_at > NOW()`,
      [token]
    )

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期')
    }

    const customerId = tokens[0].customer_id

    // 获取销售记录（通过 customer_id 关联）
    // 使用与客户管理页面相同的查询逻辑，确保数据一致性
    const [sales] = await db.getDatabase().query(
      `SELECT
        s.id,
        s.invoice_number,
        COALESCE(s.sale_time, p.sale_time) as sale_time,
        p.sale_price,
        s.payment_method,
        st.name as store_name,
        u.name as operator_name,
        p.imei,
        p.serial_number,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        NULLIF(TRIM(CONCAT_WS(' ', b.name, m.name, c.name)), '') as product_name,
        (p.sale_price - p.purchase_cost) as profit,
        p.is_new
       FROM sales s
       LEFT JOIN stores st ON s.store_id = st.id
       LEFT JOIN users u ON s.operator_id = u.id
       LEFT JOIN phones p ON s.phone_id = p.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN models m ON p.model_id = m.id
       LEFT JOIN colors c ON p.color_id = c.id
       WHERE s.customer_id = ?
       ORDER BY COALESCE(s.sale_time, p.sale_time) DESC
       LIMIT 100`,
      [customerId]
    )

    // 保持缺失值为 null，避免把固定展示值当成真实业务数据返回。
    const formattedSales = sales.map(sale => ({
      id: sale.id,
      invoice_number: sale.invoice_number ?? null,
      sale_time: sale.sale_time ?? null,
      sale_price: sale.sale_price === null || sale.sale_price === undefined ? null : Number(sale.sale_price),
      payment_method: sale.payment_method ?? null,
      store_name: sale.store_name ?? null,
      operator_name: sale.operator_name ?? null,
      imei: sale.imei ?? null,
      serial_number: sale.serial_number ?? null,
      product_name: sale.product_name ?? null,
      brand_name: sale.brand_name ?? null,
      model_name: sale.model_name ?? null,
      color_name: sale.color_name ?? null,
      profit: sale.profit === null || sale.profit === undefined ? null : Number(sale.profit),
      is_new: sale.is_new === null || sale.is_new === undefined ? null : Number(sale.is_new)
    }))

    ApiResponse.success(res, formattedSales, '获取销售记录成功')
  } catch (error) {
    log.error('获取用户销售记录失败:', error)
    ApiResponse.serverError(res, '获取用户销售记录失败', error)
  }
})

/**
 * 获取用户完整资料
 * GET /api/public/auth/profile
 */
router.get('/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录')
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT customer_id FROM customer_tokens
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    )

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期')
    }

    const customerId = tokens[0].customer_id

    // 获取用户完整信息
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, gender, id_card, apple_id, address FROM customers WHERE id = ?',
      [customerId]
    )

    if (users.length === 0) {
      return ApiResponse.notFound(res, '用户不存在')
    }

    ApiResponse.success(res, users[0], '获取用户资料成功')
  } catch (error) {
    log.error('获取用户资料失败:', error)
    ApiResponse.error(res, error.message || '获取用户资料失败', 500)
  }
})

/**
 * 更新用户资料
 * PUT /api/public/auth/profile
 */
router.put('/auth/profile', publicAuthRateLimit, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录')
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT customer_id FROM customer_tokens
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    )

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期')
    }

    const customerId = tokens[0].customer_id
    const { name, gender, idCard, appleId, address } = req.body || {}

    // 构建更新数据
    const _updateData = {}
    const updateFields = []
    const updateValues = []

    if (name !== undefined) {
      const normalizedName = String(name).trim()
      if (normalizedName.length < 2 || normalizedName.length > 50) {
        return ApiResponse.badRequest(res, '姓名长度应为2至50个字符')
      }
      updateFields.push('name = ?')
      updateValues.push(normalizedName)
    }
    if (gender !== undefined) {
      const normalizedGender = String(gender).trim()
      if (normalizedGender && !['male', 'female', 'unknown'].includes(normalizedGender)) {
        return ApiResponse.badRequest(res, '性别参数不正确')
      }
      updateFields.push('gender = ?')
      updateValues.push(normalizedGender || null)
    }
    if (idCard !== undefined) {
      const normalizedIdCard = String(idCard).trim().toUpperCase()
      if (normalizedIdCard && !isValidIdCard(normalizedIdCard)) {
        return ApiResponse.badRequest(res, '身份证号格式不正确')
      }
      updateFields.push('id_card = ?')
      updateValues.push(normalizedIdCard || null)
    }
    if (appleId !== undefined) {
      const normalizedAppleId = String(appleId).trim()
      const validAppleId = !normalizedAppleId
        || /^1[3-9]\d{9}$/.test(normalizedAppleId)
        || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAppleId) && normalizedAppleId.length <= 254)
      if (!validAppleId) return ApiResponse.badRequest(res, 'Apple ID格式不正确')
      updateFields.push('apple_id = ?')
      updateValues.push(normalizedAppleId || null)
    }
    if (address !== undefined) {
      const normalizedAddress = String(address).trim()
      if (normalizedAddress.length > 500) return ApiResponse.badRequest(res, '收货地址不能超过500个字符')
      updateFields.push('address = ?')
      updateValues.push(normalizedAddress || null)
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有要更新的字段')
    }

    updateValues.push(customerId)

    // 执行更新
    await db.getDatabase().query(
      `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    )

    // 获取更新后的用户信息
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, gender, id_card, apple_id, address FROM customers WHERE id = ?',
      [customerId]
    )

    ApiResponse.success(res, users[0], '更新资料成功')
  } catch (error) {
    log.error('更新用户资料失败:', error)
    ApiResponse.error(res, error.message || '更新用户资料失败', 500)
  }
})

/**
 * 用户登出
 * POST /api/public/auth/logout
 */
router.post('/auth/logout', publicAuthRateLimit, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (token) {
      // 删除 Token
      await db.getDatabase().query(
        'DELETE FROM customer_tokens WHERE token = ?',
        [token]
      )
    }

    ApiResponse.success(res, null, '登出成功')
  } catch (error) {
    log.error('登出失败:', error)
    ApiResponse.error(res, error.message || '登出失败', 500)
  }
})

/**
 * 获取首页推荐区域
 * GET /api/public/home/sections
 */
router.get('/home/sections', async (req, res) => {
  try {
    const homeSectionService = require('../services/home-section.service')
    const sections = await homeSectionService.getActiveSections()
    ApiResponse.success(res, sections, '获取推荐区域成功')
  } catch (error) {
    log.error('获取推荐区域失败:', error)
    const isMissingHomeSectionTable = (
      error?.code === 'ER_NO_SUCH_TABLE' ||
      /H5_home_sections|H5_home_section_products/i.test(String(error?.message || ''))
    )

    if (isMissingHomeSectionTable) {
      log.warn('推荐区域相关数据表不存在，降级返回空列表')
      return ApiResponse.success(res, [], '推荐区域未初始化')
    }

    ApiResponse.error(res, error.message || '获取推荐区域失败', 500)
  }
})

module.exports = router
