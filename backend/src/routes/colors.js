const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const { devPermissionCheck } = require('../middleware/dev-permission')
const ApiResponse = require('../utils/response')
const { getDatabase, isConnected } = require('../config/database')
const { cacheMiddleware, clearCache } = require('../middleware/cache')
const { CACHE_TTL, PAGINATION } = require('../config/constants')
const log = require('../utils/log')
const { parseStatusFilter } = require('../utils/status')

const COLOR_COLUMNS = 'id, name, status, sort_order, created_at, updated_at'

const formatColor = row => ({
  id: Number(row.id),
  name: String(row.name || '').trim(),
  status: Number(row.status) || 0,
  sort_order: Number(row.sort_order) || 0,
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
})

const clearColorsRouteCache = () => {
  try {
    clearCache('/api/colors')
    clearCache('/api/public/colors')
  } catch (error) {
    log.warn('清理颜色缓存失败:', error.message)
  }
}

// 获取颜色列表
router.get('/', unifiedAuth, devPermissionCheck('colors:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  try {
    log.debug('获取颜色列表请求，参数:', req.query)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      page = PAGINATION.DEFAULT_PAGE,
      page_size = PAGINATION.DEFAULT_LIMIT,
      name,
      status,
      sort_by,
      sort_order
    } = req.query

    const pageSizeNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(page_size) || PAGINATION.DEFAULT_LIMIT))
    const pageNum = parseInt(page) || PAGINATION.DEFAULT_PAGE
    const offset = (pageNum - 1) * pageSizeNum

    let baseQuery = `SELECT ${COLOR_COLUMNS} FROM colors`
    let baseCountQuery = 'SELECT COUNT(*) as total FROM colors'

    // 构建WHERE条件
    const conditions = []
    const queryParams = []

    // 状态筛选
    const statusFilter = parseStatusFilter(status)
    if (statusFilter !== null) {
      conditions.push('status = ?')
      queryParams.push(statusFilter)
    }

    if (name) {
      conditions.push('name LIKE ?')
      queryParams.push(`%${name}%`)
    }

    // 添加WHERE子句
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ')
      baseCountQuery += ' WHERE ' + conditions.join(' AND ')
    }

    // 排序
    const validSortColumns = ['id', 'name', 'created_at', 'updated_at', 'sort_order']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'sort_order'
    const sortDirection = String(sort_order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const fallbackOrder = sortColumn === 'sort_order'
      ? ', name ASC, id ASC'
      : ', sort_order ASC, name ASC, id ASC'
    baseQuery += ` ORDER BY ${sortColumn} ${sortDirection}${fallbackOrder}`

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`

    log.debug('执行SQL查询:', finalQuery)
    log.debug('查询参数:', queryParams)

    // 执行查询
    const [[colors], [countResult]] = await Promise.all([
      pool.execute(finalQuery, queryParams),
      pool.execute(baseCountQuery, queryParams)
    ])
    const total = Number(countResult[0].total) || 0
    const total_pages = Math.ceil(total / pageSizeNum)

    log.debug(`查询结果: ${colors.length} 条记录，总数: ${total}`)

    ApiResponse.success(res, {
      colors: colors.map(formatColor),
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
    log.error('获取颜色列表失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '获取颜色列表失败', error)
  }
})

// 获取单个颜色详情
router.get('/:id(\\d+)', unifiedAuth, requirePermission('colors:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()
    const [colors] = await pool.execute(`SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`, [parseInt(id)])

    if (colors.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在')
    }

    ApiResponse.success(res, formatColor(colors[0]))
  } catch (error) {
    log.error('获取颜色详情失败:', error)
    ApiResponse.serverError(res, '获取颜色详情失败', error)
  }
})

// 创建颜色
router.post('/', unifiedAuth, requirePermission('colors:create'), async (req, res) => {
  try {
    log.debug('创建颜色请求，数据:', req.body)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      name,
      status,
      sort_order
    } = req.body

    // 验证必需字段 - 只验证数据库中实际存在的字段
    if (!name) {
      return ApiResponse.badRequest(res, '颜色名称不能为空')
    }

    // 检查颜色名称是否重复
    const trimmedName = name.trim()
    const [existingColors] = await pool.execute(
      'SELECT id FROM colors WHERE name = ?',
      [trimmedName]
    )
    if (existingColors.length > 0) {
      return ApiResponse.badRequest(res, '颜色名称已存在')
    }

    // 插入新颜色
    const insertQuery = `
      INSERT INTO colors (
        name, status, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `

    const insertValues = [
      trimmedName,
      status !== undefined ? parseInt(status) : 1,
      sort_order !== undefined ? parseInt(sort_order) : 0
    ]

    log.debug('执行插入SQL:', insertQuery)
    log.debug('插入参数:', insertValues)

    const [result] = await pool.execute(insertQuery, insertValues)

    // 获取新创建的颜色
    const [newColors] = await pool.execute(`SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`, [result.insertId])
    const newColor = formatColor(newColors[0])

    clearColorsRouteCache()
    ApiResponse.created(res, '颜色创建成功', newColor)
  } catch (error) {
    log.error('创建颜色失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '创建颜色失败', error)
  }
})

// 更新颜色
router.put('/:id', unifiedAuth, requirePermission('colors:edit'), async (req, res) => {
  try {
    const { id } = req.params

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      name,
      status,
      sort_order
    } = req.body

    // 检查颜色是否存在
    const [existingColors] = await pool.execute('SELECT id FROM colors WHERE id = ?', [id])
    if (existingColors.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在')
    }

    // 检查颜色名称是否重复（排除当前颜色）
    if (name) {
      const [duplicateCheck] = await pool.execute(
        'SELECT id FROM colors WHERE name = ? AND id != ?',
        [name.trim(), id]
      )
      if (duplicateCheck.length > 0) {
        return ApiResponse.badRequest(res, '颜色名称已存在')
      }
    }

    // 构建更新字段 - 只使用数据库中实际存在的字段
    const updateFields = []
    const updateValues = []

    if (name !== undefined) {
      updateFields.push('name = ?')
      updateValues.push(name.trim())
    }

    // 处理status字段（使用正确的字段名）
    if (status !== undefined) {
      updateFields.push('status = ?')
      updateValues.push(parseInt(status))
    }

    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?')
      updateValues.push(parseInt(sort_order))
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段')
    }

    // 添加更新时间
    updateFields.push('updated_at = NOW()')
    updateValues.push(id) // 为WHERE子句添加id

    // 执行更新
    const updateQuery = `UPDATE colors SET ${updateFields.join(', ')} WHERE id = ?`
    await pool.execute(updateQuery, updateValues)

    // 获取更新后的颜色信息
    const [updatedColor] = await pool.execute(`SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`, [id])

    clearColorsRouteCache()
    ApiResponse.success(res, formatColor(updatedColor[0]), '颜色更新成功')
  } catch (error) {
    log.error('更新颜色失败:', error)
    ApiResponse.serverError(res, '更新颜色失败', error)
  }
})

// 删除颜色
router.delete('/:id', unifiedAuth, requirePermission('colors:delete'), async (req, res) => {
  try {
    log.debug('删除颜色请求，ID:', req.params.id)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查颜色是否存在
    const [existingColors] = await pool.execute(`SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`, [parseInt(id)])
    if (existingColors.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在')
    }

    // 删除颜色
    await pool.execute('DELETE FROM colors WHERE id = ?', [parseInt(id)])

    clearColorsRouteCache()
    ApiResponse.success(res, formatColor(existingColors[0]), '颜色删除成功')
  } catch (error) {
    log.error('删除颜色失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '删除颜色失败', error)
  }
})

// 获取颜色统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('colors:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const conditions = []
    const params = []
    const name = String(req.query.name || '').trim()
    const status = String(req.query.status ?? '').trim()
    if (name) {
      conditions.push('c.name LIKE ?')
      params.push(`%${name}%`)
    }
    if (status !== '') {
      conditions.push('c.status = ?')
      params.push(Number(status) === 1 ? 1 : 0)
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [[colorStats], [phoneStats]] = await Promise.all([
      pool.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN c.status = 1 THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN c.status <> 1 OR c.status IS NULL THEN 1 ELSE 0 END) AS inactive
        FROM colors c
        ${whereClause}
      `, params),
      pool.execute(`
        SELECT COUNT(*) AS related_phones
        FROM phones p
        INNER JOIN colors c ON c.id = p.color_id
        ${whereClause}
      `, params)
    ])

    const stats = {
      total: Number(colorStats[0].total) || 0,
      active: Number(colorStats[0].active) || 0,
      inactive: Number(colorStats[0].inactive) || 0,
      related_phones: Number(phoneStats[0].related_phones) || 0
    }

    ApiResponse.success(res, stats)
  } catch (error) {
    log.error('获取颜色统计失败:', error)
    ApiResponse.serverError(res, '获取颜色统计失败', error)
  }
})

// 切换颜色状态
router.patch('/:id/toggle', unifiedAuth, requirePermission('colors:edit'), async (req, res) => {
  try {
    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()
    const [existingColors] = await pool.execute(`SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`, [parseInt(id)])

    if (existingColors.length === 0) {
      return ApiResponse.notFound(res, '颜色不存在')
    }

    const newStatus = existingColors[0].status === 1 ? 0 : 1
    await pool.execute(
      'UPDATE colors SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, parseInt(id)]
    )

    const [updatedColors] = await pool.execute(`SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`, [parseInt(id)])
    const statusText = newStatus === 1 ? '启用' : '禁用'
    clearColorsRouteCache()
    ApiResponse.success(res, formatColor(updatedColors[0]), `颜色${statusText}成功`)
  } catch (error) {
    log.error('切换颜色状态失败:', error)
    ApiResponse.serverError(res, '切换颜色状态失败', error)
  }
})

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('colors:edit'), async (req, res) => {
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
            'UPDATE colors SET sort_order = ? WHERE id = ?',
            [item.sort_order, item.id]
          )
        }
      }

      await connection.commit()
      clearColorsRouteCache()
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
