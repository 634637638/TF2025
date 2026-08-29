/**
 * 入库管理路由
 * 提供入库记录的增删改查功能
 */
const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const { validateImei } = require('../utils/imei')
const log = require('../utils/log')

const formatStockInRecord = (record) => ({
  id: record.id,
  phone_id: record.id,
  imei: record.imei,
  serial_number: record.serial_number,
  purchase_cost: record.purchase_cost === null || record.purchase_cost === undefined ? null : Number(record.purchase_cost),
  store_id: record.store_id,
  store_name: record.store_name,
  supplier_id: record.supplier_id,
  supplier_name: record.supplier_name,
  inventory_operator_id: record.inventory_operator_id,
  operator_name: record.operator_name,
  operator_username: record.operator_username,
  status: record.status,
  is_new: record.is_new,
  inventory_time: record.inventory_time,
  purchase_number: record.purchase_number,
  remarks: record.remarks,
  sale_time: record.sale_time,
  payment_status: record.payment_status,
  payment_time: record.payment_time,
  brand_name: record.brand_name,
  model_name: record.model_name,
  color_name: record.color_name,
  memory_name: record.memory_name,
  condition: Number(record.is_new) === 1 ? 'new' : 'used',
  product_type: 'phone',
  product_name: [record.brand_name, record.model_name].filter(Boolean).join(' ') || null,
  quantity: 1,
  operation_type: 'in',
  reason: '采购入库',
  is_settled: record.payment_status === 'paid' ? 1 : 0,
  reference_type: 'purchase',
  reference_id: record.purchase_number
})

// 获取入库记录列表
router.get('/', unifiedAuth, requirePermission('stock-in:view'), async (req, res) => {
  let connection
  try {
    const {
      search,
      product_type,
      brand_id,
      store_id,
      supplier_id,
      start_date,
      end_date
    } = req.query
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const page_size = Math.min(200, Math.max(1, parseInt(req.query.page_size, 10) || 20))

    // 获取数据库连接
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 构建查询条件
    const whereConditions = []
    const params = []

    // 商品类型筛选 (通过is_new字段判断，1=全新，0=二手)
    if (product_type) {
      if (product_type === 'new') {
        whereConditions.push('p.is_new = 1')
      } else if (product_type === 'used') {
        whereConditions.push('p.is_new = 0')
      }
    }

    // 品牌筛选
    if (brand_id) {
      whereConditions.push('p.brand_id = ?')
      params.push(parseInt(brand_id, 10))
    }

    // 门店筛选
    if (store_id) {
      whereConditions.push('p.store_id = ?')
      params.push(parseInt(store_id, 10))
    }

    // 供应商筛选
    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?')
      params.push(parseInt(supplier_id, 10))
    }

    // 搜索功能
    if (search) {
      whereConditions.push(`(
        p.serial_number LIKE ? OR
        p.purchase_number LIKE ? OR
        p.imei LIKE ? OR
        s.name LIKE ? OR
        supp.name LIKE ? OR
        u.name LIKE ? OR
        u.username LIKE ?
      )`)
      const searchParam = `%${search}%`
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam)
    }

    // 日期范围筛选
    if (start_date) {
      whereConditions.push('p.inventory_time >= ?')
      params.push(start_date)
    }

    if (end_date) {
      whereConditions.push('p.inventory_time <= ?')
      params.push(end_date)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      ${whereClause}
    `

    const [countResult] = await connection.execute(countQuery, params)
    const total = Number(countResult[0].total)

    // 分页查询入库记录
    const offset = (page - 1) * page_size
    const query = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        p.purchase_cost,
        p.store_id,
        s.name as store_name,
        p.supplier_id,
        supp.name as supplier_name,
        p.inventory_operator_id,
        u.name as operator_name,
        u.username as operator_username,
        p.status,
        p.is_new,
        p.inventory_time as inventory_time,
        p.purchase_number,
        p.remarks,
        p.sale_time as sale_time,
        p.payment_status,
        p.payment_time,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory_name
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      ${whereClause}
      ORDER BY p.inventory_time DESC, p.id DESC
      LIMIT ? OFFSET ?
    `

    const [records] = await connection.query(query, [...params, page_size, offset])

    const formattedRecords = records.map(formatStockInRecord)

    ApiResponse.success(res, {
      records: formattedRecords,
      pagination: {
        page,
        page_size,
        total,
        total_pages: Math.ceil(total / page_size),
        has_next: page * page_size < total,
        has_prev: page > 1
      }
    })
  } catch (error) {
    log.error('获取入库记录失败:', error)
    ApiResponse.serverError(res, '获取入库记录失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 获取入库记录统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('stock-in:view'), async (req, res) => {
  let connection
  try {
    const { store_id, start_date, end_date } = req.query

    // 获取数据库连接
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 构建查询条件
    const whereConditions = []
    const params = []

    // 门店筛选
    if (store_id) {
      whereConditions.push('p.store_id = ?')
      params.push(parseInt(store_id, 10))
    }

    // 日期范围筛选
    if (start_date) {
      whereConditions.push('p.inventory_time >= ?')
      params.push(start_date)
    }

    if (end_date) {
      whereConditions.push('p.inventory_time <= ?')
      params.push(end_date)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 获取统计数据
    const statsQuery = `
      SELECT
        COUNT(*) as total_items,
        SUM(p.purchase_cost) as total_value,
        COUNT(CASE WHEN DATE(p.inventory_time) = CURDATE() THEN 1 END) as today_stock_in,
        COUNT(CASE WHEN p.is_new = 1 THEN 1 END) as new_items,
        COUNT(CASE WHEN p.is_new = 0 THEN 1 END) as used_items,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as in_stock_items,
        COUNT(CASE WHEN p.status = 'sold' THEN 1 END) as sold_items,
        COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) as settled_count,
        COUNT(CASE WHEN p.payment_status = 'unpaid' THEN 1 END) as unsettled_count,
        COUNT(CASE WHEN p.payment_status IS NULL THEN 1 END) as unknown_payment_count
      FROM phones p
      ${whereClause}
    `

    const [statsResult] = await connection.execute(statsQuery, params)
    const stats = statsResult[0]

    // 按门店统计
    const storeStatsQuery = `
      SELECT
        s.name as store_name,
        COUNT(*) as count
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      ${whereClause}
      GROUP BY p.store_id, s.name
      ORDER BY count DESC
    `

    const [storeStats] = await connection.execute(storeStatsQuery, params)
    const by_store = {}
    storeStats.forEach(row => {
      if (row.store_name !== null && row.store_name !== undefined) {
        by_store[row.store_name] = Number(row.count)
      }
    })

    // 按品牌统计
    const brandStatsQuery = `
      SELECT
        b.name as brand_name,
        COUNT(*) as count
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      GROUP BY b.id, b.name
      ORDER BY count DESC
    `

    const [brandStats] = await connection.execute(brandStatsQuery, params)
    const by_brand = {}
    brandStats.forEach(row => {
      if (row.brand_name !== null && row.brand_name !== undefined) {
        by_brand[row.brand_name] = Number(row.count)
      }
    })

    const finalStats = {
      today_stock_in: Number(stats.today_stock_in),
      total_items: Number(stats.total_items),
      total_value: stats.total_value === null || stats.total_value === undefined ? null : Number(stats.total_value),
      new_items: Number(stats.new_items),
      used_items: Number(stats.used_items),
      in_stock_items: Number(stats.in_stock_items),
      sold_items: Number(stats.sold_items),
      settled_count: Number(stats.settled_count),
      unsettled_count: Number(stats.unsettled_count),
      unknown_payment_count: Number(stats.unknown_payment_count),
      by_store,
      by_brand
    }

    ApiResponse.success(res, finalStats)
  } catch (error) {
    log.error('获取入库统计失败:', error)
    ApiResponse.serverError(res, '获取入库统计失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 获取单个入库记录详情
router.get('/:id', unifiedAuth, requirePermission('stock-in:view'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    // 获取数据库连接
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    const query = `
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        p.purchase_cost,
        p.store_id,
        s.name as store_name,
        p.supplier_id,
        supp.name as supplier_name,
        p.inventory_operator_id,
        u.name as operator_name,
        u.username as operator_username,
        p.status,
        p.is_new,
        p.inventory_time as inventory_time,
        p.purchase_number,
        p.remarks,
        p.sale_time as sale_time,
        p.payment_status,
        p.payment_time,
        b.name as brand_name,
        m.name as model_name,
        c.name as color_name,
        mem.size as memory_name
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE p.id = ?
    `

    const [records] = await connection.execute(query, [id])

    if (records.length === 0) {
      return ApiResponse.notFound(res, '入库记录不存在')
    }

    ApiResponse.success(res, formatStockInRecord(records[0]))
  } catch (error) {
    log.error('获取入库详情失败:', error)
    ApiResponse.serverError(res, '获取入库详情失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 创建入库记录
router.post('/', unifiedAuth, requireAnyPermission(['stock-in:create', 'inventory:create']), async (req, res) => {
  let connection
  try {
    const {
      supplier_id,
      store_id,
      inventory_time,
      operator_name,
      condition,
      products,
      remarks
    } = req.body

    const inventoryTime = inventory_time
    const finalRemarks = remarks ?? ''

    // 获取数据库连接
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 统一使用当前登录用户作为入库操作员，不再回退到固定管理员ID
    const currentUser = req.user || {}
    const currentUserId = currentUser.id || currentUser.sub
    if (!currentUserId) {
      return ApiResponse.error(res, '用户未登录或登录已失效', 401)
    }

    const inventoryOperatorId = currentUserId
    let actualOperatorName = operator_name?.trim()

    const [userResult] = await connection.execute(
      'SELECT name, username FROM users WHERE id = ? LIMIT 1',
      [currentUserId]
    )

    if (userResult.length > 0) {
      const user = userResult[0]
      actualOperatorName = user.name || user.username || actualOperatorName
    }

    // 数据验证
    if (!supplier_id) {
      return ApiResponse.badRequest(res, '请选择供应商')
    }

    if (!store_id) {
      return ApiResponse.badRequest(res, '请选择店铺')
    }

    if (!inventoryTime) {
      return ApiResponse.badRequest(res, '请选择入库时间')
    }

    if (!operator_name?.trim()) {
      return ApiResponse.badRequest(res, '操作员不能为空')
    }

    if (!condition || !['全新', '二手'].includes(condition)) {
      return ApiResponse.badRequest(res, '请选择商品状态')
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return ApiResponse.badRequest(res, '商品列表不能为空')
    }

    // 验证每个商品
    for (let i = 0; i < products.length; i++) {
      const product = products[i]

      if (!product.brand_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择品牌`)
      }

      if (!product.model_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择型号`)
      }

      if (!product.color_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择颜色`)
      }

      if (!product.memory_id) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请选择内存`)
      }

      // IMEI验证：如果是15位纯数字，或与序列号相同（无IMEI设备如iPad、手表等）
      if (!product.imei) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请输入IMEI号`)
      }
      const imeiValidation = validateImei(product.imei, product.serial_number)
      if (!imeiValidation.valid) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品IMEI号必须为15位数字，或与序列号相同（无IMEI设备）`)
      }

      product.imei = imeiValidation.normalizedImei
      product.serial_number = imeiValidation.normalizedSerialNumber

      if (product.serial_number && product.serial_number.length > 50) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品序列号最长50位`)
      }

      if (!product.purchase_cost || product.purchase_cost <= 0) {
        return ApiResponse.badRequest(res, `第${i + 1}行商品请输入有效的入库价格`)
      }
    }

    // 生成入库单号（使用北京时间：PO + 年份 + 时分秒6位）
    const now = new Date()
    // 转换为北京时间 (UTC+8)
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
    const year = beijingTime.getUTCFullYear()
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0')
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0')
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0')
    const purchase_number = `PO${year}${hours}${minutes}${seconds}`

    // 开始事务
    await connection.beginTransaction()

    try {
      const insertedProducts = []

      // 批量插入每个商品
      for (let i = 0; i < products.length; i++) {
        const product = products[i]

        // 获取品牌、型号、颜色、内存的名称
        const [brandResult] = await connection.execute(
          'SELECT name FROM brands WHERE id = ?',
          [product.brand_id]
        )
        const [modelResult] = await connection.execute(
          'SELECT name FROM models WHERE id = ?',
          [product.model_id]
        )
        const [colorResult] = await connection.execute(
          'SELECT name FROM colors WHERE id = ?',
          [product.color_id]
        )
        const [memoryResult] = await connection.execute(
          'SELECT size FROM memories WHERE id = ?',
          [product.memory_id]
        )

        const brandName = brandResult[0]?.name || ''
        const modelName = modelResult[0]?.name || ''
        const colorName = colorResult[0]?.name || ''
        const memoryName = memoryResult[0]?.size || ''

        // 检查IMEI是否已存在 - 只检查在库状态，允许回收已售商品重新入库
        const [existingPhones] = await connection.execute(
          'SELECT id, status FROM phones WHERE imei = ?',
          [product.imei]
        )

        // 只有在库状态才报错，已售出的商品可以回收后重新入库
        if (existingPhones.length > 0) {
          const existingPhone = existingPhones[0]
          if (existingPhone.status === 'in_stock') {
            await connection.rollback()
            return ApiResponse.badRequest(res, `第${i + 1}行商品IMEI号已在库中，无法重复入库`)
          }
          // 如果是已售出或其他状态，允许重新入库（回收商品）
          log.debug(`ℹ️  IMEI ${product.imei} 已存在但状态为 ${existingPhone.status}，允许回收入库`)
        }

        // 插入phones表 - 使用基本的必需字段
        // 确保所有ID字段都有效，如果为null则设为null
        const insertValues = [
          purchase_number,
          inventoryOperatorId, // 记录入库操作员ID
          product.brand_id || null,
          product.model_id || null,
          product.color_id || null,
          product.memory_id || null,
          product.imei,
          product.serial_number || '',
          product.purchase_cost,
          // sale_price: 如果前端传了 sale_price 则使用，否则为 null（显示"电询"）
          (product.sale_price !== undefined && product.sale_price !== null && product.sale_price > 0)
            ? product.sale_price
            : null,
          condition === '全新' ? 1 : 0,
          supplier_id,
          store_id,
          'in_stock',
          condition === '全新' ? 'A' : 'B', // quality_grade
          finalRemarks,
          inventoryTime,
          null  // sale_time 在入库时为空
        ]

        log.debug('📝 插入phones表的数据:', {
          purchase_number,
          inventoryOperatorId,
          brand_id: product.brand_id,
          model_id: product.model_id,
          color_id: product.color_id,
          memory_id: product.memory_id,
          imei: product.imei
        })

        const [insertResult] = await connection.execute(
          `INSERT INTO phones (
            purchase_number, inventory_operator_id, brand_id, model_id, color_id, memory_id,
            imei, serial_number, purchase_cost, sale_price, is_new, supplier_id, store_id, status,
            quality_grade, remarks, inventory_time, sale_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          insertValues
        )

        const phoneId = insertResult.insertId

        // 如果是二手商品，同时创建 H5_product 记录
        if (condition === '二手') {
          const isPublished = product.is_published !== undefined ? product.is_published : 1
          await connection.execute(
            `INSERT INTO H5_product (phone_id, is_published, created_at, updated_at) VALUES (?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE is_published = VALUES(is_published), updated_at = NOW()`,
            [phoneId, isPublished]
          )
          log.debug(`✅ 创建 H5_product 记录: phone_id=${phoneId}, is_published=${isPublished}`)
        }

        insertedProducts.push({
          id: phoneId,
          brand_id: product.brand_id || null,
          model_id: product.model_id || null,
          color_id: product.color_id || null,
          memory_id: product.memory_id || null,
          store_id: store_id || null,
          brand_name: brandName,
          model_name: modelName,
          color_name: colorName,
          memory_name: memoryName,
          imei: product.imei,
          serial_number: product.serial_number,
          purchase_cost: product.purchase_cost,
          is_new: condition === '全新' ? 1 : 0
        })
      }

      // 提交事务
      await connection.commit()

      // 检查是否有匹配的待匹配预定单，并自动匹配
      const _matchablePreorders = []
      const autoMatchedPreorders = []

      for (const product of insertedProducts) {
        try {
          const brandId = product.brand_id || null
          const modelId = product.model_id || null
          const colorId = product.color_id || null
          const memoryId = product.memory_id || null

          // 查找匹配的待匹配预定单（不限制店铺）
          const [preorderResult] = await connection.execute(`
            SELECT
              p.id,
              p.preorder_number,
              p.customer_id,
              c.name AS customer_name,
              c.phone AS customer_phone,
              p.brand_id,
              p.model_id,
              p.color_id,
              p.memory_id,
              p.is_new,
              p.deposit_amount,
              p.total_price
            FROM preorders p
            LEFT JOIN customers c ON c.id = p.customer_id
            WHERE p.status = 'pending'
              AND p.brand_id = ?
              AND p.model_id = ?
              AND p.color_id = ?
              AND p.memory_id = ?
              AND p.is_new = ?
            ORDER BY p.created_at ASC
            LIMIT 1
          `, [brandId, modelId, colorId, memoryId, product.is_new])

          if (preorderResult.length > 0) {
            const preorder = preorderResult[0]

            // 自动匹配：更新预定单状态
            await connection.execute(`
              UPDATE preorders SET
                status = 'arrived',
                matched_phone_id = ?,
                imei = ?,
                matched_time = NOW(),
                updated_at = NOW()
              WHERE id = ?
            `, [product.id, product.imei, preorder.id])

            // 标记手机为已预定
            await connection.execute(`
              UPDATE phones SET is_preordered = 1
              WHERE id = ?
            `, [product.id])

            autoMatchedPreorders.push({
              preorder_id: preorder.id,
              preorder_number: preorder.preorder_number,
              customer_name: preorder.customer_name,
              phone_id: product.id,
              imei: product.imei
            })

            log.debug(`✅ 自动匹配预定单: ${preorder.preorder_number} -> IMEI: ${product.imei}`)
          }
        } catch (matchError) {
          log.warn('自动匹配预定单失败:', matchError)
        }
      }

      // 构建响应数据
      const responseData = {
        purchase_number,
        supplier_id,
        store_id,
        inventory_time: inventoryTime,
        operator_name: actualOperatorName,
        condition,
        products: insertedProducts,
        total_count: products.length,
        total_amount: products.reduce((sum, product) => sum + Number(product.purchase_cost), 0),
        remarks: finalRemarks
      }

      // 如果有自动匹配的预定单，添加到响应中
      if (autoMatchedPreorders.length > 0) {
        responseData.auto_matched_preorders = autoMatchedPreorders
        responseData.has_auto_matched = true
      }

      // 返回成功结果
      const successMessage = autoMatchedPreorders.length > 0
        ? `商品入库成功，已自动匹配 ${autoMatchedPreorders.length} 个预定单`
        : '商品入库成功'

      ApiResponse.success(res, responseData, successMessage)

    } catch (dbError) {
      await connection.rollback()
      throw dbError
    }

  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    log.error('创建入库记录失败:', error)
    ApiResponse.serverError(res, '创建入库记录失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 更新入库记录
router.put('/:id', unifiedAuth, requirePermission('stock-in:edit'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    // 获取数据库连接
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 检查记录是否存在
    const [existingRecords] = await connection.execute('SELECT id FROM phones WHERE id = ?', [id])
    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '入库记录不存在')
    }

    const updateData = req.body
    const updateFields = []
    const updateValues = []

    // 构建更新字段
    if (updateData.brand_id !== undefined) {
      updateFields.push('brand_id = ?')
      updateValues.push(updateData.brand_id)
    }

    if (updateData.model_id !== undefined) {
      updateFields.push('model_id = ?')
      updateValues.push(updateData.model_id)
    }

    if (updateData.color_id !== undefined) {
      updateFields.push('color_id = ?')
      updateValues.push(updateData.color_id)
    }

    if (updateData.memory_id !== undefined) {
      updateFields.push('memory_id = ?')
      updateValues.push(updateData.memory_id)
    }

    if (updateData.imei !== undefined) {
      updateFields.push('imei = ?')
      updateValues.push(updateData.imei)
    }

    if (updateData.serial_number !== undefined) {
      updateFields.push('serial_number = ?')
      updateValues.push(updateData.serial_number)
    }

    if (updateData.purchase_cost !== undefined) {
      updateFields.push('purchase_cost = ?')
      updateValues.push(updateData.purchase_cost)
    }

    if (updateData.inventory_time !== undefined) {
      updateFields.push('inventory_time = ?')
      updateValues.push(updateData.inventory_time)
    }

    if (updateData.sale_price !== undefined) {
      updateFields.push('sale_price = ?')
      updateValues.push(updateData.sale_price)
    }

    if (updateData.is_new !== undefined) {
      // 支持 '全新'/'二手' 字符串或 1/0 数字
      if (updateData.is_new === '全新') {
        updateFields.push('is_new = ?')
        updateValues.push(1)
      } else if (updateData.is_new === '二手') {
        updateFields.push('is_new = ?')
        updateValues.push(0)
      } else {
        updateFields.push('is_new = ?')
        updateValues.push(updateData.is_new)
      }
    }

    if (updateData.status !== undefined) {
      updateFields.push('status = ?')
      updateValues.push(updateData.status)
    }

    if (updateData.store_id !== undefined) {
      updateFields.push('store_id = ?')
      updateValues.push(updateData.store_id)
    }

    if (updateData.supplier_id !== undefined) {
      updateFields.push('supplier_id = ?')
      updateValues.push(updateData.supplier_id)
    }

    if (updateData.remarks !== undefined) {
      updateFields.push('remarks = ?')
      updateValues.push(updateData.remarks)
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段')
    }

    updateValues.push(id)

    // 执行更新
    const updateQuery = `
      UPDATE phones
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `

    await connection.execute(updateQuery, updateValues)

    // 获取更新后的记录
    const [updatedRecords] = await connection.execute(`
      SELECT
        id,
        brand_id,
        model_id,
        color_id,
        memory_id,
        imei,
        serial_number,
        is_new,
        status,
        supplier_id,
        store_id,
        purchase_cost,
        sale_price,
        inventory_time AS inventory_time,
        sale_time AS sale_time,
        inventory_operator_id,
        sale_operator_id,
        purchase_number,
        remarks
      FROM phones
      WHERE id = ?
    `, [id])

    ApiResponse.success(res, updatedRecords[0], '入库记录更新成功')
  } catch (error) {
    log.error('更新入库记录失败:', error)
    ApiResponse.serverError(res, '更新入库记录失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

// 删除入库记录
router.delete('/:id', unifiedAuth, requirePermission('stock-in:delete'), async (req, res) => {
  let connection
  try {
    const { id } = req.params

    // 获取数据库连接
    const pool = require('../config/database').getDatabase()
    connection = await pool.getConnection()

    // 检查记录是否存在
    const [existingRecords] = await connection.execute('SELECT id FROM phones WHERE id = ?', [id])
    if (existingRecords.length === 0) {
      return ApiResponse.notFound(res, '入库记录不存在')
    }

    // 删除记录
    await connection.execute('DELETE FROM phones WHERE id = ?', [id])

    ApiResponse.success(res, {
      id: parseInt(id),
      deleted: true
    }, '入库记录删除成功')
  } catch (error) {
    log.error('删除入库记录失败:', error)
    ApiResponse.serverError(res, '删除入库记录失败', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
})

module.exports = router
