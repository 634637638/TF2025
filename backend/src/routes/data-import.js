/**
 * 数据导入路由
 * 支持从Excel导入数据，提供跳过、覆盖、合并等选项
 */
const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const DataImportService = require('../services/data-import.service')
const DataImportFileService = require('../services/data-import-file.service')
const DataImportController = require('../controllers/data-import.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const { getUploadSubdir } = require('../utils/upload-paths')

const IMPORT_UPLOAD_DIR = getUploadSubdir('import')

// 实例化服务
const dataImportService = new DataImportService()
const dataImportFileService = new DataImportFileService({ importDirectory: IMPORT_UPLOAD_DIR })
const dataImportController = new DataImportController({ service: dataImportService, fileService: dataImportFileService })

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getUploadSubdir('import')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex')
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(file.mimetype) || ext === '.xls' || ext === '.xlsx') {
      cb(null, true)
    } else {
      cb(new Error('只支持上传 .xls 或 .xlsx 格式的Excel文件'))
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

// 应用认证中间件
router.use(unifiedAuth)

/**
 * 上传并解析Excel文件
 */
router.post('/upload', requirePermission('data-import:upload'), upload.single('file'), dataImportController.upload.bind(dataImportController))

/**
 * 清理未使用的导入文件
 */
router.post('/upload/cleanup', requirePermission('data-import:upload'), dataImportController.cleanupFile.bind(dataImportController))

/**
 * 分析Excel数据并检查重复
 */
router.post('/analyze', requirePermission('data-import:upload'), dataImportController.analyze.bind(dataImportController))

/**
 * 执行数据导入
 * 选项：
 * - skip_duplicates: 跳过重复数据
 * - overwrite: 覆盖重复数据
 * - merge: 合并重复数据
 * - create_missing: 创建缺失的基础数据
 */
router.post('/import', requirePermission('data-import:execute'), dataImportController.startImport.bind(dataImportController))

/**
 * 获取导入进度
 */
router.get('/progress/:import_id', requirePermission('data-import:view'), dataImportController.progress.bind(dataImportController))

/**
 * 获取导入历史（从数据库）
 * 支持分页、筛选、排序
 */
router.get('/history', requirePermission('data-import:view'), dataImportController.history.bind(dataImportController))

/**
 * 获取活跃的导入任务（调试用）
 */
router.get('/active-tasks', requirePermission('permissions:admin'), dataImportController.activeTasks.bind(dataImportController))

/**
 * 删除导入历史记录
 */
router.delete('/history/:id', requirePermission('data-import:delete'), dataImportController.removeHistory.bind(dataImportController))

/**
 * 获取活跃的导入任务（调试用）
 */
router.delete('/progress/:import_id', requirePermission('permissions:admin'), dataImportController.clearProgress.bind(dataImportController))

module.exports = router
