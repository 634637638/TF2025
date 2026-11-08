'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { normalizeCartId } = require('../utils/shop-cart')
const { createOrderAccessToken, verifyOrderAccessToken } = require('../utils/order-access')
const ShopPublicService = require('../services/shop-public.service')
const homeSectionService = require('../services/home-section.service')

const normalizePublicPagination = query => ({
  page: Math.max(1, Number.parseInt(String(query?.page ?? 1), 10) || 1),
  page_size: Math.min(100, Math.max(1, Number.parseInt(String(query?.page_size ?? 20), 10) || 20))
})

class ShopPublicCatalogController {
  constructor({
    service = new ShopPublicService(),
    homeSections = homeSectionService,
    response = ApiResponse,
    logger = log,
    verifyOrderToken = verifyOrderAccessToken,
    createOrderToken = createOrderAccessToken
  } = {}) {
    this.service = service
    this.homeSections = homeSections
    this.response = response
    this.logger = logger
    this.verifyOrderToken = verifyOrderToken
    this.createOrderToken = createOrderToken
  }

  async getConfig(_req, res) {
    try {
      const config = await this.service.getPublicConfig()
      return this.response.success(res, config, '获取配置成功')
    } catch (error) {
      this.logger.error('获取商城配置失败:', error)
      return this.response.error(res, error.message || '获取配置失败', 500)
    }
  }

  async getBanners(_req, res) {
    try {
      const banners = await this.service.getActiveBanners()
      return this.response.success(res, banners, '获取轮播图成功')
    } catch (error) {
      this.logger.error('获取轮播图失败:', error)
      return this.response.error(res, error.message || '获取轮播图失败', 500)
    }
  }

  async getMemories(_req, res) {
    try {
      const memories = await this.service.getMemories()
      return this.response.success(res, memories, '获取内存列表成功')
    } catch (error) {
      this.logger.error('获取内存列表失败:', error)
      return this.response.error(res, error.message || '获取内存列表失败', 500)
    }
  }

  async getBrands(req, res) {
    try {
      const brands = await this.service.getBrands(req.query.include_empty === 'true')
      return this.response.success(res, brands, '获取品牌列表成功')
    } catch (error) {
      this.logger.error('获取品牌列表失败:', error)
      return this.response.error(res, error.message || '获取品牌列表失败', 500)
    }
  }

  async getModels(req, res) {
    try {
      const { brand_id, include_empty } = req.query
      const models = await this.service.getModels(
        brand_id ? parseInt(brand_id) : null,
        include_empty === 'true'
      )
      return this.response.success(res, models, '获取型号列表成功')
    } catch (error) {
      this.logger.error('获取型号列表失败:', error)
      return this.response.error(res, error.message || '获取型号列表失败', 500)
    }
  }

  async getColors(req, res) {
    try {
      const colors = await this.service.getColors(req.query.include_empty === 'true')
      return this.response.success(res, colors, '获取颜色列表成功')
    } catch (error) {
      this.logger.error('获取颜色列表失败:', error)
      return this.response.error(res, error.message || '获取颜色列表失败', 500)
    }
  }

  async getProductDetail(req, res) {
    try {
      const product = await this.service.getProductDetail(req.params.id)
      if (!product) return this.response.notFound(res, '商品不存在')
      return this.response.success(res, product, '获取商品详情成功')
    } catch (error) {
      this.logger.error('获取商品详情失败:', error)
      return this.response.error(res, error.message || '获取商品详情失败', 500)
    }
  }

  async getProductImages(req, res) {
    try {
      const images = await this.service.getProductImages(req.params.id)
      return this.response.success(res, images, '获取商品图片成功')
    } catch (error) {
      this.logger.error('[API /public/products/:id/images] 获取商品图片失败:', error)
      return this.response.error(res, error.message || '获取商品图片失败', 500)
    }
  }

  async getTemplatePhones(req, res) {
    try {
      const result = await this.service.getTemplatePhones(req.params.id)
      if (!result) return this.response.notFound(res, '模板不存在')
      return this.response.success(res, result.phones, '获取商品列表成功')
    } catch (error) {
      this.logger.error('获取模板商品失败:', error)
      return this.response.error(res, error.message || '获取模板商品失败', 500)
    }
  }

  async getHomeSections(_req, res) {
    try {
      const sections = await this.homeSections.getActiveSections()
      return this.response.success(res, sections, '获取推荐区域成功')
    } catch (error) {
      this.logger.error('获取推荐区域失败:', error)
      const isMissingHomeSectionTable = (
        error?.code === 'ER_NO_SUCH_TABLE' ||
        /H5_home_sections|H5_home_section_products/i.test(String(error?.message || ''))
      )

      if (isMissingHomeSectionTable) {
        this.logger.warn('推荐区域相关数据表不存在，降级返回空列表')
        return this.response.success(res, [], '推荐区域未初始化')
      }

      return this.response.error(res, error.message || '获取推荐区域失败', 500)
    }
  }

  sendPaginated(res, result, message) {
    return res.status(200).json({
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
  }

  async getProducts(req, res) {
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
      const parsedIsNew = is_new !== undefined
        ? is_new === 'true' || is_new === true || is_new === '1' || is_new === 1
        : null
      const result = await this.service.getProducts({
        page,
        page_size,
        brand_id: brand_id ? parseInt(brand_id) : null,
        model_id: model_id ? parseInt(model_id) : null,
        color_id: color_id ? parseInt(color_id) : null,
        memory_id: memory_id ? parseInt(memory_id) : null,
        is_new: parsedIsNew,
        search,
        sort,
        order
      })
      return this.sendPaginated(res, result, '获取商品列表成功')
    } catch (error) {
      this.logger.error('[API /public/products] 获取商品列表失败:', error)
      return this.response.serverError(res, '获取商品列表失败', error)
    }
  }

  async getAggregatedProducts(req, res) {
    try {
      const { page, page_size } = normalizePublicPagination(req.query)
      const { brand_id, model_id, is_new, color_id, search } = req.query
      const parsedIsNew = is_new !== undefined
        ? is_new === 'true' || is_new === true || is_new === '1' || is_new === 1
        : null
      const result = await this.service.getAggregatedProducts({
        page,
        page_size,
        brand_id: brand_id !== undefined ? parseInt(brand_id) : null,
        model_id: model_id !== undefined ? parseInt(model_id) : null,
        color_id: color_id !== undefined ? parseInt(color_id) : null,
        is_new: parsedIsNew,
        search
      })
      return this.sendPaginated(res, result, '获取聚合商品列表成功')
    } catch (error) {
      this.logger.error('[API /public/products/aggregate] 获取聚合商品列表失败:', error)
      return this.response.serverError(res, '获取聚合商品列表失败', error)
    }
  }

  async getProductStockDistribution(req, res) {
    const { brand_id, model_id, color_id, memory_id, is_new } = req.query
    if (!brand_id || !model_id || !color_id || !memory_id || is_new === undefined) {
      return this.response.badRequest(res, '缺少必要参数')
    }

    try {
      const result = await this.service.getProductStockDistribution(
        parseInt(brand_id),
        parseInt(model_id),
        parseInt(color_id),
        parseInt(memory_id),
        is_new === 'true' || is_new === true
      )
      return this.response.success(res, result, '获取库存分布成功')
    } catch (error) {
      this.logger.error('[API /public/products/stock/distribution] 获取库存分布失败:', error)
      return this.response.error(res, error.message || '获取库存分布失败', 500)
    }
  }

  async searchProducts(req, res) {
    try {
      const { page, page_size } = normalizePublicPagination(req.query)
      const result = await this.service.searchProducts(req.params.keyword, { page, page_size })
      return this.sendPaginated(res, result, '搜索成功')
    } catch (error) {
      this.logger.error('搜索商品失败:', error)
      return this.response.serverError(res, '搜索商品失败', error)
    }
  }

  async getCart(req, res) {
    const cartId = normalizeCartId(req.params.cartId)
    if (!cartId) return this.response.badRequest(res, '购物车标识无效')

    try {
      const cart = await this.service.getCart(cartId)
      return this.response.success(res, cart, '获取购物车成功')
    } catch (error) {
      this.logger.error('获取购物车失败:', error)
      return this.response.error(res, error.message || '获取购物车失败', 500)
    }
  }

  async addToCart(req, res) {
    const cartId = normalizeCartId(req.body?.cartId)
    const phoneId = Number(req.body?.phoneId)
    const quantity = Number(req.body?.quantity ?? 1)
    if (!cartId || !Number.isInteger(phoneId) || phoneId <= 0 || quantity !== 1) {
      return this.response.badRequest(res, '购物车商品或数量不正确')
    }

    try {
      await this.service.addToCart(cartId, phoneId, quantity)
      return this.response.success(res, null, '添加到购物车成功')
    } catch (error) {
      this.logger.error('添加到购物车失败:', error)
      return this.response.error(res, error.message || '添加到购物车失败', 500)
    }
  }

  async updateCartItem(req, res) {
    const id = Number(req.params.id)
    const quantity = Number(req.body?.quantity)
    const cartId = normalizeCartId(req.body?.cartId)
    if (!Number.isInteger(id) || id <= 0 || !cartId || quantity !== 1) {
      return this.response.badRequest(res, '购物车商品或数量不正确')
    }

    try {
      await this.service.updateCartItem(cartId, id, quantity)
      return this.response.success(res, null, '更新购物车成功')
    } catch (error) {
      this.logger.error('更新购物车失败:', error)
      return this.response.error(res, error.message || '更新购物车失败', 500)
    }
  }

  async removeCartItem(req, res) {
    const id = Number(req.params.id)
    const cartId = normalizeCartId(req.query.cartId)
    if (!Number.isInteger(id) || id <= 0 || !cartId) {
      return this.response.badRequest(res, '购物车商品标识无效')
    }

    try {
      await this.service.removeFromCart(cartId, id)
      return this.response.success(res, null, '删除成功')
    } catch (error) {
      this.logger.error('删除购物车商品失败:', error)
      return this.response.error(res, error.message || '删除失败', 500)
    }
  }

  async clearCart(req, res) {
    const cartId = normalizeCartId(req.params.cartId)
    if (!cartId) return this.response.badRequest(res, '购物车标识无效')

    try {
      await this.service.clearCart(cartId)
      return this.response.success(res, null, '清空购物车成功')
    } catch (error) {
      this.logger.error('清空购物车失败:', error)
      return this.response.error(res, error.message || '清空购物车失败', 500)
    }
  }

  async getOrderByNumber(req, res) {
    try {
      const { orderNumber } = req.params
      const order = await this.service.getOrderByNumber(orderNumber)
      if (!order) return this.response.notFound(res, '订单不存在')

      const accessToken = req.headers['x-order-access-token'] || req.query.access_token
      if (!this.verifyOrderToken(accessToken, order)) {
        return this.response.unauthorized(res, '订单访问凭证无效或已过期')
      }

      return this.response.success(res, { ...order, access_token: accessToken }, '获取订单成功')
    } catch (error) {
      this.logger.error('获取订单失败:', error)
      return this.response.error(res, error.message || '获取订单失败', 500)
    }
  }

  async confirmOrderPayment(req, res) {
    try {
      const { orderNumber } = req.params
      const order = await this.service.getOrderByNumber(orderNumber)
      if (!order || !this.verifyOrderToken(req.body?.access_token, order)) {
        return this.response.unauthorized(res, '订单访问凭证无效或已过期')
      }

      const result = await this.service.confirmUserPayment(orderNumber)
      if (!result) return this.response.notFound(res, '订单不存在')
      return this.response.success(res, result, '支付确认成功，订单状态已更新')
    } catch (error) {
      this.logger.error('确认支付失败:', error)
      return this.response.error(res, error.message || '确认支付失败', 500)
    }
  }

  async getOrdersByPhone(req, res) {
    try {
      const customerPhone = String(req.params.customer_phone || '').replace(/\D/g, '')
      const { page = 1, customer_name = '' } = req.query
      const normalizedCustomerName = String(customer_name).trim()
      if (!/^1[3-9]\d{9}$/.test(customerPhone) || normalizedCustomerName.length < 2 || normalizedCustomerName.length > 50) {
        return this.response.badRequest(res, '请输入正确的手机号和下单姓名')
      }

      const normalizedPage = Math.max(1, Number.parseInt(String(page), 10) || 1)
      const normalizedPageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.page_size), 10) || 10))
      const result = await this.service.getOrdersByPhone(customerPhone, {
        page: normalizedPage,
        page_size: normalizedPageSize,
        customer_name: normalizedCustomerName
      })
      return this.sendPaginated(res, result, '获取订单列表成功')
    } catch (error) {
      this.logger.error('获取订单列表失败:', error)
      return this.response.serverError(res, '获取订单列表失败', error)
    }
  }

  async cancelCustomerOrder(req, res) {
    try {
      const { id } = req.params
      const result = await this.service.cancelCustomerOrder({
        id,
        accessToken: req.body?.access_token,
        reason: req.body?.reason
      }, this.verifyOrderToken)

      if (result.status === 'not_found') return this.response.notFound(res, '订单不存在')
      if (result.status === 'unauthorized') {
        return this.response.unauthorized(res, '订单访问凭证无效或已过期')
      }
      if (result.status === 'invalid_status') {
        return this.response.badRequest(res, `订单状态为 ${result.orderStatus}，无法取消`)
      }
      if (result.status === 'expired') {
        return this.response.badRequest(res, '订单已过期，系统将自动取消')
      }
      if (result.status === 'changed') {
        return this.response.badRequest(res, '订单状态已变化，请刷新后重试')
      }

      return this.response.success(res, { id, orderNumber: result.orderNumber }, '订单已取消')
    } catch (error) {
      this.logger.error('取消订单失败:', error)
      return this.response.error(res, error.message || '取消订单失败', 500)
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body
      if (!status) return this.response.badRequest(res, '缺少状态参数')

      const validStatuses = ['pending', 'paid', 'shipped', 'completed', 'cancelled']
      if (!validStatuses.includes(status)) return this.response.badRequest(res, '无效的状态值')

      const result = await this.service.updateOrderStatus(id, status)
      if (!result) return this.response.notFound(res, '订单不存在')
      return this.response.success(res, result, '修改订单状态成功')
    } catch (error) {
      this.logger.error('修改订单状态失败:', error)
      return this.response.error(res, error.message || '修改订单状态失败', 500)
    }
  }

  async createOrder(req, res) {
    try {
      const orderData = req.body && typeof req.body === 'object' ? req.body : {}
      const customerName = String(orderData.customerName || '').trim()
      const customerPhone = String(orderData.customerPhone || '').replace(/\D/g, '')
      const customerAddress = String(orderData.customerAddress || '').trim()
      const remarks = String(orderData.remarks || '').trim()
      const cartId = orderData.cartId ? normalizeCartId(orderData.cartId) : ''

      if (customerName.length < 2 || customerName.length > 50 || !/^1[3-9]\d{9}$/.test(customerPhone)) {
        return this.response.badRequest(res, '请填写正确的联系人姓名和手机号')
      }
      if (customerAddress.length > 500 || remarks.length > 1000) {
        return this.response.badRequest(res, '地址或备注内容过长')
      }
      if (orderData.cartId && !cartId) return this.response.badRequest(res, '购物车标识无效')
      if (!Array.isArray(orderData.items) || orderData.items.length === 0 || orderData.items.length > 100) {
        return this.response.badRequest(res, '请选择商品')
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
        return this.response.badRequest(res, '商品或购买数量不正确')
      }

      const order = await this.service.createOrder({
        ...orderData,
        customerName,
        customerPhone,
        customerAddress,
        remarks,
        cartId: cartId || undefined,
        items: normalizedItems
      })
      const accessToken = this.createOrderToken({
        id: order.orderId,
        orderNumber: order.orderNumber,
        customerPhone
      })
      return this.response.created(res, '下单成功', { ...order, accessToken })
    } catch (error) {
      this.logger.error('创建订单失败:', error)
      return this.response.error(res, error.message || '创建订单失败', 500)
    }
  }
}

module.exports = ShopPublicCatalogController
