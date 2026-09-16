const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const { getDatabase, isConnected } = require('../config/database')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')

const SUPPLIER_COLUMNS = [
  'id', 'name', 'contact', 'phone', 'address', 'bank_info', 'tax_number',
  'status', 'remarks', 'created_at', 'updated_at', 'sort_order'
].join(', ')
const SUPPLIER_SORT_COLUMNS = new Set(['id', 'name', 'status', 'sort_order', 'created_at', 'updated_at'])
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 10000

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const parseSupplierId = value => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const normalizeNullableString = value => {
  if (value === null || value === undefined) return null
  return String(value).trim()
}

const formatSupplier = row => ({
  id: Number(row.id),
  name: String(row.name || '').trim(),
  contact: normalizeNullableString(row.contact),
  phone: normalizeNullableString(row.phone),
  address: normalizeNullableString(row.address),
  bank_info: normalizeNullableString(row.bank_info),
  tax_number: normalizeNullableString(row.tax_number),
  status: Number(row.status) === 1 ? 1 : 0,
  sort_order: Number(row.sort_order) || 0,
  remarks: normalizeNullableString(row.remarks),
  created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
})

const parseStatus = value => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return parsed === 0 || parsed === 1 ? parsed : undefined
}

router.use(unifiedAuth)

// 获取供应商列表
router.get('/', requirePermission('suppliers:view'), async (req, res) => {
  try {
    if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

    const {
      page = 1,
      page_size = DEFAULT_PAGE_SIZE,
      name,
      status,
      sort_by,
      sort_order
    } = req.query
    const pageNum = parsePositiveInteger(page, 1)
    const pageSizeNum = Math.min(parsePositiveInteger(page_size, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
    const offset = (pageNum - 1) * pageSizeNum
    const statusValue = parseStatus(status)
    if (statusValue === undefined) return ApiResponse.badRequest(res, '供应商状态只能是0或1')

    const conditions = []
    const params = []
    const normalizedName = normalizeNullableString(name)
    if (normalizedName) {
      conditions.push('name LIKE ?')
      params.push(`%${normalizedName}%`)
    }
    if (statusValue !== null) {
      conditions.push('status = ?')
      params.push(statusValue)
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
    const sortColumn = SUPPLIER_SORT_COLUMNS.has(sort_by) ? sort_by : 'sort_order'
    const sortDirection = String(sort_order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const fallbackOrder = sortColumn === 'sort_order' ? ', name ASC, id ASC' : ', sort_order ASC, id ASC'
    const pool = getDatabase()
    const [[supplierRows], [countRows]] = await Promise.all([
      pool.execute(
        `SELECT ${SUPPLIER_COLUMNS} FROM suppliers${whereClause} ` +
        `ORDER BY ${sortColumn} ${sortDirection}${fallbackOrder} LIMIT ${pageSizeNum} OFFSET ${offset}`,
        params
      ),
      pool.execute(`SELECT COUNT(*) AS total FROM suppliers${whereClause}`, params)
    ])

    const total = Number(countRows[0]?.total) || 0
    const total_pages = Math.ceil(total / pageSizeNum)
    const pagination = {
      page: pageNum,
      page_size: pageSizeNum,
      total,
      total_pages,
      has_next: pageNum < total_pages,
      has_prev: pageNum > 1
    }
    return ApiResponse.success(res, supplierRows.map(formatSupplier), '获取供应商列表成功', 200, { pagination })
  } catch (error) {
    log.error('获取供应商列表失败:', error)
    return ApiResponse.error(res, '获取供应商列表失败', 500)
  }
})

// 获取供应商汇总统计。统计条件必须与列表保持一致，但不受分页影响。
router.get('/stats', requirePermission('suppliers:view'), async (req, res) => {
  try {
    if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

    const normalizedName = normalizeNullableString(req.query.name)
    const statusValue = parseStatus(req.query.status)
    if (statusValue === undefined) return ApiResponse.badRequest(res, '供应商状态只能是0或1')

    const conditions = []
    const params = []
    if (normalizedName) {
      conditions.push('name LIKE ?')
      params.push(`%${normalizedName}%`)
    }
    if (statusValue !== null) {
      conditions.push('status = ?')
      params.push(statusValue)
    }

    const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const [rows] = await getDatabase().execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS inactive,
         SUM(CASE WHEN phone IS NOT NULL AND TRIM(phone) <> '' THEN 1 ELSE 0 END) AS phone_completion
       FROM suppliers${whereClause}`,
      params
    )
    const row = rows[0] || {}
    return ApiResponse.success(res, {
      total: Number(row.total) || 0,
      active: Number(row.active) || 0,
      inactive: Number(row.inactive) || 0,
      phone_completion: Number(row.phone_completion) || 0
    }, '获取供应商统计成功')
  } catch (error) {
    log.error('获取供应商统计失败:', error)
    return ApiResponse.error(res, '获取供应商统计失败', 500)
  }
})

// 导出供应商
router.get('/export', requirePermission('suppliers:export'), async (req, res) => {
  try {
    if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

    const { name, status } = req.query
    const statusValue = parseStatus(status)
    if (statusValue === undefined) return ApiResponse.badRequest(res, '供应商状态只能是0或1')

    const conditions = []
    const params = []
    const normalizedName = normalizeNullableString(name)
    if (normalizedName) {
      conditions.push('name LIKE ?')
      params.push(`%${normalizedName}%`)
    }
    if (statusValue !== null) {
      conditions.push('status = ?')
      params.push(statusValue)
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
    const [suppliers] = await getDatabase().execute(
      `SELECT ${SUPPLIER_COLUMNS} FROM suppliers${whereClause} ORDER BY sort_order ASC, name ASC, id ASC`,
      params
    )
    const csvHeaders = [
      'ID', '供应商名称', '联系人', '联系电话', '地址', '银行信息',
      '税号', '状态', '排序', '备注', '创建时间', '更新时间'
    ]
    const escapeCsvValue = value => {
      if (value === null || value === undefined) return '""'
      return `"${String(value).replace(/"/g, '""')}"`
    }
    const csvRows = suppliers.map(row => ([
      row.id, row.name, row.contact, row.phone, row.address, row.bank_info,
      row.tax_number, Number(row.status) === 1 ? '启用' : '禁用', row.sort_order,
      row.remarks, row.created_at, row.updated_at
    ].map(escapeCsvValue).join(',')))
    const csvContent = `\ufeff${csvHeaders.join(',')}\n${csvRows.join('\n')}`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="suppliers_${Date.now()}.csv"`)
    return res.status(200).send(csvContent)
  } catch (error) {
    log.error('导出供应商失败:', error)
    return ApiResponse.error(res, '导出供应商失败', 500)
  }
})

// 批量更新排序
router.put('/batch/reorder', requirePermission('suppliers:edit'), async (req, res) => {
  if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

  const { items } = req.body
  if (!Array.isArray(items) || items.length === 0) {
    return ApiResponse.badRequest(res, '请提供有效的排序数据')
  }

  const normalizedItems = items.map(item => ({
    id: parseSupplierId(item?.id),
    sort_order: Number.parseInt(item?.sort_order, 10)
  }))
  if (normalizedItems.some(item => item.id === null || !Number.isInteger(item.sort_order) || item.sort_order < 0)) {
    return ApiResponse.badRequest(res, '排序数据包含无效字段')
  }

  let connection
  try {
    connection = await getDatabase().getConnection()
    await connection.beginTransaction()
    for (const item of normalizedItems) {
      await connection.execute(
        'UPDATE suppliers SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.sort_order, item.id]
      )
    }
    await connection.commit()
    return ApiResponse.success(res, { updated_count: normalizedItems.length }, '排序更新成功')
  } catch (error) {
    if (connection) await connection.rollback()
    log.error('批量更新排序失败:', error)
    return ApiResponse.error(res, '批量更新排序失败', 500)
  } finally {
    if (connection) connection.release()
  }
})

// 创建供应商
router.post('/', requirePermission('suppliers:create'), async (req, res) => {
  try {
    if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

    const {
      name, contact, phone, address, bank_info, tax_number,
      status = 1, sort_order = 0, remarks
    } = req.body
    const normalizedName = normalizeNullableString(name)
    const statusValue = parseStatus(status)
    const sortOrderValue = Number.parseInt(sort_order, 10)
    if (!normalizedName) return ApiResponse.badRequest(res, '供应商名称不能为空')
    if (statusValue === undefined || statusValue === null) {
      return ApiResponse.badRequest(res, '供应商状态只能是0或1')
    }
    if (!Number.isInteger(sortOrderValue) || sortOrderValue < 0) {
      return ApiResponse.badRequest(res, '排序值必须是非负整数')
    }

    const pool = getDatabase()
    const [existingSuppliers] = await pool.execute('SELECT id FROM suppliers WHERE name = ?', [normalizedName])
    if (existingSuppliers.length > 0) {
      return ApiResponse.error(res, `供应商名称"${normalizedName}"已存在，请使用其他名称`, 409)
    }
    const [result] = await pool.execute(`
      INSERT INTO suppliers (
        name, contact, phone, address, bank_info, tax_number,
        status, sort_order, remarks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      normalizedName,
      normalizeNullableString(contact),
      normalizeNullableString(phone),
      normalizeNullableString(address),
      normalizeNullableString(bank_info),
      normalizeNullableString(tax_number),
      statusValue,
      sortOrderValue,
      normalizeNullableString(remarks)
    ])
    return ApiResponse.created(res, '供应商创建成功', { id: Number(result.insertId) })
  } catch (error) {
    log.error('创建供应商失败:', error)
    return ApiResponse.error(res, '创建供应商失败', 500)
  }
})

// 更新供应商
router.put('/:id', requirePermission('suppliers:edit'), async (req, res) => {
  try {
    if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

    const supplierId = parseSupplierId(req.params.id)
    if (supplierId === null) return ApiResponse.badRequest(res, '无效的供应商ID')

    const {
      name, contact, phone, address, bank_info, tax_number,
      status, sort_order, remarks
    } = req.body
    const normalizedName = normalizeNullableString(name)
    const statusValue = parseStatus(status)
    const sortOrderValue = Number.parseInt(sort_order, 10)
    if (!normalizedName) return ApiResponse.badRequest(res, '供应商名称不能为空')
    if (statusValue === undefined || statusValue === null) {
      return ApiResponse.badRequest(res, '供应商状态只能是0或1')
    }
    if (!Number.isInteger(sortOrderValue) || sortOrderValue < 0) {
      return ApiResponse.badRequest(res, '排序值必须是非负整数')
    }

    const pool = getDatabase()
    const [duplicateRows] = await pool.execute(
      'SELECT id FROM suppliers WHERE name = ? AND id != ?',
      [normalizedName, supplierId]
    )
    if (duplicateRows.length > 0) {
      return ApiResponse.error(res, `供应商名称"${normalizedName}"已存在，请使用其他名称`, 409)
    }
    const [result] = await pool.execute(`
      UPDATE suppliers
      SET name = ?, contact = ?, phone = ?, address = ?, bank_info = ?,
          tax_number = ?, status = ?, sort_order = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      normalizedName,
      normalizeNullableString(contact),
      normalizeNullableString(phone),
      normalizeNullableString(address),
      normalizeNullableString(bank_info),
      normalizeNullableString(tax_number),
      statusValue,
      sortOrderValue,
      normalizeNullableString(remarks),
      supplierId
    ])
    if (result.affectedRows === 0) return ApiResponse.notFound(res, '供应商不存在')
    return ApiResponse.success(res, null, '供应商更新成功')
  } catch (error) {
    log.error('更新供应商失败:', error)
    return ApiResponse.error(res, '更新供应商失败', 500)
  }
})

// 删除供应商
router.delete('/:id', requirePermission('suppliers:delete'), async (req, res) => {
  try {
    if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

    const supplierId = parseSupplierId(req.params.id)
    if (supplierId === null) return ApiResponse.badRequest(res, '无效的供应商ID')

    const pool = getDatabase()
    const [[accessoryRows], [phoneRows]] = await Promise.all([
      pool.execute('SELECT COUNT(*) AS count FROM accessories WHERE supplier_id = ?', [supplierId]),
      pool.execute('SELECT COUNT(*) AS count FROM phones WHERE supplier_id = ?', [supplierId])
    ])
    const accessory_count = Number(accessoryRows[0]?.count) || 0
    const phone_count = Number(phoneRows[0]?.count) || 0
    if (accessory_count > 0 || phone_count > 0) {
      const details = []
      if (accessory_count > 0) details.push(`${accessory_count}个配件`)
      if (phone_count > 0) details.push(`${phone_count}个手机`)
      return ApiResponse.error(res, `该供应商下还有关联的商品，无法删除（${details.join('，')}）`, 409)
    }

    const [result] = await pool.execute('DELETE FROM suppliers WHERE id = ?', [supplierId])
    if (result.affectedRows === 0) return ApiResponse.notFound(res, '供应商不存在')
    return ApiResponse.success(res, null, '供应商删除成功')
  } catch (error) {
    log.error('删除供应商失败:', error)
    return ApiResponse.error(res, '删除供应商失败', 500)
  }
})

// 获取供应商详情
router.get('/:id', requirePermission('suppliers:view'), async (req, res) => {
  try {
    if (!isConnected()) return ApiResponse.error(res, '数据库未连接', 500)

    const supplierId = parseSupplierId(req.params.id)
    if (supplierId === null) return ApiResponse.badRequest(res, '无效的供应商ID')

    const pool = getDatabase()
    const [[supplierRows], [accessoryStats], [phoneStats]] = await Promise.all([
      pool.execute(`SELECT ${SUPPLIER_COLUMNS} FROM suppliers WHERE id = ?`, [supplierId]),
      pool.execute(
        'SELECT COUNT(*) AS count, COALESCE(SUM(purchase_cost), 0) AS total_cost FROM accessories WHERE supplier_id = ?',
        [supplierId]
      ),
      pool.execute(
        'SELECT COUNT(*) AS count, COALESCE(SUM(purchase_cost), 0) AS total_cost FROM phones WHERE supplier_id = ?',
        [supplierId]
      )
    ])
    if (supplierRows.length === 0) return ApiResponse.notFound(res, '供应商不存在')

    return ApiResponse.success(res, {
      ...formatSupplier(supplierRows[0]),
      stats: {
        accessories_count: Number(accessoryStats[0]?.count) || 0,
        accessories_total_cost: Number(accessoryStats[0]?.total_cost) || 0,
        phones_count: Number(phoneStats[0]?.count) || 0,
        phones_total_cost: Number(phoneStats[0]?.total_cost) || 0
      }
    })
  } catch (error) {
    log.error('获取供应商详情失败:', error)
    return ApiResponse.error(res, '获取供应商详情失败', 500)
  }
})

module.exports = router
