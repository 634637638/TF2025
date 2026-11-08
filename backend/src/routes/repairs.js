'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const express = require('express')
const multer = require('multer')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { getDatabase, isConnected } = require('../config/database')
const log = require('../utils/log')
const dataMaskingService = require('../services/data-masking.service')
const { getUploadSubdir, getUploadUrl, getRelativeUploadPathFromUrl, getUploadPathFromUrl } = require('../utils/upload-paths')
const { searchCustomers: searchCustomerOptions } = require('../services/customer-search.service')
const { createPrivateFileUrl, verifyPrivateFileAccess } = require('../utils/private-file-access')
const RepairLookupController = require('../controllers/repair-lookup.controller')
const RepairLookupService = require('../services/repair-lookup.service')
const RepairLookupRepository = require('../repositories/repair-lookup.repository')
const RepairReadController = require('../controllers/repair-read.controller')
const RepairReadService = require('../services/repair-read.service')
const RepairReadRepository = require('../repositories/repair-read.repository')
const RepairCustomerController = require('../controllers/repair-customer.controller')
const RepairCustomerService = require('../services/repair-customer.service')
const RepairCustomerRepository = require('../repositories/repair-customer.repository')
const RepairMediaCleanupController = require('../controllers/repair-media-cleanup.controller')
const RepairMediaCleanupService = require('../services/repair-media-cleanup.service')
const RepairStatusController = require('../controllers/repair-status.controller')
const RepairStatusService = require('../services/repair-status.service')
const RepairStatusRepository = require('../repositories/repair-status.repository')
const RepairMediaReadController = require('../controllers/repair-media-read.controller')
const RepairMediaReadService = require('../services/repair-media-read.service')
const RepairMediaUploadController = require('../controllers/repair-media-upload.controller')
const RepairMediaUploadService = require('../services/repair-media-upload.service')
const RepairCreateController = require('../controllers/repair-create.controller')
const RepairCreateService = require('../services/repair-create.service')
const RepairCreateRepository = require('../repositories/repair-create.repository')
const RepairUpdateController = require('../controllers/repair-update.controller')
const RepairUpdateService = require('../services/repair-update.service')
const RepairUpdateRepository = require('../repositories/repair-update.repository')

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
const buildRepairMediaUrl = (relativePath, userId) => createPrivateFileUrl({
  routePrefix: '/api/repairs/media',
  relativePath: String(relativePath).replace(/\\/g, '/').replace(/^repairs\//, ''),
  userId,
  namespace: 'repair-media',
  ttlSeconds: 10 * 60
})
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
      url: getUploadUrl(...relative.split('/')),
      type,
      name: String(item?.name || path.basename(relative))
    }
  })
}

const invalidRepairMedia = message => Object.assign(new Error(message), { statusCode: 400 })

const validateSubmittedRepairMedia = (value, userId, existingMedia = []) => {
  const submitted = Array.isArray(value) ? value : []
  const existingPaths = new Set(existingMedia.map(item => getRelativeUploadPathFromUrl(item?.url)).filter(Boolean))

  for (const item of submitted) {
    const url = typeof item === 'string' ? item : item?.url
    const relative = getRelativeUploadPathFromUrl(url)
    if (!relative || !relative.startsWith('repairs/')) throw invalidRepairMedia('维修媒体地址无效')
    if (existingPaths.has(relative)) continue
    if (!relative.startsWith('repairs/temp/')) throw invalidRepairMedia('只能新增当前用户上传的临时维修媒体')

    const parsedUrl = new URL(String(url), 'http://localhost')
    const validSignature = verifyPrivateFileAccess({
      namespace: 'repair-media',
      relativePath: relative.replace(/^repairs\//, ''),
      userId,
      expires: parsedUrl.searchParams.get('expires'),
      signature: parsedUrl.searchParams.get('signature')
    })
    if (!validSignature || Number(parsedUrl.searchParams.get('user')) !== Number(userId)) {
      throw invalidRepairMedia('维修媒体链接无效、已过期或不属于当前用户')
    }
  }

  return normalizeRepairMedia(submitted)
}

const normalizeRepairRow = (row, userId) => ({
  ...row,
  photos: normalizeRepairMedia(parseStoredRepairMedia(row.photos)).map(item => ({
    ...item,
    url: buildRepairMediaUrl(getRelativeUploadPathFromUrl(item.url), userId)
  }))
})

const moveRepairTempMedia = async (media, repairId, userId) => {
  const targetDirectory = getUploadSubdir('repairs', String(repairId))
  await fs.promises.mkdir(targetDirectory, { recursive: true })
  const archivedMedia = []
  const movedFiles = []

  try {
    for (const item of media) {
      const relative = getRelativeUploadPathFromUrl(item.url)
      if (!relative.startsWith('repairs/temp/')) {
        archivedMedia.push(item)
        continue
      }
      const filename = path.basename(relative)
      if (!filename.startsWith(`${Number(userId)}_`)) throw new Error('只能保存当前用户上传的临时媒体')
      const sourcePath = getUploadPathFromUrl(item.url)
      const targetPath = path.join(targetDirectory, filename)
      await fs.promises.rename(sourcePath, targetPath)
      movedFiles.push({ sourcePath, targetPath })
      archivedMedia.push({ ...item, url: getUploadUrl('repairs', String(repairId), filename) })
    }
    return { archivedMedia, movedFiles }
  } catch (error) {
    for (const moved of movedFiles.reverse()) {
      try {
        if (fs.existsSync(moved.targetPath) && !fs.existsSync(moved.sourcePath)) {
          await fs.promises.mkdir(path.dirname(moved.sourcePath), { recursive: true })
          await fs.promises.rename(moved.targetPath, moved.sourcePath)
        }
      } catch (rollbackError) {
        error.message += `；维修媒体回滚失败: ${rollbackError.message}`
      }
    }
    throw error
  }
}

const rollbackRepairMediaMoves = async movedFiles => {
  for (const moved of [...movedFiles].reverse()) {
    if (!fs.existsSync(moved.targetPath) || fs.existsSync(moved.sourcePath)) continue
    await fs.promises.mkdir(path.dirname(moved.sourcePath), { recursive: true })
    await fs.promises.rename(moved.targetPath, moved.sourcePath)
  }
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

const repairLookupController = new RepairLookupController({
  service: new RepairLookupService({
    repository: new RepairLookupRepository({ getDatabase: getDb }),
    getHiddenFields: getRepairHiddenFields,
    searchCustomers: searchCustomerOptions
  })
})

const parsePositiveId = value => {
  const id = Number.parseInt(String(value), 10)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const parseMoney = value => {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Number(amount.toFixed(2)) : null
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

const repairReadController = new RepairReadController({
  service: new RepairReadService({
    repository: new RepairReadRepository({ getDatabase: getDb, listQuery }),
    getHiddenFields: getRepairHiddenFields,
    validStatuses: VALID_STATUSES,
    parseId: parsePositiveId,
    normalizeRepairRow,
    maskRepairItem,
    maskRepairList
  })
})

const repairStatusController = new RepairStatusController({
  service: new RepairStatusService({
    repository: new RepairStatusRepository({ getDatabase: getDb, listQuery }),
    validStatuses: VALID_STATUSES,
    parseId: parsePositiveId
  }),
  normalizeRepairRow,
  maskRepairItem
})

const repairCreateController = new RepairCreateController({
  service: new RepairCreateService({
    repository: new RepairCreateRepository({ getDb, listQuery }),
    parseId: parsePositiveId,
    validateMedia: validateSubmittedRepairMedia,
    moveMedia: moveRepairTempMedia,
    rollbackMedia: rollbackRepairMediaMoves
  }),
  normalizeRepairRow,
  maskRepairItem
})

const repairUpdateController = new RepairUpdateController({
  service: new RepairUpdateService({
    repository: new RepairUpdateRepository({ getDb, listQuery }),
    parseId: parsePositiveId,
    parseMoney,
    validateMedia: validateSubmittedRepairMedia,
    moveMedia: moveRepairTempMedia,
    rollbackMedia: rollbackRepairMediaMoves,
    removeMedia: removeRepairMediaFiles,
    parseStoredMedia: parseStoredRepairMedia,
    normalizeMedia: normalizeRepairMedia,
    logger: log
  }),
  normalizeRepairRow,
  maskRepairItem
})

const repairCustomerController = new RepairCustomerController({
  service: new RepairCustomerService({
    repository: new RepairCustomerRepository({ getDatabase: getDb }),
    getHiddenFields: getRepairHiddenFields
  })
})

const repairMediaCleanupController = new RepairMediaCleanupController({
  service: new RepairMediaCleanupService()
})

const repairMediaReadController = new RepairMediaReadController({
  service: new RepairMediaReadService()
})

const repairMediaUploadController = new RepairMediaUploadController({
  uploadParser: repairMediaUpload.array('files', 12),
  service: new RepairMediaUploadService({
    buildMediaUrl: buildRepairMediaUrl,
    mediaTypeFromUrl
  })
})

router.get('/', unifiedAuth, requirePermission('repairs:view'), repairReadController.list.bind(repairReadController))

router.get('/stats', unifiedAuth, requirePermission('repairs:view'), repairReadController.stats.bind(repairReadController))

router.get('/options', unifiedAuth, requirePermission('repairs:view'), repairLookupController.options.bind(repairLookupController))

router.get('/customers/search', unifiedAuth, requireAnyPermission(['repairs:view', 'repairs:create', 'repairs:edit']), repairLookupController.searchCustomers.bind(repairLookupController))

router.post('/customers', unifiedAuth, requirePermission('repairs:create'), repairCustomerController.create.bind(repairCustomerController))

router.get('/devices/search', unifiedAuth, requirePermission('repairs:view'), repairLookupController.searchDevices.bind(repairLookupController))

router.post(
  '/upload/media',
  unifiedAuth,
  requireAnyPermission(['repairs:create', 'repairs:edit']),
  repairMediaUploadController.parseUpload.bind(repairMediaUploadController),
  repairMediaUploadController.upload.bind(repairMediaUploadController)
)

router.post('/upload/cleanup', unifiedAuth, requireAnyPermission(['repairs:create', 'repairs:edit']), repairMediaCleanupController.cleanup.bind(repairMediaCleanupController))

router.get('/media/*', repairMediaReadController.read.bind(repairMediaReadController))

router.get('/:id', unifiedAuth, requirePermission('repairs:view'), repairReadController.detail.bind(repairReadController))

router.post('/', unifiedAuth, requirePermission('repairs:create'), rejectHiddenRepairWriteFields, repairCreateController.create.bind(repairCreateController))

router.put('/:id', unifiedAuth, requirePermission('repairs:edit'), rejectHiddenRepairWriteFields, repairUpdateController.update.bind(repairUpdateController))

router.patch('/:id/status', unifiedAuth, requirePermission('repairs:edit'), repairStatusController.update.bind(repairStatusController))

router.delete('/:id', unifiedAuth, requirePermission('repairs:delete'), repairStatusController.cancel.bind(repairStatusController))

module.exports = router
