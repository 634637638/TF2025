'use strict'

const { isPersonName, isMobilePhone, normalizePhone, isMoneyInput, isIntegerInput } = require('../utils/input-values')
const CustomerRepository = require('../repositories/customer.repository')
const CustomerAddressService = require('./customer-address.service')
const AccessoryRepository = require('../repositories/accessory.repository')
const CustomerPointsLedgerService = require('./customer-points-ledger.service')
const { searchCustomers: searchCustomerOptions } = require('./customer-search.service')
const bcrypt = require('bcryptjs')
const { generateMemberNumber } = require('../utils/member-number')
const {
  getCustomerPointsConfig,
  saveCustomerPointsConfig,
  validatePointsConfig
} = require('./customer-points.service')
const { PAGINATION } = require('../config/constants')
const CustomerAccountLedgerRepository = require('../repositories/customer-account-ledger.repository')

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
    accessoryRepository = new AccessoryRepository(),
    searchCustomers = searchCustomerOptions,
    loadPointsConfig = getCustomerPointsConfig,
    persistPointsConfig = saveCustomerPointsConfig,
    pointsLedger = new CustomerPointsLedgerService(),
    accountLedger = new CustomerAccountLedgerRepository(),
    passwordHasher = bcrypt.hash.bind(bcrypt),
    createMemberNumber = generateMemberNumber,
    addresses
  } = {}) {
    super()
    this.repository = repository
    this.accessoryRepository = accessoryRepository
    this.searchCustomers = searchCustomers
    this.loadPointsConfig = loadPointsConfig
    this.persistPointsConfig = persistPointsConfig
    this.pointsLedger = pointsLedger
    this.accountLedger = accountLedger
    this.passwordHasher = passwordHasher
    this.createMemberNumber = createMemberNumber
    this.addresses = addresses || new CustomerAddressService({ repository })
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

  async list(query, { hiddenFields = [] } = {}) {
    
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
    const hidden = new Set(hiddenFields.map(field => field.split('.').at(-1)))
    const addressHidden = ['province', 'city', 'district', 'town', 'village', 'address'].some(field => hidden.has(field))
    for (const field of ['province', 'city']) {
      if (query[field] && hidden.has(field)) throw this.createError('无权按已隐藏的地区筛选', 403)
    }
    const addressLevelsReady = query.include_address_levels === '1' && (await this.addresses.capabilities()).ready
    const requestedSearch = String(search_fields || 'name,phone,email,id_card,member_number,address,remarks').split(',').map(field => field.trim())
    const visibleSearch = requestedSearch.filter(field => !hidden.has(field) && !(field === 'address' && addressHidden))
    if (visibleSearch.includes('address') && addressLevelsReady) visibleSearch.push('district', 'town', 'village')
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
        search_fields: visibleSearch.join(',') || '__none__',
        addressLevelsReady,
        register_date_start,
        register_date_end,
        status
      }
    })

    return { data: {
      customers: query.include_address_levels === '1'
        ? await this.addresses.enrich(result.customers || []) : result.customers || [],
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

  async getPointsConfig(query = {}) {
    if (query.include_options !== undefined && query.include_options !== '1' && query.include_options !== 1) throw this.createError('积分设置选项参数无效', 400)
    const config = await this.loadPointsConfig()
    if (query.include_options !== undefined) {
      const categories = await this.accessoryRepository.getProductCategories()
      const products = config.redemption.accessory_ids?.length
        ? (await this.accessoryRepository.getPointsProducts({ ids: config.redemption.accessory_ids, pageSize: 1000 })).data : []
      return { data: { config, products, categories: categories.map(row => ({ id: Number(row.id), name: row.name, status: Number(row.status) })) }, message: '获取积分设置成功' }
    }
    return { data: config, message: '获取积分设置成功' }
  }

  async getPointsProducts(query = {}) {
    const parseIds = (raw, label) => {
      if (typeof raw !== 'string' || !/^\d+(,\d+)*$/.test(raw)) throw this.createError(`${label}参数无效`, 400)
      const ids = raw.split(',').map(Number)
      if (ids.length > 1000 || ids.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647) || new Set(ids).size !== ids.length) throw this.createError(`${label}参数无效`, 400)
      return ids
    }
    const categoryIds = parseIds(query.category_ids, '商品类型')
    const page = query.page === undefined ? 1 : Number(query.page)
    const pageSize = query.page_size === undefined ? 50 : Number(query.page_size)
    if ((query.page !== undefined && !isIntegerInput(query.page)) || (query.page_size !== undefined && !isIntegerInput(query.page_size)) ||
      !Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 100))) throw this.createError('商品检索参数无效', 400)
    const result = await this.accessoryRepository.getPointsProducts({ categoryIds, page, pageSize, search: (query.search || '').trim() })
    return { data: result.data, extra: { pagination: result.pagination }, message: '获取积分商品成功' }
  }

  async savePointsConfig(body) {
    const previous = await this.loadPointsConfig()
    const config = validatePointsConfig(body, previous)
    if (config.redemption.category_ids.length) {
      const categories = await this.accessoryRepository.getProductCategories()
      const previousIds = previous.redemption?.category_ids || []
      if (config.redemption.category_ids.some(id => !categories.some(row => Number(row.id) === id && (Number(row.status) === 1 || previousIds.includes(id))))) throw this.createError('商品类型不存在或已停用，请重新选择', 400)
    }
    if (!config.redemption.all_accessory_categories && config.redemption.accessory_ids?.length) {
      const products = (await this.accessoryRepository.getPointsProducts({ ids: config.redemption.accessory_ids, pageSize: 1000 })).data
      const previousIds = previous.redemption?.accessory_ids || []
      if (config.redemption.accessory_ids.some(id => !products.some(row => Number(row.id) === id &&
        config.redemption.category_ids.includes(Number(row.category_id)) && (Number(row.status) === 1 || previousIds.includes(id))))) {
        throw this.createError('商品不存在、已停用或不属于所选类型，请重新选择', 400)
      }
    }
    const saved = await this.persistPointsConfig(config)
    return { data: saved, message: '积分设置保存成功' }
  }

  async getById(params) {
    
    const customer = await this.repository.findCustomerById(parseInt(params.id))
    if (!customer) throw this.createError('客户不存在', 404)

    return { data: (await this.addresses.enrich([customer]))[0] }
  }

  async getAddressCapabilities() {
    return { data: await this.addresses.capabilities() }
  }

  async create(body) {
    
    const {
      name,
      gender,
      phone: rawPhone,
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

    if (!name || !rawPhone) throw this.createError('缺少必需字段：姓名、手机号', 400)
    if (!isPersonName(name, 50)) throw this.createError('姓名须为1至50字的单行文本', 400)
    if (!isMobilePhone(rawPhone)) throw this.createError('手机号格式不正确', 400)
    const phone = normalizePhone(rawPhone)

    const existingCustomer = await this.repository.findByPhone(phone)
    if (existingCustomer) throw this.createError('手机号已存在', 400)

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw this.createError('邮箱格式不正确', 400)
    }
    if (apple_id && !isValidAppleAccount(apple_id)) {
      throw this.createError('Apple ID 格式不正确，请输入有效的手机号或邮箱（仅支持英文和数字）', 400)
    }

    const addressFields = await this.addresses.prepare(body)
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
      apple_id: apple_id || null,
      ...addressFields
    }, memberNumber)
    return { data: newCustomer, message: '客户创建成功' }
  }

  async update(params, body) {
    
    if (!isIntegerInput(params.id) || Number(params.id) <= 0) throw this.createError('客户ID必须是正整数', 400)
    const customerId = Number(params.id)
    const existingCustomer = await this.repository.findCustomerById(customerId)
    if (!existingCustomer) throw this.createError('客户不存在', 404)

    const {
      name,
      gender,
      phone: rawPhone,
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

    if (name !== undefined && !isPersonName(name, 50)) throw this.createError('姓名须为1至50字的单行文本', 400)
    if (rawPhone !== undefined && !isMobilePhone(rawPhone)) throw this.createError('手机号格式不正确', 400)
    const phone = rawPhone === undefined ? undefined : normalizePhone(rawPhone)
    if (phone !== undefined && phone !== existingCustomer.phone) {
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

    const previousAddress = ['province', 'city', 'district', 'town', 'village'].some(field => body[field] !== undefined)
      ? (await this.addresses.enrich([existingCustomer], { includeLegacy: true }))[0] : existingCustomer
    const updateData = await this.addresses.prepare(body, previousAddress)
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
    if (balance !== undefined) {
      if (!isMoneyInput(balance)) throw this.createError('余额必须是最多两位小数的有效金额', 400)
      if (Object.hasOwn(existingCustomer, 'balance')) {
        if (Number(balance) !== Number(existingCustomer.balance || 0)) throw this.createError('余额变动必须通过账户调整入口，以保留操作明细', 409, 'ACCOUNT_ADJUSTMENT_REQUIRED')
      } else updateData.balance = Number(balance)
    }
    if (points !== undefined) {
      if (!['number', 'string'].includes(typeof points) || !/^\d+$/.test(String(points)) ||
        !Number.isSafeInteger(Number(points)) || Number(points) > 2147483647) throw this.createError('积分必须是有效的非负整数', 400)
      // 原值只用于回显，不随资料保存再次写回，避免覆盖同期销售发放的积分。
      if (Object.hasOwn(existingCustomer, 'points')) {
        if (Number(points) !== Number(existingCustomer.points)) throw this.createError('积分变动必须通过账户调整入口，以保留操作明细；请通过积分核对调整', 409, 'POINTS_ADJUSTMENT_REQUIRED')
      } else updateData.points = Number(points)
    }

    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < 6 || password.length > 128) throw this.createError('密码至少需要6位', 400)
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
    return { data: (await this.addresses.enrich([updatedCustomer]))[0], message: '客户信息更新成功' }
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

  async getAccountLedger(params, query = {}) {
    if (!isIntegerInput(params.id) || Number(params.id) <= 0) throw this.createError('客户ID必须是正整数', 400)
    const customerId = Number(params.id)
    const kind = query.kind === undefined || query.kind === '' ? null : String(query.kind)
    if (kind !== null && !['balance', 'points'].includes(kind)) throw this.createError('账户明细类型无效', 400)
    const records = await this.accountLedger.withConnection(async executor => {
      const [tables] = await executor.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('customer_account_entries','customer_points_entries','customer_points_aftersales','sales_aftersales','sales_aftersale_items')")
      if (!['customer_account_entries', 'customer_points_entries'].every(name => tables.some(row => row.TABLE_NAME === name))) {
        throw this.createError('账户流水结构尚未迁移，请先完成账户流水迁移', 409, 'ACCOUNT_LEDGER_NOT_READY')
      }
      const includeAftersales = tables.some(row => row.TABLE_NAME === 'customer_points_aftersales')
      const includePhoneReturnOperator = ['sales_aftersales', 'sales_aftersale_items'].every(name => tables.some(row => row.TABLE_NAME === name))
      return this.accountLedger.list(executor, customerId, kind, 100, includeAftersales, includePhoneReturnOperator)
    })
    return { data: { records }, message: '账户明细获取成功' }
  }

  async adjustAccount(params, body, actor = {}) {
    if (!isIntegerInput(params.id) || Number(params.id) <= 0) throw this.createError('客户ID必须是正整数', 400)
    const customerId = Number(params.id)
    const kind = body?.kind
    const delta = body?.delta
    if (!['balance', 'points'].includes(kind) || typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0 ||
      (kind === 'points' && (!Number.isSafeInteger(delta) || Math.abs(delta) > 2147483647)) ||
      (kind === 'balance' && Math.abs(Math.round(delta * 100) - delta * 100) > 1e-6)) throw this.createError('账户变动参数无效', 400)
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note || note.length > 500) throw this.createError('请填写账户变动说明（1至500字）', 400)
    return this.repository.withConnection(async executor => {
      await executor.beginTransaction()
      try {
        const [rows] = await executor.execute('SELECT id, balance, points FROM customers WHERE id = ? FOR UPDATE', [customerId])
        const customer = rows[0]
        if (!customer) throw this.createError('客户不存在', 404)
        const beforeBalance = Number(customer.balance || 0), beforePoints = Number(customer.points || 0)
        let afterBalance = beforeBalance, afterPoints = beforePoints, accountEntryId = null
        if (kind === 'points') {
          if (!await this.pointsLedger.ready(executor)) throw this.createError('积分来源账尚未迁移，暂不能人工调整积分', 409)
          afterPoints = beforePoints + delta
          if (afterPoints < 0 || afterPoints > 2147483647) throw this.createError('账户积分不能小于0', 400)
          accountEntryId = await this.accountLedger.append(executor, { customer_id: customerId, kind, delta, balance_after: afterBalance,
            points_after: afterPoints, source_type: 'manual', source_id: null, note, actor_user_id: Number(actor.id) || null })
          const adjusted = await this.pointsLedger.adjustManual(executor, { customerId, delta, entryId: accountEntryId,
            details: { reason: note, operator_id: Number(actor.id) || null } })
          afterPoints = adjusted.balance_after
          await this.accountLedger.linkPointEntry(executor, accountEntryId, adjusted.entry_id)
        } else {
          afterBalance = Math.round((beforeBalance + delta) * 100) / 100
          if (afterBalance < 0) throw this.createError('账户余额不能小于0', 400)
          const [result] = await executor.execute('UPDATE customers SET balance = ?, updated_at = NOW() WHERE id = ? AND balance = ?', [afterBalance, customerId, beforeBalance])
          if (result.affectedRows !== 1) throw Object.assign(new Error('账户已变化，请刷新后重试'), { statusCode: 409 })
        }
        if (!accountEntryId) await this.accountLedger.append(executor, { customer_id: customerId, kind, delta, balance_after: afterBalance,
          points_after: afterPoints, source_type: 'manual', source_id: null, note, actor_user_id: Number(actor.id) || null })
        await executor.commit()
        return { data: { balance: afterBalance, points: afterPoints }, message: '账户变动已记录' }
      } catch (error) { await executor.rollback(); throw error }
    })
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
