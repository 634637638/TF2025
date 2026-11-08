/**
 * H5商城公开API路由 - 用户端（无需认证）
 * 功能：商品展示、购物车、下单、订单查询、用户认证
 */

const express = require('express')
const router = express.Router()
const ShopPublicService = require('../services/shop-public.service')
const ShopPublicCatalogController = require('../controllers/shop-public-catalog.controller')
const ShopPublicAuthController = require('../controllers/shop-public-auth.controller')
const ShopPublicMarketingController = require('../controllers/shop-public-marketing.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const {
  publicAuthRateLimit,
  publicOrderRateLimit,
  publicLookupRateLimit,
  publicOrderPhoneLookupRateLimit,
  publicMarketingRateLimit
} = require('../middleware/rate-limit')

const shopPublicService = new ShopPublicService()
const shopPublicCatalogController = new ShopPublicCatalogController({ service: shopPublicService })
const shopPublicAuthController = new ShopPublicAuthController({ service: shopPublicService })
const shopPublicMarketingController = new ShopPublicMarketingController({ service: shopPublicService })

// ============================================================================
// 商城配置公开 API
// ============================================================================

/**
 * 获取商城公开配置
 * GET /api/public/shop/config
 * 说明：只返回用户端需要的配置信息
 */
router.get('/shop/config', shopPublicCatalogController.getConfig.bind(shopPublicCatalogController))

/**
 * 获取启用的轮播图
 * GET /api/public/shop/banners
 */
router.get('/shop/banners', shopPublicCatalogController.getBanners.bind(shopPublicCatalogController))

// ============================================================================
// 商品展示 API
// ============================================================================

/**
 * 获取商品列表
 * GET /api/public/products
 * 参数：page, page_size, brand_id, model_id, is_new, search, sort
 */
router.get('/products', shopPublicCatalogController.getProducts.bind(shopPublicCatalogController))

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
router.get('/products/aggregate', shopPublicCatalogController.getAggregatedProducts.bind(shopPublicCatalogController))

/**
 * 获取聚合商品的库存分布
 * GET /api/public/products/stock/distribution
 * 参数：brand_id, model_id, color_id, memory_id, is_new
 * 说明：返回指定规格组合在各店铺的库存分布
 */
router.get('/products/stock/distribution', shopPublicCatalogController.getProductStockDistribution.bind(shopPublicCatalogController))

// ============================================================================
// 单个商品详情 API
// ============================================================================

/**
 * 获取商品详情
 * GET /api/public/products/:id
 */
router.get('/products/:id', shopPublicCatalogController.getProductDetail.bind(shopPublicCatalogController))

/**
 * 获取商品图片
 * GET /api/public/products/:id/images
 */
router.get('/products/:id/images', shopPublicCatalogController.getProductImages.bind(shopPublicCatalogController))

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
router.get('/products/search/:keyword', shopPublicCatalogController.searchProducts.bind(shopPublicCatalogController))

/**
 * 获取模板下的商品列表
 * GET /api/public/templates/:id/phones
 */
router.get('/templates/:id/phones', shopPublicCatalogController.getTemplatePhones.bind(shopPublicCatalogController))

// ============================================================================
// 分类数据 API
// ============================================================================

/**
 * 获取品牌列表
 * GET /api/public/brands
 * 参数：include_empty (可选，是否包含没有商品的品牌)
 */
router.get('/brands', shopPublicCatalogController.getBrands.bind(shopPublicCatalogController))

/**
 * 获取型号列表
 * GET /api/public/models
 * 参数：brand_id (可选，筛选指定品牌的型号)
 *       include_empty (可选，是否包含没有商品的型号)
 */
router.get('/models', shopPublicCatalogController.getModels.bind(shopPublicCatalogController))

/**
 * 获取颜色列表
 * GET /api/public/colors
 * 参数：include_empty (可选，是否包含没有商品的颜色)
 */
router.get('/colors', shopPublicCatalogController.getColors.bind(shopPublicCatalogController))

/**
 * 获取内存列表
 * GET /api/public/memories
 */
router.get('/memories', shopPublicCatalogController.getMemories.bind(shopPublicCatalogController))

/**
 * 获取营销文案词库
 * GET /api/public/marketing/lexicon
 * 只返回数据库中保存的词库；未配置时返回空词库，不注入内置文案。
 */
router.get('/marketing/lexicon', shopPublicMarketingController.getLexicon.bind(shopPublicMarketingController))

/**
 * 在线营销文案生成（可选）
 * POST /api/public/marketing/generate
 *
 * 在线接口由后台配置保存，前端只提交生成上下文，不接触密钥。
 * 未启用或接口不可用时返回空结果，由前端继续使用本地生成。
 */
router.post('/marketing/generate', publicMarketingRateLimit, shopPublicMarketingController.generate.bind(shopPublicMarketingController))

// ============================================================================
// 购物车 API
// ============================================================================

/**
 * 获取购物车
 * GET /api/public/cart/:cartId
 */
router.get('/cart/:cartId', publicLookupRateLimit, shopPublicCatalogController.getCart.bind(shopPublicCatalogController))

/**
 * 添加商品到购物车
 * POST /api/public/cart/add
 * body: { cartId, phoneId, quantity }
 */
router.post('/cart/add', publicOrderRateLimit, shopPublicCatalogController.addToCart.bind(shopPublicCatalogController))

/**
 * 更新购物车商品数量
 * PUT /api/public/cart/:id
 * body: { quantity }
 */
router.put('/cart/:id', publicOrderRateLimit, shopPublicCatalogController.updateCartItem.bind(shopPublicCatalogController))

/**
 * 删除购物车商品
 * DELETE /api/public/cart/:id
 */
router.delete('/cart/:id', publicOrderRateLimit, shopPublicCatalogController.removeCartItem.bind(shopPublicCatalogController))

/**
 * 清空购物车
 * DELETE /api/public/cart/:cartId/clear
 */
router.delete('/cart/:cartId/clear', publicOrderRateLimit, shopPublicCatalogController.clearCart.bind(shopPublicCatalogController))

// ============================================================================
// 订单 API
// ============================================================================

/**
 * 创建订单
 * POST /api/public/orders/create
 * body: { customerName, customerPhone, customerAddress, items, paymentMethod, remarks }
 * items: [{ phoneId, quantity }, ...]
 */
router.post('/orders/create', publicOrderRateLimit, shopPublicCatalogController.createOrder.bind(shopPublicCatalogController))

/**
 * 用户确认支付（用户端）
 * POST /api/public/orders/:orderNumber/confirm-payment
 */
router.post('/orders/:orderNumber/confirm-payment', publicOrderRateLimit, shopPublicCatalogController.confirmOrderPayment.bind(shopPublicCatalogController))

/**
 * 根据订单号查询订单
 * GET /api/public/orders/:orderNumber
 */
router.get('/orders/:orderNumber', publicLookupRateLimit, shopPublicCatalogController.getOrderByNumber.bind(shopPublicCatalogController))

/**
 * 根据手机号查询订单列表
 * GET /api/public/orders/phone/:phone
 */
router.get('/orders/phone/:customer_phone', publicLookupRateLimit, publicOrderPhoneLookupRateLimit, shopPublicCatalogController.getOrdersByPhone.bind(shopPublicCatalogController))

/**
 * 修改订单状态
 * PUT /api/public/orders/:id/status
 * 需要管理员权限
 */
router.put('/orders/:id/status', unifiedAuth, requirePermission('permissions:admin'), shopPublicCatalogController.updateOrderStatus.bind(shopPublicCatalogController))

/**
 * 用户取消订单
 * PUT /api/public/orders/:id/cancel
 * 用户可以取消自己的待支付订单
 */
router.put('/orders/:id/cancel', publicOrderRateLimit, shopPublicCatalogController.cancelCustomerOrder.bind(shopPublicCatalogController))

// ============================================================================
// 用户认证 API
// ============================================================================

/**
 * 用户注册
 * POST /api/public/auth/register
 */
router.post('/auth/register', publicAuthRateLimit, shopPublicAuthController.register.bind(shopPublicAuthController))

/**
 * 用户登录
 * POST /api/public/auth/login
 */
router.post('/auth/login', publicAuthRateLimit, shopPublicAuthController.login.bind(shopPublicAuthController))

/**
 * 获取当前用户信息
 * GET /api/public/auth/me
 */
router.get('/auth/me', shopPublicAuthController.getMe.bind(shopPublicAuthController))

/**
 * 获取用户订单（通过手机号）
 * GET /api/public/auth/orders
 */
router.get('/auth/orders', shopPublicAuthController.getOrders.bind(shopPublicAuthController))

/**
 * 获取用户销售记录（通过 customer_id）
 * GET /api/public/auth/sales
 */
router.get('/auth/sales', shopPublicAuthController.getSales.bind(shopPublicAuthController))

/**
 * 获取用户完整资料
 * GET /api/public/auth/profile
 */
router.get('/auth/profile', shopPublicAuthController.getProfile.bind(shopPublicAuthController))

/**
 * 更新用户资料
 * PUT /api/public/auth/profile
 */
router.put('/auth/profile', publicAuthRateLimit, shopPublicAuthController.updateProfile.bind(shopPublicAuthController))

/**
 * 用户登出
 * POST /api/public/auth/logout
 */
router.post('/auth/logout', publicAuthRateLimit, shopPublicAuthController.logout.bind(shopPublicAuthController))

/**
 * 获取首页推荐区域
 * GET /api/public/home/sections
 */
router.get('/home/sections', shopPublicCatalogController.getHomeSections.bind(shopPublicCatalogController))

module.exports = router
