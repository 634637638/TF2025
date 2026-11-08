'use strict'

const ReferenceOrderingService = require('../services/reference-ordering.service')

const ApiResponse = require('../utils/response')
const { isConnected } = require('../config/database')
const ModelRepository = require('../repositories/model.repository')
const { clearCache } = require('../middleware/cache')
const { PAGINATION } = require('../config/constants')
const log = require('../utils/log')
const { parseStatusFilter } = require('../utils/status')
const {
  normalizeReferencePagination,
  buildReferenceOrder,
  buildPagination,
  listModelsByBrand
} = require('../services/reference-options.service')

const MODEL_COLUMNS = 'm.id, m.brand_id, m.name, m.status, m.sort_order, m.created_at, m.updated_at'
const MODEL_COLUMNS_WITH_BRAND = `${MODEL_COLUMNS}, b.name AS brand_name`

class ModelController {
  constructor({
    repository = new ModelRepository(),
    databaseConnected = isConnected,
    invalidateCache = ModelController.clearRouteCache,
    modelsByBrand = listModelsByBrand
  } = {}) {
    this.repository = repository
    this.orderingService = new ReferenceOrderingService({ repository, domain: 'models' })
    this.databaseConnected = databaseConnected
    this.invalidateCache = invalidateCache
    this.modelsByBrand = modelsByBrand
  }

  static formatModel(row) {
    return {
      id: Number(row.id),
      brand_id: Number(row.brand_id),
      ...(row.brand_name !== undefined ? { brand_name: String(row.brand_name || '').trim() } : {}),
      name: String(row.name || '').trim(),
      status: Number(row.status) || 0,
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }
  }

  static clearRouteCache() {
    try {
      clearCache('/api/models')
    } catch (error) {
      log.warn('清理型号缓存失败:', error.message)
    }
  }

  async list(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const {
        page = PAGINATION.DEFAULT_PAGE,
        page_size = PAGINATION.DEFAULT_LIMIT,
        brand_id,
        name,
        status,
        sort_by,
        sort_order,
        all = false,
        active_only = false,
        include_id
      } = req.query

      if ((all === 'true' || all === true) && (active_only === 'true' || active_only === true)) {
        const models = await this.modelsByBrand({ brand_id, name, include_id, activeOnly: true })
        return ApiResponse.success(res, models.map(ModelController.formatModel))
      }

      const { page: pageNum, page_size: pageSizeNum, offset } = normalizeReferencePagination({
        page,
        page_size,
        defaultPage: PAGINATION.DEFAULT_PAGE,
        defaultPageSize: PAGINATION.DEFAULT_LIMIT,
        maxPageSize: PAGINATION.MAX_LIMIT
      })

      let baseQuery = `
        SELECT ${MODEL_COLUMNS_WITH_BRAND}
        FROM models m
        LEFT JOIN brands b ON m.brand_id = b.id
      `
      let baseCountQuery = 'SELECT COUNT(*) as total FROM models m'
      const conditions = []
      const queryParams = []

      if (brand_id) {
        let modelBrandId = brand_id
        if (!/^\d+$/.test(String(brand_id))) {
          const [brands] = await this.repository.executePrepared(
            'SELECT id FROM brands WHERE name = ? LIMIT 1', [String(brand_id)]
          )
          modelBrandId = brands[0]?.id || 0
        }
        conditions.push('m.brand_id = ?')
        queryParams.push(modelBrandId)
      }

      const statusFilter = parseStatusFilter(status)
      if (statusFilter !== null) {
        conditions.push('m.status = ?')
        queryParams.push(statusFilter)
      }
      if (name) {
        conditions.push('m.name LIKE ?')
        queryParams.push(`%${name}%`)
      }
      if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ')
        baseCountQuery += ' WHERE ' + conditions.join(' AND ')
      }

      const order = buildReferenceOrder({
        sort_by,
        sort_order,
        allowed: ['id', 'name', 'sort_order', 'created_at', 'updated_at', 'brand_id'],
        fallback: ['sort_order', 'name', 'id']
      }).replace(/(^|, )([a-z_]+)/g, '$1m.$2')
      baseQuery += ` ORDER BY ${order}`

      const returnAll = all === 'true' || all === true
      const finalQuery = returnAll ? baseQuery : `${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`
      const [[models], [countResult]] = await Promise.all([
        this.repository.executePrepared(finalQuery, queryParams),
        this.repository.executePrepared(baseCountQuery, queryParams)
      ])
      const total = Number(countResult[0].total) || 0
      if (returnAll) return ApiResponse.success(res, models.map(ModelController.formatModel))
      return ApiResponse.success(res, {
        models: models.map(ModelController.formatModel),
        pagination: buildPagination(pageNum, pageSizeNum, total)
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
      return ApiResponse.serverError(res, '获取型号列表失败', error)
    }
  }

  async listByBrand(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      const { brandId } = req.params
      const { page = 1, page_size = PAGINATION.DEFAULT_LIMIT, name, status, sort_by, sort_order } = req.query
      const pageSizeNum = Math.min(PAGINATION.MAX_LIMIT, Math.max(1, parseInt(page_size) || PAGINATION.DEFAULT_LIMIT))
      const pageNum = parseInt(page) || 1
      const offset = (pageNum - 1) * pageSizeNum
      const conditions = ['m.brand_id = ?']
      const queryParams = [parseInt(brandId)]

      if (status !== undefined && status !== '') {
        const statusFilter = parseStatusFilter(status)
        conditions.push('m.status = ?')
        queryParams.push(statusFilter)
      }
      if (name) {
        conditions.push('m.name LIKE ?')
        queryParams.push(`%${name}%`)
      }

      let baseQuery = `
        SELECT ${MODEL_COLUMNS_WITH_BRAND}
        FROM models m
        LEFT JOIN brands b ON b.id = m.brand_id
        WHERE ${conditions.join(' AND ')}
      `
      const baseCountQuery = 'SELECT COUNT(*) as total FROM models m WHERE ' + conditions.join(' AND ')
      const validSortColumns = ['id', 'name', 'sort_order', 'created_at', 'updated_at']
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'sort_order'
      const sortDirection = String(sort_order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
      const fallbackOrder = sortColumn === 'sort_order'
        ? ', m.name ASC, m.id ASC'
        : ', m.sort_order ASC, m.name ASC, m.id ASC'
      baseQuery += ` ORDER BY m.${sortColumn} ${sortDirection}${fallbackOrder}`

      const [[models], [countResult]] = await Promise.all([
        this.repository.executePrepared(`${baseQuery} LIMIT ${pageSizeNum} OFFSET ${offset}`, queryParams),
        this.repository.executePrepared(baseCountQuery, queryParams)
      ])
      const total = Number(countResult[0].total) || 0
      const total_pages = Math.ceil(total / pageSizeNum)
      return ApiResponse.success(res, {
        models: models.map(ModelController.formatModel),
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
      return ApiResponse.serverError(res, '获取型号列表失败', error)
    }
  }

  async stats(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { brand_id, name, status } = req.query
      const conditions = []
      const queryParams = []
      if (brand_id) {
        conditions.push('m.brand_id = ?')
        queryParams.push(parseInt(brand_id))
      }
      if (String(name || '').trim()) {
        conditions.push('m.name LIKE ?')
        queryParams.push(`%${String(name).trim()}%`)
      }
      const statusFilter = parseStatusFilter(status)
      if (statusFilter !== null) {
        conditions.push('m.status = ?')
        queryParams.push(statusFilter)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const [models] = await this.repository.executePrepared(`
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
      return ApiResponse.success(res, {
        total: models.length,
        active: models.filter(model => Number(model.status) === 1).length,
        inactive: models.filter(model => Number(model.status) === 0).length,
        related_brands: new Set(models.map(model => Number(model.brand_id))).size,
        by_brand,
        newest_model: models.length > 0 ? String(models[0].name || '') : null
      })
    } catch (error) {
      log.error('获取型号统计失败:', error)
      return ApiResponse.serverError(res, '获取型号统计失败', error)
    }
  }

  async get(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const [models] = await this.repository.executePrepared(`
        SELECT ${MODEL_COLUMNS_WITH_BRAND}
        FROM models m
        LEFT JOIN brands b ON b.id = m.brand_id
        WHERE m.id = ?
      `, [parseInt(req.params.id)])
      if (models.length === 0) return ApiResponse.notFound(res, '型号不存在')
      return ApiResponse.success(res, ModelController.formatModel(models[0]))
    } catch (error) {
      log.error('获取型号详情失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '获取型号详情失败', error)
    }
  }

  async create(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { brand_id, name, status, sort_order } = req.body
      if (!brand_id || !name) return ApiResponse.badRequest(res, '品牌ID和型号名称不能为空')

      const [existingModels] = await this.repository.executePrepared(
        'SELECT id FROM models WHERE name = ? AND brand_id = ?',
        [name, parseInt(brand_id)]
      )
      if (existingModels.length > 0) return ApiResponse.badRequest(res, '该品牌下已存在相同型号名称')

      const insertQuery = `
        INSERT INTO models (
          brand_id, name, status, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      const insertValues = [
        parseInt(brand_id), name,
        status !== undefined ? parseInt(status) : 1,
        sort_order !== undefined ? parseInt(sort_order) : 0
      ]
      const [result] = await this.repository.executePrepared(insertQuery, insertValues)
      const [newModels] = await this.repository.executePrepared(`
        SELECT ${MODEL_COLUMNS_WITH_BRAND}
        FROM models m
        LEFT JOIN brands b ON b.id = m.brand_id
        WHERE m.id = ?
      `, [result.insertId])
      this.invalidateCache()
      return ApiResponse.created(res, '型号创建成功', ModelController.formatModel(newModels[0]))
    } catch (error) {
      log.error('创建型号失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '创建型号失败', error)
    }
  }

  async update(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const { id } = req.params
      const [existingModels] = await this.repository.executePrepared(`
        SELECT ${MODEL_COLUMNS}
        FROM models m
        WHERE m.id = ?
      `, [parseInt(id)])
      if (existingModels.length === 0) return ApiResponse.notFound(res, '型号不存在')

      const { brand_id, name, status, sort_order } = req.body
      if (name !== undefined || brand_id !== undefined) {
        const nextName = name !== undefined ? name : existingModels[0].name
        const nextBrandId = brand_id !== undefined ? parseInt(brand_id) : Number(existingModels[0].brand_id)
        const [duplicateModels] = await this.repository.executePrepared(
          'SELECT id FROM models WHERE name = ? AND brand_id = ? AND id != ?',
          [nextName, nextBrandId, parseInt(id)]
        )
        if (duplicateModels.length > 0) return ApiResponse.badRequest(res, '该品牌下已存在相同型号名称')
      }

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
      if (updateFields.length === 0) return ApiResponse.badRequest(res, '没有要更新的字段')

      updateFields.push('updated_at = CURRENT_TIMESTAMP')
      updateValues.push(parseInt(id))
      await this.repository.executePrepared(
        `UPDATE models SET ${updateFields.join(', ')} WHERE id = ?`, updateValues
      )
      const [updatedModels] = await this.repository.executePrepared(`
        SELECT ${MODEL_COLUMNS_WITH_BRAND}
        FROM models m
        LEFT JOIN brands b ON b.id = m.brand_id
        WHERE m.id = ?
      `, [parseInt(id)])
      this.invalidateCache()
      return ApiResponse.success(res, ModelController.formatModel(updatedModels[0]), '型号更新成功')
    } catch (error) {
      log.error('更新型号失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '更新型号失败', error)
    }
  }

  async remove(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const id = parseInt(req.params.id)
      const [existingModels] = await this.repository.executePrepared(`
        SELECT ${MODEL_COLUMNS}
        FROM models m
        WHERE m.id = ?
      `, [id])
      if (existingModels.length === 0) return ApiResponse.notFound(res, '型号不存在')
      await this.repository.executePrepared('DELETE FROM models WHERE id = ?', [id])
      this.invalidateCache()
      return ApiResponse.success(res, ModelController.formatModel(existingModels[0]), '型号删除成功')
    } catch (error) {
      log.error('删除型号失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '删除型号失败', error)
    }
  }

  async toggle(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const id = parseInt(req.params.id)
      const [existingModels] = await this.repository.executePrepared(`
        SELECT ${MODEL_COLUMNS}
        FROM models m
        WHERE m.id = ?
      `, [id])
      if (existingModels.length === 0) return ApiResponse.notFound(res, '型号不存在')
      const newStatus = existingModels[0].status === 1 ? 0 : 1
      await this.repository.executePrepared(
        'UPDATE models SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, id]
      )
      const [updatedModels] = await this.repository.executePrepared(`
        SELECT ${MODEL_COLUMNS_WITH_BRAND}
        FROM models m
        LEFT JOIN brands b ON b.id = m.brand_id
        WHERE m.id = ?
      `, [id])
      const statusText = newStatus === 1 ? '启用' : '禁用'
      this.invalidateCache()
      return ApiResponse.success(res, ModelController.formatModel(updatedModels[0]), `型号${statusText}成功`)
    } catch (error) {
      log.error('切换型号状态失败:', error)
      log.error('错误详情:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      })
      return ApiResponse.serverError(res, '切换型号状态失败', error)
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
      this.invalidateCache()
      return ApiResponse.success(res, null, '排序更新成功')
    } catch (error) {
      log.error('批量更新排序失败:', error)
      return ApiResponse.error(res, '批量更新排序失败', 500)
    }
  }
}

ModelController.MODEL_COLUMNS = MODEL_COLUMNS
ModelController.MODEL_COLUMNS_WITH_BRAND = MODEL_COLUMNS_WITH_BRAND
module.exports = ModelController
