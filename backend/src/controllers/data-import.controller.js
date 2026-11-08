'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const DataImportHistoryService = require('../services/data-import-history.service')
const DataImportService = require('../services/data-import.service')
const DataImportFileService = require('../services/data-import-file.service')
const { readSpreadsheetFileSafe, sheetToJsonSafe } = require('../utils/spreadsheet-security')
const log = require('../utils/log')

const getUserId = user => user?.id ?? user?.userId ?? user?.sub ?? null

const normalizeImportProgress = (progress, importId) => (
  progress ? { import_id: String(importId), ...progress } : null
)

const normalizeHistoryRecord = record => {
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

class DataImportController {
  constructor({
    service = new DataImportService(),
    fileService = new DataImportFileService(),
    readSpreadsheet = readSpreadsheetFileSafe,
    sheetToJson = sheetToJsonSafe,
    fileSystem = fs,
    createImportId = crypto.randomUUID,
    logger = log
  } = {}) {
    this.historyService = new DataImportHistoryService({ logger })
    this.service = service
    this.fileService = fileService
    this.readSpreadsheet = readSpreadsheet
    this.sheetToJson = sheetToJson
    this.fileSystem = fileSystem
    this.createImportId = createImportId
    this.logger = logger
  }

  async upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '请上传文件' })
      }

      const safeFilePath = this.fileService.validateUploadedFile(req.file.path)
      const workbook = this.readSpreadsheet(safeFilePath)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = this.sheetToJson(worksheet, { defval: '' })
      const headers = data.length > 0 ? Object.keys(data[0]) : []

      res.json({
        success: true,
        message: '文件上传成功',
        data: {
          file_token: path.basename(req.file.path),
          file_name: req.file.originalname,
          file_size: req.file.size,
          total_rows: data.length,
          headers,
          preview_data: data.slice(0, 10),
          sheets: workbook.SheetNames
        }
      })
      this.fileService.register(path.basename(req.file.path), getUserId(req.user))
    } catch (error) {
      this.logger.error('上传文件失败:', error)
      if (req.file && this.fileSystem.existsSync(req.file.path)) {
        this.fileSystem.unlinkSync(req.file.path)
      }
      return res.status(error.statusCode || 500).json({
        success: false,
        message: '上传文件失败，请检查文件格式后重试'
      })
    }
  }

  async cleanupFile(req, res) {
    try {
      const fileToken = req.body?.file_token
      const safeImportPath = this.fileService.resolve(fileToken, getUserId(req.user))
      if (this.fileSystem.existsSync(safeImportPath)) this.fileSystem.unlinkSync(safeImportPath)
      this.fileService.remove(fileToken)
      return res.json({ success: true, message: '未使用的导入文件已清理' })
    } catch (error) {
      this.logger.error('清理导入文件失败:', error)
      return res.status(error.statusCode || 500).json({ success: false, message: '清理导入文件失败' })
    }
  }

  async analyze(req, res) {
    try {
      const fileToken = req.body.file_token
      const options = req.body.options || {}
      const safeFilePath = this.fileService.resolve(fileToken, getUserId(req.user))
      const result = await this.service.analyzeData(safeFilePath, options)
      return res.json({ success: true, message: '数据分析完成', data: result })
    } catch (error) {
      this.logger.error('分析数据失败:', error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: '分析数据失败，请检查文件后重试'
      })
    }
  }

  async startImport(req, res) {
    try {
      const fileToken = req.body.file_token
      const options = { ...(req.body.options || {}) }
      const safeFilePath = this.fileService.resolve(fileToken, getUserId(req.user))
      this.fileService.remove(fileToken)

      const validStrategies = ['smart', 'skip', 'overwrite', 'merge', 'replace_all']
      const strategy = options?.strategy || 'smart'
      if (!validStrategies.includes(strategy)) {
        this.logger.error('❌ 无效的策略:', strategy, '有效策略:', validStrategies)
        return res.status(400).json({ success: false, message: '无效的导入策略: ' + strategy })
      }

      const importId = this.createImportId()
      options.import_id = importId
      this.logger.debug('📋 导入任务创建 - importId:', importId, 'options:', options)
      this.service.updateProgress(importId, 0, '导入任务已创建，正在初始化...')
      this.logger.debug('✓ 进度已初始化:', this.service.getImportProgress(importId))

      this.service.importData(safeFilePath, options, req.user)
        .then(() => this.logger.debug(`✓ 导入 ${importId} 完成`))
        .catch(error => this.logger.error(`✗ 导入 ${importId} 失败:`, error))
        .finally(() => {
          try {
            if (this.fileSystem.existsSync(safeFilePath)) this.fileSystem.unlinkSync(safeFilePath)
          } catch (cleanupError) {
            this.logger.warn('导入完成后清理文件失败:', cleanupError.message)
          }
        })

      return res.json({
        success: true,
        message: '导入任务已启动',
        data: { import_id: importId, strategy }
      })
    } catch (error) {
      this.logger.error('启动导入失败:', error)
      return res.status(error.statusCode || 500).json({
        success: false,
        message: '启动导入失败，请稍后重试'
      })
    }
  }

  async progress(req, res) {
    try {
      const importId = req.params.import_id
      const progress = this.service.getImportProgress(importId)
      this.logger.debug('📊 查询进度 - importId:', importId, 'progress:', progress)

      if (!progress) {
        const completedTask = this.service.getImportHistory()
          .find(history => String(history.import_id) === String(importId))
        if (completedTask) {
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

      return res.json({
        success: true,
        message: '获取导入进度成功',
        data: normalizeImportProgress(progress, importId)
      })
    } catch (error) {
      this.logger.error('获取导入进度失败:', error)
      return res.status(500).json({ success: false, message: '获取导入进度失败，请稍后重试' })
    }
  }

  async activeTasks(_req, res) {
    try {
      const activeTasks = this.service.getActiveTasks()
      return res.json({
        success: true,
        message: '获取活跃任务成功',
        data: {
          count: activeTasks.length,
          tasks: activeTasks.map(task => ({
            import_id: String(task.import_id),
            progress: task.progress,
            age_minutes: task.age_minutes,
            timestamp: task.timestamp
          }))
        }
      })
    } catch (error) {
      this.logger.error('获取活跃任务失败:', error)
      return res.status(500).json({ success: false, message: '获取活跃任务失败，请稍后重试' })
    }
  }

  async clearProgress(req, res) {
    try {
      const importId = req.params.import_id
      this.service.clearProgress(importId)
      return res.json({
        success: true,
        message: '清理导入进度成功',
        data: { import_id: importId }
      })
    } catch (error) {
      this.logger.error('清理导入进度失败:', error)
      return res.status(500).json({ success: false, message: '清理导入进度失败，请稍后重试' })
    }
  }

  async history(req, res) {
    try {
      return res.json(await this.historyService.history(req.query, req.app.get('db')))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('获取导入历史失败:', error)
      return res.status(500).json({ success: false, message: '获取导入历史失败，请稍后重试' })
    }
  }

  async removeHistory(req, res) {
    try {
      return res.json(await this.historyService.removeHistory(req.params, req.app.get('db')))
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message })

      this.logger.error('删除导入历史失败:', error)
      return res.status(500).json({ success: false, message: '删除失败，请稍后重试' })
    }
  }
}

module.exports = DataImportController
