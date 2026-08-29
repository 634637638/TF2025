const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const { getDatabase, isConnected } = require('../config/database')
const { cacheMiddleware, clearCache } = require('../middleware/cache')
const { CACHE_TTL, PAGINATION } = require('../config/constants')
const log = require('../utils/log')
const { parseStatusFilter } = require('../utils/status')

const MODEL_COLUMNS = 'm.id, m.brand_id, m.name, m.status, m.sort_order, m.created_at, m.updated_at'
const MODEL_COLUMNS_WITH_BRAND = `${MODEL_COLUMNS}, b.name AS brand_name`

const formatModel = row => ({
  id: Number(row.id),
  brand_id: Number(row.brand_id),
  ...(row.brand_name !== undefined ? { brand_name: String(row.brand_name || '').trim() } : {}),
  name: String(row.name || '').trim(),
  status: Number(row.status) || 0,
  sort_order: Number(row.sort_order) || 0,
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
})

const clearModelsRouteCache = () => {
  try {
    clearCache('/api/models')
  } catch (error) {
    log.warn('清理型号缓存失败:', error.message)
  }
}

// 获取型号列表
router.get('/', unifiedAuth, requirePermission('models:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      page = PAGINATION.DEFAULT_PAGE,
      page_size = PAGINATION.DEFAULT_LIMIT,
      brand_id,
      name,
      status,
      sort_by,
      sort_order
    } = req.query

    const pageSizeNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(page_size) || PAGINATION.DEFAULT_LIMIT))
    const pageNum = parseInt(page) || PAGINATION.DEFAULT_PAGE
    const offset = (pageNum - 1) * pageSizeNum

    // 使用JOIN查询，直接关联品牌表
    let baseQuery = `
      SELECT
        ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m
      LEFT JOIN brands b ON m.brand_id = b.id
    `
    let baseCountQuery = `
      SELECT COUNT(*) as total
      FROM models m
    `

    // 构建WHERE条件
    const conditions = []
    const queryParams = []

    if (brand_id) {
      conditions.push('m.brand_id = ?')
      queryParams.push(brand_id)
    }

    // 状态筛选
    const statusFilter = parseStatusFilter(status)
    if (statusFilter !== null) {
      conditions.push('m.status = ?')
      queryParams.push(statusFilter)
    }

    // 搜索（使用表别名 m. 避免与 brands.name 冲突）
    if (name) {
      conditions.push('m.name LIKE ?')
      queryParams.push(`%${name}%`)
    }

    // 添加WHERE子句
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ')
      baseCountQuery += ' WHERE ' + conditions.join(' AND ')
    }

    // 排序（使用表别名 m. 避免歧义）
    const validSortColumns = ['id', 'name', 'sort_order', 'created_at', 'updated_at', 'brand_id']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'sort_order'
    const sortDirection = String(sort_order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const fallbackOrder = sortColumn === 'sort_order'
      ? ', m.name ASC, m.id ASC'
      : ', m.sort_order ASC, m.name ASC, m.id ASC'
    baseQuery += ` ORDER BY m.${sortColumn} ${sortDirection}${fallbackOrder}`

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`

    // 执行查询
    const [[models], [countResult]] = await Promise.all([
      pool.execute(finalQuery, queryParams),
      pool.execute(baseCountQuery, queryParams)
    ])
    const total = Number(countResult[0].total) || 0
    const total_pages = Math.ceil(total / pageSizeNum)

    ApiResponse.success(res, {
      models: models.map(formatModel),
      pagination: {
        page: pageNum,
        page_size: pageSizeNum,
        total,
        total_pages,
        has_next: pageNum < total_pages,
        has_prev: pageNum > 1
      }
    })
  } catch (error) {
    log.error('获取型号列表失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '获取型号列表失败', error)
  }
})

// 根据品牌ID获取型号列表
router.get('/brand/:brandId', unifiedAuth, requirePermission('models:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { brandId } = req.params
    const pool = getDatabase()
    const {
      page = 1,
      page_size = PAGINATION.DEFAULT_LIMIT,
      name,
      status,
      sort_by,
      sort_order
    } = req.query

    const pageSizeNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(page_size) || PAGINATION.DEFAULT_LIMIT))
    const pageNum = parseInt(page) || 1
    const offset = (pageNum - 1) * pageSizeNum

    // 构建WHERE条件
    const conditions = ['m.brand_id = ?']
    const queryParams = [parseInt(brandId)]

    // 状态筛选
    let statusFilter = null
    if (status !== undefined && status !== '') {
      statusFilter = parseStatusFilter(status)
      conditions.push('m.status = ?')
      queryParams.push(statusFilter)
    }

    // 搜索
    if (name) {
      conditions.push('m.name LIKE ?')
      queryParams.push(`%${name}%`)
    }

    // 构建查询
    let baseQuery = `
      SELECT ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE ${conditions.join(' AND ')}
    `
    const baseCountQuery = 'SELECT COUNT(*) as total FROM models m WHERE ' + conditions.join(' AND ')

    // 排序
    const validSortColumns = ['id', 'name', 'sort_order', 'created_at', 'updated_at']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'sort_order'
    const sortDirection = String(sort_order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const fallbackOrder = sortColumn === 'sort_order'
      ? ', m.name ASC, m.id ASC'
      : ', m.sort_order ASC, m.name ASC, m.id ASC'
    baseQuery += ` ORDER BY m.${sortColumn} ${sortDirection}${fallbackOrder}`

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`

    // 执行查询
    const [[models], [countResult]] = await Promise.all([
      pool.execute(finalQuery, queryParams),
      pool.execute(baseCountQuery, queryParams)
    ])
    const total = Number(countResult[0].total) || 0
    const total_pages = Math.ceil(total / pageSizeNum)

    ApiResponse.success(res, {
      models: models.map(formatModel),
      pagination: {
        page: pageNum,
        page_size: pageSizeNum,
        total,
        total_pages,
        has_next: pageNum < total_pages,
        has_prev: pageNum > 1
      }
    })
  } catch (error) {
    log.error('根据品牌ID获取型号列表失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '获取型号列表失败', error)
  }
})

// 获取型号统计信息。该静态路由必须位于 /:id 之前。
router.get('/stats/overview', unifiedAuth, requirePermission('models:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { brand_id } = req.query
    const pool = getDatabase()
    const conditions = []
    const queryParams = []

    if (brand_id) {
      conditions.push('m.brand_id = ?')
      queryParams.push(parseInt(brand_id))
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const [models] = await pool.execute(`
      SELECT ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      ${whereClause}
      ORDER BY m.created_at DESC, m.id DESC
    `, queryParams)
    const by_brand = {}

    for (const model of models) {
      const brand_name = String(model.brand_name || `品牌${model.brand_id}`)
      by_brand[brand_name] = (by_brand[brand_name] || 0) + 1
    }

    ApiResponse.success(res, {
      total: models.length,
      active: models.filter(model => Number(model.status) === 1).length,
      inactive: models.filter(model => Number(model.status) === 0).length,
      related_brands: new Set(models.map(model => Number(model.brand_id))).size,
      by_brand,
      newest_model: models.length > 0 ? String(models[0].name || '') : null
    })
  } catch (error) {
    log.error('获取型号统计失败:', error)
    ApiResponse.serverError(res, '获取型号统计失败', error)
  }
})

// 获取单个型号详情
router.get('/:id', unifiedAuth, requirePermission('models:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    const [models] = await pool.execute(`
      SELECT ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE m.id = ?
    `, [parseInt(id)])

    if (models.length === 0) {
      return ApiResponse.notFound(res, '型号不存在')
    }

    ApiResponse.success(res, formatModel(models[0]))
  } catch (error) {
    log.error('获取型号详情失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '获取型号详情失败', error)
  }
})

// 创建型号
router.post('/', unifiedAuth, requirePermission('models:create'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      brand_id,
      name,
      status,
      sort_order
    } = req.body

    // 验证必需字段
    if (!brand_id || !name) {
      return ApiResponse.badRequest(res, '品牌ID和型号名称不能为空')
    }

    // 检查型号名称是否重复
    const [existingModels] = await pool.execute(
      'SELECT id FROM models WHERE name = ? AND brand_id = ?',
      [name, parseInt(brand_id)]
    )
    if (existingModels.length > 0) {
      return ApiResponse.badRequest(res, '该品牌下已存在相同型号名称')
    }

    // 插入新型号
    const insertQuery = `
      INSERT INTO models (
        brand_id, name, status, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `

    const insertValues = [
      parseInt(brand_id),
      name,
      status !== undefined ? parseInt(status) : 1,
      sort_order !== undefined ? parseInt(sort_order) : 0
    ]

    const [result] = await pool.execute(insertQuery, insertValues)

    // 获取新创建的型号
    const [newModels] = await pool.execute(`
      SELECT ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE m.id = ?
    `, [result.insertId])
    const newModel = formatModel(newModels[0])

    clearModelsRouteCache()
    ApiResponse.created(res, '型号创建成功', newModel)
  } catch (error) {
    log.error('创建型号失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '创建型号失败', error)
  }
})

// 更新型号
router.put('/:id', unifiedAuth, requirePermission('models:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查型号是否存在
    const [existingModels] = await pool.execute(`
      SELECT ${MODEL_COLUMNS}
      FROM models m
      WHERE m.id = ?
    `, [parseInt(id)])
    if (existingModels.length === 0) {
      return ApiResponse.notFound(res, '型号不存在')
    }

    const {
      brand_id,
      name,
      status,
      sort_order
    } = req.body

    // 检查型号名称是否重复（排除当前型号）
    if (name !== undefined || brand_id !== undefined) {
      const nextName = name !== undefined ? name : existingModels[0].name
      const nextBrandId = brand_id !== undefined ? parseInt(brand_id) : Number(existingModels[0].brand_id)
      const [duplicateModels] = await pool.execute(
        'SELECT id FROM models WHERE name = ? AND brand_id = ? AND id != ?',
        [nextName, nextBrandId, parseInt(id)]
      )
      if (duplicateModels.length > 0) {
        return ApiResponse.badRequest(res, '该品牌下已存在相同型号名称')
      }
    }

    // 构建更新字段
    const updateFields = []
    const updateValues = []

    if (brand_id !== undefined) {
      updateFields.push('brand_id = ?')
      updateValues.push(parseInt(brand_id))
    }
    if (name !== undefined) {
      updateFields.push('name = ?')
      updateValues.push(name)
    }
    if (status !== undefined) {
      updateFields.push('status = ?')
      updateValues.push(parseInt(status))
    }
    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?')
      updateValues.push(parseInt(sort_order))
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有要更新的字段')
    }

    // 添加更新时间
    updateFields.push('updated_at = CURRENT_TIMESTAMP')

    // 添加ID到WHERE条件
    updateValues.push(parseInt(id))

    const updateQuery = `UPDATE models SET ${updateFields.join(', ')} WHERE id = ?`

    await pool.execute(updateQuery, updateValues)

    // 获取更新后的数据
    const [updatedModels] = await pool.execute(`
      SELECT ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE m.id = ?
    `, [parseInt(id)])
    const updatedModel = formatModel(updatedModels[0])

    clearModelsRouteCache()
    ApiResponse.success(res, updatedModel, '型号更新成功')
  } catch (error) {
    log.error('更新型号失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '更新型号失败', error)
  }
})

// 删除型号
router.delete('/:id', unifiedAuth, requirePermission('models:delete'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查型号是否存在
    const [existingModels] = await pool.execute(`
      SELECT ${MODEL_COLUMNS}
      FROM models m
      WHERE m.id = ?
    `, [parseInt(id)])
    if (existingModels.length === 0) {
      return ApiResponse.notFound(res, '型号不存在')
    }

    // 删除型号
    await pool.execute('DELETE FROM models WHERE id = ?', [parseInt(id)])

    clearModelsRouteCache()
    ApiResponse.success(res, formatModel(existingModels[0]), '型号删除成功')
  } catch (error) {
    log.error('删除型号失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '删除型号失败', error)
  }
})

// 切换型号状态
router.patch('/:id/toggle', unifiedAuth, requirePermission('models:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查型号是否存在
    const [existingModels] = await pool.execute(`
      SELECT ${MODEL_COLUMNS}
      FROM models m
      WHERE m.id = ?
    `, [parseInt(id)])
    if (existingModels.length === 0) {
      return ApiResponse.notFound(res, '型号不存在')
    }

    const currentModel = existingModels[0]
    const newStatus = currentModel.status === 1 ? 0 : 1

    // 更新状态
    await pool.execute(
      'UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, parseInt(id)]
    )

    // 获取更新后的数据
    const [updatedModels] = await pool.execute(`
      SELECT ${MODEL_COLUMNS_WITH_BRAND}
      FROM models m
      LEFT JOIN brands b ON b.id = m.brand_id
      WHERE m.id = ?
    `, [parseInt(id)])
    const updatedModel = formatModel(updatedModels[0])

    const statusText = newStatus === 1 ? '启用' : '禁用'
    clearModelsRouteCache()
    ApiResponse.success(res, updatedModel, `型号${statusText}成功`)
  } catch (error) {
    log.error('切换型号状态失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '切换型号状态失败', error)
  }
})

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('models:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, '请提供有效的排序数据', 400)
    }

    const pool = getDatabase()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      for (const item of items) {
        if (item.id !== undefined && item.sort_order !== undefined) {
          await connection.execute(
            'UPDATE models SET sort_order = ? WHERE id = ?',
            [item.sort_order, item.id]
          )
        }
      }

      await connection.commit()
      clearModelsRouteCache()
      ApiResponse.success(res, null, '排序更新成功')

    } catch (error) {
      await connection.rollback()
      log.error('批量更新排序失败:', error)
      ApiResponse.error(res, '批量更新排序失败', 500)
    } finally {
      connection.release()
    }
  } catch (error) {
    log.error('批量更新排序失败:', error)
    ApiResponse.error(res, '批量更新排序失败', 500)
  }
})

module.exports = router
