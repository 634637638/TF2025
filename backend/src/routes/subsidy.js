const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const convert = require('heic-convert')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { verifyToken } = require('../middleware/jwt-blacklist')
const { cacheMiddleware, clearCache } = require('../middleware/cache')
const { CACHE_TTL } = require('../config/constants')
const ApiResponse = require('../utils/response')
const { getDatabase } = require('../config/database')
const log = require('../utils/log')
const dataMaskingService = require('../services/dataMaskingService')
const { getUploadsRoot, getUploadSubdir, getRelativeUploadPathFromUrl } = require('../utils/upload-paths')
const XLSX = require('xlsx')

const maskSubsidyItem = (item, req) => (
  dataMaskingService.maskDataItem(item, req.user.id, 'subsidy_subsidyview')
)
const maskSubsidyList = (items, req) => (
  dataMaskingService.maskDataList(items, req.user.id, 'subsidy_subsidyview')
)
const getSubsidyHiddenFields = async (req) => {
  const fieldPermissions = await dataMaskingService.getUserFieldPermissions(
    req.user.id,
    'subsidy_subsidyview'
  )
  return new Set(fieldPermissions.hiddenFields || [])
}

const requirePermissionWhen = (permission, predicate) => {
  const guard = requirePermission(permission)
  return (req, res, next) => predicate(req.body || {}) ? guard(req, res, next) : next()
}

const requireSubsidyUploadWhenPhotosPresent = requirePermissionWhen(
  'subsidy:upload',
  body => Array.isArray(body.subsidy_photos) && body.subsidy_photos.length > 0
)
const requireSubsidyApprovalWhenChangingApplyTime = requirePermissionWhen(
  'subsidy:approve',
  body => body.apply_time !== undefined || body.has_audit !== undefined
)
const requireSubsidyArrivalWhenChangingArrivalTime = requirePermissionWhen(
  'subsidy:arrival',
  body => body.arrival_time !== undefined || body.has_arrival !== undefined
)

const requireSubsidyUpload = requirePermission('subsidy:upload')
const requireVisibleSubsidyPhotosOrUpload = async (req, res, next) => {
  const hiddenFields = await getSubsidyHiddenFields(req)
  return hiddenFields.has('subsidy_info.subsidy_photos')
    ? requireSubsidyUpload(req, res, next)
    : next()
}

const SUBSIDY_WRITE_FIELD_IDS = {
  customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone',
  customer_idcard: 'customer_info.customer_idcard',
  phone_brand: 'device_info.brand',
  phone_model: 'device_info.model',
  phone_color: 'device_info.color',
  phone_memory: 'device_info.memory',
  serial_number: 'device_info.serial_number',
  imei1: 'device_info.imei1',
  imei2: 'device_info.imei2',
  sale_price: 'price_info.sale_price',
  sale_time: 'time_info.sale_time',
  store_id: 'store_info.store_name',
  remarks: 'other_info.remarks',
  has_different_handler: 'handler_info.has_different_handler',
  handler_name: 'handler_info.handler_name',
  handler_phone: 'handler_info.handler_phone',
  handler_idcard: 'handler_info.handler_idcard'
}

const rejectHiddenSubsidyWriteFields = async (req, res, next) => {
  const hiddenFields = await getSubsidyHiddenFields(req)
  const deniedEntry = Object.entries(SUBSIDY_WRITE_FIELD_IDS).find(([bodyField, fieldId]) => (
    req.body?.[bodyField] !== undefined && hiddenFields.has(fieldId)
  ))

  if (!deniedEntry) {
    return next()
  }

  return res.status(403).json({
    success: false,
    message: '不能修改已隐藏的字段',
    code: 'FIELD_PERMISSION_DENIED',
    field: deniedEntry[1]
  })
}

const createRouteTimer = (routeName, req) => {
  const routeStart = process.hrtime.bigint()
  let lastMark = routeStart

  const mark = (label, extra = {}) => {
    const now = process.hrtime.bigint()
    const stepMs = Number(now - lastMark) / 1e6
    const totalMs = Number(now - routeStart) / 1e6
    lastMark = now

    log.info(`⏱️ [${routeName}] ${label}`, {
      stepMs: stepMs.toFixed(2),
      totalMs: totalMs.toFixed(2),
      method: req.method,
      path: req.originalUrl,
      ...extra
    })
  }

  return { mark }
}

const SUBSIDY_UPLOAD_PREFIX = 'subsidy/'

const normalizeSubsidyPhotoPath = (photoUrl) => {
  const relativePath = getRelativeUploadPathFromUrl(photoUrl)
  if (!relativePath || !relativePath.startsWith(SUBSIDY_UPLOAD_PREFIX)) {
    return ''
  }

  const normalizedRelativePath = path.posix.normalize(relativePath)
  if (
    normalizedRelativePath.startsWith('../') ||
    normalizedRelativePath.includes('/../') ||
    normalizedRelativePath === '..'
  ) {
    return ''
  }

  return normalizedRelativePath
}

const buildProtectedSubsidyPhotoUrl = (photoUrl) => {
  const normalizedRelativePath = normalizeSubsidyPhotoPath(photoUrl)
  if (!normalizedRelativePath) {
    return photoUrl
  }

  const encodedPath = normalizedRelativePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')

  return `/api/subsidy/files/${encodedPath}`
}

const mapSubsidyPhotoUrls = (photos = []) => (
  Array.isArray(photos)
    ? photos.map(photo => buildProtectedSubsidyPhotoUrl(photo))
    : []
)

const authenticateSubsidyFileAccess = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    const rawQueryToken = Array.isArray(req.query.token)
      ? req.query.token[req.query.token.length - 1]
      : req.query.token
    const queryToken = typeof rawQueryToken === 'string' ? rawQueryToken.trim() : ''
    const token = bearerToken || queryToken

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '缺少访问令牌',
        code: 'TOKEN_MISSING'
      })
    }

    const decoded = await verifyToken(token, 'access')
    if (!decoded || decoded.sub === undefined || decoded.sub === null) {
      return res.status(401).json({
        success: false,
        message: '无效的访问令牌',
        code: 'INVALID_TOKEN'
      })
    }

    req.user = {
      id: decoded.sub || decoded.id,
      username: decoded.username,
      name: decoded.name
    }

    return next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '访问令牌无效或已过期',
      code: 'TOKEN_INVALID'
    })
  }
}

// ============================
// 图片上传配置
// ============================

// 确保上传目录存在
const uploadDir = getUploadSubdir('subsidy')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // 临时文件名：使用时间戳，后续会在处理时重命名
    const timestamp = Date.now()
    const randomSuffix = crypto.randomBytes(6).toString('hex')
    const ext = path.extname(file.originalname)
    const filename = `temp_${timestamp}_${randomSuffix}${ext}`
    cb(null, filename)
  }
})

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif|pdf/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const isImage = /jpeg|jpg|png|gif|webp|heic|heif/.test(file.mimetype) ||
                   file.mimetype === 'image/heic' ||
                   file.mimetype === 'image/heif'
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf'

  if ((isImage || isPdf) && extname) {
    return cb(null, true)
  }
  cb(new Error('只允许上传图片文件（JPEG, JPG, PNG, GIF, WEBP, HEIC）或PDF文件'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

const buildSubsidyFilters = (query) => {
  const {
    status,
    customer_phone,
    customer_name,
    customer_idcard,
    imei1,
    imei2,
    serial_number,
    start_date,
    end_date,
    store_id,
    brand,
    model,
    color,
    memory,
    min_price,
    max_price,
    min_subsidy,
    max_subsidy,
    has_handler,
    apply_start_date,
    apply_end_date,
    arrival_start_date,
    arrival_end_date
  } = query

  const whereConditions = ['1=1']
  const queryParams = []

  // 状态筛选
  if (status) {
    if (status === 'completed') {
      // 已审批（前端现有语义更接近“已提交申请”）
      whereConditions.push('apply_time IS NOT NULL')
    } else if (status === 'approved') {
      // 已到账
      whereConditions.push('arrival_time IS NOT NULL')
    } else if (status === 'unarrived') {
      // 未到账：已经提交申请，但补贴尚未到账
      whereConditions.push('apply_time IS NOT NULL')
      whereConditions.push('arrival_time IS NULL')
    } else if (status === 'pending') {
      // 未审批（当前业务实际期望：尚未提交申请）
      whereConditions.push('apply_time IS NULL')
    } else {
      whereConditions.push('apply_status = ?')
      queryParams.push(status)
    }
  }

  // 搜索关键词处理 - 使用 OR 连接所有搜索字段
  const searchFields = []
  const searchParams = []

  // 判断是否是搜索框搜索（如果有多个搜索参数同时存在，说明是来自搜索框）
  const hasKeywordFields = !!(customer_phone || customer_name || customer_idcard || imei1 || imei2 || serial_number)
  const hasFilterFields = !!(brand || model || color || memory)
  const isSearchBoxSearch = hasKeywordFields && hasFilterFields

  if (customer_phone) {
    searchFields.push('customer_phone LIKE ?')
    searchParams.push(`%${customer_phone}%`)
  }
  if (customer_name) {
    searchFields.push('customer_name LIKE ?')
    searchParams.push(`%${customer_name}%`)
  }
  if (customer_idcard) {
    searchFields.push('customer_idcard LIKE ?')
    searchParams.push(`%${customer_idcard}%`)
  }
  if (imei1) {
    searchFields.push('imei1 LIKE ?')
    searchParams.push(`%${imei1}%`)
  }
  if (imei2) {
    searchFields.push('imei2 LIKE ?')
    searchParams.push(`%${imei2}%`)
  }
  if (serial_number) {
    searchFields.push('serial_number LIKE ?')
    searchParams.push(`%${serial_number}%`)
  }

  // 如果是搜索框搜索，brand/model/color/memory 也加入 OR 搜索
  if (isSearchBoxSearch) {
    if (brand) {
      searchFields.push('phone_brand LIKE ?')
      searchParams.push(`%${brand}%`)
    }
    if (model) {
      searchFields.push('phone_model LIKE ?')
      searchParams.push(`%${model}%`)
    }
    if (color) {
      searchFields.push('phone_color LIKE ?')
      searchParams.push(`%${color}%`)
    }
    if (memory) {
      searchFields.push('phone_memory LIKE ?')
      searchParams.push(`%${memory}%`)
    }
  }

  // 如果有搜索字段，用 OR 连接
  if (searchFields.length > 0) {
    whereConditions.push(`(${searchFields.join(' OR ')})`)
    queryParams.push(...searchParams)
  }

  // 单独的筛选条件（这些用 AND）- 仅当不是搜索框搜索时才使用
  if (!isSearchBoxSearch) {
    // 品牌、型号、颜色、内存保持精确筛选（下拉框使用）
    if (brand) {
      whereConditions.push('phone_brand LIKE ?')
      queryParams.push(`%${brand}%`)
    }

    if (model) {
      whereConditions.push('phone_model LIKE ?')
      queryParams.push(`%${model}%`)
    }

    if (color) {
      whereConditions.push('phone_color LIKE ?')
      queryParams.push(`%${color}%`)
    }

    if (memory) {
      whereConditions.push('phone_memory LIKE ?')
      queryParams.push(`%${memory}%`)
    }
  }

  // 销售日期范围筛选
  if (start_date) {
    whereConditions.push('sale_time >= ?')
    queryParams.push(start_date)
  }

  if (end_date) {
    whereConditions.push('sale_time < DATE_ADD(?, INTERVAL 1 DAY)')
    queryParams.push(end_date)
  }

  // 店铺筛选
  if (store_id) {
    whereConditions.push('store_id = ?')
    queryParams.push(store_id)
  }

  // 销售价格范围筛选
  if (min_price) {
    whereConditions.push('sale_price >= ?')
    queryParams.push(parseFloat(min_price))
  }

  if (max_price) {
    whereConditions.push('sale_price <= ?')
    queryParams.push(parseFloat(max_price))
  }

  // 补贴金额范围筛选
  if (min_subsidy) {
    whereConditions.push('subsidy_amount >= ?')
    queryParams.push(parseFloat(min_subsidy))
  }

  if (max_subsidy) {
    whereConditions.push('subsidy_amount <= ?')
    queryParams.push(parseFloat(max_subsidy))
  }

  // 是否有实际办理人筛选
  if (has_handler === '1') {
    whereConditions.push('has_different_handler = 1')
  } else if (has_handler === '0') {
    whereConditions.push('has_different_handler = 0')
  }

  // 提交时间范围筛选
  if (apply_start_date) {
    whereConditions.push('apply_time >= ?')
    queryParams.push(apply_start_date)
  }

  if (apply_end_date) {
    whereConditions.push('apply_time < DATE_ADD(?, INTERVAL 1 DAY)')
    queryParams.push(apply_end_date)
  }

  // 到账时间范围筛选
  if (arrival_start_date) {
    whereConditions.push('arrival_time >= ?')
    queryParams.push(arrival_start_date)
  }

  if (arrival_end_date) {
    whereConditions.push('arrival_time < DATE_ADD(?, INTERVAL 1 DAY)')
    queryParams.push(arrival_end_date)
  }

  return { whereConditions, queryParams }
}

const getSubsidyStatusLabel = (item) => {
  if (item.arrival_time) {
    return '已到账'
  }

  if (item.apply_time) {
    return '已提交'
  }

  return '未提交'
}

const buildSubsidyExportFile = (items = [], hiddenFields = new Set()) => {
  const exportColumns = [
    ['customer_info.customer_name', '客户姓名', item => item.customer_name || ''],
    ['customer_info.customer_phone', '客户电话', item => item.customer_phone || ''],
    ['customer_info.customer_idcard', '客户身份证', item => item.customer_idcard || ''],
    ['device_info.brand', '品牌', item => item.phone_brand || ''],
    ['device_info.model', '型号', item => item.phone_model || ''],
    ['device_info.color', '颜色', item => item.phone_color || ''],
    ['device_info.memory', '内存', item => item.phone_memory || ''],
    ['device_info.serial_number', '序列号', item => item.serial_number || ''],
    ['device_info.imei1', 'IMEI1', item => item.imei1 || ''],
    ['device_info.imei2', 'IMEI2', item => item.imei2 || ''],
    ['price_info.sale_price', '销售价', item => item.sale_price === null || item.sale_price === undefined ? '' : parseFloat(item.sale_price)],
    ['time_info.sale_time', '销售时间', item => item.sale_time || ''],
    ['store_info.store_name', '店铺', item => item.store_name || ''],
    ['sales_info.salesman_name', '销售员', item => item.salesman_name || ''],
    ['price_info.subsidy_amount', '补贴金额', item => item.subsidy_amount === null || item.subsidy_amount === undefined ? '' : parseFloat(item.subsidy_amount)],
    ['price_info.subsidy_rate', '补贴比例', item => item.subsidy_rate === null || item.subsidy_rate === undefined ? '' : `${parseFloat(item.subsidy_rate) || 0}%`],
    ['status_info.status', '当前状态', item => getSubsidyStatusLabel(item)],
    ['status_info.status', '申请状态', item => item.apply_status || ''],
    ['time_info.apply_time', '提交时间', item => item.apply_time || ''],
    ['time_info.arrival_time', '到账时间', item => item.arrival_time || ''],
    ['handler_info.has_different_handler', '代办理', item => item.has_different_handler ? '是' : '否'],
    ['handler_info.handler_name', '办理人姓名', item => item.handler_name || ''],
    ['handler_info.handler_phone', '办理人电话', item => item.handler_phone || ''],
    ['handler_info.handler_idcard', '办理人身份证', item => item.handler_idcard || ''],
    ['subsidy_info.subsidy_photos', '照片数量', item => {
      let subsidyPhotos = []
      if (item.subsidy_photos) {
        try {
          subsidyPhotos = typeof item.subsidy_photos === 'string'
            ? JSON.parse(item.subsidy_photos)
            : item.subsidy_photos
        } catch (_error) {
          subsidyPhotos = []
        }
      }
      return Array.isArray(subsidyPhotos) ? subsidyPhotos.length : 0
    }],
    ['other_info.remarks', '备注', item => item.remarks || '']
  ]
  const visibleColumns = exportColumns.filter(([fieldId]) => !hiddenFields.has(fieldId))
  const rows = items.map(item => {
    return Object.fromEntries(visibleColumns.map(([, label, getValue]) => [label, getValue(item)]))
  })

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: visibleColumns.map(([, label]) => label)
  })
  const workbook = XLSX.utils.book_new()
  const beijingDate = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '-')

  XLSX.utils.book_append_sheet(workbook, worksheet, '国补管理')

  return {
    filename: `国补管理_${beijingDate}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    total: rows.length
  }
}

// 第一步：通过IMEI或序列号搜索设备列表
router.get('/search-phones/:identifier', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  const timer = createRouteTimer('GET /subsidy/search-phones/:identifier', req)
  try {
    const { identifier } = req.params
    if (!identifier || identifier.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '请输入IMEI或序列号'
      })
    }

    const trimmedIdentifier = identifier.trim()
    const searchPattern = `%${trimmedIdentifier}%`
    timer.mark('search params prepared', {
      keywordLength: trimmedIdentifier.length
    })

    // 先只查询匹配的设备基础信息，避免直接关联 sales 表造成放大扫描和重复行
    const [phones] = await getDatabase().execute(`
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.is_new,
        p.status,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        p.sale_price,
        p.sale_time as sale_time,
        st.name as store_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE p.status = 'sold'
        AND (p.imei LIKE ? OR p.serial_number LIKE ?)
      ORDER BY p.sale_time DESC
      LIMIT 50
    `, [searchPattern, searchPattern])
    timer.mark('phones query completed', {
      matchCount: phones.length
    })

    if (phones.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到匹配的设备'
      })
    }

    const phoneIds = phones.map(p => p.phone_id)
    const [latestSales, subsidyRecords] = await Promise.all([
      getDatabase().execute(`
        SELECT
          latest.phone_id,
          c.name as customer_name,
          c.phone as customer_phone
        FROM (
          SELECT s.phone_id, s.customer_id
          FROM sales s
          INNER JOIN (
            SELECT phone_id, MAX(created_at) as max_created_at
            FROM sales
            WHERE phone_id IN (${phoneIds.map(() => '?').join(',')})
            GROUP BY phone_id
          ) latest_sale
            ON latest_sale.phone_id = s.phone_id
           AND latest_sale.max_created_at = s.created_at
        ) latest
        LEFT JOIN customers c ON c.id = latest.customer_id
      `, phoneIds).then(([rows]) => rows),
      getDatabase().execute(`
      SELECT phone_id, apply_status, subsidy_amount
      FROM national_subsidies
      WHERE phone_id IN (${phoneIds.map(() => '?').join(',')})
      `, phoneIds).then(([rows]) => rows)
    ])
    timer.mark('related data queries completed', {
      latestSalesCount: latestSales.length,
      subsidyRecordCount: subsidyRecords.length
    })

    const customerMap = new Map()
    latestSales.forEach((sale) => {
      customerMap.set(sale.phone_id, {
        customer_name: sale.customer_name || '',
        customer_phone: sale.customer_phone || ''
      })
    })

    // 创建国补记录映射
    const subsidyMap = new Map()
    subsidyRecords.forEach(s => {
      subsidyMap.set(s.phone_id, {
        has_subsidy: true,
        status: s.apply_status,
        amount: s.subsidy_amount
      })
    })

    // 格式化返回结果
    const deviceList = phones.map(p => {
      const subsidyInfo = subsidyMap.get(p.phone_id)
      const customerInfo = customerMap.get(p.phone_id) || {}
      return {
        phone_id: p.phone_id,
        imei: p.imei,
        serial_number: p.serial_number,
        is_new: p.is_new,
        status: p.status,
        brand: p.brand || '',
        model: p.model || '',
        color: p.color || '',
        memory: p.memory || '',
        sale_price: parseFloat(p.sale_price) || 0,
        sale_time: p.sale_time,
        store_name: p.store_name || '',
        customer_name: customerInfo.customer_name || '',
        customer_phone: customerInfo.customer_phone || '',
        // 国补记录状态
        has_subsidy: !!subsidyInfo,
        subsidy_status: subsidyInfo?.status || null,
        subsidy_amount: subsidyInfo?.amount || 0,
        // 判断是否符合国补条件
        can_apply_subsidy: p.is_new === 1 && p.sale_price <= 6000 && !subsidyInfo,
        reason: subsidyInfo ? '已记录国补资料' :
          p.is_new !== 1 ? '仅全新机可申请' :
            p.sale_price > 6000 ? '售价超过6000元' : '符合条件'
      }
    })

    res.json({
      success: true,
      message: `找到 ${deviceList.length} 个匹配设备`,
      data: deviceList
    })
    timer.mark('response sent', {
      resultCount: deviceList.length
    })

  } catch (error) {
    timer.mark('request failed', {
      error: error.message
    })
    log.error('❌ 搜索设备失败:', error)
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: error.message
    })
  }
})

// 第二步：获取选定设备的完整销售信息（包括客户信息）
router.get('/phone-detail/:phoneId', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  try {
    const { phoneId } = req.params
    if (!phoneId || isNaN(phoneId)) {
      return res.status(400).json({
        success: false,
        message: '设备ID无效'
      })
    }

    // 获取设备详细信息
    // 🔥 使用 DATE_FORMAT 直接返回格式化的日期字符串，避免时区转换问题
    // 🔥 优先从 phones 表的 sale_time 获取销售时间，然后格式化
    const [phones] = await getDatabase().execute(`
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.is_new,
        p.sale_price,
        DATE_FORMAT(COALESCE(p.sale_time, latest_sale.sale_time), '%Y-%m-%d') as sale_time,
        p.sale_operator_id,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        latest_sale.store_id as store_id,
        sale_st.name as store_name,
        u.name as salesman_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN users u ON p.sale_operator_id = u.id
      LEFT JOIN (
        SELECT
          s.*,
          ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
        FROM sales s
      ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
      LEFT JOIN stores sale_st ON latest_sale.store_id = sale_st.id
      WHERE p.id = ?
        AND p.status = 'sold'
      LIMIT 1
    `, [phoneId])

    if (phones.length === 0) {
      return res.status(404).json({
        success: false,
        message: '仅已销售设备可申请国补'
      })
    }

    const phone = phones[0]

    // 查找客户信息（从sales表中查找）
    const [sales] = await getDatabase().execute(`
      SELECT
        s.id as sale_id,
        s.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.id_card as customer_idcard
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.phone_id = ?
      LIMIT 1
    `, [phoneId])

    // 如果没有销售记录，返回提示信息
    if (sales.length === 0) {
      const unavailablePhone = {
        phone_id: phone.phone_id,
        phone_brand: phone.brand,
        phone_model: phone.model,
        phone_color: phone.color,
        phone_memory: phone.memory,
        serial_number: phone.serial_number,
        imei1: phone.imei,
        imei2: null,
        sale_price: parseFloat(phone.sale_price) || 0,
        eligible: false,
        eligible_reason: '该设备未找到销售记录，请先完成销售后再申请国补',
        requires_sale: true
      }
      return res.json({
        success: true,
        message: '设备未销售，无法申请国补',
        data: unavailablePhone
      })
    }

    const sale = sales[0]

    // 检查是否已经存在国补记录
    const [existingSubsidies] = await getDatabase().execute(`
      SELECT id, apply_status, subsidy_amount
      FROM national_subsidies
      WHERE phone_id = ?
    `, [phoneId])

    // 计算国补金额（售价6000以内可参加，优惠15%，最高500）
    let subsidyAmount = 0
    const subsidyRate = 15
    const maxSubsidy = 500
    let eligible_reason = ''

    if (phone.sale_price && phone.sale_price <= 6000) {
      const calculated = parseFloat(phone.sale_price) * (subsidyRate / 100)
      subsidyAmount = Math.min(calculated, maxSubsidy)
      if (calculated > maxSubsidy) {
        eligible_reason = `补贴金额 ¥${calculated.toFixed(2)} 已达上限 ¥${maxSubsidy}`
      } else {
        eligible_reason = `符合国补条件（售价 ${parseFloat(phone.sale_price).toFixed(2)} × 15% = ¥${subsidyAmount.toFixed(2)}）`
      }
    } else {
      eligible_reason = `销售价格 ¥${parseFloat(phone.sale_price || 0).toFixed(2)} 超过6000元，不符合国补条件`
    }

    const phoneDetail = {
      phone_id: phone.phone_id,
      sale_id: sale.sale_id,
      customer_id: sale.customer_id,
      customer_name: sale.customer_name || '',
      customer_phone: sale.customer_phone || '',
      customer_idcard: sale.customer_idcard || '',
      phone_brand: phone.brand,
      phone_model: phone.model,
      phone_color: phone.color,
      phone_memory: phone.memory,
      serial_number: phone.serial_number,
      imei1: phone.imei,
      imei2: null,
      sale_price: parseFloat(phone.sale_price) || 0,
      sale_time: phone.sale_time,
      store_id: phone.store_id,
      store_name: phone.store_name,
      salesman_id: phone.sale_operator_id,
      salesman_name: phone.salesman_name,
      subsidy_amount: subsidyAmount,
      subsidy_rate: subsidyRate,
      eligible: subsidyAmount > 0,
      eligible_reason,
      existing_subsidy: existingSubsidies.length > 0 ? existingSubsidies[0] : null
    }
    res.json({
      success: true,
      message: '获取详情成功',
      data: phoneDetail
    })

  } catch (error) {
    log.error('❌ 获取设备详情失败:', error)
    res.status(500).json({
      success: false,
      message: '获取详情失败',
      error: error.message
    })
  }
})

// 创建国补申请
router.post(
  '/apply',
  unifiedAuth,
  requirePermission('subsidy:create'),
  requireSubsidyUploadWhenPhotosPresent,
  async (req, res) => {
    try {
      const {
        phone_id,
        sale_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        sale_time,
        store_id,
        store_name,
        salesman_id,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_info
      } = req.body

      // 验证必填字段（IMEI2改为必填）
      if (!phone_id || !customer_id || !imei1 || !imei2 || !sale_price) {
        return res.status(400).json({
          success: false,
          message: 'IMEI2为必填项，请完整填写'
        })
      }

      // 检查是否已存在国补记录
      const [existing] = await getDatabase().execute(
        'SELECT id, apply_status FROM national_subsidies WHERE phone_id = ?',
        [phone_id]
      )

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: '该设备已存在国补申请记录',
          data: {
            existing_id: existing[0].id,
            apply_status: existing[0].apply_status
          }
        })
      }

      // 允许所有设备创建记录，但超过6000元的补贴金额为0
      const finalSubsidyAmount = subsidy_amount || 0

      // 如果提供了新的身份证号，更新到 customers 表（完善客户信息）
      if (customer_idcard && customer_idcard.trim() !== '') {
        await getDatabase().execute(`
        UPDATE customers
        SET id_card = ?
        WHERE id = ?
      `, [customer_idcard.trim(), customer_id])
      }

      // 处理 sale_time：直接提取日期部分，避免时区转换问题
      let processedSaleTime = null
      if (sale_time) {
      // 数据库返回的格式通常是 "YYYY-MM-DD HH:mm:ss" 或 "YYYY-MM-DDTHH:mm:ss.xxxZ"
      // 我们只需要日期部分，直接提取即可，不使用 new Date() 避免时区问题
        const dateMatch = String(sale_time).match(/(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          const [, year, month, day] = dateMatch
          processedSaleTime = `${year}-${month}-${day} 00:00:00`
        } else {
        // 如果无法直接提取，保留原值（一般不会走到这里）
          log.warn('⚠️ 无法直接提取日期，保留原值:', sale_time)
          processedSaleTime = sale_time
        }
      }

      // 创建国补记录（同时存储 customer_idcard 和实际办理人信息到 national_subsidies 表）
      const [result] = await getDatabase().execute(`
      INSERT INTO national_subsidies (
        sale_id,
        phone_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        sale_time,
        store_id,
        store_name,
        salesman_id,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        apply_time,
        apply_status,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, ?, ?, ?, ?, ?)
    `, [
        sale_id,
        phone_id,
        customer_id,
        customer_name,
        customer_phone,
        customer_idcard || null,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2 || null,
        sale_price,
        processedSaleTime,
        store_id || null,
        store_name || null,
        salesman_id || null,
        salesman_name || null,
        finalSubsidyAmount,
        subsidy_rate || 15,
        remarks || null,
        JSON.stringify(subsidy_photos || []),
        has_different_handler || false,
        (has_different_handler && handler_info) ? handler_info.handler_name : null,
        (has_different_handler && handler_info) ? handler_info.handler_phone : null,
        (has_different_handler && handler_info) ? handler_info.handler_idcard : null
      ])

      clearCache('/subsidy')
      res.json({
        success: true,
        message: '国补记录创建成功',
        data: {
          id: result.insertId,
          apply_time: new Date(),
          apply_status: 'completed'
        }
      })

    } catch (error) {
      log.error('❌ 创建国补申请失败:', error)
      res.status(500).json({
        success: false,
        message: '创建国补申请失败',
        error: error.message
      })
    }
  })

// 获取国补列表（带缓存，仅缓存第一页）
router.get('/', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  const timer = createRouteTimer('GET /subsidy', req)
  try {
    const { sort_by = 'sale_time', sort_order = 'desc' } = req.query
    const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1)
    const page_size = Math.min(500, Math.max(1, Number.parseInt(String(req.query.page_size || 20), 10) || 20))

    log.info('🔍 国补列表查询参数:', { page, page_size: page_size, sort_by, sort_order, filters: req.query })

    const { whereConditions, queryParams } = buildSubsidyFilters(req.query)
    timer.mark('filters built', {
      page: Number(page),
      page_size: page_size,
      filterCount: whereConditions.length,
      queryParamCount: queryParams.length
    })

    log.info('📊 构建的WHERE条件:', whereConditions.join(' AND '))
    log.info('📊 查询参数数量:', queryParams.length)

    // 验证并构建排序字段
    const validSortFields = ['sale_time', 'apply_time', 'arrival_time', 'sale_price', 'subsidy_amount', 'created_at']
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'sale_time'

    // 验证排序方向（只能是 asc 或 desc）
    const sortDirection = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    const orderClause = `ORDER BY ${sortField} ${sortDirection}`

    const limitNum = page_size // 最大500条
    const offsetNum = (page - 1) * limitNum

    // 查询列表
    const query = `
      SELECT
        id,
        sale_id,
        phone_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time,
        store_id,
        store_name,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        DATE_FORMAT(apply_time, '%Y-%m-%d') as apply_time,
        apply_status,
        DATE_FORMAT(arrival_time, '%Y-%m-%d') as arrival_time,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      FROM national_subsidies
      WHERE ${whereConditions.join(' AND ')}
      ${orderClause}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM national_subsidies
      WHERE ${whereConditions.join(' AND ')}
    `

    let listQueryMs = 0
    let countQueryMs = 0

    const [[subsidies], [countResult]] = await Promise.all([
      (async () => {
        const startedAt = process.hrtime.bigint()
        const result = await getDatabase().execute(query, queryParams)
        listQueryMs = Number(process.hrtime.bigint() - startedAt) / 1e6
        return result
      })(),
      (async () => {
        const startedAt = process.hrtime.bigint()
        const result = await getDatabase().execute(countQuery, queryParams)
        countQueryMs = Number(process.hrtime.bigint() - startedAt) / 1e6
        return result
      })()
    ])
    timer.mark('database queries completed', {
      listQueryMs: listQueryMs.toFixed(2),
      countQueryMs: countQueryMs.toFixed(2),
      rowCount: subsidies.length
    })

    log.info('✅ 国补列表查询完成:', {
      返回记录数: subsidies.length,
      总记录数: countResult[0].total,
      当前页: page,
      每页数量: page_size
    })

    // 格式化数据
    const formattedSubsidies = subsidies.map(sub => {
      // 处理 BOOLEAN 字段（MySQL 返回的是数字 0/1）
      const hasHandler = sub.has_different_handler === 1 || sub.has_different_handler === true

      // 解析 JSON 字段
      let subsidyPhotos = []
      if (sub.subsidy_photos) {
        try {
          subsidyPhotos = typeof sub.subsidy_photos === 'string'
            ? JSON.parse(sub.subsidy_photos)
            : sub.subsidy_photos
        } catch (e) {
          log.error('解析 subsidy_photos 失败:', e)
          subsidyPhotos = []
        }
      }

      return {
        ...sub,
        sale_price: parseFloat(sub.sale_price),
        subsidy_amount: parseFloat(sub.subsidy_amount),
        subsidy_rate: parseFloat(sub.subsidy_rate),
        subsidy_photos: mapSubsidyPhotoUrls(subsidyPhotos),
        // 添加实际办理人信息对象
        has_different_handler: hasHandler,
        handler_info: hasHandler ? {
          handler_name: sub.handler_name,
          handler_phone: sub.handler_phone,
          handler_idcard: sub.handler_idcard
        } : null
      }
    })
    timer.mark('response formatted', {
      formattedCount: formattedSubsidies.length
    })

    const visibleSubsidies = await maskSubsidyList(formattedSubsidies, req)
    const total = Number(countResult[0].total)
    const total_pages = Math.ceil(total / limitNum)
    res.json({
      success: true,
      message: '获取国补列表成功',
      data: visibleSubsidies,
      pagination: {
        page,
        page_size: limitNum,
        total,
        total_pages,
        has_next: page < total_pages,
        has_prev: page > 1
      }
    })
    timer.mark('response sent')

  } catch (error) {
    timer.mark('failed', {
      error: error.message
    })
    log.error('❌ 获取国补列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取国补列表失败',
      error: error.message
    })
  }
})

// 获取筛选选项（品牌、型号、颜色、内存、店铺）
// 注意：此路由必须在 /:id 之前，否则 filter-options 会被当作 id 参数处理
router.get('/filter-options', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.LONG }), async (req, res) => {
  try {
    const hiddenFields = await getSubsidyHiddenFields(req)
    // 获取品牌列表
    const [brands] = await getDatabase().execute(`
      SELECT DISTINCT phone_brand
      FROM national_subsidies
      WHERE phone_brand IS NOT NULL
      ORDER BY phone_brand
    `)

    // 获取型号列表
    const [models] = await getDatabase().execute(`
      SELECT DISTINCT phone_model
      FROM national_subsidies
      WHERE phone_model IS NOT NULL
      ORDER BY phone_model
    `)

    // 获取颜色列表
    const [colors] = await getDatabase().execute(`
      SELECT DISTINCT phone_color
      FROM national_subsidies
      WHERE phone_color IS NOT NULL
      ORDER BY phone_color
    `)

    // 获取内存列表
    const [memories] = await getDatabase().execute(`
      SELECT DISTINCT phone_memory
      FROM national_subsidies
      WHERE phone_memory IS NOT NULL
      ORDER BY phone_memory
    `)

    // 获取店铺列表
    const [stores] = await getDatabase().execute(`
      SELECT DISTINCT store_id, store_name
      FROM national_subsidies
      WHERE store_id IS NOT NULL AND store_name IS NOT NULL
      ORDER BY store_name
    `)

    res.json({
      success: true,
      message: '获取筛选选项成功',
      data: {
        ...(!hiddenFields.has('device_info.brand') && { brands: brands.map(b => b.phone_brand) }),
        ...(!hiddenFields.has('device_info.model') && { models: models.map(m => m.phone_model) }),
        ...(!hiddenFields.has('device_info.color') && { colors: colors.map(c => c.phone_color) }),
        ...(!hiddenFields.has('device_info.memory') && { memories: memories.map(m => m.phone_memory) }),
        ...(!hiddenFields.has('store_info.store_name') && {
          stores: stores.map(s => ({ id: s.store_id, name: s.store_name }))
        })
      }
    })

  } catch (error) {
    log.error('❌ 获取筛选选项失败:', error)
    res.status(500).json({
      success: false,
      message: '获取筛选选项失败',
      error: error.message
    })
  }
})

router.get('/export/excel', unifiedAuth, requirePermission('subsidy:export'), async (req, res) => {
  try {
    const {
      sort_by = 'sale_time',
      sort_order = 'desc'
    } = req.query

    const { whereConditions, queryParams } = buildSubsidyFilters(req.query)
    const validSortFields = ['sale_time', 'apply_time', 'arrival_time', 'sale_price', 'subsidy_amount', 'created_at']
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'sale_time'
    const sortDirection = sort_order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const orderClause = `ORDER BY ${sortField} ${sortDirection}`

    const query = `
      SELECT
        id,
        sale_id,
        phone_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time,
        store_id,
        store_name,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        DATE_FORMAT(apply_time, '%Y-%m-%d') as apply_time,
        apply_status,
        DATE_FORMAT(arrival_time, '%Y-%m-%d') as arrival_time,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      FROM national_subsidies
      WHERE ${whereConditions.join(' AND ')}
      ${orderClause}
    `

    const [subsidies] = await getDatabase().execute(query, queryParams)
    const hiddenFields = await getSubsidyHiddenFields(req)
    const exportFile = buildSubsidyExportFile(subsidies.map(item => ({
      ...item,
      has_different_handler: item.has_different_handler === 1 || item.has_different_handler === true
    })), hiddenFields)

    res.setHeader('Content-Type', exportFile.mimeType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(exportFile.filename)}`
    )
    res.setHeader('X-Export-Total', String(exportFile.total))

    return res.send(exportFile.buffer)
  } catch (error) {
    log.error('❌ 导出国补数据失败:', error)
    res.status(500).json({
      success: false,
      message: '导出国补数据失败',
      error: error.message
    })
  }
})

router.get('/:id/photos', unifiedAuth, requireSubsidyUpload, async (req, res) => {
  try {
    const [records] = await getDatabase().execute(
      'SELECT subsidy_photos FROM national_subsidies WHERE id = ?',
      [req.params.id]
    )

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '国补记录不存在' })
    }

    let photos = []
    if (records[0].subsidy_photos) {
      try {
        photos = typeof records[0].subsidy_photos === 'string'
          ? JSON.parse(records[0].subsidy_photos)
          : records[0].subsidy_photos
      } catch (error) {
        log.warn('国补照片数据格式异常', { id: req.params.id, error: error.message })
      }
    }

    return res.json({
      success: true,
      data: { subsidy_photos: mapSubsidyPhotoUrls(photos) }
    })
  } catch (error) {
    log.error('读取国补照片失败:', error)
    return res.status(500).json({ success: false, message: '读取国补照片失败', error: error.message })
  }
})

// 获取国补详情
router.get('/:id', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  try {
    const { id } = req.params

    // 🔥 使用 DATE_FORMAT 直接返回格式化的日期字符串，避免时区转换问题
    const [subsidies] = await getDatabase().execute(`
      SELECT
        id,
        customer_id,
        phone_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        salesman_name,
        imei1,
        imei2,
        serial_number,
        sale_price,
        subsidy_photos,
        subsidy_amount,
        subsidy_rate,
        store_id,
        store_name,
        apply_time,
        apply_status,
        arrival_time,
        remarks,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time_formatted
      FROM national_subsidies
      WHERE id = ?
    `, [id])

    if (subsidies.length === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      })
    }

    const subsidy = subsidies[0]
    subsidy.sale_price = parseFloat(subsidy.sale_price)
    subsidy.subsidy_amount = parseFloat(subsidy.subsidy_amount)
    subsidy.subsidy_rate = parseFloat(subsidy.subsidy_rate)
    // 使用格式化后的时间作为 sale_time
    subsidy.sale_time = subsidy.sale_time_formatted
    delete subsidy.sale_time_formatted

    let subsidyPhotos = []
    if (subsidy.subsidy_photos) {
      try {
        subsidyPhotos = typeof subsidy.subsidy_photos === 'string'
          ? JSON.parse(subsidy.subsidy_photos)
          : subsidy.subsidy_photos
      } catch (e) {
        log.error('解析 subsidy_photos 失败:', e)
        subsidyPhotos = []
      }
    }

    const hasHandler = subsidy.has_different_handler === 1 || subsidy.has_different_handler === true
    subsidy.subsidy_photos = mapSubsidyPhotoUrls(subsidyPhotos)
    subsidy.has_different_handler = hasHandler
    subsidy.handler_info = hasHandler ? {
      handler_name: subsidy.handler_name || '',
      handler_phone: subsidy.handler_phone || '',
      handler_idcard: subsidy.handler_idcard || ''
    } : null

    const visibleSubsidy = await maskSubsidyItem(subsidy, req)
    res.json({
      success: true,
      message: '获取国补详情成功',
      data: visibleSubsidy
    })

  } catch (error) {
    log.error('❌ 获取国补详情失败:', error)
    res.status(500).json({
      success: false,
      message: '获取国补详情失败',
      error: error.message
    })
  }
})

router.put('/:id/photos', unifiedAuth, requireSubsidyUpload, async (req, res) => {
  try {
    const { id } = req.params
    const subsidyPhotos = req.body?.subsidy_photos
    const deletedPhotos = req.body?.deleted_photos

    if (!Array.isArray(subsidyPhotos) || !subsidyPhotos.every(photo => typeof photo === 'string')) {
      return res.status(400).json({ success: false, message: '国补照片格式不正确' })
    }
    if (deletedPhotos !== undefined && (!Array.isArray(deletedPhotos) || !deletedPhotos.every(photo => typeof photo === 'string'))) {
      return res.status(400).json({ success: false, message: '待删除照片格式不正确' })
    }

    const [result] = await getDatabase().execute(
      'UPDATE national_subsidies SET subsidy_photos = ? WHERE id = ?',
      [JSON.stringify(subsidyPhotos), id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '国补记录不存在' })
    }

    for (const photoUrl of deletedPhotos || []) {
      const relativePath = normalizeSubsidyPhotoPath(photoUrl)
      if (!relativePath) continue
      const absolutePath = path.join(getUploadsRoot(), relativePath)
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath)
      }
    }

    clearCache('/subsidy')
    return res.json({ success: true, message: '照片保存成功' })
  } catch (error) {
    log.error('保存国补照片失败:', error)
    return res.status(500).json({ success: false, message: '照片保存失败', error: error.message })
  }
})

// 更新国补信息
router.put(
  '/:id',
  unifiedAuth,
  requirePermission('subsidy:edit'),
  requireSubsidyApprovalWhenChangingApplyTime,
  requireSubsidyArrivalWhenChangingArrivalTime,
  rejectHiddenSubsidyWriteFields,
  async (req, res) => {
    try {
      const { id } = req.params
      const {
        customer_name,
        customer_phone,
        sale_time,
        customer_idcard,
        serial_number,
        imei1,
        imei2,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        sale_price,
        store_id,
        remarks,
        has_audit,
        has_arrival,
        apply_time,
        arrival_time,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      } = req.body

      // 获取当前记录信息
      const [existing] = await getDatabase().execute(
        'SELECT customer_id, imei2 FROM national_subsidies WHERE id = ?',
        [id]
      )

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: '国补记录不存在'
        })
      }

      // 如果更新了身份证号，同时更新 customers 表（包括清空的情况）
      if (customer_idcard !== undefined) {
        await getDatabase().execute(`
        UPDATE customers
        SET id_card = ?
        WHERE id = ?
      `, [customer_idcard ? customer_idcard.trim() : null, existing[0].customer_id])
      }

      // 如果更新了姓名或手机号，同时更新 customers 表
      if (customer_name || customer_phone) {
        const customerUpdates = []
        const customerParams = []

        if (customer_name) {
          customerUpdates.push('name = ?')
          customerParams.push(customer_name)
        }

        if (customer_phone) {
          customerUpdates.push('phone = ?')
          customerParams.push(customer_phone)
        }

        if (customerUpdates.length > 0) {
          customerParams.push(existing[0].customer_id)
          await getDatabase().execute(`
          UPDATE customers
          SET ${customerUpdates.join(', ')}
          WHERE id = ?
        `, customerParams)
        }
      }

      // 构建更新SQL
      const updateFields = []
      const updateValues = []

      if (customer_name !== undefined) {
        updateFields.push('customer_name = COALESCE(?, customer_name)')
        updateValues.push(customer_name || null)
      }

      if (customer_phone !== undefined) {
        updateFields.push('customer_phone = COALESCE(?, customer_phone)')
        updateValues.push(customer_phone || null)
      }

      if (sale_time !== undefined) {
        if (sale_time === '') {
          updateFields.push('sale_time = NULL')
        } else {
        // 🔥 直接使用前10个字符（日期部分），不拼接时间，避免时区问题
        // sale_time格式为 YYYY-MM-DD，直接存储日期部分
        // MySQL会自动补充为 YYYY-MM-DD 00:00:00
          updateFields.push('sale_time = ?')
          updateValues.push(sale_time)
        }
      }

      if (customer_idcard !== undefined) {
        updateFields.push('customer_idcard = ?')
        updateValues.push(customer_idcard || null)
      }

      if (imei2 !== undefined) {
        updateFields.push('imei2 = COALESCE(?, imei2)')
        updateValues.push(imei2 || null)
      }

      if (serial_number !== undefined) {
        updateFields.push('serial_number = ?')
        updateValues.push(serial_number || '')
      }

      if (imei1 !== undefined) {
        updateFields.push('imei1 = ?')
        updateValues.push(imei1 || '')
      }

      if (phone_brand !== undefined) {
        updateFields.push('phone_brand = ?')
        updateValues.push(phone_brand ? String(phone_brand).trim().slice(0, 50) : null)
      }

      if (phone_model !== undefined) {
        updateFields.push('phone_model = ?')
        updateValues.push(phone_model ? String(phone_model).trim().slice(0, 100) : null)
      }

      if (phone_color !== undefined) {
        updateFields.push('phone_color = ?')
        updateValues.push(phone_color ? String(phone_color).trim().slice(0, 50) : null)
      }

      if (phone_memory !== undefined) {
        updateFields.push('phone_memory = ?')
        updateValues.push(phone_memory ? String(phone_memory).trim().slice(0, 50) : null)
      }

      if (sale_price !== undefined) {
        if (sale_price === '' || sale_price === null) {
          return res.status(400).json({
            success: false,
            message: '销售价格不能为空'
          })
        }
        const normalizedSalePrice = Number(sale_price)
        if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice < 0) {
          return res.status(400).json({
            success: false,
            message: '销售价格必须是大于等于0的数字'
          })
        }
        updateFields.push('sale_price = ?')
        updateValues.push(normalizedSalePrice.toFixed(2))
      }

      // 处理店铺更新
      if (store_id !== undefined) {
        if (store_id === null || store_id === '') {
        // 如果清空店铺
          updateFields.push('store_id = NULL')
          updateFields.push('store_name = NULL')
        } else {
        // 根据store_id查询店铺名称
          const [stores] = await getDatabase().execute(
            'SELECT id, name FROM stores WHERE id = ?',
            [store_id]
          )

          if (stores.length > 0) {
            updateFields.push('store_id = ?')
            updateValues.push(store_id)
            updateFields.push('store_name = ?')
            updateValues.push(stores[0].name)
          } else {
            return res.status(400).json({
              success: false,
              message: '选择的店铺不存在'
            })
          }
        }
      }

      if (remarks !== undefined) {
        updateFields.push('remarks = COALESCE(?, remarks)')
        updateValues.push(remarks || null)
      }

      // 处理审批时间 - 只存储年月日
      if (apply_time !== undefined) {
        if (apply_time === '' || apply_time === null || typeof apply_time !== 'string') {
        // 空字符串表示清空时间
          updateFields.push('apply_time = NULL')
        } else {
        // apply_time格式为 YYYY-MM-DDTHH:mm，需要转换为 YYYY-MM-DD 00:00:00
          const datePart = apply_time.split('T')[0] // 获取 YYYY-MM-DD 部分
          updateFields.push('apply_time = ?')
          updateValues.push(datePart + ' 00:00:00')
        }
      } else if (has_audit !== undefined) {
      // 使用NOW()时，转换为当天北京时间的日期
        updateFields.push('apply_time = DATE_FORMAT(NOW(), "%Y-%m-%d 00:00:00")')
      }

      // 处理到账时间 - 只存储年月日
      if (arrival_time !== undefined) {
        if (arrival_time === '' || arrival_time === null || typeof arrival_time !== 'string') {
        // 空字符串表示清空时间
          updateFields.push('arrival_time = NULL')
        } else {
        // arrival_time格式为 YYYY-MM-DDTHH:mm，需要转换为 YYYY-MM-DD 00:00:00
          const datePart = arrival_time.split('T')[0] // 获取 YYYY-MM-DD 部分
          updateFields.push('arrival_time = ?')
          updateValues.push(datePart + ' 00:00:00')
        }
      } else if (has_arrival !== undefined) {
      // 使用NOW()时，转换为当天北京时间的日期
        updateFields.push('arrival_time = DATE_FORMAT(NOW(), "%Y-%m-%d 00:00:00")')
      }

      // 处理备注
      if (remarks !== undefined) {
        updateFields.push('remarks = ?')
        updateValues.push(remarks || '')
      }

      // 处理实际办理人信息
      if (has_different_handler !== undefined) {
        updateFields.push('has_different_handler = ?')
        updateValues.push(has_different_handler ? 1 : 0)

        // 如果有实际办理人，更新办理人信息
        if (has_different_handler) {
          updateFields.push('handler_name = ?')
          updateValues.push(handler_name || null)

          updateFields.push('handler_phone = ?')
          updateValues.push(handler_phone || null)

          updateFields.push('handler_idcard = ?')
          updateValues.push(handler_idcard || null)
        } else {
        // 如果没有实际办理人，清空办理人信息
          updateFields.push('handler_name = NULL')
          updateFields.push('handler_phone = NULL')
          updateFields.push('handler_idcard = NULL')
        }
      }

      updateValues.push(id)

      const [_result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues)

      // 🔥 同步更新 phones 表的 sale_time 字段
      if (sale_time !== undefined) {
      // 查询该补贴记录对应的手机ID
        const [phoneInfo] = await getDatabase().execute(
          'SELECT phone_id FROM national_subsidies WHERE id = ?',
          [id]
        )

        if (phoneInfo.length > 0 && phoneInfo[0].phone_id) {
          const phoneId = phoneInfo[0].phone_id
          let salestimeValue = null

          if (sale_time === '') {
            salestimeValue = null
          } else if (sale_time) {
          // 将日期字符串转换为 DATETIME 格式 (YYYY-MM-DD 00:00:00)
            salestimeValue = sale_time + ' 00:00:00'
          }

          // 更新 phones 表的 sale_time 字段
          await getDatabase().execute(
            'UPDATE phones SET sale_time = ? WHERE id = ?',
            [salestimeValue, phoneId]
          )
        }
      }

      clearCache('/subsidy')
      res.json({
        success: true,
        message: '更新成功'
      })

    } catch (error) {
      log.error('❌ 更新国补信息失败:', error)
      res.status(500).json({
        success: false,
        message: '更新失败',
        error: error.message
      })
    }
  })

// 审批国补申请（记录审批时间）
router.put('/:id/audit', unifiedAuth, requirePermission('subsidy:approve'), async (req, res) => {
  try {
    const { id } = req.params

    const [result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET apply_time = NOW()
      WHERE id = ?
    `, [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      })
    }

    clearCache('/subsidy')
    res.json({
      success: true,
      message: '审批成功'
    })

  } catch (error) {
    log.error('❌ 审批失败:', error)
    res.status(500).json({
      success: false,
      message: '审批失败',
      error: error.message
    })
  }
})

// 删除国补记录
router.delete('/:id', unifiedAuth, requirePermission('subsidy:delete'), async (req, res) => {
  try {
    const { id } = req.params

    // 先查询记录，获取照片信息
    const [records] = await getDatabase().execute(
      'SELECT subsidy_photos FROM national_subsidies WHERE id = ?',
      [id]
    )

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      })
    }

    // 删除数据库记录
    const [_result] = await getDatabase().execute(
      'DELETE FROM national_subsidies WHERE id = ?',
      [id]
    )

    // 删除关联的照片文件
    if (records[0].subsidy_photos) {
      try {
        const photos = typeof records[0].subsidy_photos === 'string'
          ? JSON.parse(records[0].subsidy_photos)
          : records[0].subsidy_photos

        if (Array.isArray(photos) && photos.length > 0) {
          for (const photoUrl of photos) {
            // 从 URL 中提取文件名
            const filename = photoUrl.split('/').pop()
            const filePath = path.join(uploadDir, filename)

            // 检查文件是否存在并删除
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
            }
          }
        }
      } catch (error) {
        log.error('⚠️ 删除照片文件失败:', error)
        // 不影响主流程，继续执行
      }
    }

    clearCache('/subsidy')
    res.json({
      success: true,
      message: '删除成功'
    })

  } catch (error) {
    log.error('❌ 删除国补记录失败:', error)
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    })
  }
})

// 审批国补申请
router.put('/:id/approve', unifiedAuth, requirePermission('subsidy:approve'), async (req, res) => {
  try {
    const { id } = req.params
    const { approved } = req.body

    if (typeof approved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: '请提供审批结果'
      })
    }

    const [result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET apply_status = ?
      WHERE id = ?
    `, [
      approved ? 'approved' : 'rejected',
      id
    ])

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '国补记录不存在'
      })
    }

    clearCache('/subsidy')
    res.json({
      success: true,
      message: approved ? '审批通过' : '审批拒绝'
    })

  } catch (error) {
    log.error('❌ 审批失败:', error)
    res.status(500).json({
      success: false,
      message: '审批失败',
      error: error.message
    })
  }
})

// 确认国补到账（记录到账时间）
router.put('/:id/confirm-arrival', unifiedAuth, requirePermission('subsidy:arrival'), async (req, res) => {
  try {
    const { id } = req.params

    const [result] = await getDatabase().execute(`
      UPDATE national_subsidies
      SET arrival_time = NOW()
      WHERE id = ?
    `, [id])

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: '国补记录不存在'
      })
    }

    clearCache('/subsidy')
    res.json({
      success: true,
      message: '确认到账成功'
    })

  } catch (error) {
    log.error('❌ 确认到账失败:', error)
    res.status(500).json({
      success: false,
      message: '确认到账失败',
      error: error.message
    })
  }
})

// 获取国补统计
router.get('/stats/summary', unifiedAuth, requirePermission('subsidy:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), async (req, res) => {
  const timer = createRouteTimer('GET /subsidy/stats/summary', req)
  try {
    const hiddenFields = await getSubsidyHiddenFields(req)
    const { whereConditions, queryParams } = buildSubsidyFilters(req.query)
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`
    const includeStoreStats = req.query.include_store_stats === '1' && !hiddenFields.has('stats.store_overview')
    timer.mark('filters built', {
      includeStoreStats,
      filterCount: whereConditions.length,
      queryParamCount: queryParams.length
    })

    // 总体统计
    const statsQuery = `
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN apply_time IS NULL THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN apply_time IS NOT NULL THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN arrival_time IS NOT NULL THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN has_different_handler = 1 THEN 1 ELSE 0 END) as handler_count,
        COALESCE(SUM(CASE WHEN arrival_time IS NOT NULL THEN subsidy_amount ELSE 0 END), 0) as total_arrived_amount,
        COALESCE(SUM(subsidy_amount), 0) as total_subsidy_amount
      FROM national_subsidies
      ${whereClause}
    `

    let statsQueryMs = 0
    let storeStatsQueryMs = 0

    const queryTasks = [
      (async () => {
        const startedAt = process.hrtime.bigint()
        const result = await getDatabase().execute(statsQuery, queryParams)
        statsQueryMs = Number(process.hrtime.bigint() - startedAt) / 1e6
        return result
      })()
    ]

    if (includeStoreStats) {
      const storeStatsQuery = `
        SELECT
          store_id,
          store_name,
          COUNT(*) as total_count,
          SUM(CASE WHEN apply_time IS NULL THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN apply_time IS NOT NULL THEN 1 ELSE 0 END) as completed_count,
          SUM(CASE WHEN arrival_time IS NOT NULL THEN 1 ELSE 0 END) as approved_count,
          COALESCE(SUM(CASE WHEN arrival_time IS NOT NULL THEN subsidy_amount ELSE 0 END), 0) as total_arrived_amount,
          COALESCE(SUM(subsidy_amount), 0) as total_subsidy_amount
        FROM national_subsidies
        ${whereClause} AND store_id IS NOT NULL
        GROUP BY store_id, store_name
        ORDER BY total_count DESC
      `

      queryTasks.push((async () => {
        const startedAt = process.hrtime.bigint()
        const result = await getDatabase().execute(storeStatsQuery, queryParams)
        storeStatsQueryMs = Number(process.hrtime.bigint() - startedAt) / 1e6
        return result
      })())
    }

    const results = await Promise.all(queryTasks)
    const [stats] = results[0][0]
    const storeStats = includeStoreStats ? results[1][0] : []
    timer.mark('database queries completed', {
      statsQueryMs: statsQueryMs.toFixed(2),
      storeStatsQueryMs: includeStoreStats ? storeStatsQueryMs.toFixed(2) : '0.00',
      storeCount: storeStats.length
    })

    // 格式化店铺统计数据
    const formattedStoreStats = storeStats.map(store => ({
      ...store,
      total_count: parseInt(store.total_count),
      pending_count: parseInt(store.pending_count),
      completed_count: parseInt(store.completed_count),
      approved_count: parseInt(store.approved_count),
      total_arrived_amount: parseFloat(store.total_arrived_amount),
      total_subsidy_amount: parseFloat(store.total_subsidy_amount)
    }))

    const visibleStats = {
      ...stats,
      total_arrived_amount: parseFloat(stats.total_arrived_amount),
      total_subsidy_amount: parseFloat(stats.total_subsidy_amount),
      store_stats: formattedStoreStats
    }

    if (hiddenFields.has('stats.total_and_handler')) {
      delete visibleStats.handler_count
    }
    if (hiddenFields.has('stats.approval_progress')) {
      delete visibleStats.pending_count
      delete visibleStats.completed_count
      delete visibleStats.approved_count
      visibleStats.store_stats.forEach((store) => {
        delete store.pending_count
        delete store.completed_count
        delete store.approved_count
      })
    }
    if (hiddenFields.has('stats.amount_progress')) {
      delete visibleStats.total_arrived_amount
      delete visibleStats.total_subsidy_amount
      visibleStats.store_stats.forEach((store) => {
        delete store.total_arrived_amount
        delete store.total_subsidy_amount
      })
    }
    if (hiddenFields.has('stats.store_overview')) {
      delete visibleStats.store_stats
    }

    res.json({
      success: true,
      message: '获取统计数据成功',
      data: visibleStats
    })
    timer.mark('response sent')

  } catch (error) {
    timer.mark('failed', {
      error: error.message
    })
    log.error('❌ 获取统计数据失败:', error)
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    })
  }
})

// ============================
// 图片上传接口
// ============================

/**
 * 上传国补照片
 * POST /api/subsidy/upload/photo
 * 权限：需要登录
 */
router.post('/upload/photo', unifiedAuth, requireSubsidyUpload, (req, res, next) => {
  // 使用 multer 处理上传，字段名为 'file'
  const uploadHandler = upload.single('file')

  uploadHandler(req, res, (err) => {
    if (err) {
      log.error('文件上传错误:', err)
      return ApiResponse.error(res, err.message || '文件上传失败', 500)
    }
    next()
  })
}, async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, '没有上传文件', 400)
    }

    // 获取序列号和销售时间，用于重命名文件
    const serialNumber = req.body.serial_number || 'unknown'
    const saleTime = req.body.sale_time || ''
    const timestamp = Date.now()

    // 清理文件名中的特殊字符
    const safeName = serialNumber.replace(/[^a-zA-Z0-9\-]/g, '')
    const safeSaleTime = String(saleTime).replace(/[^0-9\-]/g, '')

    // 获取文件扩展名
    const ext = path.extname(req.file.originalname).toLowerCase()

    // 构建新文件名：序列号-销售时间-时间戳.扩展名
    const newFilename = `${safeName}-${safeSaleTime}-${timestamp}${ext}`
    const oldPath = req.file.path
    const newPath = path.join(uploadDir, newFilename)

    let finalFilename = newFilename

    // 检查是否是HEIC/HEIF格式，如果是则转换为JPEG
    if (ext === '.heic' || ext === '.heif') {
      try {
        // 生成JPEG文件名
        const jpegFilename = `${safeName}-${safeSaleTime}-${timestamp}.jpg`
        const jpegPath = path.join(uploadDir, jpegFilename)

        // 读取HEIC文件
        const inputBuffer = fs.readFileSync(oldPath)

        // 使用heic-convert转换HEIC到JPEG
        const outputBuffer = await convert({
          buffer: inputBuffer,
          format: 'JPEG',
          quality: 0.9
        })

        // 写入JPEG文件
        fs.writeFileSync(jpegPath, outputBuffer)

        // 删除原始HEIC文件
        fs.unlinkSync(oldPath)

        finalFilename = jpegFilename
      } catch (convertError) {
        log.error('❌ HEIC转换失败:', convertError)
        // 如果转换失败，删除上传的文件
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath)
        }
        return ApiResponse.error(res, 'HEIC格式转换失败', 500)
      }
    } else {
      // 非HEIC格式，直接重命名文件
      fs.renameSync(oldPath, newPath)
    }

    // 构建文件访问URL - 统一返回相对路径，由前端 formatImageUrl 函数处理
    // 这样可以和 H5 上传保持一致，开发环境走 Vite 代理，生产环境走 Nginx 代理
    const fileUrl = buildProtectedSubsidyPhotoUrl(`/uploads/subsidy/${finalFilename}`)

    // 注意：ApiResponse.success 参数顺序是 (res, message, data, statusCode, meta)
    ApiResponse.success(res, '照片上传成功', {
      url: fileUrl,
      filename: finalFilename,
      size: req.file.size
    })
  } catch (error) {
    log.error('上传国补照片失败:', error)
    ApiResponse.error(res, error.message || '照片上传失败', 500)
  }
})

router.get('/files/*', authenticateSubsidyFileAccess, requireAnyPermission(['subsidy:view', 'subsidy:upload']), requireVisibleSubsidyPhotosOrUpload, (req, res) => {
  try {
    const requestedPath = typeof req.params[0] === 'string' ? req.params[0] : ''
    const normalizedRelativePath = normalizeSubsidyPhotoPath(`/uploads/${requestedPath}`)

    if (!normalizedRelativePath) {
      return res.status(400).json({
        success: false,
        message: '无效的文件路径'
      })
    }

    const uploadsRoot = getUploadsRoot()
    const absolutePath = path.join(uploadsRoot, normalizedRelativePath)
    const normalizedAbsolutePath = path.normalize(absolutePath)
    const normalizedUploadsRoot = path.normalize(uploadsRoot + path.sep)

    if (!normalizedAbsolutePath.startsWith(normalizedUploadsRoot)) {
      return res.status(403).json({
        success: false,
        message: '禁止访问该文件'
      })
    }

    if (!fs.existsSync(normalizedAbsolutePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }

    return res.sendFile(normalizedAbsolutePath)
  } catch (error) {
    log.error('读取国补照片失败:', error)
    return ApiResponse.error(res, error.message || '读取照片失败', 500)
  }
})

/**
 * 删除临时照片（未保存的上传照片）
 * POST /api/subsidy/delete-temp-photos
 * 权限：需要登录
 */
router.post('/delete-temp-photos', unifiedAuth, requirePermission('subsidy:upload'), async (req, res) => {
  try {
    const { photos } = req.body

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return ApiResponse.success(res, '没有需要删除的照片')
    }

    const deletedFiles = []
    const failedFiles = []

    for (const photoUrl of photos) {
      try {
        const normalizedRelativePath = normalizeSubsidyPhotoPath(photoUrl)
        if (!normalizedRelativePath) {
          failedFiles.push(photoUrl)
          continue
        }

        const uploadDirPath = getUploadsRoot()
        const filePath = path.join(uploadDirPath, normalizedRelativePath)
        const normalizedFilePath = path.normalize(filePath)
        const normalizedUploadDir = path.normalize(uploadDirPath + path.sep)

        if (!normalizedFilePath.startsWith(normalizedUploadDir)) {
          failedFiles.push(photoUrl)
          continue
        }

        // 删除文件
        if (fs.existsSync(normalizedFilePath)) {
          fs.unlinkSync(normalizedFilePath)
          deletedFiles.push(normalizedRelativePath)
        }
      } catch (error) {
        log.error(`⚠️ 删除临时照片失败: ${photoUrl}`, error.message)
        failedFiles.push(photoUrl)
      }
    }

    ApiResponse.success(res, `已清理 ${deletedFiles.length} 个临时文件`, {
      deleted: deletedFiles.length,
      failed: failedFiles.length
    })
  } catch (error) {
    log.error('删除临时照片失败:', error)
    ApiResponse.error(res, error.message || '删除临时照片失败', 500)
  }
})

module.exports = router
