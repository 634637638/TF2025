'use strict'

const ReferenceOrderingService = require('../services/reference-ordering.service')

const XLSX = require('xlsx')
const ApiResponse = require('../utils/response')
const { isConnected } = require('../config/database')
const StoreRepository = require('../repositories/store.repository')
const { clearCache } = require('../middleware/cache')
const { CACHE_TTL, PAGINATION } = require('../config/constants')
const { isSuperAdmin } = require('../middleware/unified-auth')
const log = require('../utils/log')

const STORE_PUBLIC_COLUMNS = 's.id, s.name, s.location, s.phone, s.manager_id, s.status, s.sort_order, s.created_at, s.updated_at'

class StoreController {
  constructor({
    repository = new StoreRepository(),
    databaseConnected = isConnected,
    superAdminCheck = isSuperAdmin,
    invalidateCache = () => clearCache('/stores')
  } = {}) {
    this.repository = repository
    this.orderingService = new ReferenceOrderingService({ repository, domain: 'stores' })
    this.databaseConnected = databaseConnected
    this.superAdminCheck = superAdminCheck
    this.invalidateCache = invalidateCache
  }

  static formatStore(row) {
    return {
      id: Number(row.id),
      name: String(row.name || ''),
      address: String(row.location || ''),
      phone: String(row.phone || ''),
      manager: String(row.manager_name || ''),
      manager_id: row.manager_id ? Number(row.manager_id) : null,
      status: Number(row.status) || 0,
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    }
  }

  async selectStoreById(id) {
    const [stores] = await this.repository.executePrepared(
      `SELECT ${STORE_PUBLIC_COLUMNS}, u.name AS manager_name
         FROM stores s
         LEFT JOIN users u ON u.id = s.manager_id
        WHERE s.id = ?`,
      [id]
    )
    return stores.length > 0 ? StoreController.formatStore(stores[0]) : null
  }

  async resolveManagerAssignment(rawManagerId, fallbackPhone = '') {
    const phone = String(fallbackPhone || '').trim()
    if (rawManagerId === undefined || rawManagerId === null || rawManagerId === '') {
      return { manager_id: null, phone }
    }
    const managerId = Number.parseInt(rawManagerId, 10)
    if (!Number.isInteger(managerId) || managerId <= 0) {
      return { error: '请选择有效的门店负责人' }
    }
    const [employees] = await this.repository.executePrepared(
      'SELECT id, phone FROM users WHERE id = ? AND status = 1 LIMIT 1', [managerId]
    )
    if (employees.length === 0) return { error: '所选负责人不存在或已停用，请重新选择' }
    return { manager_id: managerId, phone: String(employees[0].phone || '').trim() }
  }

  async list(req, res) {
    try {
      const { name, status, page = PAGINATION.DEFAULT_PAGE, page_size = PAGINATION.DEFAULT_LIMIT, all = false, strict_scope = false } = req.query
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      if (all === 'true' || all === true) {
        const conditions = ['s.status = 1']
        const params = []
        const strictStoreScope = strict_scope === 'true' || strict_scope === true
        const userStoreIds = Array.isArray(req.user?.store_ids)
          ? req.user.store_ids.map(Number).filter(id => Number.isInteger(id) && id > 0)
          : []
        if (strictStoreScope && !this.superAdminCheck(req.user)) {
          if (userStoreIds.length === 0) return ApiResponse.success(res, [])
          conditions.push(`s.id IN (${userStoreIds.map(() => '?').join(',')})`)
          params.push(...userStoreIds)
        }
        if (name) {
          conditions.push('s.name LIKE ?')
          params.push(`%${name}%`)
        }
        const [stores] = await this.repository.executePrepared(
          `SELECT s.id, s.name, s.sort_order
             FROM stores s
            WHERE ${conditions.join(' AND ')}
            ORDER BY s.sort_order ASC, s.name ASC, s.id ASC`,
          params
        )
        return ApiResponse.success(res, stores.map(row => ({
          id: parseInt(row.id),
          name: String(row.name || ''),
          sort_order: parseInt(row.sort_order) || 0
        })))
      }

      const pageNumber = Math.max(1, Number.parseInt(page, 10) || PAGINATION.DEFAULT_PAGE)
      const pageSize = Math.min(1000, Math.max(1, Number.parseInt(page_size, 10) || PAGINATION.DEFAULT_LIMIT))
      const offset = (pageNumber - 1) * pageSize
      let query = `
        SELECT ${STORE_PUBLIC_COLUMNS}, u.name as manager_name
        FROM stores s
        LEFT JOIN users u ON s.manager_id = u.id
      `
      const params = []
      const conditions = []
      if (name) {
        conditions.push(' s.name LIKE ?')
        params.push(`%${name}%`)
      }
      if (status !== undefined && status !== null && status !== '') {
        conditions.push(' s.status = ?')
        const statusValue = parseInt(status)
        if (isNaN(statusValue)) return ApiResponse.error(res, '无效的状态值', 400)
        params.push(statusValue)
      }
      if (conditions.length > 0) query += ' WHERE' + conditions.join(' AND')
      const finalOffset = Math.max(0, offset)
      query += ` ORDER BY s.sort_order ASC, s.id DESC LIMIT ${pageSize} OFFSET ${finalOffset}`
      const [stores] = await this.repository.executePrepared(query, params)
      let countQuery = 'SELECT COUNT(*) as total FROM stores s'
      if (conditions.length > 0) countQuery += ' WHERE' + conditions.join(' AND')
      const [countResult] = await this.repository.executePrepared(countQuery, [...params])
      const total = countResult[0].total
      return ApiResponse.success(res, {
        data: stores.map(StoreController.formatStore),
        pagination: {
          page: pageNumber,
          page_size: pageSize,
          total,
          total_pages: Math.ceil(total / pageSize),
          has_next: pageNumber * pageSize < total,
          has_prev: pageNumber > 1
        }
      })
    } catch (error) {
      log.error('获取店铺列表失败:', error)
      return ApiResponse.error(res, '获取店铺列表失败', 500)
    }
  }

  async export(req, res) {
    try {
      const { name, status } = req.query
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)

      let query = `
        SELECT s.id, s.name, s.location, s.phone, s.status, s.sort_order,
               s.created_at, s.updated_at, u.name as manager_name
        FROM stores s
        LEFT JOIN users u ON s.manager_id = u.id
      `
      const params = []
      const conditions = []
      if (name) {
        conditions.push('s.name LIKE ?')
        params.push(`%${String(name).trim()}%`)
      }
      if (status !== undefined && status !== null && status !== '') {
        conditions.push('s.status = ?')
        params.push(parseInt(status, 10))
      }
      if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`
      query += ' ORDER BY s.sort_order ASC, s.id DESC'
      const [stores] = await this.repository.executePrepared(query, params)
      const rows = stores.map(row => ({
        ID: row.id,
        门店名称: row.name || '',
        地址: row.location || '',
        电话: row.phone || '',
        店长: row.manager_name || '',
        状态: Number(row.status) === 1 ? '正常' : '禁用',
        排序: row.sort_order || 0,
        创建时间: row.created_at || '',
        更新时间: row.updated_at || ''
      }))
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      const beijingDate = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date()).replace(/\//g, '-')
      XLSX.utils.book_append_sheet(workbook, worksheet, '门店管理')
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`门店管理_${beijingDate}.xlsx`)}`)
      return res.send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
    } catch (error) {
      log.error('导出门店数据失败:', error)
      return ApiResponse.error(res, '导出门店数据失败', 500)
    }
  }

  async create(req, res) {
    try {
      const { name, address, phone, manager_id, status = 1, sort_order = 0 } = req.body
      if (!name || !name.trim()) return ApiResponse.error(res, '店铺名称不能为空', 400)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const managerAssignment = await this.resolveManagerAssignment(manager_id, phone)
      if (managerAssignment.error) return ApiResponse.error(res, managerAssignment.error, 400)
      const [existingStores] = await this.repository.executePrepared(
        'SELECT id FROM stores WHERE name = ?', [name.trim()]
      )
      if (existingStores.length > 0) return ApiResponse.error(res, `店铺名称"${name}"已存在，请使用其他名称`, 409)
      const [result] = await this.repository.executePrepared(
        'INSERT INTO stores (name, location, phone, manager_id, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [name.trim(), address || '', managerAssignment.phone, managerAssignment.manager_id, parseInt(status), parseInt(sort_order)]
      )
      if (!result.insertId) return ApiResponse.error(res, '店铺创建失败', 500)
      const formattedStore = await this.selectStoreById(result.insertId)
      this.invalidateCache()
      return ApiResponse.created(res, '店铺创建成功', formattedStore)
    } catch (error) {
      log.error('创建店铺失败:', error)
      return ApiResponse.error(res, '创建店铺失败', 500)
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params
      const { name, address, phone, manager_id, status, sort_order } = req.body
      if (!id || isNaN(parseInt(id))) return ApiResponse.error(res, '无效的店铺ID', 400)
      if (!name || !name.trim()) return ApiResponse.error(res, '店铺名称不能为空', 400)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const managerAssignment = await this.resolveManagerAssignment(manager_id, phone)
      if (managerAssignment.error) return ApiResponse.error(res, managerAssignment.error, 400)
      const [currentStore] = await this.repository.executePrepared(
        'SELECT name FROM stores WHERE id = ?', [parseInt(id)]
      )
      const currentName = currentStore[0]?.name
      if (name && name !== currentName) {
        const [duplicateCheck] = await this.repository.executePrepared(
          'SELECT id FROM stores WHERE name = ? AND id != ?', [name.trim(), parseInt(id)]
        )
        if (duplicateCheck.length > 0) return ApiResponse.error(res, `店铺名称"${name}"已存在，请使用其他名称`, 409)
      }
      const [result] = await this.repository.executePrepared(
        'UPDATE stores SET name = ?, location = ?, phone = ?, manager_id = ?, status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name.trim(), address || '', managerAssignment.phone, managerAssignment.manager_id, parseInt(status), parseInt(sort_order) || 0, parseInt(id)]
      )
      if (result.affectedRows > 0) {
        const formattedStore = await this.selectStoreById(Number.parseInt(id, 10))
        this.invalidateCache()
        return ApiResponse.success(res, formattedStore, '店铺修改成功')
      }
      return ApiResponse.notFound(res, '店铺不存在')
    } catch (error) {
      log.error('更新店铺失败:', error)
      return ApiResponse.error(res, '更新店铺失败', 500)
    }
  }

  async remove(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(parseInt(id))) return ApiResponse.error(res, '无效的店铺ID', 400)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const [result] = await this.repository.executePrepared('DELETE FROM stores WHERE id = ?', [parseInt(id)])
      if (result.affectedRows > 0) {
        this.invalidateCache()
        return ApiResponse.success(res, '店铺删除成功')
      }
      return ApiResponse.notFound(res, '店铺不存在')
    } catch (error) {
      log.error('删除店铺失败:', error)
      return ApiResponse.error(res, '删除店铺失败', 500)
    }
  }

  async managers(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const [managers] = await this.repository.executePrepared(`
        SELECT u.id, u.name, u.username, u.phone,
          (SELECT GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR ', ')
             FROM user_roles ur JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = u.id) AS roles
        FROM users u
        WHERE u.status = 1
        ORDER BY u.name ASC, u.username ASC, u.id ASC
      `)
      return ApiResponse.success(res, managers.map(manager => ({
        id: Number(manager.id),
        name: String(manager.name || manager.username || ''),
        username: String(manager.username || ''),
        phone: String(manager.phone || ''),
        role: String(manager.roles || '')
      })))
    } catch (error) {
      log.error('获取管理员列表失败:', error)
      return ApiResponse.error(res, '获取管理员列表失败', 500)
    }
  }

  async stats(req, res) {
    try {
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const conditions = []
      const params = []
      const name = String(req.query.name || '').trim()
      const status = String(req.query.status ?? '').trim()
      if (name) {
        conditions.push('s.name LIKE ?')
        params.push(`%${name}%`)
      }
      if (status !== '') {
        conditions.push('s.status = ?')
        params.push(Number(status) === 1 ? 1 : 0)
      }
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const [result] = await this.repository.executePrepared(`
        SELECT COUNT(*) AS total,
          SUM(s.status = 1) AS active,
          SUM(s.status = 0) AS inactive,
          SUM(s.manager_id IS NOT NULL AND s.manager_id != '') AS with_manager,
          SUM(s.phone IS NOT NULL AND s.phone != '') AS with_phone,
          SUM(s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS recent
        FROM stores s
        ${whereClause}
      `, params)
      const row = result[0] || {}
      return ApiResponse.success(res, {
        total: parseInt(row.total) || 0,
        active: parseInt(row.active) || 0,
        inactive: parseInt(row.inactive) || 0,
        with_manager: parseInt(row.with_manager) || 0,
        with_phone: parseInt(row.with_phone) || 0,
        recent: parseInt(row.recent) || 0
      })
    } catch (error) {
      log.error('获取店铺统计信息失败:', error)
      return ApiResponse.error(res, '获取店铺统计信息失败', 500)
    }
  }

  async reorder(req, res) {
    try {
      const { items } = req.body
      if (!Array.isArray(items) || items.length === 0) return ApiResponse.error(res, '请提供有效的排序数据', 400)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      await this.orderingService.reorder(items)
      this.invalidateCache()
      return ApiResponse.success(res, null, '排序更新成功')
    } catch (error) {
      log.error('批量更新排序失败:', error)
      return ApiResponse.error(res, '批量更新排序失败', 500)
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params
      if (!id || isNaN(parseInt(id))) return ApiResponse.error(res, '无效的店铺ID', 400)
      if (!this.databaseConnected()) return ApiResponse.error(res, '数据库未连接', 500)
      const store = await this.selectStoreById(Number.parseInt(id, 10))
      if (!store) return ApiResponse.notFound(res, '店铺不存在')
      return ApiResponse.success(res, store)
    } catch (error) {
      log.error('获取店铺详情失败:', error)
      return ApiResponse.error(res, '获取店铺详情失败', 500)
    }
  }
}

StoreController.CACHE_TTL = CACHE_TTL
module.exports = StoreController
