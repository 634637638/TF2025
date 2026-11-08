'use strict'

const CustomerRepository = require('../repositories/customer.repository')
const { searchCustomers: searchCustomerOptions } = require('./customer-search.service')
const bcrypt = require('bcryptjs')
const { generateMemberNumber } = require('../utils/member-number')
const {
  getCustomerPointsConfig,
  saveCustomerPointsConfig
} = require('./customer-points.service')
const { PAGINATION } = require('../config/constants')

const APPLE_ACCOUNT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const APPLE_ACCOUNT_PHONE_REGEX = /^1[3-9]\d{9}$/
const isValidAppleAccount = account => (
  typeof account === 'string' &&
  !/[\u4e00-\u9fa5]/.test(account) &&
  (APPLE_ACCOUNT_EMAIL_REGEX.test(account) || APPLE_ACCOUNT_PHONE_REGEX.test(account))
)
const BaseService = require('../core/base/base.service')

class CustomerManagementService extends BaseService {
  constructor({
    repository = new CustomerRepository(),
    searchCustomers = searchCustomerOptions,
    loadPointsConfig = getCustomerPointsConfig,
    persistPointsConfig = saveCustomerPointsConfig,
    passwordHasher = bcrypt.hash.bind(bcrypt),
    createMemberNumber = generateMemberNumber
  } = {}) {
    super()
    this.repository = repository
    this.searchCustomers = searchCustomers
    this.loadPointsConfig = loadPointsConfig
    this.persistPointsConfig = persistPointsConfig
    this.passwordHasher = passwordHasher
    this.createMemberNumber = createMemberNumber
  }

  async search(query) {
    
    const { keyword, phone } = query
    if (phone) {
      const customer = await this.repository.findByPhone(phone)
      return { data: customer ? [customer] : [] }
    }

    if (!keyword || keyword.trim().length < 2) {
      return { data: [] }
    }

    const result = await this.searchCustomers({
      keyword,
      page: query.page,
      page_size: query.page_size,
      fields: ['id', 'name', 'phone', 'email', 'apple_id', 'member_number', 'vip_level', 'created_at'],
      search_fields: ['name', 'phone', 'email', 'member_number']
    })
    return { data: result.records, message: '搜索客户成功', extra: { pagination: result.pagination } }
  }

  async list(query) {
    
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
    } = query
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

    return { data: {
      customers: result.customers || [],
      pagination: {
        page: pageNumber,
        page_size: pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / pageSize),
        has_next: pageNumber * pageSize < result.total,
        has_prev: pageNumber > 1
      }
    } }
  }

  async getPointsConfig() {
    
    const config = await this.loadPointsConfig()
    return { data: config, message: '获取积分设置成功' }
  }

  async savePointsConfig(body) {
    
    const {
      enabled,
      include_new,
      include_used,
      new_points_per_100,
      used_points_per_100
    } = body || {}

    if (enabled && !include_new && !include_used) {
      throw this.createError('全新和二手至少需要选择一种参与积分统计', 400)
    }

    const newPointsPer100 = Number(new_points_per_100 ?? 1)
    const usedPointsPer100 = Number(used_points_per_100 ?? 1)
    if (include_new && (!Number.isInteger(newPointsPer100) || newPointsPer100 < 1 || newPointsPer100 > 100)) {
      throw this.createError('全新积分必须是1到100之间的整数', 400)
    }
    if (include_used && (!Number.isInteger(usedPointsPer100) || usedPointsPer100 < 1 || usedPointsPer100 > 100)) {
      throw this.createError('二手积分必须是1到100之间的整数', 400)
    }

    const config = await this.persistPointsConfig({
      enabled,
      include_new,
      include_used,
      new_points_per_100: newPointsPer100,
      used_points_per_100: usedPointsPer100
    })
    return { data: config, message: '积分设置保存成功' }
  }

  async getById(params) {
    
    const customer = await this.repository.findCustomerById(parseInt(params.id))
    if (!customer) throw this.createError('客户不存在', 404)

    return { data: customer }
  }

  async create(body) {
    
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
    } = body

    if (!name || !phone) throw this.createError('缺少必需字段：姓名、手机号', 400)
    if (!/^1[3-9]\d{9}$/.test(phone)) throw this.createError('手机号格式不正确', 400)

    const existingCustomer = await this.repository.findByPhone(phone)
    if (existingCustomer) throw this.createError('手机号已存在', 400)

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw this.createError('邮箱格式不正确', 400)
    }
    if (apple_id && !isValidAppleAccount(apple_id)) {
      throw this.createError('Apple ID 格式不正确，请输入有效的手机号或邮箱（仅支持英文和数字）', 400)
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
    return { data: newCustomer, message: '客户创建成功' }
  }

  async update(params, body) {
    
    const customerId = parseInt(params.id, 10)
    const existingCustomer = await this.repository.findCustomerById(customerId)
    if (!existingCustomer) throw this.createError('客户不存在', 404)

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
    } = body

    if (phone && phone !== existingCustomer.phone) {
      if (!/^1[3-9]\d{9}$/.test(phone)) throw this.createError('手机号格式不正确', 400)
      const existingPhoneCustomer = await this.repository.findByPhone(phone)
      if (existingPhoneCustomer && existingPhoneCustomer.id !== customerId) {
        throw this.createError('手机号已存在', 400)
      }
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw this.createError('邮箱格式不正确', 400)
    }
    if (apple_id && !isValidAppleAccount(apple_id)) {
      throw this.createError('Apple ID 格式不正确，请输入有效的手机号或邮箱（仅支持英文和数字）', 400)
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
      if (password.length < 6) throw this.createError('密码至少需要6位', 400)
      updateData.password = await this.passwordHasher(password, 10)
    }

    const availableColumns = await this.repository.getCustomerColumns()
    if (availableColumns.has('updated_at')) updateData.updated_at = new Date()
    const sanitizedUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([fieldName]) => availableColumns.has(fieldName))
    )
    if (Object.keys(sanitizedUpdateData).length === 0) {
      throw this.createError('没有可更新的字段', 400)
    }

    const result = await this.repository.update(customerId, sanitizedUpdateData)
    if (!result || result.affectedRows === 0) {
      throw this.createError('客户不存在或更新失败', 404)
    }

    const updatedCustomer = await this.repository.findCustomerById(customerId)
    return { data: updatedCustomer, message: '客户信息更新成功' }
  }

  async getPurchases(params, query) {
    
    const { page = 1, page_size, start_date, end_date } = query
    const parsedPage = Math.max(1, Number.parseInt(String(page), 10) || 1)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(page_size), 10) || 20))
    const offset = (parsedPage - 1) * pageSize
    const result = await this.repository.getCustomerPurchases(parseInt(params.id), {
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

    return { data: {
      purchases,
      pagination: {
        page: parsedPage,
        page_size: pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / pageSize),
        has_next: parsedPage * pageSize < result.total,
        has_prev: parsedPage > 1
      }
    } }
  }

  async remove(params) {
    
    const id = parseInt(params.id)
    const result = await this.repository.delete(id)
    if (!result || result.affectedRows === 0) {
      throw this.createError('客户不存在', 404)
    }

    return { data: { id, deleted: true }, message: '客户删除成功' }
  }

  async updateVipLevel(params, body) {
    
    const { vip_level } = body
    const validLevels = ['normal', 'silver', 'gold', 'platinum']
    if (!validLevels.includes(vip_level)) throw this.createError('无效的VIP等级', 400)

    const customer = await this.repository.updateVipLevel(params.id, vip_level)
    if (!customer) throw this.createError('客户不存在', 404)

    return { data: customer, message: 'VIP等级更新成功' }
  }

  async getStatistics(query) {
    
    const stats = await this.repository.getStatistics(query)
    return { data: stats }
  }

  async getStatisticsOverview(query) {
    
    const stats = await this.repository.getStatisticsOverview(query)
    return { data: stats }
  }
}

module.exports = CustomerManagementService
