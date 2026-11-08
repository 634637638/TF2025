const BaseRepository = require('./base.repository')
const log = require('../utils/log')

const CUSTOMER_SELECT_FIELDS = `
  id, name, phone, email, customer_type, vip_level, gender, birthday,
  id_card, address, city, province, balance, points, wechat, qq, apple_id,
  member_number, status, remarks, blacklist, total_spent, last_purchase_date,
  register_date, created_at, updated_at
`

class CustomerRepository extends BaseRepository {
  constructor() {
    super('customers')
  }

  async createCustomerProfile(customerData, memberNumber) {
    const [result] = await this.executePrepared(`
      INSERT INTO customers (
        name, gender, phone, email, birthday, id_card,
        address, city, province, customer_type,
        remarks, wechat, qq, apple_id, status, member_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
    `, [
      customerData.name,
      customerData.gender,
      customerData.phone,
      customerData.email,
      customerData.birthday,
      customerData.id_card,
      customerData.address,
      customerData.city,
      customerData.province,
      customerData.customer_type,
      customerData.remarks,
      customerData.wechat,
      customerData.qq,
      customerData.apple_id,
      memberNumber
    ])
    const [rows] = await this.executePrepared(
      'SELECT id, name, gender, phone, email, birthday, id_card, address, city, province, customer_type, remarks, wechat, qq, apple_id, member_number FROM customers WHERE id = ?',
      [result.insertId]
    )
    return rows[0]
  }

  async getCustomerColumns() {
    const columns = await this.executeQuery('SHOW COLUMNS FROM customers')
    return new Set(columns.map(column => column.Field).filter(Boolean))
  }

  /**
   * 创建客户
   * @param {Object} customerData - 客户数据
   * @returns {number} 新增记录的ID
   */
  async createCustomer(customerData) {
    try {
      const {
        name,
        phone,
        id_card,
        address,
        member_number,
        balance = 0,
        points = 0,
        wechat,
        qq,
        apple_id,
        status = 1,
        remarks
      } = customerData

      // 确保所有undefined值转换为null
      const data = {
        name: name || null,
        phone: phone || null,
        id_card: id_card || null,
        address: address || null,
        member_number: member_number || null,
        balance: balance || 0,
        points: points || 0,
        wechat: wechat || null,
        qq: qq || null,
        apple_id: apple_id || null,
        status: status || 1,
        remarks: remarks || null
      }

      log.debug(`创建客户参数 [${this.tableName}]:`, data)

      // 使用BaseRepository的create方法
      const result = await this.create(data)

      log.info(`创建客户成功 [${this.tableName}]，ID: ${result.id}`)
      return result
    } catch (error) {
      log.error('创建客户失败:', error)
      throw error
    }
  }

  /**
   * 根据手机号查找客户
   * @param {string} phone - 手机号
   * @returns {Object|null} 客户信息
   */
  async findCustomerByPhone(phone) {
    try {
      log.debug(`开始查询客户 [${this.tableName}]，手机号: ${phone}`)

      // 使用BaseRepository的executeQuery方法
      const records = await this.executeQuery(
        `SELECT ${CUSTOMER_SELECT_FIELDS} FROM ${this.tableName} WHERE phone = ? AND status = 1`,
        [phone]
      )

      // 安全地访问 records.length
      const recordCount = (records && Array.isArray(records)) ? records.length : 0
      log.info(`客户查询成功 [${this.tableName}]，找到 ${recordCount} 条记录`)

      if (recordCount > 0) {
        // 删除调试日志

      }

      return (recordCount > 0) ? records[0] : null
    } catch (error) {
      log.error('根据手机号查找客户失败:', error)
      throw error
    }
  }

  /**
   * 根据ID查找客户
   * @param {number} id - 客户ID
   * @returns {Object|null} 客户信息
   */
  async findCustomerById(id) {
    try {
      log.debug(`根据ID查找客户 [${this.tableName}]，ID: ${id}`)
      const query = `SELECT ${CUSTOMER_SELECT_FIELDS} FROM ${this.tableName} WHERE id = ? AND status = 1`
      const records = await this.executeQuery(query, [id])

      // 删除调试日志
      if (!records) {
        log.warn('查询返回 null')
        return null
      }

      if (!Array.isArray(records)) {
        log.warn('查询返回非数组结果:', records)
        // 尝试将单个对象转换为数组
        return typeof records === 'object' ? records : null
      }

      if (records.length === 0) {
        log.warn(`未找到客户，ID: ${id}`)
        return null
      }

      // 删除调试日志
      return records[0]
    } catch (error) {
      log.error('根据ID查找客户失败:', error)
      throw error
    }
  }

  /**
   * 获取客户列表
   * @param {Object} filters - 筛选条件
   * @returns {Object} 客户列表和分页信息
   */
  async getCustomers(filters = {}) {
    try {
      const {
        name,
        phone,
        page = 1,
        page_size = 20
      } = filters

      const pageNumber = Math.max(1, parseInt(page, 10) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(page_size, 10) || 20))
      const offset = (pageNumber - 1) * pageSize

      // 构建查询条件
      const conditions = ['status = 1']
      const params = []

      if (name) {
        conditions.push('name LIKE ?')
        params.push(`%${name}%`)
      }

      if (phone) {
        conditions.push('phone LIKE ?')
        params.push(`%${phone}%`)
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      // 查询数据
      const query = `
        SELECT
          id, name, phone, id_card, address, member_number, balance, points,
          wechat, qq, apple_id, status, remarks, last_purchase_date, created_at
        FROM ${this.tableName}
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `

      const dataParams = [...params, pageSize, parseInt(offset)]
      const records = await this.executeQuery(query, dataParams)

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.tableName}
        ${whereClause}
      `
      const [countResult] = await this.executeQuery(countQuery, params)
      const total = countResult.total

      return {
        records,
        pagination: {
          page: pageNumber,
          page_size: pageSize,
          total,
          total_pages: Math.ceil(total / pageSize),
          has_next: pageNumber * pageSize < total,
          has_prev: pageNumber > 1
        }
      }
    } catch (error) {
      log.error('获取客户列表失败:', error)
      throw error
    }
  }

  async getCustomerPurchases(customerId, { start_date, end_date, page_size, offset }) {
    const conditions = ['s.customer_id = ?']
    const params = [customerId]
    if (start_date) {
      conditions.push('s.sale_time >= ?')
      params.push(`${start_date} 00:00:00`)
    }
    if (end_date) {
      conditions.push('s.sale_time <= ?')
      params.push(`${end_date} 23:59:59`)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    const purchases = await this.executeQuery(`
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
    `, [...params, page_size, offset])
    const [countResult] = await this.executeQuery(`
      SELECT COUNT(*) as total
      FROM sales s
      INNER JOIN phones p ON s.phone_id = p.id
      ${whereClause}
    `, params)

    return { purchases, total: countResult.total }
  }

  async listCustomers({ page, page_size, sort_by, sort_order, filters }) {
    const conditions = []
    const params = []
    const exactFilters = ['customer_type', 'vip_level', 'gender']
    for (const field of exactFilters) {
      if (filters[field]) {
        conditions.push(`c.${field} = ?`)
        params.push(filters[field])
      }
    }
    for (const field of ['city', 'province']) {
      if (filters[field]) {
        conditions.push(`c.${field} LIKE ?`)
        params.push(`%${filters[field]}%`)
      }
    }
    if (filters.register_date_start) {
      conditions.push('c.register_date >= ?')
      params.push(`${filters.register_date_start} 00:00:00`)
    }
    if (filters.register_date_end) {
      conditions.push('c.register_date <= ?')
      params.push(`${filters.register_date_end} 23:59:59`)
    }
    if (filters.status === '') {
      // An empty status explicitly requests all records, including disabled customers.
    } else if (filters.status !== undefined) {
      conditions.push('c.status = ?')
      params.push(parseInt(filters.status) === 0 ? 0 : 1)
    } else {
      conditions.push('c.status = ?')
      params.push(1)
    }

    if (filters.search) {
      const requestedFields = filters.search_fields
        ? String(filters.search_fields).split(',').map(field => field.trim())
        : ['name', 'phone', 'email', 'id_card', 'member_number', 'company_name', 'contact_person', 'address', 'remarks']
      const fieldMap = {
        name: 'c.name',
        phone: 'c.phone',
        email: 'c.email',
        id_card: 'c.id_card',
        member_number: 'c.member_number',
        company_name: 'c.name',
        contact_person: 'c.name',
        address: 'c.address',
        remark: 'c.remarks',
        remarks: 'c.remarks'
      }
      const selectedFields = requestedFields.filter(field => Object.prototype.hasOwnProperty.call(fieldMap, field))
      if (selectedFields.length > 0) {
        conditions.push(`(${selectedFields.map(field => `${fieldMap[field]} LIKE ?`).join(' OR ')})`)
        params.push(...selectedFields.map(() => `%${filters.search}%`))
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortableFields = new Set(['id', 'name', 'created_at', 'register_date', 'last_purchase_date'])
    const orderField = sortableFields.has(String(sort_by)) ? String(sort_by) : 'id'
    const orderDirection = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const offset = (page - 1) * page_size
    const customers = await this.executeQuery(`
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
    `, [...params, page_size, offset])
    const [countResult] = await this.executeQuery(`
      SELECT COUNT(*) as total
      FROM customers c
      ${whereClause}
    `, params)

    return { customers, total: countResult.total }
  }

  /**
   * 更新客户信息
   * @param {number} id - 客户ID
   * @param {Object} customerData - 更新数据
   * @returns {boolean} 是否成功
   */
  async updateCustomer(id, customerData) {
    try {
      const {
        name,
        phone,
        id_card,
        address,
        member_number,
        balance,
        points,
        wechat,
        qq,
        apple_id,
        status,
        remarks
      } = customerData

      const query = `
        UPDATE ${this.tableName} SET
          name = ?, phone = ?, id_card = ?, address = ?, member_number = ?,
          balance = ?, points = ?, wechat = ?, qq = ?, apple_id = ?,
          status = ?, remarks = ?, updated_at = NOW()
        WHERE id = ?
      `

      const params = [
        name, phone, id_card, address, member_number,
        balance, points, wechat, qq, apple_id,
        status, remarks, id
      ]

      const result = await this.executeQuery(query, params)
      return result.affectedRows > 0
    } catch (error) {
      log.error('更新客户信息失败:', error)
      throw error
    }
  }

  /**
   * 删除客户（软删除）
   * @param {number} id - 客户ID
   * @returns {boolean} 是否成功
   */
  async deleteCustomer(id) {
    try {
      const query = `UPDATE ${this.tableName} SET status = 0, updated_at = NOW() WHERE id = ?`
      const result = await this.executeQuery(query, [id])
      return result.affectedRows > 0
    } catch (error) {
      log.error('删除客户失败:', error)
      throw error
    }
  }

  /**
   * 更新客户积分
   * @param {number} id - 客户ID
   * @param {number} points - 积分变化量（增量，可正可负）
   * @returns {boolean} 是否成功
   */
  async updateCustomerPoints(id, points) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET points = points + ?, updated_at = NOW()
        WHERE id = ?
      `
      const result = await this.executeQuery(query, [points, id])
      return result.affectedRows > 0
    } catch (error) {
      log.error('更新客户积分失败:', error)
      throw error
    }
  }

  /**
   * 更新客户余额
   * @param {number} id - 客户ID
   * @param {number} balance - 新余额（绝对值）
   * @returns {boolean} 是否成功
   */
  async updateCustomerBalance(id, balance) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET balance = ?, updated_at = NOW()
        WHERE id = ?
      `
      const result = await this.executeQuery(query, [balance, id])
      return result.affectedRows > 0
    } catch (error) {
      log.error('更新客户余额失败:', error)
      throw error
    }
  }

  /**
   * 更新客户Apple ID
   * @param {number} id - 客户ID
   * @param {string} appleId - Apple ID
   * @returns {boolean} 是否成功
   */
  async updateCustomerAppleId(id, appleId) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET apple_id = ?, updated_at = NOW()
        WHERE id = ?
      `
      const result = await this.executeQuery(query, [appleId, id])
      return result.affectedRows > 0
    } catch (error) {
      log.error('更新客户Apple ID失败:', error)
      throw error
    }
  }

  /**
   * 根据手机号查找客户（别名方法，保持兼容性）
   * @param {string} phone - 手机号
   * @returns {Object|null} 客户信息
   */
  async findByPhone(phone) {
    return await this.findCustomerByPhone(phone)
  }

  async updateVipLevel(id, vipLevel) {
    const [result] = await this.executeQuery(
      'UPDATE customers SET vip_level = ?, updated_at = NOW() WHERE id = ? AND status = 1',
      [vipLevel, id]
    )
    if (!result?.affectedRows) return null

    const rows = await this.executeQuery(
      'SELECT id, name, phone, customer_type, vip_level, status, updated_at FROM customers WHERE id = ?',
      [id]
    )
    return rows[0] || null
  }

  async getStatistics({
    customer_type,
    vip_level,
    search,
    search_fields,
    register_date_start,
    register_date_end,
    status
  } = {}) {
    const conditions = []
    const params = []

    if (customer_type) {
      conditions.push('c.customer_type = ?')
      params.push(customer_type)
    }
    if (vip_level) {
      conditions.push('c.vip_level = ?')
      params.push(vip_level)
    }
    if (register_date_start) {
      conditions.push('c.register_date >= ?')
      params.push(`${register_date_start} 00:00:00`)
    }
    if (register_date_end) {
      conditions.push('c.register_date <= ?')
      params.push(`${register_date_end} 23:59:59`)
    }
    if (status !== '') {
      if (status !== undefined) {
        conditions.push('c.status = ?')
        params.push(parseInt(status) === 0 ? 0 : 1)
      } else {
        conditions.push('c.status = ?')
        params.push(1)
      }
    }
    if (search) {
      const fieldMap = {
        name: 'c.name', phone: 'c.phone', email: 'c.email', id_card: 'c.id_card',
        member_number: 'c.member_number', company_name: 'c.name',
        contact_person: 'c.name', address: 'c.address', remark: 'c.remarks', remarks: 'c.remarks'
      }
      const fields = String(search_fields || 'name,phone,email,id_card,member_number,company_name,contact_person,address,remarks')
        .split(',')
        .map(field => fieldMap[field.trim()])
        .filter(Boolean)
      if (fields.length) {
        conditions.push(`(${fields.map(field => `${field} LIKE ?`).join(' OR ')})`)
        params.push(...fields.map(() => `%${search}%`))
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [totalRows, activeRows, newRows, premiumRows] = await Promise.all([
      this.executeQuery(`SELECT COUNT(*) AS total FROM customers c ${whereClause}`, params),
      this.executeQuery(`
        SELECT COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN c.id END) AS active
        FROM customers c LEFT JOIN sales s ON c.id = s.customer_id ${whereClause}
      `, params),
      this.executeQuery(`
        SELECT COUNT(*) AS new_customers FROM customers c
        ${whereClause} ${whereClause ? 'AND' : 'WHERE'} c.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      `, params),
      this.executeQuery(`
        SELECT COUNT(*) AS premium FROM customers c
        ${whereClause} ${whereClause ? 'AND' : 'WHERE'} c.vip_level IN ('silver', 'gold', 'platinum')
      `, params)
    ])

    return {
      total_customers: Number(totalRows[0]?.total) || 0,
      active_customers: Number(activeRows[0]?.active) || 0,
      new_customers: Number(newRows[0]?.new_customers) || 0,
      premium_customers: Number(premiumRows[0]?.premium) || 0
    }
  }

  async getStatisticsOverview({ start_date, end_date } = {}) {
    const conditions = ['c.status = 1']
    const params = []
    const startDate = typeof start_date === 'string' ? start_date.trim() : ''
    const endDate = typeof end_date === 'string' ? end_date.trim() : ''
    if (startDate) {
      conditions.push('c.created_at >= ?')
      params.push(`${startDate} 00:00:00`)
    }
    if (endDate) {
      conditions.push('c.created_at <= ?')
      params.push(`${endDate} 23:59:59`)
    }
    const whereClause = conditions.join(' AND ')
    const rows = await this.executeQuery(`
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
    const cityRows = await this.executeQuery(`
      SELECT COALESCE(NULLIF(c.city, ''), 'unknown') AS city, COUNT(*) AS count
      FROM customers c
      WHERE ${whereClause}
      GROUP BY COALESCE(NULLIF(c.city, ''), 'unknown')
    `, params)
    const provinceRows = await this.executeQuery(`
      SELECT COALESCE(NULLIF(c.province, ''), 'unknown') AS province, COUNT(*) AS count
      FROM customers c
      WHERE ${whereClause}
      GROUP BY COALESCE(NULLIF(c.province, ''), 'unknown')
    `, params)
    const row = rows[0] || {}

    return {
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
    }
  }

  /**
   * 搜索客户（用于模糊搜索）
   * @param {Object} options - 搜索选项
   * @returns {Object} 搜索结果
   */
  async searchCustomers(options = {}) {
    try {
      const { search, page_size = 10 } = options
      const pageSize = Math.min(100, Math.max(1, parseInt(page_size, 10) || 10))

      if (!search || search.trim().length < 2) {
        return { records: [] }
      }

      const query = `
        SELECT
          id, name, phone, id_card, address, member_number, balance, points,
          wechat, qq, apple_id, status, created_at, customer_type, vip_level,
          gender, city, province, birthday, email
        FROM ${this.tableName}
        WHERE status = 1 AND (
          name LIKE ? OR
          phone LIKE ? OR
          id_card LIKE ? OR
          email LIKE ? OR
          address LIKE ?
        )
        ORDER BY created_at DESC
        LIMIT ?
      `

      const searchPattern = `%${search.trim()}%`
      const records = await this.executeQuery(query, [
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
        pageSize
      ])

      return { records: records || [] }
    } catch (error) {
      log.error('搜索客户失败:', error)
      throw error
    }
  }

  /**
   * 使用选项获取客户列表（支持更多筛选条件）
   * @param {Object} options - 查询选项
   * @param {Object} filters - 筛选条件
   * @returns {Object} 客户列表和分页信息
   */
  async getCustomersWithOptions(options = {}, filters = {}) {
    try {
      const {
        page = 1,
        page_size = 10,
        sort_by = 'id',
        sort_order = 'desc'
      } = options

      const {
        customer_type,
        vip_level,
        gender,
        city,
        province,
        status,
        search,
        register_date_start,
        register_date_end
      } = filters

      const pageNumber = Math.max(1, parseInt(page, 10) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(page_size, 10) || 10))
      const offset = (pageNumber - 1) * pageSize

      // 构建查询条件
      const conditions = []
      const params = []

      // 默认只显示有效客户，除非明确指定了状态
      if (status !== undefined && status !== '' && status !== null) {
        conditions.push('status = ?')
        params.push(parseInt(status) === 0 ? 0 : 1) // 确保只有 0 或 1 两个值
      } else {
        conditions.push('status = ?')
        params.push(1)
      }

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

      if (search) {
        conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR id_card LIKE ?)')
        const searchPattern = `%${search}%`
        params.push(searchPattern, searchPattern, searchPattern, searchPattern)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // 查询数据 - 简化和修复查询逻辑
      const finalPageSize = pageSize
      const finalOffset = parseInt(offset) || 0
      const sortableFields = new Set(['id', 'name', 'created_at', 'register_date', 'last_purchase_date'])
      const orderField = sortableFields.has(sort_by) ? sort_by : 'id'
      const orderDirection = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

      const query = `
        SELECT
          id, name, phone, email, customer_type, vip_level, gender, birthday,
          city, province, balance, points, wechat, qq, apple_id, member_number,
          id_card, address, status, remarks, blacklist, total_spent, last_purchase_date,
          register_date, created_at, updated_at
        FROM ${this.tableName}
        ${whereClause}
        ORDER BY ${orderField} ${orderDirection}
        LIMIT ? OFFSET ?
      `

      log.debug('客户查询调试信息:')
      log.debug('  query:', query)
      log.debug('  page_size:', finalPageSize, 'offset:', finalOffset)

      let records
      try {
        // 使用参数化查询确保安全性
        records = await this.executeQuery(query, [...params, finalPageSize, finalOffset])
        // 确保 records 是数组
        if (!Array.isArray(records)) {
          log.warn('查询返回非数组结果，转换为数组:', records)
          records = records ? [records] : []
        }
        log.success('客户查询成功，记录数:', records.length)
      } catch (error) {
        log.fail('查询失败，尝试简化查询:', error.message)

        // 备用方案：简化查询
        const simpleQuery = `
          SELECT id, name, phone, email, customer_type, vip_level, gender, birthday,
                 city, province, balance, points, wechat, qq, apple_id, member_number,
                 id_card, address, status, remarks, blacklist, total_spent, last_purchase_date,
                 register_date, created_at, updated_at
          FROM ${this.tableName}
          ${whereClause}
          ORDER BY ${orderField} ${orderDirection}
          LIMIT ? OFFSET ?
        `

        records = await this.executeQuery(simpleQuery, [...params, finalPageSize, finalOffset])
        // 确保 records 是数组
        if (!Array.isArray(records)) {
          log.warn('简化查询返回非数组结果，转换为数组:', records)
          records = records ? [records] : []
        }
        log.success('简化查询成功，记录数:', records.length)
      }

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.tableName}
        ${whereClause}
      `
      const [countResult] = await this.executeQuery(countQuery, params)
      const total = countResult.total

      return {
        records: records || [],
        pagination: {
          page: pageNumber,
          page_size: pageSize,
          total,
          total_pages: Math.ceil(total / pageSize),
          has_next: pageNumber * pageSize < total,
          has_prev: pageNumber > 1
        }
      }
    } catch (error) {
      log.error('获取客户列表失败:', error)
      throw error
    }
  }
}

module.exports = CustomerRepository
