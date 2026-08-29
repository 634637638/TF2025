'use strict'

const crypto = require('crypto')
const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const { getDatabase, isConnected } = require('../config/database')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const dataMaskingService = require('../services/dataMaskingService')

const REPAIR_FIELD_MODULE_KEY = 'repairs_repairsview'
const hasRepairAction = (req, action) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : []
  return permissions.includes(`${REPAIR_FIELD_MODULE_KEY}:${action}`) || permissions.includes(`repairs:${action}`)
}
const getRepairFieldPermissions = async (req, preserveActionFields = true) => {
  const permissions = await dataMaskingService.getUserFieldPermissions(req.user.id, REPAIR_FIELD_MODULE_KEY)
  const hiddenFields = new Set(permissions.hiddenFields || [])
  if (preserveActionFields && hasRepairAction(req, 'edit')) {
    hiddenFields.delete('status_info.status')
  }
  return { ...permissions, hiddenFields: Array.from(hiddenFields) }
}
const maskRepairItem = async (item, req) => {
  const permissions = await getRepairFieldPermissions(req)
  return dataMaskingService.filterSensitiveFields([item], permissions)[0]
}
const maskRepairList = async (items, req) => {
  const permissions = await getRepairFieldPermissions(req)
  return dataMaskingService.filterSensitiveFields(items, permissions)
}
const getRepairHiddenFields = async (req) => {
  const permissions = await getRepairFieldPermissions(req, false)
  return new Set(permissions.hiddenFields || [])
}

const REPAIR_WRITE_FIELD_IDS = {
  customer_id: 'customer_info.customer_name',
  brand_id: 'device_info.brand_name',
  phone_model: 'device_info.phone_model',
  imei: 'device_info.imei',
  problem_description: 'repair_info.problem_description',
  technician_id: 'repair_info.technician_name',
  estimated_cost: 'price_info.estimated_cost',
  actual_cost: 'price_info.actual_cost',
  remarks: 'other_info.remarks'
}

const rejectHiddenRepairWriteFields = async (req, res, next) => {
  try {
    const hiddenFields = await getRepairHiddenFields(req)
    const deniedEntry = Object.entries(REPAIR_WRITE_FIELD_IDS).find(([bodyField, fieldId]) => (
      req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
    ))
    if (!deniedEntry) return next()
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

const VALID_STATUSES = new Set(['pending', 'processing', 'completed', 'cancelled'])
const REQUIRED_REPAIR_COLUMNS = [
  'id', 'customer_id', 'phone_id', 'imei', 'photos', 'technician_id',
  'estimated_cost', 'actual_cost', 'remarks', 'created_at', 'updated_at',
  'order_no', 'brand_id', 'phone_model', 'problem_description', 'status', 'completed_at'
]
let schemaPromise

const ensureRepairsSchema = async db => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const [columns] = await db.query('SHOW COLUMNS FROM repairs')
      const existing = new Set(columns.map(column => column.Field))
      const missingColumns = REQUIRED_REPAIR_COLUMNS.filter(column => !existing.has(column))
      if (missingColumns.length > 0) {
        throw new Error(`repairs 表缺少规范字段: ${missingColumns.join(', ')}`)
      }
    })().catch(error => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}

const getDb = async () => {
  if (!isConnected()) throw new Error('数据库未连接')
  const db = getDatabase()
  await ensureRepairsSchema(db)
  return db
}

const parsePositiveId = value => {
  const id = Number.parseInt(String(value), 10)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const parseMoney = value => {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Number(amount.toFixed(2)) : null
}

const generateOrderNo = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `WX-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

const listQuery = `
  SELECT r.id, r.order_no, r.customer_id, c.name AS customer_name, c.phone AS customer_phone,
         r.brand_id, b.name AS brand_name,
         r.phone_model, r.imei,
         r.problem_description, r.estimated_cost, r.actual_cost, r.status,
         r.technician_id, COALESCE(u.name, u.username) AS technician_name,
         r.remarks, r.created_at, r.updated_at, r.completed_at
  FROM repairs r
  LEFT JOIN customers c ON c.id = r.customer_id
  LEFT JOIN brands b ON b.id = r.brand_id
  LEFT JOIN users u ON u.id = r.technician_id
`

router.get('/', unifiedAuth, requirePermission('repairs:view'), async (req, res) => {
  try {
    const db = await getDb()
    const hiddenFields = await getRepairHiddenFields(req)
    const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1)
    const page_size = Math.min(100, Math.max(1, Number.parseInt(String(req.query.page_size || 20), 10) || 20))
    const search = String(req.query.search || '').trim()
    const status = String(req.query.status || '').trim()
    if (status && status !== 'all' && hiddenFields.has('status_info.status')) {
      return res.status(403).json({ success: false, message: '不能使用已隐藏的状态筛选字段', code: 'FIELD_PERMISSION_DENIED' })
    }
    if (status && status !== 'all' && !VALID_STATUSES.has(status)) {
      return ApiResponse.badRequest(res, '维修状态无效')
    }
    const conditions = []
    const params = []
    if (status && status !== 'all' && VALID_STATUSES.has(status)) {
      conditions.push('r.status = ?')
      params.push(status)
    }
    if (search) {
      const searchableColumns = [
        ['basic_info.order_no', 'r.order_no'],
        ['customer_info.customer_name', 'c.name'],
        ['customer_info.customer_phone', 'c.phone'],
        ['device_info.phone_model', 'r.phone_model'],
        ['device_info.imei', 'r.imei']
      ].filter(([fieldId]) => !hiddenFields.has(fieldId))
      if (searchableColumns.length === 0) {
        return res.status(403).json({ success: false, message: '没有可用的维修搜索字段', code: 'FIELD_PERMISSION_DENIED' })
      }
      conditions.push(`(${searchableColumns.map(([, column]) => `${column} LIKE ?`).join(' OR ')})`)
      const pattern = `%${search}%`
      params.push(...searchableColumns.map(() => pattern))
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const offset = (page - 1) * page_size
    const [rowsResult, countResult] = await Promise.all([
      db.execute(`${listQuery}${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ${page_size} OFFSET ${offset}`, params),
      db.execute(`SELECT COUNT(*) AS total FROM repairs r LEFT JOIN customers c ON c.id = r.customer_id${where}`, params)
    ])
    const rows = rowsResult[0] || []
    const total = Number(countResult[0]?.[0]?.total || 0)
    const total_pages = Math.ceil(total / page_size)
    return ApiResponse.success(res, await maskRepairList(rows, req), '获取维修记录成功', 200, {
      pagination: {
        page,
        page_size,
        total,
        total_pages,
        has_next: page < total_pages,
        has_prev: page > 1
      }
    })
  } catch (error) {
    log.error('获取维修记录失败:', error)
    return ApiResponse.serverError(res, '获取维修记录失败', error)
  }
})

router.get('/stats', unifiedAuth, requirePermission('repairs:view'), async (req, res) => {
  try {
    const db = await getDb()
    const [rows] = await db.execute(`
      SELECT
        COALESCE(SUM(status = 'pending'), 0) AS pending,
        COALESCE(SUM(status = 'processing'), 0) AS processing,
        COALESCE(SUM(status = 'completed'), 0) AS completed,
        COALESCE(SUM(CASE WHEN status = 'completed' AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN COALESCE(actual_cost, estimated_cost, 0) ELSE 0 END), 0) AS monthly_revenue
      FROM repairs
    `)
    if (!rows.length) throw new Error('维修统计查询未返回结果')
    return ApiResponse.success(res, await maskRepairItem({
      pending: Number(rows[0].pending),
      processing: Number(rows[0].processing),
      completed: Number(rows[0].completed),
      monthly_revenue: Number(rows[0].monthly_revenue)
    }, req), '获取维修统计成功')
  } catch (error) {
    log.error('获取维修统计失败:', error)
    return ApiResponse.serverError(res, '获取维修统计失败', error)
  }
})

router.get('/options', unifiedAuth, requirePermission('repairs:view'), async (req, res) => {
  try {
    const db = await getDb()
    const [customers, brands, technicians] = await Promise.all([
      db.execute('SELECT id, name, phone FROM customers WHERE status = 1 ORDER BY id DESC LIMIT 500'),
      db.execute('SELECT id, name FROM brands WHERE status = 1 OR status IS NULL ORDER BY sort_order, id LIMIT 200'),
      db.execute('SELECT id, name, username FROM users WHERE status = 1 ORDER BY name, id LIMIT 200')
    ])
    const hiddenFields = await getRepairHiddenFields(req)
    return ApiResponse.success(res, {
      customers: hiddenFields.has('customer_info.customer_name')
        ? []
        : (customers[0] || []).map(item => ({
          id: item.id,
          name: item.name,
          phone: hiddenFields.has('customer_info.customer_phone') ? null : item.phone
        })),
      brands: hiddenFields.has('device_info.brand_name') ? [] : brands[0] || [],
      technicians: hiddenFields.has('repair_info.technician_name')
        ? []
        : (technicians[0] || []).map(item => ({ id: item.id, name: item.name || item.username }))
    }, '获取维修选项成功')
  } catch (error) {
    log.error('获取维修选项失败:', error)
    return ApiResponse.serverError(res, '获取维修选项失败', error)
  }
})

router.get('/:id', unifiedAuth, requirePermission('repairs:view'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id)
    if (!id) return ApiResponse.badRequest(res, '维修单编号无效')
    const db = await getDb()
    const [rows] = await db.execute(`${listQuery} WHERE r.id = ?`, [id])
    if (!rows.length) return ApiResponse.notFound(res, '维修单不存在')
    return ApiResponse.success(res, await maskRepairItem(rows[0], req), '获取维修单详情成功')
  } catch (error) {
    log.error('获取维修单详情失败:', error)
    return ApiResponse.serverError(res, '获取维修单详情失败', error)
  }
})

router.post('/', unifiedAuth, requirePermission('repairs:create'), rejectHiddenRepairWriteFields, async (req, res) => {
  try {
    const customerId = parsePositiveId(req.body?.customer_id)
    const brandId = req.body?.brand_id ? parsePositiveId(req.body.brand_id) : null
    const phoneModel = String(req.body?.phone_model || '').trim()
    const problem = String(req.body?.problem_description || '').trim()
    if (!customerId || !phoneModel || !problem) return ApiResponse.badRequest(res, '请填写客户、手机型号和故障描述')
    const estimatedCost = parseMoney(req.body?.estimated_cost ?? 0)
    if (estimatedCost === null) return ApiResponse.badRequest(res, '预计费用格式不正确')
    const technicianId = req.body?.technician_id ? parsePositiveId(req.body.technician_id) : null
    if (req.body?.technician_id && !technicianId) return ApiResponse.badRequest(res, '维修员编号无效')
    const db = await getDb()
    const [customerRows] = await db.execute('SELECT id FROM customers WHERE id = ? AND status = 1', [customerId])
    if (!customerRows.length) return ApiResponse.badRequest(res, '客户不存在或已停用')
    if (brandId) {
      const [brandRows] = await db.execute('SELECT id FROM brands WHERE id = ?', [brandId])
      if (!brandRows.length) return ApiResponse.badRequest(res, '品牌不存在')
    }
    if (technicianId) {
      const [technicianRows] = await db.execute('SELECT id FROM users WHERE id = ? AND status = 1', [technicianId])
      if (!technicianRows.length) return ApiResponse.badRequest(res, '维修员不存在或已停用')
    }
    const orderNo = generateOrderNo()
    const [result] = await db.execute(`
      INSERT INTO repairs (order_no, customer_id, brand_id, phone_model, imei, problem_description, estimated_cost, technician_id, remarks, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [orderNo, customerId, brandId, phoneModel, String(req.body?.imei || '').trim() || null, problem, estimatedCost, technicianId, String(req.body?.remarks || '').trim() || null])
    const [rows] = await db.execute(`${listQuery} WHERE r.id = ?`, [result.insertId])
    return ApiResponse.created(res, await maskRepairItem(rows[0], req), '维修单创建成功')
  } catch (error) {
    log.error('创建维修单失败:', error)
    return ApiResponse.serverError(res, '创建维修单失败', error)
  }
})

router.put('/:id', unifiedAuth, requirePermission('repairs:edit'), rejectHiddenRepairWriteFields, async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id)
    if (!id) return ApiResponse.badRequest(res, '维修单编号无效')
    const db = await getDb()
    const updates = []
    const params = []
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'customer_id')) {
      const customerId = parsePositiveId(req.body.customer_id)
      if (!customerId) return ApiResponse.badRequest(res, '客户编号无效')
      const [customerRows] = await db.execute('SELECT id FROM customers WHERE id = ? AND status = 1', [customerId])
      if (!customerRows.length) return ApiResponse.badRequest(res, '客户不存在或已停用')
      updates.push('customer_id = ?')
      params.push(customerId)
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'brand_id')) {
      const brandId = req.body.brand_id ? parsePositiveId(req.body.brand_id) : null
      if (req.body.brand_id && !brandId) return ApiResponse.badRequest(res, '品牌编号无效')
      if (brandId) {
        const [brandRows] = await db.execute('SELECT id FROM brands WHERE id = ?', [brandId])
        if (!brandRows.length) return ApiResponse.badRequest(res, '品牌不存在')
      }
      updates.push('brand_id = ?')
      params.push(brandId)
    }
    const fields = {
      phone_model: value => String(value || '').trim(),
      imei: value => String(value || '').trim() || null,
      problem_description: value => String(value || '').trim(),
      remarks: value => String(value || '').trim() || null,
      technician_id: value => value ? parsePositiveId(value) : null
    }
    for (const [field, normalize] of Object.entries(fields)) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        const value = normalize(req.body[field])
        if (field === 'technician_id' && req.body[field] && !value) return ApiResponse.badRequest(res, '维修员编号无效')
        if ((field === 'phone_model' || field === 'problem_description') && !value) {
          return ApiResponse.badRequest(res, field === 'phone_model' ? '手机型号不能为空' : '故障描述不能为空')
        }
        if (field === 'technician_id' && value) {
          const [technicianRows] = await db.execute('SELECT id FROM users WHERE id = ? AND status = 1', [value])
          if (!technicianRows.length) return ApiResponse.badRequest(res, '维修员不存在或已停用')
        }
        updates.push(`${field} = ?`)
        params.push(value)
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'estimated_cost')) {
      const value = parseMoney(req.body.estimated_cost)
      if (value === null) return ApiResponse.badRequest(res, '预计费用格式不正确')
      updates.push('estimated_cost = ?')
      params.push(value)
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'actual_cost')) {
      const value = parseMoney(req.body.actual_cost)
      if (value === null) return ApiResponse.badRequest(res, '实际费用格式不正确')
      updates.push('actual_cost = ?')
      params.push(value)
    }
    if (!updates.length) return ApiResponse.badRequest(res, '没有可更新的字段')
    params.push(id)
    const [result] = await db.execute(`UPDATE repairs SET ${updates.join(', ')} WHERE id = ?`, params)
    if (!result.affectedRows) return ApiResponse.notFound(res, '维修单不存在')
    const [rows] = await db.execute(`${listQuery} WHERE r.id = ?`, [id])
    return ApiResponse.success(res, await maskRepairItem(rows[0], req), '维修单更新成功')
  } catch (error) {
    log.error('更新维修单失败:', error)
    return ApiResponse.serverError(res, '更新维修单失败', error)
  }
})

router.patch('/:id/status', unifiedAuth, requirePermission('repairs:edit'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id)
    const status = String(req.body?.status || '')
    if (!id || !VALID_STATUSES.has(status)) return ApiResponse.badRequest(res, '维修状态无效')
    const db = await getDb()
    const [result] = await db.execute('UPDATE repairs SET status = ?, completed_at = CASE WHEN ? = \'completed\' THEN COALESCE(completed_at, NOW()) ELSE NULL END WHERE id = ?', [status, status, id])
    if (!result.affectedRows) return ApiResponse.notFound(res, '维修单不存在')
    const [rows] = await db.execute(`${listQuery} WHERE r.id = ?`, [id])
    return ApiResponse.success(res, await maskRepairItem(rows[0], req), '维修状态更新成功')
  } catch (error) {
    log.error('更新维修状态失败:', error)
    return ApiResponse.serverError(res, '更新维修状态失败', error)
  }
})

router.delete('/:id', unifiedAuth, requirePermission('repairs:edit'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id)
    if (!id) return ApiResponse.badRequest(res, '维修单编号无效')
    const db = await getDb()
    const [result] = await db.execute("UPDATE repairs SET status = 'cancelled' WHERE id = ? AND status != 'completed'", [id])
    if (!result.affectedRows) return ApiResponse.notFound(res, '维修单不存在或已完成')
    return ApiResponse.success(res, null, '维修单已取消')
  } catch (error) {
    log.error('取消维修单失败:', error)
    return ApiResponse.serverError(res, '取消维修单失败', error)
  }
})

module.exports = router
