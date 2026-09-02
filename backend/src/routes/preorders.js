/**
 * 预定管理路由
 * 提供预定单的增删改查、匹配、交付等功能
 * 使用统一的基础数据 ID 和金额字段
 */
const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { ensurePreorderSchema } = require('../utils/preorder-schema')
const dataMaskingService = require('../services/dataMaskingService')

const PREORDER_FIELD_MODULE_KEY = 'preorders_preordersview'
const hasPreorderAction = (req, action) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
  return permissions.includes(`${PREORDER_FIELD_MODULE_KEY}:${action}`) ||
    permissions.includes(`preorders:${action}`)
}
const getPreorderResponseFieldPermissions = async (req) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(
    req.user.id,
    PREORDER_FIELD_MODULE_KEY
  )
  const hiddenFields = new Set(permissions.hiddenFields || [])

  if (['match', 'deliver', 'cancel', 'edit'].some(action => hasPreorderAction(req, action))) {
    hiddenFields.delete('status_info.status')
  }
  if (hasPreorderAction(req, 'deliver')) {
    [
      'product_info.imei',
      'customer_info.customer_name',
      'customer_info.customer_phone',
      'price_info.total_price',
      'price_info.deposit_amount'
    ].forEach(field => hiddenFields.delete(field))
  }

  return { ...permissions, hiddenFields: Array.from(hiddenFields) }
}
const maskPreorderItem = async (item, req) => {
  const permissions = await getPreorderResponseFieldPermissions(req)
  return dataMaskingService.filterSensitiveFields([item], permissions)[0]
}
const maskPreorderList = async (items, req) => {
  const permissions = await getPreorderResponseFieldPermissions(req)
  return dataMaskingService.filterSensitiveFields(items, permissions)
}
const getPreorderHiddenFields = async (req) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(
    req.user.id,
    PREORDER_FIELD_MODULE_KEY
  )
  return new Set(permissions.hiddenFields || [])
}

const PREORDER_WRITE_FIELD_IDS = {
  customer_id: 'customer_info.customer_name',
  store_id: 'store_info.store_name',
  brand_id: 'product_info.brand_name',
  model_id: 'product_info.model_name',
  color_id: 'product_info.color_name',
  memory_id: 'product_info.memory_size',
  is_new: 'product_info.is_new',
  total_price: 'price_info.total_price',
  actual_price: 'price_info.actual_price',
  deposit_amount: 'price_info.deposit_amount',
  expected_arrival: 'time_info.expected_arrival',
  arrival_date: 'time_info.expected_arrival',
  actual_model: 'product_info.model_name',
  remarks: 'other_info.remarks'
}

const rejectHiddenPreorderWriteFields = async (req, res, next) => {
  try {
    const hiddenFields = await getPreorderHiddenFields(req)
    const deniedEntry = Object.entries(PREORDER_WRITE_FIELD_IDS).find(([bodyField, fieldId]) => (
      req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
    ))

    if (!deniedEntry) {
      return next()
    }

    return res.status(403).json({
      success: false,
      message: '不能修改已隐藏的字段',
      code: 'FIELD_PERMISSION_DENIED',
      field: deniedEntry[1]
    })
  } catch (error) {
    return next(error)
  }
}

router.use(async (_req, res, next) => {
  try {
    await ensurePreorderSchema()
    next()
  } catch (error) {
    log.error('预定字段迁移失败:', error)
    ApiResponse.serverError(res, '预定数据结构未就绪')
  }
})

const PREORDER_STATUS = {
  PENDING: 'pending',
  MATCHED: 'arrived',
  DELIVERED: 'completed',
  CANCELLED: 'cancelled'
}

const PREORDER_STATUS_LABELS = {
  [PREORDER_STATUS.PENDING]: '待匹配',
  [PREORDER_STATUS.MATCHED]: '已匹配',
  [PREORDER_STATUS.DELIVERED]: '已交付',
  [PREORDER_STATUS.CANCELLED]: '已取消'
}

const PREORDER_STATUS_VALUES = new Set(Object.values(PREORDER_STATUS))
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const isValidDateOnly = (value) => {
  if (!DATE_ONLY_PATTERN.test(String(value || ''))) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

// 预定业务内部只读取规范列，避免 SELECT * 将迁移中的历史列重新带回业务层。
const PREORDER_CORE_FIELDS = [
  'id', 'customer_id', 'store_id', 'brand_id', 'model_id', 'color_id', 'memory_id',
  'is_new', 'expected_arrival', 'total_price', 'actual_price',
  'deposit_amount', 'deposit_paid', 'status', 'remarks', 'created_by',
  'matched_phone_id', 'imei', 'matched_time', 'created_at', 'updated_at'
]

// 公开给列表、详情和恢复接口的字段；禁止使用 p.* 将历史列带回响应。
const PREORDER_RESPONSE_FIELDS = [
  ...PREORDER_CORE_FIELDS,
  'preorder_number', 'operator_id', 'actual_model', 'arrival_date',
  'cancelled_at', 'cancel_reason', 'delivered_time', 'sale_id'
]

const normalizePreorderStatus = (status) => {
  if (!status) {
    return null
  }

  const normalizedStatus = String(status).trim()
  return PREORDER_STATUS_VALUES.has(normalizedStatus) ? normalizedStatus : null
}

/**
 * 获取预定单列表
 * GET /api/preorders
 */
router.get('/', unifiedAuth, requirePermission('preorders:view'), async (req, res) => {
  let connection
  try {
    // 处理查询参数，确保正确处理 undefined
    const page = req.query.page && req.query.page !== 'undefined' ? req.query.page : 1
    const pageSize = req.query.page_size ?? 20
    const status = req.query.status && req.query.status !== 'undefined' && req.query.status !== 'null' ? req.query.status : null
    const customer_id = req.query.customer_id && req.query.customer_id !== 'undefined' ? req.query.customer_id : null
    const search = req.query.search && req.query.search !== 'undefined' ? req.query.search : null
    const startDate = req.query.start_date && req.query.start_date !== 'undefined' ? req.query.start_date : null
    const endDate = req.query.end_date && req.query.end_date !== 'undefined' ? req.query.end_date : null

    if ((startDate && !isValidDateOnly(startDate)) || (endDate && !isValidDateOnly(endDate))) {
      return ApiResponse.badRequest(res, '日期格式必须为 YYYY-MM-DD')
    }

    if (startDate && endDate && startDate > endDate) {
      return ApiResponse.badRequest(res, '开始日期不能晚于结束日期')
    }

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 构建查询条件
    const whereConditions = ['1=1']
    const params = []

    // 状态筛选 - 映射前端状态值到数据库状态值
    const normalizedStatus = normalizePreorderStatus(status)

    if (status && !normalizedStatus) {
      return ApiResponse.badRequest(res, '预定状态无效')
    }

    if (normalizedStatus) {
      whereConditions.push('p.status = ?')
      params.push(normalizedStatus)
    } else {
      whereConditions.push(`p.status IN ('${PREORDER_STATUS.PENDING}', '${PREORDER_STATUS.MATCHED}', '${PREORDER_STATUS.CANCELLED}')`)
    }

    // 客户筛选
    if (customer_id) {
      whereConditions.push('p.customer_id = ?')
      params.push(customer_id)
    }

    // 搜索功能（客户姓名、预定单号、手机型号）
    if (search) {
      whereConditions.push(`(
        c.name LIKE ? OR
        c.phone LIKE ? OR
        p.preorder_number LIKE ? OR
        CONCAT(
          COALESCE(br.name, ''),
          ' ',
          COALESCE(mo.name, ''),
          ' ',
          COALESCE(co.name, ''),
          ' ',
          COALESCE(me.size, '')
        ) LIKE ?
      )`)
      const searchParam = `%${search}%`
      params.push(searchParam, searchParam, searchParam, searchParam)
    }

    // 日期范围筛选
    if (startDate) {
      whereConditions.push('p.created_at >= ?')
      params.push(startDate)
    }

    if (endDate) {
      whereConditions.push('p.created_at < DATE_ADD(?, INTERVAL 1 DAY)')
      params.push(endDate)
    }

    const whereClause = whereConditions.join(' AND ')

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      WHERE ${whereClause}
    `

    const [countResult] = await connection.execute(countQuery, params)
    const total = countResult[0].total

    // 分页查询
    const parsedPage = Math.min(100000, Math.max(1, parseInt(page, 10) || 1))
    const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const offset = (parsedPage - 1) * parsedPageSize

    const query = `
      SELECT
        ${PREORDER_RESPONSE_FIELDS.map(field => `p.${field}`).join(',\n        ')},
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as operator_name,
        st.name as store_name,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        ph.supplier_id,
        s.name as supplier_name,
        CASE
          WHEN p.status = '${PREORDER_STATUS.PENDING}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.PENDING]}'
          WHEN p.status = '${PREORDER_STATUS.MATCHED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.MATCHED]}'
          WHEN p.status = '${PREORDER_STATUS.DELIVERED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.DELIVERED]}'
          WHEN p.status = '${PREORDER_STATUS.CANCELLED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.CANCELLED]}'
          ELSE p.status
        END as status_text,
        CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
        CASE
          WHEN p.actual_price IS NOT NULL THEN p.actual_price - p.deposit_amount
          ELSE NULL
        END as remaining_amount
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      LEFT JOIN phones ph ON p.matched_phone_id = ph.id
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      WHERE ${whereClause}
      ORDER BY
        p.status = '${PREORDER_STATUS.PENDING}' DESC,
        p.created_at DESC
      LIMIT ? OFFSET ?
    `

    const finalParams = [...params, String(parsedPageSize), String(offset)]
    const [records] = await connection.execute(query, finalParams)

    const visibleRecords = await maskPreorderList(records, req)
    ApiResponse.success(res, {
      records: visibleRecords,
      pagination: {
        page: parsedPage,
        page_size: parsedPageSize,
        total: parseInt(total) || 0,
        total_pages: Math.ceil((parseInt(total) || 0) / parsedPageSize),
        has_next: parsedPage * parsedPageSize < (parseInt(total) || 0),
        has_prev: parsedPage > 1
      }
    })
  } catch (error) {
    log.error('获取预定单列表失败:', error)
    ApiResponse.serverError(res, '获取预定单列表失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 获取预定单统计信息
 * GET /api/preorders/stats
 */
router.get('/stats', unifiedAuth, requirePermission('preorders:view'), async (req, res) => {
  let connection
  try {
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    const statsQuery = `
      SELECT
        SUM(CASE WHEN status = '${PREORDER_STATUS.PENDING}' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = '${PREORDER_STATUS.MATCHED}' THEN 1 ELSE 0 END) as matched_count,
        SUM(CASE WHEN status = '${PREORDER_STATUS.DELIVERED}' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = '${PREORDER_STATUS.CANCELLED}' THEN 1 ELSE 0 END) as cancelled_count
      FROM preorders
    `

    const [statsResult] = await connection.execute(statsQuery)
    const stats = statsResult[0]

    const visibleStats = await maskPreorderItem({
      pending_count: parseInt(stats.pending_count) || 0,
      matched_count: parseInt(stats.matched_count) || 0,
      delivered_count: parseInt(stats.delivered_count) || 0,
      cancelled_count: parseInt(stats.cancelled_count) || 0
    }, req)
    ApiResponse.success(res, visibleStats)
  } catch (error) {
    log.error('获取预定统计失败:', error)
    ApiResponse.serverError(res, '获取预定统计失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 获取新建/编辑预订单所需的基础选项。
 * 预订单不应依赖库存或店铺管理页面权限才能填写商品信息。
 * GET /api/preorders/options
 */
router.get('/options', unifiedAuth, requireAnyPermission(['preorders:view', 'preorders:create']), async (req, res) => {
  let connection
  try {
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    const [[stores], [brands], [models], [colors], [memories]] = await Promise.all([
      connection.query(
        'SELECT id, name, sort_order FROM stores WHERE status = 1 ORDER BY sort_order ASC, name ASC, id ASC'
      ),
      connection.query(
        'SELECT id, name, sort_order FROM brands ORDER BY sort_order ASC, name ASC, id ASC'
      ),
      connection.query(
        'SELECT id, name, brand_id, sort_order FROM models ORDER BY brand_id ASC, sort_order ASC, name ASC, id ASC'
      ),
      connection.query(
        'SELECT id, name, sort_order FROM colors ORDER BY sort_order ASC, name ASC, id ASC'
      ),
      connection.query(
        'SELECT id, size, sort_order FROM memories ORDER BY sort_order ASC, size ASC, id ASC'
      )
    ])

    return ApiResponse.success(res, { stores, brands, models, colors, memories })
  } catch (error) {
    log.error('获取预订单基础选项失败:', error)
    return ApiResponse.serverError(res, '获取预订单基础选项失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 查找待匹配的预定单（用于入库时自动匹配）
 * GET /api/preorders/matchable
 * 参数: brand_id, model_id, color_id, memory_id
 */
router.get('/matchable', unifiedAuth, requirePermission('preorders:match'), async (req, res) => {
  let connection
  try {
    const {
      brand_id,
      model_id,
      color_id,
      memory_id,
      store_id
    } = req.query

    const hasIdMatchParams = brand_id && model_id && color_id && memory_id
    if (!hasIdMatchParams) {
      return ApiResponse.badRequest(res, '请提供完整商品ID')
    }

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    const whereConditions = [`p.status = '${PREORDER_STATUS.PENDING}'`]
    const matchConditions = []
    const params = []

    if (hasIdMatchParams) {
      matchConditions.push(`
        (
          p.brand_id = ?
          AND p.model_id = ?
          AND p.color_id = ?
          AND p.memory_id = ?
        )
      `)
      params.push(brand_id, model_id, color_id, memory_id)
    }

    if (matchConditions.length === 0) {
      return ApiResponse.badRequest(res, '缺少有效的匹配条件')
    }

    whereConditions.push(`(${matchConditions.join(' OR ')})`)

    if (store_id) {
      whereConditions.push('(p.store_id IS NULL OR p.store_id = ?)')
      params.push(store_id)
    }

    const query = `
      SELECT
        p.id,
        p.preorder_number,
        p.customer_id,
        p.brand_id,
        p.model_id,
        p.color_id,
        p.memory_id,
        c.name as customer_name,
        c.phone as customer_phone,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
        p.deposit_amount,
        p.total_price,
        p.created_at,
        DATEDIFF(COALESCE(p.expected_arrival, DATE_ADD(p.created_at, INTERVAL 30 DAY)), CURDATE()) as days_remaining,
        u.name as operator_name
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.created_at ASC
      LIMIT 10
    `

    const [preorders] = await connection.execute(query, params)

    ApiResponse.success(res, await maskPreorderList(preorders, req))
  } catch (error) {
    log.error('查找可匹配预定单失败:', error)
    ApiResponse.serverError(res, '查找可匹配预定单失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 获取某待匹配预定单可选的在库设备
 * GET /api/preorders/:id/matchable-phones
 */
router.get('/:id/matchable-phones', unifiedAuth, requirePermission('preorders:match'), async (req, res) => {
  let connection
  try {
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    const [preorders] = await connection.execute(
      `SELECT id, status, brand_id, model_id, color_id, memory_id, is_new
       FROM preorders
       WHERE id = ?`,
      [req.params.id]
    )

    if (preorders.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在')
    }

    const preorder = preorders[0]
    if (preorder.status !== PREORDER_STATUS.PENDING) {
      return ApiResponse.badRequest(res, '只有待匹配的预定单可以选择设备')
    }

    const [phones] = await connection.execute(
      `SELECT
         p.id,
         p.imei,
         p.serial_number,
         p.sale_price,
         p.is_new,
         b.name AS brand_name,
         m.name AS model_name,
         c.name AS color_name,
         mem.size AS memory_size,
         st.name AS store_name
       FROM phones p
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN models m ON p.model_id = m.id
       LEFT JOIN colors c ON p.color_id = c.id
       LEFT JOIN memories mem ON p.memory_id = mem.id
       LEFT JOIN stores st ON p.store_id = st.id
       WHERE p.status = 'in_stock'
         AND COALESCE(p.is_preordered, 0) = 0
         AND p.brand_id = ?
         AND p.model_id = ?
         AND p.color_id = ?
         AND p.memory_id = ?
         AND p.is_new = ?
       ORDER BY p.inventory_time ASC, p.id ASC
       LIMIT 100`,
      [
        preorder.brand_id,
        preorder.model_id,
        preorder.color_id,
        preorder.memory_id,
        Number(preorder.is_new) === 0 ? 0 : 1
      ]
    )

    return ApiResponse.success(res, await maskPreorderList(phones, req))
  } catch (error) {
    log.error('获取可匹配库存失败:', error)
    return ApiResponse.serverError(res, '获取可匹配库存失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 获取单个预定单详情
 * GET /api/preorders/:id
 */
router.get('/:id', unifiedAuth, requirePermission('preorders:view'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    const query = `
      SELECT
        ${PREORDER_RESPONSE_FIELDS.map(field => `p.${field}`).join(',\n        ')},
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as operator_name,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        CASE
          WHEN p.status = '${PREORDER_STATUS.PENDING}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.PENDING]}'
          WHEN p.status = '${PREORDER_STATUS.MATCHED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.MATCHED]}'
          WHEN p.status = '${PREORDER_STATUS.DELIVERED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.DELIVERED]}'
          WHEN p.status = '${PREORDER_STATUS.CANCELLED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.CANCELLED]}'
          ELSE p.status
        END as status_text,
        CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
        CASE
          WHEN p.actual_price IS NOT NULL THEN p.actual_price - p.deposit_amount
          ELSE NULL
        END as remaining_amount
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      WHERE p.id = ?
    `

    const [records] = await connection.execute(query, [id])

    if (records.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在')
    }

    ApiResponse.success(res, await maskPreorderItem(records[0], req))
  } catch (error) {
    log.error('获取预定单详情失败:', error)
    ApiResponse.serverError(res, '获取预定单详情失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 创建预定单
 * POST /api/preorders
 */
router.post('/', unifiedAuth, requirePermission('preorders:create'), rejectHiddenPreorderWriteFields, async (req, res) => {
  let connection
  try {
    const {
      customer_id,
      store_id,
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new,
      total_price,
      deposit_amount,
      expected_arrival,
      remarks
    } = req.body

    const legacyFields = ['expected_price', 'advance_payment', 'deposit', 'phone_model', 'color', 'storage', 'notes']
    const receivedLegacyField = legacyFields.find(field => Object.prototype.hasOwnProperty.call(req.body || {}, field))
    if (receivedLegacyField) {
      return ApiResponse.badRequest(res, `字段 ${receivedLegacyField} 已废弃，请使用统一字段`)
    }

    // 使用前端传来的店铺ID，如果没有则使用用户的主店铺
    const finalStoreId = store_id ?? req.user?.store_id ?? null
    const normalizedCondition = Number(is_new)
    const normalizedDepositAmount = Number(deposit_amount)
    const normalizedTotalPrice = total_price === undefined || total_price === null || total_price === ''
      ? null
      : Number(total_price)
    // 数据库中的预计到货日期为必填字段；表单允许不填写时按当天处理。
    const normalizedExpectedArrival = expected_arrival || new Date().toISOString().slice(0, 10)

    if (![0, 1].includes(normalizedCondition)) {
      return ApiResponse.badRequest(res, '机况必须为全新或二手')
    }

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 数据验证
    if (!customer_id) {
      return ApiResponse.badRequest(res, '请选择客户')
    }

    if (!brand_id || !model_id || !color_id || !memory_id) {
      return ApiResponse.badRequest(res, '请完整选择商品信息（品牌、型号、颜色、内存）')
    }

    // 定金必填
    if (!Number.isFinite(normalizedDepositAmount) || normalizedDepositAmount <= 0) {
      return ApiResponse.badRequest(res, '请输入有效的定金金额')
    }

    if (normalizedTotalPrice !== null && (!Number.isFinite(normalizedTotalPrice) || normalizedTotalPrice < 0)) {
      return ApiResponse.badRequest(res, '销售价格格式不正确')
    }

    if (expected_arrival && !isValidDateOnly(expected_arrival)) {
      return ApiResponse.badRequest(res, '预计到货日期格式必须为 YYYY-MM-DD')
    }

    // 验证客户是否存在
    const [customerResult] = await connection.execute(
      'SELECT id FROM customers WHERE id = ?',
      [customer_id]
    )

    if (customerResult.length === 0) {
      return ApiResponse.notFound(res, '客户不存在')
    }

    // 验证商品信息是否存在
    const [brandResult] = await connection.execute('SELECT id, name FROM brands WHERE id = ?', [brand_id])
    if (brandResult.length === 0) {
      return ApiResponse.notFound(res, '品牌不存在')
    }

    const [modelResult] = await connection.execute('SELECT id, name FROM models WHERE id = ?', [model_id])
    if (modelResult.length === 0) {
      return ApiResponse.notFound(res, '型号不存在')
    }

    const [colorResult] = await connection.execute('SELECT id, name FROM colors WHERE id = ?', [color_id])
    if (colorResult.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在')
    }

    const [memoryResult] = await connection.execute('SELECT id, size FROM memories WHERE id = ?', [memory_id])
    if (memoryResult.length === 0) {
      return ApiResponse.notFound(res, '内存不存在')
    }

    // 生成预定单号 (PR + 年月日时分秒)
    const now = new Date()
    const preorderNumber = `PR${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

    // 获取当前用户ID和店铺ID
    const userId = req.user?.sub || req.user?.id
    await connection.beginTransaction()

    try {
      // 检查是否有匹配的库存手机
      log.debug('🔍 开始查找匹配的库存手机:', {
        brand_id,
        model_id,
        color_id,
        memory_id,
        预订店铺: finalStoreId,
        说明: '不限制库存商品所在店铺'
      })

      const [matchingPhones] = await connection.execute(
        `SELECT id, imei, purchase_cost, store_id
         FROM phones
         WHERE brand_id = ?
           AND model_id = ?
           AND color_id = ?
           AND memory_id = ?
           AND is_new = ?
           AND status = 'in_stock'
           AND COALESCE(is_preordered, 0) = 0
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE`,
        [brand_id, model_id, color_id, memory_id, normalizedCondition]
      )

      log.debug('📦 匹配查询结果:', {
        找到数量: matchingPhones.length,
        手机信息: matchingPhones.length > 0 ? matchingPhones[0] : null
      })

      let initialStatus = PREORDER_STATUS.PENDING
      let matchedPhoneId = null
      let matchedImei = null

      // 如果找到匹配的手机，自动匹配
      if (matchingPhones.length > 0) {
        const matchedPhone = matchingPhones[0]
        initialStatus = PREORDER_STATUS.MATCHED
        matchedPhoneId = matchedPhone.id
        matchedImei = matchedPhone.imei

        log.debug('✅ 自动匹配成功:', {
          phone_id: matchedPhoneId,
          imei: matchedImei
        })

        // 标记手机为已预定
        const [phoneUpdate] = await connection.execute(
          `UPDATE phones
           SET is_preordered = 1
           WHERE id = ? AND status = 'in_stock' AND COALESCE(is_preordered, 0) = 0`,
          [matchedPhoneId]
        )

        if (phoneUpdate.affectedRows !== 1) {
          throw new Error('匹配设备已被占用')
        }
      } else {
        log.debug('⚠️ 未找到匹配的库存手机')
      }

      // 插入预定单
      const [insertResult] = await connection.execute(
        `INSERT INTO preorders (
          preorder_number, customer_id, store_id,
          brand_id, model_id, color_id, memory_id, is_new,
          deposit_amount, deposit_paid, total_price, expected_arrival,
          status, remarks, operator_id, created_by, matched_phone_id, imei, matched_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          preorderNumber,
          customer_id,
          finalStoreId || null,
          brand_id,
          model_id,
          color_id,
          memory_id,
          normalizedCondition,
          normalizedDepositAmount,
          normalizedDepositAmount, // deposit_paid 默认等于 deposit_amount
          normalizedTotalPrice,
          normalizedExpectedArrival,
          initialStatus,
          remarks || null,
          userId,
          userId,
          matchedPhoneId,
          matchedImei,
          initialStatus === PREORDER_STATUS.MATCHED ? new Date() : null
        ]
      )

      const preorderId = insertResult.insertId

      await connection.commit()

      const visiblePreorder = await maskPreorderItem({
        id: preorderId,
        preorder_number: preorderNumber,
        auto_matched: initialStatus === PREORDER_STATUS.MATCHED,
        matched_phone_id: matchedPhoneId,
        imei: matchedImei
      }, req)
      ApiResponse.success(res, visiblePreorder, initialStatus === PREORDER_STATUS.MATCHED
        ? '预定单创建成功，已自动匹配并预留库存，尚未出库'
        : '预定单创建成功')

    } catch (dbError) {
      await connection.rollback()
      throw dbError
    }

  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    log.error('创建预定单失败:', error)
    ApiResponse.serverError(res, '创建预定单失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 匹配预定单（将手机分配给预定单）
 * PUT /api/preorders/:id/match
 */
router.put('/:id/match', unifiedAuth, requirePermission('preorders:match'), rejectHiddenPreorderWriteFields, async (req, res) => {
  let connection
  try {
    const { id } = req.params
    const { phone_id, imei, actual_model, arrival_date, actual_price } = req.body

    if (!phone_id && !imei) {
      return ApiResponse.badRequest(res, '请选择要匹配的手机或输入IMEI')
    }

    if (arrival_date && !isValidDateOnly(arrival_date)) {
      return ApiResponse.badRequest(res, '到货日期格式必须为 YYYY-MM-DD')
    }

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    await connection.beginTransaction()

    const [preorderResult] = await connection.execute(
      `SELECT ${PREORDER_CORE_FIELDS.join(', ')} FROM preorders WHERE id = ? FOR UPDATE`,
      [id]
    )

    if (preorderResult.length === 0) {
      await connection.rollback()
      return ApiResponse.notFound(res, '预定单不存在')
    }

    const preorder = preorderResult[0]
    if (preorder.status !== PREORDER_STATUS.PENDING) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '只有待匹配的预定单可以匹配设备')
    }

    const phoneWhere = phone_id ? 'p.id = ?' : 'p.imei = ?'
    const phoneValue = phone_id || String(imei).trim()
    const [phoneResult] = await connection.execute(
      `SELECT
         p.id, p.imei, p.brand_id, p.model_id, p.color_id, p.memory_id,
         p.is_new, p.status, p.is_preordered, p.sale_price, p.purchase_cost,
         b.name AS brand_name, m.name AS model_name
       FROM phones p
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN models m ON p.model_id = m.id
       WHERE ${phoneWhere}
       FOR UPDATE`,
      [phoneValue]
    )

    if (phoneResult.length === 0) {
      await connection.rollback()
      return ApiResponse.notFound(res, '设备不存在')
    }

    const phone = phoneResult[0]
    if (phone.status !== 'in_stock' || Number(phone.is_preordered) === 1) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '设备已售出或已被其他预定单占用')
    }

    const exactMatch =
      Number(phone.brand_id) === Number(preorder.brand_id) &&
      Number(phone.model_id) === Number(preorder.model_id) &&
      Number(phone.color_id) === Number(preorder.color_id) &&
      Number(phone.memory_id) === Number(preorder.memory_id) &&
      Number(phone.is_new) === Number(preorder.is_new)

    if (!exactMatch) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '设备的品牌、型号、颜色、内存或机况与预定单不一致')
    }

    const requestedPrice = actual_price === undefined || actual_price === null || actual_price === ''
      ? null
      : Number(actual_price)
    if (requestedPrice !== null && (!Number.isFinite(requestedPrice) || requestedPrice < 0)) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '销售价格格式不正确')
    }

    const fallbackPrice = Number(preorder.total_price || phone.sale_price || 0)
    const finalPrice = requestedPrice !== null ? requestedPrice : fallbackPrice
    const depositAmount = Number(preorder.deposit_amount || preorder.deposit_paid || 0)
    const remainingAmount = Math.max(0, finalPrice - depositAmount)
    const resolvedModel = actual_model || [phone.brand_name, phone.model_name].filter(Boolean).join(' ')

    await connection.execute(
      `UPDATE preorders SET
         status = '${PREORDER_STATUS.MATCHED}',
         matched_phone_id = ?,
         imei = ?,
         actual_model = ?,
         arrival_date = COALESCE(?, CURDATE()),
         actual_price = ?,
         matched_time = NOW(),
         updated_at = NOW()
       WHERE id = ?`,
      [phone.id, phone.imei, resolvedModel || null, arrival_date || null, finalPrice, id]
    )

    const [phoneUpdate] = await connection.execute(
      `UPDATE phones
       SET is_preordered = 1
       WHERE id = ? AND status = 'in_stock' AND COALESCE(is_preordered, 0) = 0`,
      [phone.id]
    )

    if (phoneUpdate.affectedRows !== 1) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '设备已被其他预定单占用，请重新选择')
    }

    await connection.commit()

    const visiblePreorder = await maskPreorderItem({
      id: parseInt(id),
      matched_phone_id: phone.id,
      imei: phone.imei,
      actual_model: resolvedModel,
      actual_price: finalPrice,
      remaining_amount: remainingAmount
    }, req)
    return ApiResponse.success(res, visiblePreorder, '预定单匹配成功，库存已预留，尚未出库')

  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    log.error('匹配预定单失败:', error)
    ApiResponse.serverError(res, '匹配预定单失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 完成交付（标记为已交付）
 * PUT /api/preorders/:id/deliver
 */
router.put('/:id/deliver', unifiedAuth, requirePermission('preorders:deliver'), rejectHiddenPreorderWriteFields, async (req, res) => {
  let connection
  try {
    const { id } = req.params
    const { actual_price, remarks } = req.body

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    await connection.beginTransaction()

    try {
      // 检查预定单状态
      const [preorderResult] = await connection.execute(
        `SELECT ${PREORDER_CORE_FIELDS.join(', ')} FROM preorders WHERE id = ?`,
        [id]
      )

      if (preorderResult.length === 0) {
        await connection.rollback()
        return ApiResponse.notFound(res, '预定单不存在')
      }

      const preorder = preorderResult[0]

      if (preorder.status !== PREORDER_STATUS.MATCHED) {
        await connection.rollback()
        return ApiResponse.badRequest(res, '只有已匹配的预定单可以交付')
      }

      // 如果有IMEI，更新对应的手机状态为已售出
      if (preorder.imei) {
        await connection.execute(
          `UPDATE phones SET
            status = 'sold',
            sale_time = NOW()
          WHERE imei = ? AND status = 'in_stock'`,
          [preorder.imei]
        )
      }

      const finalPrice = actual_price || preorder.actual_price || preorder.total_price

      // 更新预定单状态
      await connection.execute(
        `UPDATE preorders SET
          status = '${PREORDER_STATUS.DELIVERED}',
          actual_price = ?,
          remarks = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [finalPrice, remarks || preorder.remarks, id]
      )

      await connection.commit()

      const visiblePreorder = await maskPreorderItem({
        id: parseInt(id),
        actual_price: finalPrice,
        message: '预定单交付成功'
      }, req)
      ApiResponse.success(res, visiblePreorder, '预定单交付成功')

    } catch (dbError) {
      await connection.rollback()
      throw dbError
    }

  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    log.error('完成预定单交付失败:', error)
    ApiResponse.serverError(res, '完成预定单交付失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 取消预定单
 * PUT /api/preorders/:id/cancel
 */
router.put('/:id/cancel', unifiedAuth, requirePermission('preorders:cancel'), async (req, res) => {
  let connection
  try {
    const { id } = req.params
    const { reason } = req.body

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    await connection.beginTransaction()

    try {
      // 检查预定单状态
      const [preorderResult] = await connection.execute(
        `SELECT ${PREORDER_CORE_FIELDS.join(', ')} FROM preorders WHERE id = ?`,
        [id]
      )

      if (preorderResult.length === 0) {
        await connection.rollback()
        return ApiResponse.notFound(res, '预定单不存在')
      }

      const preorder = preorderResult[0]

      if (preorder.status === PREORDER_STATUS.CANCELLED) {
        await connection.rollback()
        return ApiResponse.badRequest(res, '预定单已被取消')
      }

      if (preorder.status === PREORDER_STATUS.DELIVERED) {
        await connection.rollback()
        return ApiResponse.badRequest(res, '已交付的预定单不能取消')
      }

      // 如果已匹配手机，释放手机（通过 matched_phone_id）
      if (preorder.matched_phone_id) {
        await connection.execute(
          'UPDATE phones SET is_preordered = 0 WHERE id = ?',
          [preorder.matched_phone_id]
        )
      }

      // 更新预定单状态
      await connection.execute(
        `UPDATE preorders SET
          status = '${PREORDER_STATUS.CANCELLED}',
          cancelled_at = NOW(),
          cancel_reason = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [reason || null, id]
      )

      await connection.commit()

      ApiResponse.success(res, {
        id: parseInt(id),
        message: '预定单取消成功'
      }, '预定单取消成功')

    } catch (dbError) {
      await connection.rollback()
      throw dbError
    }

  } catch (error) {
    if (connection) {
      try { await connection.rollback() } catch (e) {}
    }
    log.error('取消预定单失败:', error)
    ApiResponse.serverError(res, '取消预定单失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 更新预定单
 * PUT /api/preorders/:id
 */
router.put('/:id', unifiedAuth, requirePermission('preorders:edit'), rejectHiddenPreorderWriteFields, async (req, res) => {
  let connection
  try {
    const { id } = req.params

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 检查预定单是否存在
    const [existingRecords] = await connection.execute(
      'SELECT id, status FROM preorders WHERE id = ?',
      [id]
    )

    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在')
    }

    const preorder = existingRecords[0]

    // 只允许编辑待匹配状态的预定单
    if (preorder.status !== PREORDER_STATUS.PENDING) {
      return ApiResponse.badRequest(res, '只能编辑待匹配状态的预定单')
    }

    const updateData = req.body
    const updateFields = []
    const updateValues = []

    const legacyFields = ['expected_price', 'advance_payment', 'deposit', 'phone_model', 'color', 'storage', 'notes', 'customer_name', 'customer_phone']
    const receivedLegacyField = legacyFields.find(field => Object.prototype.hasOwnProperty.call(updateData || {}, field))
    if (receivedLegacyField) {
      return ApiResponse.badRequest(res, `字段 ${receivedLegacyField} 已废弃，请使用统一字段`)
    }

    if (updateData.expected_arrival && !isValidDateOnly(updateData.expected_arrival)) {
      return ApiResponse.badRequest(res, '预计到货日期格式必须为 YYYY-MM-DD')
    }

    if (updateData.is_new !== undefined && ![0, 1].includes(Number(updateData.is_new))) {
      return ApiResponse.badRequest(res, '机况必须为全新或二手')
    }

    if (updateData.deposit_amount !== undefined) {
      const normalizedDepositAmount = Number(updateData.deposit_amount)
      if (!Number.isFinite(normalizedDepositAmount) || normalizedDepositAmount <= 0) {
        return ApiResponse.badRequest(res, '请输入有效的定金金额')
      }
      updateData.deposit_amount = normalizedDepositAmount
    }

    if (updateData.total_price !== undefined && updateData.total_price !== null && updateData.total_price !== '') {
      const normalizedTotalPrice = Number(updateData.total_price)
      if (!Number.isFinite(normalizedTotalPrice) || normalizedTotalPrice < 0) {
        return ApiResponse.badRequest(res, '销售价格格式不正确')
      }
      updateData.total_price = normalizedTotalPrice
    }

    // 只允许统一字段进入预定 CRUD。
    const allowedFields = [
      'customer_id', 'store_id', 'brand_id', 'model_id', 'color_id', 'memory_id', 'is_new',
      'expected_arrival', 'total_price', 'deposit_amount', 'remarks'
    ]

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`)
        updateValues.push(updateData[field])
      }
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段')
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(id)

    const updateQuery = `
      UPDATE preorders
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `

    await connection.execute(updateQuery, updateValues)

    // 获取更新后的记录
    const [updatedRecords] = await connection.execute(`
      SELECT ${PREORDER_CORE_FIELDS.join(', ')} FROM preorders WHERE id = ?
    `, [id])

    ApiResponse.success(res, await maskPreorderItem(updatedRecords[0], req), '预定单更新成功')
  } catch (error) {
    log.error('更新预定单失败:', error)
    ApiResponse.serverError(res, '更新预定单失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 恢复已取消的预定单
 * PUT /api/preorders/:id/restore
 */
router.put('/:id/restore', unifiedAuth, requirePermission('preorders:edit'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 检查预定单是否存在
    const [existingRecords] = await connection.execute(
      'SELECT id, status, preorder_number FROM preorders WHERE id = ?',
      [id]
    )

    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在')
    }

    const preorder = existingRecords[0]

    // 只允许恢复已取消的预定单
    if (preorder.status !== PREORDER_STATUS.CANCELLED) {
      return ApiResponse.badRequest(res, '只能恢复已取消状态的预定单')
    }

    // 恢复预定单状态为待匹配
    await connection.execute(
      `UPDATE preorders SET status = '${PREORDER_STATUS.PENDING}', cancelled_at = NULL, cancel_reason = NULL, updated_at = NOW() WHERE id = ?`,
      [id]
    )

    // 获取更新后的记录
    const [updatedRecords] = await connection.execute(`
      SELECT
        ${PREORDER_RESPONSE_FIELDS.map(field => `p.${field}`).join(',\n        ')},
        c.name as customer_name,
        c.phone as customer_phone,
        u.name as operator_name,
        st.name as store_name,
        br.name as brand_name,
        mo.name as model_name,
        co.name as color_name,
        me.size as memory_size,
        ph.supplier_id,
        s.name as supplier_name,
        CASE
          WHEN p.status = '${PREORDER_STATUS.PENDING}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.PENDING]}'
          WHEN p.status = '${PREORDER_STATUS.MATCHED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.MATCHED]}'
          WHEN p.status = '${PREORDER_STATUS.DELIVERED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.DELIVERED]}'
          WHEN p.status = '${PREORDER_STATUS.CANCELLED}' THEN '${PREORDER_STATUS_LABELS[PREORDER_STATUS.CANCELLED]}'
          ELSE p.status
        END as status_text
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON p.operator_id = u.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      LEFT JOIN phones ph ON p.matched_phone_id = ph.id
      LEFT JOIN suppliers s ON ph.supplier_id = s.id
      WHERE p.id = ?
    `, [id])

    ApiResponse.success(res, await maskPreorderItem(updatedRecords[0], req), '预定单已恢复')
  } catch (error) {
    log.error('恢复预定单失败:', error)
    ApiResponse.serverError(res, '恢复预定单失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

/**
 * 删除预定单
 * DELETE /api/preorders/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('preorders:delete'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 检查预定单是否存在
    const [existingRecords] = await connection.execute(
      'SELECT status FROM preorders WHERE id = ?',
      [id]
    )

    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '预定单不存在')
    }

    const preorder = existingRecords[0]

    // 只允许删除已取消或已交付的预定单
    if (preorder.status !== PREORDER_STATUS.CANCELLED && preorder.status !== PREORDER_STATUS.DELIVERED) {
      return ApiResponse.badRequest(res, '只能删除已取消或已交付的预定单')
    }

    // 删除预定单
    await connection.execute('DELETE FROM preorders WHERE id = ?', [id])

    ApiResponse.success(res, {
      id: parseInt(id),
      deleted: true
    }, '预定单删除成功')
  } catch (error) {
    log.error('删除预定单失败:', error)
    ApiResponse.serverError(res, '删除预定单失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

module.exports = router
