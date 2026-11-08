'use strict'

const path = require('node:path')
const { PRODUCTION_RUNTIME_FILES } = require('../config/runtime-files')
const log = require('../utils/log')

let archiveBackupInProgress = false

const sanitizeArchiveBackupName = (name, fallbackName) => {
  const normalizedName = String(name || '')
    .trim()
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  return normalizedName || fallbackName
}

class GitArchiveBackupService {
  constructor({
    projectRoot = path.resolve(__dirname, '../../..'),
    fileSystem,
    existsSync,
    executeCommand,
    executeArchive,
    now = () => new Date(),
    logger = log
  } = {}) {
    if (!fileSystem || typeof fileSystem.mkdir !== 'function' || typeof fileSystem.stat !== 'function') {
      throw new TypeError('GitArchiveBackupService requires promise-based filesystem operations')
    }
    if (typeof existsSync !== 'function' || typeof executeCommand !== 'function' || typeof executeArchive !== 'function') {
      throw new TypeError('GitArchiveBackupService requires filesystem and process adapters')
    }
    this.projectRoot = projectRoot
    this.fileSystem = fileSystem
    this.existsSync = existsSync
    this.executeCommand = executeCommand
    this.executeArchive = executeArchive
    this.now = now
    this.logger = logger
  }

  async createArchiveBackup(name) {
    if (archiveBackupInProgress) {
      throw Object.assign(new Error('已有压缩包备份正在创建，请稍后再试'), { statusCode: 409 })
    }
    archiveBackupInProgress = true

    try {
      this.logger.debug('📦 开始创建本地压缩包备份:', { name })
      const now = this.now()
      const timestampParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(now)
      const getPart = type => timestampParts.find(part => part.type === type)?.value || '00'
      const timestamp = `${getPart('year')}-${getPart('month')}-${getPart('day')}_${getPart('hour')}-${getPart('minute')}-${getPart('second')}`
      const backupName = sanitizeArchiveBackupName(name, `${timestamp}备份`)
      const backupFileName = `${backupName}.tar.gz`
      const backupDir = path.join(this.projectRoot, '本地备份')
      const backupFilePath = path.join(backupDir, backupFileName)

      this.logger.debug('📁 项目根目录:', this.projectRoot)
      this.logger.debug('📁 备份目录:', backupDir)
      await this.fileSystem.mkdir(backupDir, { recursive: true })

      const statusResult = await this.executeCommand('git status --porcelain')
      const hasChanges = statusResult.stdout.trim().length > 0
      this.logger.debug('🗜️  创建核心项目压缩包...')

      const archiveItems = ['frontend', 'package.json']
      const backendItems = [
        'backend/src',
        'backend/package.json',
        'backend/package-lock.json',
        ...PRODUCTION_RUNTIME_FILES.map(file => `backend/${file}`),
        'backend/database',
        'backend/migrations',
        'backend/.env.example'
      ]
      for (const item of backendItems) {
        if (this.existsSync(path.join(this.projectRoot, item))) archiveItems.push(item)
      }
      for (const item of ['package-lock.json', 'shared']) {
        if (this.existsSync(path.join(this.projectRoot, item))) archiveItems.push(item)
      }

      const excludePatterns = [
        'node_modules', '.git', 'dist', 'build', '.DS_Store', '*.log', 'uploads', '.vite',
        '.frontend.pid', '.eslintrc.js', '本地备份', 'ssl', '.claude', 'restart-backend.sh',
        'force-sync-permissions.js', 'fix_time_literals.py', 'router-guards-fix.patch',
        'public/quick-fix.js', 'backend/logs', 'backend/uploads', 'backend/*.pid',
        'backend/migrations/*.pid', 'backend/*.traineddata', 'backend/.env',
        'backend/.env.production', 'backend/.env.production-fixed',
        'backend/.env.production-separated', 'backend/database/*.db',
        'backend/scripts/*.json', 'backend/.DS_Store'
      ]
      const tarOptions = { cwd: this.projectRoot, maxBuffer: 10 * 1024 * 1024, timeout: 120000 }
      try {
        await this.executeArchive('tar', [
          ...excludePatterns.map(pattern => `--exclude=${pattern}`),
          '-czf', backupFilePath, ...archiveItems
        ], tarOptions)
        this.logger.debug('✅ 压缩包创建成功')
      } catch (error) {
        this.logger.debug('⚠️  tar 命令出现问题:', error.message)
        this.logger.debug('📦 使用简化方案：只备份核心文件...')
        try {
          await this.executeArchive('tar', [
            '--exclude=node_modules', '--exclude=.git', '--exclude=uploads',
            '-czf', backupFilePath, ...archiveItems
          ], { ...tarOptions, timeout: 60000 })
          this.logger.debug('✅ 核心文件压缩包创建成功')
        } catch (fallbackError) {
          throw new Error(`无法创建压缩包: ${fallbackError.message}`)
        }
      }

      const stats = await this.fileSystem.stat(backupFilePath)
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
      let gitInfo = {}
      try {
        const logResult = await this.executeCommand('git log -1 --pretty=format:"%H|%s|%ai|%an"')
        const [hash, subject, date, author] = logResult.stdout.trim().split('|')
        gitInfo = { hash: hash.substring(0, 8), message: subject, date, author }
      } catch {
        this.logger.debug('⚠️  无法获取 Git 信息')
      }

      this.logger.debug('✅ 本地压缩包备份创建成功:', {
        fileName: backupFileName,
        filePath: backupFilePath,
        fileSize: `${fileSizeInMB} MB`,
        hasChanges
      })
      return {
        message: `本地压缩包备份创建成功 (${fileSizeInMB} MB)`,
        backup: {
          fileName: backupFileName,
          filePath: backupFilePath,
          fileSize: `${fileSizeInMB} MB`,
          fileSizeBytes: stats.size,
          createdAt: now.toISOString(),
          gitInfo,
          hasChanges,
          includedItems: archiveItems,
          type: 'archive'
        }
      }
    } finally {
      archiveBackupInProgress = false
    }
  }
}

module.exports = GitArchiveBackupService
