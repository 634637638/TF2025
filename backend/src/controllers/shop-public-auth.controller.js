'use strict'

const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { extractBearerToken, hashCustomerToken } = require('../utils/customer-token')
const { isValidIdCard } = require('../utils/security-enhanced')
const ShopPublicService = require('../services/shop-public.service')

const normalizeHistoryPagination = query => ({
  page: Math.max(1, Number.parseInt(String(query?.page ?? 1), 10) || 1),
  page_size: Math.min(50, Math.max(1, Number.parseInt(String(query?.page_size ?? 20), 10) || 20))
})

class ShopPublicAuthController {
  constructor({ service = new ShopPublicService(), response = ApiResponse, logger = log } = {}) {
    this.service = service
    this.response = response
    this.logger = logger
  }

  async logout(req, res) {
    try {
      const token = extractBearerToken(req.headers.authorization)
      if (token) await this.service.logoutCustomer(hashCustomerToken(token))
      return this.response.success(res, null, '登出成功')
    } catch (error) {
      this.logger.error('登出失败:', error)
      return this.response.error(res, error.message || '登出失败', 500)
    }
  }

  async register(req, res) {
    const name = String(req.body?.name || '').trim()
    const phone = String(req.body?.phone || '').trim()
    const password = String(req.body?.password || '')
    if (name.length < 2 || name.length > 50 || !phone || !password) {
      return this.response.badRequest(res, '请填写完整信息')
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return this.response.badRequest(res, '请输入正确的手机号')
    }
    if (password.length < 6 || password.length > 128) {
      return this.response.badRequest(res, '密码长度应为6至128位')
    }

    try {
      const result = await this.service.registerCustomer({ name, phone, password })
      if (result.conflict) return this.response.error(res, '该手机号已注册', 409)
      return this.response.success(res, {
        token: result.token,
        user: result.user
      }, '注册成功')
    } catch (error) {
      this.logger.error('注册失败:', error)
      return this.response.error(res, error.message || '注册失败', 500)
    }
  }

  async login(req, res) {
    const phone = String(req.body?.phone || '').trim()
    const password = String(req.body?.password || '')
    if (!phone || !password) return this.response.badRequest(res, '请输入手机号和密码')
    if (!/^1[3-9]\d{9}$/.test(phone) || password.length > 128) {
      return this.response.badRequest(res, '手机号或密码格式不正确')
    }

    try {
      const result = await this.service.loginCustomer({ phone, password })
      if (result.reason === 'not-found') return this.response.error(res, '用户不存在', 404)
      if (result.reason === 'password-unset') {
        return this.response.error(res, '该账户未设置密码，请联系管理员重置密码', 403)
      }
      if (result.reason === 'invalid-password') return this.response.error(res, '密码错误', 401)
      return this.response.success(res, { token: result.token, user: result.user }, '登录成功')
    } catch (error) {
      this.logger.error('登录失败:', error)
      return this.response.error(res, error.message || '登录失败', 500)
    }
  }

  async requireCustomerSession(req, res) {
    const token = extractBearerToken(req.headers.authorization)
    if (!token) {
      this.response.unauthorized(res, '请先登录')
      return null
    }

    const customer = await this.service.getCustomerSession(hashCustomerToken(token))
    if (!customer) {
      this.response.unauthorized(res, 'Token无效或已过期')
      return null
    }
    return customer
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

  async getOrders(req, res) {
    try {
      const customer = await this.requireCustomerSession(req, res)
      if (!customer) return
      const result = await this.service.getOrdersByPhone(customer.phone, normalizeHistoryPagination(req.query))
      return this.sendPaginated(res, result, '获取订单成功')
    } catch (error) {
      this.logger.error('获取用户订单失败:', error)
      return this.response.error(res, error.message || '获取用户订单失败', 500)
    }
  }

  async getMe(req, res) {
    try {
      const customer = await this.requireCustomerSession(req, res)
      if (!customer) return
      const user = await this.service.getCustomerSummary(customer.customer_id)
      if (!user) return this.response.notFound(res, '用户不存在')
      return this.response.success(res, user, '获取用户信息成功')
    } catch (error) {
      this.logger.error('获取用户信息失败:', error)
      return this.response.error(res, error.message || '获取用户信息失败', 500)
    }
  }

  async getProfile(req, res) {
    try {
      const customer = await this.requireCustomerSession(req, res)
      if (!customer) return
      const user = await this.service.getCustomerProfile(customer.customer_id)
      if (!user) return this.response.notFound(res, '用户不存在')
      return this.response.success(res, user, '获取用户资料成功')
    } catch (error) {
      this.logger.error('获取用户资料失败:', error)
      return this.response.error(res, error.message || '获取用户资料失败', 500)
    }
  }

  async updateProfile(req, res) {
    try {
      const customer = await this.requireCustomerSession(req, res)
      if (!customer) return

      const { name, gender, idCard, appleId, address } = req.body || {}
      const profile = {}
      if (name !== undefined) {
        const normalizedName = String(name).trim()
        if (normalizedName.length < 2 || normalizedName.length > 50) {
          return this.response.badRequest(res, '姓名长度应为2至50个字符')
        }
        profile.name = normalizedName
      }
      if (gender !== undefined) {
        const normalizedGender = String(gender).trim()
        if (normalizedGender && !['male', 'female', 'unknown'].includes(normalizedGender)) {
          return this.response.badRequest(res, '性别参数不正确')
        }
        profile.gender = normalizedGender || null
      }
      if (idCard !== undefined) {
        const normalizedIdCard = String(idCard).trim().toUpperCase()
        if (normalizedIdCard && !isValidIdCard(normalizedIdCard)) {
          return this.response.badRequest(res, '身份证号格式不正确')
        }
        profile.idCard = normalizedIdCard || null
      }
      if (appleId !== undefined) {
        const normalizedAppleId = String(appleId).trim()
        const validAppleId = !normalizedAppleId
          || /^1[3-9]\d{9}$/.test(normalizedAppleId)
          || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAppleId) && normalizedAppleId.length <= 254)
        if (!validAppleId) return this.response.badRequest(res, 'Apple ID格式不正确')
        profile.appleId = normalizedAppleId || null
      }
      if (address !== undefined) {
        const normalizedAddress = String(address).trim()
        if (normalizedAddress.length > 500) {
          return this.response.badRequest(res, '收货地址不能超过500个字符')
        }
        profile.address = normalizedAddress || null
      }

      if (Object.keys(profile).length === 0) {
        return this.response.badRequest(res, '没有要更新的字段')
      }

      const user = await this.service.updateCustomerProfile(customer.customer_id, profile)
      return this.response.success(res, user, '更新资料成功')
    } catch (error) {
      this.logger.error('更新用户资料失败:', error)
      return this.response.error(res, error.message || '更新用户资料失败', 500)
    }
  }

  async getSales(req, res) {
    try {
      const customer = await this.requireCustomerSession(req, res)
      if (!customer) return
      const result = await this.service.getSalesByCustomerId(customer.customer_id, normalizeHistoryPagination(req.query))
      return this.sendPaginated(res, result, '获取销售记录成功')
    } catch (error) {
      this.logger.error('获取用户销售记录失败:', error)
      return this.response.serverError(res, '获取用户销售记录失败', error)
    }
  }
}

module.exports = ShopPublicAuthController
