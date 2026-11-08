'use strict'

const ReferenceOrderingService = require('../services/reference-ordering.service')

const ApiResponse = require('../utils/response')
const { isConnected } = require('../config/database')
const MemoryRepository = require('../repositories/memory.repository')
const { clearCache } = require('../middleware/cache')
const { PAGINATION } = require('../config/constants')
const log = require('../utils/log')
const { parseStatusFilter } = require('../utils/status')
const {
  normalizeReferencePagination,
  buildReferenceOrder,
  buildPagination
} = require('../services/reference-options.service')

const MEMORY_COLUMNS = 'id, size, status, sort_order, created_at, updated_at'

class MemoryController {
  constructor({ repository = new MemoryRepository(), databaseConnected = isConnected } = {}) {
    this.repository = repository
    this.orderingService = new ReferenceOrderingService({ repository, domain: 'memories' })
    this.databaseConnected = databaseConnected
  }

  static formatMemory(row) {
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

  static clearRouteCache() {
    try {
      clearCache('/api/memories')
      clearCache('/api/public/memories')
    } catch (error) {
      log.warn('清理内存缓存失败:', error.message)
    }
  }

  async list(req, res) {
    try {
      log.debug('获取内存规格列表请求，参数:', req.query)

      if (!this.databaseConnected()) {
        return ApiResponse.error(res, '数据库未连接', 500)
      }

      const {
        page = PAGINATION.DEFAULT_PAGE,
        page_size = PAGINATION.DEFAULT_LIMIT,
        size,
        storage_unit,
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

      let baseQuery = `SELECT ${MEMORY_COLUMNS} FROM memories`
      let baseCountQuery = 'SELECT COUNT(*) as total FROM memories'
      const conditions = []
      const queryParams = []

      if (storage_unit) {
        conditions.push('size LIKE ?')
        queryParams.push(`%${storage_unit}`)
      }

      const statusFilter = parseStatusFilter(status)
      if (statusFilter !== null) {
        conditions.push('status = ?')
        queryParams.push(statusFilter)
      }

      if (size) {
        conditions.push('size LIKE ?')
        queryParams.push(`%${size}%`)
      }

      if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ')
        baseCountQuery += ' WHERE ' + conditions.join(' AND ')
      }

      baseQuery += ` ORDER BY ${buildReferenceOrder({
        sort_by,
        sort_order,
        allowed: ['id', 'size', 'created_at', 'updated_at', 'sort_order', 'status'],
        fallback: ['sort_order', 'size', 'id']
      })}`

      const returnAll = all === 'true' || all === true
      const finalQuery = returnAll ? baseQuery : `${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`
      log.debug('执行SQL查询:', finalQuery)
      log.debug('查询参数:', queryParams)

      const [[memories], [countResult]] = await Promise.all([
        this.repository.executePrepared(finalQuery, queryParams),
        this.repository.executePrepared(baseCountQuery, queryParams)
      ])
      const total = Number(countResult[0].total) || 0
      if (returnAll) {
        return ApiResponse.success(res, memories.map(MemoryController.formatMemory))
      }
      log.debug(`查询结果: ${memories.length} 条记录，总数: ${total}`)

      return ApiResponse.success(res, {
        memories: memories.map(MemoryController.formatMemory),
        pagination: buildPagination(pageNum, pageSizeNum, total)
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
      return ApiResponse.serverError(res, '获取内存规格列表失败', error)
    }
  }

  async getById(req, res) {
    try {
      log.debug('获取内存规格详情请求，ID:', req.params.id)
      if (!this.databaseConnected()) {
        return ApiResponse.error(res, '数据库未连接', 500)
      }

      const [memories] = await this.repository.executePrepared(
        `SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`,
        [parseInt(req.params.id)]
      )
      if (memories.length === 0) return ApiResponse.notFound(res, '内存规格不存在')
      return ApiResponse.success(res, MemoryController.formatMemory(memories[0]))
    } catch (error) {
      log.error('获取内存规格详情失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '获取内存规格详情失败', error)
    }
  }

  async create(req, res) {
    try {
      log.debug('创建内存规格请求，数据:', req.body)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const { size, sort_order, status } = req.body
      if (!size) return ApiResponse.badRequest(res, '内存规格不能为空')

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
      if (/[\u4e00-\u9fa5]/.test(trimmedSize)) {
        return ApiResponse.badRequest(res, '内存规格不能包含中文字符，请使用如：64GB、8+128GB 等格式')
      }
      if (!/^[0-9a-zA-Z+]+$/.test(trimmedSize)) {
        return ApiResponse.badRequest(res, '内存规格包含无效字符，只能使用数字、字母和+号')
      }

      const [existingMemories] = await this.repository.executePrepared(
        'SELECT id FROM memories WHERE size = ?',
        [trimmedSize]
      )
      if (existingMemories.length > 0) return ApiResponse.badRequest(res, '该内存规格已存在')

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

      const [result] = await this.repository.executePrepared(insertQuery, insertValues)
      const [newMemories] = await this.repository.executePrepared(
        `SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`,
        [result.insertId]
      )
      MemoryController.clearRouteCache()
      return ApiResponse.created(res, '内存规格创建成功', MemoryController.formatMemory(newMemories[0]))
    } catch (error) {
      log.error('创建内存规格失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '创建内存规格失败', error)
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const { size, sort_order, status } = req.body
      const trimmedSize = size !== undefined ? size.trim() : undefined
      if (size !== undefined) {
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
        if (/[\u4e00-\u9fa5]/.test(trimmedSize)) {
          return ApiResponse.badRequest(res, '内存规格不能包含中文字符，请使用如：64GB、8+128GB 等格式')
        }
        if (!/^[0-9a-zA-Z+]+$/.test(trimmedSize)) {
          return ApiResponse.badRequest(res, '内存规格包含无效字符，只能使用数字、字母和+号')
        }
      }

      const [existingMemories] = await this.repository.executePrepared(
        'SELECT id FROM memories WHERE id = ?', [id]
      )
      if (existingMemories.length === 0) return ApiResponse.notFound(res, '内存规格不存在')

      const [currentMemory] = await this.repository.executePrepared(
        'SELECT size FROM memories WHERE id = ?', [id]
      )
      const currentSize = currentMemory[0]?.size
      const updateFields = []
      const updateValues = []

      if (size !== undefined && trimmedSize !== currentSize) {
        const [duplicateCheck] = await this.repository.executePrepared(
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
      if (updateFields.length === 0) return ApiResponse.badRequest(res, '没有提供要更新的字段')

      updateFields.push('updated_at = NOW()')
      updateValues.push(id)
      await this.repository.executePrepared(
        `UPDATE memories SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      )
      const [updatedMemory] = await this.repository.executePrepared(
        `SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [id]
      )
      MemoryController.clearRouteCache()
      return ApiResponse.success(res, MemoryController.formatMemory(updatedMemory[0]), '内存规格更新成功')
    } catch (error) {
      log.error('更新内存规格失败:', error)
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'DUPLICATE_ENTRY' || error.errno === 1062) {
        return ApiResponse.error(res, '已有存在该内存规格，请勿重复提交', 409)
      }
      return ApiResponse.serverError(res, '更新内存规格失败', error)
    }
  }

  async remove(req, res) {
    try {
      log.debug('删除内存规格请求，ID:', req.params.id)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const id = parseInt(req.params.id)
      const [existingMemories] = await this.repository.executePrepared(
        `SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [id]
      )
      if (existingMemories.length === 0) return ApiResponse.notFound(res, '内存规格不存在')

      await this.repository.executePrepared('DELETE FROM memories WHERE id = ?', [id])
      MemoryController.clearRouteCache()
      return ApiResponse.success(res, MemoryController.formatMemory(existingMemories[0]), '内存规格删除成功')
    } catch (error) {
      log.error('删除内存规格失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '删除内存规格失败', error)
    }
  }

  async getStats(req, res) {
    try {
      log.debug('获取内存规格统计信息请求，参数:', req.query)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

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
        this.repository.executePrepared(`
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN m.status = 1 THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN m.status <> 1 OR m.status IS NULL THEN 1 ELSE 0 END) AS inactive
          FROM memories m
          ${whereClause}
        `, params),
        this.repository.executePrepared(`
          SELECT COUNT(*) AS related_phones
          FROM phones p
          INNER JOIN memories m ON m.id = p.memory_id
          ${whereClause}
        `, params)
      ])
      return ApiResponse.success(res, {
        total: Number(memoryStats[0].total) || 0,
        active: Number(memoryStats[0].active) || 0,
        inactive: Number(memoryStats[0].inactive) || 0,
        related_phones: Number(phoneStats[0].related_phones) || 0
      })
    } catch (error) {
      log.error('获取内存规格统计失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '获取内存规格统计失败', error)
    }
  }

  async toggle(req, res) {
    try {
      log.debug('切换内存规格状态请求，ID:', req.params.id)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const id = parseInt(req.params.id)
      const [existingMemories] = await this.repository.executePrepared(
        `SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [id]
      )
      if (existingMemories.length === 0) return ApiResponse.notFound(res, '内存规格不存在')

      const newStatus = existingMemories[0].status === 1 ? 0 : 1
      await this.repository.executePrepared(
        'UPDATE memories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, id]
      )
      const [updatedMemories] = await this.repository.executePrepared(
        `SELECT ${MEMORY_COLUMNS} FROM memories WHERE id = ?`, [id]
      )
      const statusText = newStatus === 1 ? '启用' : '禁用'
      MemoryController.clearRouteCache()
      return ApiResponse.success(res, MemoryController.formatMemory(updatedMemories[0]), `内存规格${statusText}成功`)
    } catch (error) {
      log.error('切换内存规格状态失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '切换内存规格状态失败', error)
    }
  }

  async reorder(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { items } = req.body
      if (!Array.isArray(items) || items.length === 0) {
        return ApiResponse.error(res, '请提供有效的排序数据', 400)
      }

      await this.orderingService.reorder(items)
      MemoryController.clearRouteCache()
      return ApiResponse.success(res, null, '排序更新成功')
    } catch (error) {
      log.error('批量更新排序失败:', error)
      return ApiResponse.error(res, '批量更新排序失败', 500)
    }
  }
}

MemoryController.MEMORY_COLUMNS = MEMORY_COLUMNS
module.exports = MemoryController
