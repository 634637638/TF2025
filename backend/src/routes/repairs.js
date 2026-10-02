'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const express = require('express')
const multer = require('multer')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { getDatabase, isConnected } = require('../config/database')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const dataMaskingService = require('../services/dataMaskingService')
const { generateMemberNumber } = require('../utils/member-number')
const { getUploadSubdir, getUploadUrl, getRelativeUploadPathFromUrl, getUploadPathFromUrl } = require('../utils/upload-paths')
const { validateUploadedFileSignature, removeUploadedFiles } = require('../utils/upload-file-validation')
const { searchCustomers: searchCustomerOptions } = require('../services/customer-search.service')

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
  phone_id: 'device_info.phone_id',
  phone_model: 'device_info.phone_model',
  imei: 'device_info.imei',
  serial_number: 'device_info.serial_number',
  color_id: 'device_info.color_name',
  memory_id: 'device_info.memory_size',
  problem_description: 'repair_info.problem_description',
  technician_id: 'repair_info.technician_name',
  actual_cost: 'price_info.actual_cost',
  remarks: 'other_info.remarks',
  repair_time: 'time_info.created_at',
  photos: 'repair_info.photos'
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
  'id', 'customer_id', 'phone_id', 'imei', 'serial_number', 'color_id', 'memory_id', 'photos', 'technician_id',
  'actual_cost', 'remarks', 'created_at', 'repair_time', 'updated_at',
  'order_no', 'brand_id', 'phone_model', 'problem_description', 'status', 'completed_at'
]

const repairTempDirectory = getUploadSubdir('repairs', 'temp')
const repairMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdirSync(repairTempDirectory, { recursive: true })
      callback(null, repairTempDirectory)
    },
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname || '').toLowerCase()
      callback(null, `${Number(req.user?.id) || 0}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${extension}`)
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase()
    const image = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'])
    const video = new Set(['.mp4', '.webm', '.mov', '.ogg', '.m4v'])
    if (image.has(extension) || video.has(extension)) return callback(null, true)
    const error = new Error('仅支持图片或视频文件')
    error.status = 400
    return callback(error)
  }
})

const parseStoredRepairMedia = value => {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

const mediaTypeFromUrl = url => /\.(mp4|webm|mov|ogg|m4v)(?:$|[?#])/i.test(url) ? 'video' : 'image'
const buildRepairMediaUrl = relativePath => `/api/repairs/media/${String(relativePath).replace(/\\/g, '/').replace(/^repairs\//, '')}`
const normalizeRepairMedia = value => {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const url = typeof item === 'string' ? item : item?.url
    if (typeof url !== 'string' || !url.trim()) throw new Error('维修媒体地址无效')
    const relative = getRelativeUploadPathFromUrl(url)
    if (!relative || !relative.startsWith('repairs/')) throw new Error('维修媒体必须保存于维修附件目录')
    const type = item?.type === 'video' || item?.type?.startsWith?.('video/')
      ? 'video'
      : mediaTypeFromUrl(relative)
    return {
      url: relative.startsWith('repairs/temp/') ? getUploadUrl(...relative.split('/')) : buildRepairMediaUrl(relative),
      type,
      name: String(item?.name || path.basename(relative))
    }
  })
}

const normalizeRepairRow = row => ({
  ...row,
  photos: normalizeRepairMedia(parseStoredRepairMedia(row.photos))
})

const moveRepairTempMedia = async (media, repairId, userId) => {
  const targetDirectory = getUploadSubdir('repairs', String(repairId))
  await fs.promises.mkdir(targetDirectory, { recursive: true })
  return Promise.all(media.map(async item => {
    const relative = getRelativeUploadPathFromUrl(item.url)
    if (!relative.startsWith('repairs/temp/')) return item
    const filename = path.basename(relative)
    if (!filename.startsWith(`${Number(userId)}_`)) throw new Error('只能保存当前用户上传的临时媒体')
    const targetPath = path.join(targetDirectory, filename)
    await fs.promises.rename(getUploadPathFromUrl(item.url), targetPath)
    return { ...item, url: buildRepairMediaUrl(`repairs/${repairId}/${filename}`) }
  }))
}

const removeRepairMediaFiles = async media => {
  await Promise.all(media.map(async item => {
    const relative = getRelativeUploadPathFromUrl(item?.url)
    if (!relative.startsWith('repairs/')) return
    try { await fs.promises.unlink(getUploadPathFromUrl(item.url)) } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }))
}
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
         r.phone_id, r.phone_model, r.imei, r.serial_number,
         r.color_id, co.name AS color_name,
         r.memory_id, me.size AS memory_size,
         r.photos,
         r.problem_description, r.actual_cost, r.status,
         r.technician_id, COALESCE(u.name, u.username) AS technician_name,
         r.remarks, COALESCE(r.repair_time, r.created_at) AS repair_time
  FROM repairs r
  LEFT JOIN customers c ON c.id = r.customer_id
  LEFT JOIN brands b ON b.id = r.brand_id
  LEFT JOIN colors co ON co.id = r.color_id
  LEFT JOIN memories me ON me.id = r.memory_id
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
        ['device_info.imei', 'r.imei'],
        ['device_info.serial_number', 'r.serial_number']
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
      db.execute(`${listQuery}${where} ORDER BY COALESCE(r.repair_time, r.created_at) DESC, r.id DESC LIMIT ${page_size} OFFSET ${offset}`, params),
      db.execute(`SELECT COUNT(*) AS total FROM repairs r LEFT JOIN customers c ON c.id = r.customer_id${where}`, params)
    ])
    const rows = rowsResult[0] || []
    const total = Number(countResult[0]?.[0]?.total || 0)
    const total_pages = Math.ceil(total / page_size)
    return ApiResponse.success(res, await maskRepairList(rows.map(normalizeRepairRow), req), '获取维修记录成功', 200, {
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
    const hiddenFields = await getRepairHiddenFields(req)
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
    if (status && status !== 'all') {
      conditions.push('r.status = ?')
      params.push(status)
    }
    if (search) {
      const searchableColumns = [
        ['basic_info.order_no', 'r.order_no'],
        ['customer_info.customer_name', 'c.name'],
        ['customer_info.customer_phone', 'c.phone'],
        ['device_info.phone_model', 'r.phone_model'],
        ['device_info.imei', 'r.imei'],
        ['device_info.serial_number', 'r.serial_number']
      ].filter(([fieldId]) => !hiddenFields.has(fieldId))
      if (searchableColumns.length === 0) {
        return res.status(403).json({ success: false, message: '没有可用的维修搜索字段', code: 'FIELD_PERMISSION_DENIED' })
      }
      const pattern = `%${search}%`
      conditions.push(`(${searchableColumns.map(([, column]) => `${column} LIKE ?`).join(' OR ')})`)
      params.push(...searchableColumns.map(() => pattern))
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const [rows] = await db.execute(`
      SELECT
        COALESCE(SUM(r.status = 'pending'), 0) AS pending,
        COALESCE(SUM(r.status = 'processing'), 0) AS processing,
        COALESCE(SUM(r.status = 'completed'), 0) AS completed,
        COALESCE(SUM(CASE WHEN r.status = 'completed' AND COALESCE(r.repair_time, r.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN COALESCE(r.actual_cost, 0) ELSE 0 END), 0) AS monthly_revenue
      FROM repairs r
      LEFT JOIN customers c ON c.id = r.customer_id
      ${where}
    `, params)
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
    const [brands, models, colors, memories, technicians] = await Promise.all([
      db.execute('SELECT id, name FROM brands WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      db.execute('SELECT id, name, brand_id FROM models WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      db.execute('SELECT id, name FROM colors WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      db.execute('SELECT id, size FROM memories WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      db.execute('SELECT id, name, username FROM users WHERE status = 1 ORDER BY name, id')
    ])
    const hiddenFields = await getRepairHiddenFields(req)
    return ApiResponse.success(res, {
      brands: hiddenFields.has('device_info.brand_name') ? [] : brands[0] || [],
      models: hiddenFields.has('device_info.phone_model') ? [] : models[0] || [],
      colors: hiddenFields.has('device_info.color_name') ? [] : colors[0] || [],
      memories: hiddenFields.has('device_info.memory_size') ? [] : memories[0] || [],
      technicians: hiddenFields.has('repair_info.technician_name')
        ? []
        : (technicians[0] || []).map(item => ({ id: item.id, name: item.name || item.username }))
    }, '获取维修选项成功')
  } catch (error) {
    log.error('获取维修选项失败:', error)
    return ApiResponse.serverError(res, '获取维修选项失败', error)
  }
})

router.get('/customers/search', unifiedAuth, requireAnyPermission(['repairs:view', 'repairs:create', 'repairs:edit']), async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim()
    if (keyword.length < 2) return ApiResponse.success(res, [], '请输入至少2位姓名或手机号')
    const hiddenFields = await getRepairHiddenFields(req)
    const columns = [
      ['customer_info.customer_name', 'name'],
      ['customer_info.customer_phone', 'phone']
    ].filter(([field]) => !hiddenFields.has(field))
    if (!columns.length) return res.status(403).json({ success: false, message: '没有可用的客户检索字段', code: 'FIELD_PERMISSION_DENIED' })
    const result = await searchCustomerOptions({
      keyword,
      page: req.query.page,
      page_size: req.query.page_size,
      fields: ['id', 'name', 'phone'],
      search_fields: columns.map(([, column]) => column)
    })
    const rows = result.records
    return ApiResponse.success(res, rows.map(row => ({
      id: row.id,
      name: hiddenFields.has('customer_info.customer_name') ? null : row.name,
      phone: hiddenFields.has('customer_info.customer_phone') ? null : row.phone
    })), '客户检索成功')
  } catch (error) {
    log.error('维修客户检索失败:', error)
    return ApiResponse.serverError(res, '客户检索失败', error)
  }
})

router.post('/customers', unifiedAuth, requirePermission('repairs:create'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    const phone = String(req.body?.phone || '').trim()
    if (!name) return ApiResponse.badRequest(res, '请输入客户姓名')
    if (!/^1[3-9]\d{9}$/.test(phone)) return ApiResponse.badRequest(res, '请输入有效的11位手机号码')
    const hiddenFields = await getRepairHiddenFields(req)
    if (hiddenFields.has('customer_info.customer_name') || hiddenFields.has('customer_info.customer_phone')) {
      return res.status(403).json({ success: false, message: '客户姓名或手机号字段不可用', code: 'FIELD_PERMISSION_DENIED' })
    }
    const db = await getDb()
    const [existing] = await db.execute('SELECT id, name, phone FROM customers WHERE phone = ? LIMIT 1', [phone])
    if (existing.length) return ApiResponse.badRequest(res, '该手机号已存在，请检索并选择已有客户')
    const memberNumber = await generateMemberNumber()
    const [result] = await db.execute(
      `INSERT INTO customers (name, phone, customer_type, status, member_number, created_at, updated_at)
       VALUES (?, ?, 'individual', 1, ?, NOW(), NOW())`,
      [name, phone, memberNumber]
    )
    return ApiResponse.created(res, { id: result.insertId, name, phone }, '客户创建成功')
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return ApiResponse.badRequest(res, '该手机号已存在，请检索并选择已有客户')
    log.error('维修新建客户失败:', error)
    return ApiResponse.serverError(res, '客户创建失败', error)
  }
})

router.get('/devices/search', unifiedAuth, requirePermission('repairs:view'), async (req, res) => {
  try {
    const keyword = String(req.query.q || '').trim()
    if (keyword.length < 2) return ApiResponse.success(res, [], '请输入至少 2 位设备编号')
    const db = await getDb()
    const like = `%${keyword}%`
    const [rows] = await db.execute(`
      SELECT p.id AS phone_id, p.imei, p.serial_number,
             p.brand_id, b.name AS brand_name,
             p.model_id, mo.name AS model_name,
             p.color_id, co.name AS color_name,
             p.memory_id, me.size AS memory_size,
             latest_sale.customer_id,
             cu.name AS customer_name, cu.phone AS customer_phone
      FROM phones p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN models mo ON mo.id = p.model_id
      LEFT JOIN colors co ON co.id = p.color_id
      LEFT JOIN memories me ON me.id = p.memory_id
      LEFT JOIN (
        SELECT s.phone_id, s.customer_id,
               ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC, s.id DESC) AS rn
        FROM sales s
      ) latest_sale ON latest_sale.phone_id = p.id AND latest_sale.rn = 1
      LEFT JOIN customers cu ON cu.id = latest_sale.customer_id
      WHERE p.imei LIKE ? OR p.serial_number LIKE ?
      ORDER BY CASE WHEN p.imei = ? OR p.serial_number = ? THEN 0 ELSE 1 END, p.id DESC
      LIMIT 20
    `, [like, like, keyword, keyword])
    const hiddenFields = await getRepairHiddenFields(req)
    const maskedRows = rows.map(row => ({
      ...row,
      customer_id: hiddenFields.has('customer_info.customer_name') ? null : row.customer_id,
      customer_name: hiddenFields.has('customer_info.customer_name') ? null : row.customer_name,
      customer_phone: hiddenFields.has('customer_info.customer_phone') ? null : row.customer_phone,
      brand_id: hiddenFields.has('device_info.brand_name') ? null : row.brand_id,
      brand_name: hiddenFields.has('device_info.brand_name') ? null : row.brand_name,
      model_id: hiddenFields.has('device_info.phone_model') ? null : row.model_id,
      model_name: hiddenFields.has('device_info.phone_model') ? null : row.model_name,
      color_id: hiddenFields.has('device_info.color_name') ? null : row.color_id,
      color_name: hiddenFields.has('device_info.color_name') ? null : row.color_name,
      memory_id: hiddenFields.has('device_info.memory_size') ? null : row.memory_id,
      memory_size: hiddenFields.has('device_info.memory_size') ? null : row.memory_size,
      imei: hiddenFields.has('device_info.imei') ? null : row.imei,
      serial_number: hiddenFields.has('device_info.serial_number') ? null : row.serial_number
    }))
    return ApiResponse.success(res, maskedRows, '设备检索成功')
  } catch (error) {
    log.error('检索维修设备失败:', error)
    return ApiResponse.serverError(res, '检索维修设备失败', error)
  }
})

router.post('/upload/media', unifiedAuth, requireAnyPermission(['repairs:create', 'repairs:edit']), (req, res, next) => {
  repairMediaUpload.array('files', 12)(req, res, error => {
    if (!error) return next()
    for (const file of req.files || []) {
      try { fs.unlinkSync(file.path) } catch (_cleanupError) {}
    }
    return ApiResponse.error(res, error.message || '媒体上传失败', error.status || 400)
  })
}, async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : []
    if (!files.length) return ApiResponse.badRequest(res, '请选择图片或视频')
    const valid = await Promise.all(files.map(file => validateUploadedFileSignature(file, ['image', 'video'])))
    if (valid.some(item => !item)) {
      await removeUploadedFiles(files)
      return ApiResponse.badRequest(res, '文件内容与图片或视频格式不匹配')
    }
    return ApiResponse.success(res, {
      files: files.map(file => ({
        url: buildRepairMediaUrl(`repairs/temp/${file.filename}`),
        name: file.originalname,
        type: file.mimetype || mediaTypeFromUrl(file.filename),
        size: file.size
      }))
    }, '媒体上传成功')
  } catch (error) {
    await removeUploadedFiles(Array.isArray(req.files) ? req.files : []).catch(() => {})
    log.error('上传维修媒体失败:', error)
    return ApiResponse.serverError(res, '媒体上传失败', error)
  }
})

router.post('/upload/cleanup', unifiedAuth, requireAnyPermission(['repairs:create', 'repairs:edit']), async (req, res) => {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : []
    for (const url of files) {
      const relative = getRelativeUploadPathFromUrl(url)
      const filename = path.basename(relative)
      if (!relative.startsWith('repairs/temp/') || !filename.startsWith(`${Number(req.user.id)}_`)) {
        return res.status(403).json({ success: false, message: '只能清理本人上传的维修临时媒体', code: 'REPAIR_MEDIA_OWNER_REQUIRED' })
      }
    }
    await Promise.all(files.map(async url => {
      const filePath = getUploadPathFromUrl(url)
      try {
        const metadata = await fs.promises.stat(filePath)
        if (metadata.isFile() && Date.now() - metadata.mtimeMs <= 2 * 60 * 60 * 1000) {
          await fs.promises.unlink(filePath)
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }))
    return ApiResponse.success(res, null, '未保存维修媒体已清理')
  } catch (error) {
    log.error('清理维修临时媒体失败:', error)
    return ApiResponse.serverError(res, '清理维修临时媒体失败', error)
  }
})

router.get('/media/*', unifiedAuth, requirePermission('repairs:view'), async (req, res) => {
  try {
    const requestedPath = typeof req.params[0] === 'string' ? req.params[0] : ''
    const relative = `repairs/${requestedPath}`.replace(/\\/g, '/')
    if (!/^repairs\/(?:temp\/)?[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)?$/.test(relative)) {
      return res.status(400).json({ success: false, message: '无效的维修媒体路径' })
    }
    const absolutePath = getUploadPathFromUrl(`/uploads/${relative}`)
    const root = path.resolve(getUploadSubdir('repairs'))
    if (!absolutePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: '维修媒体不存在' })
    }
    return res.sendFile(absolutePath)
  } catch (error) {
    log.error('读取维修媒体失败:', error)
    return ApiResponse.serverError(res, '读取维修媒体失败', error)
  }
})

router.get('/:id', unifiedAuth, requirePermission('repairs:view'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id)
    if (!id) return ApiResponse.badRequest(res, '维修单编号无效')
    const db = await getDb()
    const [rows] = await db.execute(`${listQuery} WHERE r.id = ?`, [id])
    if (!rows.length) return ApiResponse.notFound(res, '维修单不存在')
    return ApiResponse.success(res, await maskRepairItem(normalizeRepairRow(rows[0]), req), '获取维修单详情成功')
  } catch (error) {
    log.error('获取维修单详情失败:', error)
    return ApiResponse.serverError(res, '获取维修单详情失败', error)
  }
})

router.post('/', unifiedAuth, requirePermission('repairs:create'), rejectHiddenRepairWriteFields, async (req, res) => {
  try {
    const customerId = parsePositiveId(req.body?.customer_id)
    const brandId = req.body?.brand_id ? parsePositiveId(req.body.brand_id) : null
    const colorId = req.body?.color_id ? parsePositiveId(req.body.color_id) : null
    const memoryId = req.body?.memory_id ? parsePositiveId(req.body.memory_id) : null
    const phoneId = req.body?.phone_id ? parsePositiveId(req.body.phone_id) : null
    const phoneModel = String(req.body?.phone_model || '').trim()
    const problem = String(req.body?.problem_description || '').trim()
    if (!customerId || !phoneModel || !problem) return ApiResponse.badRequest(res, '请填写客户、手机型号和故障描述')
    const technicianId = req.body?.technician_id ? parsePositiveId(req.body.technician_id) : null
    if (req.body?.technician_id && !technicianId) return ApiResponse.badRequest(res, '维修员编号无效')
    const repairTime = req.body?.repair_time ? String(req.body.repair_time).trim() : null
    if (repairTime && !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(repairTime)) {
      return ApiResponse.badRequest(res, '维修时间格式不正确')
    }
    const submittedMedia = normalizeRepairMedia(req.body?.photos || [])
    const db = await getDb()
    const [customerRows] = await db.execute('SELECT id FROM customers WHERE id = ? AND status = 1', [customerId])
    if (!customerRows.length) return ApiResponse.badRequest(res, '客户不存在或已停用')
    if (brandId) {
      const [brandRows] = await db.execute('SELECT id FROM brands WHERE id = ?', [brandId])
      if (!brandRows.length) return ApiResponse.badRequest(res, '品牌不存在')
    }
    for (const [_field, value, table, label] of [
      ['color_id', colorId, 'colors', '颜色'],
      ['memory_id', memoryId, 'memories', '内存']
    ]) {
      if (!value) continue
      const [rows] = await db.execute(`SELECT id FROM ${table} WHERE id = ?`, [value])
      if (!rows.length) return ApiResponse.badRequest(res, `${label}不存在`)
    }
    if (phoneId) {
      const [phoneRows] = await db.execute('SELECT id FROM phones WHERE id = ?', [phoneId])
      if (!phoneRows.length) return ApiResponse.badRequest(res, '关联设备不存在')
    }
    if (technicianId) {
      const [technicianRows] = await db.execute('SELECT id FROM users WHERE id = ? AND status = 1', [technicianId])
      if (!technicianRows.length) return ApiResponse.badRequest(res, '维修员不存在或已停用')
    }
    const orderNo = generateOrderNo()
    const [result] = await db.execute(`
      INSERT INTO repairs (order_no, customer_id, phone_id, brand_id, phone_model, imei, serial_number, color_id, memory_id, problem_description, technician_id, remarks, photos, created_at, repair_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), COALESCE(?, NOW()), 'pending')
    `, [orderNo, customerId, phoneId, brandId, phoneModel, String(req.body?.imei || '').trim() || null, String(req.body?.serial_number || '').trim() || null, colorId, memoryId, problem, technicianId, String(req.body?.remarks || '').trim() || null, '[]', repairTime])
    const archivedMedia = await moveRepairTempMedia(submittedMedia, result.insertId, req.user.id)
    if (archivedMedia.length) {
      await db.execute('UPDATE repairs SET photos = ? WHERE id = ?', [JSON.stringify(archivedMedia), result.insertId])
    }
    const [rows] = await db.execute(`${listQuery} WHERE r.id = ?`, [result.insertId])
    return ApiResponse.created(res, await maskRepairItem(normalizeRepairRow(rows[0]), req), '维修单创建成功')
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
    let mediaToRemove = []
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
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'phone_id')) {
      const phoneId = req.body.phone_id ? parsePositiveId(req.body.phone_id) : null
      if (req.body.phone_id && !phoneId) return ApiResponse.badRequest(res, '关联设备编号无效')
      if (phoneId) {
        const [phoneRows] = await db.execute('SELECT id FROM phones WHERE id = ?', [phoneId])
        if (!phoneRows.length) return ApiResponse.badRequest(res, '关联设备不存在')
      }
      updates.push('phone_id = ?')
      params.push(phoneId)
    }
    for (const [field, table, label] of [
      ['color_id', 'colors', '颜色'],
      ['memory_id', 'memories', '内存']
    ]) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, field)) continue
      const value = req.body[field] ? parsePositiveId(req.body[field]) : null
      if (req.body[field] && !value) return ApiResponse.badRequest(res, `${label}编号无效`)
      if (value) {
        const [rows] = await db.execute(`SELECT id FROM ${table} WHERE id = ?`, [value])
        if (!rows.length) return ApiResponse.badRequest(res, `${label}不存在`)
      }
      updates.push(`${field} = ?`)
      params.push(value)
    }
    const fields = {
      phone_model: value => String(value || '').trim(),
      imei: value => String(value || '').trim() || null,
      serial_number: value => String(value || '').trim() || null,
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
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'actual_cost')) {
      const value = parseMoney(req.body.actual_cost)
      if (value === null) return ApiResponse.badRequest(res, '实际费用格式不正确')
      updates.push('actual_cost = ?')
      params.push(value)
    }
    let submittedMedia
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'photos')) {
      submittedMedia = normalizeRepairMedia(req.body.photos)
      const [existingRows] = await db.execute('SELECT photos FROM repairs WHERE id = ?', [id])
      if (!existingRows.length) return ApiResponse.notFound(res, '维修单不存在')
      const existingMedia = normalizeRepairMedia(parseStoredRepairMedia(existingRows[0].photos))
      const archivedMedia = await moveRepairTempMedia(submittedMedia, id, req.user.id)
      updates.push('photos = ?')
      params.push(JSON.stringify(archivedMedia))
      const nextUrls = new Set(archivedMedia.map(item => item.url))
      mediaToRemove = existingMedia.filter(item => !nextUrls.has(item.url))
      submittedMedia = archivedMedia
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'repair_time')) {
      const value = req.body.repair_time ? String(req.body.repair_time).trim() : null
      if (!value || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(value)) {
        return ApiResponse.badRequest(res, '维修时间格式不正确')
      }
      updates.push('repair_time = ?')
      params.push(value)
    }
    if (!updates.length) return ApiResponse.badRequest(res, '没有可更新的字段')
    params.push(id)
    const [result] = await db.execute(`UPDATE repairs SET ${updates.join(', ')} WHERE id = ?`, params)
    if (!result.affectedRows) return ApiResponse.notFound(res, '维修单不存在')
    await removeRepairMediaFiles(mediaToRemove)
    const [rows] = await db.execute(`${listQuery} WHERE r.id = ?`, [id])
    return ApiResponse.success(res, await maskRepairItem(normalizeRepairRow(rows[0]), req), '维修单更新成功')
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
    return ApiResponse.success(res, await maskRepairItem(normalizeRepairRow(rows[0]), req), '维修状态更新成功')
  } catch (error) {
    log.error('更新维修状态失败:', error)
    return ApiResponse.serverError(res, '更新维修状态失败', error)
  }
})

router.delete('/:id', unifiedAuth, requirePermission('repairs:delete'), async (req, res) => {
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
