'use strict'

const CustomerRepository = require('../repositories/customer.repository')
const { searchCustomers: searchCustomerOptions } = require('../services/customer-search.service')
const bcrypt = require('bcryptjs')
const { generateMemberNumber } = require('../utils/member-number')
const {
  getCustomerPointsConfig,
  saveCustomerPointsConfig
} = require('../services/customer-points.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { PAGINATION } = require('../config/constants')

const APPLE_ACCOUNT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const APPLE_ACCOUNT_PHONE_REGEX = /^1[3-9]\d{9}$/
const isValidAppleAccount = account => (
  typeof account === 'string' &&
  !/[\u4e00-\u9fa5]/.test(account) &&
  (APPLE_ACCOUNT_EMAIL_REGEX.test(account) || APPLE_ACCOUNT_PHONE_REGEX.test(account))
)

class CustomerController {
  constructor({
    repository = new CustomerRepository(),
    searchCustomers = searchCustomerOptions,
    loadPointsConfig = getCustomerPointsConfig,
    persistPointsConfig = saveCustomerPointsConfig,
    passwordHasher = bcrypt.hash.bind(bcrypt),
    createMemberNumber = generateMemberNumber,
    response = ApiResponse,
    logger = log
  } = {}) {
    this.repository = repository
    this.searchCustomers = searchCustomers
    this.loadPointsConfig = loadPointsConfig
    this.persistPointsConfig = persistPointsConfig
    this.passwordHasher = passwordHasher
    this.createMemberNumber = createMemberNumber
    this.response = response
    this.logger = logger
  }

  async search(req, res) {
    try {
      const { keyword, phone } = req.query
      if (phone) {
        const customer = await this.repository.findByPhone(phone)
        return this.response.success(res, customer ? [customer] : [])
      }

      if (!keyword || keyword.trim().length < 2) {
        return this.response.success(res, [])
      }

      const result = await this.searchCustomers({
        keyword,
        page: req.query.page,
        page_size: req.query.page_size,
        fields: ['id', 'name', 'phone', 'email', 'apple_id', 'member_number', 'vip_level', 'created_at'],
        search_fields: ['name', 'phone', 'email', 'member_number']
      })
      return this.response.success(res, result.records, '搜索客户成功', 200, { pagination: result.pagination })
    } catch (error) {
      this.logger.error('搜索客户失败:', error)
      return this.response.serverError(res, '搜索客户失败', error)
    }
  }

  async list(req, res) {
    try {
      const {
        page = PAGINATION.DEFAULT_PAGE,
        page_size,
        customer_type,
        vip_level,
        gender,
        city,
        province,
        search,
        search_fields,
        register_date_start,
        register_date_end,
        sort_by = 'id',
        sort_order = 'desc',
        status
      } = req.query
      const pageNumber = Math.max(1, Number.parseInt(String(page), 10) || PAGINATION.DEFAULT_PAGE)
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(page_size), 10) || PAGINATION.DEFAULT_LIMIT))
      const result = await this.repository.listCustomers({
        page: pageNumber,
        page_size: pageSize,
        sort_by,
        sort_order,
        filters: {
          customer_type,
          vip_level,
          gender,
          city,
          province,
          search,
          search_fields,
          register_date_start,
          register_date_end,
          status
        }
      })

      return this.response.success(res, {
        customers: result.customers || [],
        pagination: {
          page: pageNumber,
          page_size: pageSize,
          total: result.total,
          total_pages: Math.ceil(result.total / pageSize),
          has_next: pageNumber * pageSize < result.total,
          has_prev: pageNumber > 1
        }
      })
    } catch (error) {
      this.logger.error('获取客户列表失败:', error)
      return this.response.serverError(res, '获取客户列表失败', error)
    }
  }

  async getPointsConfig(_req, res) {
    try {
      const config = await this.loadPointsConfig()
      return this.response.success(res, config, '获取积分设置成功')
    } catch (error) {
      this.logger.error('获取客户积分设置失败:', error)
      return this.response.serverError(res, '获取客户积分设置失败', error)
    }
  }

  async savePointsConfig(req, res) {
    try {
      const {
        enabled,
        include_new,
        include_used,
        new_points_per_100,
        used_points_per_100
      } = req.body || {}

      if (enabled && !include_new && !include_used) {
        return this.response.badRequest(res, '全新和二手至少需要选择一种参与积分统计')
      }

      const newPointsPer100 = Number(new_points_per_100 ?? 1)
      const usedPointsPer100 = Number(used_points_per_100 ?? 1)
      if (include_new && (!Number.isInteger(newPointsPer100) || newPointsPer100 < 1 || newPointsPer100 > 100)) {
        return this.response.badRequest(res, '全新积分必须是1到100之间的整数')
      }
      if (include_used && (!Number.isInteger(usedPointsPer100) || usedPointsPer100 < 1 || usedPointsPer100 > 100)) {
        return this.response.badRequest(res, '二手积分必须是1到100之间的整数')
      }

      const config = await this.persistPointsConfig({
        enabled,
        include_new,
        include_used,
        new_points_per_100: newPointsPer100,
        used_points_per_100: usedPointsPer100
      })
      return this.response.success(res, config, '积分设置保存成功')
    } catch (error) {
      this.logger.error('保存客户积分设置失败:', error)
      return this.response.serverError(res, '保存客户积分设置失败', error)
    }
  }

  async getById(req, res) {
    try {
      const customer = await this.repository.findCustomerById(parseInt(req.params.id))
      if (!customer) return this.response.notFound(res, '客户不存在')

      return this.response.success(res, customer)
    } catch (error) {
      this.logger.error('获取客户详情失败:', error)
      return this.response.serverError(res, '获取客户详情失败', error)
    }
  }

  async create(req, res) {
    try {
      const {
        name,
        gender,
        phone,
        email,
        birthday,
        id_card,
        address,
        city,
        province,
        customer_type,
        remarks,
        wechat,
        qq,
        apple_id
      } = req.body

      if (!name || !phone) return this.response.badRequest(res, '缺少必需字段：姓名、手机号')
      if (!/^1[3-9]\d{9}$/.test(phone)) return this.response.badRequest(res, '手机号格式不正确')

      const existingCustomer = await this.repository.findByPhone(phone)
      if (existingCustomer) return this.response.badRequest(res, '手机号已存在')

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return this.response.badRequest(res, '邮箱格式不正确')
      }
      if (apple_id && !isValidAppleAccount(apple_id)) {
        return this.response.badRequest(res, 'Apple ID 格式不正确，请输入有效的手机号或邮箱（仅支持英文和数字）')
      }

      const memberNumber = await this.createMemberNumber()
      const newCustomer = await this.repository.createCustomerProfile({
        name,
        gender: gender || null,
        phone,
        email: email || null,
        birthday: birthday || null,
        id_card: id_card || null,
        address: address || '',
        city: city || '',
        province: province || '',
        customer_type: customer_type || 'individual',
        remarks: remarks || '',
        wechat: wechat || null,
        qq: qq || null,
        apple_id: apple_id || null
      }, memberNumber)
      return this.response.created(res, '客户创建成功', newCustomer)
    } catch (error) {
      this.logger.error('创建客户失败:', error)
      return this.response.serverError(res, '创建客户失败', error)
    }
  }

  async update(req, res) {
    try {
      const customerId = parseInt(req.params.id, 10)
      const existingCustomer = await this.repository.findCustomerById(customerId)
      if (!existingCustomer) return this.response.notFound(res, '客户不存在')

      const {
        name,
        gender,
        phone,
        email,
        birthday,
        id_card,
        address,
        city,
        province,
        customer_type,
        remarks,
        tags,
        vip_level,
        blacklist,
        wechat,
        qq,
        apple_id,
        member_number,
        balance,
        points,
        password
      } = req.body

      if (phone && phone !== existingCustomer.phone) {
        if (!/^1[3-9]\d{9}$/.test(phone)) return this.response.badRequest(res, '手机号格式不正确')
        const existingPhoneCustomer = await this.repository.findByPhone(phone)
        if (existingPhoneCustomer && existingPhoneCustomer.id !== customerId) {
          return this.response.badRequest(res, '手机号已存在')
        }
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return this.response.badRequest(res, '邮箱格式不正确')
      }
      if (apple_id && !isValidAppleAccount(apple_id)) {
        return this.response.badRequest(res, 'Apple ID 格式不正确，请输入有效的手机号或邮箱（仅支持英文和数字）')
      }

      const updateData = {}
      if (name !== undefined) updateData.name = name
      if (gender !== undefined) updateData.gender = gender
      if (phone !== undefined) updateData.phone = phone
      if (email !== undefined) updateData.email = email
      if (birthday !== undefined) updateData.birthday = birthday
      if (id_card !== undefined) updateData.id_card = id_card
      if (address !== undefined) updateData.address = address
      if (city !== undefined) updateData.city = city
      if (province !== undefined) updateData.province = province
      if (customer_type !== undefined) updateData.customer_type = customer_type
      if (remarks !== undefined) updateData.remarks = remarks
      if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags.join(',') : tags
      if (vip_level !== undefined) updateData.vip_level = vip_level
      if (blacklist !== undefined) updateData.blacklist = Boolean(blacklist)
      if (wechat !== undefined) updateData.wechat = wechat
      if (qq !== undefined) updateData.qq = qq
      if (apple_id !== undefined) updateData.apple_id = apple_id
      if (member_number !== undefined) updateData.member_number = member_number
      if (balance !== undefined) updateData.balance = parseFloat(balance)
      if (points !== undefined) updateData.points = parseInt(points)

      if (password !== undefined && password !== null && password !== '') {
        if (password.length < 6) return this.response.badRequest(res, '密码至少需要6位')
        updateData.password = await this.passwordHasher(password, 10)
      }

      const availableColumns = await this.repository.getCustomerColumns()
      if (availableColumns.has('updated_at')) updateData.updated_at = new Date()
      const sanitizedUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([fieldName]) => availableColumns.has(fieldName))
      )
      if (Object.keys(sanitizedUpdateData).length === 0) {
        return this.response.badRequest(res, '没有可更新的字段')
      }

      const result = await this.repository.update(customerId, sanitizedUpdateData)
      if (!result || result.affectedRows === 0) {
        return this.response.notFound(res, '客户不存在或更新失败')
      }

      const updatedCustomer = await this.repository.findCustomerById(customerId)
      return this.response.success(res, updatedCustomer, '客户信息更新成功')
    } catch (error) {
      if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
        return this.response.badRequest(res, '手机号已存在')
      }
      this.logger.error('更新客户信息失败:', error)
      return this.response.serverError(res, '更新客户信息失败', error)
    }
  }

  async getPurchases(req, res) {
    try {
      const { page = 1, page_size, start_date, end_date } = req.query
      const parsedPage = Math.max(1, Number.parseInt(String(page), 10) || 1)
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(page_size), 10) || 20))
      const offset = (parsedPage - 1) * pageSize
      const result = await this.repository.getCustomerPurchases(parseInt(req.params.id), {
        start_date,
        end_date,
        page_size: pageSize,
        offset: parseInt(offset) || 0
      })
      const purchases = result.purchases.map(purchase => ({
        id: purchase.phone_id,
        phone_id: purchase.phone_id,
        imei: purchase.imei,
        serial_number: purchase.serial_number,
        brand: purchase.brand || '-',
        model: purchase.model || '-',
        color: purchase.color || '-',
        memory: purchase.memory || '-',
        purchase_cost: purchase.purchase_cost === null ? null : Number(purchase.purchase_cost),
        sale_price: purchase.sale_price === null ? null : Number(purchase.sale_price),
        profit: purchase.sale_price === null || purchase.purchase_cost === null
          ? null
          : Number(purchase.sale_price) - Number(purchase.purchase_cost),
        sale_time: purchase.sale_time,
        is_new: purchase.is_new === 1 ? '全新' : '二手',
        payment_method: purchase.payment_method || '-',
        salesperson: purchase.salesperson_name || '-',
        created_at: purchase.sale_created_at
      }))

      return this.response.success(res, {
        purchases,
        pagination: {
          page: parsedPage,
          page_size: pageSize,
          total: result.total,
          total_pages: Math.ceil(result.total / pageSize),
          has_next: parsedPage * pageSize < result.total,
          has_prev: parsedPage > 1
        }
      })
    } catch (error) {
      this.logger.error('获取客户消费记录失败:', error)
      return this.response.serverError(res, '获取客户消费记录失败', error)
    }
  }

  async remove(req, res) {
    try {
      const id = parseInt(req.params.id)
      const result = await this.repository.delete(id)
      if (!result || result.affectedRows === 0) {
        return this.response.notFound(res, '客户不存在')
      }

      return this.response.success(res, { id, deleted: true }, '客户删除成功')
    } catch (error) {
      this.logger.error('删除客户失败:', error)
      return this.response.serverError(res, '删除客户失败', error)
    }
  }

  rejectPurchaseCreation(_req, res) {
    return this.response.error(res, '消费记录请通过销售交易接口创建', 501)
  }

  async updateVipLevel(req, res) {
    try {
      const { vip_level } = req.body
      const validLevels = ['normal', 'silver', 'gold', 'platinum']
      if (!validLevels.includes(vip_level)) return this.response.badRequest(res, '无效的VIP等级')

      const customer = await this.repository.updateVipLevel(req.params.id, vip_level)
      if (!customer) return this.response.notFound(res, '客户不存在')

      return this.response.success(res, customer, 'VIP等级更新成功')
    } catch (error) {
      this.logger.error('更新VIP等级失败:', error)
      return this.response.serverError(res, '更新VIP等级失败', error)
    }
  }

  async getStatistics(req, res) {
    try {
      const stats = await this.repository.getStatistics(req.query)
      return this.response.success(res, stats)
    } catch (error) {
      this.logger.error('获取客户统计失败:', error)
      return this.response.serverError(res, '获取客户统计失败', error)
    }
  }

  async getStatisticsOverview(req, res) {
    try {
      const stats = await this.repository.getStatisticsOverview(req.query)
      return this.response.success(res, stats)
    } catch (error) {
      this.logger.error('获取客户统计失败:', error)
      return this.response.serverError(res, '获取客户统计失败', error)
    }
  }
}

module.exports = CustomerController
