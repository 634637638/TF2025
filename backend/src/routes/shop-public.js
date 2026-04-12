/**
 * H5商城公开API路由 - 用户端（无需认证）
 * 功能：商品展示、购物车、下单、订单查询、用户认证
 */

const express = require('express');
const router = express.Router();
const ApiResponse = require('../utils/response');
const ShopPublicService = require('../services/shop-public.service');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { generateMemberNumber } = require('../utils/member-number');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

const shopPublicService = new ShopPublicService();

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
    const config = await shopPublicService.getPublicConfig();
    ApiResponse.success(res, config, '获取配置成功');
  } catch (error) {
    log.error('获取商城配置失败:', error);
    ApiResponse.error(res, error.message || '获取配置失败', 500);
  }
});

/**
 * 获取启用的轮播图
 * GET /api/public/shop/banners
 */
router.get('/shop/banners', async (req, res) => {
  try {
    const banners = await shopPublicService.getActiveBanners();
    ApiResponse.success(res, banners, '获取轮播图成功');
  } catch (error) {
    log.error('获取轮播图失败:', error);
    ApiResponse.error(res, error.message || '获取轮播图失败', 500);
  }
});

// ============================================================================
// 商品展示 API
// ============================================================================

/**
 * 获取商品列表
 * GET /api/public/products
 * 参数：page, limit, brand_id, model_id, is_new, search, sort
 */
router.get('/products', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new,
      search,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    // 调试日志
    log.debug('[API /public/products] 请求参数:', {
      page,
      limit,
      brand_id,
      model_id,
      is_new,
      is_new_type: typeof is_new,
      sort,
      order
    });

    const parsed_is_new = is_new !== undefined ? (is_new === 'true' || is_new === true || is_new === '1' || is_new === 1) : null;
    log.debug('[API /public/products] 解析后的 is_new:', parsed_is_new, typeof parsed_is_new);

    const result = await shopPublicService.getProducts({
      page: parseInt(page),
      limit: parseInt(limit),
      brand_id: brand_id ? parseInt(brand_id) : null,
      model_id: model_id ? parseInt(model_id) : null,
      color_id: color_id ? parseInt(color_id) : null,
      memory_id: memory_id ? parseInt(memory_id) : null,
      is_new: parsed_is_new,
      search,
      sort,
      order
    });

    log.debug('[API /public/products] 查询结果:', {
      total: result.total,
      count: result.data?.length || 0,
      page: result.page
    });

    ApiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total
    }, '获取商品列表成功');
  } catch (error) {
    log.error('[API /public/products] 获取商品列表失败:', error);
    ApiResponse.error(res, error.message || '获取商品列表失败', 500);
  }
});

// ============================================================================
// 聚合商品 API（按品牌+型号+颜色聚合）
// 注意：这些路由必须在 /products/:id 之前定义
// ============================================================================

/**
 * 获取聚合商品列表
 * GET /api/public/products/aggregate
 * 参数：page, limit, brand_id, model_id, is_new, color_id
 * 说明：返回按品牌+型号+颜色聚合的商品，每个商品包含可选的内存规格
 */
router.get('/products/aggregate', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      brand_id,
      model_id,
      is_new,
      color_id,
      search
    } = req.query;

    log.debug('[API /public/products/aggregate] 请求参数:', {
      page,
      limit,
      brand_id,
      model_id,
      is_new,
      color_id,
      search
    });

    const parsed_is_new = is_new !== undefined ? (is_new === 'true' || is_new === true || is_new === '1' || is_new === 1) : null;

    const result = await shopPublicService.getAggregatedProducts({
      page: parseInt(page),
      limit: parseInt(limit),
      brand_id: brand_id !== undefined ? parseInt(brand_id) : null,
      model_id: model_id !== undefined ? parseInt(model_id) : null,
      color_id: color_id !== undefined ? parseInt(color_id) : null,
      is_new: parsed_is_new,
      search
    });

    log.debug('[API /public/products/aggregate] 查询结果:', {
      total: result.total,
      count: result.data?.length || 0,
      page: result.page
    });

    ApiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total
    }, '获取聚合商品列表成功');
  } catch (error) {
    log.error('[API /public/products/aggregate] 获取聚合商品列表失败:', error);
    ApiResponse.error(res, error.message || '获取聚合商品列表失败', 500);
  }
});

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
    } = req.query;

    if (!brand_id || !model_id || !color_id || !memory_id || is_new === undefined) {
      return ApiResponse.badRequest(res, '缺少必要参数');
    }

    log.debug('[API /public/products/stock/distribution] 请求参数:', {
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new
    });

    const result = await shopPublicService.getProductStockDistribution(
      parseInt(brand_id),
      parseInt(model_id),
      parseInt(color_id),
      parseInt(memory_id),
      is_new === 'true' || is_new === true
    );

    ApiResponse.success(res, result, '获取库存分布成功');
  } catch (error) {
    log.error('[API /public/products/stock/distribution] 获取库存分布失败:', error);
    ApiResponse.error(res, error.message || '获取库存分布失败', 500);
  }
});

// ============================================================================
// 单个商品详情 API
// ============================================================================

/**
 * 获取商品详情
 * GET /api/public/products/:id
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await shopPublicService.getProductDetail(id);

    if (!product) {
      return ApiResponse.notFound(res, '商品不存在');
    }

    ApiResponse.success(res, product, '获取商品详情成功');
  } catch (error) {
    log.error('获取商品详情失败:', error);
    ApiResponse.error(res, error.message || '获取商品详情失败', 500);
  }
});

/**
 * 获取商品图片
 * GET /api/public/products/:id/images
 */
router.get('/products/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const images = await shopPublicService.getProductImages(id);
    ApiResponse.success(res, images, '获取商品图片成功');
  } catch (error) {
    log.error('[API /public/products/:id/images] 获取商品图片失败:', error);
    ApiResponse.error(res, error.message || '获取商品图片失败', 500);
  }
});

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
    const { keyword } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await shopPublicService.searchProducts(keyword, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    ApiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total
    }, '搜索成功');
  } catch (error) {
    log.error('搜索商品失败:', error);
    ApiResponse.error(res, error.message || '搜索商品失败', 500);
  }
});

/**
 * 获取模板下的商品列表
 * GET /api/public/templates/:id/phones
 */
router.get('/templates/:id/phones', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await shopPublicService.getTemplatePhones(id);

    if (!result) {
      return ApiResponse.notFound(res, '模板不存在');
    }

    ApiResponse.success(res, result.phones, '获取商品列表成功');
  } catch (error) {
    log.error('获取模板商品失败:', error);
    ApiResponse.error(res, error.message || '获取模板商品失败', 500);
  }
});

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
    const { include_empty } = req.query;
    const brands = await shopPublicService.getBrands(include_empty === 'true');
    ApiResponse.success(res, brands, '获取品牌列表成功');
  } catch (error) {
    log.error('获取品牌列表失败:', error);
    ApiResponse.error(res, error.message || '获取品牌列表失败', 500);
  }
});

/**
 * 获取型号列表
 * GET /api/public/models
 * 参数：brand_id (可选，筛选指定品牌的型号)
 *       include_empty (可选，是否包含没有商品的型号)
 */
router.get('/models', async (req, res) => {
  try {
    const { brand_id, include_empty } = req.query;
    const models = await shopPublicService.getModels(
      brand_id ? parseInt(brand_id) : null,
      include_empty === 'true'
    );
    ApiResponse.success(res, models, '获取型号列表成功');
  } catch (error) {
    log.error('获取型号列表失败:', error);
    ApiResponse.error(res, error.message || '获取型号列表失败', 500);
  }
});

/**
 * 获取颜色列表
 * GET /api/public/colors
 * 参数：include_empty (可选，是否包含没有商品的颜色)
 */
router.get('/colors', async (req, res) => {
  try {
    const { include_empty } = req.query;
    const colors = await shopPublicService.getColors(include_empty === 'true');
    ApiResponse.success(res, colors, '获取颜色列表成功');
  } catch (error) {
    log.error('获取颜色列表失败:', error);
    ApiResponse.error(res, error.message || '获取颜色列表失败', 500);
  }
});

/**
 * 获取内存列表
 * GET /api/public/memories
 */
router.get('/memories', async (req, res) => {
  try {
    const memories = await shopPublicService.getMemories();
    ApiResponse.success(res, memories, '获取内存列表成功');
  } catch (error) {
    log.error('获取内存列表失败:', error);
    ApiResponse.error(res, error.message || '获取内存列表失败', 500);
  }
});

// ============================================================================
// 购物车 API
// ============================================================================

/**
 * 获取购物车
 * GET /api/public/cart/:cartId
 */
router.get('/cart/:cartId', async (req, res) => {
  try {
    const { cartId } = req.params;
    const cart = await shopPublicService.getCart(cartId);
    ApiResponse.success(res, cart, '获取购物车成功');
  } catch (error) {
    log.error('获取购物车失败:', error);
    ApiResponse.error(res, error.message || '获取购物车失败', 500);
  }
});

/**
 * 添加商品到购物车
 * POST /api/public/cart/add
 * body: { cartId, phoneId, quantity }
 */
router.post('/cart/add', async (req, res) => {
  try {
    const { cartId, phoneId, quantity = 1 } = req.body;

    if (!cartId || !phoneId) {
      return ApiResponse.badRequest(res, '缺少必要参数');
    }

    await shopPublicService.addToCart(cartId, phoneId, quantity);
    ApiResponse.success(res, null, '添加到购物车成功');
  } catch (error) {
    log.error('添加到购物车失败:', error);
    ApiResponse.error(res, error.message || '添加到购物车失败', 500);
  }
});

/**
 * 更新购物车商品数量
 * PUT /api/public/cart/:id
 * body: { quantity }
 */
router.put('/cart/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      return ApiResponse.badRequest(res, '数量必须大于0');
    }

    await shopPublicService.updateCartItem(id, quantity);
    ApiResponse.success(res, null, '更新购物车成功');
  } catch (error) {
    log.error('更新购物车失败:', error);
    ApiResponse.error(res, error.message || '更新购物车失败', 500);
  }
});

/**
 * 删除购物车商品
 * DELETE /api/public/cart/:id
 */
router.delete('/cart/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await shopPublicService.removeFromCart(id);
    ApiResponse.success(res, null, '删除成功');
  } catch (error) {
    log.error('删除购物车商品失败:', error);
    ApiResponse.error(res, error.message || '删除失败', 500);
  }
});

/**
 * 清空购物车
 * DELETE /api/public/cart/:cartId/clear
 */
router.delete('/cart/:cartId/clear', async (req, res) => {
  try {
    const { cartId } = req.params;
    await shopPublicService.clearCart(cartId);
    ApiResponse.success(res, null, '清空购物车成功');
  } catch (error) {
    log.error('清空购物车失败:', error);
    ApiResponse.error(res, error.message || '清空购物车失败', 500);
  }
});

// ============================================================================
// 订单 API
// ============================================================================

/**
 * 创建订单
 * POST /api/public/orders/create
 * body: { customerName, customerPhone, customerAddress, items, paymentMethod, remarks }
 * items: [{ phoneId, quantity }, ...]
 */
router.post('/orders/create', async (req, res) => {
  try {
    const orderData = req.body;

    // 验证必要参数
    if (!orderData.customerName || !orderData.customerPhone) {
      return ApiResponse.badRequest(res, '请填写联系人信息');
    }

    if (!orderData.items || orderData.items.length === 0) {
      return ApiResponse.badRequest(res, '请选择商品');
    }

    const order = await shopPublicService.createOrder(orderData);
    ApiResponse.created(res, '下单成功', order);
  } catch (error) {
    log.error('创建订单失败:', error);
    ApiResponse.error(res, error.message || '创建订单失败', 500);
  }
});

/**
 * 用户确认支付（用户端）
 * POST /api/public/orders/:orderNumber/confirm-payment
 */
router.post('/orders/:orderNumber/confirm-payment', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const result = await shopPublicService.confirmUserPayment(orderNumber);

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, result, '支付确认成功，订单状态已更新');
  } catch (error) {
    log.error('确认支付失败:', error);
    ApiResponse.error(res, error.message || '确认支付失败', 500);
  }
});

/**
 * 根据订单号查询订单
 * GET /api/public/orders/:orderNumber
 */
router.get('/orders/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await shopPublicService.getOrderByNumber(orderNumber);

    if (!order) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, order, '获取订单成功');
  } catch (error) {
    log.error('获取订单失败:', error);
    ApiResponse.error(res, error.message || '获取订单失败', 500);
  }
});

/**
 * 根据手机号查询订单列表
 * GET /api/public/orders/phone/:phone
 */
router.get('/orders/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await shopPublicService.getOrdersByPhone(phone, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    ApiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total
    }, '获取订单列表成功');
  } catch (error) {
    log.error('获取订单列表失败:', error);
    ApiResponse.error(res, error.message || '获取订单列表失败', 500);
  }
});

/**
 * 修改订单状态
 * PUT /api/public/orders/:id/status
 * 需要管理员权限
 */
router.put('/orders/:id/status', unifiedAuth, requirePermission('permissions:admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return ApiResponse.badRequest(res, '缺少状态参数');
    }

    // 验证状态值
    const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return ApiResponse.badRequest(res, '无效的状态值');
    }

    const result = await shopPublicService.updateOrderStatus(id, status);

    if (!result) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    ApiResponse.success(res, result, '修改订单状态成功');
  } catch (error) {
    log.error('修改订单状态失败:', error);
    ApiResponse.error(res, error.message || '修改订单状态失败', 500);
  }
});

/**
 * 用户取消订单
 * PUT /api/public/orders/:id/cancel
 * 用户可以取消自己的待支付订单
 */
router.put('/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // 可选：取消原因

    // 获取订单信息
    const [orders] = await db.getDatabase().query(
      'SELECT id, order_number, customer_phone, status, expires_at FROM H5_orders WHERE id = ?',
      [id]
    );

    if (orders.length === 0) {
      return ApiResponse.notFound(res, '订单不存在');
    }

    const order = orders[0];

    // 检查订单状态：只有待支付订单可以取消
    if (order.status !== 'pending') {
      return ApiResponse.badRequest(res, `订单状态为 ${order.status}，无法取消`);
    }

    // 检查订单是否已过期
    if (order.expires_at && new Date(order.expires_at) < new Date()) {
      return ApiResponse.badRequest(res, '订单已过期，系统将自动取消');
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
    );

    ApiResponse.success(res, { id, orderNumber: order.order_number }, '订单已取消');
  } catch (error) {
    log.error('取消订单失败:', error);
    ApiResponse.error(res, error.message || '取消订单失败', 500);
  }
});

// ============================================================================
// 用户认证 API
// ============================================================================

/**
 * 用户注册
 * POST /api/public/auth/register
 */
router.post('/auth/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    // 验证必填字段
    if (!name || !phone || !password) {
      return ApiResponse.badRequest(res, '请填写完整信息');
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return ApiResponse.badRequest(res, '请输入正确的手机号');
    }

    // 验证密码长度
    if (password.length < 6) {
      return ApiResponse.badRequest(res, '密码至少6位');
    }

    // 检查手机号是否已注册
    const [existingUsers] = await db.getDatabase().query(
      'SELECT id FROM customers WHERE phone = ?',
      [phone]
    );

    if (existingUsers.length > 0) {
      return ApiResponse.error(res, '该手机号已注册', 400);
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 生成会员号
    let memberNumber;
    try {
      memberNumber = await generateMemberNumber({ db });
    } catch (error) {
      log.error('生成会员号失败:', error);
      memberNumber = `TF${String(Date.now() % 1000000).padStart(6, '0')}`;
    }

    // 创建用户（标记为H5用户）
    const [result] = await db.getDatabase().query(
      `INSERT INTO customers (name, phone, password, member_number, source, status, created_at)
       VALUES (?, ?, ?, ?, 'H5用户', 1, NOW())`,
      [name, phone, hashedPassword, memberNumber]
    );

    // 生成 Token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

    await db.getDatabase().query(
      `INSERT INTO customer_tokens (customer_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [result.insertId, token, expiresAt]
    );

    // 返回用户信息和 Token
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, avatar, member_number FROM customers WHERE id = ?',
      [result.insertId]
    );

    ApiResponse.success(res, {
      token,
      user: users[0]
    }, '注册成功');
  } catch (error) {
    log.error('注册失败:', error);
    ApiResponse.error(res, error.message || '注册失败', 500);
  }
});

/**
 * 用户登录
 * POST /api/public/auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    // 验证必填字段
    if (!phone || !password) {
      return ApiResponse.badRequest(res, '请输入手机号和密码');
    }

    // 查找用户
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, password FROM customers WHERE phone = ?',
      [phone]
    );

    if (users.length === 0) {
      return ApiResponse.error(res, '用户不存在', 404);
    }

    const user = users[0];

    // 检查是否有密码
    if (!user.password) {
      return ApiResponse.error(res, '该账户未设置密码，请联系管理员重置密码', 403);
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return ApiResponse.error(res, '密码错误', 401);
    }

    // 生成 Token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

    await db.getDatabase().query(
      `INSERT INTO customer_tokens (customer_id, token, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token = ?, expires_at = ?`,
      [user.id, token, expiresAt, token, expiresAt]
    );

    // 返回用户信息和 Token
    const [userInfos] = await db.getDatabase().query(
      'SELECT id, name, phone, avatar, member_number FROM customers WHERE id = ?',
      [user.id]
    );

    ApiResponse.success(res, {
      token,
      user: userInfos[0]
    }, '登录成功');
  } catch (error) {
    log.error('登录失败:', error);
    ApiResponse.error(res, error.message || '登录失败', 500);
  }
});

/**
 * 获取当前用户信息
 * GET /api/public/auth/me
 */
router.get('/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录');
    }

    // 验证 Token
    const [tokens] = await db.getDatabase().query(
      `SELECT customer_id, expires_at FROM customer_tokens
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期');
    }

    const customerId = tokens[0].customer_id;

    // 获取用户信息（包含会员号）
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, avatar, member_number FROM customers WHERE id = ?',
      [customerId]
    );

    if (users.length === 0) {
      return ApiResponse.notFound(res, '用户不存在');
    }

    ApiResponse.success(res, users[0], '获取用户信息成功');
  } catch (error) {
    log.error('获取用户信息失败:', error);
    ApiResponse.error(res, error.message || '获取用户信息失败', 500);
  }
});

/**
 * 获取用户订单（通过手机号）
 * GET /api/public/auth/orders
 */
router.get('/auth/orders', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录');
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT ct.customer_id, c.phone FROM customer_tokens ct
       INNER JOIN customers c ON ct.customer_id = c.id
       WHERE ct.token = ? AND ct.expires_at > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期');
    }

    const userPhone = tokens[0].phone;

    // 获取订单（H5_orders 表）
    const [orders] = await db.getDatabase().query(
      `SELECT * FROM H5_orders
       WHERE customer_phone = ?
       ORDER BY created_at DESC`,
      [userPhone]
    );

    // 如果没有订单，直接返回空数组
    if (orders.length === 0) {
      return ApiResponse.success(res, [], '获取订单成功');
    }

    // 提取所有订单ID
    const orderIds = orders.map(o => o.id);

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
    `, [orderIds]);

    // 在内存中按订单ID分组商品
    const itemsByOrder = {};
    allItems.forEach(item => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push(item);
    });

    // 组装订单和商品信息
    const ordersWithItems = orders.map(order => {
      const items = itemsByOrder[order.id] || [];

      // 解析 phone_info JSON 并添加到每个商品项
      const processedItems = items.map(item => {
        let phoneInfo = {};
        try {
          phoneInfo = typeof item.phone_info === 'string' ? JSON.parse(item.phone_info) : item.phone_info;
        } catch (e) {
          log.error('解析 phone_info 失败:', e);
        }

        // 生成商品名称
        const productName = `${phoneInfo.brand || ''} ${phoneInfo.model || ''} ${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim();

        return {
          ...item,
          phone_info: phoneInfo,
          product_name: productName,
          specs: `${phoneInfo.color || ''} ${phoneInfo.memory || ''}`.trim()
        };
      });

      return {
        ...order,
        items: processedItems
      };
    });

    ApiResponse.success(res, ordersWithItems, '获取订单成功');
  } catch (error) {
    log.error('获取用户订单失败:', error);
    ApiResponse.error(res, error.message || '获取用户订单失败', 500);
  }
});

/**
 * 获取用户销售记录（通过 customer_id）
 * GET /api/public/auth/sales
 */
router.get('/auth/sales', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录');
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT ct.customer_id, c.id as customer_id, c.phone FROM customer_tokens ct
       INNER JOIN customers c ON ct.customer_id = c.id
       WHERE ct.token = ? AND ct.expires_at > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期');
    }

    const customerId = tokens[0].customer_id;

    // 获取销售记录（通过 customer_id 关联）
    // 使用与客户管理页面相同的查询逻辑，确保数据一致性
    const [sales] = await db.getDatabase().query(
      `SELECT
        s.id,
        s.invoice_number,
        COALESCE(s.sale_date, p.salestime) as sale_date,
        p.sale_price,
        p.purchase_cost,
        s.payment_method,
        s.operator_id,
        s.customer_id,
        s.remarks,
        st.name as store_name,
        u.name as operator_name,
        p.imei,
        p.serial_number,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        CONCAT(b.name, ' ', m.name, ' ', c.name) as product_name,
        (p.sale_price - COALESCE(p.purchase_cost, 0)) as profit,
        CASE WHEN p.is_new = 1 THEN '全新' ELSE '二手' END as is_new
       FROM sales s
       LEFT JOIN stores st ON s.store_id = st.id
       LEFT JOIN users u ON s.operator_id = u.id
       LEFT JOIN phones p ON s.phone_id = p.id
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN models m ON p.model_id = m.id
       LEFT JOIN colors c ON p.color_id = c.id
       WHERE s.customer_id = ?
       ORDER BY COALESCE(s.sale_date, p.salestime) DESC
       LIMIT 100`,
      [customerId]
    );

    // 格式化数据，确保所有字段都有默认值
    const formattedSales = sales.map(sale => ({
      id: sale.id,
      invoice_number: sale.invoice_number || null,
      sale_date: sale.sale_date,
      sale_price: parseFloat(sale.sale_price) || 0,
      payment_method: sale.payment_method || '未设置',
      store_name: sale.store_name || '未知店铺',
      operator_name: sale.operator_name || '未知操作员',
      imei: sale.imei || null,
      serial_number: sale.serial_number || null,
      product_name: sale.product_name || '未知商品',
      brand_name: sale.brand_name || '',
      model_name: sale.model_name || '',
      color_name: sale.color_name || '',
      profit: parseFloat(sale.profit) || 0,
      is_new: sale.is_new || '二手'
    }));

    ApiResponse.success(res, formattedSales, '获取销售记录成功');
  } catch (error) {
    log.error('获取用户销售记录失败:', error);
    ApiResponse.error(res, error.message || '获取用户销售记录失败', 500);
  }
});

/**
 * 获取用户完整资料
 * GET /api/public/auth/profile
 */
router.get('/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录');
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT customer_id FROM customer_tokens
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期');
    }

    const customerId = tokens[0].customer_id;

    // 获取用户完整信息
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, gender, id_card, apple_id, address FROM customers WHERE id = ?',
      [customerId]
    );

    if (users.length === 0) {
      return ApiResponse.notFound(res, '用户不存在');
    }

    ApiResponse.success(res, users[0], '获取用户资料成功');
  } catch (error) {
    log.error('获取用户资料失败:', error);
    ApiResponse.error(res, error.message || '获取用户资料失败', 500);
  }
});

/**
 * 更新用户资料
 * PUT /api/public/auth/profile
 */
router.put('/auth/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return ApiResponse.unauthorized(res, '请先登录');
    }

    // 验证 Token 并获取用户信息
    const [tokens] = await db.getDatabase().query(
      `SELECT customer_id FROM customer_tokens
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (tokens.length === 0) {
      return ApiResponse.unauthorized(res, 'Token无效或已过期');
    }

    const customerId = tokens[0].customer_id;
    const { name, gender, idCard, appleId, address } = req.body;

    // 构建更新数据
    const updateData = {};
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (gender !== undefined) {
      updateFields.push('gender = ?');
      updateValues.push(gender);
    }
    if (idCard !== undefined) {
      updateFields.push('id_card = ?');
      updateValues.push(idCard);
    }
    if (appleId !== undefined) {
      updateFields.push('apple_id = ?');
      updateValues.push(appleId);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有要更新的字段');
    }

    updateValues.push(customerId);

    // 执行更新
    await db.getDatabase().query(
      `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // 获取更新后的用户信息
    const [users] = await db.getDatabase().query(
      'SELECT id, name, phone, gender, id_card, apple_id, address FROM customers WHERE id = ?',
      [customerId]
    );

    ApiResponse.success(res, users[0], '更新资料成功');
  } catch (error) {
    log.error('更新用户资料失败:', error);
    ApiResponse.error(res, error.message || '更新用户资料失败', 500);
  }
});

/**
 * 用户登出
 * POST /api/public/auth/logout
 */
router.post('/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      // 删除 Token
      await db.getDatabase().query(
        'DELETE FROM customer_tokens WHERE token = ?',
        [token]
      );
    }

    ApiResponse.success(res, null, '登出成功');
  } catch (error) {
    log.error('登出失败:', error);
    ApiResponse.error(res, error.message || '登出失败', 500);
  }
});

/**
 * 获取首页推荐区域
 * GET /api/public/home/sections
 */
router.get('/home/sections', async (req, res) => {
  try {
    const homeSectionService = require('../services/home-section.service');
    const sections = await homeSectionService.getActiveSections();
    ApiResponse.success(res, sections, '获取推荐区域成功');
  } catch (error) {
    log.error('获取推荐区域失败:', error);
    ApiResponse.error(res, error.message || '获取推荐区域失败', 500);
  }
});

module.exports = router;
