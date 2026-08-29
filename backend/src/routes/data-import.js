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
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const log = require('../utils/log')
const { getUploadSubdir } = require('../utils/upload-paths')
const { validateSpreadsheetFile, readSpreadsheetFileSafe, sheetToJsonSafe } = require('../utils/spreadsheet-security')

const IMPORT_UPLOAD_DIR = getUploadSubdir('import')

// API 只暴露受控文件令牌，绝不把服务器绝对路径交给客户端。
function resolveFileToken(fileToken) {
  if (typeof fileToken !== 'string' || !fileToken.trim()) {
    const error = new Error('文件令牌无效')
    error.statusCode = 400
    throw error
  }
  const token = path.basename(fileToken.trim())
  if (token !== fileToken.trim() || token.includes('..')) {
    const error = new Error('文件令牌无效')
    error.statusCode = 400
    throw error
  }
  return validateSpreadsheetFile(path.join(IMPORT_UPLOAD_DIR, token), { rootPath: IMPORT_UPLOAD_DIR })
}

function normalizeImportProgress(progress, importId) {
  if (!progress) return null
  return { import_id: String(importId), ...progress }
}

function normalizeHistoryRecord(record) {
  if (!record) return record
  return {
    import_id: String(record.import_id),
    user_id: record.user_id ?? null,
    user_name: record.user_name || record.user || 'system',
    strategy: record.strategy,
    file_name: record.file_name || null,
    total_records: Number(record.total_records ?? record.total ?? 0),
    processed: Number(record.processed ?? 0),
    imported: Number(record.imported ?? 0),
    updated: Number(record.updated ?? 0),
    skipped: Number(record.skipped ?? 0),
    error_count: Number(record.error_count ?? record.errors ?? 0),
    status: record.status,
    error_message: record.error_message || null,
    start_time: record.start_time || record.timestamp || null,
    end_time: record.end_time || null,
    duration_ms: record.duration_ms ?? null,
    created_at: record.created_at || record.timestamp || null,
    updated_at: record.updated_at || null
  }
}

// 实例化服务
const dataImportService = new DataImportService()

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
router.post('/upload', requirePermission('data-import:upload'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传文件'
      })
    }

    // 读取Excel文件
    const safeFilePath = validateSpreadsheetFile(req.file.path, { rootPath: IMPORT_UPLOAD_DIR })
    const workbook = readSpreadsheetFileSafe(safeFilePath)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = sheetToJsonSafe(worksheet, { defval: '' })

    // 获取字段列表
    const headers = data.length > 0 ? Object.keys(data[0]) : []

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        file_token: path.basename(req.file.path),
        file_name: req.file.originalname,
        file_size: req.file.size,
        total_rows: data.length,
        headers: headers,
        preview_data: data.slice(0, 10),
        sheets: workbook.SheetNames
      }
    })
  } catch (error) {
    log.error('上传文件失败:', error)
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(error.statusCode || 500).json({
      success: false,
      message: '上传文件失败，请检查文件格式后重试'
    })
  }
})

/**
 * 分析Excel数据并检查重复
 */
router.post('/analyze', requirePermission('data-import:upload'), async (req, res) => {
  try {
    const fileToken = req.body.file_token
    const options = req.body.options || {}

    const safeFilePath = resolveFileToken(fileToken)
    const result = await dataImportService.analyzeData(safeFilePath, options)

    res.json({
      success: true,
      message: '数据分析完成',
      data: result
    })
  } catch (error) {
    log.error('分析数据失败:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      message: '分析数据失败，请检查文件后重试'
    })
  }
})

/**
 * 执行数据导入
 * 选项：
 * - skip_duplicates: 跳过重复数据
 * - overwrite: 覆盖重复数据
 * - merge: 合并重复数据
 * - create_missing: 创建缺失的基础数据
 */
router.post('/import', requirePermission('data-import:execute'), async (req, res) => {
  try {
    const fileToken = req.body.file_token
    const options = { ...(req.body.options || {}) }

    const safeFilePath = resolveFileToken(fileToken)

    // 验证选项
    const validStrategies = ['smart', 'skip', 'overwrite', 'merge', 'replace_all']
    const strategy = options?.strategy || 'smart'

    if (!validStrategies.includes(strategy)) {
      log.error('❌ 无效的策略:', strategy, '有效策略:', validStrategies)
      return res.status(400).json({
        success: false,
        message: '无效的导入策略: ' + strategy
      })
    }

    // 任务编号由服务端生成，避免客户端伪造或并发碰撞。
    const importId = crypto.randomUUID()
    options.import_id = importId

    log.debug('📋 导入任务创建 - importId:', importId, 'options:', options)

    // 立即初始化进度，避免前端查询时找不到
    dataImportService.updateProgress(importId, 0, '导入任务已创建，正在初始化...')
    log.debug('✓ 进度已初始化:', dataImportService.getImportProgress(importId))

    // 异步执行导入
    dataImportService.importData(safeFilePath, options, req.user)
      .then(_result => {
        log.debug(`✓ 导入 ${importId} 完成`)
      })
      .catch(error => {
        log.error(`✗ 导入 ${importId} 失败:`, error)
      })

    res.json({
      success: true,
      message: '导入任务已启动',
      data: {
        import_id: importId,
        strategy: strategy
      }
    })
  } catch (error) {
    log.error('启动导入失败:', error)
    res.status(error.statusCode || 500).json({
      success: false,
      message: '启动导入失败，请稍后重试'
    })
  }
})

/**
 * 获取导入进度
 */
router.get('/progress/:import_id', requirePermission('data-import:view'), async (req, res) => {
  try {
    const importId = req.params.import_id
    const progress = dataImportService.getImportProgress(importId)

    log.debug('📊 查询进度 - importId:', importId, 'progress:', progress)

    if (!progress) {
      // 检查导入历史，看是否已经完成
      const history = dataImportService.getImportHistory()
      const completedTask = history.find(h => String(h.import_id) === String(importId))

      if (completedTask) {
        // 任务已完成但进度数据已清理
        return res.json({
          success: true,
          message: '导入已完成',
          data: {
            status: 'completed',
            progress: 100,
            message: '导入已完成',
            import_id: importId,
            ...normalizeHistoryRecord(completedTask)
          }
        })
      }

      // 返回处理中状态而不是 404，避免前端中断轮询
      // 可能任务正在初始化中
      return res.json({
        success: true,
        message: '导入任务正在初始化',
        data: {
          status: 'processing',
          progress: 0,
          message: '导入任务正在初始化，请稍后...',
          import_id: importId
        }
      })
    }

    res.json({
      success: true,
      message: '获取导入进度成功',
      data: normalizeImportProgress(progress, importId)
    })
  } catch (error) {
    log.error('获取导入进度失败:', error)
    res.status(500).json({
      success: false,
      message: '获取导入进度失败，请稍后重试'
    })
  }
})

/**
 * 获取导入历史（从数据库）
 * 支持分页、筛选、排序
 */
router.get('/history', requirePermission('data-import:view'), async (req, res) => {
  const connection = req.app.get('db')

  if (!connection) {
    return res.status(500).json({
      success: false,
      message: '数据库连接不可用'
    })
  }

  try {
    // 获取查询参数
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 20, 1), 100)
    const status = req.query.status || null
    const strategy = req.query.strategy || null
    const userId = req.query.user_id || null
    const offset = (page - 1) * pageSize

    // 构建 WHERE 条件
    const conditions = []
    const queryParams = []

    if (status) {
      conditions.push('status = ?')
      queryParams.push(status)
    }

    if (strategy) {
      conditions.push('strategy = ?')
      queryParams.push(strategy)
    }

    if (userId) {
      conditions.push('user_id = ?')
      queryParams.push(userId)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    // 查询总数
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM import_history ${whereClause}`,
      queryParams
    )

    const total = countResult[0].total

    // 查询历史记录 - 确保 LIMIT 和 OFFSET 是整数
    const [history] = await connection.execute(
      `SELECT
        id,
        import_id,
        user_id,
        user_name,
        strategy,
        file_name,
        total_records,
        imported,
        updated,
        skipped,
        error_count,
        status,
        error_message,
        start_time,
        end_time,
        duration_ms,
        created_at,
        updated_at
      FROM import_history
      ${whereClause}
      ORDER BY start_time DESC
      LIMIT ${pageSize} OFFSET ${parseInt(offset, 10)}`,
      queryParams
    )

    res.json({
      success: true,
      message: '获取导入历史成功',
      data: history,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
        has_next: page * pageSize < total,
        has_prev: page > 1
      }
    })
  } catch (error) {
    log.error('获取导入历史失败:', error)
    res.status(500).json({
      success: false,
      message: '获取导入历史失败，请稍后重试'
    })
  }
})

/**
 * 获取活跃的导入任务（调试用）
 */
router.get('/active-tasks', requirePermission('permissions:admin'), async (_req, res) => {
  try {
    const activeTasks = dataImportService.getActiveTasks()

    res.json({
      success: true,
      message: '获取活跃任务成功',
      data: {
        count: activeTasks.length,
        tasks: activeTasks.map(task => {
          return {
            import_id: String(task.import_id),
            progress: task.progress,
            age_minutes: task.age_minutes,
            timestamp: task.timestamp
          }
        })
      }
    })
  } catch (error) {
    log.error('获取活跃任务失败:', error)
    res.status(500).json({
      success: false,
      message: '获取活跃任务失败，请稍后重试'
    })
  }
})

/**
 * 删除导入历史记录
 */
router.delete('/history/:id', requirePermission('data-import:delete'), async (req, res) => {
  const connection = req.app.get('db')

  if (!connection) {
    return res.status(500).json({
      success: false,
      message: '数据库连接不可用'
    })
  }

  try {
    const { id } = req.params

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的记录ID'
      })
    }

    // 检查记录是否存在
    const [records] = await connection.execute(
      'SELECT * FROM import_history WHERE id = ?',
      [id]
    )

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      })
    }

    // 删除记录
    await connection.execute(
      'DELETE FROM import_history WHERE id = ?',
      [id]
    )

    log.debug(`✅ 导入历史记录已删除: id=${id}`)

    res.json({
      success: true,
      message: '删除成功',
      data: { id }
    })
  } catch (error) {
    log.error('删除导入历史失败:', error)
    res.status(500).json({
      success: false,
      message: '删除失败，请稍后重试'
    })
  }
})

/**
 * 获取活跃的导入任务（调试用）
 */
router.delete('/progress/:import_id', requirePermission('permissions:admin'), async (req, res) => {
  try {
    const importId = req.params.import_id

    dataImportService.clearProgress(importId)

    res.json({
      success: true,
      message: '清理导入进度成功',
      data: { import_id: importId }
    })
  } catch (error) {
    log.error('清理导入进度失败:', error)
    res.status(500).json({
      success: false,
      message: '清理导入进度失败，请稍后重试'
    })
  }
})

module.exports = router
