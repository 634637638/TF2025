const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, getUserPermissions } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const bcrypt = require('bcryptjs')
const { generateMemberNumber } = require('../utils/member-number')
const log = require('../utils/log')
const { PAGINATION } = require('../config/constants')
const {
  getCustomerPointsConfig,
  saveCustomerPointsConfig
} = require('../services/customer-points.service')

const LEGACY_PERMISSION_CANONICAL_MAP = {
  'customers_customersview:create': 'customers:create',
  'inventory_inventoryview:edit': 'inventory:edit',
  'query_queryview:edit': 'query:edit',
  'sales_salesview:create': 'sales:create',
  'sales_salesview:view': 'sales:view',
  'sales_salesview:edit': 'sales:edit',
  'sales_phonesaleview:create': 'sales:create',
  'sales_phonesaleview:view': 'sales:view',
  'sales_phonesaleview:edit': 'sales:edit',
  'sales_editphoneview:edit': 'sales-editphoneview:edit'
}

const CUSTOMER_CREATE_BYPASS_PERMISSIONS = new Set([
  'sales:create',
  'sales:view',
  'sales:edit',
  'sales-editphoneview:edit',
  'query:edit',
  'inventory:edit'
])

const toCanonicalPermission = (permission = '') => LEGACY_PERMISSION_CANONICAL_MAP[permission] || permission
const APPLE_ACCOUNT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const APPLE_ACCOUNT_PHONE_REGEX = /^1[3-9]\d{9}$/
const isValidAppleAccount = account => (
  typeof account === 'string' &&
  !/[\u4e00-\u9fa5]/.test(account) &&
  (APPLE_ACCOUNT_EMAIL_REGEX.test(account) || APPLE_ACCOUNT_PHONE_REGEX.test(account))
)

const normalizePermissionEntries = (permissions = []) => permissions.map((perm) => {
  if (typeof perm === 'string') {
    return toCanonicalPermission(perm)
  }

  if (perm && perm.module_key && perm.permission_type) {
    return toCanonicalPermission(`${perm.module_key}:${perm.permission_type}`)
  }

  return ''
}).filter(Boolean)

const requireCustomerCreatePermissionForBusinessFlow = async (req, res, next) => {
  try {
    const cachedPermissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
    const dbPermissions = cachedPermissions.length > 0 ? [] : await getUserPermissions(req.user.id)
    const normalizedCachedPermissions = normalizePermissionEntries(cachedPermissions)
    const normalizedPermissions = new Set([
      ...normalizedCachedPermissions,
      ...normalizePermissionEntries(dbPermissions)
    ])

    if (normalizedPermissions.has('customers:create')) {
      return next()
    }

    const hasBusinessBypassPermission = Array.from(normalizedPermissions)
      .some((permission) => CUSTOMER_CREATE_BYPASS_PERMISSIONS.has(permission))

    if (hasBusinessBypassPermission) {
      return next()
    }

    return requirePermission('customers:create')(req, res, next)
  } catch (error) {
    log.error('客户创建权限检查失败:', error)
    return res.status(500).json({
      success: false,
      message: '权限检查失败',
      code: 'PERMISSION_CHECK_FAILED'
    })
  }
}


// 搜索客户（用于模糊搜索）
router.get('/search', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const CustomerRepository = require('../repositories/customer.repository')
    const customerRepo = new CustomerRepository()

    const { keyword, phone } = req.query

    // 如果是手机号查询，使用精确匹配
    if (phone) {
      const customer = await customerRepo.findByPhone(phone)
      if (customer) {
        return ApiResponse.success(res, [customer])
      } else {
        return ApiResponse.success(res, [])
      }
    }

    if (!keyword || keyword.trim().length < 2) {
      return ApiResponse.success(res, [])
    }

    // 使用数据库搜索
    const searchOptions = {
      search: keyword.trim(),
      page_size: 10
    }

    const result = await customerRepo.searchCustomers(searchOptions)
    ApiResponse.success(res, result.records)
  } catch (error) {
    log.error('搜索客户失败:', error)
    ApiResponse.serverError(res, '搜索客户失败', error)
  }
})

// 获取客户列表
router.get('/', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { getDatabase } = require('../config/database')
    const db = getDatabase()

    const {
      page = PAGINATION.DEFAULT_PAGE,
      page_size,
      customer_type,
      vip_level,
      gender,
      city,
      province,
      search,
      register_date_start,
      register_date_end,
      sort_by = 'id',
      sort_order = 'desc',
      status
    } = req.query
    const pageNumber = Math.max(1, Number.parseInt(String(page), 10) || PAGINATION.DEFAULT_PAGE)
    const finalPageSize = Math.min(100, Math.max(1, Number.parseInt(String(page_size), 10) || PAGINATION.DEFAULT_LIMIT))
    const sortableFields = new Set(['id', 'name', 'created_at', 'register_date', 'last_purchase_date'])
    const orderField = sortableFields.has(String(sort_by)) ? String(sort_by) : 'id'
    const orderDirection = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    // 构建查询条件
    const conditions = []
    const params = []

    if (customer_type) {
      conditions.push('customer_type = ?')
      params.push(customer_type)
    }
    if (vip_level) {
      conditions.push('vip_level = ?')
      params.push(vip_level)
    }
    if (gender) {
      conditions.push('gender = ?')
      params.push(gender)
    }
    if (city) {
      conditions.push('city LIKE ?')
      params.push(`%${city}%`)
    }
    if (province) {
      conditions.push('province LIKE ?')
      params.push(`%${province}%`)
    }
    if (register_date_start) {
      conditions.push('register_date >= ?')
      params.push(`${register_date_start} 00:00:00`)
    }
    if (register_date_end) {
      conditions.push('register_date <= ?')
      params.push(`${register_date_end} 23:59:59`)
    }
    // 处理状态筛选
    // status === '' 表示显示所有状态的客户（包括已删除的）
    // status === undefined 表示默认只显示有效客户 (status = 1)
    // status === '0' 或 '1' 表示筛选特定状态
    if (status === '') {
      // 空字符串表示显示所有状态，不添加状态条件
    } else if (status !== undefined) {
      conditions.push('status = ?')
      params.push(parseInt(status) === 0 ? 0 : 1)
    } else {
      // 没有传递status参数时，默认只显示有效客户 (status = 1)
      conditions.push('status = ?')
      params.push(1)
    }

    if (search) {
      // 获取搜索字段配置，如果没有指定则使用默认字段
      const searchFieldsParam = req.query.search_fields
      let searchFields = ['name', 'phone', 'email', 'id_card', 'member_number', 'company_name', 'contact_person', 'address', 'remarks']

      if (searchFieldsParam) {
        searchFields = String(searchFieldsParam).split(',').map(f => f.trim())
      }

      // 构建搜索条件 - 支持多字段模糊搜索
      const dbFieldMap = {
        'name': 'c.name',
        'phone': 'c.phone',
        'email': 'c.email',
        'id_card': 'c.id_card',
        'member_number': 'c.member_number',
        'company_name': 'c.name',
        'contact_person': 'c.name',
        'address': 'c.address',
        'remark': 'c.remarks',
        'remarks': 'c.remarks'
      }
      const validSearchFields = searchFields.filter(field => Object.prototype.hasOwnProperty.call(dbFieldMap, field))
      const searchConditions = validSearchFields.map(field => {
        // 映射前端字段名到数据库字段名
        return `${dbFieldMap[field]} LIKE ?`
      })

      if (searchConditions.length > 0) {
        conditions.push(`(${searchConditions.join(' OR ')})`)
        // 对于所有字段都使用包含匹配
        const searchPattern = `%${search}%`
        validSearchFields.forEach(() => params.push(searchPattern))
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const finalOffset = (pageNumber - 1) * finalPageSize

    // 查询数据 - 包含所有必需字段，并统计每个客户的消费信息
    const query = `
    SELECT c.id, c.name, c.phone, c.email, c.customer_type, c.vip_level, c.gender,
           c.city, c.province, c.balance, c.points, c.status, c.remarks, c.created_at, c.updated_at,
           c.member_number, c.wechat, c.qq, c.apple_id, c.id_card, c.address,
           COALESCE(sales_total.total_amount, 0) as total_spent,
           COALESCE(sales_count.purchase_count, 0) as purchase_count,
           c.last_purchase_date
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, COUNT(*) as purchase_count
      FROM sales
      GROUP BY customer_id
    ) sales_count ON c.id = sales_count.customer_id
    LEFT JOIN (
      SELECT s.customer_id, SUM(s.sale_price) as total_amount
      FROM sales s
      GROUP BY s.customer_id
    ) sales_total ON c.id = sales_total.customer_id
    ${whereClause}
    ORDER BY c.${orderField} ${orderDirection}
    LIMIT ? OFFSET ?
  `

    const [customers] = await db.query(query, [...params, finalPageSize, finalOffset])

    // 查询总数
    const countQuery = `
    SELECT COUNT(*) as total
    FROM customers c
    ${whereClause}
  `
    const [countResult] = await db.query(countQuery, params)
    const total = countResult[0].total

    ApiResponse.success(res, {
      customers: customers || [],
      pagination: {
        page: pageNumber,
        page_size: finalPageSize,
        total,
        total_pages: Math.ceil(total / finalPageSize),
        has_next: pageNumber * finalPageSize < total,
        has_prev: pageNumber > 1
      }
    })
  } catch (error) {
    log.error('获取客户列表失败:', error)
    ApiResponse.serverError(res, '获取客户列表失败', error)
  }
})

// 获取客户统计信息
router.get('/stats', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { getDatabase } = require('../config/database')
    const db = getDatabase()

    // 查询总客户数
    const [totalResult] = await db.query('SELECT COUNT(*) as total FROM customers WHERE status = 1')
    const total_customers = totalResult[0].total

    // 查询活跃客户数（有消费记录的客户）
    const [activeResult] = await db.query(`
      SELECT COUNT(DISTINCT c.id) as active
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE c.status = 1 AND s.id IS NOT NULL
    `)
    const active_customers = activeResult[0].active

    // 查询新客户数（本月新增）
    const [newResult] = await db.query(`
      SELECT COUNT(*) as new_customers
      FROM customers
      WHERE status = 1
        AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    `)
    const new_customers = newResult[0].new_customers

    // 查询VIP客户数（非普通会员）
    const [premiumResult] = await db.query(`
      SELECT COUNT(*) as premium
      FROM customers
      WHERE status = 1 AND vip_level IN ('silver', 'gold', 'platinum')
    `)
    const premium_customers = premiumResult[0].premium

    const stats = {
      total_customers: Number(total_customers) || 0,
      active_customers: Number(active_customers) || 0,
      new_customers: Number(new_customers) || 0,
      premium_customers: Number(premium_customers) || 0
    }

    ApiResponse.success(res, stats)
  } catch (error) {
    log.error('获取客户统计失败:', error)
    ApiResponse.serverError(res, '获取客户统计失败', error)
  }
})

// 获取客户统计信息（详细版本）
router.get('/stats/overview', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { getDatabase } = require('../config/database')
    const db = getDatabase()
    const conditions = ['c.status = 1']
    const params = []
    const startDate = typeof req.query.start_date === 'string' ? req.query.start_date.trim() : ''
    const endDate = typeof req.query.end_date === 'string' ? req.query.end_date.trim() : ''
    if (startDate) {
      conditions.push('c.created_at >= ?')
      params.push(`${startDate} 00:00:00`)
    }
    if (endDate) {
      conditions.push('c.created_at <= ?')
      params.push(`${endDate} 23:59:59`)
    }
    const whereClause = conditions.join(' AND ')
    const [rows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(c.customer_type = 'individual') AS individuals,
        SUM(c.customer_type = 'business') AS business,
        SUM(c.vip_level = 'normal') AS normal_vip,
        SUM(c.vip_level = 'silver') AS silver_vip,
        SUM(c.vip_level = 'gold') AS gold_vip,
        SUM(c.vip_level = 'platinum') AS platinum_vip,
        SUM(c.gender = 'male') AS male,
        SUM(c.gender = 'female') AS female,
        SUM(c.gender IS NULL OR c.gender = '') AS unknown_gender,
        SUM(c.blacklist = 1) AS blacklisted,
        COALESCE(SUM(c.total_spent), 0) AS total_revenue,
        COALESCE(AVG(c.total_spent), 0) AS avg_revenue,
        SUM(c.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS new_customers
      FROM customers c
      WHERE ${whereClause}
    `, params)
    const [cityRows] = await db.query(`
      SELECT COALESCE(NULLIF(c.city, ''), 'unknown') AS city, COUNT(*) AS count
      FROM customers c
      WHERE ${whereClause}
      GROUP BY COALESCE(NULLIF(c.city, ''), 'unknown')
    `, params)
    const [provinceRows] = await db.query(`
      SELECT COALESCE(NULLIF(c.province, ''), 'unknown') AS province, COUNT(*) AS count
      FROM customers c
      WHERE ${whereClause}
      GROUP BY COALESCE(NULLIF(c.province, ''), 'unknown')
    `, params)
    const row = rows[0] || {}
    ApiResponse.success(res, {
      total: Number(row.total) || 0,
      individuals: Number(row.individuals) || 0,
      business: Number(row.business) || 0,
      by_vip_level: {
        normal: Number(row.normal_vip) || 0,
        silver: Number(row.silver_vip) || 0,
        gold: Number(row.gold_vip) || 0,
        platinum: Number(row.platinum_vip) || 0
      },
      by_gender: {
        male: Number(row.male) || 0,
        female: Number(row.female) || 0,
        unknown: Number(row.unknown_gender) || 0
      },
      blacklisted: Number(row.blacklisted) || 0,
      total_revenue: Number(row.total_revenue) || 0,
      avg_revenue: Number(row.avg_revenue) || 0,
      new_customers: Number(row.new_customers) || 0,
      by_city: Object.fromEntries(cityRows.map(item => [item.city, Number(item.count) || 0])),
      by_province: Object.fromEntries(provinceRows.map(item => [item.province, Number(item.count) || 0]))
    })
  } catch (error) {
    log.error('获取客户统计失败:', error)
    ApiResponse.serverError(res, '获取客户统计失败', error)
  }
})

// 获取客户积分自动累计设置
router.get('/points-config', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const config = await getCustomerPointsConfig()
    ApiResponse.success(res, config, '获取积分设置成功')
  } catch (error) {
    log.error('获取客户积分设置失败:', error)
    ApiResponse.serverError(res, '获取客户积分设置失败', error)
  }
})

// 保存客户积分自动累计设置
router.put('/points-config', unifiedAuth, requirePermission('customers:manage'), async (req, res) => {
  try {
    const {
      enabled,
      amount_per_point,
      include_new,
      include_used
    } = req.body || {}

    const amountPerPoint = Number(amount_per_point)
    if (!Number.isFinite(amountPerPoint) || amountPerPoint <= 0) {
      return ApiResponse.badRequest(res, '请输入有效的积分比例金额')
    }

    if (!include_new && !include_used) {
      return ApiResponse.badRequest(res, '全新和二手至少需要选择一种参与积分统计')
    }

    const config = await saveCustomerPointsConfig({
      enabled,
      amount_per_point: amountPerPoint,
      include_new,
      include_used
    })

    ApiResponse.success(res, config, '积分设置保存成功')
  } catch (error) {
    log.error('保存客户积分设置失败:', error)
    ApiResponse.serverError(res, '保存客户积分设置失败', error)
  }
})

// 获取单个客户详情
router.get('/:id', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { id } = req.params
    const CustomerRepository = require('../repositories/customer.repository')
    const customerRepo = new CustomerRepository()

    const customer = await customerRepo.findCustomerById(parseInt(id))

    if (!customer) {
      return ApiResponse.notFound(res, '客户不存在')
    }

    ApiResponse.success(res, customer)
  } catch (error) {
    log.error('获取客户详情失败:', error)
    ApiResponse.serverError(res, '获取客户详情失败', error)
  }
})

// 创建客户
router.post('/', unifiedAuth, requireCustomerCreatePermissionForBusinessFlow, async (req, res) => {
  try {
    const CustomerRepository = require('../repositories/customer.repository')
    const customerRepo = new CustomerRepository()

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

    // 验证必需字段
    if (!name || !phone) {
      return ApiResponse.badRequest(res, '缺少必需字段：姓名、手机号')
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      return ApiResponse.badRequest(res, '手机号格式不正确')
    }

    // 检查手机号是否重复（使用数据库查询）
    const existingCustomer = await customerRepo.findByPhone(phone)
    if (existingCustomer) {
      return ApiResponse.badRequest(res, '手机号已存在')
    }

    // 验证邮箱格式（如果提供）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return ApiResponse.badRequest(res, '邮箱格式不正确')
      }
    }

    // 验证 Apple ID 格式（如果提供）
    if (apple_id) {
      if (!isValidAppleAccount(apple_id)) {
        return ApiResponse.badRequest(res, 'Apple ID 格式不正确，请输入有效的手机号或邮箱（仅支持英文和数字）')
      }
    }

    // 直接使用SQL创建客户（绕过Repository的字段问题）
    const { getDatabase } = require('../config/database')
    const db = getDatabase()

    // 生成会员号
    const memberNumber = await generateMemberNumber()

    const insertQuery = `
      INSERT INTO customers (
        name, gender, phone, email, birthday, id_card,
        address, city, province, customer_type,
        remarks, wechat, qq, apple_id, status, member_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
    `

    const insertValues = [
      name,
      gender || null,
      phone,
      email || null,
      birthday || null,
      id_card || null,
      address || '',
      city || '',
      province || '',
      customer_type || 'individual',
      remarks || '',
      wechat || null,
      qq || null,
      apple_id || null,
      memberNumber
    ]

    const [result] = await db.execute(insertQuery, insertValues)

    // 获取新创建的客户
    const [newCustomerRows] = await db.execute(
      'SELECT id, name, gender, phone, email, birthday, id_card, address, city, province, customer_type, remarks, wechat, qq, apple_id, member_number FROM customers WHERE id = ?',
      [result.insertId]
    )

    const newCustomer = newCustomerRows[0]

    // 返回完整的客户对象（包含数据库自动生成的ID）
    ApiResponse.created(res, '客户创建成功', newCustomer)
  } catch (error) {
    log.error('创建客户失败:', error)
    ApiResponse.serverError(res, '创建客户失败', error)
  }
})

// 更新客户信息 - FIXED VERSION
router.put('/:id', unifiedAuth, requirePermission('customers:edit'), async (req, res) => {
  try {
    const { id } = req.params
    const customerId = parseInt(id, 10)

    // 使用真实数据库操作
    const CustomerRepository = require('../repositories/customer.repository')
    const customerRepo = new CustomerRepository()
    const { getDatabase } = require('../config/database')
    const db = getDatabase()

    // 检查客户是否存在
    const existingCustomer = await customerRepo.findCustomerById(customerId)
    if (!existingCustomer) {
      return ApiResponse.notFound(res, '客户不存在')
    }

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

    // 验证手机号格式（如果提供）
    if (phone && phone !== existingCustomer.phone) {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(phone)) {
        return ApiResponse.badRequest(res, '手机号格式不正确')
      }

      // 检查手机号是否重复
      const existingPhoneCustomer = await customerRepo.findByPhone(phone)
      if (existingPhoneCustomer && existingPhoneCustomer.id !== customerId) {
        return ApiResponse.badRequest(res, '手机号已存在')
      }
    }

    // 验证邮箱格式（如果提供）
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return ApiResponse.badRequest(res, '邮箱格式不正确')
      }
    }

    // 验证 Apple ID 格式（如果提供）
    if (apple_id) {
      if (!isValidAppleAccount(apple_id)) {
        return ApiResponse.badRequest(res, 'Apple ID 格式不正确，请输入有效的手机号或邮箱（仅支持英文和数字）')
      }
    }

    // 构建更新数据，只包含提供的字段
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

    // 处理密码更新（如果提供）
    if (password !== undefined && password !== null && password !== '') {
      // 验证密码长度
      if (password.length < 6) {
        return ApiResponse.badRequest(res, '密码至少需要6位')
      }
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10)
      updateData.password = hashedPassword
    }

    const [columnRows] = await db.query('SHOW COLUMNS FROM customers')
    const availableColumns = new Set(
      Array.isArray(columnRows)
        ? columnRows.map((column) => column.Field).filter(Boolean)
        : []
    )

    if (availableColumns.has('updated_at')) {
      updateData.updated_at = new Date()
    }

    const sanitizedUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([fieldName]) => availableColumns.has(fieldName))
    )

    if (Object.keys(sanitizedUpdateData).length === 0) {
      return ApiResponse.badRequest(res, '没有可更新的字段')
    }

    // 执行更新
    const result = await customerRepo.update(customerId, sanitizedUpdateData)

    if (!result || result.affectedRows === 0) {
      return ApiResponse.notFound(res, '客户不存在或更新失败')
    }

    // 获取更新后的客户信息
    const updatedCustomer = await customerRepo.findCustomerById(customerId)

    ApiResponse.success(res, updatedCustomer, '客户信息更新成功')
  } catch (error) {
    if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
      return ApiResponse.badRequest(res, '手机号已存在')
    }

    log.error('更新客户信息失败:', error)
    ApiResponse.serverError(res, '更新客户信息失败', error)
  }
})

// 删除客户
router.delete('/:id', unifiedAuth, requirePermission('customers:delete'), async (req, res) => {
  try {
    const { id } = req.params

    // 使用真实数据库操作
    const CustomerRepository = require('../repositories/customer.repository')
    const customerRepo = new CustomerRepository()

    const result = await customerRepo.delete(parseInt(id))

    if (!result || result.affectedRows === 0) {
      return ApiResponse.notFound(res, '客户不存在')
    }

    ApiResponse.success(res, { id: parseInt(id), deleted: true }, '客户删除成功')
  } catch (error) {
    log.error('删除客户失败:', error)
    ApiResponse.serverError(res, '删除客户失败', error)
  }
})

// 获取客户消费记录（手机购买记录）
router.get('/:id/purchases', unifiedAuth, requirePermission('customers:view'), async (req, res) => {
  try {
    const { getDatabase } = require('../config/database')
    const db = getDatabase()

    const { id } = req.params
    const { page = 1, page_size, start_date, end_date } = req.query

    // 构建查询条件
    const conditions = ['s.customer_id = ?']
    const params = [parseInt(id)]

    if (start_date) {
      conditions.push('s.sale_time >= ?')
      params.push(`${start_date} 00:00:00`)
    }

    if (end_date) {
      conditions.push('s.sale_time <= ?')
      params.push(`${end_date} 23:59:59`)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    const parsedPage = Math.max(1, Number.parseInt(String(page), 10) || 1)
    const final_page_size = Math.min(100, Math.max(1, Number.parseInt(String(page_size), 10) || 20))
    const offset = (parsedPage - 1) * final_page_size
    const final_offset = parseInt(offset) || 0

    // 查询客户的手机购买记录
    const query = `
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.memory_id,
        b.name as brand,
        m.name as model,
        c.name as color,
        COALESCE(mem.size, '-') as memory,
        s.purchase_cost,
        s.sale_price,
        s.sale_time,
        p.is_new,
        p.status,
        s.id as sale_id,
        s.sale_type,
        s.payment_method,
        s.created_at as sale_created_at,
        u.name as salesperson_name
      FROM sales s
      INNER JOIN phones p ON s.phone_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN users u ON s.operator_id = u.id
      ${whereClause}
      ORDER BY s.sale_time DESC, s.id DESC
      LIMIT ? OFFSET ?
    `

    const [purchases] = await db.query(query, [...params, final_page_size, final_offset])

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales s
      INNER JOIN phones p ON s.phone_id = p.id
      ${whereClause}
    `
    const [countResult] = await db.query(countQuery, params)
    const total = countResult[0].total

    // 格式化返回数据
    const formattedPurchases = purchases.map(p => ({
      id: p.phone_id,
      phone_id: p.phone_id,
      imei: p.imei,
      serial_number: p.serial_number,
      brand: p.brand || '-',
      model: p.model || '-',
      color: p.color || '-',
      memory: p.memory || '-',
      purchase_cost: p.purchase_cost === null ? null : Number(p.purchase_cost),
      sale_price: p.sale_price === null ? null : Number(p.sale_price),
      profit: p.sale_price === null || p.purchase_cost === null
        ? null
        : Number(p.sale_price) - Number(p.purchase_cost),
      sale_time: p.sale_time,
      is_new: p.is_new === 1 ? '全新' : '二手',
      payment_method: p.payment_method || '-',
      salesperson: p.salesperson_name || '-',
      created_at: p.sale_created_at
    }))

    ApiResponse.success(res, {
      purchases: formattedPurchases,
      pagination: {
        page: parsedPage,
        page_size: final_page_size,
        total,
        total_pages: Math.ceil(total / final_page_size),
        has_next: parsedPage * final_page_size < total,
        has_prev: parsedPage > 1
      }
    })
  } catch (error) {
    log.error('获取客户消费记录失败:', error)
    ApiResponse.serverError(res, '获取客户消费记录失败', error)
  }
})

// 消费记录必须通过真实销售事务创建，禁止从客户接口伪造消费流水。
router.post('/:id/purchases', unifiedAuth, requirePermission('customers:edit'), (req, res) => {
  return ApiResponse.error(res, '消费记录请通过销售交易接口创建', 501)
})

// 更新VIP等级
router.patch('/:id/vip-level', unifiedAuth, requirePermission('customers:manage'), async (req, res) => {
  try {
    const { id } = req.params
    const { vip_level } = req.body
    const validLevels = ['normal', 'silver', 'gold', 'platinum']
    if (!validLevels.includes(vip_level)) return ApiResponse.badRequest(res, '无效的VIP等级')

    const { getDatabase } = require('../config/database')
    const db = getDatabase()
    const [result] = await db.execute(
      'UPDATE customers SET vip_level = ?, updated_at = NOW() WHERE id = ? AND status = 1',
      [vip_level, id]
    )
    if (!result.affectedRows) return ApiResponse.notFound(res, '客户不存在')
    const [rows] = await db.execute(
      'SELECT id, name, phone, customer_type, vip_level, status, updated_at FROM customers WHERE id = ?',
      [id]
    )
    ApiResponse.success(res, rows[0], 'VIP等级更新成功')
  } catch (error) {
    log.error('更新VIP等级失败:', error)
    ApiResponse.serverError(res, '更新VIP等级失败', error)
  }
})

module.exports = router
