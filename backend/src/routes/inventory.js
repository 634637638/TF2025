const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const { getDatabase, isConnected } = require('../config/database')
const { validateImei } = require('../utils/imei')
const { normalizeDateTime } = require('../utils/time')
const { generateMemberNumber } = require('../utils/member-number')
const log = require('../utils/log')
const {
  COMPLETED_TRANSACTION_STATUSES,
  getEffectivePhoneStatusSql
} = require('../utils/phone-status')
const COMPLETED_TRANSACTION_STATUS_SQL = `COALESCE(status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`

// 统计卡片使用与库存列表相同的筛选条件，确保统计结果和列表保持一致。
const buildInventoryStatsWhere = query => {
  const {
    store_id,
    supplier_id,
    operator_id,
    status,
    search,
    brand,
    model,
    color,
    memory,
    is_new,
    date_start,
    date_end
  } = query

  const effectiveStatusSql = getEffectivePhoneStatusSql('p')
  // 库存页展示所有尚未销售的设备；业务状态由状态字段和预订标记共同决定。
  const whereConditions = [`COALESCE(p.status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`]
  const queryParams = [...COMPLETED_TRANSACTION_STATUSES]

  if (store_id) {
    whereConditions.push('p.store_id = ?')
    queryParams.push(parseInt(store_id))
  }
  if (supplier_id) {
    whereConditions.push('p.supplier_id = ?')
    queryParams.push(parseInt(supplier_id))
  }
  if (operator_id) {
    whereConditions.push('p.inventory_operator_id = ?')
    queryParams.push(parseInt(operator_id))
  }
  if (status) {
    whereConditions.push(`${effectiveStatusSql} = ?`)
    queryParams.push(status)
  }
  if (brand) {
    whereConditions.push('b.name = ?')
    queryParams.push(brand)
  }
  if (model) {
    whereConditions.push('m.name = ?')
    queryParams.push(model)
  }
  if (color) {
    whereConditions.push('co.name = ?')
    queryParams.push(color)
  }
  if (memory) {
    whereConditions.push('mem.size = ?')
    queryParams.push(memory)
  }
  if (is_new !== undefined && is_new !== null && is_new !== '') {
    const isNewValue = is_new === 'true' || is_new === true || is_new === '1'
    whereConditions.push('p.is_new = ?')
    queryParams.push(isNewValue ? 1 : 0)
  }

  if (date_start || date_end) {
    if (date_start && date_end) {
      whereConditions.push('DATE(p.inventory_time) BETWEEN ? AND ?')
      queryParams.push(date_start, date_end)
    } else if (date_start) {
      whereConditions.push('DATE(p.inventory_time) >= ?')
      queryParams.push(date_start)
    } else {
      whereConditions.push('DATE(p.inventory_time) <= ?')
      queryParams.push(date_end)
    }
  }

  if (search) {
    const searchStr = search.trim()
    if (/^\d{15}$/.test(searchStr)) {
      whereConditions.push('p.imei = ?')
      queryParams.push(searchStr)
    } else if (/^[A-Za-z0-9]{8,}$/.test(searchStr)) {
      whereConditions.push('UPPER(p.serial_number) LIKE ?')
      queryParams.push(`%${searchStr.toUpperCase()}%`)
    } else if (/^(\d+[Gg][Bb]|1[Tt][Bb])$/.test(searchStr)) {
      whereConditions.push('UPPER(mem.size) LIKE ?')
      queryParams.push(`%${searchStr.toUpperCase()}%`)
    } else if (['available', 'in_stock', 'sold', 'reserved', 'repair', 'rented', 'lost'].includes(searchStr.toLowerCase())) {
      whereConditions.push(`${effectiveStatusSql} = ?`)
      queryParams.push(searchStr.toLowerCase() === 'available' ? 'in_stock' : searchStr.toLowerCase())
    } else if (['可用', '可售', '已售', '预定', '预订', '维修', '租赁', '丢失', '在库'].includes(searchStr)) {
      const statusMap = {
        '可用': 'in_stock',
        '可售': 'in_stock',
        '已售': 'sold',
        '预定': 'reserved',
        '预订': 'reserved',
        '维修': 'repair',
        '租赁': 'rented',
        '丢失': 'lost',
        // “在库” is the user-facing label for the canonical sellable state.
        '在库': 'in_stock'
      }
      whereConditions.push(`${effectiveStatusSql} = ?`)
      queryParams.push(statusMap[searchStr])
    } else if (['new', 'used', '全新', '二手'].includes(searchStr.toLowerCase())) {
      const isNew = ['new', '全新'].includes(searchStr.toLowerCase())
      whereConditions.push('p.is_new = ?')
      queryParams.push(isNew ? 1 : 0)
    } else if (/^[A-C]$/.test(searchStr.toUpperCase())) {
      whereConditions.push('UPPER(p.quality_grade) = ?')
      queryParams.push(searchStr.toUpperCase())
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(searchStr)) {
      whereConditions.push('(DATE(p.inventory_time) = ? OR DATE(p.sale_time) = ?)')
      queryParams.push(searchStr, searchStr)
    } else if (/^\d+$/.test(searchStr)) {
      whereConditions.push(`(
        p.imei LIKE ? OR
        p.serial_number LIKE ? OR
        p.purchase_number LIKE ? OR
        p.sale_price = ? OR
        p.purchase_cost = ? OR
        CAST(p.id AS CHAR) LIKE ?
      )`)
      const searchTerm = `%${searchStr}%`
      const price = parseFloat(searchStr)
      queryParams.push(searchTerm, searchTerm, searchTerm, price, price, searchTerm)
    } else {
      whereConditions.push(`(
        p.imei LIKE ? OR
        p.serial_number LIKE ? OR
        b.name LIKE ? OR
        m.name LIKE ? OR
        co.name LIKE ? OR
        mem.size LIKE ? OR
        p.status LIKE ? OR
        p.quality_grade LIKE ? OR
        p.remarks LIKE ? OR
        st.name LIKE ? OR
        s.name LIKE ? OR
        p.purchase_number LIKE ?
      )`)
      const searchTerm = `%${searchStr}%`
      queryParams.push(...Array(12).fill(searchTerm))
    }
  }

  return {
    whereClause: `WHERE ${whereConditions.join(' AND ')}`,
    queryParams
  }
}

// 获取库存列表
router.get('/list', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  let connection
  try {
    const { getDatabase } = require('../config/database')
    const pool = getDatabase()

    if (!pool) {
      return ApiResponse.error(res, '数据库连接池未初始化', 500)
    }

    connection = await pool.getConnection()

    const {
      page = 1,
      page_size,
      limit = 20,
      store_id,
      supplier_id,
      operator_id,
      status,
      search,
      brand,
      model,
      color,
      memory,
      is_new,
      date,
      date_start,
      date_end
    } = req.query

    const validLimit = Math.min(Math.max(parseInt(page_size ?? limit) || 10, 1), 100)
    const validPage = Math.max(parseInt(page) || 1, 1)
    const offset = (validPage - 1) * validLimit

    // 构建WHERE条件
    const effectiveStatusSql = getEffectivePhoneStatusSql('p')
    // 不隐藏维修、租赁、丢失、损坏等状态，库存页需要保留完整设备台账。
    const whereConditions = [`COALESCE(p.status, '') NOT IN (${COMPLETED_TRANSACTION_STATUSES.map(() => '?').join(', ')})`]
    const queryParams = [...COMPLETED_TRANSACTION_STATUSES]

    // 店铺筛选
    if (store_id) {
      whereConditions.push('p.store_id = ?')
      queryParams.push(parseInt(store_id))
    }

    // 供应商筛选
    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?')
      queryParams.push(parseInt(supplier_id))
    }

    // 入库员筛选
    if (operator_id) {
      whereConditions.push('p.inventory_operator_id = ?')
      queryParams.push(parseInt(operator_id))
    }

    // 状态筛选
    if (status) {
      whereConditions.push(`${effectiveStatusSql} = ?`)
      queryParams.push(status)
    }

    // 品牌筛选
    if (brand) {
      whereConditions.push('b.name = ?')
      queryParams.push(brand)
    }

    // 型号筛选
    if (model) {
      whereConditions.push('m.name = ?')
      queryParams.push(model)
    }

    // 颜色筛选
    if (color) {
      whereConditions.push('co.name = ?')
      queryParams.push(color)
    }

    // 内存筛选
    if (memory) {
      whereConditions.push('mem.size = ?')
      queryParams.push(memory)
    }

    // 成色筛选
    if (is_new !== undefined && is_new !== null && is_new !== '') {
      const isNewValue = is_new === 'true' || is_new === true || is_new === '1'
      whereConditions.push('p.is_new = ?')
      queryParams.push(isNewValue ? 1 : 0)
    }

    // 日期范围筛选
    if (date) {
      log.debug('🗓️ 处理日期筛选:', date)

      // 支持多种日期格式：YYYY-MM-DD 或 YYYY-MM-DD - YYYY-MM-DD
      if (date.includes(' - ')) {
        // 日期范围格式：YYYY-MM-DD - YYYY-MM-DD
        const [startDate, endDate] = date.split(' - ').map(d => d.trim())
        if (startDate) {
          whereConditions.push('DATE(p.inventory_time) >= ?')
          queryParams.push(startDate)
        }
        if (endDate) {
          whereConditions.push('DATE(p.inventory_time) <= ?')
          queryParams.push(endDate)
        }
        log.debug(`📅 日期范围筛选: ${startDate} 到 ${endDate}`)
      } else if (date.includes('-')) {
        // 单个日期格式：YYYY-MM-DD
        whereConditions.push('DATE(p.inventory_time) = ?')
        queryParams.push(date)
        log.debug(`📅 单日筛选: ${date}`)
      }
    } else if (date_start || date_end) {
      // 新的日期范围筛选
      log.debug(`🔍 接收到日期参数: date_start='${date_start}', date_end='${date_end}'`)
      if (date_start && date_end) {
        // 同时有开始和结束日期
        whereConditions.push('DATE(p.inventory_time) BETWEEN ? AND ?')
        queryParams.push(date_start, date_end)
        log.debug(`🔍 日期范围筛选: ${date_start} - ${date_end}`)
      } else if (date_start) {
        // 只有开始日期
        whereConditions.push('DATE(p.inventory_time) >= ?')
        queryParams.push(date_start)
        log.debug(`🔍 日期筛选: 从 ${date_start} 开始`)
      } else if (date_end) {
        // 只有结束日期
        whereConditions.push('DATE(p.inventory_time) <= ?')
        queryParams.push(date_end)
        log.debug(`🔍 日期筛选: 到 ${date_end} 结束`)
      }
    }

    // 智能搜索功能 - 支持所有字段的智能识别
    if (search) {
      const searchStr = search.trim()

      // IMEI 精确匹配 (15位数字)
      if (/^\d{15}$/.test(searchStr)) {
        whereConditions.push('p.imei = ?')
        queryParams.push(searchStr)
      }
      // 序列号精确匹配 (字母数字组合)
      else if (/^[A-Za-z0-9]{8,}$/.test(searchStr)) {
        whereConditions.push('UPPER(p.serial_number) LIKE ?')
        queryParams.push(`%${searchStr.toUpperCase()}%`)
      }
      // 内存规格匹配 (如 256GB, 512GB, 1TB)
      else if (/^(\d+[Gg][Bb]|1[Tt][Bb])$/.test(searchStr)) {
        whereConditions.push('UPPER(mem.size) LIKE ?')
        queryParams.push(`%${searchStr.toUpperCase()}%`)
      }
      // 状态匹配 (英文状态)
      else if (['available', 'in_stock', 'sold', 'reserved', 'repair', 'rented', 'lost'].includes(searchStr.toLowerCase())) {
        whereConditions.push(`${effectiveStatusSql} = ?`)
        queryParams.push(searchStr.toLowerCase() === 'available' ? 'in_stock' : searchStr.toLowerCase())
      }
      // 状态匹配 (中文状态)
      else if (['可用', '可售', '已售', '预定', '预订', '维修', '租赁', '丢失', '在库'].includes(searchStr)) {
        const statusMap = {
          '可用': 'in_stock',
          '可售': 'in_stock',
          '已售': 'sold',
          '预定': 'reserved',
          '预订': 'reserved',
          '维修': 'repair',
          '租赁': 'rented',
          '丢失': 'lost',
          '在库': 'in_stock'
        }
        whereConditions.push(`${effectiveStatusSql} = ?`)
        queryParams.push(statusMap[searchStr])
      }
      // 成色匹配
      else if (['new', 'used', '全新', '二手'].includes(searchStr.toLowerCase())) {
        const isNew = ['new', '全新'].includes(searchStr.toLowerCase())
        whereConditions.push('p.is_new = ?')
        queryParams.push(isNew ? 1 : 0)
      }
      // 质量等级匹配
      else if (/^[A-C]$/.test(searchStr.toUpperCase())) {
        whereConditions.push('UPPER(p.quality_grade) = ?')
        queryParams.push(searchStr.toUpperCase())
      }
      // 日期格式匹配 (YYYY-MM-DD)
      else if (/^\d{4}-\d{2}-\d{2}$/.test(searchStr)) {
        whereConditions.push('(DATE(p.inventory_time) = ? OR DATE(p.sale_time) = ?)')
        queryParams.push(searchStr, searchStr)
      }
      // 价格相关匹配 (纯数字，可能查询价格、IMEI部分、序列号等)
      else if (/^\d+$/.test(searchStr)) {
        // 对于数字搜索，同时匹配多个可能的字段
        whereConditions.push(`(
          p.imei LIKE ? OR
          p.serial_number LIKE ? OR
          p.purchase_number LIKE ? OR
          p.sale_price = ? OR
          p.purchase_cost = ? OR
          CAST(p.id AS CHAR) LIKE ?
        )`)
        const searchTerm = `%${searchStr}%`
        const price = parseFloat(searchStr)
        queryParams.push(searchTerm, searchTerm, searchTerm, price, price, searchTerm)
      }
      // 其他情况进行全字段模糊搜索
      else {
        whereConditions.push(`(
          p.imei LIKE ? OR
          p.serial_number LIKE ? OR
          b.name LIKE ? OR
          m.name LIKE ? OR
          co.name LIKE ? OR
          mem.size LIKE ? OR
          p.status LIKE ? OR
          p.quality_grade LIKE ? OR
          p.remarks LIKE ? OR
          st.name LIKE ? OR
          s.name LIKE ? OR
          p.purchase_number LIKE ?
        )`)
        const searchTerm = `%${searchStr}%`
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
      }
    }

    const whereClause = whereConditions.join(' AND ')

    // 使用完整的查询，包含操作员信息、备注
    const dataQuery = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        m.name as model,
        b.name as brand,
        co.name as color,
        mem.size as memory,
        p.quality_grade as phone_condition,
        p.purchase_cost,
        p.sale_price,
        p.store_id,
        p.supplier_id,
        ${effectiveStatusSql} AS status,
        p.is_new,
        p.is_preordered,
        p.inventory_time AS inventory_time,
        p.sale_time AS sale_time,
        p.remarks,
        s.name as supplier_name,
        st.name as store_name,
        p.purchase_number as purchase_number,
        p.inventory_operator_id,
        inv_op.name as inventory_operator_name,
        preorder.id as preorder_id,
        preorder.customer_id as preorder_customer_id,
        preorder_customer.name as preorder_customer_name,
        preorder_customer.phone as preorder_customer_phone,
        preorder.deposit_amount as preorder_deposit_amount,
        preorder.total_price as preorder_total_price,
        preorder.actual_price as preorder_actual_price
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users inv_op ON p.inventory_operator_id = inv_op.id
      LEFT JOIN preorders preorder
        ON preorder.matched_phone_id = p.id
       AND preorder.status = 'arrived'
      LEFT JOIN customers preorder_customer ON preorder_customer.id = preorder.customer_id
      WHERE ${whereClause}
      ORDER BY p.inventory_time DESC
      LIMIT ${validLimit} OFFSET ${offset}
    `

    log.debug('🔍 查询条件:', whereConditions)
    log.debug('🔍 查询参数:', queryParams)
    log.debug('🔍 SQL查询:', dataQuery)

    const [dataResult] = await connection.execute(dataQuery, queryParams)
    log.debug(`✅ 查询成功，找到 ${dataResult.length} 条记录`)
    // 打印第一条记录的原始数据用于调试
    if (dataResult.length > 0) {
      log.debug('🔍 第一条记录原始数据:', JSON.stringify(dataResult[0], null, 2))
    }

    // 计数查询
    const countQuery = `
      SELECT COUNT(*) as total
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE ${whereClause}
    `

    const [countResult] = await connection.execute(countQuery, queryParams)
    const total = countResult[0].total
    log.debug(`✅ 总数: ${total}`)

    // 格式化返回数据
    const formattedData = dataResult.map(item => ({
      id: item.id,
      imei: item.imei || '',
      serial_number: item.serial_number || '',
      model: item.model || '',
      brand: item.brand || '',
      color: item.color || '',
      memory: item.memory || '',
      phone_condition: item.phone_condition || '',
      condition: item.phone_condition || '',
      purchase_cost: parseFloat(item.purchase_cost) || 0,
      sale_price: parseFloat(item.sale_price) || 0,
      inventory_time: item.inventory_time || null,
      sale_time: item.sale_time || null,
      condition: Number(item.is_new) === 1 ? 'new' : 'used',
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_name || '未知供应商',
      store_id: item.store_id,
      store_name: item.store_name || '未知店铺',
      purchase_number: item.purchase_number || '',
      inventory_operator_id: item.inventory_operator_id,
      inventory_operator_name: item.inventory_operator_name || '未设置',
      remarks: item.remarks || '',
      status: item.status,
      is_preordered: item.is_preordered === 1,
      preorder_id: item.preorder_id || null,
      preorder_customer_id: item.preorder_customer_id || null,
      preorder_customer_name: item.preorder_customer_name || '',
      preorder_customer_phone: item.preorder_customer_phone || '',
      preorder_deposit_amount: item.preorder_deposit_amount === null || item.preorder_deposit_amount === undefined
        ? null
        : Number(item.preorder_deposit_amount),
      preorder_total_price: item.preorder_total_price === null || item.preorder_total_price === undefined
        ? null
        : Number(item.preorder_total_price),
      preorder_actual_price: item.preorder_actual_price === null || item.preorder_actual_price === undefined
        ? null
        : Number(item.preorder_actual_price),
      is_new: item.is_new,
      created_at: item.inventory_time
    }))

    const result = {
      success: true,
      data: formattedData,
      pagination: {
        page: validPage,
        page_size: validLimit,
        total: total,
        total_pages: Math.ceil(total / validLimit),
        has_next: validPage < Math.ceil(total / validLimit),
        has_prev: validPage > 1
      }
    }

    ApiResponse.success(res, result)

  } catch (error) {
    log.error('获取库存列表失败:', error)
    ApiResponse.serverError(res, '获取库存列表失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 获取库存统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const { whereClause, queryParams } = buildInventoryStatsWhere(req.query)
    const inventoryJoins = `
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
    `

    // 获取基本统计
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN p.is_new = 1 THEN 1 END) as new_count,
        COUNT(CASE WHEN p.is_new = 0 THEN 1 END) as used_count,
        COALESCE(SUM(p.purchase_cost), 0) as total_value
      FROM phones p
      ${inventoryJoins}
      ${whereClause}
    `

    const [statsResult] = await pool.execute(statsQuery, queryParams)
    const stats = statsResult[0]

    // 按门店统计
    const storeStatsQuery = `
      SELECT
        st.name as store_name,
        COUNT(*) as count
      FROM phones p
      ${inventoryJoins}
      ${whereClause}
      GROUP BY p.store_id, st.name
      ORDER BY count DESC
    `

    const [storeResult] = await pool.execute(storeStatsQuery, queryParams)

    // 按品牌统计
    const brandStatsQuery = `
      SELECT
        b.name as brand_name,
        COUNT(*) as count
      FROM phones p
      ${inventoryJoins}
      ${whereClause}
      GROUP BY b.name
      ORDER BY count DESC
      LIMIT 10
    `

    const [brandResult] = await pool.execute(brandStatsQuery, queryParams)

    // 构建响应数据
    const response = {
      total: parseInt(stats.total) || 0,
      new_count: parseInt(stats.new_count) || 0,
      used_count: parseInt(stats.used_count) || 0,
      total_value: parseFloat(stats.total_value) || 0,
      by_store: storeResult.reduce((acc, row) => {
        acc[row.store_name || '未知店铺'] = row.count
        return acc
      }, {}),
      by_brand: brandResult.reduce((acc, row) => {
        acc[row.brand_name || '未知品牌'] = row.count
        return acc
      }, {})
    }

    ApiResponse.success(res, response)

  } catch (error) {
    log.error('获取库存统计失败:', error)
    ApiResponse.serverError(res, '获取库存统计失败', error)
  }
})

/**
 * 获取库存统计数据
 * 注意：此路由必须放在 /:id 路由之前，否则 'stats' 会被当作 id 参数处理
 */
router.get('/stats', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()

    // 获取总数（在库的商品）
    const [totalResult] = await pool.execute(`SELECT COUNT(*) as total FROM phones WHERE ${COMPLETED_TRANSACTION_STATUS_SQL}`, COMPLETED_TRANSACTION_STATUSES)
    const total = totalResult[0].total

    // 获取全新机数量（在库且全新）
    const [inStockResult] = await pool.execute(`SELECT COUNT(*) as inStock FROM phones WHERE ${COMPLETED_TRANSACTION_STATUS_SQL} AND is_new = 1`, COMPLETED_TRANSACTION_STATUSES)
    const inStock = inStockResult[0].inStock

    // 获取二手机数量（在库且二手）
    const [soldResult] = await pool.execute(`SELECT COUNT(*) as sold FROM phones WHERE ${COMPLETED_TRANSACTION_STATUS_SQL} AND is_new = 0`, COMPLETED_TRANSACTION_STATUSES)
    const sold = soldResult[0].sold

    // 获取库存总值（在库商品的采购价格总和）
    const [valueResult] = await pool.execute(`
      SELECT COALESCE(SUM(purchase_cost), 0) as totalValue
      FROM phones
      WHERE ${COMPLETED_TRANSACTION_STATUS_SQL}
    `, COMPLETED_TRANSACTION_STATUSES)
    const totalValue = parseFloat(valueResult[0].totalValue) || 0

    log.debug('📊 库存统计数据:', {
      总数: total,
      全新机: inStock,
      二手机: sold,
      总值: totalValue
    })

    ApiResponse.success(res, {
      total,
      inStock,
      sold,
      totalValue
    }, '获取统计数据成功')

  } catch (error) {
    log.error('获取库存统计数据失败:', error)
    ApiResponse.serverError(res, '获取统计数据失败', error)
  }
})

// 获取单个库存详情
router.get('/:id', unifiedAuth, requirePermission('inventory:view'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    if (!id || isNaN(id)) {
      return ApiResponse.badRequest(res, '无效的商品ID')
    }

    const { getDatabase } = require('../config/database')
    const pool = getDatabase()

    if (!pool) {
      return ApiResponse.serverError(res, '数据库连接池未初始化')
    }

    connection = await pool.getConnection()

    log.debug(`正在获取商品详情，ID: ${id}`)

    // 从phones表中获取商品详情，包含关联数据
    const query = `
      SELECT
        p.id, p.brand_id, p.model_id, p.color_id, p.memory_id,
        p.imei, p.serial_number, p.purchase_cost, p.sale_price,
        p.supplier_id, p.store_id, p.inventory_time, p.sale_time,
        p.quality_grade, p.remarks as purchase_remarks, p.is_new, p.status, p.is_preordered,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        s.name as supplier_name,
        st.name as store_name,
        u.username as operator_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN stores st ON p.store_id = st.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
        WHERE p.id = ?
    `

    const [rows] = await connection.execute(query, [parseInt(id)])

    if (rows.length === 0) {
      return ApiResponse.notFound(res, '商品不存在')
    }

    const item = rows[0]

    // 转换为前端期望的格式
    const responseData = {
      id: item.id,
      brand_id: item.brand_id || null,
      model_id: item.model_id || null,
      color_id: item.color_id || null,
      memory_id: item.memory_id || null,
      brand: item.brand || '',
      model: item.model || '',
      color: item.color || '',
      memory: item.memory || '',
      imei: item.imei || '',
      serial_number: item.serial_number || '',
      purchase_cost: item.purchase_cost ?? null,
      sale_price: item.sale_price ?? null,
      price: item.sale_price ?? 0,
      supplier_id: item.supplier_id || null,
      store_id: item.store_id || null,
      inventory_time: item.inventory_time,
      condition: Number(item.is_new) === 1 ? 'new' : 'used',
      quality_grade: item.quality_grade,
      purchase_remarks: item.purchase_remarks || '',
      remarks: item.purchase_remarks || '',
      is_new: item.is_new,
      status: item.status === 'in_stock' && Number(item.is_preordered) === 1 ? 'reserved' : item.status,
      is_preordered: Number(item.is_preordered) === 1,
      sale_time: item.sale_time,
      supplier_name: item.supplier_name || '',
      store_name: item.store_name || '',
      operator_name: item.operator_name || ''
    }

    // 调试日志 - 详细显示原始数据和转换后的数据
    log.debug(`=== 调试信息 - 商品ID: ${id} ===`)
    log.debug('原始数据库数据:')
    log.debug('  item.purchase_cost:', item.purchase_cost)
    log.debug('转换后的响应数据:')
    log.debug('  responseData.purchase_cost:', responseData.purchase_cost)
    log.debug('  responseData.price:', responseData.price)
    log.debug('========================')

    log.debug('获取到的商品详情:', responseData)
    ApiResponse.success(res, responseData)

  } catch (error) {
    log.error('获取商品详情失败:', error)
    ApiResponse.serverError(res, '获取商品详情失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 历史库存变动接口暂未连接真实流水表，禁止返回伪造数据。
router.get('/:id/movements', unifiedAuth, requirePermission('inventory:view'), (req, res) => {
  return ApiResponse.error(res, '库存变动记录暂未实现', 501)
})

// 历史按库存记录入库接口曾使用内存数组，统一改由真实入库事务处理。
router.post('/:id/stock-in', unifiedAuth, requirePermission('inventory:create'), (req, res) => {
  return ApiResponse.error(res, '请使用 /inventory/stock-in 真实入库接口', 501)
})



// 历史库存出库接口没有真实库存流水事务，禁止返回伪造成功。
router.post('/:id/stock-out', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  return ApiResponse.error(res, '库存出库真实流程暂未实现', 501)
})



// 历史库存预留接口没有真实库存流水事务，禁止返回伪造成功。
router.post('/:id/reserve', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  return ApiResponse.error(res, '库存预留真实流程暂未实现', 501)
})



// 历史取消预留接口没有真实库存流水事务，禁止返回伪造成功。
router.post('/:id/unreserve', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  return ApiResponse.error(res, '取消库存预留真实流程暂未实现', 501)
})



// 历史库存调整接口没有真实库存流水事务，禁止返回伪造成功。
router.put('/:id/adjust', unifiedAuth, requirePermission('inventory:edit'), (req, res) => {
  return ApiResponse.error(res, '库存调整真实流程暂未实现', 501)
})

// 旧库存入库入口已停用，统一使用 /stock-in 真实事务接口。
router.post('/stock-in', unifiedAuth, requirePermission('inventory:create'), (req, res) => {
  return ApiResponse.error(res, '请使用 /stock-in 真实入库接口', 501)
})



// 更新库存商品信息
router.put('/:id', unifiedAuth, requirePermission('inventory:edit'), async (req, res) => {
  let connection
  try {
    const { id } = req.params
    const { Inventorytime: legacyInventoryTime, ...requestData } = req.body
    const updateData = {
      ...requestData,
      inventory_time: requestData.inventory_time ?? legacyInventoryTime
    }

    if (!id || isNaN(id)) {
      return ApiResponse.badRequest(res, '无效的商品ID')
    }

    const { getDatabase } = require('../config/database')
    const pool = getDatabase()

    if (!pool) {
      return ApiResponse.serverError(res, '数据库连接池未初始化')
    }

    connection = await pool.getConnection()
    await connection.beginTransaction()

    log.debug(`开始更新库存商品，ID: ${id}`, updateData)

    // 检查商品是否存在
    const [existingItems] = await connection.execute(
      'SELECT id, imei, status, is_preordered FROM phones WHERE id = ?',
      [id]
    )

    if (existingItems.length === 0) {
      await connection.rollback()
      return ApiResponse.notFound(res, '商品不存在')
    }

    const item = existingItems[0]
    log.debug(`找到商品: ${item.brand || ''} ${item.model || ''} (${item.imei || '无IMEI'})`)

    // 检查IMEI冲突（如果要更新的IMEI与现有其他商品冲突）
    if (updateData.imei && updateData.imei !== item.imei) {
      const [imeiConflict] = await connection.execute(
        'SELECT id FROM phones WHERE imei = ? AND id != ?',
        [updateData.imei, id]
      )

      if (imeiConflict.length > 0) {
        await connection.rollback()
        return ApiResponse.badRequest(res, '该IMEI号已被其他商品使用')
      }
    }

    // 构建更新字段
    const updateFields = []
    const updateValues = []

    // 控制字段是否包含在更新中
    let includeSupplier = true
    let includeStore = true

    // 品牌ID到名称转换
    let brandName = ''
    if (updateData.brand_id) {
      const [brandResult] = await connection.execute('SELECT name FROM brands WHERE id = ?', [updateData.brand_id])
      if (brandResult.length > 0) {
        brandName = brandResult[0].name
        log.debug(`✅ 品牌ID ${updateData.brand_id} 转换为名称: ${brandName}`)
      } else {
        log.debug(`⚠️ 品牌ID ${updateData.brand_id} 在数据库中不存在，跳过品牌字段更新`)
        includeBrand = false
      }
    }

    // 型号ID到名称转换
    let modelName = ''
    if (updateData.model_id) {
      const [modelResult] = await connection.execute('SELECT name FROM models WHERE id = ?', [updateData.model_id])
      if (modelResult.length > 0) {
        modelName = modelResult[0].name
        log.debug(`✅ 型号ID ${updateData.model_id} 转换为名称: ${modelName}`)
      } else {
        log.debug(`⚠️ 型号ID ${updateData.model_id} 在数据库中不存在，跳过型号字段更新`)
        includeModel = false
      }
    }

    // 颜色ID到名称转换
    let colorName = ''
    if (updateData.color_id) {
      const [colorResult] = await connection.execute('SELECT name FROM colors WHERE id = ?', [updateData.color_id])
      if (colorResult.length > 0) {
        colorName = colorResult[0].name
        log.debug(`✅ 颜色ID ${updateData.color_id} 转换为名称: ${colorName}`)
      } else {
        log.debug(`⚠️ 颜色ID ${updateData.color_id} 在数据库中不存在，跳过颜色字段更新`)
        includeColor = false
      }
    }

    // 内存ID到名称转换 - 支持前端内存ID映射
    let memoryName = ''
    let actualMemoryId = null
    if (updateData.memory_id) {
      // 前端发送的内存ID到数据库实际内存ID的映射
      const memoryIdMapping = {
        1: 1,   // 2GB
        2: 29,  // 4GB
        3: 30,  // 8GB
        4: 32,  // 16GB
        5: 22,  // 32GB
        6: 23,  // 64GB
        7: 24,  // 128GB
        8: 25,  // 256GB
        9: 26,  // 512GB
        10: 27, // 1TB
        11: 28  // 2TB
      }

      actualMemoryId = memoryIdMapping[updateData.memory_id]
      if (actualMemoryId) {
        const [memoryResult] = await connection.execute('SELECT size FROM memories WHERE id = ?', [actualMemoryId])
        if (memoryResult.length > 0) {
          memoryName = memoryResult[0].size
          log.debug(`✅ 前端内存ID ${updateData.memory_id} 映射到数据库ID ${actualMemoryId} -> "${memoryName}"`)
        } else {
          log.debug(`⚠️ 数据库内存ID ${actualMemoryId} 不存在，跳过内存字段更新`)
          includeMemory = false
        }
      } else {
        log.debug(`⚠️ 前端内存ID ${updateData.memory_id} 无映射，跳过内存字段更新`)
        includeMemory = false
      }
    }

    // 供应商ID验证（保持ID，因为phones表存储的是supplier_id）
    if (updateData.supplier_id) {
      const [supplierResult] = await connection.execute('SELECT id FROM suppliers WHERE id = ?', [updateData.supplier_id])
      if (supplierResult.length === 0) {
        log.debug(`⚠️ 供应商ID ${updateData.supplier_id} 在数据库中不存在，跳过供应商字段更新`)
        includeSupplier = false
      }
    }

    // 店铺ID验证（保持ID，因为phones表存储的是store_id）
    if (updateData.store_id) {
      const [storeResult] = await connection.execute('SELECT id FROM stores WHERE id = ?', [updateData.store_id])
      if (storeResult.length === 0) {
        log.debug(`⚠️ 店铺ID ${updateData.store_id} 在数据库中不存在，跳过店铺字段更新`)
        includeStore = false
      }
    }

    // 处理前端发送的字段映射
    const fieldMapping = {
      'imei': updateData.imei,
      'serial_number': updateData.serial_number,
      // 使用新的字段结构
      'purchase_cost': updateData.price,
      'sale_price': updateData.price * 1.2,
      ...(includeSupplier && { 'supplier_id': updateData.supplier_id }),
      ...(includeStore && { 'store_id': updateData.store_id }),
      'inventory_time': updateData.inventory_time,
      'is_new': updateData.is_new  // 使用前端发送的is_new字段
    }

    // 构建更新字段
    Object.keys(fieldMapping).forEach(field => {
      const value = fieldMapping[field]
      if (value !== undefined && value !== null) {
        // 特殊处理is_new字段转换
        if (field === 'is_new') {
          const qualityGrade = value === 1 ? 'A' : 'B'
          log.debug(`🔄 更新is_new字段: ${value} -> quality_grade: ${qualityGrade}`)
          updateFields.push('quality_grade = ?')
          updateFields.push('is_new = ?')
          updateValues.push(qualityGrade)
          updateValues.push(value)
        } else {
          updateFields.push(`${field} = ?`)
          updateValues.push(value)
        }
      }
    })

    if (updateFields.length === 0) {
      await connection.rollback()
      return ApiResponse.badRequest(res, '没有有效的更新字段')
    }

    // No updated_at field; inventory_time and sale_time track business time.

    // 添加WHERE条件的ID
    updateValues.push(id)

    // 执行更新
    const updateQuery = `UPDATE phones SET ${updateFields.join(', ')} WHERE id = ?`
    log.debug('执行更新SQL:', updateQuery)
    log.debug('更新参数:', updateValues)

    const [updateResult] = await connection.execute(updateQuery, updateValues)

    if (updateResult.affectedRows === 0) {
      await connection.rollback()
      return ApiResponse.serverError(res, '更新失败，商品可能已被删除')
    }

    // 提交事务
    await connection.commit()

    log.debug(`成功更新库存商品，ID: ${id}`)

    // 返回更新后的商品信息
    const [updatedItems] = await connection.execute(
      'SELECT id, imei, serial_number, purchase_cost, quality_grade, inventory_time, sale_time FROM phones WHERE id = ?',
      [id]
    )

    ApiResponse.success(res, updatedItems[0], '商品信息更新成功')

  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    log.error('更新库存商品失败:', error)
    ApiResponse.serverError(res, '更新商品失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 删除库存商品
router.delete('/:id', unifiedAuth, requirePermission('inventory:delete'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    if (!id || isNaN(id)) {
      return ApiResponse.badRequest(res, '无效的商品ID')
    }

    const { getDatabase } = require('../config/database')
    const pool = getDatabase()

    if (!pool) {
      return ApiResponse.serverError(res, '数据库连接池未初始化')
    }

    connection = await pool.getConnection()
    await connection.beginTransaction()

    log.debug(`开始删除库存商品，ID: ${id}`)

    // 检查商品是否存在
    const [existingItems] = await connection.execute(
      'SELECT id, imei, status, is_preordered FROM phones WHERE id = ?',
      [id]
    )

    if (existingItems.length === 0) {
      await connection.rollback()
      return ApiResponse.notFound(res, '商品不存在')
    }

    const item = existingItems[0]
    log.debug(`找到商品: ${item.brand || ''} ${item.model || ''} (${item.imei || '无IMEI'})`)

    // 已完成交易和预订设备不能从库存台账删除；其他未完成状态继续进入关联记录校验。
    if (COMPLETED_TRANSACTION_STATUSES.includes(item.status) || Number(item.is_preordered) === 1) {
      await connection.rollback()
      return ApiResponse.badRequest(res, Number(item.is_preordered) === 1
        ? '预订设备不能直接删除，请先取消或重新匹配预定单'
        : '已完成交易的商品不能从库存台账删除')
    }

    // 检查外键约束 - 查看是否有关联的记录
    log.debug(`检查商品ID ${id}的外键关联...`)

    // 检查租借记录
    const [rentalRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM rentals WHERE phone_id = ?',
      [id]
    )

    // 检查销售记录
    const [saleRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM sales WHERE phone_id = ?',
      [id]
    )

    // 检查维修记录
    const [repairRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM repairs WHERE phone_id = ?',
      [id]
    )

    const rentalCount = rentalRecords[0].count
    const saleCount = saleRecords[0].count
    const repairCount = repairRecords[0].count

    log.debug(`关联记录统计: 租借${rentalCount}, 销售${saleCount}, 维修${repairCount}`)

    // 如果有任何关联记录，提供详细的错误信息
    if (rentalCount > 0 || saleCount > 0 || repairCount > 0) {
      await connection.rollback()

      const relatedRecords = []
      if (rentalCount > 0) relatedRecords.push(`租借记录(${rentalCount}条)`)
      if (saleCount > 0) relatedRecords.push(`销售记录(${saleCount}条)`)
      if (repairCount > 0) relatedRecords.push(`维修记录(${repairCount}条)`)

      const errorMessage = `无法删除商品：存在关联的${relatedRecords.join('、')}。请先处理这些关联记录后再删除商品。`
      return ApiResponse.badRequest(res, errorMessage)
    }

    // 删除phones表中的记录
    const [deleteResult] = await connection.execute(
      'DELETE FROM phones WHERE id = ?',
      [id]
    )

    if (deleteResult.affectedRows === 0) {
      await connection.rollback()
      return ApiResponse.serverError(res, '删除失败，商品可能已被删除')
    }

    // 提交事务
    await connection.commit()

    log.debug(`成功删除库存商品，ID: ${id}`)

    ApiResponse.success(res, {
      id: parseInt(id),
      deleted: true,
      item: {
        id: item.id,
        imei: item.imei
      }
    }, '商品删除成功')

  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    log.error('删除库存商品失败:', error)
    ApiResponse.serverError(res, '删除商品失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 快速出库接口 - 直接创建已销售记录，跳过入库流程
router.post('/quick-sale', unifiedAuth, requirePermission('inventory:sell'), async (req, res) => {
  let connection
  try {
    log.debug('🔍 快速出库API: 收到快速出库请求')
    log.debug('👤 用户信息:', req.user)
    log.debug('📦 请求数据:', JSON.stringify(req.body, null, 2))

    const pool = getDatabase()
    connection = await pool.getConnection()

    await connection.beginTransaction()

    const {
      // 设备信息
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new,
      imei,
      serial_number,
      // 供应商和店铺
      supplier_id,
      store_id,
      // 价格
      purchase_cost,
      sale_price,
      // 客户信息
      customer_name,
      customer_phone,
      apple_id,
      // 入库和销售信息
      inventory_time,
      sale_time,
      sale_operator_id,
      payment_method,
      payment_channel,
      remarks
    } = req.body

    if (![brand_id, model_id, color_id, memory_id].every(id => Number.isInteger(id) && id > 0)) {
      throw new Error('设备信息不完整，请选择有效的品牌、型号、颜色和内存')
    }
    if (!serial_number) {
      throw new Error('序列号不能为空')
    }
    if (!imei || typeof imei !== 'string') {
      log.error('❌ IMEI验证失败:', { imei, type: typeof imei, length: imei?.length })
      throw new Error('IMEI不能为空')
    }

    const imeiValidation = validateImei(imei, serial_number)
    const { normalizedImei, normalizedSerialNumber } = imeiValidation

    if (!imeiValidation.valid) {
      log.error('❌ IMEI格式错误:', {
        imei: normalizedImei,
        serial_number: normalizedSerialNumber,
        imeiLength: normalizedImei.length
      })
      throw new Error(imeiValidation.reason)
    }
    if (!supplier_id || !store_id) {
      throw new Error('供应商和店铺不能为空')
    }
    const purchaseCost = purchase_cost === null || purchase_cost === undefined ? null : Number(purchase_cost)
    const salePrice = sale_price === null || sale_price === undefined ? null : Number(sale_price)
    if (purchaseCost !== null && (!Number.isFinite(purchaseCost) || purchaseCost < 0)) {
      throw new Error('入库价格不能为负数')
    }
    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0)) {
      throw new Error('销售价格不能为负数')
    }
    if (!customer_phone) {
      throw new Error('客户手机号不能为空')
    }

    // 入库员只能取当前登录账户，销售员则使用表单中选择的账户。
    // 不接受客户端传入的入库员 ID，避免两个操作人被混写或被伪造。
    const inventoryOperatorId = Number(req.user?.id)
    const saleOperatorId = Number(sale_operator_id)
    if (!Number.isInteger(inventoryOperatorId) || inventoryOperatorId <= 0) {
      throw new Error('当前登录账户无效，请重新登录')
    }
    if (!Number.isInteger(saleOperatorId) || saleOperatorId <= 0) {
      throw new Error('请选择有效的销售员')
    }
    if (!['cash', 'mobile', 'bank_card', 'subsidy_card'].includes(payment_method)) {
      throw new Error('请选择有效的支付方式')
    }
    const allowedPaymentChannels = {
      cash: [null],
      mobile: ['wechat', 'alipay'],
      bank_card: ['card_consumption', 'bank_transfer'],
      subsidy_card: ['subsidy_card']
    }
    const normalizedPaymentChannel = payment_method === 'cash' ? null : String(payment_channel || '')
    if (!allowedPaymentChannels[payment_method].includes(normalizedPaymentChannel)) {
      throw new Error('请选择有效的支付渠道')
    }
    const normalizedAppleId = String(apple_id || '').trim() || null

    const [[brands], [models], [colors], [memories]] = await Promise.all([
      connection.execute('SELECT id FROM brands WHERE id = ? AND status = 1', [brand_id]),
      connection.execute('SELECT id FROM models WHERE id = ? AND brand_id = ? AND status = 1', [model_id, brand_id]),
      connection.execute('SELECT id FROM colors WHERE id = ? AND status = 1', [color_id]),
      connection.execute('SELECT id FROM memories WHERE id = ? AND status = 1', [memory_id])
    ])
    if (!brands.length || !models.length || !colors.length || !memories.length) {
      throw new Error('品牌、型号、颜色或内存不存在或已停用')
    }

    // 1. 创建或获取客户记录（需要先创建客户，以便检查IMEI重复）
    let customer_id = null
    const [existingCustomers] = await connection.execute(
      'SELECT id FROM customers WHERE phone = ?',
      [customer_phone]
    )
    if (existingCustomers.length > 0) {
      customer_id = existingCustomers[0].id
      await connection.execute(
        'UPDATE customers SET name = COALESCE(NULLIF(?, \'\'), name), apple_id = COALESCE(?, apple_id) WHERE id = ?',
        [customer_name || '', normalizedAppleId, customer_id]
      )
    } else {
      // 创建新客户（自动生成会员号）
      const memberNumber = await generateMemberNumber({ connection })
      const [newCustomer] = await connection.execute(
        'INSERT INTO customers (name, phone, apple_id, member_number, created_at) VALUES (?, ?, ?, ?, NOW())',
        [customer_name || '', customer_phone, normalizedAppleId, memberNumber]
      )
      customer_id = newCustomer.insertId
      log.debug('✅ 创建新客户，ID:', customer_id, '会员号:', memberNumber)
    }

    // 6. 检查IMEI是否已存在（但允许不同客户拥有相同IMEI）
    // 只有当同一客户已拥有相同IMEI时才报错
    log.debug(`🔍 检查 IMEI ${normalizedImei} 和客户 ${customer_id} 的组合...`)
    const [existingPhones] = await connection.execute(
      `SELECT p.id, p.imei, s.customer_id
       FROM phones p
       LEFT JOIN sales s ON p.id = s.phone_id
       WHERE p.imei = ? AND s.customer_id = ?`,
      [normalizedImei, customer_id]
    )

    log.debug(`🔍 查询结果: 找到 ${existingPhones.length} 条记录`)
    if (existingPhones.length > 0) {
      log.debug(`❌ 该客户 ${customer_id} 已拥有 IMEI ${normalizedImei}`)
      await connection.rollback()
      return ApiResponse.error(res, '该客户已存在相同IMEI的手机', 400)
    }

    // 不同客户可以拥有相同IMEI的手机，这里记录日志
    const [allImeiPhones] = await connection.execute(
      'SELECT id FROM phones WHERE imei = ?',
      [normalizedImei]
    )
    if (allImeiPhones.length > 0) {
      log.debug(`ℹ️ IMEI ${normalizedImei} 已存在于其他客户，允许当前客户使用相同IMEI`)
    }

    // 7. 创建手机记录（直接设置为已销售状态）
    // 生成采购单号（快速出库使用 QS 开头）
    const purchase_number = `QS${Date.now()}`

    const inventoryTimeStr = normalizeDateTime(inventory_time, false)
    const saleTimeStr = normalizeDateTime(sale_time, false)
    if (!inventoryTimeStr || !saleTimeStr) {
      throw new Error('请选择有效的入库日期和销售日期')
    }

    const insertParams = [
      purchase_number,
      inventoryOperatorId,
      brand_id, model_id, color_id, memory_id,
      normalizedImei, normalizedSerialNumber,
      purchaseCost, salePrice,
      is_new !== undefined ? is_new : 1,
      supplier_id, store_id,
      'sold',
      is_new === 1 ? 'A' : 'B', // quality_grade: 全新为A，二手为B
      remarks || null,
      inventoryTimeStr, // inventory_time (北京时间 YYYY-MM-DD HH:mm:ss)
      saleTimeStr, // sale_time (北京时间 YYYY-MM-DD HH:mm:ss)
      saleOperatorId,
      payment_method
    ]

    log.debug('📝 准备插入phones表，参数数量:', insertParams.length)
    log.debug('📝 插入参数:', insertParams)

    const [phoneResult] = await connection.execute(`
      INSERT INTO phones (
        purchase_number, inventory_operator_id, brand_id, model_id, color_id, memory_id,
        imei, serial_number, purchase_cost, sale_price, is_new, supplier_id, store_id, status,
        quality_grade, remarks, inventory_time, sale_time, sale_operator_id, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, insertParams)
    const phone_id = phoneResult.insertId

    // 8. 创建销售记录（包含价格和成本、店铺信息）
    const [saleResult] = await connection.execute(`
      INSERT INTO sales (
        phone_id, customer_id, sale_type, operator_id, store_id,
        sale_price, purchase_cost, payment_method, payment_channel, sale_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      phone_id,
      customer_id,
      'retail',
      saleOperatorId,
      store_id,  // 🔥 添加店铺ID
      salePrice,
      purchaseCost,
      payment_method,
      normalizedPaymentChannel,
      saleTimeStr
    ])
    const sale_id = saleResult.insertId

    await connection.commit()

    log.debug('✅ 快速出库成功，phone_id:', phone_id, 'sale_id:', sale_id)

    ApiResponse.success(res, '快速出库成功', {
      phone_id,
      sale_id,
      imei: normalizedImei,
      customer_name,
      purchase_cost: purchaseCost,
      sale_price: salePrice,
      inventory_time: inventoryTimeStr,
      sale_time: saleTimeStr,
      sale_operator_id: saleOperatorId,
      payment_method,
      payment_channel: normalizedPaymentChannel
    })

  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    log.error('❌ 快速出库失败:', {
      message: error?.message || '未知错误',
      stack: error?.stack
    })
    if (error instanceof Error && !error.code) {
      return ApiResponse.badRequest(res, error.message || '快速出库失败')
    }
    ApiResponse.serverError(res, '快速出库失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 添加根路由，重定向到 /list
router.get('/', unifiedAuth, requirePermission('inventory:view'), (req, res) => {
  res.redirect(301, '/list')
})

module.exports = router
