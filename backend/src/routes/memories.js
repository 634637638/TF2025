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

const MEMORY_COLUMNS = 'id, size, status, sort_order, created_at, updated_at'

const formatMemory = row => {
  const size = String(row.size || '').trim()
  const storagePart = size.includes('+') ? size.split('+').pop() : size
  const storageMatch = String(storagePart || '').match(/^(\d+)([A-Za-z]+)?$/)

  return {
    id: Number(row.id),
    size,
    storage_size: storageMatch ? Number(storageMatch[1]) : null,
    storage_unit: storageMatch?.[2] ? storageMatch[2].toUpperCase() : null,
    is_combo: size.includes('+'),
    status: Number(row.status) || 0,
    sort_order: Number(row.sort_order) || 0,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  }
}

const clearMemoriesRouteCache = () => {
  try {
    clearCache('/api/memories')
    clearCache('/api/public/memories')
  } catch (error) {
    log.warn('清理内存缓存失败:', error.message)
  }
}

// 获取内存规格列表
router.get('/', unifiedAuth, devPermissionCheck('memories:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  try {
    log.debug('获取内存规格列表请求，参数:', req.query)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      page = PAGINATION.DEFAULT_PAGE,
      page_size = PAGINATION.DEFAULT_LIMIT,
      size,
      storage_unit,
      status,
      sort_by,
      sort_order
    } = req.query

    const pageSizeNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(page_size) || PAGINATION.DEFAULT_LIMIT))
    const pageNum = parseInt(page) || PAGINATION.DEFAULT_PAGE
    const offset = (pageNum - 1) * pageSizeNum

    let baseQuery = `SELECT ${MEMORY_COLUMNS} FROM memories`
    let baseCountQuery = 'SELECT COUNT(*) as total FROM memories'

    // 构建WHERE条件
    const conditions = []
    const queryParams = []

    // 存储单位筛选（从size字段中提取）
    if (storage_unit) {
      conditions.push('size LIKE ?')
      queryParams.push(`%${storage_unit}`)
    }

    // 状态筛选
    const statusFilter = parseStatusFilter(status)
    if (statusFilter !== null) {
      conditions.push('status = ?')
      queryParams.push(statusFilter)
    }

    if (size) {
      conditions.push('size LIKE ?')
      queryParams.push(`%${size}%`)
    }

    // 添加WHERE子句
    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ')
      baseCountQuery += ' WHERE ' + conditions.join(' AND ')
    }

    // 排序
    const validSortColumns = ['id', 'size', 'created_at', 'updated_at', 'sort_order', 'status']
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'sort_order'
    const sortDirection = String(sort_order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const fallbackOrder = sortColumn === 'sort_order'
      ? ', size ASC, id ASC'
      : ', sort_order ASC, size ASC, id ASC'
    baseQuery += ` ORDER BY ${sortColumn} ${sortDirection}${fallbackOrder}`

    // 分页
    const finalQuery = `${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`

    log.debug('执行SQL查询:', finalQuery)
    log.debug('查询参数:', queryParams)

    // 执行查询
    const [[memories], [countResult]] = await Promise.all([
      pool.execute(finalQuery, queryParams),
      pool.execute(baseCountQuery, queryParams)
    ])
    const total = Number(countResult[0].total) || 0
    const total_pages = Math.ceil(total / pageSizeNum)

    log.debug(`查询结果: ${memories.length} 条记录，总数: ${total}`)

    ApiResponse.success(res, {
      memories: memories.map(formatMemory),
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
    log.error('获取内存规格列表失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '获取内存规格列表失败', error)
  }
})

// 获取单个内存规格详情
router.get('/:id(\\d+)', unifiedAuth, requirePermission('memories:view'), async (req, res) => {
  try {
    log.debug('获取内存规格详情请求，ID:', req.params.id)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    const [memories] = await pool.execute(`SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [parseInt(id)])

    if (memories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在')
    }

    ApiResponse.success(res, formatMemory(memories[0]))
  } catch (error) {
    log.error('获取内存规格详情失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '获取内存规格详情失败', error)
  }
})

// 创建内存规格
router.post('/', unifiedAuth, requirePermission('memories:create'), async (req, res) => {
  try {
    log.debug('创建内存规格请求，数据:', req.body)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      size, // 前端发送的字段，如 "6+128GB" 或 "64GB"
      sort_order,
      status
    } = req.body

    // 验证必需字段
    if (!size) {
      return ApiResponse.badRequest(res, '内存规格不能为空')
    }

    // 验证格式：支持数字+字母格式，如 "64GB"、"8+128GB"、"6+256GB" 等
    // 更严格的验证：必须是数字开头，后面跟着字母，中间可以有+号连接
    const validFormat = /^(\d+[a-zA-Z]+|\d+\+\d+[a-zA-Z]*)$/
    const trimmedSize = size.trim()

    if (!validFormat.test(trimmedSize)) {
      return ApiResponse.badRequest(res,
        '内存规格格式不正确！\n' +
        '正确格式示例：\n' +
        '• 纯存储：64GB、128GB、256GB、512GB\n' +
        '• 组合格式：6+128GB、8+256GB、12+512GB\n' +
        '• 不能包含中文或特殊字符（除+号外）'
      )
    }

    // 额外检查：确保不包含中文字符
    if (/[\u4e00-\u9fa5]/.test(trimmedSize)) {
      return ApiResponse.badRequest(res, '内存规格不能包含中文字符，请使用如：64GB、8+128GB 等格式')
    }

    // 检查是否有无效的字符（只允许数字、字母、+号）
    if (!/^[0-9a-zA-Z+]+$/.test(trimmedSize)) {
      return ApiResponse.badRequest(res, '内存规格包含无效字符，只能使用数字、字母和+号')
    }

    // 检查规格是否重复
    const [existingMemories] = await pool.execute(
      'SELECT id FROM memories WHERE size = ?',
      [trimmedSize]
    )
    if (existingMemories.length > 0) {
      return ApiResponse.badRequest(res, '该内存规格已存在')
    }

    // 插入新内存规格
    const insertQuery = `
      INSERT INTO memories (
        size, sort_order, status, created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `

    const insertValues = [
      trimmedSize,
      sort_order ? parseInt(sort_order) : 0,
      status !== undefined ? parseInt(status) : 1
    ]

    log.debug('执行插入SQL:', insertQuery)
    log.debug('插入参数:', insertValues)

    const [result] = await pool.execute(insertQuery, insertValues)

    // 获取新创建的内存规格
    const [newMemories] = await pool.execute(`SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [result.insertId])
    const newMemory = formatMemory(newMemories[0])

    clearMemoriesRouteCache()
    ApiResponse.created(res, '内存规格创建成功', newMemory)
  } catch (error) {
    log.error('创建内存规格失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '创建内存规格失败', error)
  }
})

// 更新内存规格
router.put('/:id', unifiedAuth, requirePermission('memories:edit'), async (req, res) => {
  try {
    const { id } = req.params

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const {
      size, // 前端发送的字段，如 "6+128GB" 或 "64GB"
      sort_order,
      status
    } = req.body
    const trimmedSize = size !== undefined ? size.trim() : undefined

    // 如果提供了size字段，验证格式
    if (size !== undefined) {
      // 更严格的验证：必须是数字开头，后面跟着字母，中间可以有+号连接
      const validFormat = /^(\d+[a-zA-Z]+|\d+\+\d+[a-zA-Z]*)$/

      if (!validFormat.test(trimmedSize)) {
        return ApiResponse.badRequest(res,
          '内存规格格式不正确！\n' +
          '正确格式示例：\n' +
          '• 纯存储：64GB、128GB、256GB、512GB\n' +
          '• 组合格式：6+128GB、8+256GB、12+512GB\n' +
          '• 不能包含中文或特殊字符（除+号外）'
        )
      }

      // 额外检查：确保不包含中文字符
      if (/[\u4e00-\u9fa5]/.test(trimmedSize)) {
        return ApiResponse.badRequest(res, '内存规格不能包含中文字符，请使用如：64GB、8+128GB 等格式')
      }

      // 检查是否有无效的字符（只允许数字、字母、+号）
      if (!/^[0-9a-zA-Z+]+$/.test(trimmedSize)) {
        return ApiResponse.badRequest(res, '内存规格包含无效字符，只能使用数字、字母和+号')
      }
    }

    // 检查内存是否存在
    const [existingMemories] = await pool.execute('SELECT id FROM memories WHERE id = ?', [id])
    if (existingMemories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在')
    }

    // 获取当前内存的size值，用于后续比较
    const [currentMemory] = await pool.execute('SELECT size FROM memories WHERE id = ?', [id])
    const currentSize = currentMemory[0]?.size

    // 构建更新字段
    const updateFields = []
    const updateValues = []

    // 如果size有变化，检查是否与其他记录重复
    if (size !== undefined && trimmedSize !== currentSize) {
      const [duplicateCheck] = await pool.execute(
        'SELECT id FROM memories WHERE size = ? AND id != ?',
        [trimmedSize, id]
      )

      if (duplicateCheck.length > 0) {
        return ApiResponse.error(res, `已有存在${trimmedSize}内存，请勿重复提交`, 409)
      }

      updateFields.push('size = ?')
      updateValues.push(trimmedSize)
    }

    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?')
      updateValues.push(parseInt(sort_order))
    }

    if (status !== undefined) {
      updateFields.push('status = ?')
      updateValues.push(parseInt(status))
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, '没有提供要更新的字段')
    }

    // 添加更新时间
    updateFields.push('updated_at = NOW()')
    updateValues.push(id) // 为WHERE子句添加id

    // 执行更新
    const updateQuery = `UPDATE memories SET ${updateFields.join(', ')} WHERE id = ?`
    await pool.execute(updateQuery, updateValues)

    // 获取更新后的内存规格信息
    const [updatedMemory] = await pool.execute(`SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [id])

    clearMemoriesRouteCache()
    return ApiResponse.success(res, formatMemory(updatedMemory[0]), '内存规格更新成功')
  } catch (error) {
    log.error('更新内存规格失败:', error)

    // 检查是否是唯一索引冲突错误
    if (error.code === 'ER_DUP_ENTRY' || error.code === 'DUPLICATE_ENTRY' || error.errno === 1062) {
      return ApiResponse.error(res, '已有存在该内存规格，请勿重复提交', 409)
    }

    ApiResponse.serverError(res, '更新内存规格失败', error)
  }
})

// 删除内存规格
router.delete('/:id', unifiedAuth, requirePermission('memories:delete'), async (req, res) => {
  try {
    log.debug('删除内存规格请求，ID:', req.params.id)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查内存规格是否存在
    const [existingMemories] = await pool.execute(`SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [parseInt(id)])
    if (existingMemories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在')
    }

    // 删除内存规格
    await pool.execute('DELETE FROM memories WHERE id = ?', [parseInt(id)])

    clearMemoriesRouteCache()
    ApiResponse.success(res, formatMemory(existingMemories[0]), '内存规格删除成功')
  } catch (error) {
    log.error('删除内存规格失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '删除内存规格失败', error)
  }
})

// 获取内存规格统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('memories:view'), async (req, res) => {
  try {
    log.debug('获取内存规格统计信息请求，参数:', req.query)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const pool = getDatabase()
    const conditions = []
    const params = []
    const size = String(req.query.size || '').trim()
    const storageUnit = String(req.query.storage_unit || '').trim()
    const status = String(req.query.status ?? '').trim()
    if (storageUnit) {
      conditions.push('m.size LIKE ?')
      params.push(`%${storageUnit}`)
    }
    if (status !== '') {
      conditions.push('m.status = ?')
      params.push(Number(status) === 1 ? 1 : 0)
    }
    if (size) {
      conditions.push('m.size LIKE ?')
      params.push(`%${size}%`)
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [[memoryStats], [phoneStats]] = await Promise.all([
      pool.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN m.status = 1 THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN m.status <> 1 OR m.status IS NULL THEN 1 ELSE 0 END) AS inactive
        FROM memories m
        ${whereClause}
      `, params),
      pool.execute(`
        SELECT COUNT(*) AS related_phones
        FROM phones p
        INNER JOIN memories m ON m.id = p.memory_id
        ${whereClause}
      `, params)
    ])

    const stats = {
      total: Number(memoryStats[0].total) || 0,
      active: Number(memoryStats[0].active) || 0,
      inactive: Number(memoryStats[0].inactive) || 0,
      related_phones: Number(phoneStats[0].related_phones) || 0
    }

    ApiResponse.success(res, stats)
  } catch (error) {
    log.error('获取内存规格统计失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '获取内存规格统计失败', error)
  }
})

// 切换内存规格状态
router.patch('/:id/toggle', unifiedAuth, requirePermission('memories:edit'), async (req, res) => {
  try {
    log.debug('切换内存规格状态请求，ID:', req.params.id)

    if (!isConnected()) {
      return ApiResponse.error(res, '数据库未连接', 500)
    }

    const { id } = req.params
    const pool = getDatabase()

    // 检查内存规格是否存在
    const [existingMemories] = await pool.execute(`SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [parseInt(id)])
    if (existingMemories.length === 0) {
      return ApiResponse.notFound(res, '内存规格不存在')
    }

    const currentMemory = existingMemories[0]
    const newStatus = currentMemory.status === 1 ? 0 : 1

    // 更新状态
    await pool.execute(
      'UPDATE memories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, parseInt(id)]
    )

    // 获取更新后的数据
    const [updatedMemories] = await pool.execute(`SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [parseInt(id)])
    const updatedMemory = formatMemory(updatedMemories[0])

    const statusText = newStatus === 1 ? '启用' : '禁用'
    clearMemoriesRouteCache()
    ApiResponse.success(res, updatedMemory, `内存规格${statusText}成功`)
  } catch (error) {
    log.error('切换内存规格状态失败:', error)
    log.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    })
    ApiResponse.serverError(res, '切换内存规格状态失败', error)
  }
})

// 批量更新排序
router.put('/batch/reorder', unifiedAuth, requirePermission('memories:edit'), async (req, res) => {
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
            'UPDATE memories SET sort_order = ? WHERE id = ?',
            [item.sort_order, item.id]
          )
        }
      }

      await connection.commit()
      clearMemoriesRouteCache()
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
