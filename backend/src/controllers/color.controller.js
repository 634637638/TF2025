'use strict'

const ReferenceOrderingService = require('../services/reference-ordering.service')

const ColorRepository = require('../repositories/color.repository')
const { isConnected } = require('../config/database')
const { clearCache } = require('../middleware/cache')
const { PAGINATION } = require('../config/constants')
const { parseStatusFilter } = require('../utils/status')
const {
  normalizeReferencePagination,
  buildReferenceOrder,
  buildPagination
} = require('../services/reference-options.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

const COLOR_COLUMNS = 'id, name, status, sort_order, created_at, updated_at'

const formatColor = row => ({
  id: Number(row.id),
  name: String(row.name || '').trim(),
  status: Number(row.status) || 0,
  sort_order: Number(row.sort_order) || 0,
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
})

const clearColorsCache = () => {
  try {
    clearCache('/api/colors')
    clearCache('/api/public/colors')
  } catch (error) {
    log.warn('清理颜色缓存失败:', error.message)
  }
}

class ColorController {
  constructor({
    repository = new ColorRepository(),
    isDatabaseConnected = isConnected,
    invalidateCache = clearColorsCache
  } = {}) {
    this.repository = repository
    this.orderingService = new ReferenceOrderingService({ repository, domain: 'colors' })
    this.isDatabaseConnected = isDatabaseConnected
    this.invalidateCache = invalidateCache
  }

  clearCache() {
    return this.invalidateCache()
  }

  async list(req, res) {
    try {
      log.debug('获取颜色列表请求，参数:', req.query)
      if (!this.isDatabaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const {
        page = PAGINATION.DEFAULT_PAGE,
        page_size = PAGINATION.DEFAULT_LIMIT,
        name,
        status,
        sort_by,
        sort_order,
        all = false
      } = req.query
      const { page: pageNum, page_size: pageSizeNum, offset } = normalizeReferencePagination({
        page,
        page_size,
        defaultPage: PAGINATION.DEFAULT_PAGE,
        defaultPageSize: PAGINATION.DEFAULT_LIMIT,
        maxPageSize: PAGINATION.MAX_LIMIT
      })

      let baseQuery = `SELECT ${COLOR_COLUMNS} FROM colors`
      let baseCountQuery = 'SELECT COUNT(*) as total FROM colors'
      const conditions = []
      const queryParams = []
      const statusFilter = parseStatusFilter(status)
      if (statusFilter !== null) {
        conditions.push('status = ?')
        queryParams.push(statusFilter)
      }
      if (name) {
        conditions.push('name LIKE ?')
        queryParams.push(`%${name}%`)
      }

      if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ')
        baseCountQuery += ' WHERE ' + conditions.join(' AND ')
      }
      baseQuery += ` ORDER BY ${buildReferenceOrder({
        sort_by,
        sort_order,
        allowed: ['id', 'name', 'created_at', 'updated_at', 'sort_order'],
        fallback: ['sort_order', 'name', 'id']
      })}`

      const returnAll = all === 'true' || all === true
      const finalQuery = returnAll ? baseQuery : `${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`
      log.debug('执行SQL查询:', finalQuery)
      log.debug('查询参数:', queryParams)
      const [[colors], [countResult]] = await Promise.all([
        this.repository.executePrepared(finalQuery, queryParams),
        this.repository.executePrepared(baseCountQuery, queryParams)
      ])
      const total = Number(countResult[0].total) || 0
      if (returnAll) return ApiResponse.success(res, colors.map(formatColor))
      log.debug(`查询结果: ${colors.length} 条记录，总数: ${total}`)
      return ApiResponse.success(res, {
        colors: colors.map(formatColor),
        pagination: buildPagination(pageNum, pageSizeNum, total)
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
      return ApiResponse.serverError(res, '获取颜色列表失败', error)
    }
  }

  async get(req, res) {
    try {
      if (!this.isDatabaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const [colors] = await this.repository.executePrepared(
        `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
        [parseInt(req.params.id)]
      )
      if (colors.length === 0) return ApiResponse.notFound(res, '颜色不存在')
      return ApiResponse.success(res, formatColor(colors[0]))
    } catch (error) {
      log.error('获取颜色详情失败:', error)
      return ApiResponse.serverError(res, '获取颜色详情失败', error)
    }
  }

  async create(req, res) {
    try {
      log.debug('创建颜色请求，数据:', req.body)
      if (!this.isDatabaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { name, status, sort_order } = req.body
      if (!name) return ApiResponse.badRequest(res, '颜色名称不能为空')

      const trimmedName = name.trim()
      const [existingColors] = await this.repository.executePrepared(
        'SELECT id FROM colors WHERE name = ?',
        [trimmedName]
      )
      if (existingColors.length > 0) return ApiResponse.badRequest(res, '颜色名称已存在')

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
      const [result] = await this.repository.executePrepared(insertQuery, insertValues)
      const [newColors] = await this.repository.executePrepared(
        `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
        [result.insertId]
      )
      this.clearCache()
      return ApiResponse.created(res, '颜色创建成功', formatColor(newColors[0]))
    } catch (error) {
      log.error('创建颜色失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '创建颜色失败', error)
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params
      if (!this.isDatabaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { name, status, sort_order } = req.body
      const [existingColors] = await this.repository.executePrepared(
        'SELECT id FROM colors WHERE id = ?',
        [id]
      )
      if (existingColors.length === 0) return ApiResponse.notFound(res, '颜色不存在')

      if (name) {
        const [duplicateCheck] = await this.repository.executePrepared(
          'SELECT id FROM colors WHERE name = ? AND id != ?',
          [name.trim(), id]
        )
        if (duplicateCheck.length > 0) return ApiResponse.badRequest(res, '颜色名称已存在')
      }

      const updateFields = []
      const updateValues = []
      if (name !== undefined) {
        updateFields.push('name = ?')
        updateValues.push(name.trim())
      }
      if (status !== undefined) {
        updateFields.push('status = ?')
        updateValues.push(parseInt(status))
      }
      if (sort_order !== undefined) {
        updateFields.push('sort_order = ?')
        updateValues.push(parseInt(sort_order))
      }
      if (updateFields.length === 0) return ApiResponse.badRequest(res, '没有提供要更新的字段')

      updateFields.push('updated_at = NOW()')
      updateValues.push(id)
      await this.repository.executePrepared(
        `UPDATE colors SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      )
      const [updatedColor] = await this.repository.executePrepared(
        `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
        [id]
      )
      this.clearCache()
      return ApiResponse.success(res, formatColor(updatedColor[0]), '颜色更新成功')
    } catch (error) {
      log.error('更新颜色失败:', error)
      return ApiResponse.serverError(res, '更新颜色失败', error)
    }
  }

  async delete(req, res) {
    try {
      log.debug('删除颜色请求，ID:', req.params.id)
      if (!this.isDatabaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { id } = req.params
      const [existingColors] = await this.repository.executePrepared(
        `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
        [parseInt(id)]
      )
      if (existingColors.length === 0) return ApiResponse.notFound(res, '颜色不存在')
      await this.repository.executePrepared('DELETE FROM colors WHERE id = ?', [parseInt(id)])
      this.clearCache()
      return ApiResponse.success(res, formatColor(existingColors[0]), '颜色删除成功')
    } catch (error) {
      log.error('删除颜色失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '删除颜色失败', error)
    }
  }

  async stats(req, res) {
    try {
      if (!this.isDatabaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
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
        this.repository.executePrepared(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN c.status = 1 THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN c.status <> 1 OR c.status IS NULL THEN 1 ELSE 0 END) AS inactive
          FROM colors c
          ${whereClause}
        `, params),
        this.repository.executePrepared(`
          SELECT COUNT(*) AS related_phones
          FROM phones p
          INNER JOIN colors c ON c.id = p.color_id
          ${whereClause}
        `, params)
      ])
      return ApiResponse.success(res, {
        total: Number(colorStats[0].total) || 0,
        active: Number(colorStats[0].active) || 0,
        inactive: Number(colorStats[0].inactive) || 0,
        related_phones: Number(phoneStats[0].related_phones) || 0
      })
    } catch (error) {
      log.error('获取颜色统计失败:', error)
      return ApiResponse.serverError(res, '获取颜色统计失败', error)
    }
  }

  async toggle(req, res) {
    try {
      if (!this.isDatabaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { id } = req.params
      const [existingColors] = await this.repository.executePrepared(
        `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
        [parseInt(id)]
      )
      if (existingColors.length === 0) return ApiResponse.notFound(res, '颜色不存在')
      const newStatus = existingColors[0].status === 1 ? 0 : 1
      await this.repository.executePrepared(
        'UPDATE colors SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, parseInt(id)]
      )
      const [updatedColors] = await this.repository.executePrepared(
        `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
        [parseInt(id)]
      )
      const statusText = newStatus === 1 ? '启用' : '禁用'
      this.clearCache()
      return ApiResponse.success(res, formatColor(updatedColors[0]), `颜色${statusText}成功`)
    } catch (error) {
      log.error('切换颜色状态失败:', error)
      return ApiResponse.serverError(res, '切换颜色状态失败', error)
    }
  }

  async reorder(req, res) {
    try {
      if (!this.isDatabaseConnected()) {
        return ApiResponse.error(res, '数据库未连接', 500)
      }

      const { items } = req.body
      if (!Array.isArray(items) || items.length === 0) {
        return ApiResponse.error(res, '请提供有效的排序数据', 400)
      }

      await this.orderingService.reorder(items)
      this.clearCache()
      return ApiResponse.success(res, null, '排序更新成功')
    } catch (error) {
      log.error('批量更新排序失败:', error)
      return ApiResponse.error(res, '批量更新排序失败', 500)
    }
  }
}

module.exports = ColorController
